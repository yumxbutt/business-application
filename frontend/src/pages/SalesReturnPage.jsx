import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageCard from '../components/ui/PageCard';
import ModalDialog from '../components/ui/ModalDialog';
import { salesService } from '../services/salesService';
import { productService } from '../services/productService';
import { ledgerService } from '../services/ledgerService';
import { settingsService } from '../services/settingsService';
import { openPrintWindow, fmtPrintDate, fmtNum } from '../utils/printHelper';
import Spinner from '../components/ui/Spinner';

const toNumber = (v) => Number(v || 0);
const defaultReturnFilters = { startDate: '', endDate: '' };

/**
 * Given the sale unit's conversion factor, the returnable base qty,
 * and all product-unit rows, compute which units the user may choose
 * for entering return qty.
 *
 * Rules:
 *  1. unit.conversionFactor <= saleUnitFactor  (can't return in bigger unit than sold)
 *  2. returnableBase is evenly divisible by the unit's factor (no fractional units)
 */
function buildAvailableReturnUnits(saleUnitFactor, returnableBase, allProductUnits) {
  if (!allProductUnits || allProductUnits.length === 0) {
    return [{ unitId: '', unitCode: '', unitName: 'Base', conversionFactor: 1 }];
  }
  const candidates = allProductUnits
    .map((u) => ({
      unitId: String(u.unitId || u.unit?.id || ''),
      unitCode: u.unit?.code || '',
      unitName: u.unit?.name || '',
      conversionFactor: toNumber(u.conversionFactor) || 1,
    }))
    .filter((u) => {
      if (u.unitId === '') return false;
      if (u.conversionFactor > saleUnitFactor + 0.00001) return false; // bigger than sale unit
      if (returnableBase < 0.0001) return false; // nothing returnable
      const qty = returnableBase / u.conversionFactor;
      return Math.abs(qty - Math.round(qty)) < 0.0001; // must be integer-divisible
    })
    .sort((a, b) => b.conversionFactor - a.conversionFactor); // largest first

  return candidates.length > 0
    ? candidates
    : [{ unitId: '', unitCode: '', unitName: 'Base', conversionFactor: 1 }];
}

