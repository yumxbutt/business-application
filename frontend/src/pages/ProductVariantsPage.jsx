import { useEffect, useMemo, useState } from 'react';
import PageCard from '../components/ui/PageCard';
import Spinner from '../components/ui/Spinner';
import ModalDialog from '../components/ui/ModalDialog';
import FormField from '../components/ui/FormField';
import ToggleSwitch from '../components/ui/ToggleSwitch';
import Select from '../ui-kit/Select';
import { productService } from '../services/productService';

const defaultForm = {
  productId: '',
  sku: '',
  barcode: '',
  attributeValueIds: '',
  purchasePrice: '',
  salePrice: '',
};

export default function ProductVariantsPage() {
  const [variants, setVariants] = useState([]);

  const variantStats = useMemo(() => ({
    total: variants.length,
    active: variants.filter((v) => v.isActive).length,
    inactive: variants.filter((v) => !v.isActive).length,
  }), [variants]);

  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(defaultForm);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [variantRows, productRows] = await Promise.all([
        productService.getVariants(),
        productService.getProducts(),
      ]);
      setVariants(variantRows);
      setProducts(productRows);
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
      sku: record.sku || '',
      barcode: record.barcode || '',
      attributeValueIds: (record.attributeValueIds || []).join(', '),
      purchasePrice: record.purchasePrice || '',
      salePrice: record.salePrice || '',
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
      sku: formData.sku || null,
      barcode: formData.barcode || null,
      attributeValueIds: formData.attributeValueIds
        ? formData.attributeValueIds.split(',').map((item) => Number(item.trim())).filter(Boolean)
        : [],
      purchasePrice: formData.purchasePrice ? Number(formData.purchasePrice) : 0,
      salePrice: formData.salePrice ? Number(formData.salePrice) : 0,
    };

    try {
      if (editingId) {
        await productService.updateVariant(editingId, payload);
      } else {
        await productService.createVariant(payload);
      }
      closeModal();
      await loadData();
    } catch (submitError) {
      setError(submitError.message);
    }
  };

  const onToggleStatus = async (record) => {
    try {
      await productService.updateVariantStatus(record.id, !record.isActive);
      await loadData();
    } catch (toggleError) {
      setError(toggleError.message);
    }
  };

  return (
    <div className="dashboard-stack">
      <div className="page-stats-strip">
        <div className="page-stat-tile page-stat-tile--primary">
          <div className="page-stat-tile__label">Total Variants</div>
          <div className="page-stat-tile__value">{variantStats.total}</div>
        </div>
        <div className="page-stat-tile">
          <div className="page-stat-tile__label">Active</div>
          <div className="page-stat-tile__value">{variantStats.active}</div>
        </div>
        <div className="page-stat-tile">
          <div className="page-stat-tile__label">Inactive</div>
          <div className="page-stat-tile__value">{variantStats.inactive}</div>
        </div>
      </div>

      <PageCard
        title="Product Variants"
        actions={
          <button type="button" className="primary-action-button" onClick={openCreate}>
            Add Variant
          </button>
        }
      >
        {error ? <p className="error-text">{error}</p> : null}
        {loading ? <Spinner center /> : null}

        <div className="table-wrap table-wrap--full">
          <table className="data-table data-table--users">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Barcode</th>
                <th>Attribute Value IDs</th>
                <th>Sale Price</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((record) => (
                <tr key={record.id}>
                  <td>{record.product?.name || '-'}</td>
                  <td>{record.sku}</td>
                  <td>{record.barcode}</td>
                  <td>{(record.attributeValueIds || []).join(', ') || '-'}</td>
                  <td>{record.salePrice || 0}</td>
                  <td>
                    <ToggleSwitch
                      checked={record.isActive}
                      onChange={() => onToggleStatus(record)}
                      label={`Toggle status for variant ${record.id}`}
                    />
                  </td>
                  <td className="text-right">
                    <button type="button" className="table-action-button" onClick={() => openEdit(record)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && variants.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty-state-cell">No variants found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </PageCard>

      {isModalOpen ? (
        <ModalDialog
          title={editingId ? 'Edit Variant' : 'Add Variant'}
          subtitle="Configure product variant details"
          onClose={closeModal}
        >
          <form className="auth-form modal-form" onSubmit={onSubmit}>
            <div className="modal-form-grid">
              <label className="form-field" htmlFor="productId">
                <span>Product</span>
                <Select
                  id="productId"
                  name="productId"
                  value={formData.productId}
                  onChange={onChange}
                  required
                  options={[
                    { value: '', label: 'Select product' },
                    ...products.map((item) => ({ value: item.id, label: item.name })),
                  ]}
                />
              </label>

              <FormField label="SKU (optional)" name="sku" value={formData.sku} onChange={onChange} />
              <FormField label="Barcode (optional)" name="barcode" value={formData.barcode} onChange={onChange} />
              <FormField
                label="Attribute Value IDs"
                name="attributeValueIds"
                value={formData.attributeValueIds}
                onChange={onChange}
                placeholder="e.g. 1,2"
              />
              <FormField
                label="Purchase Price"
                name="purchasePrice"
                type="number"
                min="0"
                step="0.01"
                value={formData.purchasePrice}
                onChange={onChange}
              />
              <FormField
                label="Sale Price"
                name="salePrice"
                type="number"
                min="0"
                step="0.01"
                value={formData.salePrice}
                onChange={onChange}
              />
            </div>

            <div className="inline-actions inline-actions--end">
              <button type="button" className="secondary-action-button" onClick={closeModal}>
                Cancel
              </button>
              <button type="submit">{editingId ? 'Update Variant' : 'Create Variant'}</button>
            </div>
          </form>
        </ModalDialog>
      ) : null}
    </div>
  );
}