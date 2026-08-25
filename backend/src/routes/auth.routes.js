const express = require('express');
const { body, query } = require('express-validator');
const { login, me, logout, updateProfile, getLoginActivities, refreshSessionHandler } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/authorize.middleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();

router.post(
  '/login',
  [
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  login
);

router.get(
  '/login-activities',
  authenticate,
  authorize(ROLES.MAIN_ADMIN),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['success', 'failed']),
    query('username').optional().isString().trim(),
  ],
  getLoginActivities
);

router.get('/me', authenticate, me);
router.post('/refresh-session', authenticate, refreshSessionHandler);
router.post('/logout', authenticate, logout);
router.put(
  '/profile',
  authenticate,
  [
    body('fullName').optional().trim().isLength({ min: 2 }).withMessage('Full name must be at least 2 characters'),
    body('newPassword').optional().isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
    body('currentPassword').optional(),
  ],
  updateProfile
);

module.exports = router;
