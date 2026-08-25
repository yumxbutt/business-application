CREATE TABLE IF NOT EXISTS branches (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) UNIQUE NOT NULL,
  address TEXT,
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER REFERENCES branches(id),
  full_name VARCHAR(120) NOT NULL,
  username VARCHAR(60) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('main_admin', 'branch_admin', 'staff')),
  access_rights JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS login_activities (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  username_attempted VARCHAR(60),
  ip_address VARCHAR(64),
  user_agent TEXT,
  status VARCHAR(20) NOT NULL,
  reason VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS units (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  code VARCHAR(20) UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  sku VARCHAR(60) UNIQUE,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(80),
  default_unit_id INTEGER REFERENCES units(id),
  purchase_price NUMERIC(14,2) DEFAULT 0,
  sale_price NUMERIC(14,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_units (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  unit_id INTEGER REFERENCES units(id),
  conversion_factor NUMERIC(14,4) NOT NULL,
  is_base_unit BOOLEAN DEFAULT FALSE,
  is_purchase_unit BOOLEAN DEFAULT FALSE,
  is_sale_unit BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, unit_id)
);

CREATE TABLE IF NOT EXISTS inventory_balances (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER REFERENCES branches(id),
  product_id INTEGER REFERENCES products(id),
  quantity NUMERIC(14,4) DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(branch_id, product_id)
);

CREATE TABLE IF NOT EXISTS stock_transfers (
  id SERIAL PRIMARY KEY,
  from_branch_id INTEGER REFERENCES branches(id),
  to_branch_id INTEGER REFERENCES branches(id),
  transfer_date DATE NOT NULL,
  remarks TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER REFERENCES branches(id),
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(20),
  address TEXT,
  record_type VARCHAR(20) NOT NULL CHECK (record_type IN ('customer', 'supplier', 'both')),
  opening_balance NUMERIC(14,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER REFERENCES branches(id),
  contact_id INTEGER REFERENCES contacts(id),
  invoice_no VARCHAR(50) NOT NULL,
  sale_date DATE NOT NULL,
  sub_total NUMERIC(14,2) NOT NULL,
  discount NUMERIC(14,2) DEFAULT 0,
  additional_expenses_total NUMERIC(14,2) DEFAULT 0,
  additional_expenses TEXT,
  tax_mode VARCHAR(20) DEFAULT 'no_tax',
  tax_rate NUMERIC(8,4) DEFAULT 0,
  tax_amount NUMERIC(14,2) DEFAULT 0,
  total_amount NUMERIC(14,2) NOT NULL,
  paid_amount NUMERIC(14,2) DEFAULT 0,
  due_amount NUMERIC(14,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'draft',
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(branch_id, invoice_no)
);

CREATE TABLE IF NOT EXISTS purchases (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER REFERENCES branches(id),
  contact_id INTEGER REFERENCES contacts(id),
  bill_no VARCHAR(50) NOT NULL,
  purchase_date DATE NOT NULL,
  sub_total NUMERIC(14,2) NOT NULL,
  discount NUMERIC(14,2) DEFAULT 0,
  additional_expenses_total NUMERIC(14,2) DEFAULT 0,
  additional_expenses TEXT,
  total_amount NUMERIC(14,2) NOT NULL,
  paid_amount NUMERIC(14,2) DEFAULT 0,
  due_amount NUMERIC(14,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'draft',
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(branch_id, bill_no)
);

CREATE TABLE IF NOT EXISTS account_heads (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  code VARCHAR(30) UNIQUE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('cash', 'bank', 'expense', 'income', 'receivable', 'payable', 'asset', 'liability')),
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed core account heads required by the ledger system
INSERT INTO account_heads (name, code, type, description) VALUES
  ('Accounts Receivable', 'AR-001',  'receivable', 'Customer credit balances'),
  ('Sales Revenue',       'INC-001', 'income',     'Revenue from sales'),
  ('Cost of Goods Sold',  'EXP-001', 'expense',    'Purchase / cost expenses'),
  ('Accounts Payable',    'AP-001',  'payable',    'Supplier payment obligations'),
  ('Cash',                'AST-001', 'cash',       'Cash on hand'),
  ('Bank',                'AST-002', 'bank',       'Bank account balance')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS ledger_entries (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER REFERENCES branches(id),
  contact_id INTEGER REFERENCES contacts(id),
  account_head_id INTEGER REFERENCES account_heads(id),
  entry_date DATE NOT NULL,
  reference_type VARCHAR(50) NOT NULL,
  reference_id INTEGER,
  reference_no VARCHAR(50),
  description TEXT,
  debit NUMERIC(14,2) DEFAULT 0,
  credit NUMERIC(14,2) DEFAULT 0,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sale_items (
  id SERIAL PRIMARY KEY,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  source_branch_id INTEGER,
  unit_id INTEGER,
  unit_qty NUMERIC(14,4),
  conversion_factor NUMERIC(14,6) DEFAULT 1,
  quantity NUMERIC(14,4) NOT NULL,
  unit_price NUMERIC(14,2) NOT NULL,
  line_amount NUMERIC(14,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sale_item_batches (
  id SERIAL PRIMARY KEY,
  sale_item_id INTEGER NOT NULL,
  inventory_batch_id INTEGER NOT NULL,
  quantity_allocated NUMERIC(14,4) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id SERIAL PRIMARY KEY,
  purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  quantity NUMERIC(14,4) NOT NULL,
  unit_price NUMERIC(14,2) NOT NULL,
  line_amount NUMERIC(14,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sale_returns (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER REFERENCES branches(id),
  sale_id_reference INTEGER REFERENCES sales(id),
  contact_id INTEGER REFERENCES contacts(id),
  return_date DATE NOT NULL,
  total_amount NUMERIC(14,2) NOT NULL,
  reason TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sale_return_item_batches (
  id SERIAL PRIMARY KEY,
  sale_return_item_id INTEGER NOT NULL,
  inventory_batch_id INTEGER NOT NULL,
  quantity_allocated NUMERIC(14,4) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_returns (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER REFERENCES branches(id),
  purchase_id_reference INTEGER REFERENCES purchases(id),
  contact_id INTEGER REFERENCES contacts(id),
  return_date DATE NOT NULL,
  total_amount NUMERIC(14,2) NOT NULL,
  reason TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_transactions (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER REFERENCES branches(id),
  contact_id INTEGER REFERENCES contacts(id),
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('receipt', 'payment')),
  amount NUMERIC(14,2) NOT NULL,
  entry_date DATE NOT NULL,
  reference_no VARCHAR(50),
  description TEXT,
  payment_method VARCHAR(50),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER REFERENCES branches(id),
  contact_id INTEGER REFERENCES contacts(id),
  expense_date DATE NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  account_head_id INTEGER REFERENCES account_heads(id),
  category VARCHAR(100),
  description TEXT,
  receipt_no VARCHAR(50),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
