import { useEffect, useMemo, useState } from 'react';
import PageCard from '../components/ui/PageCard';
import { userService } from '../services/userService';
import { accessRightsService } from '../services/accessRightsService';
import { useAuth } from '../context/AuthContext';

export default function AccessRightsPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRights, setSelectedRights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const selectedUser = useMemo(
    () => users.find((item) => String(item.id) === String(selectedUserId)),
    [users, selectedUserId]
  );

  const loadPageData = async () => {
    setLoading(true);
    setError('');

    try {
      const [usersData, catalogData] = await Promise.all([
        userService.getUsers(),
        accessRightsService.getCatalog(),
      ]);

      setUsers(usersData);
      setCatalog(catalogData);

      if (usersData.length > 0) {
        const firstUser = usersData[0];
        setSelectedUserId(String(firstUser.id));
        setSelectedRights(firstUser.accessRights || []);
      }
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPageData();
  }, []);

  const onSelectUser = (nextUserId) => {
    setSelectedUserId(nextUserId);
    const target = users.find((item) => String(item.id) === String(nextUserId));
    setSelectedRights(target?.accessRights || []);
    setMessage('');
  };

  const toggleRight = (code) => {
    setSelectedRights((prev) => {
      if (prev.includes(code)) return prev.filter((item) => item !== code);
      return [...prev, code];
    });
  };

  const onSave = async () => {
    if (!selectedUserId) return;

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const updated = await accessRightsService.updateUserRights(selectedUserId, selectedRights);
      setUsers((prev) =>
        prev.map((item) => (item.id === updated.id ? { ...item, accessRights: updated.accessRights || [] } : item))
      );
      setMessage('Access rights updated successfully.');
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dashboard-stack">
      <PageCard
        title="Access Rights"
        subtitle="Assign module-wise permissions using checklist controls"
        actions={
          <button type="button" className="primary-action-button" onClick={onSave} disabled={!selectedUserId || saving}>
            {saving ? 'Saving...' : 'Save Rights'}
          </button>
        }
      >
        {loading ? <p>Loading access rights...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
        {message ? <p className="success-text">{message}</p> : null}

        <div className="inline-filter inline-filter--space-between rights-toolbar">
          <label className="form-field rights-user-select" htmlFor="selectedUserId">
            <span>Select User</span>
            <select
              id="selectedUserId"
              value={selectedUserId}
              onChange={(event) => onSelectUser(event.target.value)}
            >
              <option value="">Select user</option>
              {users.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.fullName} ({item.username})
                </option>
              ))}
            </select>
          </label>

          <div className="rights-meta">
            <span className="badge badge--soft">{selectedRights.length} selected</span>
            <span className="badge">{selectedUser?.role || user?.role || '-'}</span>
          </div>
        </div>

        <div className="rights-grid">
          {catalog.map((section) => (
            <section key={section.module} className="rights-section">
              <header className="rights-section__header">
                <h3>{section.label}</h3>
                <span>{section.rights.length} rights</span>
              </header>

              <div className="rights-checklist">
                {section.rights.map((right) => (
                  <label key={right.code} className="rights-check-item">
                    <input
                      type="checkbox"
                      checked={selectedRights.includes(right.code)}
                      onChange={() => toggleRight(right.code)}
                      disabled={!selectedUserId}
                    />
                    <div>
                      <strong>{right.label}</strong>
                      <small>{right.code}</small>
                    </div>
                  </label>
                ))}
              </div>
            </section>
          ))}
        </div>
      </PageCard>
    </div>
  );
}
