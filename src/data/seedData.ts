import type { AppState, AttendanceMatrix, ProjectData } from '../types';

export const SEED_ATTENDANCE_DATES = [
  '2026-11-08', // Minggu
  '2026-11-09', // Senin
  '2026-11-10', // Selasa
  '2026-11-11', // Rabu
  '2026-11-12', // Kamis
  '2026-11-13', // Jumat
  '2026-11-14', // Sabtu
];

function buildInitialAttendance(): AttendanceMatrix {
  const workerIds = [
    'w-ripin',
    'w-bosker',
    'w-komet',
    'w-yuan',
    'w-ppur',
    'w-tamso',
    'w-marvel',
    'w-rios',
  ];
  const sundayWorkers = new Set(['w-komet', 'w-tamso']);
  const matrix: AttendanceMatrix = {};

  for (const wid of workerIds) {
    matrix[wid] = {};
    SEED_ATTENDANCE_DATES.forEach((date, idx) => {
      if (idx === 0) {
        // Minggu (8 Nov): KOMET & TAMSO masuk 1
        matrix[wid][date] = {
          normal: sundayWorkers.has(wid) ? 1 : 0,
          lembur: 0,
          catatan: sundayWorkers.has(wid) ? 'Lembur ngejar cor' : '',
        };
      } else if (idx >= 1 && idx <= 5) {
        // Senin - Jumat: hadir 1 + lembur 0.5
        matrix[wid][date] = {
          normal: 1,
          lembur: 0.5,
        };
      } else {
        // Sabtu (14 Nov): hadir 1, lembur 0
        matrix[wid][date] = {
          normal: 1,
          lembur: 0,
        };
      }
    });
  }
  return matrix;
}

