const { validationResult } = require('express-validator');
const salesService = require('../services/sales.service');

const mapError = (err, res) => {
  const msg = err.message || 'Unexpected error';

  if (msg.includes('not found')) return res.status(404).json({ error: msg });
  if (msg.includes('Not allowed')) return res.status(403).json({ error: msg });
  if (msg.includes('already exists')) return res.status(409).json({ error: msg });
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

const listSales = async (req, res) => {
  if (resolveValidation(req, res)) return;

  try {
    const { role, branchId: actorBranchId } = req.user;
    const branchId = role === 'main_admin'
      ? (req.query.branchId ? Number(req.query.branchId) : undefined)
      : Number(actorBranchId);

    const sales = await salesService.listSales({
      branchId,
      filters: {
        search: req.query.search,
        status: req.query.status,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      },
    });

    return res.json({ sales });
  } catch (err) {
    return mapError(err, res);
  }
};

const getSale = async (req, res) => {
  if (resolveValidation(req, res)) return;

  try {
    const sale = await salesService.getSale({
      saleId: Number(req.params.id),
      actor: req.user,
    });

    return res.json({ sale });
  } catch (err) {
    return mapError(err, res);
  }
};

const createSale = async (req, res) => {
  if (resolveValidation(req, res)) return;

  try {
    const sale = await salesService.createSale({
      payload: req.body,
      actor: req.user,
    });

    return res.status(201).json({ sale });
  } catch (err) {
    return mapError(err, res);
  }
};

const listSaleReturns = async (req, res) => {
  if (resolveValidation(req, res)) return;

  try {
    const { role, branchId: actorBranchId } = req.user;
    const branchId = role === 'main_admin'
      ? (req.query.branchId ? Number(req.query.branchId) : undefined)
      : Number(actorBranchId);

    const returns = await salesService.listSaleReturns({
      branchId,
      filters: {
        saleId: req.query.saleId,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      },
    });

    return res.json({ returns });
  } catch (err) {
    return mapError(err, res);
  }
};

const getSaleReturn = async (req, res) => {
  if (resolveValidation(req, res)) return;

  try {
    const saleReturn = await salesService.getSaleReturn({
      returnId: Number(req.params.id),
      actor: req.user,
    });

    return res.json({ saleReturn });
  } catch (err) {
    return mapError(err, res);
  }
};

const createSaleReturn = async (req, res) => {
  if (resolveValidation(req, res)) return;

  try {
    const saleReturn = await salesService.createSaleReturn({
      payload: req.body,
      actor: req.user,
    });

    return res.status(201).json({ saleReturn });
  } catch (err) {
    return mapError(err, res);
  }
};

const cancelSaleReturn = async (req, res) => {
  if (resolveValidation(req, res)) return;

  try {
    const result = await salesService.cancelSaleReturn({
      returnId: Number(req.params.id),
      actor: req.user,
    });

    return res.json(result);
  } catch (err) {
    return mapError(err, res);
  }
};

const updateSaleReturn = async (req, res) => {
  if (resolveValidation(req, res)) return;

  try {
    const saleReturn = await salesService.updateSaleReturn({
      returnId: Number(req.params.id),
      payload: req.body,
      actor: req.user,
    });

    return res.json({ saleReturn });
  } catch (err) {
    return mapError(err, res);
  }
};

const updateSale = async (req, res) => {
  if (resolveValidation(req, res)) return;

  try {
    const sale = await salesService.updateSale({
      saleId: Number(req.params.id),
      payload: req.body,
      actor: req.user,
    });

    return res.json({ sale });
  } catch (err) {
    return mapError(err, res);
  }
};

const cancelSale = async (req, res) => {
  if (resolveValidation(req, res)) return;

  try {
    const sale = await salesService.cancelSale({
      saleId: Number(req.params.id),
      actor: req.user,
    });

    return res.json({ sale });
  } catch (err) {
    return mapError(err, res);
  }
};

const repostSale = async (req, res) => {
  if (resolveValidation(req, res)) return;

  try {
    const sale = await salesService.repostSale({
      saleId: Number(req.params.id),
      actor: req.user,
    });

    return res.json({ sale });
  } catch (err) {
    return mapError(err, res);
  }
};

module.exports = {
  listSales,
  getSale,
  createSale,
  listSaleReturns,
  getSaleReturn,
  createSaleReturn,
  cancelSaleReturn,
  updateSaleReturn,
  updateSale,
  cancelSale,
  repostSale,
};