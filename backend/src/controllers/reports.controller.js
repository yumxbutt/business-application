const { validationResult } = require('express-validator');
const reportsService = require('../services/reports.service');

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

const getSalesSummary = async (req, res) => {
  if (resolveValidation(req, res)) return;

  try {
    const branchId = resolveBranchId(req);
    const { startDate, endDate } = req.query;
    const summary = await reportsService.getSalesSummary(branchId, startDate, endDate);
    return res.json(summary);
  } catch (err) {
    return mapError(err, res);
  }
};

const getPurchaseSummary = async (req, res) => {
  if (resolveValidation(req, res)) return;

  try {
    const branchId = resolveBranchId(req);
    const { startDate, endDate } = req.query;
    const summary = await reportsService.getPurchaseSummary(branchId, startDate, endDate);
    return res.json(summary);
  } catch (err) {
    return mapError(err, res);
  }
};

const getProfitLoss = async (req, res) => {
  if (resolveValidation(req, res)) return;

  try {
    const branchId = resolveBranchId(req);
    const { startDate, endDate } = req.query;
    const report = await reportsService.getProfitLoss(branchId, startDate, endDate);
    return res.json(report);
  } catch (err) {
    return mapError(err, res);
  }
};

module.exports = {
  getSalesSummary,
  getPurchaseSummary,
  getProfitLoss,
};
