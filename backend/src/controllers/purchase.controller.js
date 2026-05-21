const { validationResult } = require('express-validator');
const purchaseService = require('../services/purchase.service');

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

const listPurchases = async (req, res) => {
  if (resolveValidation(req, res)) return;

  try {
    const { role, branchId: actorBranchId } = req.user;
    const branchId = role === 'main_admin'
      ? (req.query.branchId ? Number(req.query.branchId) : undefined)
      : Number(actorBranchId);

    const purchases = await purchaseService.listPurchases({
      branchId,
      filters: {
        search: req.query.search,
        status: req.query.status,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      },
    });

    return res.json({ purchases });
  } catch (err) {
    return mapError(err, res);
  }
};

const getPurchase = async (req, res) => {
  try {
    const purchase = await purchaseService.getPurchase({
      purchaseId: Number(req.params.id),
      actor: req.user,
    });

    return res.json({ purchase });
  } catch (err) {
    return mapError(err, res);
  }
};

const createPurchase = async (req, res) => {
  if (resolveValidation(req, res)) return;

  try {
    const purchase = await purchaseService.createPurchase({
      payload: req.body,
      actor: req.user,
    });

    return res.status(201).json({ purchase });
  } catch (err) {
    return mapError(err, res);
  }
};

const updatePurchase = async (req, res) => {
  if (resolveValidation(req, res)) return;

  try {
    const purchase = await purchaseService.updatePurchase({
      purchaseId: Number(req.params.id),
      payload: req.body,
      actor: req.user,
    });

    return res.json({ purchase });
  } catch (err) {
    return mapError(err, res);
  }
};

const cancelPurchase = async (req, res) => {
  if (resolveValidation(req, res)) return;

  try {
    const purchase = await purchaseService.cancelPurchase({
      purchaseId: Number(req.params.id),
      actor: req.user,
    });

    return res.json({ purchase });
  } catch (err) {
    return mapError(err, res);
  }
};

const listPurchaseReturns = async (req, res) => {
  if (resolveValidation(req, res)) return;

  try {
    const { role, branchId: actorBranchId } = req.user;
    const branchId = role === 'main_admin'
      ? (req.query.branchId ? Number(req.query.branchId) : undefined)
      : Number(actorBranchId);

    const returns = await purchaseService.listPurchaseReturns({
      branchId,
      filters: {
        purchaseId: req.query.purchaseId,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      },
    });

    return res.json({ returns });
  } catch (err) {
    return mapError(err, res);
  }
};

const createPurchaseReturn = async (req, res) => {
  if (resolveValidation(req, res)) return;

  try {
    const purchaseReturn = await purchaseService.createPurchaseReturn({
      payload: req.body,
      actor: req.user,
    });

    return res.status(201).json({ purchaseReturn });
  } catch (err) {
    return mapError(err, res);
  }
};

const getPurchaseReturn = async (req, res) => {
  try {
    const purchaseReturn = await purchaseService.getPurchaseReturn({
      returnId: Number(req.params.id),
      actor: req.user,
    });

    return res.json({ purchaseReturn });
  } catch (err) {
    return mapError(err, res);
  }
};

const cancelPurchaseReturn = async (req, res) => {
  if (resolveValidation(req, res)) return;
  try {
    const result = await purchaseService.cancelPurchaseReturn({
      returnId: Number(req.params.id),
      actor: req.user,
    });
    return res.json(result);
  } catch (err) {
    return mapError(err, res);
  }
};

const updatePurchaseReturn = async (req, res) => {
  if (resolveValidation(req, res)) return;
  try {
    const purchaseReturn = await purchaseService.updatePurchaseReturn({
      returnId: Number(req.params.id),
      payload: req.body,
      actor: req.user,
    });
    return res.json({ purchaseReturn });
  } catch (err) {
    return mapError(err, res);
  }
};

module.exports = {
  listPurchases,
  getPurchase,
  createPurchase,
  updatePurchase,
  cancelPurchase,
  listPurchaseReturns,
  createPurchaseReturn,
  getPurchaseReturn,
  cancelPurchaseReturn,
  updatePurchaseReturn,
};
