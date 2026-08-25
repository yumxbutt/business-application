const { Op } = require('sequelize');
const {
  Branch,
  Product,
  ProductCategory,
  ProductType,
  Unit,
  ProductUnit,
  ProductAttribute,
  ProductAttributeValue,
  ProductVariant,
  ProductBranchSetting,
} = require('../models');
const { ROLES } = require('../constants/roles');

const ensureManagerRole = (actor) => {
  if (![ROLES.MAIN_ADMIN, ROLES.BRANCH_ADMIN].includes(actor.role)) {
    throw new Error('Not allowed to manage product masters');
  }
};

const toCode = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);

const normalizeText = (value) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
};

const buildDefaultSku = (productId) => `PRD-${String(productId).padStart(6, '0')}`;
const buildDefaultBarcode = (productId) => `2${String(productId).padStart(12, '0')}`;
const buildVariantSku = (variantId) => `VAR-${String(variantId).padStart(6, '0')}`;
const buildVariantBarcode = (variantId) => `3${String(variantId).padStart(12, '0')}`;

const ensureGeneratedIdentifiers = async (product) => {
  let hasChanges = false;

  if (!product.sku) {
    let candidate = buildDefaultSku(product.id);
    let suffix = 1;
    while (await Product.findOne({ where: { sku: candidate, id: { [Op.ne]: product.id } } })) {
      candidate = `${buildDefaultSku(product.id)}-${suffix}`;
      suffix += 1;
    }
    product.sku = candidate;
    hasChanges = true;
  }

  if (!product.barcode) {
    let candidate = buildDefaultBarcode(product.id);
    let suffix = 1;
    while (await Product.findOne({ where: { barcode: candidate, id: { [Op.ne]: product.id } } })) {
      candidate = `${buildDefaultBarcode(product.id)}${suffix}`.slice(0, 80);
      suffix += 1;
    }
    product.barcode = candidate;
    hasChanges = true;
  }

  if (hasChanges) {
    await product.save();
  }
};

const ensureUniqueVariantFields = async ({ sku, barcode, excludeId = null }) => {
  if (sku) {
    const where = excludeId ? { sku, id: { [Op.ne]: excludeId } } : { sku };
    const existing = await ProductVariant.findOne({ where });
    if (existing) throw new Error('Variant SKU already exists');
  }
  if (barcode) {
    const where = excludeId ? { barcode, id: { [Op.ne]: excludeId } } : { barcode };
    const existing = await ProductVariant.findOne({ where });
    if (existing) throw new Error('Variant barcode already exists');
  }
};

const ensureGeneratedVariantIdentifiers = async (variant) => {
  let hasChanges = false;

  if (!variant.sku) {
    let candidate = buildVariantSku(variant.id);
    let suffix = 1;
    while (await ProductVariant.findOne({ where: { sku: candidate, id: { [Op.ne]: variant.id } } })) {
      candidate = `${buildVariantSku(variant.id)}-${suffix}`;
      suffix += 1;
    }
    variant.sku = candidate;
    hasChanges = true;
  }

  if (!variant.barcode) {
    let candidate = buildVariantBarcode(variant.id);
    let suffix = 1;
    while (await ProductVariant.findOne({ where: { barcode: candidate, id: { [Op.ne]: variant.id } } })) {
      candidate = `${buildVariantBarcode(variant.id)}${suffix}`.slice(0, 100);
      suffix += 1;
    }
    variant.barcode = candidate;
    hasChanges = true;
  }

  if (hasChanges) {
    await variant.save();
  }
};

const listCategories = async () => {
  return ProductCategory.findAll({
    include: [{ model: ProductCategory, as: 'parent', attributes: ['id', 'name', 'code'] }],
    order: [['name', 'ASC']],
  });
};

const createCategory = async ({ actor, payload }) => {
  ensureManagerRole(actor);
  const code = toCode(payload.code || payload.name);
  if (!code) throw new Error('Category code is required');

  const existing = await ProductCategory.findOne({ where: { code } });
  if (existing) throw new Error('Category code already exists');

  return ProductCategory.create({
    name: payload.name,
    code,
    parentId: payload.parentId || null,
    isActive: payload.isActive ?? true,
  });
};

