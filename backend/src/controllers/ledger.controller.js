const { validationResult } = require('express-validator');
const ledgerService = require('../services/ledger.service');

const mapError = (err, res) => {
  const msg = err.message || 'Unexpected error';
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

const resolveBranchId = (req) => {
  if (req.user?.role === 'main_admin') {
    const branchId = Number(req.query.branchId || req.user?.branchId);
    if (!branchId) throw new Error('branchId is required for main admin');
    return branchId;
  }

  const branchId = Number(req.user?.branchId);
  if (!branchId) throw new Error('User branch is not configured');
  return branchId;
};

/**
 * GET /api/ledger/contact/:contactId?startDate=&endDate=
 */
const getContactLedger = async (req, res) => {
  if (resolveValidation(req, res)) return;

  const { contactId } = req.params;
  const { startDate, endDate } = req.query;

  try {
    const branchId = resolveBranchId(req);
    const entries = await ledgerService.getContactLedger(
      branchId,
      Number(contactId),
      { startDate, endDate }
    );
    return res.json({ entries });
  } catch (err) {
    return mapError(err, res);
  }
};

/**
 * GET /api/ledger/receivables
 */
const getReceivables = async (req, res) => {
  try {
    const branchId = resolveBranchId(req);
    const receivables = await ledgerService.getReceivables(branchId);
    return res.json({ receivables });
  } catch (err) {
    return mapError(err, res);
  }
};

/**
 * GET /api/ledger/payables
 */
const getPayables = async (req, res) => {
  try {
    const branchId = resolveBranchId(req);
    const payables = await ledgerService.getPayables(branchId);
    return res.json({ payables });
  } catch (err) {
    return mapError(err, res);
  }
};

/**
 * GET /api/ledger/report?startDate=&endDate=
 */
const getLedgerReport = async (req, res) => {
  const { startDate, endDate } = req.query;

  try {
    const branchId = resolveBranchId(req);
    const entries = await ledgerService.getLedgerReport(branchId, {
      startDate,
      endDate,
    });
    return res.json({ entries });
  } catch (err) {
    return mapError(err, res);
  }
};

/**
 * GET /api/ledger/cash-book?startDate=&endDate=&branchId=
 */
const getCashBook = async (req, res) => {
  if (resolveValidation(req, res)) return;

  const { startDate, endDate } = req.query;

  try {
    const branchId = resolveBranchId(req);
    const cashBook = await ledgerService.getCashBook(branchId, { startDate, endDate });
    return res.json(cashBook);
  } catch (err) {
    return mapError(err, res);
  }
};

/**
 * GET /api/ledger/opening-balance
 */
const getOpeningBalance = async (req, res) => {
  try {
    const branchId = resolveBranchId(req);
    const data = await ledgerService.getOpeningBalance(branchId);
    return res.json(data);
  } catch (err) {
    return mapError(err, res);
  }
};

/**
 * POST /api/ledger/opening-balance
 * Body: { openingBalance, openingDate?, notes? }
 */
const setOpeningBalance = async (req, res) => {
  try {
    const branchId = resolveBranchId(req);
    const { openingBalance, openingDate, notes } = req.body;
    if (openingBalance === undefined || openingBalance === null) {
      return res.status(422).json({ error: 'openingBalance is required' });
    }
    const data = await ledgerService.setOpeningBalance(branchId, {
      openingBalance: Number(openingBalance),
      openingDate: openingDate || null,
      notes: notes || null,
      setById: req.user?.id || null,
    });
    return res.json(data);
  } catch (err) {
    return mapError(err, res);
  }
};

/**
 * GET /api/ledger/trading-register?branchId=&startDate=&endDate=
 */
const getTradingLedgerRegister = async (req, res) => {
  if (resolveValidation(req, res)) return;
  const { startDate, endDate } = req.query;
  try {
    const branchId = resolveBranchId(req);
    const data = await ledgerService.getTradingLedgerRegister(branchId, { startDate, endDate });
    return res.json(data);
  } catch (err) {
    return mapError(err, res);
  }
};

module.exports = {
  getContactLedger,
  getReceivables,
  getPayables,
  getLedgerReport,
  getCashBook,
  getOpeningBalance,
  setOpeningBalance,
  getTradingLedgerRegister,
};
