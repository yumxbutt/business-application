const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/authorize.middleware');
const { requireAccess } = require('../middleware/access.middleware');
const { ROLES } = require('../constants/roles');
const { getSettings, saveSettings } = require('../controllers/settings.controller');

const router = express.Router();
const managers = [ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN];
const allRoles = [ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN, ROLES.STAFF];

router.get('/', authenticate, authorize(...allRoles), requireAccess('financial:settings:read'), getSettings);

router.post('/', authenticate, authorize(...managers), requireAccess('financial:settings:update'), saveSettings);

module.exports = router;
