const bcrypt = require('bcryptjs');
const { QueryTypes, Op } = require('sequelize');
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
const { getAllRightCodes } = require('../constants/access-rights');
const { WALK_IN_CUSTOMER_NAME } = require('../constants/contacts');

const DEFAULT_BRANCH_ADMIN_RIGHTS = getAllRightCodes().filter(
  (code) => !['branch:create', 'branch:update'].includes(code)
);

const DEFAULT_STAFF_RIGHTS = [
  'product:read',
  'inventory:read',
  'inventory:transfer',
  'inventory:adjust',
  'sales:read',
  'sales:create',
  'sales:return',
  'purchase:read',
  'purchase:create',
  'purchase:return',
  'expenses:read',
  'expenses:create',
  'reports:sales',
  'reports:purchase',
  'reports:profit-loss',
  'reports:ledger',
  'users:read',
  'branch:read',
  'financial:contacts:read',
  'financial:contacts:create',
  'financial:ledger:read',
  'financial:receivables:read',
  'financial:payables:read',
  'financial:cashbook:read',
  'financial:trading:read',
  'financial:vouchers:read',
  'financial:vouchers:create',
  'financial:settings:read',
  'financial:payment-accounts:read',
];

const ensureDemoUserRights = async () => {
  const branchAdmins = await User.findAll({
    where: { username: { [Op.in]: ['branch1admin', 'branch2admin'] } },
  });
  for (const user of branchAdmins) {
    user.accessRights = DEFAULT_BRANCH_ADMIN_RIGHTS;
    await user.save();
  }

  const staff = await User.findOne({ where: { username: 'staff1' } });
  if (staff) {
    staff.accessRights = DEFAULT_STAFF_RIGHTS;
    await staff.save();
  }
};

const dialect = sequelize.getDialect();

