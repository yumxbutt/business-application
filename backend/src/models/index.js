const { Branch } = require('./branch.model');
const { User } = require('./user.model');
const { LoginActivity } = require('./login-activity.model');
const { ProductCategory } = require('./product-category.model');
const { ProductType } = require('./product-type.model');
const { Unit } = require('./unit.model');
const { Product } = require('./product.model');
const { ProductUnit } = require('./product-unit.model');
const { ProductAttribute } = require('./product-attribute.model');
const { ProductAttributeValue } = require('./product-attribute-value.model');
const { ProductVariant } = require('./product-variant.model');
const { ProductBranchSetting } = require('./product-branch-setting.model');
const { InventoryBalance } = require('./inventory-balance.model');
const { Contact } = require('./contact.model');
const { ContactBalance } = require('./contact-balance.model');
const { AccountHead } = require('./account-head.model');
const { LedgerEntry } = require('./ledger-entry.model');
const { Sale } = require('./sale.model');
const { SaleItem } = require('./sale-item.model');
const { SaleReturnItem } = require('./sale-return-item.model');
const { SaleItemBatch } = require('./sale-item-batch.model');
const { SaleReturnItemBatch } = require('./sale-return-item-batch.model');
const { Purchase } = require('./purchase.model');
const { PurchaseItem } = require('./purchase-item.model');
const { InventoryBatch } = require('./inventory-batch.model');
const { PurchaseReturnItem } = require('./purchase-return-item.model');
const { SaleReturn } = require('./sale-return.model');
const { PurchaseReturn } = require('./purchase-return.model');
const { PaymentTransaction } = require('./payment-transaction.model');
const { PaymentAccount } = require('./payment-account.model');
const { PaymentTransactionSplit } = require('./payment-transaction-split.model');
const { Expense } = require('./expense.model');
const { BranchOpeningBalance } = require('./branch-opening-balance.model');
const { CompanySettings } = require('./company-settings.model');

Branch.hasMany(User, { foreignKey: 'branch_id', as: 'users' });
User.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' });

User.hasMany(LoginActivity, { foreignKey: 'user_id', as: 'loginActivities' });
LoginActivity.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

ProductCategory.hasMany(ProductCategory, { foreignKey: 'parent_id', as: 'children' });
ProductCategory.belongsTo(ProductCategory, { foreignKey: 'parent_id', as: 'parent' });

ProductCategory.hasMany(Product, { foreignKey: 'category_id', as: 'products' });
Product.belongsTo(ProductCategory, { foreignKey: 'category_id', as: 'category' });

ProductType.hasMany(Product, { foreignKey: 'type_id', as: 'products' });
Product.belongsTo(ProductType, { foreignKey: 'type_id', as: 'type' });

Unit.hasMany(Product, { foreignKey: 'default_unit_id', as: 'defaultProducts' });
Product.belongsTo(Unit, { foreignKey: 'default_unit_id', as: 'defaultUnit' });

Product.hasMany(ProductUnit, { foreignKey: 'product_id', as: 'units' });
ProductUnit.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

Unit.hasMany(ProductUnit, { foreignKey: 'unit_id', as: 'productUnits' });
ProductUnit.belongsTo(Unit, { foreignKey: 'unit_id', as: 'unit' });

ProductAttribute.hasMany(ProductAttributeValue, { foreignKey: 'attribute_id', as: 'values' });
ProductAttributeValue.belongsTo(ProductAttribute, { foreignKey: 'attribute_id', as: 'attribute' });

Product.hasMany(ProductVariant, { foreignKey: 'product_id', as: 'variants' });
ProductVariant.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

Product.hasMany(ProductBranchSetting, { foreignKey: 'product_id', as: 'branchSettings' });
ProductBranchSetting.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

Branch.hasMany(ProductBranchSetting, { foreignKey: 'branch_id', as: 'productSettings' });
ProductBranchSetting.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' });

Branch.hasMany(InventoryBalance, { foreignKey: 'branch_id', as: 'inventoryBalances' });
InventoryBalance.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' });