export function createSeedState(): AppState {
  const omahWangi: ProjectData = {
    id: 'proj-omah-wangi',
    nama: 'Omah Wangi Kalioso',
    lokasi: 'Kalioso, Karanganyar',
    pelaksana: 'Daud C.L',
    mandor: 'Pak Surya',
    workers: [
      { id: 'w-ripin', nama: 'RIPIN', jabatan: 'TUKANG', upahHarian: 120000, mandor: 'Pak Surya', aktif: true },
      { id: 'w-bosker', nama: 'BOSKER', jabatan: 'TUKANG', upahHarian: 110000, mandor: 'Pak Surya', aktif: true },
      { id: 'w-komet', nama: 'KOMET', jabatan: 'TUKANG', upahHarian: 120000, mandor: 'Pak Surya', aktif: true },
      { id: 'w-yuan', nama: 'YUAN', jabatan: 'TUKANG', upahHarian: 120000, mandor: 'Pak Surya', aktif: true },
      { id: 'w-ppur', nama: 'P. PUR', jabatan: 'TENAGA', upahHarian: 90000, mandor: 'Pak Surya', aktif: true },
      { id: 'w-tamso', nama: 'TAMSO', jabatan: 'TENAGA', upahHarian: 110000, mandor: 'Pak Surya', aktif: true },
      { id: 'w-marvel', nama: 'MARVEL', jabatan: 'TENAGA', upahHarian: 90000, mandor: 'Pak Surya', aktif: true },
      { id: 'w-rios', nama: 'RIOS', jabatan: 'TUKANG', upahHarian: 120000, mandor: 'Pak Surya', aktif: true },
    ],
    periods: [
      {
        id: 'per-ow-48',
        mingguKe: 48,
        labelPeriodeAbsensi: '8 - 14 November 2026',
        labelPeriodeKbs: 's/d 16 November 2026',
        attendanceDates: [...SEED_ATTENDANCE_DATES],
        sisaSaldoLalu: -679000,
        tanggalSaldoLalu: '2026-11-12',
        dropingList: [
          {
            id: 'drop-1',
            tanggal: '2026-11-12',
            keterangan: 'DROPING Kas Proyek Minggu ke-48',
            nominal: 4179000,
          },
        ],
        transactions: [
          {
            id: 'tx-1',
            tanggal: '2026-10-29',
            namaToko: 'TB Sumber Makmur',
            kategori: 'MATERIAL & ALAT BANTU',
            sumberDana: 'KBS',
            items: [{ id: 'it-1', deskripsi: 'Solasi kertas', qty: '1 ls', nominal: 91000 }],
            totalNominal: 91000,
            createdAt: '2026-10-29T09:15:00Z',
          },
          {
            id: 'tx-2',
            tanggal: '2026-10-31',
            namaToko: 'TB Sumber Makmur',
            kategori: 'ALAT',
            sumberDana: 'KBS',
            items: [{ id: 'it-2', deskripsi: 'Pel karet', qty: '1 pcs', nominal: 25000 }],
            totalNominal: 25000,
            createdAt: '2026-10-31T14:20:00Z',
          },
          {
            id: 'tx-3',
            tanggal: '2026-11-12',
            namaToko: 'SPBU Kalioso',
            kategori: 'BBM',
            sumberDana: 'KBS',
            items: [
              { id: 'it-3', deskripsi: 'Dexlite', qty: '1 ls', nominal: 200000 },
              { id: 'it-4', deskripsi: 'Pertamax', qty: '1 ls', nominal: 120000 },
            ],
            totalNominal: 320000,
            createdAt: '2026-11-12T08:10:00Z',
          },
          {
            id: 'tx-4',
            tanggal: '2026-11-12',
            namaToko: 'TB Jaya Abadi',
            kategori: 'MATERIAL & ALAT BANTU',
            sumberDana: 'KBS',
            items: [{ id: 'it-5', deskripsi: 'Benang 1 pack & spidol', qty: '1 pack', nominal: 73500 }],
            totalNominal: 73500,
            createdAt: '2026-11-12T10:45:00Z',
          },
          {
            id: 'tx-5',
            tanggal: '2026-11-13',
            namaToko: 'TB Mitra Bangunan Kalioso',
            kategori: 'MATERIAL & ALAT BANTU',
            sumberDana: 'KBS',
            fotoNota: `data:image/svg+xml;utf8,${encodeURIComponent(
              `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="520" viewBox="0 0 420 520"><rect width="420" height="520" fill="#fffdf7" stroke="#cbd5e1" stroke-width="2"/><text x="210" y="42" font-family="monospace" font-size="18" font-weight="bold" text-anchor="middle" fill="#0f172a">TB MITRA BANGUNAN KALIOSO</text><text x="210" y="64" font-family="monospace" font-size="12" text-anchor="middle" fill="#475569">Jl. Raya Solo-Purwodadi Km 14, Kalioso</text><line x1="24" y1="82" x2="396" y2="82" stroke="#334155" stroke-dasharray="4 3"/><text x="28" y="106" font-family="monospace" font-size="12" fill="#0f172a">Tgl: 13/11/2026   No: MB-4813</text><text x="28" y="126" font-family="monospace" font-size="12" fill="#0f172a">Kepada: Proyek Omah Wangi Kalioso</text><line x1="24" y1="142" x2="396" y2="142" stroke="#334155"/><text x="28" y="170" font-family="monospace" font-size="13" fill="#0f172a">1. Knee 3/4" 19 pcs</text><text x="392" y="170" font-family="monospace" font-size="13" text-anchor="end" fill="#0f172a">85.500</text><text x="28" y="202" font-family="monospace" font-size="13" fill="#0f172a">2. Roofing 3cm 1 box</text><text x="392" y="202" font-family="monospace" font-size="13" text-anchor="end" fill="#0f172a">97.500</text><text x="28" y="234" font-family="monospace" font-size="13" fill="#0f172a">3. Baut DB 8x40 30 pcs</text><text x="392" y="234" font-family="monospace" font-size="13" text-anchor="end" fill="#0f172a">27.000</text><text x="28" y="266" font-family="monospace" font-size="13" fill="#0f172a">4. Baut DB 10x50 50 pcs</text><text x="392" y="266" font-family="monospace" font-size="13" text-anchor="end" fill="#0f172a">80.000</text><text x="28" y="298" font-family="monospace" font-size="13" fill="#0f172a">5. FAB 8x1 1/4 100 pcs</text><text x="392" y="298" font-family="monospace" font-size="13" text-anchor="end" fill="#0f172a">16.500</text><text x="28" y="330" font-family="monospace" font-size="13" fill="#0f172a">6. Fisher S6 1 duz</text><text x="392" y="330" font-family="monospace" font-size="13" text-anchor="end" fill="#0f172a">10.000</text><line x1="24" y1="358" x2="396" y2="358" stroke="#334155"/><text x="28" y="390" font-family="monospace" font-size="15" font-weight="bold" fill="#0f172a">TOTAL LUNAS</text><text x="392" y="390" font-family="monospace" font-size="16" font-weight="bold" text-anchor="end" fill="#0f172a">Rp 316.500</text><rect x="255" y="425" width="120" height="44" rx="6" fill="none" stroke="#dc2626" stroke-width="2.5" transform="rotate(-7 315 447)"/><text x="315" y="453" font-family="monospace" font-size="18" font-weight="bold" text-anchor="middle" fill="#dc2626" transform="rotate(-7 315 447)">LUNAS</text></svg>`
            )}`,
            items: [
              { id: 'it-6', deskripsi: 'Knee 3/4" 19pcs', qty: '19 pcs', nominal: 85500 },
              { id: 'it-7', deskripsi: 'Roofing 3cm', qty: '1 box', nominal: 97500 },
              { id: 'it-8', deskripsi: 'Baut DB 8x40 30pcs', qty: '30 pcs', nominal: 27000 },
              { id: 'it-9', deskripsi: 'Baut DB 10x50 50pcs', qty: '50 pcs', nominal: 80000 },
              { id: 'it-10', deskripsi: 'FAB 8x1¼ 100pcs', qty: '100 pcs', nominal: 16500 },
              { id: 'it-11', deskripsi: 'Fisher S6 1 duz', qty: '1 duz', nominal: 10000 },
            ],
            totalNominal: 316500,
            createdAt: '2026-11-13T09:30:00Z',
          },
          {
            id: 'tx-6',
            tanggal: '2026-11-13',
            namaToko: 'Bengkel Teknik Mandiri',
            kategori: 'ALAT',
            sumberDana: 'KBS',
            items: [{ id: 'it-12', deskripsi: 'Busi & kunci busi', qty: '1 set', nominal: 40000 }],
            totalNominal: 40000,
            createdAt: '2026-11-13T13:15:00Z',
          },
          {
            id: 'tx-7',
            tanggal: '2026-11-14',
            namaToko: 'PLN Prepaid',
            kategori: 'OPERASIONAL & LISTRIK',
            sumberDana: 'KBS',
            items: [{ id: 'it-13', deskripsi: 'Token Listrik Proyek', qty: '1 trx', nominal: 203000 }],
            totalNominal: 203000,
            createdAt: '2026-11-14T11:00:00Z',
          },
          {
            id: 'tx-8',
            tanggal: '2026-11-16',
            namaToko: 'Koordinasi Lingkungan',
            kategori: 'KOORDINASI / LINGKUNGAN',
            sumberDana: 'KBS',
            items: [
              { id: 'it-14', deskripsi: 'BABINSA periode November', qty: '1 bln', nominal: 500000 },
              { id: 'it-15', deskripsi: 'BABINKAMTIBMAS periode November', qty: '1 bln', nominal: 500000 },
              { id: 'it-16', deskripsi: 'KAS WARGA BLENCAN periode November', qty: '1 bln', nominal: 500000 },
            ],
            totalNominal: 1500000,
            createdAt: '2026-11-16T10:00:00Z',
          },
          {
            id: 'tx-rembes-1',
            tanggal: '2026-11-15',
            namaToko: 'Fotokopi & ATK Kalioso',
            kategori: 'OPERASIONAL & LISTRIK',
            sumberDana: 'REMBES',
            namaPengaju: 'Daud C.L',
            rembesStatus: 'Menunggu',
            items: [
              { id: 'it-r1', deskripsi: 'Beli Materai & Fotokopi RAB', qty: '1 paket', nominal: 65000 },
            ],
            totalNominal: 65000,
            catatan: 'Untuk kelengkapan berkas opname mingguan',
            createdAt: '2026-11-15T15:40:00Z',
          },
        ],
        cashflowItems: [
          { id: 'cf-a1', group: 'A', deskripsi: 'Kas Proyek', nominal: 2000000, keterangan: 'Kas operasional mingguan' },
          { id: 'cf-b1', group: 'B', deskripsi: 'Besi & Kawat Bendrat Susulan', nominal: 650000, keterangan: 'TB Mitra Bangunan' },
          { id: 'cf-b2', group: 'B', deskripsi: 'Paku, Amplas & Kuas Cat', nominal: 185000 },
          { id: 'cf-c1', group: 'C', deskripsi: 'BBM Dexlite & Pertamax Operasional', nominal: 350000 },
          { id: 'cf-d1', group: 'D', deskripsi: 'ATK, Cetak Gambar & Air Minum Proyek', nominal: 125000 },
          { id: 'cf-e1', group: 'E', deskripsi: 'Mata Gerinda Potong & Mata Bor Beton', nominal: 240000 },
        ],
        saldoLaluOverride: null,
        attendance: buildInitialAttendance(),
        kasbonByWorker: {},
        keteranganByWorker: {
          'w-komet': 'Masuk Minggu (Cor)',
          'w-tamso': 'Masuk Minggu (Cor)',
        },
      },
      {
        id: 'per-ow-49',
        mingguKe: 49,
        labelPeriodeAbsensi: '15 - 21 November 2026',
        labelPeriodeKbs: 's/d 23 November 2026',
        attendanceDates: [
          '2026-11-15',
          '2026-11-16',
          '2026-11-17',
          '2026-11-18',
          '2026-11-19',
          '2026-11-20',
          '2026-11-21',
        ],
        sisaSaldoLalu: 931000,
        tanggalSaldoLalu: '2026-11-17',
        dropingList: [
          {
            id: 'drop-49-1',
            tanggal: '2026-11-18',
            keterangan: 'DROPING Kas Proyek Minggu ke-49',
            nominal: 2000000,
          },
        ],
        transactions: [
          {
            id: 'tx-49-1',
            tanggal: '2026-11-18',
            namaToko: 'TB Mitra Bangunan Kalioso',
            kategori: 'MATERIAL & ALAT BANTU',
            sumberDana: 'KBS',
            items: [{ id: 'it-49-1', deskripsi: 'Semen Gresik 40kg (10 sak)', qty: '10 sak', nominal: 580000 }],
            totalNominal: 580000,
            createdAt: '2026-11-18T08:45:00Z',
          },
        ],
        cashflowItems: [
          { id: 'cf-49-a1', group: 'A', deskripsi: 'Kas Proyek', nominal: 2000000 },
        ],
        saldoLaluOverride: null,
        attendance: {},
        kasbonByWorker: {},
        keteranganByWorker: {},
      },
    ],
  };

  const clusterMerapi: ProjectData = {
    id: 'proj-merapi',
    nama: 'Cluster Merapi Residence',
    lokasi: 'Colomadu, Karanganyar',
    pelaksana: 'Rendra Saputra',
    mandor: 'Pak Wagino',
    workers: [
      { id: 'w-m1', nama: 'SUYATNO', jabatan: 'MANDOR', upahHarian: 140000, mandor: 'Pak Wagino', aktif: true },
      { id: 'w-m2', nama: 'DARMO', jabatan: 'TUKANG', upahHarian: 120000, mandor: 'Pak Wagino', aktif: true },
      { id: 'w-m3', nama: 'BAGAS', jabatan: 'TENAGA', upahHarian: 95000, mandor: 'Pak Wagino', aktif: true },
    ],
    periods: [
      {
        id: 'per-mr-12',
        mingguKe: 12,
        labelPeriodeAbsensi: '8 - 14 November 2026',
        labelPeriodeKbs: 's/d 16 November 2026',
        attendanceDates: [...SEED_ATTENDANCE_DATES],
        sisaSaldoLalu: 425000,
        tanggalSaldoLalu: '2026-11-09',
        dropingList: [
          { id: 'drop-m1', tanggal: '2026-11-10', keterangan: 'DROPING Mingguan', nominal: 2500000 },
        ],
        transactions: [
          {
            id: 'tx-m1',
            tanggal: '2026-11-11',
            namaToko: 'TB Colomadu Jaya',
            kategori: 'MATERIAL & ALAT BANTU',
            sumberDana: 'KBS',
            items: [{ id: 'it-m1', deskripsi: 'Pipa PVC 4" Rucika 6 btg', qty: '6 btg', nominal: 720000 }],
            totalNominal: 720000,
            createdAt: '2026-11-11T09:00:00Z',
          },
        ],
        cashflowItems: [
          { id: 'cf-ma1', group: 'A', deskripsi: 'Kas Proyek', nominal: 2000000 },
        ],
        saldoLaluOverride: null,
        attendance: {
          'w-m1': { '2026-11-09': { normal: 1, lembur: 0 }, '2026-11-10': { normal: 1, lembur: 0 }, '2026-11-11': { normal: 1, lembur: 0 }, '2026-11-12': { normal: 1, lembur: 0 }, '2026-11-13': { normal: 1, lembur: 0 }, '2026-11-14': { normal: 1, lembur: 0 } },
          'w-m2': { '2026-11-09': { normal: 1, lembur: 0.5 }, '2026-11-10': { normal: 1, lembur: 0.5 }, '2026-11-11': { normal: 1, lembur: 0 }, '2026-11-12': { normal: 1, lembur: 0.5 }, '2026-11-13': { normal: 1, lembur: 0 }, '2026-11-14': { normal: 1, lembur: 0 } },
          'w-m3': { '2026-11-09': { normal: 1, lembur: 0 }, '2026-11-10': { normal: 1, lembur: 0 }, '2026-11-11': { normal: 1, lembur: 0 }, '2026-11-12': { normal: 1, lembur: 0 }, '2026-11-13': { normal: 1, lembur: 0 }, '2026-11-14': { normal: 1, lembur: 0 } },
        },
        kasbonByWorker: {},
        keteranganByWorker: {},
      },
    ],
  };

  return {
    version: 1,
    roleMode: 'mandor',
    activeProjectId: omahWangi.id,
    activePeriodId: omahWangi.periods[0].id,
    projects: [omahWangi, clusterMerapi],
    printConfig: {
      kota: 'Kalioso, Karanganyar',
      tanggalCetak: '2026-11-16',
      mengetahuiNama: 'Owner / Direktur',
      mengetahuiJabatan: 'Mengetahui',
      disetujuiNama: 'Bagian Keuangan',
      disetujuiJabatan: 'Disetujui',
      dibuatNama: 'Daud C.L',
      dibuatJabatan: 'Pelaksana Proyek',
      sertakanFotoNota: true,
    },
  };
}
