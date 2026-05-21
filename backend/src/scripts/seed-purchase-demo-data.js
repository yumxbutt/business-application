require('dotenv').config();

const { connectDB, sequelize } = require('../config/database');
const { bootstrapDatabase } = require('../config/bootstrap');
const {
  Branch,
  User,
  Contact,
  Product,
  Purchase,
} = require('../models');
const purchaseService = require('../services/purchase.service');

const ensureProduct = async ({ name, sku, purchasePrice, salePrice }) => {
  const [product] = await Product.findOrCreate({
    where: { sku },
    defaults: {
      name,
      sku,
      purchasePrice,
      salePrice,
      isActive: true,
    },
  });
  return product;
};

const ensureSupplierContact = async ({ branchId, name, phone }) => {
  const [contact] = await Contact.findOrCreate({
    where: { branchId, name },
    defaults: {
      branchId,
      name,
      phone,
      recordType: 'supplier',
      openingBalance: 0,
      isActive: true,
    },
  });
  return contact;
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
    throw new Error('Required dependencies (branch/admin) not found.');
  }

  const contacts = [];
  contacts.push(await ensureSupplierContact({ branchId: branch.id, name: 'Demo Supplier Alpha', phone: '+92-300-9001001' }));
  contacts.push(await ensureSupplierContact({ branchId: branch.id, name: 'Demo Supplier Beta', phone: '+92-300-9001002' }));
  contacts.push(await ensureSupplierContact({ branchId: branch.id, name: 'Demo Supplier Gamma', phone: '+92-300-9001003' }));

  const products = [];
  products.push(await ensureProduct({ name: 'Demo Product A', sku: 'DEMO-PROD-A', purchasePrice: 120, salePrice: 165 }));
  products.push(await ensureProduct({ name: 'Demo Product B', sku: 'DEMO-PROD-B', purchasePrice: 85, salePrice: 130 }));
  products.push(await ensureProduct({ name: 'Demo Product C', sku: 'DEMO-PROD-C', purchasePrice: 210, salePrice: 280 }));
  products.push(await ensureProduct({ name: 'Demo Product D', sku: 'DEMO-PROD-D', purchasePrice: 65, salePrice: 98 }));

  const demoPurchases = [
    {
      billNo: 'DEMO-PUR-3001',
      contactId: contacts[0].id,
      purchaseDate: '2026-03-25',
      discount: 100,
      paidAmount: 300,
      items: [
        { productId: products[0].id, quantity: 12, unitPrice: 120 },
        { productId: products[1].id, quantity: 20, unitPrice: 85 },
      ],
    },
    {
      billNo: 'DEMO-PUR-3002',
      contactId: contacts[1].id,
      purchaseDate: '2026-03-28',
      discount: 50,
      paidAmount: 0,
      items: [
        { productId: products[2].id, quantity: 8, unitPrice: 210 },
        { productId: products[3].id, quantity: 30, unitPrice: 65 },
      ],
    },
    {
      billNo: 'DEMO-PUR-3003',
      contactId: contacts[2].id,
      purchaseDate: '2026-03-31',
      discount: 0,
      paidAmount: 500,
      items: [
        { productId: products[0].id, quantity: 10, unitPrice: 118 },
        { productId: products[2].id, quantity: 4, unitPrice: 212 },
        { productId: products[3].id, quantity: 25, unitPrice: 64 },
      ],
    },
  ];

  let createdCount = 0;
  for (const row of demoPurchases) {
    const exists = await Purchase.findOne({
      where: { branchId: branch.id, billNo: row.billNo },
    });

    if (exists) continue;

    await purchaseService.createPurchase({
      payload: {
        contactId: row.contactId,
        billNo: row.billNo,
        purchaseDate: row.purchaseDate,
        discount: row.discount,
        paidAmount: row.paidAmount,
        items: row.items,
      },
      actor: {
        id: actor.id,
        role: actor.role,
        branchId: actor.branchId,
      },
    });

    createdCount += 1;
  }

  const productCount = await Product.count({ where: { sku: ['DEMO-PROD-A', 'DEMO-PROD-B', 'DEMO-PROD-C', 'DEMO-PROD-D'] } });
  const contactCount = await Contact.count({ where: { branchId: branch.id, name: ['Demo Supplier Alpha', 'Demo Supplier Beta', 'Demo Supplier Gamma'] } });
  const purchaseCount = await Purchase.count({ where: { branchId: branch.id, billNo: ['DEMO-PUR-3001', 'DEMO-PUR-3002', 'DEMO-PUR-3003'] } });

  console.log('Purchase demo seed completed.');
  console.log(`Products available: ${productCount}`);
  console.log(`Supplier contacts available: ${contactCount}`);
  console.log(`Purchase records available: ${purchaseCount}`);
  console.log(`New purchases created in this run: ${createdCount}`);

  await sequelize.close();
  process.exit(0);
};

run().catch(async (error) => {
  console.error('Purchase demo seed failed:', error);
  try {
    await sequelize.close();
  } catch {
    // ignore close errors
  }
  process.exit(1);
});
