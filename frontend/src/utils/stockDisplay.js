/**
 * Shared utility for formatting stock breakdown and summary text.
 * Used by InventoryPage, SalesPage, and any other page that displays multi-unit stock.
 */

/**
 * Format a multi-unit breakdown array into a human-readable string.
 * e.g. [{ unitCode:'CTN', qty:8 }, { unitCode:'BOX', qty:3 }, { unitCode:'PCS', qty:4 }]
 * → "8 CTN  3 BOX  4 PCS"
 * Only includes units that have qty > 0 (unless all are zero — then shows "0 {baseUnit}").
 *
 * @param {Array<{unitCode: string, qty: number, isBaseUnit?: boolean}>} breakdown
 * @returns {string}
 */
export function formatBreakdown(breakdown) {
  if (!breakdown || breakdown.length === 0) return '–';
  const parts = breakdown.filter((b) => b.qty > 0);
  if (parts.length === 0) {
    const base = breakdown.find((b) => b.isBaseUnit) || breakdown[0];
    return `0 ${base.unitCode}`;
  }
  return parts.map((b) => `${b.qty} ${b.unitCode}`).join('  ');
}

const toNumber = (value) => Number(value) || 0;

/**
 * Summarize stock across multiple branch/unit option objects (as returned by the product
 * search endpoint in SalesPage and PurchasePage).
 *
 * @param {Array<{availableQty: number, breakdown: Array}>} stockOptions
 * @returns {{ totalAvailable: number, unitText: string }}
 */
export function getOverallStockSummary(stockOptions = []) {
  const totalAvailable = (stockOptions || []).reduce(
    (sum, opt) => sum + toNumber(opt.availableQty),
    0,
  );
  const unitTotals = new Map();

  (stockOptions || []).forEach((opt) => {
    (opt.breakdown || []).forEach((b) => {
      const qty = toNumber(b.qty);
      if (qty <= 0) return;
      const key = (b.unitCode || b.unitName || 'UNIT').toUpperCase();
      unitTotals.set(key, (unitTotals.get(key) || 0) + qty);
    });
  });

  const unitText = Array.from(unitTotals.entries())
    .map(([unit, qty]) => `${qty % 1 === 0 ? qty : qty.toFixed(3)} ${unit}`)
    .join(' + ');

  return { totalAvailable, unitText };
}
