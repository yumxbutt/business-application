const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/authorize.middleware');
const { requireAccess } = require('../middleware/access.middleware');
const { ROLES } = require('../constants/roles');
const {
  getUsers,
  create,
  update,
  updateStatus,
} = require('../controllers/user.controller');

const router = express.Router();
const adminRoles = [ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN];

router.get('/', authenticate, authorize(...adminRoles), requireAccess('users:read'), getUsers);

router.post(
  '/',
  authenticate,
  authorize(...adminRoles),
  requireAccess('users:create'),
  [
    body('fullName').trim().notEmpty().withMessage('Full name is required'),
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').isIn([ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN, ROLES.STAFF]).withMessage('Invalid role'),
  ],
  create
);

router.put(
  '/:id',
  authenticate,
  authorize(...adminRoles),
  requireAccess('users:update'),
  [
    body('fullName').optional().trim().notEmpty().withMessage('Full name cannot be empty'),
    body('role').optional().isIn([ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN, ROLES.STAFF]).withMessage('Invalid role'),
  ],
  update
);

router.patch(
  '/:id/status',
  authenticate,
  authorize(...adminRoles),
  requireAccess('users:status'),
  updateStatus
);

module.exports = router;
