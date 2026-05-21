import { useEffect, useMemo, useState } from 'react';
import PageCard from '../components/ui/PageCard';
import Spinner from '../components/ui/Spinner';
import { Button } from '../ui-kit';
import ModalDialog from '../components/ui/ModalDialog';
import FormField from '../components/ui/FormField';
import ToggleSwitch from '../components/ui/ToggleSwitch';
import { productService } from '../services/productService';

const defaultForm = { name: '', code: '' };

export default function ProductUnitsPage() {
  const [units, setUnits] = useState([]);

  const unitStats = useMemo(() => ({
    total: units.length,
    active: units.filter((u) => u.isActive).length,
    inactive: units.filter((u) => !u.isActive).length,
  }), [units]);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(defaultForm);

  const loadUnits = async () => {
    setLoading(true);
    setError('');
    try {
      setUnits(await productService.getUnits());
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUnits();
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
        await productService.updateUnit(editingId, payload);
      } else {
        await productService.createUnit(payload);
      }
      closeModal();
      await loadUnits();
    } catch (submitError) {
      setError(submitError.message);
    }
  };

  const onToggleStatus = async (record) => {
    try {
      await productService.updateUnit(record.id, { isActive: !record.isActive });
      await loadUnits();
    } catch (statusError) {
      setError(statusError.message);
    }
  };

  return (
    <div className="dashboard-stack">
      <div className="page-stats-strip">
        <div className="page-stat-tile page-stat-tile--primary">
          <div className="page-stat-tile__label">Total Units</div>
          <div className="page-stat-tile__value">{unitStats.total}</div>
        </div>
        <div className="page-stat-tile">
          <div className="page-stat-tile__label">Active</div>
          <div className="page-stat-tile__value">{unitStats.active}</div>
        </div>
        <div className="page-stat-tile">
          <div className="page-stat-tile__label">Inactive</div>
          <div className="page-stat-tile__value">{unitStats.inactive}</div>
        </div>
      </div>

      <PageCard
        title="Product Units"
        actions={
          <Button type="button" variant="primary" onClick={openCreate}>
            Add Unit
          </Button>
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
              {units.map((record) => (
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
              {!loading && units.length === 0 ? (
                <tr>
                  <td colSpan="4" className="empty-state-cell">No units found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </PageCard>

      {isModalOpen ? (
        <ModalDialog
          title={editingId ? 'Edit Unit' : 'Add Unit'}
          subtitle="Define unit code and display name"
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
              <button type="submit">{editingId ? 'Update Unit' : 'Create Unit'}</button>
            </div>
          </form>
        </ModalDialog>
      ) : null}
    </div>
  );
}