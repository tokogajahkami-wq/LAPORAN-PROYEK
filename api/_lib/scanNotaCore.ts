import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

export const VALID_CATEGORIES = [
  'MATERIAL & ALAT BANTU',
  'BBM',
  'OPERASIONAL & LISTRIK',
  'KOORDINASI / LINGKUNGAN',
  'ALAT',
  'POTONGAN SUBKON',
  'LAIN-LAIN',
] as const;

export interface ScanNotaRequestBody {
  imageBase64?: unknown;
  mimeType?: unknown;
  defaultDate?: unknown;
}

export interface ScanNotaResult {
  status: number;
  body: Record<string, unknown>;
}

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY belum dikonfigurasi di server. Pastikan Environment Variable GEMINI_API_KEY sudah diisi di pengaturan hosting/server lalu deploy ulang.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export async function processScanNota(
  payload: ScanNotaRequestBody | null | undefined,
  options?: { maxTotalBudgetMs?: number; attemptTimeoutMs?: number }
): Promise<ScanNotaResult> {
  try {
    const { imageBase64, mimeType, defaultDate } = payload ?? {};

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return {
        status: 400,
        body: { error: 'Gambar nota wajib dilampirkan.' },
      };
    }

    const safeMime =
      typeof mimeType === 'string' && mimeType.startsWith('image/')
        ? mimeType
        : 'image/jpeg';

    const cleanBase64 = imageBase64.includes(',')
      ? imageBase64.split(',')[1]
      : imageBase64;

    const fallbackDate =
      typeof defaultDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(defaultDate)
        ? defaultDate
        : new Date().toISOString().slice(0, 10);

    const ai = getAiClient();

    const prompt = `Baca foto nota belanja/kuitansi proyek konstruksi Indonesia ini (cetak maupun tulis tangan) lalu ekstrak ke JSON:
- tanggal: format YYYY-MM-DD (jika tidak terbaca pakai "${fallbackDate}").
- nama_toko: nama toko/SPBU/penerima (default "Toko / Penjual Umum").
- kategori: pilih satu yang paling tepat: MATERIAL & ALAT BANTU, BBM, OPERASIONAL & LISTRIK, KOORDINASI / LINGKUNGAN, ALAT, POTONGAN SUBKON, atau LAIN-LAIN.
- items: daftar { deskripsi, qty, nominal (rupiah bulat; konversi singkatan ribuan misal "85.5" atau "85rb" menjadi 85500) }.
- total_nominal: total akhir nota (rupiah bulat).`;

    const requestConfig = {
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: safeMime,
              data: cleanBase64,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tanggal: {
              type: Type.STRING,
              description: 'Tanggal nota dalam format YYYY-MM-DD',
            },
            nama_toko: {
              type: Type.STRING,
              description: 'Nama toko, penjual, atau pihak penerima',
            },
            kategori: {
              type: Type.STRING,
              enum: [...VALID_CATEGORIES],
              description: 'Kategori pengeluaran proyek konstruksi',
            },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  deskripsi: { type: Type.STRING },
                  qty: { type: Type.STRING },
                  nominal: { type: Type.NUMBER },
                },
                required: ['deskripsi', 'qty', 'nominal'],
              },
            },
            total_nominal: {
              type: Type.NUMBER,
              description: 'Total akhir dalam Rupiah (angka bulat)',
            },
          },
          required: ['tanggal', 'nama_toko', 'kategori', 'items', 'total_nominal'],
        },
      },
    };

    const candidateModels = ['gemini-3.1-flash-lite', 'gemini-4-hydrogen'] as const;
    const reqStartedAt = Date.now();
    const maxTotalBudgetMs = options?.maxTotalBudgetMs ?? 55000;
    const maxAttemptMs = options?.attemptTimeoutMs ?? 25000;
    let response: Awaited<ReturnType<typeof ai.models.generateContent>> | null = null;
    let lastError: unknown = null;

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const withTimeout = <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
      new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Timeout (${Math.round(ms / 1000)} dtk) saat menghubungi ${label}`));
        }, ms);
        promise.then(
          (val) => {
            clearTimeout(timer);
            resolve(val);
          },
          (err) => {
            clearTimeout(timer);
            reject(err);
          }
        );
      });

    const isTransientError = (msg: string) =>
      /503|UNAVAILABLE|high demand|overloaded|429|RESOURCE_EXHAUSTED|Timeout|ETIMEDOUT|ECONNRESET/i.test(
        msg
      );

    const maxRounds = 2;
    outer: for (let round = 0; round < maxRounds; round++) {
      if (round > 0) {
        if (Date.now() - reqStartedAt > 15000) break;
        await sleep(1500);
      }

      for (const modelName of candidateModels) {
        const remaining = maxTotalBudgetMs - (Date.now() - reqStartedAt);
        if (remaining < 8000) break outer;

        const attemptTimeoutMs = Math.min(maxAttemptMs, remaining);
        const startedAt = Date.now();
        try {
          response = await withTimeout(
            ai.models.generateContent({
              model: modelName,
              contents: requestConfig.contents,
              config: {
                ...requestConfig.config,
                thinkingConfig: {
                  thinkingLevel:
                    modelName === 'gemini-3.1-flash-lite'
                      ? ThinkingLevel.MINIMAL
                      : ThinkingLevel.LOW,
                },
              },
            }),
            attemptTimeoutMs,
            modelName
          );
          console.log(
            `[scan-nota] OK via ${modelName} (round ${round + 1}) in ${Date.now() - startedAt}ms`
          );
          lastError = null;
          break outer;
        } catch (err) {
          lastError = err;
          const errMsg = err instanceof Error ? err.message : String(err);
          console.warn(
            `[scan-nota] ${modelName} round ${round + 1} failed (${Date.now() - startedAt}ms): ${errMsg.slice(0, 140)}`
          );
          if (!isTransientError(errMsg)) {
            throw err;
          }
          if (Date.now() - startedAt < 8000) {
            await sleep(600);
          }
        }
      }
    }

    if (!response) {
      throw lastError ?? new Error('503 UNAVAILABLE: Layanan Gemini AI sedang sibuk.');
    }

    const rawText = (response.text ?? '').trim();
    if (!rawText) {
      return {
        status: 502,
        body: {
          error:
            'AI tidak mengembalikan hasil pembacaan nota. Coba foto ulang dengan pencahayaan lebih jelas.',
        },
      };
    }

    const parsed = JSON.parse(rawText);
    const normalizedItems = Array.isArray(parsed.items)
      ? parsed.items.map((it: { deskripsi?: string; qty?: string; nominal?: number }) => ({
          deskripsi: String(it?.deskripsi || 'Item Belanja').trim(),
          qty: String(it?.qty || '1 ls').trim(),
          nominal: Math.max(0, Math.round(Number(it?.nominal) || 0)),
        }))
      : [];

    const sumItems = normalizedItems.reduce(
      (acc: number, it: { nominal: number }) => acc + it.nominal,
      0
    );
    const totalNominal = Math.max(0, Math.round(Number(parsed.total_nominal) || sumItems));
    const kategori = VALID_CATEGORIES.includes(parsed.kategori)
      ? parsed.kategori
      : 'MATERIAL & ALAT BANTU';
    const tanggal =
      typeof parsed.tanggal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.tanggal)
        ? parsed.tanggal
        : fallbackDate;

    return {
      status: 200,
      body: {
        tanggal,
        nama_toko: String(parsed.nama_toko || 'Toko / Penjual Umum').trim(),
        kategori,
        items:
          normalizedItems.length > 0
            ? normalizedItems
            : [{ deskripsi: 'Belanja Proyek', qty: '1 ls', nominal: totalNominal }],
        total_nominal: totalNominal,
      },
    };
  } catch (err: unknown) {
    let rawMessage =
      err instanceof Error ? err.message : 'Gagal memproses gambar nota melalui Gemini AI.';
    try {
      const parsedErr = JSON.parse(rawMessage);
      if (parsedErr?.error?.message) {
        rawMessage = parsedErr.error.message;
      }
    } catch {
      // rawMessage is already plain text
    }

    if (/503|UNAVAILABLE|high demand|overloaded/i.test(rawMessage)) {
      console.warn(`[scan-nota] Upstream overloaded (503): ${rawMessage.slice(0, 140)}`);
      return {
        status: 503,
        body: {
          error:
            "Server Gemini AI sedang mengalami lonjakan trafik sementara. Tekan 'Coba Scan Ulang' dalam beberapa detik, atau lengkapi rincian nota secara manual di bawah.",
        },
      };
    }

    if (/429|RESOURCE_EXHAUSTED|quota/i.test(rawMessage)) {
      console.warn(`[scan-nota] Upstream rate limit (429): ${rawMessage.slice(0, 140)}`);
      return {
        status: 429,
        body: {
          error:
            "Batas permintaan Gemini AI sementara tercapai. Tunggu beberapa detik lalu tekan 'Coba Scan Ulang', atau isi rincian nota secara manual.",
        },
      };
    }

    if (/Timeout|ETIMEDOUT/i.test(rawMessage)) {
      console.warn(`[scan-nota] Upstream timeout (504): ${rawMessage.slice(0, 140)}`);
      return {
        status: 504,
        body: {
          error:
            "Waktu koneksi ke Gemini AI habis. Pastikan koneksi stabil lalu tekan 'Coba Scan Ulang', atau lengkapi rincian nota secara manual.",
        },
      };
    }

    if (/GEMINI_API_KEY|API_KEY|401|403|PERMISSION_DENIED/i.test(rawMessage)) {
      console.error(`[scan-nota] Auth/API key error: ${rawMessage.slice(0, 160)}`);
      return {
        status: 502,
        body: {
          error:
            'GEMINI_API_KEY belum aktif atau belum diatur di Environment Variables server.',
        },
      };
    }

    console.error('[scan-nota] Unexpected error:', err);
    return {
      status: 500,
      body: { error: rawMessage },
    };
  }
}