Product.hasMany(InventoryBalance, { foreignKey: 'product_id', as: 'inventoryBalances' });
InventoryBalance.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// Contact associations
Branch.hasMany(Contact, { foreignKey: 'branch_id', as: 'contacts' });
Contact.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' });
Contact.hasOne(ContactBalance, { foreignKey: 'contact_id', as: 'balance' });
ContactBalance.belongsTo(Contact, { foreignKey: 'contact_id', as: 'contact' });

Branch.hasMany(ContactBalance, { foreignKey: 'branch_id', as: 'contactBalances' });
ContactBalance.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' });

// Ledger associations
Branch.hasMany(LedgerEntry, { foreignKey: 'branch_id', as: 'ledgerEntries' });
LedgerEntry.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' });

Contact.hasMany(LedgerEntry, { foreignKey: 'contact_id', as: 'ledgerEntries' });
LedgerEntry.belongsTo(Contact, { foreignKey: 'contact_id', as: 'contact' });

AccountHead.hasMany(LedgerEntry, { foreignKey: 'account_head_id', as: 'ledgerEntries' });
LedgerEntry.belongsTo(AccountHead, { foreignKey: 'account_head_id', as: 'accountHead' });

User.hasMany(LedgerEntry, { foreignKey: 'created_by', as: 'ledgerEntries' });
LedgerEntry.belongsTo(User, { foreignKey: 'created_by', as: 'createdBy' });

// Sales associations
Branch.hasMany(Sale, { foreignKey: 'branch_id', as: 'sales' });
Sale.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' });

Contact.hasMany(Sale, { foreignKey: 'contact_id', as: 'sales' });
Sale.belongsTo(Contact, { foreignKey: 'contact_id', as: 'contact' });

Sale.hasMany(SaleItem, { foreignKey: 'sale_id', as: 'items' });
SaleItem.belongsTo(Sale, { foreignKey: 'sale_id', as: 'sale' });

Product.hasMany(SaleItem, { foreignKey: 'product_id', as: 'saleItems' });
SaleItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

Unit.hasMany(SaleItem, { foreignKey: 'unit_id', as: 'saleItems' });
SaleItem.belongsTo(Unit, { foreignKey: 'unit_id', as: 'unit' });

Branch.hasMany(SaleItem, { foreignKey: 'source_branch_id', as: 'sourcedSaleItems' });
SaleItem.belongsTo(Branch, { foreignKey: 'source_branch_id', as: 'sourceBranch' });

User.hasMany(Sale, { foreignKey: 'created_by', as: 'sales' });
Sale.belongsTo(User, { foreignKey: 'created_by', as: 'createdBy' });

// Purchase associations
Branch.hasMany(Purchase, { foreignKey: 'branch_id', as: 'purchases' });
Purchase.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' });

Contact.hasMany(Purchase, { foreignKey: 'contact_id', as: 'purchases' });
Purchase.belongsTo(Contact, { foreignKey: 'contact_id', as: 'contact' });

Purchase.hasMany(PurchaseItem, { foreignKey: 'purchase_id', as: 'items' });
PurchaseItem.belongsTo(Purchase, { foreignKey: 'purchase_id', as: 'purchase' });

Product.hasMany(PurchaseItem, { foreignKey: 'product_id', as: 'purchaseItems' });
PurchaseItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

User.hasMany(Purchase, { foreignKey: 'created_by', as: 'purchases' });
Purchase.belongsTo(User, { foreignKey: 'created_by', as: 'createdBy' });

// InventoryBatch associations
Branch.hasMany(InventoryBatch, { foreignKey: 'branch_id', as: 'inventoryBatches' });
InventoryBatch.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' });

Product.hasMany(InventoryBatch, { foreignKey: 'product_id', as: 'batches' });
InventoryBatch.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

Purchase.hasMany(InventoryBatch, { foreignKey: 'purchase_id', as: 'batches' });
InventoryBatch.belongsTo(Purchase, { foreignKey: 'purchase_id', as: 'purchase' });

