const express = require('express');
const { query, body } = require('express-validator');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/authorize.middleware');
const { ROLES } = require('../constants/roles');
const { getStock, adjustStock, setStock, getFifoReport, getProductHistory } = require('../controllers/inventory.controller');

const router = express.Router();

const managers = [ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN];
const allRoles = [ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN, ROLES.STAFF];

// GET /api/inventory/stock?branchId=&productId=&mode=all|unit&unitId=
router.get(
  '/stock',
  authenticate,
  authorize(...allRoles),
  [
    query('branchId').notEmpty().isInt({ min: 1 }).withMessage('branchId is required'),
    query('mode').optional().isIn(['all', 'unit']),
    query('unitId').optional().isInt({ min: 1 }),
    query('productId').optional().isInt({ min: 1 }),
  ],
  getStock
);

// GET /api/inventory/fifo-report?branchId=&productId=&fromDate=&toDate=&onlyOpen=
router.get(
  '/fifo-report',
  authenticate,
  authorize(...allRoles),
  [
    query('branchId').notEmpty().isInt({ min: 1 }).withMessage('branchId is required'),
    query('productId').optional().isInt({ min: 1 }),
    query('fromDate').optional().isISO8601(),
    query('toDate').optional().isISO8601(),
    query('onlyOpen').optional().isIn(['true', 'false', '1', '0']),
  ],
  getFifoReport
);

// GET /api/inventory/product-history?branchId=&productId=&startDate=&endDate=
router.get(
  '/product-history',
  authenticate,
  authorize(...allRoles),
  [
    query('branchId').notEmpty().isInt({ min: 1 }).withMessage('branchId is required'),
    query('productId').optional().isInt({ min: 1 }),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  getProductHistory
);

// POST /api/inventory/adjustments  — add or remove base-unit quantity
router.post(
  '/adjustments',
  authenticate,
  authorize(...managers),
  [
    body('branchId').notEmpty().isInt({ min: 1 }),
    body('productId').notEmpty().isInt({ min: 1 }),
    body('deltaQty').notEmpty().isNumeric().withMessage('deltaQty must be a number'),
    body('reason').optional().isString().trim(),
  ],
  adjustStock
);

// POST /api/inventory/set  — set absolute quantity (opening balance / physical count)
router.post(
  '/set',
  authenticate,
  authorize(...managers),
  [
    body('branchId').notEmpty().isInt({ min: 1 }),
    body('productId').notEmpty().isInt({ min: 1 }),
    body('quantity').notEmpty().isFloat({ min: 0 }).withMessage('quantity must be >= 0'),
  ],
  setStock
);

module.exports = router;