const updateCategory = async ({ actor, id, payload }) => {
  ensureManagerRole(actor);
  const category = await ProductCategory.findByPk(id);
  if (!category) throw new Error('Category not found');

  if (payload.name !== undefined) category.name = payload.name;
  if (payload.code !== undefined) {
    const code = toCode(payload.code);
    const duplicate = await ProductCategory.findOne({ where: { code, id: { [Op.ne]: id } } });
    if (duplicate) throw new Error('Category code already exists');
    category.code = code;
  }
  if (payload.parentId !== undefined) category.parentId = payload.parentId || null;
  if (payload.isActive !== undefined) category.isActive = Boolean(payload.isActive);

  await category.save();
  return category;
};

const listTypes = async () => ProductType.findAll({ order: [['name', 'ASC']] });

const createType = async ({ actor, payload }) => {
  ensureManagerRole(actor);
  const code = toCode(payload.code || payload.name);
  if (!code) throw new Error('Type code is required');

  const existing = await ProductType.findOne({ where: { code } });
  if (existing) throw new Error('Type code already exists');

  return ProductType.create({ name: payload.name, code, isActive: payload.isActive ?? true });
};

const updateType = async ({ actor, id, payload }) => {
  ensureManagerRole(actor);
  const type = await ProductType.findByPk(id);
  if (!type) throw new Error('Type not found');

  if (payload.name !== undefined) type.name = payload.name;
  if (payload.code !== undefined) {
    const code = toCode(payload.code);
    const duplicate = await ProductType.findOne({ where: { code, id: { [Op.ne]: id } } });
    if (duplicate) throw new Error('Type code already exists');
    type.code = code;
  }
  if (payload.isActive !== undefined) type.isActive = Boolean(payload.isActive);

  await type.save();
  return type;
};

const listUnits = async () => Unit.findAll({ order: [['name', 'ASC']] });

const createUnit = async ({ actor, payload }) => {
  ensureManagerRole(actor);
  const code = toCode(payload.code || payload.name).slice(0, 20);
  if (!code) throw new Error('Unit code is required');

  const existing = await Unit.findOne({ where: { code } });
  if (existing) throw new Error('Unit code already exists');

  return Unit.create({ name: payload.name, code, isActive: payload.isActive ?? true });
};

const updateUnit = async ({ actor, id, payload }) => {
  ensureManagerRole(actor);
  const unit = await Unit.findByPk(id);
  if (!unit) throw new Error('Unit not found');

  if (payload.name !== undefined) unit.name = payload.name;
  if (payload.code !== undefined) {
    const code = toCode(payload.code).slice(0, 20);
    const duplicate = await Unit.findOne({ where: { code, id: { [Op.ne]: id } } });
    if (duplicate) throw new Error('Unit code already exists');
    unit.code = code;
  }
  if (payload.isActive !== undefined) unit.isActive = Boolean(payload.isActive);

  await unit.save();
  return unit;
};

const listAttributes = async () => {
  return ProductAttribute.findAll({
    include: [{ model: ProductAttributeValue, as: 'values', order: [['value', 'ASC']] }],
    order: [['name', 'ASC']],
  });
};

const createAttribute = async ({ actor, payload }) => {
  ensureManagerRole(actor);
  const code = toCode(payload.code || payload.name);
  if (!code) throw new Error('Attribute code is required');

  const existing = await ProductAttribute.findOne({ where: { code } });
  if (existing) throw new Error('Attribute code already exists');

  return ProductAttribute.create({
    name: payload.name,
    code,
    isActive: payload.isActive ?? true,
  });
};

const updateAttribute = async ({ actor, id, payload }) => {
  ensureManagerRole(actor);
  const attribute = await ProductAttribute.findByPk(id);
  if (!attribute) throw new Error('Attribute not found');

  if (payload.name !== undefined) attribute.name = payload.name;
  if (payload.code !== undefined) {
    const code = toCode(payload.code);
    const duplicate = await ProductAttribute.findOne({ where: { code, id: { [Op.ne]: id } } });
    if (duplicate) throw new Error('Attribute code already exists');
    attribute.code = code;
  }
  if (payload.isActive !== undefined) attribute.isActive = Boolean(payload.isActive);

  await attribute.save();
  return attribute;
};

