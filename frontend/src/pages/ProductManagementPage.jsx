import { useEffect, useMemo, useState } from 'react';
import PageCard from '../components/ui/PageCard';
import Spinner from '../components/ui/Spinner';
import { Select } from '../ui-kit';
import { Button } from '../ui-kit';
import FormField from '../components/ui/FormField';
import ModalDialog from '../components/ui/ModalDialog';
import ToggleSwitch from '../components/ui/ToggleSwitch';
import { productService } from '../services/productService';

const defaultForm = {
  name: '',
  sku: '',
  barcode: '',
  categoryId: '',
  typeId: '',
  defaultUnitId: '',
  purchasePrice: '',
  salePrice: '',
  description: '',
};

const defaultUnitRow = () => ({
  unitId: '',
  conversionFactor: '1',
  isBaseUnit: false,
  isPurchaseUnit: false,
  isSaleUnit: false,
});

export default function ProductManagementPage() {
  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState({ categories: [], types: [], units: [], branches: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(defaultForm);
  const [filters, setFilters] = useState({ search: '', categoryId: '', typeId: '', isActive: 'all' });
  const [unitRows, setUnitRows] = useState([]);
  const [branchIds, setBranchIds] = useState([]);
  const [branchSearch, setBranchSearch] = useState('');

  const loadMeta = async () => {
    try {
      const data = await productService.getMeta();
      setMeta({
        categories: data.categories || [],
        types: data.types || [],
        units: data.units || [],
        branches: data.branches || [],
      });
    } catch (loadError) {
      setError(loadError.message);
    }
  };

  const loadProducts = async (nextFilters = filters) => {
    setLoading(true);
    setError('');
    try {
      const data = await productService.getProducts(nextFilters);
      setProducts(data);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeta();
    loadProducts();
  }, []);

  const categoryById = useMemo(
    () => new Map(meta.categories.map((item) => [item.id, item.name])),
    [meta.categories]
  );

  const typeById = useMemo(
    () => new Map(meta.types.map((item) => [item.id, item.name])),
    [meta.types]
  );

  const unitById = useMemo(
    () => new Map(meta.units.map((item) => [item.id, item.name])),
    [meta.units]
  );

  const openCreate = () => {
    setEditingId(null);
    setFormData(defaultForm);
    setUnitRows([]);
    setBranchIds([]);
    setBranchSearch('');
    setError('');
    setIsModalOpen(true);
  };

  const openEdit = async (record) => {
    setEditingId(record.id);
    setFormData({
      name: record.name || '',
      sku: record.sku || '',
      barcode: record.barcode || '',
      categoryId: record.categoryId ? String(record.categoryId) : '',
      typeId: record.typeId ? String(record.typeId) : '',
      defaultUnitId: record.defaultUnitId ? String(record.defaultUnitId) : '',
      purchasePrice: record.purchasePrice || '',
      salePrice: record.salePrice || '',
      description: record.description || '',
    });
    const existingUnits = (record.units || []).map((u) => ({
      unitId: String(u.unitId || u.unit_id || ''),
      conversionFactor: String(u.conversionFactor ?? u.conversion_factor ?? '1'),
      isBaseUnit: !!u.isBaseUnit,
      isPurchaseUnit: !!u.isPurchaseUnit,
      isSaleUnit: !!u.isSaleUnit,
    }));
    setUnitRows(existingUnits);
    setBranchSearch('');
    // Load existing branch assignments for this product (only active ones)
    try {
      const existing = await productService.getBranchSettings({ productId: record.id });
      setBranchIds((existing || []).filter((s) => s.isAvailable !== false).map((s) => String(s.branchId)));
    } catch {
      setBranchIds([]);
    }
    setError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData(defaultForm);
    setUnitRows([]);
    setBranchIds([]);
    setBranchSearch('');
  };

  // Unit-row helpers
  const addUnitRow = () => setUnitRows((prev) => [...prev, defaultUnitRow()]);

  const removeUnitRow = (index) =>
    setUnitRows((prev) => prev.filter((_, i) => i !== index));

  const onUnitRowChange = (index, field, value) =>
    setUnitRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );

  const onFormChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const submitForm = async (event) => {
    event.preventDefault();
    setError('');

    const unitsPayload = unitRows
      .filter((row) => row.unitId)
      .map((row) => ({
        unitId: Number(row.unitId),
        conversionFactor: parseFloat(row.conversionFactor) || 1,
        isBaseUnit: row.isBaseUnit,
        isPurchaseUnit: row.isPurchaseUnit,
        isSaleUnit: row.isSaleUnit,
      }));

    const payload = {
      name: formData.name,
      sku: formData.sku || null,
      barcode: formData.barcode || null,
      categoryId: formData.categoryId ? Number(formData.categoryId) : null,
      typeId: formData.typeId ? Number(formData.typeId) : null,
      defaultUnitId: formData.defaultUnitId ? Number(formData.defaultUnitId) : null,
      purchasePrice: formData.purchasePrice ? Number(formData.purchasePrice) : 0,
      salePrice: formData.salePrice ? Number(formData.salePrice) : 0,
      description: formData.description || null,
      units: unitsPayload,
      branchIds: branchIds.map(Number),
    };

    try {
      if (editingId) {
        await productService.updateProduct(editingId, payload);
      } else {
        await productService.createProduct(payload);
      }
      closeModal();
      await loadProducts();
    } catch (submitError) {
      setError(submitError.message);
    }
  };

  const onToggleStatus = async (record) => {
    try {
      await productService.updateStatus(record.id, !record.isActive);
      await loadProducts();
    } catch (statusError) {
      setError(statusError.message);
    }
  };

  const productStats = useMemo(() => ({
    total: products.length,
    active: products.filter((p) => p.isActive).length,
    inactive: products.filter((p) => !p.isActive).length,
  }), [products]);

  return (
    <div className="dashboard-stack">
      <div className="page-stats-strip">
        <div className="page-stat-tile page-stat-tile--primary">
          <div className="page-stat-tile__label">Total Products</div>
          <div className="page-stat-tile__value">{productStats.total}</div>
        </div>
        <div className="page-stat-tile">
          <div className="page-stat-tile__label">Active</div>
          <div className="page-stat-tile__value">{productStats.active}</div>
        </div>
        <div className="page-stat-tile">
          <div className="page-stat-tile__label">Inactive</div>
          <div className="page-stat-tile__value">{productStats.inactive}</div>
        </div>
      </div>

      <PageCard
        title="Product Management"
        subtitle="Manage products, units, pricing, category, and type assignment"
        actions={
          <Button type="button" variant="primary" onClick={openCreate}>
            Add Product
          </Button>
        }
      >
        {error ? <p className="error-text">{error}</p> : null}
        {loading ? <Spinner center /> : null}

        <div className="table-filters">
          <label className="form-field table-filters__search" htmlFor="productSearch">
            <span>Search</span>
            <input
              id="productSearch"
              type="text"
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              placeholder="Search by name, SKU, barcode"
            />
          </label>

          <label className="form-field" htmlFor="productCategoryFilter">
            <span>Category</span>
            <select
              id="productCategoryFilter"
              value={filters.categoryId}
              onChange={(event) => setFilters((prev) => ({ ...prev, categoryId: event.target.value }))}
            >
              <option value="">All categories</option>
              {meta.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field" htmlFor="productTypeFilter">
            <span>Type</span>
            <select
              id="productTypeFilter"
              value={filters.typeId}
              onChange={(event) => setFilters((prev) => ({ ...prev, typeId: event.target.value }))}
            >
              <option value="">All types</option>
              {meta.types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="inline-actions inline-actions--end">
          <button type="button" className="secondary-action-button" onClick={() => loadProducts(filters)}>
            Apply Filters
          </button>
        </div>

        <div className="table-wrap table-wrap--full">
          <table className="data-table data-table--users">
            <thead>
              <tr>
                <th>Name</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Type</th>
                <th>Unit</th>
                <th>Sale Price</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {products.map((record) => (
                <tr key={record.id}>
                  <td>{record.name}</td>
                  <td>{record.sku || '-'}</td>
                  <td>{categoryById.get(record.categoryId) || '-'}</td>
                  <td>{typeById.get(record.typeId) || '-'}</td>
                  <td>{unitById.get(record.defaultUnitId) || '-'}</td>
                  <td>{record.salePrice || 0}</td>
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
              {!loading && products.length === 0 ? (
                <tr>
                  <td colSpan="8" className="empty-state-cell">
                    No products found for selected filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </PageCard>

      {isModalOpen ? (
        <ModalDialog
          title={editingId ? 'Edit Product' : 'Add Product'}
          subtitle="Set product master information"
          onClose={closeModal}
        >
          <form className="auth-form modal-form" onSubmit={submitForm}>
            <div className="modal-form-grid">
              <FormField label="Name" name="name" value={formData.name} onChange={onFormChange} required />
              <FormField label="SKU" name="sku" value={formData.sku} onChange={onFormChange} />
              <FormField label="Barcode" name="barcode" value={formData.barcode} onChange={onFormChange} />

              <label className="form-field" htmlFor="categoryId">
                <span>Category</span>
                <Select id="categoryId" name="categoryId" value={formData.categoryId} onChange={onFormChange} options={[{ value: '', label: 'Select category' }, ...(meta.categories || []).map((c) => ({ value: String(c.id), label: c.name }))]} />
              </label>

              <label className="form-field" htmlFor="typeId">
                <span>Type</span>
                <Select id="typeId" name="typeId" value={formData.typeId} onChange={onFormChange} options={[{ value: '', label: 'Select type' }, ...(meta.types || []).map((t) => ({ value: String(t.id), label: t.name }))]} />
              </label>

              <label className="form-field" htmlFor="defaultUnitId">
                <span>Default Unit</span>
                <Select id="defaultUnitId" name="defaultUnitId" value={formData.defaultUnitId} onChange={onFormChange} options={[{ value: '', label: 'Select unit' }, ...(meta.units || []).map((u) => ({ value: String(u.id), label: `${u.name} (${u.code})` }))]} />
              </label>

              <FormField
                label="Purchase Price"
                name="purchasePrice"
                type="number"
                min="0"
                step="0.01"
                value={formData.purchasePrice}
                onChange={onFormChange}
              />
              <FormField
                label="Sale Price"
                name="salePrice"
                type="number"
                min="0"
                step="0.01"
                value={formData.salePrice}
                onChange={onFormChange}
              />
            </div>

            <FormField
              label="Description"
              name="description"
              value={formData.description}
              onChange={onFormChange}
              placeholder="Optional product notes"
            />

            {/* Branch Availability */}
            {meta.branches.length > 0 && (
              <div className="branch-selector">
                <div className="branch-selector__header">
                  <span className="branch-selector__title">Branch Availability</span>
                  {branchIds.length > 0 && (
                    <span className="badge badge--blue">{branchIds.length} selected</span>
                  )}
                </div>
                <p className="branch-selector__hint">
                  Select which branches this product is available in. Branches not selected will have no branch setting created.
                </p>
                <div className="branch-selector__search">
                  <input
                    type="text"
                    placeholder="Search branches…"
                    value={branchSearch}
                    onChange={(e) => setBranchSearch(e.target.value)}
                  />
                </div>
                <div className="branch-selector__list">
                  {meta.branches
                    .filter((b) =>
                      branchSearch.trim() === '' ||
                      b.name.toLowerCase().includes(branchSearch.toLowerCase())
                    )
                    .map((branch) => {
                      const checked = branchIds.includes(String(branch.id));
                      return (
                        <label key={branch.id} className={`branch-selector__item${checked ? ' branch-selector__item--selected' : ''}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const id = String(branch.id);
                              setBranchIds((prev) =>
                                e.target.checked ? [...prev, id] : prev.filter((x) => x !== id)
                              );
                            }}
                          />
                          <span className="branch-selector__name">{branch.name}</span>
                          {branch.code && <span className="branch-selector__code">{branch.code}</span>}
                        </label>
                      );
                    })}
                </div>
                <div className="branch-selector__actions">
                  <button
                    type="button"
                    className="secondary-action-button"
                    onClick={() => setBranchIds(meta.branches.map((b) => String(b.id)))}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    className="secondary-action-button"
                    onClick={() => setBranchIds([])}
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            {/* Unit Conversion Mappings */}
            <div className="unit-mappings">
              <div className="unit-mappings__header">
                <span className="unit-mappings__title">Unit Conversions</span>
                <button type="button" className="secondary-action-button" onClick={addUnitRow}>
                  + Add Unit
                </button>
              </div>
              {unitRows.length > 0 && (
                <div className="unit-mappings__table-wrap">
                  <table className="data-table unit-mappings__table">
                    <thead>
                      <tr>
                        <th>Unit</th>
                        <th>Factor (to base)</th>
                        <th>Base</th>
                        <th>Buy</th>
                        <th>Sell</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {unitRows.map((row, index) => (
                        // eslint-disable-next-line react/no-array-index-key
                        <tr key={index}>
                          <td>
                            <select
                              value={row.unitId}
                              onChange={(e) => onUnitRowChange(index, 'unitId', e.target.value)}
                            >
                              <option value="">— select —</option>
                              {meta.units.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name} ({u.code})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0.0001"
                              step="any"
                              value={row.conversionFactor}
                              onChange={(e) =>
                                onUnitRowChange(index, 'conversionFactor', e.target.value)
                              }
                              style={{ width: '5rem' }}
                            />
                          </td>
                          <td className="text-center">
                            <input
                              type="checkbox"
                              checked={row.isBaseUnit}
                              onChange={(e) =>
                                onUnitRowChange(index, 'isBaseUnit', e.target.checked)
                              }
                            />
                          </td>
                          <td className="text-center">
                            <input
                              type="checkbox"
                              checked={row.isPurchaseUnit}
                              onChange={(e) =>
                                onUnitRowChange(index, 'isPurchaseUnit', e.target.checked)
                              }
                            />
                          </td>
                          <td className="text-center">
                            <input
                              type="checkbox"
                              checked={row.isSaleUnit}
                              onChange={(e) =>
                                onUnitRowChange(index, 'isSaleUnit', e.target.checked)
                              }
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              className="table-action-button table-action-button--danger"
                              onClick={() => removeUnitRow(index)}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {unitRows.length === 0 && (
                <p className="unit-mappings__empty">
                  No unit mappings yet. Click "+ Add Unit" to define how this product converts between units.
                </p>
              )}
            </div>

            <div className="inline-actions inline-actions--end">
              <Button type="button" variant="secondary" onClick={closeModal}>Cancel</Button>
              <Button type="submit" variant="primary">{editingId ? 'Update Product' : 'Create Product'}</Button>
            </div>
          </form>
        </ModalDialog>
      ) : null}
    </div>
  );
}