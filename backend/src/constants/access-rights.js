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
];

const getAllRightCodes = () => {
  return ACCESS_RIGHTS_CATALOG.flatMap((section) => section.rights.map((right) => right.code));
};

module.exports = {
  ACCESS_RIGHTS_CATALOG,
  getAllRightCodes,
};
