import { useEffect, useMemo, useState } from 'react';
import PageCard from '../components/ui/PageCard';
import { Button, Select } from '../ui-kit';
import FormField from '../components/ui/FormField';
import ModalDialog from '../components/ui/ModalDialog';
import ToggleSwitch from '../components/ui/ToggleSwitch';
import { accountHeadService } from '../services/accountHeadService';
import { useAccess } from '../hooks/useAccess';

const TYPE_LABELS = {
  cash: 'Cash',
  bank: 'Bank',
  expense: 'Expense',
  income: 'Income',
  receivable: 'Receivable',
  payable: 'Payable',
  asset: 'Asset',
  liability: 'Liability',
};

const defaultForm = {
  name: '',
  code: '',
  type: 'expense',
  description: '',
};

export default function AccountHeadsPage() {
  const { has } = useAccess();
  const canCreate = has('financial:accounts:create');
  const canUpdate = has('financial:accounts:update');

  const [accountHeads, setAccountHeads] = useState([]);
  const [types, setTypes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [formData, setFormData] = useState(defaultForm);
  const [editingId, setEditingId] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return accountHeads.filter((row) => {
      const matchesSearch =
        !normalizedSearch ||
        row.name?.toLowerCase().includes(normalizedSearch) ||
        row.code?.toLowerCase().includes(normalizedSearch) ||
        row.description?.toLowerCase().includes(normalizedSearch);
      const matchesType = typeFilter === 'all' || row.type === typeFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' ? row.isActive : !row.isActive);
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [accountHeads, searchTerm, typeFilter, statusFilter]);

  const loadAccountHeads = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await accountHeadService.list({
        type: typeFilter,
        isActive: statusFilter,
        search: searchTerm.trim() || undefined,
      });
      setAccountHeads(data.accountHeads);
      setTypes(data.types);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccountHeads();
  }, [typeFilter, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const onChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData(defaultForm);
    setEditingId(null);
    setEditingRecord(null);
    setIsModalOpen(false);
  };

  const openCreateModal = () => {
    setError('');
    setEditingId(null);
    setEditingRecord(null);
    setFormData(defaultForm);
    setIsModalOpen(true);
  };

  const onEdit = (record) => {
    setError('');
    setEditingId(record.id);
    setEditingRecord(record);
    setFormData({
      name: record.name || '',
      code: record.code || '',
      type: record.type || 'expense',
      description: record.description || '',
    });
    setIsModalOpen(true);
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      if (editingId) {
        await accountHeadService.update(editingId, {
          name: formData.name,
          type: formData.type,
          description: formData.description,
        });
      } else {
        await accountHeadService.create(formData);
      }
      resetForm();
      await loadAccountHeads();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSaving(false);
    }
  };

  const onToggleStatus = async (record) => {
    setError('');
    try {
      await accountHeadService.updateStatus(record.id, !record.isActive);
      await loadAccountHeads();
    } catch (toggleError) {
      setError(toggleError.message);
    }
  };

  const typeOptions = [
    { value: 'all', label: 'All types' },
    ...(types.length ? types : Object.keys(TYPE_LABELS)).map((type) => ({
      value: type,
      label: TYPE_LABELS[type] || type,
    })),
  ];

  const formTypeOptions = (types.length ? types : Object.keys(TYPE_LABELS)).map((type) => ({
    value: type,
    label: TYPE_LABELS[type] || type,
  }));

  const isSystemRecord = editingRecord?.isSystem;

  return (
    <div className="dashboard-stack">
      <div className="page-stats-strip">
        <div className="page-stat-tile">
          <span className="page-stat-tile__label">Total Accounts</span>
          <span className="page-stat-tile__value">{accountHeads.length}</span>
        </div>
        <div className="page-stat-tile page-stat-tile--success">
          <span className="page-stat-tile__label">Active</span>
          <span className="page-stat-tile__value">{accountHeads.filter((row) => row.isActive).length}</span>
        </div>
        <div className="page-stat-tile page-stat-tile--purple">
          <span className="page-stat-tile__label">System</span>
          <span className="page-stat-tile__value">{accountHeads.filter((row) => row.isSystem).length}</span>
        </div>
      </div>

      <PageCard
        title="Chart of Accounts"
        subtitle="Manage account heads used in ledger, expenses and payment accounts"
        actions={
          canCreate ? (
            <Button type="button" variant="primary" onClick={openCreateModal}>
              Add Account Head
            </Button>
          ) : null
        }
      >
        {loading ? <p>Loading account heads…</p> : null}
        {error ? <p className="error-text">{error}</p> : null}

        <div className="table-filters">
          <label className="form-field table-filters__search" htmlFor="accountHeadSearch">
            <span>Search</span>
            <input
              id="accountHeadSearch"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadAccountHeads()}
              placeholder="Search name, code or description"
            />
          </label>
          <label className="form-field" htmlFor="accountHeadTypeFilter">
            <span>Type</span>
            <Select
              id="accountHeadTypeFilter"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              options={typeOptions}
            />
          </label>
          <label className="form-field" htmlFor="accountHeadStatusFilter">
            <span>Status</span>
            <Select
              id="accountHeadStatusFilter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: 'all', label: 'All status' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
            />
          </label>
          <button type="button" className="secondary-action-button" style={{ alignSelf: 'flex-end' }} onClick={loadAccountHeads}>
            Apply
          </button>
        </div>

        <div className="table-wrap table-wrap--full">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Type</th>
                <th>Description</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    {row.code}
                    {row.isSystem ? <span className="badge badge--blue" style={{ marginLeft: 8 }}>System</span> : null}
                  </td>
                  <td>{row.name}</td>
                  <td>{TYPE_LABELS[row.type] || row.type}</td>
                  <td>{row.description || '–'}</td>
                  <td>
                    <span className={row.isActive ? 'badge badge--green' : 'badge badge--red'}>
                      {row.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="text-right">
                    <div className="inline-actions inline-actions--end">
                      {canUpdate ? (
                        <>
                          <button type="button" className="table-action-button" onClick={() => onEdit(row)}>
                            Edit
                          </button>
                          {!row.isSystem ? (
                            <ToggleSwitch
                              checked={!!row.isActive}
                              onChange={() => onToggleStatus(row)}
                              label={row.isActive ? 'Deactivate account head' : 'Activate account head'}
                            />
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filteredRows.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-state-cell">No account heads found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </PageCard>

      {isModalOpen ? (
        <ModalDialog
          title={editingId ? 'Edit Account Head' : 'Add Account Head'}
          subtitle={isSystemRecord ? 'System account — code is fixed and type cannot be changed' : 'Define ledger account metadata'}
          onClose={resetForm}
        >
          <form className="auth-form modal-form" onSubmit={onSubmit}>
            <FormField label="Account Name" htmlFor="accountHeadName">
              <input
                id="accountHeadName"
                name="name"
                value={formData.name}
                onChange={onChange}
                required
              />
            </FormField>

            <FormField label="Account Code" htmlFor="accountHeadCode">
              <input
                id="accountHeadCode"
                name="code"
                value={formData.code}
                onChange={onChange}
                required
                disabled={Boolean(editingId)}
                placeholder="e.g. EXP-002"
              />
            </FormField>

            <FormField label="Account Type" htmlFor="accountHeadType">
              <Select
                id="accountHeadType"
                name="type"
                value={formData.type}
                onChange={onChange}
                options={formTypeOptions}
                disabled={Boolean(isSystemRecord)}
              />
            </FormField>

            <FormField label="Description" htmlFor="accountHeadDescription">
              <textarea
                id="accountHeadDescription"
                name="description"
                value={formData.description}
                onChange={onChange}
                rows={3}
              />
            </FormField>

            <div className="modal-form__actions">
              <button type="button" className="secondary-action-button" onClick={resetForm}>
                Cancel
              </button>
              <button type="submit" disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Account'}
              </button>
            </div>
          </form>
        </ModalDialog>
      ) : null}
    </div>
  );
}
