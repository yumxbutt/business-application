const express = require('express');
const { body, query } = require('express-validator');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/authorize.middleware');
const { ROLES } = require('../constants/roles');
const {
  listContacts,
  createContact,
  updateContact,
  changeStatus,
  getCustomers,
  getSuppliers,
} = require('../controllers/contact.controller');

const router = express.Router();
const managers = [ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN];
const allRoles = [ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN, ROLES.STAFF];

// GET /api/contacts
router.get(
  '/',
  authenticate,
  authorize(...allRoles),
  [
    query('branchId').optional().isInt({ min: 1 }),
    query('search').optional().isString().trim(),
    query('recordType').optional().isIn(['customer', 'supplier', 'both', 'all']),
    query('isActive').optional().isIn(['active', 'inactive', 'all']),
  ],
  listContacts
);

// POST /api/contacts
router.post(
  '/',
  authenticate,
  authorize(...managers),
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

// PUT /api/contacts/:id
router.put(
  '/:id',
  authenticate,
  authorize(...managers),
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

// PATCH /api/contacts/:id/status
router.patch(
  '/:id/status',
  authenticate,
  authorize(...managers),
  [body('isActive').isBoolean().withMessage('isActive must be a boolean')],
  changeStatus
);

// GET /api/contacts/list/customers
router.get(
  '/list/customers',
  authenticate,
  authorize(...allRoles),
  [query('branchId').optional().isInt({ min: 1 })],
  getCustomers
);

// GET /api/contacts/list/suppliers
router.get(
  '/list/suppliers',
  authenticate,
  authorize(...allRoles),
  [query('branchId').optional().isInt({ min: 1 })],
  getSuppliers
);

module.exports = router;
