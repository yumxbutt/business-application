const { validationResult } = require('express-validator');
const accountHeadService = require('../services/account-head.service');

const mapError = (err, res) => {
  const msg = err.message || 'Unexpected error';
  if (msg.includes('not found')) return res.status(404).json({ error: msg });
  if (msg.includes('Cannot') || msg.includes('cannot') || msg.includes('System')) {
    return res.status(400).json({ error: msg });
  }
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

const listAccountHeads = async (req, res) => {
  if (resolveValidation(req, res)) return;

  try {
    const accountHeads = await accountHeadService.listAccountHeads({
      filters: {
        type: req.query.type,
        isActive: req.query.isActive,
        search: req.query.search,
      },
    });
    return res.json({ accountHeads, types: accountHeadService.ACCOUNT_TYPES });
  } catch (err) {
    return mapError(err, res);
  }
};

const getAccountHead = async (req, res) => {
  try {
    const accountHead = await accountHeadService.getAccountHead(req.params.id);
    return res.json({ accountHead });
  } catch (err) {
    return mapError(err, res);
  }
};

const createAccountHead = async (req, res) => {
  if (resolveValidation(req, res)) return;

  try {
    const accountHead = await accountHeadService.createAccountHead(req.body);
    return res.status(201).json({ accountHead });
  } catch (err) {
    return mapError(err, res);
  }
};

const updateAccountHead = async (req, res) => {
  if (resolveValidation(req, res)) return;

  try {
    const accountHead = await accountHeadService.updateAccountHead(req.params.id, req.body);
    return res.json({ accountHead });
  } catch (err) {
    return mapError(err, res);
  }
};

const updateAccountHeadStatus = async (req, res) => {
  if (resolveValidation(req, res)) return;

  try {
    const accountHead = await accountHeadService.updateAccountHeadStatus(req.params.id, req.body.isActive);
    return res.json({ accountHead });
  } catch (err) {
    return mapError(err, res);
  }
};

module.exports = {
  listAccountHeads,
  getAccountHead,
  createAccountHead,
  updateAccountHead,
  updateAccountHeadStatus,
};