PurchaseItem.hasOne(InventoryBatch, { foreignKey: 'purchase_item_id', as: 'batch' });
InventoryBatch.belongsTo(PurchaseItem, { foreignKey: 'purchase_item_id', as: 'purchaseItem' });

// Sale Return associations
Branch.hasMany(SaleReturn, { foreignKey: 'branch_id', as: 'saleReturns' });
SaleReturn.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' });

Sale.hasMany(SaleReturn, { foreignKey: 'sale_id_reference', as: 'returns' });
SaleReturn.belongsTo(Sale, { foreignKey: 'sale_id_reference', as: 'sale' });

Contact.hasMany(SaleReturn, { foreignKey: 'contact_id', as: 'saleReturns' });
SaleReturn.belongsTo(Contact, { foreignKey: 'contact_id', as: 'contact' });

User.hasMany(SaleReturn, { foreignKey: 'created_by', as: 'saleReturns' });
SaleReturn.belongsTo(User, { foreignKey: 'created_by', as: 'createdBy' });

// SaleReturnItem associations
SaleReturn.hasMany(SaleReturnItem, { foreignKey: 'sale_return_id', as: 'items' });
SaleReturnItem.belongsTo(SaleReturn, { foreignKey: 'sale_return_id', as: 'saleReturn' });

SaleItem.hasMany(SaleReturnItem, { foreignKey: 'sale_item_id', as: 'returnItems' });
SaleReturnItem.belongsTo(SaleItem, { foreignKey: 'sale_item_id', as: 'saleItem' });

Product.hasMany(SaleReturnItem, { foreignKey: 'product_id', as: 'saleReturnItems' });
SaleReturnItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// Sales batch allocations (which InventoryBatch layers a sale/return consumed/restored)
SaleItem.hasMany(SaleItemBatch, { foreignKey: 'sale_item_id', as: 'batchAllocations' });
SaleItemBatch.belongsTo(SaleItem, { foreignKey: 'sale_item_id', as: 'saleItem' });

InventoryBatch.hasMany(SaleItemBatch, { foreignKey: 'inventory_batch_id', as: 'saleItemAllocations' });
SaleItemBatch.belongsTo(InventoryBatch, { foreignKey: 'inventory_batch_id', as: 'inventoryBatch' });

SaleReturnItem.hasMany(SaleReturnItemBatch, { foreignKey: 'sale_return_item_id', as: 'batchAllocations' });
SaleReturnItemBatch.belongsTo(SaleReturnItem, { foreignKey: 'sale_return_item_id', as: 'saleReturnItem' });

InventoryBatch.hasMany(SaleReturnItemBatch, { foreignKey: 'inventory_batch_id', as: 'saleReturnItemAllocations' });
SaleReturnItemBatch.belongsTo(InventoryBatch, { foreignKey: 'inventory_batch_id', as: 'inventoryBatch' });

// Purchase Return associations
Branch.hasMany(PurchaseReturn, { foreignKey: 'branch_id', as: 'purchaseReturns' });
PurchaseReturn.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' });

Purchase.hasMany(PurchaseReturn, { foreignKey: 'purchase_id_reference', as: 'returns' });
PurchaseReturn.belongsTo(Purchase, { foreignKey: 'purchase_id_reference', as: 'purchase' });

Contact.hasMany(PurchaseReturn, { foreignKey: 'contact_id', as: 'purchaseReturns' });
PurchaseReturn.belongsTo(Contact, { foreignKey: 'contact_id', as: 'contact' });

User.hasMany(PurchaseReturn, { foreignKey: 'created_by', as: 'purchaseReturns' });
PurchaseReturn.belongsTo(User, { foreignKey: 'created_by', as: 'createdBy' });

// PurchaseReturnItem associations
PurchaseReturn.hasMany(PurchaseReturnItem, { foreignKey: 'purchase_return_id', as: 'items' });
PurchaseReturnItem.belongsTo(PurchaseReturn, { foreignKey: 'purchase_return_id', as: 'purchaseReturn' });

PurchaseItem.hasMany(PurchaseReturnItem, { foreignKey: 'purchase_item_id', as: 'returnItems' });
PurchaseReturnItem.belongsTo(PurchaseItem, { foreignKey: 'purchase_item_id', as: 'purchaseItem' });

