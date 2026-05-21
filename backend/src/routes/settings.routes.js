const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/authorize.middleware');
const { ROLES } = require('../constants/roles');
const { getSettings, saveSettings } = require('../controllers/settings.controller');

const router = express.Router();
const managers = [ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN];
const allRoles = [ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN, ROLES.STAFF];

// GET /api/settings
router.get('/', authenticate, authorize(...allRoles), getSettings);

// POST /api/settings
router.post('/', authenticate, authorize(...managers), saveSettings);

module.exports = router;
