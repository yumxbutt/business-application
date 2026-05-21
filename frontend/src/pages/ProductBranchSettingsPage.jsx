import { useEffect, useState } from 'react';
import PageCard from '../components/ui/PageCard';
import { Select } from '../ui-kit';
import ModalDialog from '../components/ui/ModalDialog';
import FormField from '../components/ui/FormField';
import ToggleSwitch from '../components/ui/ToggleSwitch';
import { productService } from '../services/productService';

const defaultForm = {
  productId: '',
  branchId: '',
  salePrice: '',
  reorderLevel: '',
};

export default function ProductBranchSettingsPage() {
  const [settings, setSettings] = useState([]);
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(defaultForm);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [settingRows, productRows, meta] = await Promise.all([
        productService.getBranchSettings(),
        productService.getProducts(),
        productService.getMeta(),
      ]);
      setSettings(settingRows);
      setProducts(productRows);
      setBranches(meta.branches || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
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
      productId: record.productId ? String(record.productId) : '',
      branchId: record.branchId ? String(record.branchId) : '',
      salePrice: record.salePrice || '',
      reorderLevel: record.reorderLevel || '',
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
      productId: Number(formData.productId),
      branchId: Number(formData.branchId),
      salePrice: formData.salePrice ? Number(formData.salePrice) : null,
      reorderLevel: formData.reorderLevel ? Number(formData.reorderLevel) : null,
    };

    try {
      if (editingId) {
        await productService.updateBranchSetting(editingId, payload);
      } else {
        await productService.createBranchSetting(payload);
      }
      closeModal();
      await loadData();
    } catch (submitError) {
      setError(submitError.message);
    }
  };

  const onToggleAvailability = async (record) => {
    try {
      await productService.updateBranchSettingAvailability(record.id, !record.isAvailable);
      await loadData();
    } catch (toggleError) {
      setError(toggleError.message);
    }
  };

  return (
    <div className="dashboard-stack">
      <PageCard
        title="Product Branch Settings"
        subtitle="Manage branch-wise availability, price override, and reorder level"
        actions={
          <button type="button" className="primary-action-button" onClick={openCreate}>
            Add Branch Setting
          </button>
        }
      >
        {error ? <p className="error-text">{error}</p> : null}
        {loading ? <p>Loading branch settings...</p> : null}

        <div className="table-wrap table-wrap--full">
          <table className="data-table data-table--users">
            <thead>
              <tr>
                <th>Product</th>
                <th>Branch</th>
                <th>Sale Price Override</th>
                <th>Reorder Level</th>
                <th>Available</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {settings.map((record) => (
                <tr key={record.id}>
                  <td>{record.product?.name || '-'}</td>
                  <td>{record.branch?.name || '-'}</td>
                  <td>{record.salePrice ?? '-'}</td>
                  <td>{record.reorderLevel ?? '-'}</td>
                  <td>
                    <ToggleSwitch
                      checked={record.isAvailable}
                      onChange={() => onToggleAvailability(record)}
                      label={`Toggle availability for setting ${record.id}`}
                    />
                  </td>
                  <td className="text-right">
                    <button type="button" className="table-action-button" onClick={() => openEdit(record)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && settings.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-state-cell">No branch settings found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </PageCard>

      {isModalOpen ? (
        <ModalDialog
          title={editingId ? 'Edit Branch Setting' : 'Add Branch Setting'}
          subtitle="Map product settings for a specific branch"
          onClose={closeModal}
        >
          <form className="auth-form modal-form" onSubmit={onSubmit}>
            <div className="modal-form-grid">
              <label className="form-field" htmlFor="productId">
                <span>Product</span>
                <Select id="productId" name="productId" value={formData.productId} onChange={onChange} required options={[{ value: '', label: 'Select product' }, ...(products || []).map((item) => ({ value: String(item.id), label: item.name }))]} />
              </label>

              <label className="form-field" htmlFor="branchId">
                <span>Branch</span>
                <Select id="branchId" name="branchId" value={formData.branchId} onChange={onChange} required options={[{ value: '', label: 'Select branch' }, ...(branches || []).map((item) => ({ value: String(item.id), label: `${item.name} (${item.code})` }))]} />
              </label>

              <FormField
                label="Sale Price Override"
                name="salePrice"
                type="number"
                min="0"
                step="0.01"
                value={formData.salePrice}
                onChange={onChange}
              />

              <FormField
                label="Reorder Level"
                name="reorderLevel"
                type="number"
                min="0"
                step="0.01"
                value={formData.reorderLevel}
                onChange={onChange}
              />
            </div>

            <div className="inline-actions inline-actions--end">
              <button type="button" className="secondary-action-button" onClick={closeModal}>
                Cancel
              </button>
              <button type="submit">{editingId ? 'Update Setting' : 'Create Setting'}</button>
            </div>
          </form>
        </ModalDialog>
      ) : null}
    </div>
  );
}