const addAttributeValue = async ({ actor, attributeId, payload }) => {
  ensureManagerRole(actor);
  const attribute = await ProductAttribute.findByPk(attributeId);
  if (!attribute) throw new Error('Attribute not found');

  const code = toCode(payload.code || payload.value);
  if (!code) throw new Error('Attribute value code is required');

  const existing = await ProductAttributeValue.findOne({ where: { attributeId, code } });
  if (existing) throw new Error('Attribute value code already exists');

  return ProductAttributeValue.create({
    attributeId,
    value: payload.value,
    code,
    isActive: payload.isActive ?? true,
  });
};

const listProducts = async ({ query }) => {
  const where = {};

  if (query.search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${query.search}%` } },
      { sku: { [Op.like]: `%${query.search}%` } },
      { barcode: { [Op.like]: `%${query.search}%` } },
    ];
  }
  if (query.categoryId) where.categoryId = Number(query.categoryId);
  if (query.typeId) where.typeId = Number(query.typeId);
  if (query.isActive === 'true') where.isActive = true;
  if (query.isActive === 'false') where.isActive = false;

  return Product.findAll({
    where,
    include: [
      { model: ProductCategory, as: 'category', attributes: ['id', 'name', 'code'] },
      { model: ProductType, as: 'type', attributes: ['id', 'name', 'code'] },
      { model: Unit, as: 'defaultUnit', attributes: ['id', 'name', 'code'] },
      {
        model: ProductUnit,
        as: 'units',
        include: [{ model: Unit, as: 'unit', attributes: ['id', 'name', 'code'] }],
      },
    ],
    order: [['id', 'DESC']],
  });
};

const searchProducts = async ({ q = '', limit = 10 } = {}) => {
  const where = { isActive: true };
  if (q.trim()) {
    where[Op.or] = [
      { name: { [Op.like]: `%${q.trim()}%` } },
      { sku: { [Op.like]: `%${q.trim()}%` } },
      { barcode: { [Op.like]: `%${q.trim()}%` } },
    ];
  }
  return Product.findAll({
    where,
    attributes: ['id', 'name', 'sku', 'barcode', 'purchasePrice', 'salePrice'],
    include: [
      {
        model: ProductUnit,
        as: 'units',
        include: [{ model: Unit, as: 'unit', attributes: ['id', 'name', 'code'] }],
      },
    ],
    order: [['name', 'ASC']],
    limit: Number(limit) || 10,
  });
};

const normalizeUnits = (units = []) => {
  const seen = new Set();
  return units
    .filter((item) => item?.unitId)
    .map((item) => ({
      unitId: Number(item.unitId),
      conversionFactor: Number(item.conversionFactor || 1),
      isBaseUnit: Boolean(item.isBaseUnit),
      isPurchaseUnit: Boolean(item.isPurchaseUnit),
      isSaleUnit: Boolean(item.isSaleUnit),
    }))
    .filter((item) => {
      if (seen.has(item.unitId)) return false;
      seen.add(item.unitId);
      return true;
    });
};

const validateUnits = (units) => {
  if (!units || units.length === 0) return; // units are optional
  const baseUnits = units.filter((u) => u.isBaseUnit);
  if (baseUnits.length > 1) {
    throw new Error('Only one unit can be marked as the base unit');
  }
  const invalid = units.find((u) => u.conversionFactor <= 0);
  if (invalid) {
    throw new Error('All unit conversion factors must be greater than zero');
  }
  const ids = units.map((u) => u.unitId);
  if (new Set(ids).size !== ids.length) {
    throw new Error('Duplicate units are not allowed in the unit mapping');
  }
};

const applyBranchSettings = async (productId, branchIds) => {
  if (!Array.isArray(branchIds) || branchIds.length === 0) return;
  for (const id of branchIds) {
    await ProductBranchSetting.findOrCreate({
      where: { productId, branchId: Number(id) },
      defaults: { salePrice: null, reorderLevel: null, isAvailable: true },
    });
  }
};

// Sync branch settings on product update:
// - marks ALL existing settings isAvailable=false
// - then ensures each selected branch is present and isAvailable=true
// This preserves custom salePrice/reorderLevel for a branch if it is re-enabled later.
const syncBranchSettings = async (productId, branchIds) => {
  const activeIds = (branchIds || []).map(Number).filter(Boolean);

  // Deactivate all existing settings for this product
  await ProductBranchSetting.update({ isAvailable: false }, { where: { productId } });

  // Re-activate (or create) for selected branches
  for (const branchId of activeIds) {
    const [setting, created] = await ProductBranchSetting.findOrCreate({
      where: { productId, branchId },
      defaults: { salePrice: null, reorderLevel: null, isAvailable: true },
    });
    if (!created && !setting.isAvailable) {
      setting.isAvailable = true;
      await setting.save();
    }
  }
};

const ensureUniqueProductFields = async ({ sku, barcode, excludeId = null }) => {
  if (sku) {
    const where = excludeId ? { sku, id: { [Op.ne]: excludeId } } : { sku };
    const existing = await Product.findOne({ where });
    if (existing) throw new Error('SKU already exists');
  }
  if (barcode) {
    const where = excludeId ? { barcode, id: { [Op.ne]: excludeId } } : { barcode };
    const existing = await Product.findOne({ where });
    if (existing) throw new Error('Barcode already exists');
  }
};

const applyProductUnits = async (productId, units, defaultUnitId) => {
  await ProductUnit.destroy({ where: { productId } });
  if (!units?.length) return;

  const payload = units.map((item) => ({
    productId,
    unitId: item.unitId,
    conversionFactor: item.conversionFactor,
    isBaseUnit: item.isBaseUnit || item.unitId === defaultUnitId,
    isPurchaseUnit: item.isPurchaseUnit,
    isSaleUnit: item.isSaleUnit,
  }));

  await ProductUnit.bulkCreate(payload);
};

const createProduct = async ({ actor, payload }) => {
  ensureManagerRole(actor);
  const normalizedSku = normalizeText(payload.sku);
  const normalizedBarcode = normalizeText(payload.barcode);

  await ensureUniqueProductFields({ sku: normalizedSku, barcode: normalizedBarcode });

  const units = normalizeUnits(payload.units || []);
  validateUnits(units);
  const baseUnit = units.find((item) => item.isBaseUnit);
  const defaultUnitId = payload.defaultUnitId || baseUnit?.unitId || null;

  const product = await Product.create({
    name: payload.name,
    sku: normalizedSku,
    barcode: normalizedBarcode,
    categoryId: payload.categoryId || null,
    typeId: payload.typeId || null,
    defaultUnitId,
    description: payload.description || null,
    purchasePrice: payload.purchasePrice ?? 0,
    salePrice: payload.salePrice ?? 0,
    isActive: payload.isActive ?? true,
  });

  await ensureGeneratedIdentifiers(product);

  await applyProductUnits(product.id, units, defaultUnitId);
  await applyBranchSettings(product.id, payload.branchIds);

  return Product.findByPk(product.id, {
    include: [
      { model: ProductCategory, as: 'category', attributes: ['id', 'name', 'code'] },
      { model: ProductType, as: 'type', attributes: ['id', 'name', 'code'] },
      { model: Unit, as: 'defaultUnit', attributes: ['id', 'name', 'code'] },
      {
        model: ProductUnit,
        as: 'units',
        include: [{ model: Unit, as: 'unit', attributes: ['id', 'name', 'code'] }],
      },
    ],
  });
};

const updateProduct = async ({ actor, productId, payload }) => {
  ensureManagerRole(actor);
  const product = await Product.findByPk(productId);
  if (!product) throw new Error('Product not found');

  const nextSku = payload.sku !== undefined ? normalizeText(payload.sku) : product.sku;
  const nextBarcode = payload.barcode !== undefined ? normalizeText(payload.barcode) : product.barcode;

  await ensureUniqueProductFields({
    sku: nextSku,
    barcode: nextBarcode,
    excludeId: productId,
  });

  if (payload.name !== undefined) product.name = payload.name;
  if (payload.sku !== undefined) product.sku = nextSku;
  if (payload.barcode !== undefined) product.barcode = nextBarcode;
  if (payload.categoryId !== undefined) product.categoryId = payload.categoryId || null;
  if (payload.typeId !== undefined) product.typeId = payload.typeId || null;
  if (payload.defaultUnitId !== undefined) product.defaultUnitId = payload.defaultUnitId || null;
  if (payload.description !== undefined) product.description = payload.description || null;
  if (payload.purchasePrice !== undefined) product.purchasePrice = payload.purchasePrice;
  if (payload.salePrice !== undefined) product.salePrice = payload.salePrice;
  if (payload.isActive !== undefined) product.isActive = Boolean(payload.isActive);

  const units = payload.units !== undefined ? normalizeUnits(payload.units) : null;
  if (units) {
    validateUnits(units);
    if (units.length) {
      const baseUnit = units.find((item) => item.isBaseUnit);
      if (!payload.defaultUnitId && baseUnit?.unitId) {
        product.defaultUnitId = baseUnit.unitId;
      }
    }
  }

  await product.save();
  await ensureGeneratedIdentifiers(product);

  if (units) {
    await applyProductUnits(product.id, units, product.defaultUnitId);
  }
  if (payload.branchIds !== undefined) {
    await syncBranchSettings(product.id, payload.branchIds);
  }

  return Product.findByPk(product.id, {
    include: [
      { model: ProductCategory, as: 'category', attributes: ['id', 'name', 'code'] },
      { model: ProductType, as: 'type', attributes: ['id', 'name', 'code'] },
      { model: Unit, as: 'defaultUnit', attributes: ['id', 'name', 'code'] },
      {
        model: ProductUnit,
        as: 'units',
        include: [{ model: Unit, as: 'unit', attributes: ['id', 'name', 'code'] }],
      },
    ],
  });
};

const changeProductStatus = async ({ actor, productId, isActive }) => {
  ensureManagerRole(actor);
  const product = await Product.findByPk(productId);
  if (!product) throw new Error('Product not found');

  product.isActive = Boolean(isActive);
  await product.save();
  return product;
};

const getProductMeta = async () => {
  const [categories, types, units, attributes, branches] = await Promise.all([
    ProductCategory.findAll({ where: { isActive: true }, order: [['name', 'ASC']] }),
    ProductType.findAll({ where: { isActive: true }, order: [['name', 'ASC']] }),
    Unit.findAll({ where: { isActive: true }, order: [['name', 'ASC']] }),
    ProductAttribute.findAll({
      where: { isActive: true },
      include: [{ model: ProductAttributeValue, as: 'values', where: { isActive: true }, required: false }],
      order: [['name', 'ASC']],
    }),
    Branch.findAll({ where: { isActive: true }, order: [['name', 'ASC']] }),
  ]);

  return { categories, types, units, attributes, branches };
};

const listVariants = async ({ query, actor }) => {
  const where = {};
  if (query.productId) where.productId = Number(query.productId);
  if (query.isActive === 'true') where.isActive = true;
  if (query.isActive === 'false') where.isActive = false;

  ensureManagerRole(actor);

  return ProductVariant.findAll({
    where,
    include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'sku'] }],
    order: [['id', 'DESC']],
  });
};

const createVariant = async ({ actor, payload }) => {
  ensureManagerRole(actor);

  const productId = Number(payload.productId);
  const product = await Product.findByPk(productId);
  if (!product) throw new Error('Product not found');

  const sku = normalizeText(payload.sku);
  const barcode = normalizeText(payload.barcode);
  await ensureUniqueVariantFields({ sku, barcode });

  const variant = await ProductVariant.create({
    productId,
    sku,
    barcode,
    attributeValueIds: Array.isArray(payload.attributeValueIds)
      ? payload.attributeValueIds.map((item) => Number(item)).filter(Boolean)
      : [],
    purchasePrice: payload.purchasePrice ?? 0,
    salePrice: payload.salePrice ?? 0,
    isActive: payload.isActive ?? true,
  });

  await ensureGeneratedVariantIdentifiers(variant);

  return ProductVariant.findByPk(variant.id, {
    include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'sku'] }],
  });
};

const updateVariant = async ({ actor, variantId, payload }) => {
  ensureManagerRole(actor);

  const variant = await ProductVariant.findByPk(variantId);
  if (!variant) throw new Error('Variant not found');

  const nextSku = payload.sku !== undefined ? normalizeText(payload.sku) : variant.sku;
  const nextBarcode = payload.barcode !== undefined ? normalizeText(payload.barcode) : variant.barcode;

  await ensureUniqueVariantFields({ sku: nextSku, barcode: nextBarcode, excludeId: variantId });

  if (payload.productId !== undefined) {
    const product = await Product.findByPk(Number(payload.productId));
    if (!product) throw new Error('Product not found');
    variant.productId = Number(payload.productId);
  }
  if (payload.sku !== undefined) variant.sku = nextSku;
  if (payload.barcode !== undefined) variant.barcode = nextBarcode;
  if (payload.attributeValueIds !== undefined) {
    variant.attributeValueIds = Array.isArray(payload.attributeValueIds)
      ? payload.attributeValueIds.map((item) => Number(item)).filter(Boolean)
      : [];
  }
  if (payload.purchasePrice !== undefined) variant.purchasePrice = payload.purchasePrice;
  if (payload.salePrice !== undefined) variant.salePrice = payload.salePrice;
  if (payload.isActive !== undefined) variant.isActive = Boolean(payload.isActive);

  await variant.save();
  await ensureGeneratedVariantIdentifiers(variant);

  return ProductVariant.findByPk(variant.id, {
    include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'sku'] }],
  });
};

const changeVariantStatus = async ({ actor, variantId, isActive }) => {
  ensureManagerRole(actor);
  const variant = await ProductVariant.findByPk(variantId);
  if (!variant) throw new Error('Variant not found');

  variant.isActive = Boolean(isActive);
  await variant.save();
  return variant;
};

const listBranchSettings = async ({ query, actor }) => {
  const where = {};
  if (query.productId) where.productId = Number(query.productId);
  if (query.branchId) where.branchId = Number(query.branchId);

  if (actor.role === ROLES.BRANCH_ADMIN) {
    where.branchId = actor.branchId;
  } else {
    ensureManagerRole(actor);
  }

  return ProductBranchSetting.findAll({
    where,
    include: [
      { model: Product, as: 'product', attributes: ['id', 'name', 'sku'] },
      { model: Branch, as: 'branch', attributes: ['id', 'name', 'code'] },
    ],
    order: [['id', 'DESC']],
  });
};

const createBranchSetting = async ({ actor, payload }) => {
  ensureManagerRole(actor);

  const productId = Number(payload.productId);
  const product = await Product.findByPk(productId);
  if (!product) throw new Error('Product not found');

  const branchId = actor.role === ROLES.BRANCH_ADMIN ? actor.branchId : Number(payload.branchId);
  const branch = await Branch.findByPk(branchId);
  if (!branch) throw new Error('Branch not found');

  const existing = await ProductBranchSetting.findOne({ where: { productId, branchId } });
  if (existing) throw new Error('Branch setting already exists for this product and branch');

  return ProductBranchSetting.create({
    productId,
    branchId,
    salePrice: payload.salePrice ?? null,
    reorderLevel: payload.reorderLevel ?? null,
    isAvailable: payload.isAvailable ?? true,
  });
};

const updateBranchSetting = async ({ actor, settingId, payload }) => {
  ensureManagerRole(actor);

  const setting = await ProductBranchSetting.findByPk(settingId);
  if (!setting) throw new Error('Branch setting not found');
  if (actor.role === ROLES.BRANCH_ADMIN && setting.branchId !== actor.branchId) {
    throw new Error('Not allowed to update this branch setting');
  }

  if (payload.salePrice !== undefined) setting.salePrice = payload.salePrice;
  if (payload.reorderLevel !== undefined) setting.reorderLevel = payload.reorderLevel;
  if (payload.isAvailable !== undefined) setting.isAvailable = Boolean(payload.isAvailable);

  await setting.save();
  return setting;
};

const changeBranchSettingStatus = async ({ actor, settingId, isAvailable }) => {
  ensureManagerRole(actor);
  const setting = await ProductBranchSetting.findByPk(settingId);
  if (!setting) throw new Error('Branch setting not found');
  if (actor.role === ROLES.BRANCH_ADMIN && setting.branchId !== actor.branchId) {
    throw new Error('Not allowed to update this branch setting');
  }

  setting.isAvailable = Boolean(isAvailable);
  await setting.save();
  return setting;
};

module.exports = {
  applyBranchSettings,
  syncBranchSettings,
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
};