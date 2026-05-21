const { validationResult } = require('express-validator');
const {
  listCategories,
  createCategory,
  updateCategory,
  listTypes,
  createType,
  updateType,
  listUnits,
  createUnit,
  updateUnit,
  listAttributes,
  createAttribute,
  updateAttribute,
  addAttributeValue,
  listProducts,
  searchProducts,
  createProduct,
  updateProduct,
  changeProductStatus,
  getProductMeta,
  listVariants,
  createVariant,
  updateVariant,
  changeVariantStatus,
  listBranchSettings,
  createBranchSetting,
  updateBranchSetting,
  changeBranchSettingStatus,
} = require('../services/product.service');

const resolveValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return false;
  }
  return true;
};

const mapError = (error, res, next) => {
  if (error.message.includes('not found')) return res.status(404).json({ message: error.message });
  if (error.message.includes('Not allowed')) return res.status(403).json({ message: error.message });
  if (error.message.includes('exists') || error.message.includes('required')) {
    return res.status(400).json({ message: error.message });
  }
  return next(error);
};

const getMeta = async (req, res, next) => {
  try {
    const meta = await getProductMeta();
    res.json(meta);
  } catch (error) {
    next(error);
  }
};

const getCategories = async (req, res, next) => {
  try {
    const categories = await listCategories();
    res.json({ categories });
  } catch (error) {
    next(error);
  }
};

const createCategoryHandler = async (req, res, next) => {
  try {
    if (!resolveValidation(req, res)) return;
    const category = await createCategory({ actor: req.user, payload: req.body });
    res.status(201).json({ message: 'Category created', category });
  } catch (error) {
    mapError(error, res, next);
  }
};

const updateCategoryHandler = async (req, res, next) => {
  try {
    if (!resolveValidation(req, res)) return;
    const category = await updateCategory({ actor: req.user, id: Number(req.params.id), payload: req.body });
    res.json({ message: 'Category updated', category });
  } catch (error) {
    mapError(error, res, next);
  }
};

const getTypes = async (req, res, next) => {
  try {
    const types = await listTypes();
    res.json({ types });
  } catch (error) {
    next(error);
  }
};

const createTypeHandler = async (req, res, next) => {
  try {
    if (!resolveValidation(req, res)) return;
    const type = await createType({ actor: req.user, payload: req.body });
    res.status(201).json({ message: 'Type created', type });
  } catch (error) {
    mapError(error, res, next);
  }
};

const updateTypeHandler = async (req, res, next) => {
  try {
    if (!resolveValidation(req, res)) return;
    const type = await updateType({ actor: req.user, id: Number(req.params.id), payload: req.body });
    res.json({ message: 'Type updated', type });
  } catch (error) {
    mapError(error, res, next);
  }
};

const getUnits = async (req, res, next) => {
  try {
    const units = await listUnits();
    res.json({ units });
  } catch (error) {
    next(error);
  }
};

const createUnitHandler = async (req, res, next) => {
  try {
    if (!resolveValidation(req, res)) return;
    const unit = await createUnit({ actor: req.user, payload: req.body });
    res.status(201).json({ message: 'Unit created', unit });
  } catch (error) {
    mapError(error, res, next);
  }
};

const updateUnitHandler = async (req, res, next) => {
  try {
    if (!resolveValidation(req, res)) return;
    const unit = await updateUnit({ actor: req.user, id: Number(req.params.id), payload: req.body });
    res.json({ message: 'Unit updated', unit });
  } catch (error) {
    mapError(error, res, next);
  }
};

const getAttributes = async (req, res, next) => {
  try {
    const attributes = await listAttributes();
    res.json({ attributes });
  } catch (error) {
    next(error);
  }
};

const createAttributeHandler = async (req, res, next) => {
  try {
    if (!resolveValidation(req, res)) return;
    const attribute = await createAttribute({ actor: req.user, payload: req.body });
    res.status(201).json({ message: 'Attribute created', attribute });
  } catch (error) {
    mapError(error, res, next);
  }
};

const updateAttributeHandler = async (req, res, next) => {
  try {
    if (!resolveValidation(req, res)) return;
    const attribute = await updateAttribute({ actor: req.user, id: Number(req.params.id), payload: req.body });
    res.json({ message: 'Attribute updated', attribute });
  } catch (error) {
    mapError(error, res, next);
  }
};

