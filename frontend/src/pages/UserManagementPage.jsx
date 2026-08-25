import { useEffect, useMemo, useState } from 'react';
import PageCard from '../components/ui/PageCard';
import { Button, Select } from '../ui-kit';
import FormField from '../components/ui/FormField';
import ModalDialog from '../components/ui/ModalDialog';
import ToggleSwitch from '../components/ui/ToggleSwitch';
import { userService } from '../services/userService';
import { branchService } from '../services/branchService';
import { useAuth } from '../context/AuthContext';
import { useAccess } from '../hooks/useAccess';

const roleOptions = [
  { value: 'branch_admin', label: 'Branch Admin' },
  { value: 'staff', label: 'Staff' },
  { value: 'main_admin', label: 'Main Admin' },
];

const defaultForm = {
  fullName: '',
  username: '',
  password: '',
  role: 'staff',
  branchId: '',
  accessRights: 'users:read',
};

export default function UserManagementPage() {
  const { user } = useAuth();
  const { has } = useAccess();
  const canCreateUser = has('users:create');
  const canUpdateUser = has('users:update');
  const canToggleUserStatus = has('users:status');
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [formData, setFormData] = useState(defaultForm);
  const [editingId, setEditingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canManageAllBranches = user?.role === 'main_admin';

  const normalizedRoleOptions = useMemo(() => {
    if (canManageAllBranches) return roleOptions;
    return roleOptions.filter((option) => option.value !== 'main_admin');
  }, [canManageAllBranches]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return users.filter((record) => {
      const matchesSearch =
        !normalizedSearch ||
        record.fullName?.toLowerCase().includes(normalizedSearch) ||
        record.username?.toLowerCase().includes(normalizedSearch) ||
        record.branch?.name?.toLowerCase().includes(normalizedSearch);

      const matchesRole = roleFilter === 'all' || record.role === roleFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' ? record.isActive : !record.isActive);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  const loadUsers = async (branchId) => {
    setLoading(true);
    setError('');
    try {
      const data = await userService.getUsers(branchId);
      setUsers(data);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  const loadBranches = async () => {
    try {
      const data = await branchService.getBranches();
      setBranches(data);
      if (!canManageAllBranches && data[0]) {
        setFormData((prev) => ({ ...prev, branchId: String(data[0].id) }));
      }
    } catch (loadError) {
      setError(loadError.message);
    }
  };

  useEffect(() => {
    loadBranches();
    loadUsers();
  }, []);

  const onChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData((prev) => ({
      ...defaultForm,
      branchId: canManageAllBranches ? '' : prev.branchId,
    }));
    setEditingId(null);
    setIsModalOpen(false);
  };

  const openCreateModal = () => {
    setError('');
    setEditingId(null);
    setFormData((prev) => ({
      ...defaultForm,
      branchId: canManageAllBranches ? '' : prev.branchId,
    }));
    setIsModalOpen(true);
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const payload = {
      fullName: formData.fullName,
      username: formData.username,
      role: formData.role,
      branchId: formData.branchId ? Number(formData.branchId) : null,
      accessRights: formData.accessRights
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    };

    if (formData.password) payload.password = formData.password;

    try {
      if (editingId) {
        await userService.updateUser(editingId, payload);
      } else {
        await userService.createUser(payload);
      }
      resetForm();
      await loadUsers(selectedBranch || undefined);
    } catch (submitError) {
      setError(submitError.message);
    }
  };

  const onEdit = (record) => {
    setError('');
    setEditingId(record.id);
    setFormData({
      fullName: record.fullName,
      username: record.username,
      password: '',
      role: record.role,
      branchId: record.branchId ? String(record.branchId) : '',
      accessRights: (record.accessRights || []).join(', '),
    });
    setIsModalOpen(true);
  };

  const onToggleStatus = async (record) => {
    try {
      await userService.updateStatus(record.id, !record.isActive);
      await loadUsers(selectedBranch || undefined);
    } catch (toggleError) {
      setError(toggleError.message);
    }
  };

  return (
    <div className="dashboard-stack">
      <div className="page-stats-strip">
        <div className="page-stat-tile">
          <span className="page-stat-tile__label">Total Users</span>
          <span className="page-stat-tile__value">{users.length}</span>
        </div>
        <div className="page-stat-tile page-stat-tile--success">
          <span className="page-stat-tile__label">Active</span>
          <span className="page-stat-tile__value">{users.filter((u) => u.isActive).length}</span>
        </div>
        <div className="page-stat-tile page-stat-tile--danger">
          <span className="page-stat-tile__label">Inactive</span>
          <span className="page-stat-tile__value">{users.filter((u) => !u.isActive).length}</span>
        </div>
        <div className="page-stat-tile page-stat-tile--purple">
          <span className="page-stat-tile__label">Admins</span>
          <span className="page-stat-tile__value">{users.filter((u) => u.role === 'main_admin' || u.role === 'branch_admin').length}</span>
        </div>
      </div>
      <PageCard
        title="User Management"
        subtitle="Manage branch users and access rights"
        actions={
          canCreateUser ? (
            <Button type="button" variant="primary" onClick={openCreateModal}>
              Add New User
            </Button>
          ) : null
        }
      >
        {canManageAllBranches ? (
          <div className="inline-filter inline-filter--space-between">
            <label htmlFor="branchFilter">Branch</label>
            <Select
              id="branchFilter"
              value={selectedBranch}
              onChange={(event) => {
                const value = event.target.value;
                setSelectedBranch(value);
                loadUsers(value || undefined);
              }}
              options={[{ value: '', label: 'All branches' }, ...(branches || []).map((branch) => ({ value: String(branch.id), label: `${branch.name} (${branch.code})` }))]}
            />
          </div>
        ) : null}

        {loading ? <p>Loading users...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}

        <div className="table-filters">
          <label className="form-field table-filters__search" htmlFor="userSearch">
            <span>Search</span>
            <input
              id="userSearch"
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search name, username, branch"
            />
          </label>

          <label className="form-field" htmlFor="roleFilter">
            <span>Role</span>
            <Select
              id="roleFilter"
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              options={[{ value: 'all', label: 'All roles' }, ...(normalizedRoleOptions || []), ...(canManageAllBranches ? [{ value: 'main_admin', label: 'Main Admin' }] : [])]}
            />
          </label>

          <label className="form-field" htmlFor="statusFilter">
            <span>Status</span>
            <Select
              id="statusFilter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              options={[{ value: 'all', label: 'All status' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]}
            />
          </label>
        </div>

        <div className="table-wrap table-wrap--full">
          <table className="data-table data-table--users">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Role</th>
                <th>Access Rights</th>
                <th>Branch</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((record) => (
                <tr key={record.id}>
                  <td>{record.fullName}</td>
                  <td>{record.username}</td>
                  <td>{record.role}</td>
                  <td>{(record.accessRights || []).join(', ') || '-'}</td>
                  <td>{record.branch?.name || 'All'}</td>
                  <td>
                    {canToggleUserStatus ? (
                      <ToggleSwitch
                        checked={record.isActive}
                        onChange={() => onToggleStatus(record)}
                        label={`Toggle status for ${record.fullName}`}
                      />
                    ) : (
                      record.isActive ? 'Active' : 'Inactive'
                    )}
                  </td>
                  <td className="text-right">
                    {canUpdateUser ? (
                      <button type="button" className="table-action-button" onClick={() => onEdit(record)}>
                        Edit
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!loading && filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty-state-cell">
                    No users matched the selected filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </PageCard>

      {isModalOpen ? (
        <ModalDialog
          title={editingId ? 'Edit User' : 'Add New User'}
          subtitle="Fill in user details and assign branch access rights"
          onClose={resetForm}
        >
          <form className="auth-form modal-form" onSubmit={onSubmit}>
            <div className="modal-form-grid">
              <FormField
                label="Full Name"
                name="fullName"
                value={formData.fullName}
                onChange={onChange}
                required
              />
              <FormField
                label="Username"
                name="username"
                value={formData.username}
                onChange={onChange}
                required
              />
              <FormField
                label={editingId ? 'Password (optional)' : 'Password'}
                name="password"
                type="password"
                value={formData.password}
                onChange={onChange}
                required={!editingId}
              />

              <label className="form-field" htmlFor="role">
                <span>Role</span>
                <Select id="role" name="role" value={formData.role} onChange={onChange} options={normalizedRoleOptions} />
              </label>

              <label className="form-field" htmlFor="branchId">
                <span>Branch</span>
                <Select
                  id="branchId"
                  name="branchId"
                  value={formData.branchId}
                  onChange={onChange}
                  disabled={!canManageAllBranches}
                  options={[{ value: '', label: 'Select branch' }, ...(branches || []).map((branch) => ({ value: String(branch.id), label: `${branch.name} (${branch.code})` }))]}
                />
              </label>
            </div>

            <FormField
              label="Access Rights (comma-separated)"
              name="accessRights"
              value={formData.accessRights}
              onChange={onChange}
              placeholder="users:read, users:create"
            />

            {error ? <p className="error-text">{error}</p> : null}

            <div className="inline-actions inline-actions--end">
              <button type="button" className="secondary-action-button" onClick={resetForm}>
                Cancel
              </button>
              <button type="submit">{editingId ? 'Update User' : 'Create User'}</button>
            </div>
          </form>
        </ModalDialog>
      ) : null}
    </div>
  );
}
