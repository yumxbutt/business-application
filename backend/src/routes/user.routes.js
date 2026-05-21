const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/authorize.middleware');
const { ROLES } = require('../constants/roles');
const {
  getUsers,
  create,
  update,
  updateStatus,
} = require('../controllers/user.controller');

const router = express.Router();

router.get('/', authenticate, authorize(ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN), getUsers);

router.post(
  '/',
  authenticate,
  authorize(ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN),
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
  authorize(ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN),
  [
    body('fullName').optional().trim().notEmpty().withMessage('Full name cannot be empty'),
    body('role').optional().isIn([ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN, ROLES.STAFF]).withMessage('Invalid role'),
  ],
  update
);

router.patch('/:id/status', authenticate, authorize(ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN), updateStatus);

module.exports = router;