const addAttributeValueHandler = async (req, res, next) => {
  try {
    if (!resolveValidation(req, res)) return;
    const value = await addAttributeValue({
      actor: req.user,
      attributeId: Number(req.params.id),
      payload: req.body,
    });
    res.status(201).json({ message: 'Attribute value added', value });
  } catch (error) {
    mapError(error, res, next);
  }
};

const getProducts = async (req, res, next) => {
  try {
    const products = await listProducts({ query: req.query });
    res.json({ products });
  } catch (error) {
    next(error);
  }
};

const createProductHandler = async (req, res, next) => {
  try {
    if (!resolveValidation(req, res)) return;
    const product = await createProduct({ actor: req.user, payload: req.body });
    res.status(201).json({ message: 'Product created', product });
  } catch (error) {
    mapError(error, res, next);
  }
};

const updateProductHandler = async (req, res, next) => {
  try {
    if (!resolveValidation(req, res)) return;
    const product = await updateProduct({
      actor: req.user,
      productId: Number(req.params.id),
      payload: req.body,
    });
    res.json({ message: 'Product updated', product });
  } catch (error) {
    mapError(error, res, next);
  }
};

const updateProductStatus = async (req, res, next) => {
  try {
    const product = await changeProductStatus({
      actor: req.user,
      productId: Number(req.params.id),
      isActive: req.body.isActive,
    });
    res.json({ message: 'Product status updated', product });
  } catch (error) {
    mapError(error, res, next);
  }
};

const getVariants = async (req, res, next) => {
  try {
    const variants = await listVariants({ query: req.query, actor: req.user });
    res.json({ variants });
  } catch (error) {
    mapError(error, res, next);
  }
};

const createVariantHandler = async (req, res, next) => {
  try {
    if (!resolveValidation(req, res)) return;
    const variant = await createVariant({ actor: req.user, payload: req.body });
    res.status(201).json({ message: 'Variant created', variant });
  } catch (error) {
    mapError(error, res, next);
  }
};

const updateVariantHandler = async (req, res, next) => {
  try {
    if (!resolveValidation(req, res)) return;
    const variant = await updateVariant({
      actor: req.user,
      variantId: Number(req.params.id),
      payload: req.body,
    });
    res.json({ message: 'Variant updated', variant });
  } catch (error) {
    mapError(error, res, next);
  }
};

const updateVariantStatus = async (req, res, next) => {
  try {
    const variant = await changeVariantStatus({
      actor: req.user,
      variantId: Number(req.params.id),
      isActive: req.body.isActive,
    });
    res.json({ message: 'Variant status updated', variant });
  } catch (error) {
    mapError(error, res, next);
  }
};

const getBranchSettings = async (req, res, next) => {
  try {
    const settings = await listBranchSettings({ query: req.query, actor: req.user });
    res.json({ settings });
  } catch (error) {
    mapError(error, res, next);
  }
};

const createBranchSettingHandler = async (req, res, next) => {
  try {
    if (!resolveValidation(req, res)) return;
    const setting = await createBranchSetting({ actor: req.user, payload: req.body });
    res.status(201).json({ message: 'Branch setting created', setting });
  } catch (error) {
    mapError(error, res, next);
  }
};

const updateBranchSettingHandler = async (req, res, next) => {
  try {
    if (!resolveValidation(req, res)) return;
    const setting = await updateBranchSetting({
      actor: req.user,
      settingId: Number(req.params.id),
      payload: req.body,
    });
    res.json({ message: 'Branch setting updated', setting });
  } catch (error) {
    mapError(error, res, next);
  }
};

const updateBranchSettingAvailability = async (req, res, next) => {
  try {
    const setting = await changeBranchSettingStatus({
      actor: req.user,
      settingId: Number(req.params.id),
      isAvailable: req.body.isAvailable,
    });
    res.json({ message: 'Branch setting availability updated', setting });
  } catch (error) {
    mapError(error, res, next);
  }
};

const searchProductsHandler = async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const products = await searchProducts({ q, limit: 10 });
    return res.json({ products });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
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
};