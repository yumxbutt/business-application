import { useEffect, useMemo, useState } from 'react';
import PageCard from '../components/ui/PageCard';
import Spinner from '../components/ui/Spinner';
import { Button } from '../ui-kit';
import ModalDialog from '../components/ui/ModalDialog';
import FormField from '../components/ui/FormField';
import ToggleSwitch from '../components/ui/ToggleSwitch';
import { productService } from '../services/productService';

const defaultForm = { name: '', code: '', parentId: '' };

export default function ProductCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(defaultForm);

  const categoryMap = useMemo(
    () => new Map(categories.map((item) => [item.id, item.name])),
    [categories]
  );

  const catStats = useMemo(() => ({
    total: categories.length,
    active: categories.filter((c) => c.isActive).length,
    inactive: categories.filter((c) => !c.isActive).length,
  }), [categories]);

  const loadCategories = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await productService.getCategories();
      setCategories(data);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
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
    setFormData({
      name: record.name || '',
      code: record.code || '',
      parentId: record.parentId ? String(record.parentId) : '',
    });
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

    const payload = {
      name: formData.name,
      code: formData.code || null,
      parentId: formData.parentId ? Number(formData.parentId) : null,
    };

    try {
      if (editingId) {
        await productService.updateCategory(editingId, payload);
      } else {
        await productService.createCategory(payload);
      }
      closeModal();
      await loadCategories();
    } catch (submitError) {
      setError(submitError.message);
    }
  };

  const onToggleStatus = async (record) => {
    try {
      await productService.updateCategory(record.id, { isActive: !record.isActive });
      await loadCategories();
    } catch (statusError) {
      setError(statusError.message);
    }
  };

  return (
    <div className="dashboard-stack">
      <div className="page-stats-strip">
        <div className="page-stat-tile page-stat-tile--primary">
          <div className="page-stat-tile__label">Total Categories</div>
          <div className="page-stat-tile__value">{catStats.total}</div>
        </div>
        <div className="page-stat-tile">
          <div className="page-stat-tile__label">Active</div>
          <div className="page-stat-tile__value">{catStats.active}</div>
        </div>
        <div className="page-stat-tile">
          <div className="page-stat-tile__label">Inactive</div>
          <div className="page-stat-tile__value">{catStats.inactive}</div>
        </div>
      </div>

      <PageCard
        title="Product Categories"
        subtitle="Manage hierarchical categories for product classification"
        actions={
          <Button type="button" variant="primary" onClick={openCreate}>
            Add Category
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
                <th>Parent</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((record) => (
                <tr key={record.id}>
                  <td>{record.name}</td>
                  <td>{record.code}</td>
                  <td>{categoryMap.get(record.parentId) || '-'}</td>
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
              {!loading && categories.length === 0 ? (
                <tr>
                  <td colSpan="5" className="empty-state-cell">No categories found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </PageCard>

      {isModalOpen ? (
        <ModalDialog
          title={editingId ? 'Edit Category' : 'Add Category'}
          subtitle="Create category and optional parent hierarchy"
          onClose={closeModal}
        >
          <form className="auth-form modal-form" onSubmit={onSubmit}>
            <div className="modal-form-grid">
              <FormField label="Name" name="name" value={formData.name} onChange={onChange} required />
              <FormField label="Code" name="code" value={formData.code} onChange={onChange} />
              <label className="form-field" htmlFor="parentId">
                <span>Parent Category</span>
                <Select
                  id="parentId"
                  name="parentId"
                  value={formData.parentId}
                  onChange={onChange}
                  options={[{ value: '', label: 'None' }, ...(categories || []).filter((item) => !editingId || item.id !== editingId).map((item) => ({ value: String(item.id), label: item.name }))]}
                />
              </label>
            </div>
            <div className="inline-actions inline-actions--end">
              <button type="button" className="secondary-action-button" onClick={closeModal}>
                Cancel
              </button>
              <button type="submit">{editingId ? 'Update Category' : 'Create Category'}</button>
            </div>
          </form>
        </ModalDialog>
      ) : null}
    </div>
  );
}