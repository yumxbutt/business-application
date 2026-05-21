const { validationResult } = require('express-validator');
const inventoryService = require('../services/inventory.service');

const mapError = (err, res) => {
  const msg = err.message || 'Unexpected error';
  if (msg.includes('not found')) return res.status(404).json({ error: msg });
  if (msg.includes('below zero') || msg.includes('Invalid')) return res.status(400).json({ error: msg });
  return res.status(400).json({ error: msg });
};

const resolveValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ errors: errors.array() });
    return true;
  }
  return false;
};

/**
 * GET /api/inventory/stock
 * Query params: branchId, productId?, mode=all|unit, unitId? (for mode=unit)
 */
const getStock = async (req, res) => {
  if (resolveValidation(req, res)) return;

  const { branchId, productId, mode = 'all', unitId } = req.query;

  try {
    if (productId) {
      // Single product
      if (mode === 'unit' && unitId) {
        const result = await inventoryService.getStockInUnit(
          Number(branchId),
          Number(productId),
          Number(unitId)
        );
        return res.json(result);
      }
      const result = await inventoryService.getStockBreakdown(
        Number(branchId),
        Number(productId)
      );
      return res.json(result);
    }

    // All products in branch
    const results = await inventoryService.listBranchStock(Number(branchId), {
      mode,
      unitId: unitId ? Number(unitId) : undefined,
    });
    return res.json({ stock: results });
  } catch (err) {
    return mapError(err, res);
  }
};

/**
 * POST /api/inventory/adjustments
 * Body: { branchId, productId, deltaQty, reason? }
 * deltaQty is in BASE units. Negative = reduction.
 */
const adjustStock = async (req, res) => {
  if (resolveValidation(req, res)) return;

  const { branchId, productId, deltaQty, reason } = req.body;
  const actorId = req.user?.id;

  try {
    const result = await inventoryService.adjustStock(
      Number(branchId),
      Number(productId),
      Number(deltaQty),
      { reason, actorId }
    );
    return res.json(result);
  } catch (err) {
    return mapError(err, res);
  }
};

/**
 * POST /api/inventory/set
 * Body: { branchId, productId, quantity }
 * Sets absolute stock quantity (physical count / opening balance).
 */
const setStock = async (req, res) => {
  if (resolveValidation(req, res)) return;

  const { branchId, productId, quantity } = req.body;

  try {
    const result = await inventoryService.setStock(
      Number(branchId),
      Number(productId),
      Number(quantity)
    );
    return res.json(result);
  } catch (err) {
    return mapError(err, res);
  }
};

/**
 * GET /api/inventory/fifo-report
 * Query params: branchId, productId?, fromDate?, toDate?, onlyOpen?
 */
const getFifoReport = async (req, res) => {
  if (resolveValidation(req, res)) return;

  const { branchId, productId, fromDate, toDate, onlyOpen } = req.query;

  try {
    const result = await inventoryService.listFifoBatches(Number(branchId), {
      productId: productId ? Number(productId) : undefined,
      fromDate,
      toDate,
      onlyOpen: String(onlyOpen || '').toLowerCase() === 'true' || String(onlyOpen) === '1',
    });
    return res.json(result);
  } catch (err) {
    return mapError(err, res);
  }
};

/**
 * GET /api/inventory/product-history
 * Query params: branchId, productId?, startDate?, endDate?
 */
const getProductHistory = async (req, res) => {
  if (resolveValidation(req, res)) return;

  const { branchId, productId, startDate, endDate } = req.query;

  try {
    const result = await inventoryService.listProductHistory(Number(branchId), {
      productId: productId ? Number(productId) : undefined,
      startDate,
      endDate,
    });
    return res.json(result);
  } catch (err) {
    return mapError(err, res);
  }
};

module.exports = { getStock, adjustStock, setStock, getFifoReport, getProductHistory };
