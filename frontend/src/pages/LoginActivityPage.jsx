import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageCard from '../components/ui/PageCard';
import { Select } from '../ui-kit';
import { authService } from '../services/authService';

const fmtDateTime = (value) => {
  if (!value) return '–';
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

export default function LoginActivityPage() {
  const [filters, setFilters] = useState({ status: '', username: '', page: 1, limit: 20 });
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadActivities = async (nextFilters = filters) => {
    setLoading(true);
    setError('');
    try {
      const data = await authService.getLoginActivities({
        page: nextFilters.page,
        limit: nextFilters.limit,
        status: nextFilters.status || undefined,
        username: nextFilters.username || undefined,
      });
      setItems(data.items || []);
      setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
    } catch (err) {
      setError(err.message || 'Failed to load login activities');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const applyFilters = () => {
    const next = { ...filters, page: 1 };
    setFilters(next);
    loadActivities(next);
  };

  const goToPage = (page) => {
    const next = { ...filters, page };
    setFilters(next);
    loadActivities(next);
  };

  return (
    <div className="dashboard-stack">
      <PageCard
        title="Login Activities"
        subtitle="Authentication audit trail"
        actions={
          <Link to="/admin" className="secondary-action-button">Back to Admin</Link>
        }
      >
        {error ? <p className="error-text">{error}</p> : null}

        <div className="table-filters no-print">
          <label className="form-field table-filters__search" htmlFor="loginUsername">
            <span>Username</span>
            <input
              id="loginUsername"
              type="text"
              value={filters.username}
              onChange={(e) => setFilters((p) => ({ ...p, username: e.target.value }))}
              placeholder="Filter by username"
            />
          </label>
          <label className="form-field" htmlFor="loginStatus">
            <span>Status</span>
            <Select
              id="loginStatus"
              value={filters.status}
              onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
              options={[
                { value: '', label: 'All' },
                { value: 'success', label: 'Success' },
                { value: 'failed', label: 'Failed' },
              ]}
            />
          </label>
          <button type="button" className="primary-action-button" style={{ alignSelf: 'flex-end' }} onClick={applyFilters}>
            Apply
          </button>
        </div>

        {loading ? (
          <p>Loading activities…</p>
        ) : (
          <>
            <div className="table-wrap table-wrap--full">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Username</th>
                    <th>User</th>
                    <th>Status</th>
                    <th>IP Address</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id}>
                      <td>{fmtDateTime(row.createdAt || row.created_at)}</td>
                      <td>{row.usernameAttempted || '–'}</td>
                      <td>{row.user?.fullName || row.user?.username || '–'}</td>
                      <td>
                        <span className={row.status === 'success' ? 'badge badge--green' : 'badge badge--red'}>
                          {row.status}
                        </span>
                      </td>
                      <td>{row.ipAddress || '–'}</td>
                      <td>{row.reason || '–'}</td>
                    </tr>
                  ))}
                  {items.length === 0 ? (
                    <tr><td colSpan="6" className="empty-state-cell">No login activities found.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {pagination.totalPages > 1 ? (
              <div className="inline-actions inline-actions--end no-print" style={{ marginTop: '1rem' }}>
                <button
                  type="button"
                  className="secondary-action-button"
                  disabled={pagination.page <= 1}
                  onClick={() => goToPage(pagination.page - 1)}
                >
                  Previous
                </button>
                <span className="view-note">
                  Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                </span>
                <button
                  type="button"
                  className="secondary-action-button"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => goToPage(pagination.page + 1)}
                >
                  Next
                </button>
              </div>
            ) : null}
          </>
        )}
      </PageCard>
    </div>
  );
}
