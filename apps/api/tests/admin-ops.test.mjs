import test from 'node:test';
import assert from 'node:assert/strict';

function applyFxRateOverride(manualRate, spreadMargin = 0.015) {
  if (manualRate <= 0) throw new Error('Manual rate must be positive');
  const effectiveRate = Math.floor(manualRate * (1 - spreadMargin));
  return { manualRate, spreadMargin, effectiveRate };
}

function generateAuditCsv(transactions) {
  const headers = 'Reference,Type,Amount_USDC,Amount_NGN,Rate,Status,Date\n';
  const rows = transactions.map(t => `${t.ref},${t.type},${t.usdc},${t.ngn},${t.rate},${t.status},${t.date}`).join('\n');
  return headers + rows;
}

test('admin-ops: rate engine manual override & spread adjustment math', () => {
  const result = applyFxRateOverride(1550, 0.015);
  assert.equal(result.manualRate, 1550);
  assert.equal(result.effectiveRate, 1526);
});

test('admin-ops: SEC/CBN compliance reconciliation CSV export generator', () => {
  const mockTxs = [
    { ref: 'TX_101', type: 'SPEND', usdc: '50.00', ngn: '76300', rate: '1526', status: 'SUCCESS', date: '2026-09-20' },
    { ref: 'TX_102', type: 'SPEND', usdc: '100.00', ngn: '152600', rate: '1526', status: 'SUCCESS', date: '2026-09-20' }
  ];

  const csv = generateAuditCsv(mockTxs);
  assert.ok(csv.includes('Reference,Type,Amount_USDC'));
  assert.ok(csv.includes('TX_101,SPEND,50.00,76300,1526,SUCCESS'));
  assert.ok(csv.includes('TX_102,SPEND,100.00,152600,1526,SUCCESS'));
});
