const ACCESS_RIGHTS_CATALOG = [
  {
    module: 'users',
    label: 'User Management',
    rights: [
      { code: 'users:read', label: 'View users' },
      { code: 'users:create', label: 'Create users' },
      { code: 'users:update', label: 'Edit users' },
      { code: 'users:status', label: 'Activate/Deactivate users' },
      { code: 'users:access', label: 'Manage user access rights' },
    ],
  },
  {
    module: 'branch',
    label: 'Branch Management',
    rights: [
      { code: 'branch:read', label: 'View branches' },
      { code: 'branch:create', label: 'Create branches' },
      { code: 'branch:update', label: 'Edit branches' },
    ],
  },
  {
    module: 'product',
    label: 'Product Management',
    rights: [
      { code: 'product:read', label: 'View products' },
      { code: 'product:create', label: 'Create products' },
      { code: 'product:update', label: 'Edit products' },
      { code: 'product:status', label: 'Activate/Deactivate products' },
      { code: 'product:masters', label: 'Manage categories, types, units, attributes' },
    ],
  },
  {
    module: 'inventory',
    label: 'Inventory',
    rights: [
      { code: 'inventory:read', label: 'View inventory' },
      { code: 'inventory:transfer', label: 'Transfer stock' },
      { code: 'inventory:adjust', label: 'Adjust stock' },
    ],
  },
  {
    module: 'expenses',
    label: 'Expenses',
    rights: [
      { code: 'expenses:read', label: 'View expenses' },
      { code: 'expenses:create', label: 'Create expenses' },
      { code: 'expenses:cancel', label: 'Cancel expenses' },
    ],
  },
  {
    module: 'sales',
    label: 'Sales',
    rights: [
      { code: 'sales:read', label: 'View sales' },
      { code: 'sales:create', label: 'Create sales invoice' },
      { code: 'sales:return', label: 'Process sales return' },
    ],
  },
  {
    module: 'purchase',
    label: 'Purchase',
    rights: [
      { code: 'purchase:read', label: 'View purchases' },
      { code: 'purchase:create', label: 'Create purchase' },
      { code: 'purchase:return', label: 'Process purchase return' },
    ],
  },
  {
    module: 'reports',
    label: 'Reports',
    rights: [
      { code: 'reports:sales', label: 'Sales reports' },
      { code: 'reports:purchase', label: 'Purchase reports' },
      { code: 'reports:profit-loss', label: 'Profit/Loss reports' },
      { code: 'reports:ledger', label: 'Ledger reports' },
    ],
  },
  {
    module: 'financial',
    label: 'Financial & Ledger',
    rights: [
      { code: 'financial:contacts:read', label: 'View contacts' },
      { code: 'financial:contacts:create', label: 'Create and edit contacts' },
      { code: 'financial:ledger:read', label: 'View contact ledger' },
      { code: 'financial:receivables:read', label: 'View customer balances' },
      { code: 'financial:payables:read', label: 'View supplier balances' },
      { code: 'financial:cashbook:read', label: 'View cash book' },
      { code: 'financial:trading:read', label: 'View trading ledger' },
      { code: 'financial:vouchers:read', label: 'View cash vouchers' },
      { code: 'financial:vouchers:create', label: 'Create cash vouchers' },
      { code: 'financial:opening-balance', label: 'Set opening balances' },
      { code: 'financial:settings:read', label: 'View company settings' },
      { code: 'financial:settings:update', label: 'Update company settings' },
      { code: 'financial:payment-accounts:read', label: 'View payment accounts' },
      { code: 'financial:payment-accounts:manage', label: 'Manage payment accounts' },
      { code: 'financial:accounts:read', label: 'View chart of accounts' },
      { code: 'financial:accounts:create', label: 'Create account heads' },
      { code: 'financial:accounts:update', label: 'Edit account heads' },
    ],
  },
];

const getAllRightCodes = () => {
  return ACCESS_RIGHTS_CATALOG.flatMap((section) => section.rights.map((right) => right.code));
};

module.exports = {
  ACCESS_RIGHTS_CATALOG,
  getAllRightCodes,
};
