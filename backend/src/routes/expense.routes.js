const express = require('express');
const { body, query } = require('express-validator');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/authorize.middleware');
const { requireAccess } = require('../middleware/access.middleware');
const { ROLES } = require('../constants/roles');
const {
  listExpenses,
  getExpense,
  createExpense,
  cancelExpense,
} = require('../controllers/expense.controller');

const router = express.Router();
const allRoles = [ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN, ROLES.STAFF];

router.get(
  '/',
  authenticate,
  authorize(...allRoles),
  requireAccess('expenses:read'),
  [
    query('branchId').optional().isInt({ min: 1 }),
    query('status').optional().isIn(['posted', 'cancelled', 'all']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  listExpenses
);

router.get(
  '/:id',
  authenticate,
  authorize(...allRoles),
  requireAccess('expenses:read'),
  getExpense
);

router.post(
  '/',
  authenticate,
  authorize(...allRoles),
  requireAccess('expenses:create'),
  [
    body('branchId').optional().isInt({ min: 1 }),
    body('contactId').optional({ nullable: true }).isInt({ min: 1 }),
    body('amount').notEmpty().isFloat({ gt: 0 }).withMessage('amount must be greater than 0'),
    body('expenseDate').notEmpty().isISO8601().withMessage('expenseDate is required'),
    body('accountHeadId').optional({ nullable: true }).isInt({ min: 1 }),
    body('category').optional().isString().trim(),
    body('description').optional().isString().trim(),
    body('receiptNo').optional().isString().trim(),
    body('payments').optional().isArray(),
    body('payments.*.paymentAccountId').optional({ nullable: true }).isInt({ min: 1 }),
    body('payments.*.amount').optional().isFloat({ gt: 0 }),
  ],
  createExpense
);

router.patch(
  '/:id/cancel',
  authenticate,
  authorize(...allRoles),
  requireAccess('expenses:cancel'),
  cancelExpense
);

module.exports = router;
