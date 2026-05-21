const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/authorize.middleware');
const { ROLES } = require('../constants/roles');
const { getBranches } = require('../controllers/branch.controller');

const router = express.Router();

router.get('/', authenticate, authorize(ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN, ROLES.STAFF), getBranches);

module.exports = router;
