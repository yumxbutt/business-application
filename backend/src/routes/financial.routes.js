const express = require('express');
const { body, query } = require('express-validator');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/authorize.middleware');
const { ROLES } = require('../constants/roles');
const { createCashVoucher, listCashVouchers } = require('../controllers/financial.controller');

const router = express.Router();
const allRoles = [ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN, ROLES.STAFF];

router.get(
  '/cash-vouchers',
  authenticate,
  authorize(...allRoles),
  [
    query('branchId').optional().isInt({ min: 1 }),
    query('transactionType').optional().isIn(['receipt', 'payment', 'all']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  listCashVouchers
);

router.post(
  '/cash-vouchers',
  authenticate,
  authorize(...allRoles),
  [
    body('branchId').optional().isInt({ min: 1 }),
    body('contactId').notEmpty().isInt({ min: 1 }).withMessage('contactId is required'),
    body('transactionType').notEmpty().isIn(['receipt', 'payment']).withMessage('transactionType must be receipt or payment'),
    body('amount').notEmpty().isFloat({ gt: 0 }).withMessage('amount must be greater than 0'),
    body('entryDate').notEmpty().isISO8601().withMessage('entryDate is required'),
    body('description').optional().isString().trim(),
    body('referenceNo').optional().isString().trim(),
  ],
  createCashVoucher
);

router.get('/', (req, res) => {
  res.json({ message: 'Financials API is active' });
});

module.exports = router;
