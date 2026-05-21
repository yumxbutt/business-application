import { useEffect, useMemo, useState } from 'react';
import PageCard from '../components/ui/PageCard';
import { Button, Select } from '../ui-kit';
import FormField from '../components/ui/FormField';
import ModalDialog from '../components/ui/ModalDialog';
import ToggleSwitch from '../components/ui/ToggleSwitch';
import { contactService } from '../services/contactService';
import { productService } from '../services/productService';
import { useAuth } from '../context/AuthContext';

const defaultForm = {
  branchId: '',
  name: '',
  phone: '',
  address: '',
  recordType: 'customer',
  openingBalance: '',
  applyToAllBranches: false,
  branchIds: [],
};

const RECORD_TYPE_LABELS = {
  customer: 'Customer',
  supplier: 'Supplier',
  both: 'Both (Customer & Supplier)',
};

export default function ContactManagementPage() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(defaultForm);
  const [filters, setFilters] = useState({
    branchId: '',
    search: '',
    recordType: 'all',
    isActive: 'active',
  });

  const loadContacts = async (nextFilters = filters) => {
    setLoading(true);
    setError('');
    try {
      const data = await contactService.getContacts(nextFilters);
      setContacts(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, []);

  useEffect(() => {
    if (user?.role !== 'main_admin') return;
    productService
      .getMeta()
      .then((meta) => setBranches(meta.branches || []))
      .catch(() => {});
  }, [user?.role]);

  const openCreate = () => {
    setEditingId(null);
    setFormData({
      ...defaultForm,
      branchId: user?.role === 'main_admin' ? '' : String(user?.branchId || ''),
      branchIds: user?.role === 'main_admin' ? [] : [String(user?.branchId || '')],
    });
    setError('');
    setIsModalOpen(true);
  };

  const openEdit = (record) => {
    setEditingId(record.id);
    setFormData({
      branchId: String(record.branchId || ''),
      applyToAllBranches: !record.branchId,
      branchIds: record.branchId ? [String(record.branchId)] : [],
      name: record.name || '',
      phone: record.phone || '',
      address: record.address || '',
      recordType: record.recordType || 'customer',
      openingBalance: record.openingBalance || '',
    });
    setError('');
    setIsModalOpen(true);
  };

  const onFormChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const onCheckboxChange = (event) => {
    const { name, checked } = event.target;
    setFormData((prev) => ({ ...prev, [name]: checked, ...(name === 'applyToAllBranches' && checked ? { branchId: '' } : {}) }));
  };

  const submitForm = async (event) => {
    event.preventDefault();
    setError('');

    let payload = {
      name: formData.name,
      phone: formData.phone || null,
      address: formData.address || null,
      recordType: formData.recordType,
      openingBalance: formData.openingBalance ? Number(formData.openingBalance) : 0,
    };

    if (formData.applyToAllBranches) {
      payload.applyToAllBranches = true;
    } else if (formData.branchIds && formData.branchIds.length > 0) {
      payload.branchIds = formData.branchIds.map((v) => Number(v));
    } else if (formData.branchId) {
      payload.branchId = Number(formData.branchId);
    }

    try {
      if (editingId) {
        await contactService.updateContact(editingId, payload);
      } else {
        await contactService.createContact(payload);
      }
      closeModal();
      await loadContacts();
    } catch (e) {
      setError(e.message);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData(defaultForm);
    setError('');
  };

  const onBranchSelectionChange = (event) => {
    const selected = Array.from(event.target.selectedOptions).map((opt) => opt.value);
    setFormData((prev) => ({ ...prev, branchIds: selected }));
  };

  const onToggleStatus = async (record) => {
    try {
      await contactService.updateStatus(record.id, !record.isActive);
      await loadContacts();
    } catch (e) {
      setError(e.message);
    }
  };

  const recordTypeBadge = (type) => {
    const colors = {
      customer: 'badge--blue',
      supplier: 'badge--green',
      both: 'badge--purple',
    };
    return (
      <span className={`badge ${colors[type] || ''}`}>
        {RECORD_TYPE_LABELS[type] || type}
      </span>
    );
  };

  return (
    <div className="dashboard-stack">
      <div className="page-stats-strip">
        <div className="page-stat-tile">
          <span className="page-stat-tile__label">Total Contacts</span>
          <span className="page-stat-tile__value">{contacts.length}</span>
        </div>
        <div className="page-stat-tile page-stat-tile--primary">
          <span className="page-stat-tile__label">Customers</span>
          <span className="page-stat-tile__value">{contacts.filter((c) => c.contactType === 'customer' || c.contactType === 'both').length}</span>
        </div>
        <div className="page-stat-tile page-stat-tile--purple">
          <span className="page-stat-tile__label">Suppliers</span>
          <span className="page-stat-tile__value">{contacts.filter((c) => c.contactType === 'supplier' || c.contactType === 'both').length}</span>
        </div>
      </div>
      <PageCard
        title="Contact Management"
        subtitle="Manage customers, suppliers, and dual-role contacts"
        actions={
          <Button type="button" variant="primary" onClick={openCreate}>
            Add Contact
          </Button>
        }
      >
        {error ? <p className="error-text">{error}</p> : null}

        {/* Filters */}
        <div className="table-filters">
          {user?.role === 'main_admin' ? (
            <label className="form-field" htmlFor="contactBranchFilter">
              <span>Branch</span>
              <Select
                id="contactBranchFilter"
                value={filters.branchId}
                onChange={(e) => setFilters((p) => ({ ...p, branchId: e.target.value }))}
                options={[{ value: '', label: 'All branches' }, ...(branches || []).map((b) => ({ value: String(b.id), label: b.name }))]}
              />
            </label>
          ) : null}

          <label className="form-field table-filters__search" htmlFor="contactSearch">
            <span>Search</span>
            <input
              id="contactSearch"
              type="text"
              value={filters.search}
              onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
              placeholder="Search by name or phone"
            />
          </label>

          <label className="form-field" htmlFor="contactTypeFilter">
            <span>Type</span>
            <Select
              id="contactTypeFilter"
              value={filters.recordType}
              onChange={(e) => setFilters((p) => ({ ...p, recordType: e.target.value }))}
              options={[
                { value: 'all', label: 'All types' },
                { value: 'customer', label: 'Customers only' },
                { value: 'supplier', label: 'Suppliers only' },
                { value: 'both', label: 'Both' },
              ]}
            />
          </label>

          <label className="form-field" htmlFor="contactStatusFilter">
            <span>Status</span>
            <Select
              id="contactStatusFilter"
              value={filters.isActive}
              onChange={(e) => setFilters((p) => ({ ...p, isActive: e.target.value }))}
              options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'all', label: 'All' }]}
            />
          </label>
        </div>

        <div className="inline-actions inline-actions--end">
          <button
            type="button"
            className="secondary-action-button"
            onClick={() => loadContacts(filters)}
          >
            Apply Filters
          </button>
        </div>

        {loading ? (
          <p>Loading contacts…</p>
        ) : (
          <div className="table-wrap table-wrap--full">
            <table className="data-table">
              <thead>
                <tr>
                  {user?.role === 'main_admin' ? <th>Branch</th> : null}
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Type</th>
                  <th>Opening Balance</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((record) => (
                  <tr key={record.name}>
                    {user?.role === 'main_admin' ? <td>{record.branches}</td> : null}
                    <td>{record.name}</td>
                    <td>{record.phone || '–'}</td>
                    <td>{recordTypeBadge(record.recordType)}</td>
                    <td>{Number(record.openingBalance).toFixed(2)}</td>
                    <td>
                      <ToggleSwitch
                        checked={record.isActive}
                        onChange={() => onToggleStatus(record)}
                        label={`Toggle status for ${record.name}`}
                      />
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        className="table-action-button"
                        onClick={() => openEdit(record)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && contacts.length === 0 ? (
                  <tr>
                    <td colSpan={user?.role === 'main_admin' ? '7' : '6'} className="empty-state-cell">
                      No contacts found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </PageCard>

      {isModalOpen ? (
        <ModalDialog
          title={editingId ? 'Edit Contact' : 'Add Contact'}
          subtitle="Name, type, and opening balance"
          onClose={closeModal}
        >
          <form className="auth-form modal-form" onSubmit={submitForm}>
            {error ? <p className="error-text">{error}</p> : null}

            <div className="modal-form-grid">
              {user?.role === 'main_admin' ? (
                <>
                  <label className="form-field" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span>Apply</span>
                    <input
                      type="checkbox"
                      name="applyToAllBranches"
                      checked={!!formData.applyToAllBranches}
                      onChange={onCheckboxChange}
                      style={{ width: 18, height: 18 }}
                    />
                    <span style={{ fontSize: '0.95rem' }}>Apply to all branches</span>
                  </label>

                  <label className="form-field" htmlFor="contactBranchMulti">
                    <span>Select Branches</span>
                    <select
                      id="contactBranchMulti"
                      multiple
                      value={formData.branchIds || []}
                      onChange={onBranchSelectionChange}
                      disabled={formData.applyToAllBranches}
                      style={{ minHeight: 120 }}
                    >
                      {(branches || []).map((b) => (
                        <option key={String(b.id)} value={String(b.id)}>{b.name}</option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}

              <FormField
                label="Name"
                name="name"
                value={formData.name}
                onChange={onFormChange}
                required
              />
              <FormField
                label="Phone"
                name="phone"
                value={formData.phone}
                onChange={onFormChange}
                placeholder="Optional"
              />
            </div>

            <FormField
              label="Address"
              name="address"
              value={formData.address}
              onChange={onFormChange}
              placeholder="Optional"
            />

            <div className="modal-form-grid">
              <label className="form-field" htmlFor="recordType">
                <span>Contact Type *</span>
                <Select
                  id="recordType"
                  name="recordType"
                  value={formData.recordType}
                  onChange={onFormChange}
                  required
                  options={[{ value: 'customer', label: 'Customer' }, { value: 'supplier', label: 'Supplier' }, { value: 'both', label: 'Both (Customer & Supplier)' }]}
                />
              </label>

              <FormField
                label="Opening Balance"
                name="openingBalance"
                type="number"
                min="0"
                step="0.01"
                value={formData.openingBalance}
                onChange={onFormChange}
                placeholder="0.00"
              />
            </div>

            <div className="inline-actions inline-actions--end">
              <button type="button" className="secondary-action-button" onClick={closeModal}>
                Cancel
              </button>
              <button type="submit">{editingId ? 'Update Contact' : 'Create Contact'}</button>
            </div>
          </form>
        </ModalDialog>
      ) : null}
    </div>
  );
}
