import { useEffect, useMemo, useState } from 'react';
import PageCard from '../components/ui/PageCard';
import { Button, Select } from '../ui-kit';
import FormField from '../components/ui/FormField';
import ModalDialog from '../components/ui/ModalDialog';
import ToggleSwitch from '../components/ui/ToggleSwitch';
import { branchService } from '../services/branchService';
import { useAccess } from '../hooks/useAccess';

const defaultForm = {
  name: '',
  code: '',
  address: '',
  phone: '',
};

export default function BranchManagementPage() {
  const { has } = useAccess();
  const canCreateBranch = has('branch:create');
  const canUpdateBranch = has('branch:update');
  const [branches, setBranches] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [formData, setFormData] = useState(defaultForm);
  const [editingId, setEditingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const filteredBranches = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return branches.filter((branch) => {
      const matchesSearch =
        !normalizedSearch ||
        branch.name?.toLowerCase().includes(normalizedSearch) ||
        branch.code?.toLowerCase().includes(normalizedSearch);
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' ? branch.isActive : !branch.isActive);
      return matchesSearch && matchesStatus;
    });
  }, [branches, searchTerm, statusFilter]);

  const loadBranches = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await branchService.getBranches();
      setBranches(data);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
  }, []);

  const onChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData(defaultForm);
    setEditingId(null);
    setIsModalOpen(false);
  };

  const openCreateModal = () => {
    setError('');
    setEditingId(null);
    setFormData(defaultForm);
    setIsModalOpen(true);
  };

  const onEdit = (branch) => {
    setError('');
    setEditingId(branch.id);
    setFormData({
      name: branch.name || '',
      code: branch.code || '',
      address: branch.address || '',
      phone: branch.phone || '',
    });
    setIsModalOpen(true);
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    const payload = {
      name: formData.name.trim(),
      code: formData.code.trim() || undefined,
      address: formData.address.trim() || undefined,
      phone: formData.phone.trim() || undefined,
    };

    try {
      if (editingId) {
        await branchService.updateBranch(editingId, payload);
      } else {
        await branchService.createBranch(payload);
      }
      resetForm();
      await loadBranches();
    } catch (submitError) {
      setError(submitError.message);
    }
  };

  const onToggleStatus = async (branch) => {
    setError('');
    try {
      await branchService.updateBranchStatus(branch.id, !branch.isActive);
      await loadBranches();
    } catch (toggleError) {
      setError(toggleError.message);
    }
  };

  return (
    <div className="dashboard-stack">
      <div className="page-stats-strip">
        <div className="page-stat-tile">
          <span className="page-stat-tile__label">Total Branches</span>
          <span className="page-stat-tile__value">{branches.length}</span>
        </div>
        <div className="page-stat-tile page-stat-tile--success">
          <span className="page-stat-tile__label">Active</span>
          <span className="page-stat-tile__value">{branches.filter((b) => b.isActive).length}</span>
        </div>
        <div className="page-stat-tile page-stat-tile--danger">
          <span className="page-stat-tile__label">Inactive</span>
          <span className="page-stat-tile__value">{branches.filter((b) => !b.isActive).length}</span>
        </div>
      </div>

      <PageCard
        title="Branch Management"
        subtitle="Create and manage company branches"
        actions={
          canCreateBranch ? (
            <Button type="button" variant="primary" onClick={openCreateModal}>
              Add Branch
            </Button>
          ) : null
        }
      >
        {loading ? <p>Loading branches…</p> : null}
        {error ? <p className="error-text">{error}</p> : null}

        <div className="table-filters">
          <label className="form-field table-filters__search" htmlFor="branchSearch">
            <span>Search</span>
            <input
              id="branchSearch"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search name or code"
            />
          </label>
          <label className="form-field" htmlFor="branchStatusFilter">
            <span>Status</span>
            <Select
              id="branchStatusFilter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: 'all', label: 'All status' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
            />
          </label>
        </div>

        <div className="table-wrap table-wrap--full">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Phone</th>
                <th>Address</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredBranches.map((branch) => (
                <tr key={branch.id}>
                  <td>{branch.name}</td>
                  <td>{branch.code || '–'}</td>
                  <td>{branch.phone || '–'}</td>
                  <td>{branch.address || '–'}</td>
                  <td>
                    <span className={branch.isActive ? 'badge badge--green' : 'badge badge--red'}>
                      {branch.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="text-right">
                    <div className="inline-actions inline-actions--end">
                      {canUpdateBranch ? (
                        <>
                          <button type="button" className="table-action-button" onClick={() => onEdit(branch)}>
                            Edit
                          </button>
                          <ToggleSwitch
                            checked={!!branch.isActive}
                            onChange={() => onToggleStatus(branch)}
                            label={branch.isActive ? 'Deactivate' : 'Activate'}
                          />
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredBranches.length === 0 ? (
                <tr><td colSpan="6" className="empty-state-cell">No branches found.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </PageCard>

      {isModalOpen ? (
        <ModalDialog
          title={editingId ? 'Edit Branch' : 'Add Branch'}
          subtitle="Branch details used across sales, inventory and reporting"
          onClose={resetForm}
        >
          <form className="auth-form" onSubmit={onSubmit}>
            <FormField label="Branch Name" name="name" value={formData.name} onChange={onChange} required />
            <FormField label="Branch Code" name="code" value={formData.code} onChange={onChange} placeholder="Optional short code" />
            <FormField label="Phone" name="phone" value={formData.phone} onChange={onChange} />
            <FormField label="Address" name="address" value={formData.address} onChange={onChange} />
            {error ? <p className="error-text">{error}</p> : null}
            <div className="inline-actions inline-actions--end">
              <button type="button" className="secondary-action-button" onClick={resetForm}>Cancel</button>
              <button type="submit">{editingId ? 'Save Changes' : 'Create Branch'}</button>
            </div>
          </form>
        </ModalDialog>
      ) : null}
    </div>
  );
}
