const express = require('express');
const { body, query, param } = require('express-validator');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/authorize.middleware');
const { ROLES } = require('../constants/roles');
const {
  listSales,
  getSale,
  createSale,
  listSaleReturns,
  getSaleReturn,
  createSaleReturn,
  cancelSaleReturn,
  updateSaleReturn,
  updateSale,
  cancelSale,
  repostSale,
} = require('../controllers/sales.controller');

const router = express.Router();
const managers = [ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN];
const allRoles = [ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN, ROLES.STAFF];

router.get(
  '/returns',
  authenticate,
  authorize(...allRoles),
  [
    query('branchId').optional().isInt({ min: 1 }),
    query('saleId').optional().isInt({ min: 1 }),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  listSaleReturns
);

router.post(
  '/returns',
  authenticate,
  authorize(...managers),
  [
    body('branchId').optional().isInt({ min: 1 }),
    body('saleIdReference').isInt({ min: 1 }).withMessage('saleIdReference is required'),
    body('returnDate').isISO8601().withMessage('returnDate is required'),
    body('reason').optional({ nullable: true }).isString(),
    body('items').isArray({ min: 1 }).withMessage('At least one return item is required'),
    body('items.*.saleItemId').isInt({ min: 1 }).withMessage('saleItemId is required'),
    body('items.*.quantity').isFloat({ gt: 0 }).withMessage('quantity must be greater than 0'),
    body('items.*.unitPrice').optional({ nullable: true }).isFloat({ min: 0 }),
    body('items.*.notes').optional({ nullable: true }).isString(),
  ],
  createSaleReturn
);

router.get(
  '/returns/:id',
  authenticate,
  authorize(...allRoles),
  [param('id').isInt({ min: 1 })],
  getSaleReturn
);

router.delete(
  '/returns/:id',
  authenticate,
  authorize(...managers),
  [param('id').isInt({ min: 1 })],
  cancelSaleReturn
);

router.patch(
  '/returns/:id',
  authenticate,
  authorize(...managers),
  [
    param('id').isInt({ min: 1 }),
    body('returnDate').optional().isISO8601(),
    body('reason').optional({ nullable: true }).isString(),
  ],
  updateSaleReturn
);

router.get(
  '/',
  authenticate,
  authorize(...allRoles),
  [
    query('branchId').optional().isInt({ min: 1 }),
    query('search').optional().isString().trim(),
    query('status').optional().isIn(['draft', 'posted', 'cancelled', 'all']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  listSales
);

router.get(
  '/:id',
  authenticate,
  authorize(...allRoles),
  [param('id').isInt({ min: 1 })],
  getSale
);

router.post(
  '/',
  authenticate,
  authorize(...managers),
  [
    body('branchId').optional().isInt({ min: 1 }),
    body('contactId').isInt({ min: 1 }).withMessage('contactId is required'),
    body('invoiceNo').notEmpty().isString().trim().withMessage('invoiceNo is required'),
    body('saleDate').isISO8601().withMessage('saleDate is required'),
    body('discount').optional().isFloat({ min: 0 }),
    body('paidAmount').optional().isFloat({ min: 0 }),
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.productId').isInt({ min: 1 }).withMessage('productId is required'),
    body('items.*.sourceBranchId').optional({ nullable: true }).isInt({ min: 1 }),
    body('items.*.quantity').isFloat({ gt: 0 }).withMessage('quantity must be greater than 0'),
    body('items.*.unitPrice').isFloat({ min: 0 }).withMessage('unitPrice must be 0 or more'),
    body('items.*.notes').optional({ nullable: true }).isString(),
  ],
  createSale
);

router.put(
  '/:id',
  authenticate,
  authorize(...managers),
  [param('id').isInt({ min: 1 })],
  updateSale
);

router.patch(
  '/:id/cancel',
  authenticate,
  authorize(...managers),
  [param('id').isInt({ min: 1 })],
  cancelSale
);

router.patch(
  '/:id/post',
  authenticate,
  authorize(...managers),
  [param('id').isInt({ min: 1 })],
  repostSale
);

module.exports = router;
