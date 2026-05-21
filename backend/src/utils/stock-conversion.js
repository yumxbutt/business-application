/**
 * stock-conversion.js
 * Pure utility functions for multi-unit stock calculations.
 * All quantities are stored as base-unit amounts (conversionFactor = 1).
 */

/**
 * Sort units largest-factor first so greedy breakdown works correctly.
 * Expects units like: [{ unitId, unitName, unitCode, conversionFactor, isBaseUnit, ... }]
 */
function sortUnitsDescending(units) {
  return [...units].sort(
    (a, b) => parseFloat(b.conversionFactor) - parseFloat(a.conversionFactor)
  );
}

/**
 * Greedy breakdown of baseQty into the supplied multi-unit denominators.
 *
 * Example:
 *   baseQty = 1000 (pcs)
 *   units = [{ code:'CTN', factor:120 }, { code:'BOX', factor:12 }, { code:'PCS', factor:1 }]
 *   → [ { code:'CTN', qty: 8 }, { code:'BOX', qty: 3 }, { code:'PCS', qty: 4 } ]
 *   (8×120 + 3×12 + 4×1 = 960+36+4 = 1000 ✓)
 *
 * @param {number} baseQty  Total quantity in base units
 * @param {Array}  units    Array of { unitId, unitName, unitCode, conversionFactor }
 * @returns {Array} [{ unitId, unitName, unitCode, conversionFactor, qty }]
 */
function breakdownStock(baseQty, units) {
  const sorted = sortUnitsDescending(units);
  let remaining = parseFloat(baseQty) || 0;

  return sorted.map((unit) => {
    const factor = parseFloat(unit.conversionFactor) || 1;
    const qty = Math.floor(remaining / factor);
    remaining = parseFloat((remaining - qty * factor).toFixed(6));
    return {
      unitId: unit.unitId,
      unitName: unit.unitName,
      unitCode: unit.unitCode,
      conversionFactor: factor,
      isBaseUnit: !!unit.isBaseUnit,
      qty,
    };
  });
}

/**
 * Convert base quantity to a specific target unit.
 *
 * @param {number} baseQty         Quantity in base units
 * @param {number} factorToBase    How many base units make 1 of this unit
 * @returns {number}
 */
function convertToUnit(baseQty, factorToBase) {
  const factor = parseFloat(factorToBase) || 1;
  return parseFloat((parseFloat(baseQty) / factor).toFixed(4));
}

module.exports = { breakdownStock, convertToUnit, sortUnitsDescending };
