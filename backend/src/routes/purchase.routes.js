const express = require('express');
const { body, query, param } = require('express-validator');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/authorize.middleware');
const { ROLES } = require('../constants/roles');
const {
  listPurchases,
  getPurchase,
  createPurchase,
  updatePurchase,
  cancelPurchase,
  listPurchaseReturns,
  createPurchaseReturn,
  getPurchaseReturn,
  cancelPurchaseReturn,
  updatePurchaseReturn,
} = require('../controllers/purchase.controller');

const router = express.Router();
const managers = [ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN];
const allRoles = [ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN, ROLES.STAFF];

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
  listPurchases
);

router.get(
  '/returns',
  authenticate,
  authorize(...allRoles),
  [
    query('branchId').optional().isInt({ min: 1 }),
    query('purchaseId').optional().isInt({ min: 1 }),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  listPurchaseReturns
);

router.post(
  '/returns',
  authenticate,
  authorize(...managers),
  [
    body('branchId').optional().isInt({ min: 1 }),
    body('purchaseIdReference').isInt({ min: 1 }).withMessage('purchaseIdReference is required'),
    body('returnDate').isISO8601().withMessage('returnDate is required'),
    body('reason').optional({ nullable: true }).isString(),
    body('items').isArray({ min: 1 }).withMessage('At least one return item is required'),
    body('items.*.purchaseItemId').isInt({ min: 1 }).withMessage('purchaseItemId is required'),
    body('items.*.quantity').isFloat({ gt: 0 }).withMessage('quantity must be greater than 0'),
    body('items.*.unitPrice').optional({ nullable: true }).isFloat({ min: 0 }),
    body('items.*.salePrice').optional({ nullable: true }).isFloat({ min: 0 }),
    body('items.*.unitId').optional({ nullable: true }).isInt({ min: 1 }),
    body('items.*.notes').optional({ nullable: true }).isString(),
  ],
  createPurchaseReturn
);

router.get(
  '/returns/:id',
  authenticate,
  authorize(...allRoles),
  [param('id').isInt({ min: 1 })],
  getPurchaseReturn
);

router.delete(
  '/returns/:id',
  authenticate,
  authorize(...managers),
  [param('id').isInt({ min: 1 })],
  cancelPurchaseReturn
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
  updatePurchaseReturn
);

router.get(
  '/:id',
  authenticate,
  authorize(...allRoles),
  [param('id').isInt({ min: 1 })],
  getPurchase
);

router.put(
  '/:id',
  authenticate,
  authorize(...managers),
  [
    param('id').isInt({ min: 1 }),
    body('contactId').isInt({ min: 1 }).withMessage('contactId is required'),
    body('billNo').notEmpty().isString().trim().withMessage('billNo is required'),
    body('purchaseDate').isISO8601().withMessage('purchaseDate is required'),
    body('discount').optional().isFloat({ min: 0 }),
    body('paidAmount').optional().isFloat({ min: 0 }),
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.productId').isInt({ min: 1 }).withMessage('productId is required'),
    body('items.*.quantity').isFloat({ gt: 0 }).withMessage('quantity must be greater than 0'),
    body('items.*.unitPrice').isFloat({ min: 0 }).withMessage('unitPrice must be 0 or more'),
    body('items.*.salePrice').optional({ nullable: true }).isFloat({ min: 0 }),
    body('items.*.notes').optional({ nullable: true }).isString(),
  ],
  updatePurchase
);

router.patch(
  '/:id/cancel',
  authenticate,
  authorize(...managers),
  [param('id').isInt({ min: 1 })],
  cancelPurchase
);

router.post(
  '/',
  authenticate,
  authorize(...managers),
  [
    body('branchId').optional().isInt({ min: 1 }),
    body('contactId').isInt({ min: 1 }).withMessage('contactId is required'),
    body('billNo').notEmpty().isString().trim().withMessage('billNo is required'),
    body('purchaseDate').isISO8601().withMessage('purchaseDate is required'),
    body('discount').optional().isFloat({ min: 0 }),
    body('paidAmount').optional().isFloat({ min: 0 }),
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.productId').isInt({ min: 1 }).withMessage('productId is required'),
    body('items.*.quantity').isFloat({ gt: 0 }).withMessage('quantity must be greater than 0'),
    body('items.*.unitPrice').isFloat({ min: 0 }).withMessage('unitPrice must be 0 or more'),
    body('items.*.salePrice').optional({ nullable: true }).isFloat({ min: 0 }),
    body('items.*.notes').optional({ nullable: true }).isString(),
  ],
  createPurchase
);

module.exports = router;
