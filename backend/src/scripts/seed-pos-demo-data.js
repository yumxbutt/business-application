require('dotenv').config();

const { connectDB, sequelize } = require('../config/database');
const { bootstrapDatabase } = require('../config/bootstrap');
const {
  Branch,
  User,
  Contact,
  Product,
  ProductCategory,
  ProductType,
  Unit,
  ProductUnit,
  ProductBranchSetting,
  Purchase,
} = require('../models');
const purchaseService = require('../services/purchase.service');

const POS_CATEGORIES = [
  { name: 'Food', code: 'POS_FOOD' },
  { name: 'Beverages', code: 'POS_BEV' },
  { name: 'Mobile Accessories', code: 'POS_MOBILE' },
  { name: 'Snacks', code: 'POS_SNACKS' },
];

const POS_PRODUCTS = [
  { sku: 'POS-FOOD-001', barcode: '8901000001001', name: 'Chicken Burger', categoryCode: 'POS_FOOD', purchasePrice: 180, salePrice: 350, qty: 40 },
  { sku: 'POS-FOOD-002', barcode: '8901000001002', name: 'Beef Burger', categoryCode: 'POS_FOOD', purchasePrice: 220, salePrice: 420, qty: 35 },
  { sku: 'POS-FOOD-003', barcode: '8901000001003', name: 'Chicken Roll', categoryCode: 'POS_FOOD', purchasePrice: 120, salePrice: 250, qty: 50 },
  { sku: 'POS-FOOD-004', barcode: '8901000001004', name: 'French Fries', categoryCode: 'POS_FOOD', purchasePrice: 60, salePrice: 150, qty: 60 },
  { sku: 'POS-BEV-001', barcode: '8901000002001', name: 'Cola 500ml', categoryCode: 'POS_BEV', purchasePrice: 40, salePrice: 80, qty: 100 },
  { sku: 'POS-BEV-002', barcode: '8901000002002', name: 'Mineral Water 500ml', categoryCode: 'POS_BEV', purchasePrice: 20, salePrice: 40, qty: 120 },
  { sku: 'POS-BEV-003', barcode: '8901000002003', name: 'Fresh Lime', categoryCode: 'POS_BEV', purchasePrice: 35, salePrice: 90, qty: 45 },
  { sku: 'POS-BEV-004', barcode: '8901000002004', name: 'Tea Regular', categoryCode: 'POS_BEV', purchasePrice: 15, salePrice: 50, qty: 80 },
  { sku: 'POS-MOB-001', barcode: '8901000003001', name: 'USB-C Cable', categoryCode: 'POS_MOBILE', purchasePrice: 150, salePrice: 450, qty: 30 },
  { sku: 'POS-MOB-002', barcode: '8901000003002', name: 'Phone Case Universal', categoryCode: 'POS_MOBILE', purchasePrice: 200, salePrice: 599, qty: 25 },
  { sku: 'POS-MOB-003', barcode: '8901000003003', name: 'Tempered Glass', categoryCode: 'POS_MOBILE', purchasePrice: 80, salePrice: 250, qty: 40 },
  { sku: 'POS-MOB-004', barcode: '8901000003004', name: 'Power Bank 10000mAh', categoryCode: 'POS_MOBILE', purchasePrice: 1200, salePrice: 2499, qty: 15 },
  { sku: 'POS-SNK-001', barcode: '8901000004001', name: 'Chips Classic', categoryCode: 'POS_SNACKS', purchasePrice: 25, salePrice: 50, qty: 70 },
  { sku: 'POS-SNK-002', barcode: '8901000004002', name: 'Chocolate Bar', categoryCode: 'POS_SNACKS', purchasePrice: 45, salePrice: 90, qty: 55 },
  { sku: 'POS-SNK-003', barcode: '8901000004003', name: 'Biscuits Pack', categoryCode: 'POS_SNACKS', purchasePrice: 30, salePrice: 60, qty: 65 },
];

const ensureCategory = async ({ name, code }) => {
  const [row] = await ProductCategory.findOrCreate({
    where: { code },
    defaults: { name, code, isActive: true },
  });
  return row;
};