export default function SalesReturnPage() {
  const [searchParams] = useSearchParams();
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceSearchResults, setInvoiceSearchResults] = useState([]);
  const [invoiceSearchOpen, setInvoiceSearchOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);

  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [returnItems, setReturnItems] = useState([]);
  const [customerLedgerBalance, setCustomerLedgerBalance] = useState(null);

  const [returns, setReturns] = useState([]);
  const [returnFilters, setReturnFilters] = useState(defaultReturnFilters);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [company, setCompany] = useState({});
  const [viewReturn, setViewReturn] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [editingReturn, setEditingReturn] = useState(null);
  const [editForm, setEditForm] = useState({ returnDate: '', reason: '' });
  const [editSaving, setEditSaving] = useState(false);

  const searchTimer = useRef(null);

  const loadReturns = async (filters = returnFilters) => {
    setLoading(true);
    try {
      const data = await salesService.getReturns(filters);
      setReturns(data);
    } catch (err) {
      setError(err.message || 'Failed to load sales returns');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReturns();
    settingsService.getCompanySettings().then(setCompany).catch(() => {});

    const saleIdParam = searchParams.get('saleId');
    const invoiceNoParam = searchParams.get('invoiceNo');
    if (invoiceNoParam) {
      setInvoiceSearch(invoiceNoParam);
    }
    if (saleIdParam) {
      loadSaleForReturn(Number(saleIdParam));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openViewReturn = async (entry) => {
    setViewLoading(true);
    try {
      const detail = await salesService.getReturn(entry.id);
      setViewReturn(detail || entry);
    } catch (err) {
      alert(`Could not load return details: ${err.message || 'Error'}`);
    } finally {
      setViewLoading(false);
    }
  };

  const printReturn = async (entry) => {
    try {
      const detail = await salesService.getReturn(entry.id);
      const ret = detail || entry;
      const itemRows = (ret.items || []).map((item, i) => {
        return `<tr>
          <td>${i + 1}</td>
          <td>${item.product?.name || '–'}</td>
          <td class="tr">${fmtNum(item.quantity)}</td>
          <td class="tr">${fmtNum(item.unitPrice)}</td>
          <td class="tr">${fmtNum(item.lineAmount || Number(item.quantity) * Number(item.unitPrice))}</td>
        </tr>`;
      }).join('');

      const body = `
        <table>
          <thead><tr><th>#</th><th>Product</th><th class="tr">Qty</th><th class="tr">Unit Price</th><th class="tr">Amount</th></tr></thead>
          <tbody>${itemRows || '<tr><td colspan="5" style="text-align:center;padding:10px;color:#6b7280">No items</td></tr>'}</tbody>
          <tfoot><tr><td colspan="4">Total Return Amount</td><td class="tr">${fmtNum(ret.totalAmount)}</td></tr></tfoot>
        </table>
        ${ret.contactBalance != null ? `
        <div class="tot" style="margin-top:8px">
          <div class="tot-row" style="background:#fef9c3;font-weight:700"><span>Current Customer Balance (After Return)</span><span>${ret.contactBalance >= 0 ? fmtNum(ret.contactBalance) + ' Dr' : fmtNum(Math.abs(ret.contactBalance)) + ' Cr'}</span></div>
        </div>` : ''}`;

      openPrintWindow({
        title: 'Sales Return',
        titleBar: 'SALES RETURN',
        company,
        metaFields: [
          ['Return Date', fmtPrintDate(ret.returnDate)],
          ['Invoice', ret.sale?.invoiceNo || entry.sale?.invoiceNo || '–'],
          ['Customer', ret.contact?.name || entry.contact?.name || '–'],
          ['Reason', ret.reason || entry.reason || '–'],
        ],
        bodyHtml: body,
        showSignatures: true,
      });
    } catch (err) {
      alert(`Could not load return details: ${err.message || 'Error'}`);
    }
  };

  const loadSaleForReturn = async (saleId) => {
    setError('');
    try {
      const sale = await salesService.getSale(saleId);
      if (!sale) { setError('Sale not found'); return; }

      const existingReturns = await salesService.getReturns({ saleId });
      const alreadyReturnedMap = new Map();
      for (const ret of existingReturns) {
        for (const ri of (ret.items || [])) {
          alreadyReturnedMap.set(ri.saleItemId, (alreadyReturnedMap.get(ri.saleItemId) || 0) + toNumber(ri.quantity));
        }
      }

      // Fetch product units for all unique products in parallel
      const uniqueProductIds = [...new Set((sale.items || []).map((i) => i.productId))];
      const unitsByProduct = new Map();
      await Promise.all(
        uniqueProductIds.map(async (pid) => {
          try {
            const rows = await productService.getProductUnits(pid);
            unitsByProduct.set(pid, rows || []);
          } catch {
            unitsByProduct.set(pid, []);
          }
        })
      );

      setInvoiceSearch(sale.invoiceNo);
      setInvoiceSearchOpen(false);
      setInvoiceSearchResults([]);
      setSelectedSale(sale);

      setReturnItems(
        (sale.items || []).map((item) => {
          const saleUnitFactor = toNumber(item.conversionFactor) || 1;
          const hasUnit = item.unitQty != null && saleUnitFactor > 1;

          // Base quantities (fixed, used for backend)
          const originalQtyBase = toNumber(item.quantity);
          const alreadyReturnedBase = alreadyReturnedMap.get(item.id) || 0;
          const returnableBase = Math.max(0, originalQtyBase - alreadyReturnedBase);

          // Display quantities in sale unit
          const originalQtyDisplay = hasUnit ? toNumber(item.unitQty) : originalQtyBase;
          const alreadyReturnedDisplay = hasUnit ? alreadyReturnedBase / saleUnitFactor : alreadyReturnedBase;

          // Base unit price (what backend expects)
          const baseUnitPrice = toNumber(item.unitPrice);

          // Build available return units and default to sale unit
          const allUnits = unitsByProduct.get(item.productId) || [];
          const availableUnits = buildAvailableReturnUnits(saleUnitFactor, returnableBase, allUnits);

          // Default selected unit = the unit used in the original sale
          const defaultUnit =
            availableUnits.find((u) => Math.abs(u.conversionFactor - saleUnitFactor) < 0.0001) ||
            availableUnits[0];

          const selectedUnitFactor = defaultUnit.conversionFactor;
          const returnableInUnit = selectedUnitFactor > 1
            ? Math.floor(returnableBase / selectedUnitFactor)
            : returnableBase;

          return {
            saleItemId: item.id,
            productId: item.productId,
            productName: item.product?.name || `Product #${item.productId}`,

            // Sale context (shown fixed in Sold / Already Returned columns)
            saleUnitCode: item.unit?.code || '',
            saleUnitFactor,
            originalQtyDisplay,          // in sale unit
            alreadyReturnedDisplay,      // in sale unit

            // Base qty — never changes
            returnableBase,
            baseUnitPrice,

            // Unit selection state
            availableUnits,
            selectedUnitId: defaultUnit.unitId,
            selectedUnitFactor,
            selectedUnitCode: defaultUnit.unitCode,

            // Derived from selected unit (updated when unit changes)
            returnable: returnableInUnit,
            unitPrice: baseUnitPrice * selectedUnitFactor,

            returnQty: '',
          };
        })
      );
    } catch (err) {
      setError(err.message || 'Failed to load sale');
    }
  };

  useEffect(() => {
    if (!selectedSale?.contact?.id) {
      setCustomerLedgerBalance(null);
      return;
    }

    ledgerService.getContactLedger(selectedSale.contact.id)
      .then((data) => {
        const entries = data.entries || [];
        const last = entries[entries.length - 1];
        setCustomerLedgerBalance(last ? Number(last.runningBalance || 0) : 0);
      })
      .catch(() => setCustomerLedgerBalance(null));
  }, [selectedSale?.contact?.id]);

  const triggerSaleSearch = (q) => {
    clearTimeout(searchTimer.current);
    if (!q || q.length < 2) {
      setInvoiceSearchResults([]);
      setInvoiceSearchOpen(false);
      return;
    }

    searchTimer.current = setTimeout(async () => {
      try {
        const results = await salesService.getSales({ search: q, status: 'posted' });
        setInvoiceSearchResults(results.slice(0, 8));
        setInvoiceSearchOpen(true);
      } catch {
        // invoice search failed
      }
    }, 300);
  };

  const onInvoiceSearchChange = (event) => {
    const q = event.target.value;
    setInvoiceSearch(q);
    setSelectedSale(null);
    setReturnItems([]);
    triggerSaleSearch(q);
  };

  const onSelectSale = (sale) => {
    loadSaleForReturn(sale.id);
  };

  const onReturnQtyChange = (index, value) => {
    setReturnItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], returnQty: value };
      return next;
    });
  };

  const onReturnUnitChange = (index, unitId) => {
    setReturnItems((prev) => {
      const next = [...prev];
      const ri = next[index];
      const unit = ri.availableUnits.find((u) => u.unitId === unitId) || ri.availableUnits[0];
      const newFactor = unit.conversionFactor;
      const returnableInUnit = newFactor > 1
        ? Math.floor(ri.returnableBase / newFactor)
        : ri.returnableBase;
      next[index] = {
        ...ri,
        selectedUnitId: unit.unitId,
        selectedUnitFactor: newFactor,
        selectedUnitCode: unit.unitCode,
        returnable: returnableInUnit,
        unitPrice: ri.baseUnitPrice * newFactor,
        returnQty: '', // reset qty on unit change to avoid invalid entries
      };
      return next;
    });
  };

  const totalReturnAmount = returnItems.reduce((sum, ri) => {
    return sum + toNumber(ri.returnQty) * toNumber(ri.unitPrice);
  }, 0);

  const submitReturn = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const activeItems = returnItems.filter((ri) => toNumber(ri.returnQty) > 0);
    if (activeItems.length === 0) {
      setError('Enter a return quantity for at least one item.');
      return;
    }

    for (const ri of activeItems) {
      if (toNumber(ri.returnQty) > ri.returnable + 0.00001) {
        setError(`Return qty for "${ri.productName}" exceeds returnable qty (${ri.returnable} ${ri.selectedUnitCode}).`);
        return;
      }
    }

    setSubmitting(true);
    try {
      await salesService.createReturn({
        saleIdReference: selectedSale.id,
        branchId: selectedSale.branchId ? Number(selectedSale.branchId) : undefined,
        returnDate,
        reason: reason || undefined,
        items: activeItems.map((ri) => ({
          saleItemId: ri.saleItemId,
          // Convert selected-unit qty → base qty for backend
          quantity: toNumber(ri.returnQty) * (ri.selectedUnitFactor || 1),
          // Always send BASE unit price — backend computes line amount in base
          unitPrice: toNumber(ri.baseUnitPrice),
        })),
      });

      setSuccess(`Return for ${selectedSale.invoiceNo} saved successfully.`);
      setSelectedSale(null);
      setInvoiceSearch('');
      setReturnItems([]);
      setReason('');
      setReturnDate(new Date().toISOString().split('T')[0]);
      await loadReturns();
    } catch (err) {
      setError(err.message || 'Failed to save return');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReturn = async (entry) => {
    const yes = window.confirm(
      `Delete return for invoice "${entry.sale?.invoiceNo || '#' + entry.id}"?\n\nThis will reverse inventory and ledger entries.`
    );
    if (!yes) return;

    setDeletingId(entry.id);
    setError('');
    try {
      await salesService.cancelReturn(entry.id);
      if (viewReturn && viewReturn.id === entry.id) {
        setViewReturn(null);
      }
      await loadReturns();
    } catch (err) {
      setError(err.message || 'Failed to delete return');
    } finally {
      setDeletingId(null);
    }
  };

  const handleOpenEdit = (ret) => {
    setEditingReturn(ret);
    setEditForm({ returnDate: ret.returnDate || '', reason: ret.reason || '' });
  };

  const handleSaveEdit = async () => {
    if (!editingReturn) return;

    setEditSaving(true);
    setError('');
    try {
      const updated = await salesService.updateReturn(editingReturn.id, {
        returnDate: editForm.returnDate || undefined,
        reason: editForm.reason,
      });
      setEditingReturn(null);
      if (viewReturn && viewReturn.id === editingReturn.id) {
        setViewReturn(updated);
      }
      await loadReturns();
    } catch (err) {
      setError(err.message || 'Failed to update return');
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="dashboard-stack">
      {viewReturn && (
        <SalesReturnViewModal
          ret={viewReturn}
          onClose={() => setViewReturn(null)}
          onPrint={(ret) => { setViewReturn(null); printReturn(ret); }}
          onEdit={(ret) => handleOpenEdit(ret)}
          onDelete={(ret) => handleDeleteReturn(ret)}
          deletingId={deletingId}
        />
      )}

      {editingReturn && (
        <ModalDialog
          title={`Edit Return — ${editingReturn.sale?.invoiceNo || '#' + editingReturn.id}`}
          subtitle="Update return date or reason (quantities cannot be changed)"
          onClose={() => setEditingReturn(null)}
        >
          <div className="modal-form-grid">
            <label className="form-field" htmlFor="sr-date">
              <span>Return Date</span>
              <input
                id="sr-date"
                type="date"
                value={editForm.returnDate}
                onChange={(e) => setEditForm((p) => ({ ...p, returnDate: e.target.value }))}
              />
            </label>

            <label className="form-field" htmlFor="sr-reason">
              <span>Reason</span>
              <input
                id="sr-reason"
                type="text"
                value={editForm.reason}
                placeholder="Optional reason"
                onChange={(e) => setEditForm((p) => ({ ...p, reason: e.target.value }))}
              />
            </label>
          </div>

          {error ? <p className="error-text">{error}</p> : null}

          <div className="inline-actions inline-actions--end" style={{ marginTop: '1rem' }}>
            <button type="button" className="secondary-action-button" onClick={() => setEditingReturn(null)} disabled={editSaving}>
              Cancel
            </button>
            <button type="button" className="primary-action-button" onClick={handleSaveEdit} disabled={editSaving}>
              {editSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </ModalDialog>
      )}

      <PageCard
        title="New Sales Return"
        subtitle="Select a sales invoice, then enter return quantities per product line"
      >
        {error ? <p className="error-text">{error}</p> : null}
        {success ? <p className="success-text">{success}</p> : null}

        <form onSubmit={submitReturn}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div className="form-field" style={{ flex: '1', minWidth: '220px', position: 'relative' }}>
              <span>Sales Invoice *</span>
              <input
                type="text"
                value={invoiceSearch}
                onChange={onInvoiceSearchChange}
                placeholder="Type invoice no to search…"
                autoComplete="off"
              />

              {invoiceSearchOpen && invoiceSearchResults.length > 0 ? (
                <ul className="product-search-dropdown">
                  {invoiceSearchResults.map((sale) => (
                    <li
                      key={sale.id}
                      className="product-search-item"
                      onMouseDown={() => onSelectSale(sale)}
                    >
                      <span>{sale.invoiceNo}</span>
                      <span className="product-search-sku">{sale.contact?.name || ''}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <label className="form-field" style={{ flex: '1', minWidth: '160px' }}>
              <span>Return Date *</span>
              <input
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                required
              />
            </label>

            <label className="form-field" style={{ flex: '2', minWidth: '200px' }}>
              <span>Reason</span>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Optional — e.g. Damaged product"
              />
            </label>
          </div>

          {selectedSale ? (
            <div className="view-header" style={{ marginBottom: '1rem' }}>
              <p>
                <strong>{selectedSale.invoiceNo}</strong> &nbsp;·&nbsp;
                {selectedSale.saleDate} &nbsp;·&nbsp;
                {selectedSale.contact?.name || ''}
              </p>
              {customerLedgerBalance !== null ? (
                <p style={{ marginTop: '0.4rem', fontSize: '0.82rem' }}>
                  <span style={{ color: '#6b7280' }}>Customer Balance (Before Return): </span>
                  <strong style={{ color: customerLedgerBalance >= 0 ? '#15803d' : '#dc2626' }}>
                    {Math.abs(customerLedgerBalance).toFixed(2)} {customerLedgerBalance >= 0 ? 'Dr' : 'Cr'}
                  </strong>
                  {totalReturnAmount > 0 ? (
                    <span style={{ marginLeft: 24 }}>
                      <span style={{ color: '#6b7280' }}>After Return: </span>
                      <strong style={{ color: (customerLedgerBalance - totalReturnAmount) >= 0 ? '#15803d' : '#dc2626' }}>
                        {Math.abs(customerLedgerBalance - totalReturnAmount).toFixed(2)} {(customerLedgerBalance - totalReturnAmount) >= 0 ? 'Dr' : 'Cr'}
                      </strong>
                    </span>
                  ) : null}
                </p>
              ) : null}
            </div>
          ) : null}

          {returnItems.length > 0 ? (
            <>
              <div className="table-wrap table-wrap--full">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Sold</th>
                      <th>Already Returned</th>
                      <th>Return Unit</th>
                      <th className="text-right">Returnable</th>
                      <th className="text-right">Return Qty</th>
                      <th className="text-right">Unit Price</th>
                      <th className="text-right">Return Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnItems.map((ri, index) => {
                      const returnQty = toNumber(ri.returnQty);
                      const returnAmount = returnQty * toNumber(ri.unitPrice);
                      const overLimit = returnQty > ri.returnable + 0.00001 && ri.returnable > 0;
                      const hasMultipleUnits = ri.availableUnits && ri.availableUnits.length > 1;

                      return (
                        <tr key={ri.saleItemId}>
                          <td>{ri.productName}</td>
                          <td>
                            {ri.originalQtyDisplay}
                            {ri.saleUnitCode ? ` ${ri.saleUnitCode}` : ''}
                          </td>
                          <td>
                            {ri.alreadyReturnedDisplay > 0
                              ? `${ri.alreadyReturnedDisplay} ${ri.saleUnitCode || ''}`.trim()
                              : '–'}
                          </td>
                          <td>
                            {hasMultipleUnits ? (
                              <select
                                className="form-input-sm"
                                value={ri.selectedUnitId}
                                onChange={(e) => onReturnUnitChange(index, e.target.value)}
                              >
                                {ri.availableUnits.map((u) => (
                                  <option key={u.unitId} value={u.unitId}>
                                    {u.unitCode || u.unitName}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span>{ri.selectedUnitCode || ri.saleUnitCode || '—'}</span>
                            )}
                          </td>
                          <td className="text-right">
                            {ri.returnable > 0
                              ? `${ri.returnable} ${ri.selectedUnitCode || ''}`.trim()
                              : <span style={{ color: 'var(--color-muted, #999)' }}>Fully returned</span>}
                          </td>
                          <td className="text-right">
                            {ri.returnable > 0 ? (
                              <input
                                className={`form-input-sm text-right${overLimit ? ' input-error' : ''}`}
                                type="number"
                                min="0"
                                max={ri.returnable}
                                step={ri.selectedUnitFactor > 1 ? '1' : '0.0001'}
                                value={ri.returnQty}
                                onChange={(e) => onReturnQtyChange(index, e.target.value)}
                                style={{ width: '80px' }}
                              />
                            ) : null}
                          </td>
                          <td className="text-right">
                            {toNumber(ri.unitPrice).toFixed(2)}
                            {ri.selectedUnitCode ? ` / ${ri.selectedUnitCode}` : ''}
                          </td>
                          <td className="text-right">{returnAmount > 0 ? returnAmount.toFixed(2) : '–'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="totals-panel" style={{ marginTop: '0.75rem' }}>
                <div className="totals-row totals-row--total">
                  <span>Total Return Amount</span>
                  <span>{totalReturnAmount.toFixed(2)}</span>
                </div>
              </div>

              <div className="inline-actions inline-actions--end" style={{ marginTop: '1rem' }}>
                <button
                  type="button"
                  className="secondary-action-button"
                  onClick={() => {
                    setSelectedSale(null);
                    setInvoiceSearch('');
                    setReturnItems([]);
                  }}
                >
                  Clear
                </button>
                <button type="submit" disabled={submitting || totalReturnAmount <= 0}>
                  {submitting ? 'Saving...' : 'Submit Return'}
                </button>
              </div>
            </>
          ) : selectedSale ? (
            <p style={{ color: 'var(--color-muted, #999)', marginTop: '0.5rem' }}>
              All items in this invoice have already been fully returned.
            </p>
          ) : null}
        </form>
      </PageCard>

      <div className="page-stats-strip">
        {(() => {
          const total = returns.length;
          const totalAmt = returns.reduce((s, r) => s + Number(r.totalAmount || 0), 0);
          return (
            <>
              <div className="page-stat-tile page-stat-tile--primary">
                <div className="page-stat-tile__label">Total Returns</div>
                <div className="page-stat-tile__value">{total}</div>
              </div>
              <div className="page-stat-tile">
                <div className="page-stat-tile__label">Total Amount</div>
                <div className="page-stat-tile__value">{fmtNum(totalAmt)}</div>
              </div>
            </>
          );
        })()}
      </div>

      <PageCard title="Sales Return Records" subtitle="History of all sales returns">
        <div className="table-filters no-print">
          <label className="form-field" htmlFor="salesReturnStartDate">
            <span>From</span>
            <input
              id="salesReturnStartDate"
              type="date"
              value={returnFilters.startDate}
              onChange={(e) => setReturnFilters((prev) => ({ ...prev, startDate: e.target.value }))}
            />
          </label>

          <label className="form-field" htmlFor="salesReturnEndDate">
            <span>To</span>
            <input
              id="salesReturnEndDate"
              type="date"
              value={returnFilters.endDate}
              onChange={(e) => setReturnFilters((prev) => ({ ...prev, endDate: e.target.value }))}
            />
          </label>

          <button
            type="button"
            className="secondary-action-button"
            style={{ alignSelf: 'flex-end' }}
            onClick={() => loadReturns(returnFilters)}
          >
            Filter
          </button>
        </div>

        {loading ? (
          <Spinner center />
        ) : (
          <div className="table-wrap table-wrap--full">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Return Date</th>
                  <th>Invoice No</th>
                  <th>Customer</th>
                  <th>Reason</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right no-print">Action</th>
                </tr>
              </thead>
              <tbody>
                {returns.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.returnDate}</td>
                    <td>{entry.sale?.invoiceNo || '–'}</td>
                    <td>{entry.contact?.name || '–'}</td>
                    <td>{entry.reason || '–'}</td>
                    <td className="text-right">{toNumber(entry.totalAmount).toFixed(2)}</td>
                    <td className="text-right no-print">
                      <div className="inline-actions">
                        <button
                          type="button"
                          className="table-action-button"
                          disabled={viewLoading}
                          onClick={() => openViewReturn(entry)}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className="table-action-button"
                          onClick={() => handleOpenEdit(entry)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="table-action-button"
                          onClick={() => printReturn(entry)}
                        >
                          &#128424; Print
                        </button>
                        <button
                          type="button"
                          className="table-action-button table-action-button--danger"
                          disabled={deletingId === entry.id}
                          onClick={() => handleDeleteReturn(entry)}
                        >
                          {deletingId === entry.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {returns.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="empty-state-cell">No sales returns found.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </PageCard>
    </div>
  );
}

function SalesReturnViewModal({ ret, onClose, onPrint, onEdit, onDelete, deletingId }) {
  const toNum = (v) => Number(v || 0);

  return (
    <ModalDialog
      title={`Sales Return: ${ret.sale?.invoiceNo || '#' + ret.id}`}
      subtitle={`${ret.returnDate || ''}${ret.contact?.name ? ` · ${ret.contact.name}` : ''}`}
      onClose={onClose}
    >
      <div className="print-area">
        <div className="view-header">
          <div>
            <p><strong>Return Date:</strong> {ret.returnDate || '–'}</p>
            <p><strong>Invoice:</strong> {ret.sale?.invoiceNo || '–'}</p>
            <p><strong>Customer:</strong> {ret.contact?.name || '–'}</p>
            <p><strong>Reason:</strong> {ret.reason || '–'}</p>
          </div>
        </div>

        <div className="table-wrap table-wrap--full" style={{ marginTop: '1rem' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Unit Price</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(ret.items || []).map((item, i) => {
                const amount = toNum(item.lineAmount) || toNum(item.quantity) * toNum(item.unitPrice);
                const si = item.saleItem;
                const factor = toNum(si?.conversionFactor) || 1;
                const hasUnit = si?.unitQty != null && factor > 1;
                const displayQty = hasUnit ? (toNum(item.quantity) / factor) : toNum(item.quantity);
                const displayPrice = toNum(item.unitPrice) * factor;
                const unitCode = si?.unit?.code || '';
                return (
                  <tr key={item.id}>
                    <td>{i + 1}</td>
                    <td>{item.product?.name || '–'}</td>
                    <td className="text-right">{displayQty}{unitCode ? ` ${unitCode}` : ''}</td>
                    <td className="text-right">{displayPrice.toFixed(2)}{unitCode ? ` / ${unitCode}` : ''}</td>
                    <td className="text-right">{amount.toFixed(2)}</td>
                  </tr>
                );
              })}

              {(ret.items || []).length === 0 ? (
                <tr><td colSpan="5" className="empty-state-cell">No items</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="totals-panel">
          <div className="totals-row totals-row--total">
            <span>Total Return Amount</span>
            <span>{toNum(ret.totalAmount).toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="inline-actions inline-actions--end no-print" style={{ marginTop: '1rem' }}>
        <button
          type="button"
          className="table-action-button table-action-button--danger"
          disabled={deletingId === ret.id}
          onClick={() => onDelete(ret)}
        >
          {deletingId === ret.id ? 'Deleting…' : 'Delete'}
        </button>
        <button type="button" className="secondary-action-button" onClick={() => onEdit(ret)}>
          Edit
        </button>
        <button type="button" className="secondary-action-button" onClick={() => onPrint(ret)}>
          &#128424; Print
        </button>
        <button type="button" className="primary-action-button" onClick={onClose}>
          Close
        </button>
      </div>
    </ModalDialog>
  );
}