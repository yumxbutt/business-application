const express = require('express');
const { body, param, query } = require('express-validator');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/authorize.middleware');
const { requireAccess } = require('../middleware/access.middleware');
const { ROLES } = require('../constants/roles');
const {
  listAccountHeads,
  getAccountHead,
  createAccountHead,
  updateAccountHead,
  updateAccountHeadStatus,
} = require('../controllers/account-head.controller');
const { ACCOUNT_TYPES } = require('../services/account-head.service');

const router = express.Router();
const adminRoles = [ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN];

router.get(
  '/',
  authenticate,
  authorize(...adminRoles),
  requireAccess('financial:accounts:read'),
  [
    query('type').optional().isIn([...ACCOUNT_TYPES, 'all']),
    query('isActive').optional().isIn(['active', 'inactive', 'all']),
    query('search').optional().isString().trim(),
  ],
  listAccountHeads
);

router.get(
  '/:id',
  authenticate,
  authorize(...adminRoles),
  requireAccess('financial:accounts:read'),
  [param('id').isInt({ min: 1 })],
  getAccountHead
);

router.post(
  '/',
  authenticate,
  authorize(...adminRoles),
  requireAccess('financial:accounts:create'),
  [
    body('name').trim().notEmpty().withMessage('Account name is required'),
    body('code').trim().notEmpty().withMessage('Account code is required'),
    body('type').isIn(ACCOUNT_TYPES).withMessage('Invalid account type'),
    body('description').optional({ nullable: true }).isString(),
  ],
  createAccountHead
);

router.put(
  '/:id',
  authenticate,
  authorize(...adminRoles),
  requireAccess('financial:accounts:update'),
  [
    param('id').isInt({ min: 1 }),
    body('name').optional().trim().notEmpty().withMessage('Account name cannot be empty'),
    body('type').optional().isIn(ACCOUNT_TYPES).withMessage('Invalid account type'),
    body('description').optional({ nullable: true }).isString(),
  ],
  updateAccountHead
);

router.patch(
  '/:id/status',
  authenticate,
  authorize(...adminRoles),
  requireAccess('financial:accounts:update'),
  [
    param('id').isInt({ min: 1 }),
    body('isActive').isBoolean().withMessage('isActive must be a boolean'),
  ],
  updateAccountHeadStatus
);

module.exports = router;
