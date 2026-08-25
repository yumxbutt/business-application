import { useCallback, useEffect, useRef, useState } from 'react';
import PageCard from '../components/ui/PageCard';
import { Button, Select } from '../ui-kit';
import ModalDialog from '../components/ui/ModalDialog';
import FormField from '../components/ui/FormField';
import { useAuth } from '../context/AuthContext';
import { useAccess } from '../hooks/useAccess';
import { productService } from '../services/productService';
import { stockTransferService } from '../services/stockTransferService';
import { inventoryService } from '../services/inventoryService';

const today = new Date().toISOString().slice(0, 10);
const monthStart = `${today.slice(0, 8)}01`;

const blankItem = () => ({
  productId: '',
  productName: '',
  quantity: '1',
  notes: '',
  availableQty: null,
});

const blankForm = (fromBranchId = '', toBranchId = '') => ({
  fromBranchId,
  toBranchId,
  transferDate: today,
  transferNo: '',
  remarks: '',
});

export default function StockTransferPage() {
  const { user } = useAuth();
  const { has } = useAccess();
  const canTransfer = has('inventory:transfer');
  const [branches, setBranches] = useState([]);
  const defaultBranchId = user?.role === 'main_admin' ? '' : String(user?.branchId || '');
  const [filters, setFilters] = useState({
    branchId: defaultBranchId,
    status: 'all',
    startDate: monthStart,
    endDate: today,
  });
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [viewTransfer, setViewTransfer] = useState(null);
  const [form, setForm] = useState(() => blankForm(defaultBranchId));
  const [items, setItems] = useState([blankItem()]);
  const [itemSearch, setItemSearch] = useState([{ query: '', results: [], open: false }]);
  const searchTimers = useRef([]);

  const loadTransfers = async (nextFilters = filters) => {
    setLoading(true);
    setError('');
    try {
      const data = await stockTransferService.listTransfers({
        branchId: nextFilters.branchId ? Number(nextFilters.branchId) : undefined,
        status: nextFilters.status,
        startDate: nextFilters.startDate || undefined,
        endDate: nextFilters.endDate || undefined,
      });
      setTransfers(data);
    } catch (err) {
      setError(err.message || 'Failed to load transfers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    productService.getMeta().then((meta) => {
      const list = meta.branches || [];
      setBranches(list);
      if (user?.role === 'main_admin' && !filters.branchId && list[0]) {
        const branchId = String(list[0].id);
        setFilters((prev) => ({ ...prev, branchId }));
        setForm(blankForm(branchId));
      }
    }).catch(() => {});
  }, [user?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadTransfers();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onFormChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const triggerProductSearch = useCallback((index, q) => {
    clearTimeout(searchTimers.current[index]);
    if (!q || q.length < 2) {
      setItemSearch((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], results: [], open: false };
        return next;
      });
      return;
    }
    searchTimers.current[index] = setTimeout(async () => {
      try {
        const results = await productService.searchProducts(q);
        setItemSearch((prev) => {
          const next = [...prev];
          next[index] = { ...next[index], results, open: true };
          return next;
        });
      } catch {
        // ignore search errors
      }
    }, 300);
  }, []);

  const onItemSearchChange = (index, query) => {
    setItemSearch((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], query };
      return next;
    });
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...blankItem(), productName: query };
      return next;
    });
    triggerProductSearch(index, query);
  };

  const selectProduct = async (index, product) => {
    const fromBranchId = Number(form.fromBranchId || user?.branchId || 0);
    let availableQty = null;
    if (fromBranchId) {
      try {
        const stock = await inventoryService.getProductStock(fromBranchId, product.id, { mode: 'all' });
        availableQty = Number(stock.baseQty || 0);
      } catch {
        availableQty = 0;
      }
    }

    setItems((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        productId: String(product.id),
        productName: product.name,
        availableQty,
      };
      return next;
    });
    setItemSearch((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], query: product.name, results: [], open: false };
      return next;
    });
  };

  const addItemRow = () => {
    setItems((prev) => [...prev, blankItem()]);
    setItemSearch((prev) => [...prev, { query: '', results: [], open: false }]);
  };

  const removeItemRow = (index) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((_, idx) => idx !== index));
    setItemSearch((prev) => prev.filter((_, idx) => idx !== index));
  };

  const openCreate = () => {
    setError('');
    const fromId = user?.role === 'main_admin'
      ? (filters.branchId || defaultBranchId)
      : String(user?.branchId || defaultBranchId || '');
    setForm(blankForm(fromId));
    setItems([blankItem()]);
    setItemSearch([{ query: '', results: [], open: false }]);
    setShowForm(true);
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        fromBranchId: form.fromBranchId ? Number(form.fromBranchId) : undefined,
        toBranchId: Number(form.toBranchId),
        transferDate: form.transferDate,
        transferNo: form.transferNo || undefined,
        remarks: form.remarks || undefined,
        items: items.map((item) => ({
          productId: Number(item.productId),
          quantity: Number(item.quantity),
          notes: item.notes || undefined,
        })),
      };
      await stockTransferService.createTransfer(payload);
      setShowForm(false);
      await loadTransfers(filters);
    } catch (err) {
      setError(err.message || 'Failed to create transfer');
    } finally {
      setSaving(false);
    }
  };

  const onCancelTransfer = async (transfer) => {
    const yes = window.confirm(`Cancel transfer ${transfer.transferNo || transfer.id}?`);
    if (!yes) return;
    setError('');
    try {
      await stockTransferService.cancelTransfer(transfer.id);
      await loadTransfers(filters);
    } catch (err) {
      setError(err.message || 'Failed to cancel transfer');
    }
  };

  const openView = async (transfer) => {
    setError('');
    try {
      const detail = await stockTransferService.getTransfer(transfer.id);
      setViewTransfer(detail);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="dashboard-stack">
      <PageCard
        title="Stock Transfers"
        subtitle="Move inventory between branches"
        actions={
          canTransfer ? (
            <Button variant="primary" className="no-print" onClick={openCreate}>
              New Transfer
            </Button>
          ) : null
        }
      >
        {error ? <p className="error-text">{error}</p> : null}

        <div className="table-filters no-print">
          {user?.role === 'main_admin' ? (
            <label className="form-field" htmlFor="transferBranchFilter">
              <span>Branch</span>
              <Select
                id="transferBranchFilter"
                value={filters.branchId}
                onChange={(e) => setFilters((p) => ({ ...p, branchId: e.target.value }))}
                options={[{ value: '', label: 'All branches' }, ...branches.map((b) => ({ value: String(b.id), label: b.name }))]}
              />
            </label>
          ) : null}
          <label className="form-field" htmlFor="transferStatus">
            <span>Status</span>
            <Select
              id="transferStatus"
              value={filters.status}
              onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
              options={[
                { value: 'all', label: 'All' },
                { value: 'posted', label: 'Posted' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
            />
          </label>
          <label className="form-field" htmlFor="transferStart">
            <span>From</span>
            <input id="transferStart" type="date" value={filters.startDate}
              onChange={(e) => setFilters((p) => ({ ...p, startDate: e.target.value }))} />
          </label>
          <label className="form-field" htmlFor="transferEnd">
            <span>To</span>
            <input id="transferEnd" type="date" value={filters.endDate}
              onChange={(e) => setFilters((p) => ({ ...p, endDate: e.target.value }))} />
          </label>
          <button type="button" className="primary-action-button" style={{ alignSelf: 'flex-end' }}
            onClick={() => loadTransfers(filters)}>
            Apply
          </button>
        </div>

        {loading ? (
          <p>Loading transfers…</p>
        ) : (
          <div className="table-wrap table-wrap--full">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Transfer No</th>
                  <th>Date</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Status</th>
                  <th className="text-right">Items</th>
                  <th className="text-right no-print">Action</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((row) => (
                  <tr key={row.id}>
                    <td>{row.transferNo || row.id}</td>
                    <td>{row.transferDate}</td>
                    <td>{row.fromBranch?.name || '–'}</td>
                    <td>{row.toBranch?.name || '–'}</td>
                    <td>
                      <span className={row.status === 'posted' ? 'badge badge--green' : 'badge badge--red'}>
                        {row.status}
                      </span>
                    </td>
                    <td className="text-right">{(row.items || []).length}</td>
                    <td className="text-right no-print">
                      <div className="inline-actions inline-actions--end">
                        <button type="button" className="table-action-button" onClick={() => openView(row)}>
                          View
                        </button>
                        <button
                          type="button"
                          className="table-action-button table-action-button--danger"
                          onClick={() => onCancelTransfer(row)}
                          disabled={row.status === 'cancelled'}
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {transfers.length === 0 ? (
                  <tr><td colSpan="7" className="empty-state-cell">No stock transfers found.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </PageCard>

      {showForm ? (
        <ModalDialog
          title="New Stock Transfer"
          subtitle="Transfer products from one branch to another"
          onClose={() => setShowForm(false)}
        >
          <form className="auth-form" onSubmit={onSubmit}>
            <div className="table-filters">
              <label className="form-field" htmlFor="fromBranchId">
                <span>From Branch</span>
                <Select
                  id="fromBranchId"
                  name="fromBranchId"
                  value={form.fromBranchId}
                  onChange={onFormChange}
                  required={user?.role === 'main_admin'}
                  disabled={user?.role !== 'main_admin'}
                  options={[
                    ...(user?.role === 'main_admin' ? [{ value: '', label: 'Select source branch' }] : []),
                    ...(user?.role === 'main_admin'
                      ? branches.map((b) => ({ value: String(b.id), label: b.name }))
                      : branches
                          .filter((b) => String(b.id) === String(user?.branchId))
                          .map((b) => ({ value: String(b.id), label: b.name }))),
                  ]}
                />
              </label>
              <label className="form-field" htmlFor="toBranchId">
                <span>To Branch</span>
                <Select
                  id="toBranchId"
                  name="toBranchId"
                  value={form.toBranchId}
                  onChange={onFormChange}
                  required
                  options={[{ value: '', label: 'Select destination branch' }, ...branches.map((b) => ({ value: String(b.id), label: b.name }))]}
                />
              </label>
              <FormField label="Date" name="transferDate" type="date" value={form.transferDate} onChange={onFormChange} required />
              <FormField label="Transfer No" name="transferNo" value={form.transferNo} onChange={onFormChange} placeholder="Auto-generated if blank" />
              <FormField label="Remarks" name="remarks" value={form.remarks} onChange={onFormChange} />
            </div>

            <div className="table-wrap table-wrap--full" style={{ marginTop: '1rem' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="text-right">Available</th>
                    <th className="text-right">Qty</th>
                    <th>Notes</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={index}>
                      <td style={{ position: 'relative' }}>
                        <input
                          type="text"
                          value={itemSearch[index]?.query ?? item.productName}
                          onChange={(e) => onItemSearchChange(index, e.target.value)}
                          placeholder="Search product…"
                          required
                        />
                        {itemSearch[index]?.open && itemSearch[index]?.results?.length > 0 ? (
                          <div className="search-dropdown">
                            {itemSearch[index].results.map((product) => (
                              <button
                                key={product.id}
                                type="button"
                                className="search-dropdown__item"
                                onClick={() => selectProduct(index, product)}
                              >
                                {product.name} {product.sku ? `(${product.sku})` : ''}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </td>
                      <td className="text-right">{item.availableQty != null ? item.availableQty : '–'}</td>
                      <td className="text-right">
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => setItems((prev) => {
                            const next = [...prev];
                            next[index] = { ...next[index], quantity: e.target.value };
                            return next;
                          })}
                          required
                          style={{ width: '90px' }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={item.notes}
                          onChange={(e) => setItems((prev) => {
                            const next = [...prev];
                            next[index] = { ...next[index], notes: e.target.value };
                            return next;
                          })}
                        />
                      </td>
                      <td className="text-right">
                        <button type="button" className="table-action-button" onClick={() => removeItemRow(index)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="inline-actions" style={{ marginTop: '0.75rem' }}>
              <button type="button" className="secondary-action-button" onClick={addItemRow}>
                Add Line
              </button>
            </div>

            {error ? <p className="error-text">{error}</p> : null}
            <div className="inline-actions inline-actions--end" style={{ marginTop: '1rem' }}>
              <button type="button" className="secondary-action-button" onClick={() => setShowForm(false)} disabled={saving}>
                Cancel
              </button>
              <button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Create Transfer'}
              </button>
            </div>
          </form>
        </ModalDialog>
      ) : null}

      {viewTransfer ? (
        <ModalDialog
          title={`Transfer ${viewTransfer.transferNo || viewTransfer.id}`}
          subtitle={`${viewTransfer.transferDate} · ${viewTransfer.fromBranch?.name} → ${viewTransfer.toBranch?.name}`}
          onClose={() => setViewTransfer(null)}
        >
          <div className="table-wrap table-wrap--full">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="text-right">Quantity</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {(viewTransfer.items || []).map((item) => (
                  <tr key={item.id}>
                    <td>{item.product?.name || item.productId}</td>
                    <td className="text-right">{Number(item.quantity || 0)}</td>
                    <td>{item.notes || '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ModalDialog>
      ) : null}
    </div>
  );
}
