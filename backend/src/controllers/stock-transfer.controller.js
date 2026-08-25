const { validationResult } = require('express-validator');
const stockTransferService = require('../services/stock-transfer.service');

const mapError = (err, res) => {
  const msg = err.message || 'Unexpected error';
  if (msg.includes('not found')) return res.status(404).json({ error: msg });
  if (msg.includes('Not allowed') || msg.includes('not allowed')) return res.status(403).json({ error: msg });
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

const listTransfers = async (req, res) => {
  if (resolveValidation(req, res)) return;

  try {
    const transfers = await stockTransferService.listTransfers({
      actor: req.user,
      filters: {
        branchId: req.query.branchId,
        status: req.query.status,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      },
    });
    return res.json({ transfers });
  } catch (err) {
    return mapError(err, res);
  }
};

const getTransfer = async (req, res) => {
  try {
    const transfer = await stockTransferService.getTransfer({
      transferId: Number(req.params.id),
      actor: req.user,
    });
    return res.json({ transfer });
  } catch (err) {
    return mapError(err, res);
  }
};

const createTransfer = async (req, res) => {
  if (resolveValidation(req, res)) return;

  try {
    const transfer = await stockTransferService.createTransfer({
      actor: req.user,
      payload: req.body,
    });
    return res.status(201).json({ transfer });
  } catch (err) {
    return mapError(err, res);
  }
};

const cancelTransfer = async (req, res) => {
  try {
    const transfer = await stockTransferService.cancelTransfer({
      transferId: Number(req.params.id),
      actor: req.user,
    });
    return res.json({ message: 'Stock transfer cancelled', transfer });
  } catch (err) {
    return mapError(err, res);
  }
};

module.exports = {
  listTransfers,
  getTransfer,
  createTransfer,
  cancelTransfer,
};
