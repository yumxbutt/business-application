/** Route-level role + access-right requirements (mirrors backend enforcement). */
export const ROUTE_ACCESS = {
  '/': { roles: ['main_admin', 'branch_admin', 'staff'] },
  '/sales': { roles: ['main_admin', 'branch_admin', 'staff'], rights: ['sales:read'] },
  '/sales/new': { roles: ['main_admin', 'branch_admin', 'staff'], rights: ['sales:create'] },
  '/pos': { roles: ['main_admin', 'branch_admin', 'staff'], rights: ['sales:create'] },
  '/sales-returns': { roles: ['main_admin', 'branch_admin', 'staff'], rights: ['sales:return'] },
  '/purchase': { roles: ['main_admin', 'branch_admin', 'staff'], rights: ['purchase:read'] },
  '/purchase/new': { roles: ['main_admin', 'branch_admin', 'staff'], rights: ['purchase:create'] },
  '/purchase-returns': { roles: ['main_admin', 'branch_admin', 'staff'], rights: ['purchase:return'] },
  '/inventory': { roles: ['main_admin', 'branch_admin', 'staff'], rights: ['inventory:read'] },
  '/fifo-stock-report': { roles: ['main_admin', 'branch_admin', 'staff'], rights: ['inventory:read'] },
  '/product-history': { roles: ['main_admin', 'branch_admin', 'staff'], rights: ['inventory:read'] },
  '/stock-transfers': { roles: ['main_admin', 'branch_admin', 'staff'], rights: ['inventory:read'] },
  '/reports': { roles: ['main_admin', 'branch_admin', 'staff'], rights: ['reports:sales', 'reports:purchase', 'reports:profit-loss', 'reports:ledger'] },
  '/reports/ledger': { roles: ['main_admin', 'branch_admin'], rights: ['reports:ledger'] },
  '/reports/sales': { roles: ['main_admin', 'branch_admin', 'staff'], rights: ['reports:sales'] },
  '/reports/purchase': { roles: ['main_admin', 'branch_admin', 'staff'], rights: ['reports:purchase'] },
  '/reports/profit-loss': { roles: ['main_admin', 'branch_admin', 'staff'], rights: ['reports:profit-loss'] },
  '/branches': { roles: ['main_admin'], rights: ['branch:read'] },
  '/expenses': { roles: ['main_admin', 'branch_admin', 'staff'], rights: ['expenses:read'] },
  '/products': { roles: ['main_admin', 'branch_admin', 'staff'], rights: ['product:read'] },
  '/products/categories': { roles: ['main_admin', 'branch_admin'], rights: ['product:masters'] },
  '/products/types': { roles: ['main_admin', 'branch_admin'], rights: ['product:masters'] },
  '/products/units': { roles: ['main_admin', 'branch_admin'], rights: ['product:masters'] },
  '/products/attributes': { roles: ['main_admin', 'branch_admin'], rights: ['product:masters'] },
  '/products/variants': { roles: ['main_admin', 'branch_admin'], rights: ['product:read'] },
  '/products/branch-settings': { roles: ['main_admin', 'branch_admin'], rights: ['product:masters'] },
  '/users': { roles: ['main_admin', 'branch_admin'], rights: ['users:read'] },
  '/access-rights': { roles: ['main_admin', 'branch_admin'], rights: ['users:access'] },
  '/contacts': { roles: ['main_admin', 'branch_admin', 'staff'], rights: ['financial:contacts:read'] },
  '/ledger': { roles: ['main_admin', 'branch_admin', 'staff'], rights: ['financial:ledger:read'] },
  '/receivables': { roles: ['main_admin', 'branch_admin', 'staff'], rights: ['financial:receivables:read'] },
  '/payables': { roles: ['main_admin', 'branch_admin', 'staff'], rights: ['financial:payables:read'] },
  '/cash-book': { roles: ['main_admin', 'branch_admin', 'staff'], rights: ['financial:cashbook:read'] },
  '/trading-ledger': { roles: ['main_admin', 'branch_admin', 'staff'], rights: ['financial:trading:read'] },
  '/cash-vouchers': { roles: ['main_admin', 'branch_admin', 'staff'], rights: ['financial:vouchers:read'] },
  '/settings/company': { roles: ['main_admin'], rights: ['financial:settings:update'] },
  '/settings/payment-accounts': { roles: ['main_admin', 'branch_admin'], rights: ['financial:payment-accounts:read'] },
  '/settings/account-heads': { roles: ['main_admin', 'branch_admin'], rights: ['financial:accounts:read'] },
  '/admin': { roles: ['main_admin'] },
  '/admin/login-activities': { roles: ['main_admin'] },
};

export function getRouteAccess(path) {
  return ROUTE_ACCESS[path] || { roles: ['main_admin', 'branch_admin', 'staff'] };
}

export function canSeeNavItem(user, item) {
  if (!user) return false;
  if (item.roles?.length && !item.roles.includes(user.role)) return false;
  if (user.role === 'main_admin') return true;
  if (!item.rights?.length) return true;
  const userRights = user.accessRights || [];
  return item.rights.some((right) => userRights.includes(right));
}
