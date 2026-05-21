const { validationResult } = require('express-validator');
const financialService = require('../services/financial.service');

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

const createCashVoucher = async (req, res) => {
  if (resolveValidation(req, res)) return;

  try {
    const result = await financialService.createCashVoucher({
      actor: req.user,
      payload: req.body,
    });
    return res.status(201).json(result);
  } catch (err) {
    return mapError(err, res);
  }
};

const listCashVouchers = async (req, res) => {
  if (resolveValidation(req, res)) return;

  try {
    const vouchers = await financialService.listCashVouchers({
      actor: req.user,
      filters: {
        branchId: req.query.branchId,
        transactionType: req.query.transactionType,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      },
    });
    return res.json({ vouchers });
  } catch (err) {
    return mapError(err, res);
  }
};

module.exports = {
  createCashVoucher,
  listCashVouchers,
};
