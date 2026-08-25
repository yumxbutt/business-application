import React, { useEffect, useMemo, useState } from 'react';
import PageCard from '../components/ui/PageCard';
import { Button, Select } from '../ui-kit';
import ModalDialog from '../components/ui/ModalDialog';
import FormField from '../components/ui/FormField';
import { productService } from '../services/productService';
import { inventoryService } from '../services/inventoryService';
import { settingsService } from '../services/settingsService';
import { openPrintWindow } from '../utils/printHelper';
import { formatBreakdown } from '../utils/stockDisplay';

export default function InventoryPage() {
  const [meta, setMeta] = useState({ branches: [], units: [], products: [], categories: [] });
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [stock, setStock] = useState([]);
  const [mode, setMode] = useState('all'); // 'all' | 'unit'
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState(''); // Filter by category
  const [expandedCategories, setExpandedCategories] = useState({}); // Track expanded categories
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [company, setCompany] = useState({});

  // Adjustment modal
  const [adjustModal, setAdjustModal] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ productId: '', qty: '', mode: 'set', reason: '' });
  const [adjustError, setAdjustError] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  const loadMeta = async () => {
    try {
      const data = await productService.getMeta();
      const prods = await productService.getProducts({});
      setMeta({
        branches: data.branches || [],
        units: data.units || [],
        products: prods || [],
        categories: data.categories || [],
      });
      if (data.branches && data.branches.length > 0) {
        setSelectedBranchId(String(data.branches[0].id));
      }
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    settingsService.getCompanySettings().then(setCompany).catch(() => {});
  }, []);

  // Compute filtered and grouped stock early (before functions that use it)
  const filteredAndGroupedStock = useMemo(() => {
    let filtered = stock;

    // Filter by search term (product name or SKU)
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (s) => s.productName.toLowerCase().includes(q) || (s.sku || '').toLowerCase().includes(q)
      );
    }

    // Filter by category
    if (selectedCategoryId) {
      filtered = filtered.filter((s) => String(s.categoryId) === selectedCategoryId);
    }

    // Group by category
    const grouped = {};
    filtered.forEach((item) => {
      const catId = String(item.categoryId || 'uncategorized');
      const catName = item.categoryName || 'Uncategorized';
      if (!grouped[catId]) {
        grouped[catId] = { categoryName: catName, items: [] };
      }
      grouped[catId].items.push(item);
    });

    // Sort categories alphabetically and items within each category by name
    return Object.entries(grouped)
      .sort(([, a], [, b]) => a.categoryName.localeCompare(b.categoryName))
      .map(([catId, data]) => ({
        categoryId: catId,
        categoryName: data.categoryName,
        items: data.items.sort((a, b) => a.productName.localeCompare(b.productName)),
      }));
  }, [stock, search, selectedCategoryId]);

  const handlePrintStock = () => {
    if (!selectedBranchId) return;
    const branchObj = meta.branches.find((b) => String(b.id) === selectedBranchId);
    const branchName = branchObj ? branchObj.name : 'Branch-' + selectedBranchId;

    let tableRows = '';
    filteredAndGroupedStock.forEach((group) => {
      // Add category header row
      tableRows += `<tr style="background-color: #f3f4f6; font-weight: bold;"><td colspan="3">${group.categoryName}</td></tr>`;
      // Add product rows
      group.items.forEach((item) => {
        const stockDisplay = item.mode === 'all'
          ? (item.breakdown || []).filter((b) => b.qty > 0).map((b) => b.qty + ' ' + b.unitCode).join('  ') || '0'
          : ((item.qty || 0) + ' ' + (item.unitCode || ''));
        tableRows += `<tr><td>${item.productName}</td><td>${item.sku || '–'}</td><td>${stockDisplay}</td></tr>`;
      });
    });

    const totalItems = filteredAndGroupedStock.reduce((sum, group) => sum + group.items.length, 0);
    const body = `<table>
      <thead><tr><th>Product</th><th>SKU</th><th>Stock</th></tr></thead>
      <tbody>${tableRows || '<tr><td colspan="3" style="text-align:center;padding:14px;color:#6b7280">No stock records.</td></tr>'}</tbody>
    </table>`;
    openPrintWindow({
      title: 'Inventory Report',
      titleBar: 'INVENTORY REPORT',
      company,
      metaFields: [
        ['Branch', branchName],
        ['Generated', new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })],
        ['Total Items', String(totalItems)],
      ],
      bodyHtml: body,
    });
  };

  const loadStock = async (branchId, opts = {}) => {
    if (!branchId) return;
    setLoading(true);
    setError('');
    try {
      const results = await inventoryService.getBranchStock(Number(branchId), {
        mode: opts.mode ?? mode,
        unitId: opts.unitId ?? (selectedUnitId ? Number(selectedUnitId) : undefined),
      });
      setStock(results);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeta();
  }, []);

  useEffect(() => {
    if (selectedBranchId) {
      loadStock(selectedBranchId);
    }
  }, [selectedBranchId]); // eslint-disable-line react-hooks/exhaustive-deps

  const onApplyView = () => {
    loadStock(selectedBranchId, { mode, unitId: mode === 'unit' && selectedUnitId ? Number(selectedUnitId) : undefined });
  };

  const openAdjustModal = (item) => {
    setAdjustForm({ productId: String(item.productId), qty: '', mode: 'set', reason: '' });
    setAdjustError('');
    setAdjustModal(true);
  };

  const handleAdjust = async (e) => {
    e.preventDefault();
    setAdjustError('');
    setAdjusting(true);
    try {
      const branchId = Number(selectedBranchId);
      const productId = Number(adjustForm.productId);
      const qty = parseFloat(adjustForm.qty);
      if (isNaN(qty)) throw new Error('Enter a valid quantity');

      if (adjustForm.mode === 'set') {
        await inventoryService.setStock({ branchId, productId, quantity: qty });
      } else {
        await inventoryService.adjustStock({
          branchId,
          productId,
          deltaQty: adjustForm.mode === 'add' ? qty : -qty,
          reason: adjustForm.reason,
        });
      }
      setAdjustModal(false);
      await loadStock(selectedBranchId);
    } catch (err) {
      setAdjustError(err.message);
    } finally {
      setAdjusting(false);
    }
  };

  const selectedProduct = adjustForm.productId
    ? meta.products.find((p) => String(p.id) === adjustForm.productId)
    : null;

  return (
    <div className="dashboard-stack">
      <div className="page-stats-strip">
        <div className="page-stat-tile">
          <span className="page-stat-tile__label">Product Categories</span>
          <span className="page-stat-tile__value">{filteredAndGroupedStock.length}</span>
        </div>
        <div className="page-stat-tile page-stat-tile--primary">
          <span className="page-stat-tile__label">Total SKUs</span>
          <span className="page-stat-tile__value">{filteredAndGroupedStock.reduce((s, g) => s + g.items.length, 0)}</span>
        </div>
        <div className="page-stat-tile page-stat-tile--danger">
          <span className="page-stat-tile__label">Out of Stock</span>
          <span className="page-stat-tile__value">{filteredAndGroupedStock.reduce((s, g) => s + g.items.filter((i) => Number(i.baseQty || 0) <= 0).length, 0)}</span>
        </div>
      </div>
      <PageCard
        title="Inventory"
        subtitle="View and manage stock levels per branch"
        actions={
          <Button variant="secondary" onClick={handlePrintStock} disabled={!selectedBranchId || filteredAndGroupedStock.length === 0}>
            &#128424; Print Stock Report
          </Button>
        }
      >
        {error ? <p className="error-text">{error}</p> : null}

        {/* Controls */}
        <div className="table-filters">
          <label className="form-field" htmlFor="inv-branch">
            <span>Branch</span>
            <Select
              id="inv-branch"
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              options={[{ value: '', label: '— select branch —' }, ...(meta.branches || []).map((b) => ({ value: String(b.id), label: b.name }))]}
            />
          </label>

          <label className="form-field" htmlFor="inv-category">
            <span>Category</span>
            <Select
              id="inv-category"
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              options={[{ value: '', label: '— all categories —' }, ...(meta.categories || []).map((c) => ({ value: String(c.id), label: c.name }))]}
            />
          </label>

          <label className="form-field" htmlFor="inv-mode">
            <span>Display mode</span>
            <Select
              id="inv-mode"
              value={mode}
              onChange={(e) => {
                setMode(e.target.value);
                if (e.target.value === 'all') setSelectedUnitId('');
              }}
              options={[{ value: 'all', label: 'All units (breakdown)' }, { value: 'unit', label: 'Single unit' }]}
            />
          </label>

          {mode === 'unit' && (
            <label className="form-field" htmlFor="inv-unit">
              <span>Unit</span>
              <Select
                id="inv-unit"
                value={selectedUnitId}
                onChange={(e) => setSelectedUnitId(e.target.value)}
                options={[{ value: '', label: '— select unit —' }, ...(meta.units || []).map((u) => ({ value: String(u.id), label: `${u.name} (${u.code})` }))]}
              />
            </label>
          )}

          <label className="form-field table-filters__search" htmlFor="inv-search">
            <span>Search</span>
            <input
              id="inv-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Product name or SKU"
            />
          </label>
        </div>

        <div className="inline-actions inline-actions--end">
          <button
            type="button"
            className="secondary-action-button"
            onClick={() => {
              const allExpanded = filteredAndGroupedStock.every((g) => expandedCategories[g.categoryId]);
              if (allExpanded) {
                setExpandedCategories({});
              } else {
                const newExpanded = {};
                filteredAndGroupedStock.forEach((g) => {
                  newExpanded[g.categoryId] = true;
                });
                setExpandedCategories(newExpanded);
              }
            }}
          >
            {filteredAndGroupedStock.every((g) => expandedCategories[g.categoryId]) ? 'Collapse All' : 'Expand All'}
          </button>
          <button
            type="button"
            className="secondary-action-button"
            onClick={onApplyView}
            disabled={!selectedBranchId}
          >
            Refresh
          </button>
          <button type="button" className="secondary-action-button" onClick={handlePrintStock} disabled={!selectedBranchId || filteredAndGroupedStock.length === 0}>
            &#128424; Print Stock Report
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <p>Loading stock…</p>
        ) : (
          <div className="table-wrap table-wrap--full">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40%' }}>Product</th>
                  <th style={{ width: '20%' }}>SKU</th>
                  <th style={{ width: '25%' }}>Stock</th>
                  <th className="text-right" style={{ width: '15%' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndGroupedStock.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="empty-state-cell">
                      {selectedBranchId
                        ? 'No stock records found for this branch.'
                        : 'Select a branch to view stock.'}
                    </td>
                  </tr>
                ) : null}

                {filteredAndGroupedStock.map((categoryGroup) => (
                  <React.Fragment key={categoryGroup.categoryId}>
                    {/* Category Header Row */}
                    <tr
                      style={{
                        backgroundColor: '#f3f4f6',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                      }}
                      onClick={() => {
                        setExpandedCategories((p) => ({
                          ...p,
                          [categoryGroup.categoryId]: !p[categoryGroup.categoryId],
                        }));
                      }}
                    >
                      <td colSpan="4">
                        <span style={{ marginRight: '8px' }}>
                          {expandedCategories[categoryGroup.categoryId] ? '▼' : '▶'}
                        </span>
                        {categoryGroup.categoryName} ({categoryGroup.items.length})
                      </td>
                    </tr>

                    {/* Product Rows */}
                    {expandedCategories[categoryGroup.categoryId] && categoryGroup.items.map((item) => (
                      <tr key={item.productId}>
                        <td>{item.productName}</td>
                        <td>{item.sku || '–'}</td>
                        <td>
                          {item.mode === 'all' ? (
                            <span className="stock-breakdown">{formatBreakdown(item.breakdown)}</span>
                          ) : (
                            <span>
                              {item.qty ?? 0} {item.unitCode}
                            </span>
                          )}
                        </td>
                        <td className="text-right">
                          <button
                            type="button"
                            className="table-action-button"
                            onClick={() => openAdjustModal(item)}
                          >
                            Adjust
                          </button>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageCard>

      {/* Adjust / Set Stock Modal */}
      {adjustModal ? (
        <ModalDialog
          title="Adjust Stock"
          subtitle={selectedProduct ? selectedProduct.name : ''}
          onClose={() => setAdjustModal(false)}
        >
          <form className="auth-form modal-form" onSubmit={handleAdjust}>
            {adjustError ? <p className="error-text">{adjustError}</p> : null}

            <label className="form-field" htmlFor="adj-mode">
              <span>Operation</span>
              <select
                id="adj-mode"
                value={adjustForm.mode}
                onChange={(e) => setAdjustForm((p) => ({ ...p, mode: e.target.value }))}
              >
                <option value="set">Set absolute quantity</option>
                <option value="add">Add to stock (+)</option>
                <option value="remove">Remove from stock (−)</option>
              </select>
            </label>

            <FormField
              label={adjustForm.mode === 'set' ? 'New quantity (base units)' : 'Quantity (base units)'}
              name="qty"
              type="number"
              min={adjustForm.mode === 'set' ? '0' : '0.0001'}
              step="any"
              value={adjustForm.qty}
              onChange={(e) => setAdjustForm((p) => ({ ...p, qty: e.target.value }))}
              required
            />

            {adjustForm.mode !== 'set' && (
              <FormField
                label="Reason (optional)"
                name="reason"
                value={adjustForm.reason}
                onChange={(e) => setAdjustForm((p) => ({ ...p, reason: e.target.value }))}
                placeholder="e.g. Goods received, Damaged stock"
              />
            )}

            <div className="inline-actions inline-actions--end">
              <button type="button" className="secondary-action-button" onClick={() => setAdjustModal(false)}>
                Cancel
              </button>
              <button type="submit" disabled={adjusting}>
                {adjusting ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </form>
        </ModalDialog>
      ) : null}
    </div>
  );
}
