import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCashflowSummary,
  calculateKbsSummary,
  calculateRembesSummary,
  calculateWorkerPayroll,
  formatRupiah,
} from './calculations';
import { createSeedState } from '../data/seedData';

test('formatRupiah formats positive, zero, and negative values in Indonesian format', () => {
  assert.equal(formatRupiah(0), 'Rp 0');
  assert.equal(formatRupiah(4179000), 'Rp 4.179.000');
  assert.equal(formatRupiah(-679000), '-Rp 679.000');
});

test('calculateKbsSummary computes exact Omah Wangi Minggu-48 totals including negative opening balance', () => {
  const seed = createSeedState();
  const period = seed.projects[0].periods[0];
  const kbs = calculateKbsSummary(period);

  assert.equal(kbs.sisaSaldoLalu, -679000);
  assert.equal(kbs.totalDroping, 4179000);
  assert.equal(kbs.totalPemasukan, 3500000);

  // Check date groups and subtotals:
  // 2026-10-29: 91000
  // 2026-10-31: 25000
  // 2026-11-12: 200000 + 120000 + 73500 = 393500
  // 2026-11-13: 85500 + 97500 + 27000 + 80000 + 16500 + 10000 + 40000 = 356500
  // 2026-11-14: 203000
  // 2026-11-16: 500000 + 500000 + 500000 = 1500000
  assert.equal(kbs.groupedExpenses.length, 6);
  assert.equal(kbs.groupedExpenses[0].subTotal, 91000);
  assert.equal(kbs.groupedExpenses[1].subTotal, 25000);
  assert.equal(kbs.groupedExpenses[2].subTotal, 393500);
  assert.equal(kbs.groupedExpenses[3].subTotal, 356500);
  assert.equal(kbs.groupedExpenses[4].subTotal, 203000);
  assert.equal(kbs.groupedExpenses[5].subTotal, 1500000);

  assert.equal(kbs.totalPengeluaran, 2569000);
  assert.equal(kbs.sisaSaldoAkhir, 931000);
});

test('calculateRembesSummary isolates Rembes transactions and tracks unpaid totals', () => {
  const seed = createSeedState();
  const period = seed.projects[0].periods[0];
  const rembes = calculateRembesSummary(period);

  assert.equal(rembes.transactions.length, 1);
  assert.equal(rembes.pendingCount, 1);
  assert.equal(rembes.unpaidTotal, 65000);
  assert.equal(rembes.paidTotal, 0);
});

test('calculateWorkerPayroll computes exact attendance days, wages, and kasbon deductions', () => {
  const seed = createSeedState();
  const project = seed.projects[0];
  const period = project.periods[0];

  const payroll = calculateWorkerPayroll(
    project.workers,
    period.attendanceDates,
    period.attendance,
    period.kasbonByWorker,
    period.keteranganByWorker
  );

  assert.equal(payroll.rows.length, 8);
  // 6 workers * 8.5 days + 2 workers (KOMET, TAMSO) * 9.5 days = 70 days
  assert.equal(payroll.grandTotalHari, 70);
  assert.equal(payroll.grandTotalBayar, 7710000);

  // Test with kasbon deduction
  const payrollWithKasbon = calculateWorkerPayroll(
    project.workers,
    period.attendanceDates,
    period.attendance,
    { 'w-ripin': 100000 },
    period.keteranganByWorker
  );
  const ripinRow = payrollWithKasbon.rows.find((r) => r.worker.id === 'w-ripin');
  assert.equal(ripinRow?.totalKotor, 1020000);
  assert.equal(ripinRow?.totalBayar, 920000);
  assert.equal(payrollWithKasbon.grandTotalBayar, 7610000);
});

test('calculateCashflowSummary pulls KBS ending balance automatically and respects manual override', () => {
  const seed = createSeedState();
  const period = seed.projects[0].periods[0];
  const kbs = calculateKbsSummary(period);

  const cfAuto = calculateCashflowSummary(period, kbs.sisaSaldoAkhir);
  assert.equal(cfAuto.subTotalPengajuan, 3550000);
  assert.equal(cfAuto.saldoMingguLaluEffective, 931000);
  assert.equal(cfAuto.isOverridden, false);
  assert.equal(cfAuto.totalCashflowDiajukan, 3550000 - 931000);

  const cfOverride = calculateCashflowSummary(
    { ...period, saldoLaluOverride: -250000 },
    kbs.sisaSaldoAkhir
  );
  assert.equal(cfOverride.isOverridden, true);
  // 3.550.000 - (-250.000) = 3.800.000
  assert.equal(cfOverride.totalCashflowDiajukan, 3800000);
});
