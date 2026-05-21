import { useEffect, useMemo, useState } from 'react';
import PageCard from '../components/ui/PageCard';
import Spinner from '../components/ui/Spinner';
import ModalDialog from '../components/ui/ModalDialog';
import FormField from '../components/ui/FormField';
import ToggleSwitch from '../components/ui/ToggleSwitch';
import { productService } from '../services/productService';

const defaultForm = { name: '', code: '' };

export default function ProductTypesPage() {
  const [types, setTypes] = useState([]);

  const typeStats = useMemo(() => ({
    total: types.length,
    active: types.filter((t) => t.isActive).length,
    inactive: types.filter((t) => !t.isActive).length,
  }), [types]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(defaultForm);

  const loadTypes = async () => {
    setLoading(true);
    setError('');
    try {
      setTypes(await productService.getTypes());
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTypes();
  }, []);

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData(defaultForm);
  };

  const openCreate = () => {
    setEditingId(null);
    setFormData(defaultForm);
    setError('');
    setIsModalOpen(true);
  };

  const openEdit = (record) => {
    setEditingId(record.id);
    setFormData({ name: record.name || '', code: record.code || '' });
    setError('');
    setIsModalOpen(true);
  };

  const onChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const payload = { name: formData.name, code: formData.code || null };
    try {
      if (editingId) {
        await productService.updateType(editingId, payload);
      } else {
        await productService.createType(payload);
      }
      closeModal();
      await loadTypes();
    } catch (submitError) {
      setError(submitError.message);
    }
  };

  const onToggleStatus = async (record) => {
    try {
      await productService.updateType(record.id, { isActive: !record.isActive });
      await loadTypes();
    } catch (statusError) {
      setError(statusError.message);
    }
  };

  return (
    <div className="dashboard-stack">
      <div className="page-stats-strip">
        <div className="page-stat-tile page-stat-tile--primary">
          <div className="page-stat-tile__label">Total Types</div>
          <div className="page-stat-tile__value">{typeStats.total}</div>
        </div>
        <div className="page-stat-tile">
          <div className="page-stat-tile__label">Active</div>
          <div className="page-stat-tile__value">{typeStats.active}</div>
        </div>
        <div className="page-stat-tile">
          <div className="page-stat-tile__label">Inactive</div>
          <div className="page-stat-tile__value">{typeStats.inactive}</div>
        </div>
      </div>

      <PageCard
        title="Product Types"
        subtitle="Manage product type master (Finished Goods, Raw Material, Service)"
        actions={
          <button type="button" className="primary-action-button" onClick={openCreate}>
            Add Type
          </button>
        }
      >
        {error ? <p className="error-text">{error}</p> : null}
        {loading ? <Spinner center /> : null}

        <div className="table-wrap table-wrap--full">
          <table className="data-table data-table--users">
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {types.map((record) => (
                <tr key={record.id}>
                  <td>{record.name}</td>
                  <td>{record.code}</td>
                  <td>
                    <ToggleSwitch
                      checked={record.isActive}
                      onChange={() => onToggleStatus(record)}
                      label={`Toggle status for ${record.name}`}
                    />
                  </td>
                  <td className="text-right">
                    <button type="button" className="table-action-button" onClick={() => openEdit(record)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && types.length === 0 ? (
                <tr>
                  <td colSpan="4" className="empty-state-cell">No types found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </PageCard>

      {isModalOpen ? (
        <ModalDialog
          title={editingId ? 'Edit Type' : 'Add Type'}
          subtitle="Define product type code and name"
          onClose={closeModal}
        >
          <form className="auth-form modal-form" onSubmit={onSubmit}>
            <div className="modal-form-grid">
              <FormField label="Name" name="name" value={formData.name} onChange={onChange} required />
              <FormField label="Code" name="code" value={formData.code} onChange={onChange} />
            </div>

            <div className="inline-actions inline-actions--end">
              <button type="button" className="secondary-action-button" onClick={closeModal}>
                Cancel
              </button>
              <button type="submit">{editingId ? 'Update Type' : 'Create Type'}</button>
            </div>
          </form>
        </ModalDialog>
      ) : null}
    </div>
  );
}