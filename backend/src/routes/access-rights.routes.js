const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/authorize.middleware');
const { ROLES } = require('../constants/roles');
const {
  getRightsCatalog,
  updateRights,
} = require('../controllers/access-rights.controller');

const router = express.Router();

router.get('/catalog', authenticate, authorize(ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN), getRightsCatalog);

router.put(
  '/users/:id',
  authenticate,
  authorize(ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN),
  [
    body('accessRights')
      .isArray()
      .withMessage('accessRights must be an array'),
  ],
  updateRights
);

module.exports = router;
