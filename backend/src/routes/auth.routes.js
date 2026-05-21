const express = require('express');
const { body } = require('express-validator');
const { login, me, logout, updateProfile } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

router.post(
  '/login',
  [
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  login
);

router.get('/me', authenticate, me);
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
