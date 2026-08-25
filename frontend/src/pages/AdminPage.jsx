import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageCard from '../components/ui/PageCard';
import { useAuth } from '../context/AuthContext';
import { branchService } from '../services/branchService';
import { userService } from '../services/userService';
import { authService } from '../services/authService';

const adminLinks = [
  { to: '/settings/company', label: 'Company Settings', description: 'Branding and voucher footer' },
  { to: '/branches', label: 'Branches', description: 'Manage branch locations' },
  { to: '/users', label: 'Users', description: 'User accounts and roles' },
  { to: '/admin/login-activities', label: 'Login Activities', description: 'Authentication audit log' },
];

export default function AdminPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    branches: 0,
    activeBranches: 0,
    users: 0,
    activeUsers: 0,
    loginAttempts: 0,
    failedLogins: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      setError('');
      try {
        const [branches, users, loginData] = await Promise.all([
          branchService.getBranches(),
          userService.getUsers(),
          authService.getLoginActivities({ page: 1, limit: 1 }),
        ]);
        const failed = await authService.getLoginActivities({ page: 1, limit: 1, status: 'failed' }).catch(() => ({ pagination: { total: 0 } }));
        setStats({
          branches: branches.length,
          activeBranches: branches.filter((b) => b.isActive).length,
          users: users.length,
          activeUsers: users.filter((u) => u.isActive).length,
          loginAttempts: loginData.pagination?.total || 0,
          failedLogins: failed.pagination?.total || 0,
        });
      } catch (err) {
        setError(err.message || 'Failed to load admin summary');
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  return (
    <div className="dashboard-stack">
      <div className="page-stats-strip">
        <div className="page-stat-tile">
          <span className="page-stat-tile__label">Branches</span>
          <span className="page-stat-tile__value">{loading ? '…' : stats.branches}</span>
        </div>
        <div className="page-stat-tile page-stat-tile--success">
          <span className="page-stat-tile__label">Active Branches</span>
          <span className="page-stat-tile__value">{loading ? '…' : stats.activeBranches}</span>
        </div>
        <div className="page-stat-tile page-stat-tile--primary">
          <span className="page-stat-tile__label">Users</span>
          <span className="page-stat-tile__value">{loading ? '…' : stats.users}</span>
        </div>
        <div className="page-stat-tile page-stat-tile--purple">
          <span className="page-stat-tile__label">Active Users</span>
          <span className="page-stat-tile__value">{loading ? '…' : stats.activeUsers}</span>
        </div>
        <div className="page-stat-tile">
          <span className="page-stat-tile__label">Login Events</span>
          <span className="page-stat-tile__value">{loading ? '…' : stats.loginAttempts}</span>
        </div>
        <div className="page-stat-tile page-stat-tile--danger">
          <span className="page-stat-tile__label">Failed Logins</span>
          <span className="page-stat-tile__value">{loading ? '…' : stats.failedLogins}</span>
        </div>
      </div>

      <PageCard
        title="Administration"
        subtitle={user?.fullName ? `Signed in as ${user.fullName}` : 'Main admin controls'}
      >
        {error ? <p className="error-text">{error}</p> : null}
        <div className="quick-actions-grid">
          {adminLinks.map((item) => (
            <Link key={item.to} to={item.to} className="quick-action-card">
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </Link>
          ))}
        </div>
      </PageCard>
    </div>
  );
}
