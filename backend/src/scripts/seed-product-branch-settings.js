/**
 * Seed ProductBranchSetting rows for existing products.
 *
 * For every combination of (active product × active branch) where no
 * ProductBranchSetting row exists yet, this script inserts a default row
 * with isAvailable = true so those products are visible in all branches.
 *
 * Usage:
 *   node backend/src/scripts/seed-product-branch-settings.js
 */

require('dotenv').config();
const sequelize = require('../config/database');
const { Product, Branch, ProductBranchSetting } = require('../models');

async function run() {
  await sequelize.authenticate();
  console.log('DB connected.');

  const [products, branches] = await Promise.all([
    Product.findAll({ where: { isActive: true }, attributes: ['id', 'name'] }),
    Branch.findAll({ where: { isActive: true }, attributes: ['id', 'name'] }),
  ]);

  console.log(`Found ${products.length} active products and ${branches.length} active branches.`);

  let created = 0;
  let skipped = 0;

  for (const product of products) {
    for (const branch of branches) {
      const [, wasCreated] = await ProductBranchSetting.findOrCreate({
        where: { productId: product.id, branchId: branch.id },
        defaults: {
          salePrice: null,
          reorderLevel: null,
          isAvailable: true,
        },
      });
      if (wasCreated) {
        created += 1;
      } else {
        skipped += 1;
      }
    }
  }

  console.log(`Done. Created: ${created}  Already existed (skipped): ${skipped}`);
  process.exit(0);
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
