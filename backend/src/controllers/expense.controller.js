const { validationResult } = require('express-validator');
const expenseService = require('../services/expense.service');

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

const listExpenses = async (req, res) => {
  if (resolveValidation(req, res)) return;

  try {
    const expenses = await expenseService.listExpenses({
      actor: req.user,
      filters: {
        branchId: req.query.branchId,
        status: req.query.status,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      },
    });
    return res.json({ expenses });
  } catch (err) {
    return mapError(err, res);
  }
};

const getExpense = async (req, res) => {
  try {
    const expense = await expenseService.getExpense({
      expenseId: Number(req.params.id),
      actor: req.user,
    });
    return res.json({ expense });
  } catch (err) {
    return mapError(err, res);
  }
};

const createExpense = async (req, res) => {
  if (resolveValidation(req, res)) return;

  try {
    const expense = await expenseService.createExpense({
      actor: req.user,
      payload: req.body,
    });
    return res.status(201).json({ expense });
  } catch (err) {
    return mapError(err, res);
  }
};

const cancelExpense = async (req, res) => {
  try {
    const expense = await expenseService.cancelExpense({
      expenseId: Number(req.params.id),
      actor: req.user,
    });
    return res.json({ message: 'Expense cancelled', expense });
  } catch (err) {
    return mapError(err, res);
  }
};

module.exports = {
  listExpenses,
  getExpense,
  createExpense,
  cancelExpense,
};
