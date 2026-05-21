const express = require('express');
const { body, query, param } = require('express-validator');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/authorize.middleware');
const { ROLES } = require('../constants/roles');
const {
  listAccounts,
  getAccountsForBranch,
  createAccount,
  updateAccount,
  toggleAccount,
  getAccountStatement,
} = require('../controllers/payment-account.controller');

const router = express.Router();
const allRoles = [ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN, ROLES.STAFF];
const adminRoles = [ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN];

// GET /api/payment-accounts — list all accounts (admin view)
router.get(
  '/',
  authenticate,
  authorize(...allRoles),
  [
    query('branchId').optional().isInt({ min: 1 }),
    query('accountType').optional().isIn(['cash', 'bank']),
    query('isActive').optional().isIn(['true', 'false', '1', '0', '']),
  ],
  listAccounts
);

// GET /api/payment-accounts/for-branch — returns active accounts for a branch (used in PaymentSelector)
router.get(
  '/for-branch',
  authenticate,
  authorize(...allRoles),
  [query('branchId').optional().isInt({ min: 1 })],
  getAccountsForBranch
);

// POST /api/payment-accounts — create
router.post(
  '/',
  authenticate,
  authorize(...adminRoles),
  [
    body('name').notEmpty().withMessage('Account name is required'),
    body('accountType').isIn(['cash', 'bank']).withMessage('accountType must be cash or bank'),
    body('openingBalance').optional().isDecimal(),
    body('openingDate').optional().isISO8601(),
    body('branchId').optional({ nullable: true }).isInt({ min: 1 }),
    body('sortOrder').optional().isInt({ min: 0 }),
  ],
  createAccount
);

// PUT /api/payment-accounts/:id — update
router.put(
  '/:id',
  authenticate,
  authorize(...adminRoles),
  [
    param('id').isInt({ min: 1 }),
    body('name').optional().notEmpty(),
    body('openingBalance').optional().isDecimal(),
    body('openingDate').optional().isISO8601(),
    body('sortOrder').optional().isInt({ min: 0 }),
  ],
  updateAccount
);

// PATCH /api/payment-accounts/:id/toggle — activate / deactivate
router.patch(
  '/:id/toggle',
  authenticate,
  authorize(...adminRoles),
  [param('id').isInt({ min: 1 })],
  toggleAccount
);

// GET /api/payment-accounts/:id/statement — account statement for reconciliation
router.get(
  '/:id/statement',
  authenticate,
  authorize(...allRoles),
  [
    param('id').isInt({ min: 1 }),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  getAccountStatement
);

module.exports = router;
