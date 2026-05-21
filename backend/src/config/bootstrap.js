const bcrypt = require('bcryptjs');
const { QueryTypes } = require('sequelize');
const { sequelize } = require('./database');
const {
  Branch,
  User,
  Unit,
  ProductCategory,
  ProductType,
  Contact,
  AccountHead,
  PaymentAccount,
} = require('../models');
const { ROLES } = require('../constants/roles');

const ensureCoreTables = async ({ alter = false } = {}) => {
  await sequelize.sync(alter ? { alter: true } : undefined);

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS sale_return_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sale_return_id INT NOT NULL,
      sale_item_id INT NOT NULL,
      product_id INT NOT NULL,
      quantity DECIMAL(14,4) NOT NULL,
      unit_price DECIMAL(14,2) NOT NULL,
      line_amount DECIMAL(14,2) NOT NULL,
      notes TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sale_return_id) REFERENCES sale_returns(id) ON DELETE CASCADE,
      FOREIGN KEY (sale_item_id) REFERENCES sale_items(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // payment_accounts table
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS payment_accounts (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      branch_id BIGINT NULL,
      account_type ENUM('cash','bank') NOT NULL DEFAULT 'cash',
      account_head_id BIGINT NULL,
      name VARCHAR(150) NOT NULL,
      bank_name VARCHAR(150) NULL,
      account_number VARCHAR(100) NULL,
      bank_branch_name VARCHAR(150) NULL,
      opening_balance DECIMAL(18,2) NOT NULL DEFAULT 0,
      opening_date DATE NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // payment_transaction_splits table
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS payment_transaction_splits (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      payment_transaction_id BIGINT NOT NULL,
      payment_account_id BIGINT NOT NULL,
      account_head_id BIGINT NOT NULL,
      amount DECIMAL(18,2) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  const dialect = sequelize.getDialect();

  if (dialect === 'mysql') {
    const columnExists = async (columnName) => {
      const rows = await sequelize.query(
        `
        SELECT COUNT(*) AS cnt
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'sale_items'
          AND COLUMN_NAME = ?
        `,
        { type: QueryTypes.SELECT, replacements: [columnName] }
      );
      return Number(rows?.[0]?.cnt || 0) > 0;
    };

    if (!(await columnExists('source_branch_id'))) {
      await sequelize.query('ALTER TABLE sale_items ADD COLUMN source_branch_id INT NULL;');
    }
    if (!(await columnExists('unit_id'))) {
      await sequelize.query('ALTER TABLE sale_items ADD COLUMN unit_id INT NULL;');
    }
    if (!(await columnExists('unit_qty'))) {
      await sequelize.query('ALTER TABLE sale_items ADD COLUMN unit_qty DECIMAL(14,4) NULL;');
    }
    if (!(await columnExists('conversion_factor'))) {
      await sequelize.query('ALTER TABLE sale_items ADD COLUMN conversion_factor DECIMAL(14,6) NULL DEFAULT 1;');
    }
  }

  if (dialect === 'sqlite') {
    const cols = await sequelize.query(`PRAGMA table_info('sale_items');`, { type: QueryTypes.SELECT });
    const has = (name) => Array.isArray(cols) && cols.some((col) => col.name === name);
    if (!has('source_branch_id')) {
      await sequelize.query('ALTER TABLE sale_items ADD COLUMN source_branch_id INTEGER NULL;');
    }
    if (!has('unit_id')) {
      await sequelize.query('ALTER TABLE sale_items ADD COLUMN unit_id INTEGER NULL;');
    }
    if (!has('unit_qty')) {
      await sequelize.query('ALTER TABLE sale_items ADD COLUMN unit_qty DECIMAL(14,4) NULL;');
    }
    if (!has('conversion_factor')) {
      await sequelize.query('ALTER TABLE sale_items ADD COLUMN conversion_factor DECIMAL(14,6) NULL;');
    }
  }
};

const seedDefaults = async () => {
  const defaultBranch = await Branch.findOne({ where: { code: 'BR-001' } });
  let branch = defaultBranch;

  if (!branch) {
    branch = await Branch.create({
      name: 'Main Branch',
      code: 'BR-001',
      address: 'Primary business location',
      phone: '',
      isActive: true,
    });
  }

  const secondaryBranch = await Branch.findOne({ where: { code: 'BR-002' } });
  let branchTwo = secondaryBranch;

  if (!branchTwo) {
    branchTwo = await Branch.create({
      name: 'City Branch',
      code: 'BR-002',
      address: 'Secondary branch location',
      phone: '',
      isActive: true,
    });
  }

  const mainAdminExists = await User.findOne({ where: { username: 'mainadmin' } });
  if (!mainAdminExists) {
    await User.create({
      fullName: 'Main Admin',
      username: 'mainadmin',
      passwordHash: await bcrypt.hash('Admin@123', 10),
      role: ROLES.MAIN_ADMIN,
      branchId: null,
      accessRights: ['users:read', 'users:create', 'users:update', 'users:status'],
      isActive: true,
    });
  }

  const branchAdminExists = await User.findOne({ where: { username: 'branch1admin' } });
  if (!branchAdminExists) {
    await User.create({
      fullName: 'Branch One Admin',
      username: 'branch1admin',
      passwordHash: await bcrypt.hash('Branch@123', 10),
      role: ROLES.BRANCH_ADMIN,
      branchId: branch.id,
      accessRights: ['users:read', 'users:create', 'users:update', 'users:status'],
      isActive: true,
    });
  }

  const branchTwoAdminExists = await User.findOne({ where: { username: 'branch2admin' } });
  if (!branchTwoAdminExists) {
    await User.create({
      fullName: 'Branch Two Admin',
      username: 'branch2admin',
      passwordHash: await bcrypt.hash('Branch2@123', 10),
      role: ROLES.BRANCH_ADMIN,
      branchId: branchTwo.id,
      accessRights: ['users:read', 'users:create', 'users:update', 'users:status'],
      isActive: true,
    });
  }

  const staffExists = await User.findOne({ where: { username: 'staff1' } });
  if (!staffExists) {
    await User.create({
      fullName: 'Counter Staff',
      username: 'staff1',
      passwordHash: await bcrypt.hash('Staff@123', 10),
      role: ROLES.STAFF,
      branchId: branch.id,
      accessRights: ['users:read'],
      isActive: true,
    });
  }

  const defaultUnits = [
    { name: 'Piece', code: 'PCS' },
    { name: 'Box', code: 'BOX' },
    { name: 'Kilogram', code: 'KG' },
  ];

  for (const unitPayload of defaultUnits) {
    const exists = await Unit.findOne({ where: { code: unitPayload.code } });
    if (!exists) {
      await Unit.create({ ...unitPayload, isActive: true });
    }
  }

  const defaultCategories = [
    { name: 'General', code: 'GENERAL' },
    { name: 'Retail Items', code: 'RETAIL_ITEMS' },
  ];

  for (const categoryPayload of defaultCategories) {
    const exists = await ProductCategory.findOne({ where: { code: categoryPayload.code } });
    if (!exists) {
      await ProductCategory.create({ ...categoryPayload, isActive: true });
    }
  }

  const defaultTypes = [
    { name: 'Finished Goods', code: 'FINISHED_GOODS' },
    { name: 'Raw Material', code: 'RAW_MATERIAL' },
    { name: 'Service', code: 'SERVICE' },
  ];

  for (const typePayload of defaultTypes) {
    const exists = await ProductType.findOne({ where: { code: typePayload.code } });
    if (!exists) {
      await ProductType.create({ ...typePayload, isActive: true });
    }
  }

  // Seed Account Heads
  const defaultAccountHeads = [
    { name: 'Accounts Receivable', code: 'AR-001', type: 'receivable', description: 'Customer credit balances' },
    { name: 'Sales Revenue', code: 'INC-001', type: 'income', description: 'Revenue from sales' },
    { name: 'Cost of Goods Sold', code: 'EXP-001', type: 'expense', description: 'Purchase expenses' },
    { name: 'Accounts Payable', code: 'AP-001', type: 'payable', description: 'Supplier payment obligations' },
    { name: 'Cash', code: 'AST-001', type: 'cash', description: 'Cash on hand' },
    { name: 'Bank', code: 'AST-002', type: 'bank', description: 'Bank account balance' },
  ];

  for (const ahPayload of defaultAccountHeads) {
    const exists = await AccountHead.findOne({ where: { code: ahPayload.code } });
    if (!exists) {
      await AccountHead.create({ ...ahPayload, isActive: true });
    }
  }

  // Seed default Payment Accounts (one Cash per branch + one global Bank placeholder)
  const cashHead = await AccountHead.findOne({ where: { code: 'AST-001' } });
  const bankHead = await AccountHead.findOne({ where: { code: 'AST-002' } });
  const allBranches = await Branch.findAll({ where: { isActive: true } });

  for (const br of allBranches) {
    const existing = await PaymentAccount.findOne({
      where: { branchId: br.id, accountType: 'cash' },
    });
    if (!existing) {
      await PaymentAccount.create({
        branchId: br.id,
        accountType: 'cash',
        accountHeadId: cashHead?.id || null,
        name: 'Main Cash',
        openingBalance: 0,
        isActive: 1,
        sortOrder: 0,
      });
    }
  }

  // One global bank account placeholder (branchId = null → visible to all)
  const globalBankExists = await PaymentAccount.findOne({
    where: { branchId: null, accountType: 'bank' },
  });
  if (!globalBankExists && bankHead) {
    await PaymentAccount.create({
      branchId: null,
      accountType: 'bank',
      accountHeadId: bankHead.id,
      name: 'Bank Account',
      openingBalance: 0,
      isActive: 1,
      sortOrder: 1,
    });
  }

  // Seed sample Contacts
  const defaultContacts = [
    { name: 'ABC Wholesale Ltd.', phone: '+92-300-1234567', recordType: 'customer', openingBalance: 5000 },
    { name: 'XYZ Retail Store', phone: '+92-300-2345678', recordType: 'customer', openingBalance: 2500 },
    { name: 'Global Supplies Inc.', phone: '+92-300-3456789', recordType: 'supplier', openingBalance: 0 },
    { name: 'Premium Quality Materials', phone: '+92-300-4567890', recordType: 'supplier', openingBalance: 0 },
    { name: 'Multi Trade Co.', phone: '+92-300-5678901', recordType: 'both', openingBalance: 1000 },
  ];

  for (const contactPayload of defaultContacts) {
    const exists = await Contact.findOne({
      where: { branchId: branch.id, name: contactPayload.name },
    });
    if (!exists) {
      await Contact.create({
        branchId: branch.id,
        ...contactPayload,
        isActive: true,
      });
    }
  }
};

const bootstrapDatabase = async (options = {}) => {
  await ensureCoreTables(options);
  await seedDefaults();
};

module.exports = { bootstrapDatabase };
