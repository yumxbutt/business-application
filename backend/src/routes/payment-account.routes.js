const express = require('express');
const { body, query, param } = require('express-validator');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/authorize.middleware');
const { requireAccess } = require('../middleware/access.middleware');
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

router.get(
  '/',
  authenticate,
  authorize(...allRoles),
  requireAccess('financial:payment-accounts:read'),
  [
    query('branchId').optional().isInt({ min: 1 }),
    query('accountType').optional().isIn(['cash', 'bank']),
    query('isActive').optional().isIn(['true', 'false', '1', '0', '']),
  ],
  listAccounts
);

router.get(
  '/for-branch',
  authenticate,
  authorize(...allRoles),
  requireAccess('financial:payment-accounts:read'),
  [query('branchId').optional().isInt({ min: 1 })],
  getAccountsForBranch
);

router.post(
  '/',
  authenticate,
  authorize(...adminRoles),
  requireAccess('financial:payment-accounts:manage'),
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

router.put(
  '/:id',
  authenticate,
  authorize(...adminRoles),
  requireAccess('financial:payment-accounts:manage'),
  [
    param('id').isInt({ min: 1 }),
    body('name').optional().notEmpty(),
    body('openingBalance').optional().isDecimal(),
    body('openingDate').optional().isISO8601(),
    body('sortOrder').optional().isInt({ min: 0 }),
  ],
  updateAccount
);

router.patch(
  '/:id/toggle',
  authenticate,
  authorize(...adminRoles),
  requireAccess('financial:payment-accounts:manage'),
  [param('id').isInt({ min: 1 })],
  toggleAccount
);

router.get(
  '/:id/statement',
  authenticate,
  authorize(...allRoles),
  requireAccess('financial:payment-accounts:read'),
  [
    param('id').isInt({ min: 1 }),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  getAccountStatement
);

module.exports = router;
