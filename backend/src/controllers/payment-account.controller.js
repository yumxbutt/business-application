const paymentAccountService = require('../services/payment-account.service');

const listAccounts = async (req, res, next) => {
  try {
    const rows = await paymentAccountService.listAccounts({ actor: req.user, filters: req.query });
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

const getAccountsForBranch = async (req, res, next) => {
  try {
    const rows = await paymentAccountService.getAccountsForBranch({
      actor: req.user,
      branchIdInput: req.query.branchId,
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

const createAccount = async (req, res, next) => {
  try {
    const account = await paymentAccountService.createAccount({ actor: req.user, payload: req.body });
    res.status(201).json(account);
  } catch (err) {
    next(err);
  }
};

const updateAccount = async (req, res, next) => {
  try {
    const account = await paymentAccountService.updateAccount({
      actor: req.user,
      accountId: Number(req.params.id),
      payload: req.body,
    });
    res.json(account);
  } catch (err) {
    next(err);
  }
};

const toggleAccount = async (req, res, next) => {
  try {
    const account = await paymentAccountService.toggleAccount({
      actor: req.user,
      accountId: Number(req.params.id),
    });
    res.json(account);
  } catch (err) {
    next(err);
  }
};

const getAccountStatement = async (req, res, next) => {
  try {
    const data = await paymentAccountService.getAccountStatement({
      actor: req.user,
      accountId: Number(req.params.id),
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
};

module.exports = { listAccounts, getAccountsForBranch, createAccount, updateAccount, toggleAccount, getAccountStatement };