Product.hasMany(PurchaseReturnItem, { foreignKey: 'product_id', as: 'purchaseReturnItems' });
PurchaseReturnItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
PurchaseReturnItem.belongsTo(Unit, { foreignKey: 'unit_id', as: 'unit' });

// Payment associations
Branch.hasMany(PaymentTransaction, { foreignKey: 'branch_id', as: 'paymentTransactions' });
PaymentTransaction.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' });

Contact.hasMany(PaymentTransaction, { foreignKey: 'contact_id', as: 'paymentTransactions' });
PaymentTransaction.belongsTo(Contact, { foreignKey: 'contact_id', as: 'contact' });

User.hasMany(PaymentTransaction, { foreignKey: 'created_by', as: 'paymentTransactions' });
PaymentTransaction.belongsTo(User, { foreignKey: 'created_by', as: 'createdBy' });

// PaymentAccount associations
Branch.hasMany(PaymentAccount, { foreignKey: 'branch_id', as: 'paymentAccounts' });
PaymentAccount.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' });

AccountHead.hasMany(PaymentAccount, { foreignKey: 'account_head_id', as: 'paymentAccounts' });
PaymentAccount.belongsTo(AccountHead, { foreignKey: 'account_head_id', as: 'accountHead' });

// PaymentTransactionSplit associations
PaymentTransaction.hasMany(PaymentTransactionSplit, { foreignKey: 'payment_transaction_id', as: 'splits' });
PaymentTransactionSplit.belongsTo(PaymentTransaction, { foreignKey: 'payment_transaction_id', as: 'paymentTransaction' });

PaymentAccount.hasMany(PaymentTransactionSplit, { foreignKey: 'payment_account_id', as: 'splits' });
PaymentTransactionSplit.belongsTo(PaymentAccount, { foreignKey: 'payment_account_id', as: 'paymentAccount' });

AccountHead.hasMany(PaymentTransactionSplit, { foreignKey: 'account_head_id', as: 'paymentSplits' });
PaymentTransactionSplit.belongsTo(AccountHead, { foreignKey: 'account_head_id', as: 'accountHead' });

// Expense associations
Branch.hasMany(Expense, { foreignKey: 'branch_id', as: 'expenses' });
Expense.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' });

Contact.hasMany(Expense, { foreignKey: 'contact_id', as: 'expenses' });
Expense.belongsTo(Contact, { foreignKey: 'contact_id', as: 'contact' });

AccountHead.hasMany(Expense, { foreignKey: 'account_head_id', as: 'expenses' });
Expense.belongsTo(AccountHead, { foreignKey: 'account_head_id', as: 'accountHead' });

User.hasMany(Expense, { foreignKey: 'created_by', as: 'expenses' });
Expense.belongsTo(User, { foreignKey: 'created_by', as: 'createdBy' });

// Branch opening balance (one per branch, for trading register)
Branch.hasOne(BranchOpeningBalance, { foreignKey: 'branch_id', as: 'openingBalance' });
BranchOpeningBalance.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' });
BranchOpeningBalance.belongsTo(User, { foreignKey: 'set_by', as: 'setBy' });

module.exports = {
  Branch,
  User,
  LoginActivity,
  ProductCategory,
  ProductType,
  Unit,
  Product,
  ProductUnit,
  ProductAttribute,
  ProductAttributeValue,
  ProductVariant,
  ProductBranchSetting,
  InventoryBalance,
  Contact,
  ContactBalance,
  AccountHead,
  LedgerEntry,
  Sale,
  SaleItem,
  SaleReturnItem,
  SaleItemBatch,
  SaleReturnItemBatch,
  Purchase,
  PurchaseItem,
  InventoryBatch,
  PurchaseReturnItem,
  SaleReturn,
  PurchaseReturn,
  PaymentTransaction,
  PaymentAccount,
  PaymentTransactionSplit,
  Expense,
  BranchOpeningBalance,
  CompanySettings,
};
