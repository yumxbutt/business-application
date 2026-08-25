import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { canSeeNavItem } from '../config/routeAccessMap';
import ModalDialog from '../components/ui/ModalDialog';
import FormField from '../components/ui/FormField';

const navItems = [
  { to: '/', label: 'Dashboard' },
  {
    label: 'Sales',
    groupKey: 'sales',
    children: [
      { to: '/pos', label: 'POS Counter', roles: ['main_admin', 'branch_admin', 'staff'], rights: ['sales:create'] },
      { to: '/sales', label: 'Sales Invoices', roles: ['main_admin', 'branch_admin', 'staff'], rights: ['sales:read'] },
      { to: '/sales-returns', label: 'Sales Returns', roles: ['main_admin', 'branch_admin', 'staff'], rights: ['sales:return'] },
    ],
  },
  {
    label: 'Purchases',
    groupKey: 'purchase',
    children: [
      { to: '/purchase', label: 'Purchase Bills', roles: ['main_admin', 'branch_admin', 'staff'], rights: ['purchase:read'] },
      { to: '/purchase-returns', label: 'Purchase Returns', roles: ['main_admin', 'branch_admin', 'staff'], rights: ['purchase:return'] },
      { to: '/stock-transfers', label: 'Stock Transfers', roles: ['main_admin', 'branch_admin', 'staff'], rights: ['inventory:read'] },
      { to: '/fifo-stock-report', label: 'FIFO Stock Report', roles: ['main_admin', 'branch_admin', 'staff'], rights: ['inventory:read'] },
      { to: '/product-history', label: 'Product History', roles: ['main_admin', 'branch_admin', 'staff'], rights: ['inventory:read'] },
    ],
  },
  { to: '/inventory', label: 'Inventory', rights: ['inventory:read'] },
  {
    label: 'Contacts',
    groupKey: 'contact',
    children: [
      { to: '/contacts', label: 'All Contacts', roles: ['main_admin', 'branch_admin', 'staff'], rights: ['financial:contacts:read'] },
      { to: '/ledger', label: 'Ledger', roles: ['main_admin', 'branch_admin', 'staff'], rights: ['financial:ledger:read'] },
    ],
  },
  {
    label: 'Financial',
    groupKey: 'financial',
    children: [
      { to: '/cash-vouchers', label: 'Cash Vouchers', roles: ['main_admin', 'branch_admin', 'staff'], rights: ['financial:vouchers:read'] },
      { to: '/cash-book', label: 'Daily Cash Report', roles: ['main_admin', 'branch_admin', 'staff'], rights: ['financial:cashbook:read'] },
      { to: '/trading-ledger', label: 'Trading Ledger', roles: ['main_admin', 'branch_admin', 'staff'], rights: ['financial:trading:read'] },
      { to: '/expenses', label: 'Expenses', roles: ['main_admin', 'branch_admin', 'staff'], rights: ['expenses:read'] },
      { to: '/receivables', label: 'Customer Balances', roles: ['main_admin', 'branch_admin', 'staff'], rights: ['financial:receivables:read'] },
      { to: '/payables', label: 'Supplier Balances', roles: ['main_admin', 'branch_admin', 'staff'], rights: ['financial:payables:read'] },
    ],
  },
  {
    to: '/reports',
    label: 'Reports',
    rights: ['reports:sales', 'reports:purchase', 'reports:profit-loss', 'reports:ledger'],
  },
  { to: '/admin', label: 'Admin', roles: ['main_admin'] },
  {
    label: 'Settings',
    groupKey: 'settings',
    roles: ['main_admin', 'branch_admin'],
    children: [
      { to: '/settings/company', label: 'Company Settings', roles: ['main_admin'], rights: ['financial:settings:update'] },
      { to: '/settings/payment-accounts', label: 'Payment Accounts', roles: ['main_admin', 'branch_admin'], rights: ['financial:payment-accounts:read'] },
      { to: '/settings/account-heads', label: 'Chart of Accounts', roles: ['main_admin', 'branch_admin'], rights: ['financial:accounts:read'] },
      { to: '/branches', label: 'Branches', roles: ['main_admin'], rights: ['branch:read'] },
    ],
  },
  {
    label: 'Product Management',
    groupKey: 'product',
    placement: 'bottom',
    children: [
      { to: '/products', label: 'Products', roles: ['main_admin', 'branch_admin', 'staff'], rights: ['product:read'] },
      { to: '/products/categories', label: 'Product Categories', roles: ['main_admin', 'branch_admin'], rights: ['product:masters'] },
      { to: '/products/types', label: 'Product Types', roles: ['main_admin', 'branch_admin'], rights: ['product:masters'] },
      { to: '/products/units', label: 'Product Units', roles: ['main_admin', 'branch_admin'], rights: ['product:masters'] },
      { to: '/products/attributes', label: 'Product Attributes', roles: ['main_admin', 'branch_admin'], rights: ['product:masters'] },
      { to: '/products/variants', label: 'Product Variants', roles: ['main_admin', 'branch_admin'], rights: ['product:read'] },
      { to: '/products/branch-settings', label: 'Branch Settings', roles: ['main_admin', 'branch_admin'], rights: ['product:masters'] },
    ],
  },
  {
    label: 'User Management',
    groupKey: 'user',
    placement: 'bottom',
    roles: ['main_admin', 'branch_admin'],
    children: [
      { to: '/users', label: 'Users', roles: ['main_admin', 'branch_admin'], rights: ['users:read'] },
      { to: '/access-rights', label: 'Access Rights', roles: ['main_admin', 'branch_admin'], rights: ['users:access'] },
    ],
  },
];

