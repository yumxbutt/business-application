const express = require('express');
const { body, query } = require('express-validator');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/authorize.middleware');
const { ROLES } = require('../constants/roles');
const {
  getMeta,
  getCategories,
  createCategoryHandler,
  updateCategoryHandler,
  getTypes,
  createTypeHandler,
  updateTypeHandler,
  getUnits,
  createUnitHandler,
  updateUnitHandler,
  getAttributes,
  createAttributeHandler,
  updateAttributeHandler,
  addAttributeValueHandler,
  getProducts,
  createProductHandler,
  updateProductHandler,
  updateProductStatus,
  getVariants,
  createVariantHandler,
  updateVariantHandler,
  updateVariantStatus,
  getBranchSettings,
  createBranchSettingHandler,
  updateBranchSettingHandler,
  updateBranchSettingAvailability,
  searchProductsHandler,
} = require('../controllers/product.controller');
const { ProductUnit, Unit } = require('../models');

const router = express.Router();

const managerRoles = [ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN];

router.get('/meta', authenticate, authorize(ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN, ROLES.STAFF), getMeta);

router.get('/categories', authenticate, authorize(ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN, ROLES.STAFF), getCategories);
router.post(
  '/categories',
  authenticate,
  authorize(...managerRoles),
  [body('name').trim().notEmpty().withMessage('Category name is required')],
  createCategoryHandler
);
router.put(
  '/categories/:id',
  authenticate,
  authorize(...managerRoles),
  [body('name').optional().trim().notEmpty().withMessage('Category name cannot be empty')],
  updateCategoryHandler
);

router.get('/types', authenticate, authorize(ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN, ROLES.STAFF), getTypes);
router.post(
  '/types',
  authenticate,
  authorize(...managerRoles),
  [body('name').trim().notEmpty().withMessage('Type name is required')],
  createTypeHandler
);
router.put(
  '/types/:id',
  authenticate,
  authorize(...managerRoles),
  [body('name').optional().trim().notEmpty().withMessage('Type name cannot be empty')],
  updateTypeHandler
);

router.get('/units', authenticate, authorize(ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN, ROLES.STAFF), getUnits);
router.post(
  '/units',
  authenticate,
  authorize(...managerRoles),
  [body('name').trim().notEmpty().withMessage('Unit name is required')],
  createUnitHandler
);
router.put(
  '/units/:id',
  authenticate,
  authorize(...managerRoles),
  [body('name').optional().trim().notEmpty().withMessage('Unit name cannot be empty')],
  updateUnitHandler
);

router.get('/attributes', authenticate, authorize(ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN, ROLES.STAFF), getAttributes);
router.post(
  '/attributes',
  authenticate,
  authorize(...managerRoles),
  [body('name').trim().notEmpty().withMessage('Attribute name is required')],
  createAttributeHandler
);
router.put(
  '/attributes/:id',
  authenticate,
  authorize(...managerRoles),
  [body('name').optional().trim().notEmpty().withMessage('Attribute name cannot be empty')],
  updateAttributeHandler
);
router.post(
  '/attributes/:id/values',
  authenticate,
  authorize(...managerRoles),
  [body('value').trim().notEmpty().withMessage('Attribute value is required')],
  addAttributeValueHandler
);

router.get(
  '/search',
  authenticate,
  authorize(ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN, ROLES.STAFF),
  [query('q').optional().isString().trim()],
  searchProductsHandler
);

router.get('/', authenticate, authorize(ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN, ROLES.STAFF), getProducts);
router.post(
  '/',
  authenticate,
  authorize(...managerRoles),
  [body('name').trim().notEmpty().withMessage('Product name is required')],
  createProductHandler
);
router.put(
  '/:id',
  authenticate,
  authorize(...managerRoles),
  [body('name').optional().trim().notEmpty().withMessage('Product name cannot be empty')],
  updateProductHandler
);
router.patch('/:id/status', authenticate, authorize(...managerRoles), updateProductStatus);

// Return all product-units (with unit name/code) for a given product
router.get(
  '/:id/units',
  authenticate,
  authorize(ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN, ROLES.STAFF),
  async (req, res) => {
    try {
      const productId = Number(req.params.id);
      if (!productId) return res.status(400).json({ error: 'Invalid product id' });
      const units = await ProductUnit.findAll({
        where: { productId },
        include: [{ model: Unit, as: 'unit', attributes: ['id', 'name', 'code'] }],
        order: [['conversionFactor', 'ASC']],
      });
      return res.json({ units });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
);

router.get('/variants', authenticate, authorize(...managerRoles), getVariants);
router.post(
  '/variants',
  authenticate,
  authorize(...managerRoles),
  [body('productId').isInt({ min: 1 }).withMessage('Product is required')],
  createVariantHandler
);
router.put(
  '/variants/:id',
  authenticate,
  authorize(...managerRoles),
  [body('productId').optional().isInt({ min: 1 }).withMessage('Product must be valid')],
  updateVariantHandler
);
router.patch('/variants/:id/status', authenticate, authorize(...managerRoles), updateVariantStatus);

router.get('/branch-settings', authenticate, authorize(...managerRoles), getBranchSettings);
router.post(
  '/branch-settings',
  authenticate,
  authorize(...managerRoles),
  [
    body('productId').isInt({ min: 1 }).withMessage('Product is required'),
    body('branchId').optional().isInt({ min: 1 }).withMessage('Branch must be valid'),
  ],
  createBranchSettingHandler
);
router.put(
  '/branch-settings/:id',
  authenticate,
  authorize(...managerRoles),
  [
    body('salePrice').optional().isFloat({ min: 0 }).withMessage('Sale price must be non-negative'),
    body('reorderLevel').optional().isFloat({ min: 0 }).withMessage('Reorder level must be non-negative'),
  ],
  updateBranchSettingHandler
);
router.patch('/branch-settings/:id/availability', authenticate, authorize(...managerRoles), updateBranchSettingAvailability);

module.exports = router;