const ensureProduct = async ({
  name,
  sku,
  barcode,
  categoryId,
  typeId,
  unitId,
  purchasePrice,
  salePrice,
  branchIds,
}) => {
  let product = await Product.findOne({ where: { sku } });

  if (!product) {
    product = await Product.create({
      name,
      sku,
      barcode,
      categoryId,
      typeId,
      defaultUnitId: unitId,
      purchasePrice,
      salePrice,
      isActive: true,
      description: 'POS demo product',
    });
  } else {
    product.name = name;
    product.barcode = barcode || product.barcode;
    product.categoryId = categoryId;
    product.typeId = typeId;
    product.defaultUnitId = unitId;
    product.purchasePrice = purchasePrice;
    product.salePrice = salePrice;
    product.isActive = true;
    await product.save();
  }

  const existingUnit = await ProductUnit.findOne({ where: { productId: product.id, unitId } });
  if (!existingUnit) {
    await ProductUnit.create({
      productId: product.id,
      unitId,
      conversionFactor: 1,
      isBaseUnit: true,
      isPurchaseUnit: true,
      isSaleUnit: true,
    });
  }

  // Branch availability is optional for listing; still useful for settings screens.
  for (const branchId of branchIds) {
    await ProductBranchSetting.findOrCreate({
      where: { productId: product.id, branchId },
      defaults: { salePrice: null, reorderLevel: null, isAvailable: true },
    });
  }

  return product;
};

const run = async () => {
  const connected = await connectDB();
  if (!connected) {
    console.error('Seed aborted: database connection failed.');
    process.exit(1);
  }

  await bootstrapDatabase();

  const branch = await Branch.findOne({ where: { code: 'BR-001' } });
  const actor = await User.findOne({ where: { username: 'branch1admin' } });
  if (!branch || !actor) {
    throw new Error('Required branch/admin not found. Run bootstrap first.');
  }

  const pieceUnit = await Unit.findOne({ where: { code: 'PCS' } });
  if (!pieceUnit) throw new Error('PCS unit not found');

  const finishedType = await ProductType.findOne({ where: { code: 'FINISHED_GOODS' } });
  const categoryByCode = {};
  for (const cat of POS_CATEGORIES) {
    categoryByCode[cat.code] = await ensureCategory(cat);
  }

  const [supplier] = await Contact.findOrCreate({
    where: { branchId: branch.id, name: 'POS Demo Supplier' },
    defaults: {
      branchId: branch.id,
      name: 'POS Demo Supplier',
      phone: '+92-300-7007007',
      recordType: 'supplier',
      openingBalance: 0,
      isActive: true,
    },
  });

  const products = [];
  for (const row of POS_PRODUCTS) {
    const product = await ensureProduct({
      name: row.name,
      sku: row.sku,
      barcode: row.barcode,
      categoryId: categoryByCode[row.categoryCode].id,
      typeId: finishedType?.id || null,
      unitId: pieceUnit.id,
      purchasePrice: row.purchasePrice,
      salePrice: row.salePrice,
      branchIds: [branch.id],
    });
    products.push({ ...row, id: product.id, unitId: pieceUnit.id });
  }

  const billNo = 'POS-DEMO-STOCK-001';
  const existingPurchase = await Purchase.findOne({ where: { branchId: branch.id, billNo } });

  let stocked = false;
  if (!existingPurchase) {
    await purchaseService.createPurchase({
      payload: {
        contactId: supplier.id,
        billNo,
        purchaseDate: new Date().toISOString().slice(0, 10),
        discount: 0,
        paidAmount: 0,
        items: products.map((p) => ({
          productId: p.id,
          unitId: p.unitId,
          quantity: p.qty,
          unitPrice: p.purchasePrice,
          salePrice: p.salePrice,
        })),
      },
      actor: {
        id: actor.id,
        role: actor.role,
        branchId: actor.branchId,
      },
    });
    stocked = true;
  }

  console.log('POS demo seed completed.');
  console.log(`Categories: ${POS_CATEGORIES.length}`);
  console.log(`Products: ${products.length}`);
  console.log(`Stock purchase created: ${stocked ? 'yes' : 'already existed (' + billNo + ')'}`);
  console.log('Sample items: Chicken Burger, Cola 500ml, USB-C Cable, Chips Classic, ...');

  await sequelize.close();
  process.exit(0);
};

run().catch(async (error) => {
  console.error('POS demo seed failed:', error);
  try {
    await sequelize.close();
  } catch {
    // ignore
  }
  process.exit(1);
});
