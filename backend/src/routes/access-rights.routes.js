const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/authorize.middleware');
const { requireAccess } = require('../middleware/access.middleware');
const { ROLES } = require('../constants/roles');
const {
  getRightsCatalog,
  updateRights,
} = require('../controllers/access-rights.controller');

const router = express.Router();
const adminRoles = [ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN];

router.get(
  '/catalog',
  authenticate,
  authorize(...adminRoles),
  requireAccess('users:access'),
  getRightsCatalog
);

router.put(
  '/users/:id',
  authenticate,
  authorize(...adminRoles),
  requireAccess('users:access'),
  [
    body('accessRights')
      .isArray()
      .withMessage('accessRights must be an array'),
  ],
  updateRights
);

module.exports = router;