export default function AppShell() {
  const { user, logout, updateProfile } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [groupOpen, setGroupOpen] = useState(() => ({
    sales: location.pathname.startsWith('/sales') || location.pathname.startsWith('/pos'),
    product: location.pathname.startsWith('/products'),
    user: location.pathname.startsWith('/users') || location.pathname.startsWith('/access-rights'),
    contact: location.pathname.startsWith('/contacts') || location.pathname.startsWith('/ledger'),
    financial: location.pathname.startsWith('/cash-vouchers') || location.pathname.startsWith('/cash-book') || location.pathname.startsWith('/trading-ledger') || location.pathname.startsWith('/expenses') || location.pathname.startsWith('/receivables') || location.pathname.startsWith('/payables'),
    purchase: location.pathname.startsWith('/purchase') || location.pathname.startsWith('/product-history') || location.pathname.startsWith('/stock-transfers') || location.pathname.startsWith('/fifo-stock-report'),
    settings: location.pathname.startsWith('/settings') || location.pathname.startsWith('/branches'),
  }));
  const [profileForm, setProfileForm] = useState({
    fullName: user?.fullName || '',
    currentPassword: '',
    newPassword: '',
  });

  useEffect(() => {
    if (location.pathname.startsWith('/products')) {
      setGroupOpen((prev) => ({ ...prev, product: true }));
    }
    if (location.pathname.startsWith('/sales') || location.pathname.startsWith('/pos')) {
      setGroupOpen((prev) => ({ ...prev, sales: true }));
    }
    if (location.pathname.startsWith('/users') || location.pathname.startsWith('/access-rights')) {
      setGroupOpen((prev) => ({ ...prev, user: true }));
    }
    if (location.pathname.startsWith('/contacts') || location.pathname.startsWith('/ledger')) {
      setGroupOpen((prev) => ({ ...prev, contact: true }));
    }
    if (location.pathname.startsWith('/purchase')) {
      setGroupOpen((prev) => ({ ...prev, purchase: true }));
    }
    if (location.pathname.startsWith('/fifo-stock-report')) {
      setGroupOpen((prev) => ({ ...prev, purchase: true }));
    }
    if (location.pathname.startsWith('/product-history')) {
      setGroupOpen((prev) => ({ ...prev, purchase: true }));
    }
    if (location.pathname.startsWith('/stock-transfers')) {
      setGroupOpen((prev) => ({ ...prev, purchase: true }));
    }
    if (location.pathname.startsWith('/cash-vouchers') || location.pathname.startsWith('/cash-book') || location.pathname.startsWith('/trading-ledger') || location.pathname.startsWith('/expenses') || location.pathname.startsWith('/receivables') || location.pathname.startsWith('/payables')) {
      setGroupOpen((prev) => ({ ...prev, financial: true }));
    }
    if (location.pathname.startsWith('/settings') || location.pathname.startsWith('/branches')) {
      setGroupOpen((prev) => ({ ...prev, settings: true }));
    }
  }, [location.pathname]);

  const toggleGroup = (key) =>
    setGroupOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  const visibleNavItems = useMemo(() => {
    return navItems
      .map((item) => {
        if (item.children) {
          const children = item.children.filter((child) => canSeeNavItem(user, child));
          if (!children.length) return null;
          if (item.roles && !item.roles.includes(user?.role)) return null;
          return { ...item, children };
        }

        if (!canSeeNavItem(user, item)) return null;
        return item;
      })
      .filter(Boolean);
  }, [user]);

  const primaryNavItems = useMemo(
    () => visibleNavItems.filter((item) => item.placement !== 'bottom'),
    [visibleNavItems],
  );
  const bottomNavItems = useMemo(
    () => visibleNavItems.filter((item) => item.placement === 'bottom'),
    [visibleNavItems],
  );

  const renderNavItem = (item) => {
    if (item.children) {
      const isGroupActive = item.children.some((child) => location.pathname === child.to);
      const isOpen = !!groupOpen[item.groupKey];
      return (
        <div key={item.groupKey} className="nav-group">
          <button
            type="button"
            className={`nav-group__toggle ${isGroupActive ? 'active' : ''}`}
            onClick={() => toggleGroup(item.groupKey)}
          >
            <span>{item.label}</span>
            <span className="nav-group__chevron">{isOpen ? '▾' : '▸'}</span>
          </button>
          {isOpen ? (
            <div className="nav-group__items">
              {item.children.map((child) => (
                <NavLink
                  key={child.to}
                  to={child.to}
                  className={({ isActive }) => (isActive ? 'active' : '')}
                >
                  {child.label}
                </NavLink>
              ))}
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.to === '/'}
        className={({ isActive }) => (isActive ? 'active' : '')}
      >
        {item.label}
      </NavLink>
    );
  };

  const openProfileModal = () => {
    setProfileError('');
    setMenuOpen(false);
    setProfileForm({
      fullName: user?.fullName || '',
      currentPassword: '',
      newPassword: '',
    });
    setProfileModalOpen(true);
  };

  const handleProfileChange = (event) => {
    const { name, value } = event.target;
    setProfileForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    setProfileError('');

    const payload = {
      fullName: profileForm.fullName,
    };

    if (profileForm.newPassword) {
      payload.currentPassword = profileForm.currentPassword;
      payload.newPassword = profileForm.newPassword;
    }

    try {
      await updateProfile(payload);
      setProfileModalOpen(false);
    } catch (error) {
      setProfileError(error.message || 'Unable to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="app-shell ui-root">
      <aside className="app-shell__sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">BMS</div>
          <div className="brand-copy">
            <strong>Business Management</strong>
            <span>Operations Suite</span>
          </div>
        </div>
        <nav className="sidebar-nav sidebar-nav--primary">
          {primaryNavItems.map(renderNavItem)}
        </nav>
        {bottomNavItems.length ? (
          <nav className="sidebar-nav sidebar-nav--bottom" aria-label="Masters">
            <p className="sidebar-nav__label">Masters</p>
            {bottomNavItems.map(renderNavItem)}
          </nav>
        ) : null}
        <div className="sidebar-profile">
          <button
            type="button"
            className="profile-button"
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            <span className="profile-button__avatar">
              {(user?.fullName || user?.username || 'U').slice(0, 1).toUpperCase()}
            </span>
            <span className="profile-button__meta">
              <strong>{user?.fullName || user?.username}</strong>
              <small>{user?.role?.replace('_', ' ')}</small>
            </span>
          </button>
          {menuOpen ? (
            <div className="profile-menu profile-menu--up">
              <button type="button" onClick={openProfileModal}>Update Profile</button>
              <button type="button" onClick={logout}>Logout</button>
            </div>
          ) : null}
        </div>
      </aside>

      <div className="app-shell__content">
        <main>
          <Outlet />
        </main>
      </div>

      {profileModalOpen ? (
        <ModalDialog
          title="Update Profile"
          subtitle="Edit your details and password"
          onClose={() => setProfileModalOpen(false)}
        >
          <form className="auth-form" onSubmit={handleProfileSubmit}>
            <FormField
              label="Full Name"
              name="fullName"
              value={profileForm.fullName}
              onChange={handleProfileChange}
              required
            />
            <FormField
              label="Current Password"
              name="currentPassword"
              type="password"
              value={profileForm.currentPassword}
              onChange={handleProfileChange}
              placeholder="Required only when changing password"
            />
            <FormField
              label="New Password"
              name="newPassword"
              type="password"
              value={profileForm.newPassword}
              onChange={handleProfileChange}
              placeholder="Leave empty to keep current password"
            />
            {profileError ? <p className="error-text">{profileError}</p> : null}
            <div className="inline-actions inline-actions--end">
              <button
                type="button"
                className="secondary-action-button"
                onClick={() => setProfileModalOpen(false)}
              >
                Cancel
              </button>
              <button type="submit" className="primary-action-button" disabled={savingProfile}>
                {savingProfile ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </ModalDialog>
      ) : null}
    </div>
  );
}
