const express = require('express');
const { body, query } = require('express-validator');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/authorize.middleware');
const { requireAccess } = require('../middleware/access.middleware');
const { ROLES } = require('../constants/roles');
const {
  listContacts,
  createContact,
  updateContact,
  changeStatus,
  getCustomers,
  getDefaultCustomer,
  getSuppliers,
} = require('../controllers/contact.controller');

const router = express.Router();
const managers = [ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN];
const allRoles = [ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN, ROLES.STAFF];

router.get(
  '/',
  authenticate,
  authorize(...allRoles),
  requireAccess('financial:contacts:read'),
  [
    query('branchId').optional().isInt({ min: 1 }),
    query('search').optional().isString().trim(),
    query('recordType').optional().isIn(['customer', 'supplier', 'both', 'all']),
    query('isActive').optional().isIn(['active', 'inactive', 'all']),
  ],
  listContacts
);

router.post(
  '/',
  authenticate,
  authorize(...allRoles),
  requireAccess('financial:contacts:create'),
  [
    body('branchId').optional().isInt({ min: 1 }),
    body('applyToAllBranches').optional().isBoolean(),
    body('branchIds').optional().isArray(),
    body('branchIds.*').optional().isInt({ min: 1 }),
    body('name').notEmpty().isString().trim().withMessage('Name is required'),
    body('phone').optional({ nullable: true }).isString().trim(),
    body('address').optional({ nullable: true }).isString().trim(),
    body('recordType')
      .notEmpty()
      .isIn(['customer', 'supplier', 'both'])
      .withMessage('Record type must be customer, supplier, or both'),
    body('openingBalance').optional().isFloat({ min: 0 }),
  ],
  createContact
);

router.put(
  '/:id',
  authenticate,
  authorize(...managers),
  requireAccess('financial:contacts:create'),
  [
    body('branchId').optional().isInt({ min: 1 }),
    body('applyToAllBranches').optional().isBoolean(),
    body('branchIds').optional().isArray(),
    body('branchIds.*').optional().isInt({ min: 1 }),
    body('name').optional().isString().trim(),
    body('phone').optional({ nullable: true }).isString().trim(),
    body('address').optional({ nullable: true }).isString().trim(),
    body('recordType').optional().isIn(['customer', 'supplier', 'both']),
    body('openingBalance').optional().isFloat({ min: 0 }),
  ],
  updateContact
);

router.patch(
  '/:id/status',
  authenticate,
  authorize(...managers),
  requireAccess('financial:contacts:create'),
  [body('isActive').isBoolean().withMessage('isActive must be a boolean')],
  changeStatus
);

router.get(
  '/list/customers',
  authenticate,
  authorize(...allRoles),
  requireAccess('financial:contacts:read'),
  [query('branchId').optional().isInt({ min: 1 })],
  getCustomers
);

router.get(
  '/default-customer',
  authenticate,
  authorize(...allRoles),
  requireAccess('financial:contacts:read'),
  [query('branchId').optional().isInt({ min: 1 })],
  getDefaultCustomer
);

router.get(
  '/list/suppliers',
  authenticate,
  authorize(...allRoles),
  requireAccess('financial:contacts:read'),
  [query('branchId').optional().isInt({ min: 1 })],
  getSuppliers
);

module.exports = router;
