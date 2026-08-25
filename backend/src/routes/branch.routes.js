const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/authorize.middleware');
const { requireAccess } = require('../middleware/access.middleware');
const { ROLES } = require('../constants/roles');
const {
  getBranches,
  create,
  update,
  updateStatus,
} = require('../controllers/branch.controller');

const router = express.Router();
const allRoles = [ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN, ROLES.STAFF];

router.get('/', authenticate, authorize(...allRoles), requireAccess('branch:read'), getBranches);

router.post(
  '/',
  authenticate,
  authorize(ROLES.MAIN_ADMIN),
  requireAccess('branch:create'),
  [
    body('name').trim().notEmpty().withMessage('Branch name is required'),
    body('code').optional().trim().notEmpty().withMessage('Branch code cannot be empty'),
    body('address').optional().isString().trim(),
    body('phone').optional().isString().trim(),
  ],
  create
);

router.put(
  '/:id',
  authenticate,
  authorize(ROLES.MAIN_ADMIN),
  requireAccess('branch:update'),
  [
    body('name').optional().trim().notEmpty().withMessage('Branch name cannot be empty'),
    body('code').optional().trim().notEmpty().withMessage('Branch code cannot be empty'),
    body('address').optional().isString().trim(),
    body('phone').optional().isString().trim(),
  ],
  update
);

router.patch(
  '/:id/status',
  authenticate,
  authorize(ROLES.MAIN_ADMIN),
  requireAccess('branch:update'),
  [body('isActive').isBoolean().withMessage('isActive must be a boolean')],
  updateStatus
);

module.exports = router;
