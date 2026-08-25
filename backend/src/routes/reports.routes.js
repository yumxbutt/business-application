const express = require('express');
const { query } = require('express-validator');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/authorize.middleware');
const { requireAccess } = require('../middleware/access.middleware');
const { ROLES } = require('../constants/roles');
const {
  getSalesSummary,
  getPurchaseSummary,
  getProfitLoss,
} = require('../controllers/reports.controller');

const router = express.Router();
const allRoles = [ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN, ROLES.STAFF];

const dateFilters = [
  query('branchId').optional().isInt({ min: 1 }),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
];

router.get(
  '/sales-summary',
  authenticate,
  authorize(...allRoles),
  requireAccess('reports:sales'),
  dateFilters,
  getSalesSummary
);

router.get(
  '/purchase-summary',
  authenticate,
  authorize(...allRoles),
  requireAccess('reports:purchase'),
  dateFilters,
  getPurchaseSummary
);

router.get(
  '/profit-loss',
  authenticate,
  authorize(...allRoles),
  requireAccess('reports:profit-loss'),
  dateFilters,
  getProfitLoss
);

module.exports = router;