const mysqlOnlyTableDefinitions = [
  `
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
  `,
  `
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
  `,
  `
    CREATE TABLE IF NOT EXISTS payment_transaction_splits (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      payment_transaction_id BIGINT NOT NULL,
      payment_account_id BIGINT NOT NULL,
      account_head_id BIGINT NOT NULL,
      amount DECIMAL(18,2) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,
];

const saleItemColumns = [
  {
    name: 'source_branch_id',
    mysqlSql: 'ALTER TABLE sale_items ADD COLUMN source_branch_id INT NULL;',
    sqliteSql: 'ALTER TABLE sale_items ADD COLUMN source_branch_id INTEGER NULL;',
  },
  {
    name: 'unit_id',
    mysqlSql: 'ALTER TABLE sale_items ADD COLUMN unit_id INT NULL;',
    sqliteSql: 'ALTER TABLE sale_items ADD COLUMN unit_id INTEGER NULL;',
  },
  {
    name: 'unit_qty',
    mysqlSql: 'ALTER TABLE sale_items ADD COLUMN unit_qty DECIMAL(14,4) NULL;',
    sqliteSql: 'ALTER TABLE sale_items ADD COLUMN unit_qty DECIMAL(14,4) NULL;',
  },
  {
    name: 'conversion_factor',
    mysqlSql: 'ALTER TABLE sale_items ADD COLUMN conversion_factor DECIMAL(14,6) NULL DEFAULT 1;',
    sqliteSql: 'ALTER TABLE sale_items ADD COLUMN conversion_factor DECIMAL(14,6) NULL;',
  },
];

const stockTransferColumns = [
  {
    tableName: 'stock_transfers',
    columns: [
      {
        name: 'transfer_no',
        mysqlSql: 'ALTER TABLE stock_transfers ADD COLUMN transfer_no VARCHAR(50) NULL;',
        sqliteSql: 'ALTER TABLE stock_transfers ADD COLUMN transfer_no VARCHAR(50) NULL;',
      },
      {
        name: 'status',
        mysqlSql: "ALTER TABLE stock_transfers ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'posted';",
        sqliteSql: "ALTER TABLE stock_transfers ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'posted';",
      },
    ],
  },
];

const accountHeadColumns = [
  {
    tableName: 'account_heads',
    columns: [
      {
        name: 'is_system',
        mysqlSql: 'ALTER TABLE account_heads ADD COLUMN is_system TINYINT(1) NOT NULL DEFAULT 0;',
        sqliteSql: 'ALTER TABLE account_heads ADD COLUMN is_system BOOLEAN NOT NULL DEFAULT 0;',
      },
    ],
  },
];

const companySettingsColumns = [
  {
    tableName: 'company_settings',
    columns: [
      {
        name: 'business_mode',
        mysqlSql: "ALTER TABLE company_settings ADD COLUMN business_mode VARCHAR(20) NOT NULL DEFAULT 'retail';",
        sqliteSql: "ALTER TABLE company_settings ADD COLUMN business_mode VARCHAR(20) NOT NULL DEFAULT 'retail';",
      },
      {
        name: 'cash_tax_rate',
        mysqlSql: 'ALTER TABLE company_settings ADD COLUMN cash_tax_rate DECIMAL(8,4) NOT NULL DEFAULT 0;',
        sqliteSql: 'ALTER TABLE company_settings ADD COLUMN cash_tax_rate DECIMAL(8,4) NOT NULL DEFAULT 0;',
      },
      {
        name: 'card_tax_rate',
        mysqlSql: 'ALTER TABLE company_settings ADD COLUMN card_tax_rate DECIMAL(8,4) NOT NULL DEFAULT 0;',
        sqliteSql: 'ALTER TABLE company_settings ADD COLUMN card_tax_rate DECIMAL(8,4) NOT NULL DEFAULT 0;',
      },
    ],
  },
];

const salesTaxColumns = [
  {
    tableName: 'sales',
    columns: [
      {
        name: 'tax_mode',
        mysqlSql: "ALTER TABLE sales ADD COLUMN tax_mode VARCHAR(20) NOT NULL DEFAULT 'no_tax';",
        sqliteSql: "ALTER TABLE sales ADD COLUMN tax_mode VARCHAR(20) NOT NULL DEFAULT 'no_tax';",
      },
      {
        name: 'tax_rate',
        mysqlSql: 'ALTER TABLE sales ADD COLUMN tax_rate DECIMAL(8,4) NOT NULL DEFAULT 0;',
        sqliteSql: 'ALTER TABLE sales ADD COLUMN tax_rate DECIMAL(8,4) NOT NULL DEFAULT 0;',
      },
      {
        name: 'tax_amount',
        mysqlSql: 'ALTER TABLE sales ADD COLUMN tax_amount DECIMAL(14,2) NOT NULL DEFAULT 0;',
        sqliteSql: 'ALTER TABLE sales ADD COLUMN tax_amount DECIMAL(14,2) NOT NULL DEFAULT 0;',
      },
    ],
  },
];

const documentExpenseColumns = [
  {
    tableName: 'expenses',
    columns: [
      {
        name: 'status',
        mysqlSql: "ALTER TABLE expenses ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'posted';",
        sqliteSql: "ALTER TABLE expenses ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'posted';",
      },
    ],
  },
  {
    tableName: 'sales',
    columns: [
      {
        name: 'additional_expenses_total',
        mysqlSql: 'ALTER TABLE sales ADD COLUMN additional_expenses_total DECIMAL(14,2) NOT NULL DEFAULT 0;',
        sqliteSql: 'ALTER TABLE sales ADD COLUMN additional_expenses_total DECIMAL(14,2) NOT NULL DEFAULT 0;',
      },
      {
        name: 'additional_expenses',
        mysqlSql: 'ALTER TABLE sales ADD COLUMN additional_expenses LONGTEXT NULL;',
        sqliteSql: 'ALTER TABLE sales ADD COLUMN additional_expenses TEXT NULL;',
      },
    ],
  },
  {
    tableName: 'purchases',
    columns: [
      {
        name: 'additional_expenses_total',
        mysqlSql: 'ALTER TABLE purchases ADD COLUMN additional_expenses_total DECIMAL(14,2) NOT NULL DEFAULT 0;',
        sqliteSql: 'ALTER TABLE purchases ADD COLUMN additional_expenses_total DECIMAL(14,2) NOT NULL DEFAULT 0;',
      },
      {
        name: 'additional_expenses',
        mysqlSql: 'ALTER TABLE purchases ADD COLUMN additional_expenses LONGTEXT NULL;',
        sqliteSql: 'ALTER TABLE purchases ADD COLUMN additional_expenses TEXT NULL;',
      },
    ],
  },
];

const ensureColumnExists = async (tableName, columnName) => {
  if (dialect === 'mysql') {
    const rows = await sequelize.query(
      `
      SELECT COUNT(*) AS cnt
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      `,
      { type: QueryTypes.SELECT, replacements: [tableName, columnName] }
    );
    return Number(rows?.[0]?.cnt || 0) > 0;
  }

  if (dialect === 'sqlite') {
    const rows = await sequelize.query(`PRAGMA table_info('${tableName}');`, { type: QueryTypes.SELECT });
    return Array.isArray(rows) && rows.some((row) => row.name === columnName);
  }

  return true;
};

const ensureMySqlOnlyTables = async () => {
  if (dialect !== 'mysql') {
    return;
  }

  for (const tableSql of mysqlOnlyTableDefinitions) {
    await sequelize.query(tableSql);
  }
};

const ensureSaleItemColumns = async () => {
  for (const column of saleItemColumns) {
    const exists = await ensureColumnExists('sale_items', column.name);
    if (!exists) {
      await sequelize.query(dialect === 'mysql' ? column.mysqlSql : column.sqliteSql);
    }
  }
};

const ensureDocumentExpenseColumns = async () => {
  for (const table of documentExpenseColumns) {
    for (const column of table.columns) {
      const exists = await ensureColumnExists(table.tableName, column.name);
      if (!exists) {
        await sequelize.query(dialect === 'mysql' ? column.mysqlSql : column.sqliteSql);
      }
    }
  }
};

const ensureStockTransferColumns = async () => {
  for (const table of stockTransferColumns) {
    for (const column of table.columns) {
      const exists = await ensureColumnExists(table.tableName, column.name);
      if (!exists) {
        await sequelize.query(dialect === 'mysql' ? column.mysqlSql : column.sqliteSql);
      }
    }
  }
};

const ensureAccountHeadColumns = async () => {
  for (const table of accountHeadColumns) {
    for (const column of table.columns) {
      const exists = await ensureColumnExists(table.tableName, column.name);
      if (!exists) {
        await sequelize.query(dialect === 'mysql' ? column.mysqlSql : column.sqliteSql);
      }
    }
  }
};

const ensureCompanySettingsColumns = async () => {
  for (const table of companySettingsColumns) {
    const tableExists = dialect === 'mysql'
      ? Number(
          (
            await sequelize.query(
              `
              SELECT COUNT(*) AS cnt
              FROM information_schema.TABLES
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
              `,
              { type: QueryTypes.SELECT, replacements: [table.tableName] }
            )
          )?.[0]?.cnt || 0
        ) > 0
      : true;

    if (!tableExists) continue;

    for (const column of table.columns) {
      const exists = await ensureColumnExists(table.tableName, column.name);
      if (!exists) {
        await sequelize.query(dialect === 'mysql' ? column.mysqlSql : column.sqliteSql);
      }
    }
  }
};

const ensureSalesTaxColumns = async () => {
  for (const table of salesTaxColumns) {
    for (const column of table.columns) {
      const exists = await ensureColumnExists(table.tableName, column.name);
      if (!exists) {
        await sequelize.query(dialect === 'mysql' ? column.mysqlSql : column.sqliteSql);
      }
    }
  }
};

const ensureCoreTables = async ({ alter = false } = {}) => {
  await sequelize.sync(alter ? { alter: true } : undefined);
  await ensureMySqlOnlyTables();
  await ensureSaleItemColumns();
  await ensureDocumentExpenseColumns();
  await ensureStockTransferColumns();
  await ensureAccountHeadColumns();
  await ensureCompanySettingsColumns();
  await ensureSalesTaxColumns();
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
      accessRights: ['users:read', 'users:create', 'users:update', 'users:status', 'users:access'],
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
      accessRights: DEFAULT_BRANCH_ADMIN_RIGHTS,
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
      accessRights: DEFAULT_BRANCH_ADMIN_RIGHTS,
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
      accessRights: DEFAULT_STAFF_RIGHTS,
      isActive: true,
    });
  }

  await ensureDemoUserRights();

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
    { name: 'Accounts Receivable', code: 'AR-001', type: 'receivable', description: 'Customer credit balances', isSystem: true },
    { name: 'Sales Revenue', code: 'INC-001', type: 'income', description: 'Revenue from sales', isSystem: true },
    { name: 'Cost of Goods Sold', code: 'EXP-001', type: 'expense', description: 'Purchase expenses', isSystem: true },
    { name: 'Accounts Payable', code: 'AP-001', type: 'payable', description: 'Supplier payment obligations', isSystem: true },
    { name: 'Cash', code: 'AST-001', type: 'cash', description: 'Cash on hand', isSystem: true },
    { name: 'Bank', code: 'AST-002', type: 'bank', description: 'Bank account balance', isSystem: true },
  ];

  for (const ahPayload of defaultAccountHeads) {
    const exists = await AccountHead.findOne({ where: { code: ahPayload.code } });
    if (!exists) {
      await AccountHead.create({ ...ahPayload, isActive: true });
    } else if (!exists.isSystem) {
      exists.isSystem = true;
      await exists.save();
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

  await ensureWalkInCustomers();
};

const ensureWalkInCustomers = async () => {
  const allBranches = await Branch.findAll({ where: { isActive: true } });
  for (const br of allBranches) {
    const exists = await Contact.findOne({
      where: { branchId: br.id, name: WALK_IN_CUSTOMER_NAME },
    });
    if (!exists) {
      await Contact.create({
        branchId: br.id,
        name: WALK_IN_CUSTOMER_NAME,
        recordType: 'customer',
        openingBalance: 0,
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
