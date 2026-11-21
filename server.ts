import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveServerPort(): number {
  const portFlagIdx = process.argv.indexOf('--port');
  if (portFlagIdx !== -1 && process.argv[portFlagIdx + 1]) {
    const cliPort = Number(process.argv[portFlagIdx + 1]);
    if (Number.isFinite(cliPort) && cliPort > 0) return cliPort;
  }
  const envPort = Number(process.env.PORT);
  const nginxPort = Number(process.env.NGINX_PORT);
  const defaultAppPort = Number(process.env.DEFAULT_APP_PORT) || 3000;
  // In container environments where nginx listens on NGINX_PORT (e.g. 8080) and proxies
  // to DEFAULT_APP_PORT (3000), avoid binding Express to NGINX_PORT when PORT === NGINX_PORT.
  if (Number.isFinite(nginxPort) && nginxPort > 0 && envPort === nginxPort) {
    return defaultAppPort;
  }
  return (Number.isFinite(envPort) && envPort > 0 ? envPort : defaultAppPort);
}

const PORT = resolveServerPort();
const distPath = path.resolve(__dirname, 'dist');
const distIndexPath = path.join(distPath, 'index.html');
const isProd =
  process.env.NODE_ENV === 'production' ||
  (process.env.NODE_ENV !== 'development' && fs.existsSync(distIndexPath));

const VALID_CATEGORIES = [
  'MATERIAL & ALAT BANTU',
  'BBM',
  'OPERASIONAL & LISTRIK',
  'KOORDINASI / LINGKUNGAN',
  'ALAT',
  'POTONGAN SUBKON',
  'LAIN-LAIN',
] as const;

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY belum dikonfigurasi di server. Silakan periksa panel Settings > Secrets.'
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

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'proyekkas-absensi' });
  });

  app.post('/api/scan-nota', async (req, res) => {
    try {
      const { imageBase64, mimeType, defaultDate } = req.body as {
        imageBase64?: string;
        mimeType?: string;
        defaultDate?: string;
      };

      if (!imageBase64 || typeof imageBase64 !== 'string') {
        res.status(400).json({ error: 'Gambar nota wajib dilampirkan.' });
        return;
      }

      const safeMime =
        typeof mimeType === 'string' && mimeType.startsWith('image/')
          ? mimeType
          : 'image/jpeg';

      // Strip data URI prefix if sent
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

      // Prioritize gemini-3.1-flash-lite (ThinkingLevel.MINIMAL = lowest latency for receipt OCR),
      // falling back to gemini-4-hydrogen (ThinkingLevel.LOW) with bounded backoff retries on transient spikes.
      const candidateModels = ['gemini-3.1-flash-lite', 'gemini-4-hydrogen'] as const;
      const reqStartedAt = Date.now();
      const maxTotalBudgetMs = 55000;
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
          // Only run a second retry round if round 1 failed fast (e.g., transient 503/429 spike)
          if (Date.now() - reqStartedAt > 15000) break;
          await sleep(1500);
        }

        for (const modelName of candidateModels) {
          const remaining = maxTotalBudgetMs - (Date.now() - reqStartedAt);
          if (remaining < 10000) break outer;

          const attemptTimeoutMs = Math.min(25000, remaining);
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
            console.log(`[scan-nota] OK via ${modelName} (round ${round + 1}) in ${Date.now() - startedAt}ms`);
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
        res.status(502).json({
          error: 'AI tidak mengembalikan hasil pembacaan nota. Coba foto ulang dengan pencahayaan lebih jelas.',
        });
        return;
      }

      const parsed = JSON.parse(rawText);
      const normalizedItems = Array.isArray(parsed.items)
        ? parsed.items.map((it: { deskripsi?: string; qty?: string; nominal?: number }) => ({
            deskripsi: String(it?.deskripsi || 'Item Belanja').trim(),
            qty: String(it?.qty || '1 ls').trim(),
            nominal: Math.max(0, Math.round(Number(it?.nominal) || 0)),
          }))
        : [];

      const sumItems = normalizedItems.reduce((acc: number, it: { nominal: number }) => acc + it.nominal, 0);
      const totalNominal = Math.max(0, Math.round(Number(parsed.total_nominal) || sumItems));
      const kategori = VALID_CATEGORIES.includes(parsed.kategori)
        ? parsed.kategori
        : 'MATERIAL & ALAT BANTU';
      const tanggal =
        typeof parsed.tanggal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.tanggal)
          ? parsed.tanggal
          : fallbackDate;

      res.json({
        tanggal,
        nama_toko: String(parsed.nama_toko || 'Toko / Penjual Umum').trim(),
        kategori,
        items:
          normalizedItems.length > 0
            ? normalizedItems
            : [{ deskripsi: 'Belanja Proyek', qty: '1 ls', nominal: totalNominal }],
        total_nominal: totalNominal,
      });
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
        res.status(503).json({
          error:
            "Server Gemini AI sedang mengalami lonjakan trafik sementara. Tekan 'Coba Scan Ulang' dalam beberapa detik, atau lengkapi rincian nota secara manual di bawah.",
        });
        return;
      }

      if (/429|RESOURCE_EXHAUSTED|quota/i.test(rawMessage)) {
        console.warn(`[scan-nota] Upstream rate limit (429): ${rawMessage.slice(0, 140)}`);
        res.status(429).json({
          error:
            "Batas permintaan Gemini AI sementara tercapai. Tunggu beberapa detik lalu tekan 'Coba Scan Ulang', atau isi rincian nota secara manual.",
        });
        return;
      }

      if (/Timeout|ETIMEDOUT/i.test(rawMessage)) {
        console.warn(`[scan-nota] Upstream timeout (504): ${rawMessage.slice(0, 140)}`);
        res.status(504).json({
          error:
            "Waktu koneksi ke Gemini AI habis. Pastikan koneksi stabil lalu tekan 'Coba Scan Ulang', atau lengkapi rincian nota secara manual.",
        });
        return;
      }

      if (/API_KEY|401|403|PERMISSION_DENIED/i.test(rawMessage)) {
        console.error(`[scan-nota] Auth/API key error: ${rawMessage.slice(0, 160)}`);
        res.status(502).json({
          error:
            'GEMINI_API_KEY belum aktif atau tidak valid. Silakan periksa panel Settings > Secrets.',
        });
        return;
      }

      console.error('[scan-nota] Unexpected error:', err);
      res.status(500).json({ error: rawMessage });
    }
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Endpoint API tidak ditemukan.' });
  });

  if (isProd && fs.existsSync(distIndexPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(distIndexPath);
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ProyekKas & Absensi server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
