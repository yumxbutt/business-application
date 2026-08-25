import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageCard from '../components/ui/PageCard';
import ModalDialog from '../components/ui/ModalDialog';
import { Select } from '../ui-kit';
import { purchaseService } from '../services/purchaseService';
import { productService } from '../services/productService';
import { settingsService } from '../services/settingsService';
import { ledgerService } from '../services/ledgerService';
import { openPrintWindow, fmtPrintDate, fmtNum } from '../utils/printHelper';
import Spinner from '../components/ui/Spinner';

const toNumber = (v) => Number(v || 0);

const defaultReturnFilters = { startDate: '', endDate: '' };

export default function PurchaseReturnPage() {
  const [searchParams] = useSearchParams();

  // Purchase search / selection
  const [purchaseBillSearch, setPurchaseBillSearch] = useState('');
  const [purchaseSearchResults, setPurchaseSearchResults] = useState([]);
  const [purchaseSearchOpen, setPurchaseSearchOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);

  // Return form
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [returnItems, setReturnItems] = useState([]);

  // Returns list
  const [returns, setReturns] = useState([]);
  const [returnFilters, setReturnFilters] = useState(defaultReturnFilters);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [company, setCompany] = useState({});
  const [purchaseLedgerBalance, setPurchaseLedgerBalance] = useState(null);
  const [viewReturn, setViewReturn] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [editingReturn, setEditingReturn] = useState(null);
  const [editForm, setEditForm] = useState({ returnDate: '', reason: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const searchTimer = useRef(null);

  const openViewReturn = async (entry) => {
    setViewLoading(true);
    try {
      const detail = await purchaseService.getReturn(entry.id);
      setViewReturn(detail || entry);
    } catch (e) {
      alert('Could not load return details: ' + (e.message || 'Error'));
    } finally {
      setViewLoading(false);
    }
  };

  const printReturn = async (entry) => {
    try {
      const detail = await purchaseService.getReturn(entry.id);
      const ret = detail || entry;
      const itemRows = (ret.items || []).map((item, i) => {
        const displayQty = toNumber(item.unitQty) > 0 ? toNumber(item.unitQty) : toNumber(item.quantity);
        const unitLabel = item.unit?.name || item.unit?.code || (item.unitId ? `Unit #${item.unitId}` : 'Base');
        return `<tr>
          <td>${i + 1}</td>
          <td>${item.product?.name || '–'}</td>
          <td class="tr">${fmtNum(displayQty)} ${unitLabel}</td>
          <td class="tr">${fmtNum(item.unitPrice)}</td>
          <td class="tr">${fmtNum(item.lineAmount || Number(item.unitQty || item.quantity) * Number(item.unitPrice))}</td>
        </tr>`;
      }).join('');
      const body = `
        <table>
          <thead><tr><th>#</th><th>Product</th><th class="tr">Qty / Unit</th><th class="tr">Unit Price</th><th class="tr">Amount</th></tr></thead>
          <tbody>${itemRows || '<tr><td colspan="5" style="text-align:center;padding:10px;color:#6b7280">No items</td></tr>'}</tbody>
          <tfoot><tr><td colspan="4">Total Return Amount</td><td class="tr">${fmtNum(ret.totalAmount)}</td></tr></tfoot>
        </table>
        ${ret.contactBalance != null ? `
        <div class="tot" style="margin-top:8px">
          <div class="tot-row" style="background:#fef9c3;font-weight:700"><span>Current Supplier Balance (After Return)</span><span>${ret.contactBalance >= 0 ? fmtNum(ret.contactBalance) + ' Dr' : fmtNum(Math.abs(ret.contactBalance)) + ' Cr'}</span></div>
        </div>` : ''}`;
      openPrintWindow({
        title: 'Purchase Return',
        titleBar: 'PURCHASE RETURN',
        company,
        metaFields: [
          ['Return Date', fmtPrintDate(ret.returnDate)],
          ['Original Bill', ret.purchase?.billNo || entry.purchase?.billNo || '–'],
          ['Supplier', ret.contact?.name || entry.contact?.name || '–'],
          ['Reason', ret.reason || entry.reason || '–'],
        ],
        bodyHtml: body,
        showSignatures: true,
      });
    } catch (e) {
      alert('Could not load return details: ' + (e.message || 'Error'));
    }
  };

  const loadReturns = async (filters = returnFilters) => {
    setLoading(true);
    try {
      const data = await purchaseService.getReturns(filters);
      setReturns(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadPurchaseForReturn = useCallback(async (purchaseId) => {
    setError('');
    try {
      // Load purchase detail
      const purchase = await purchaseService.getPurchase(purchaseId);
      if (!purchase) { setError('Purchase not found'); return; }

      // Load existing returns for that purchase to compute returnable quantities
      const existingReturns = await purchaseService.getReturns({ purchaseId });

      // Build a map of already-returned qty per purchaseItemId
      const alreadyReturnedMap = new Map();
      for (const ret of existingReturns) {
        for (const ri of (ret.items || [])) {
          const key = ri.purchaseItemId;
          alreadyReturnedMap.set(key, (alreadyReturnedMap.get(key) || 0) + toNumber(ri.quantity));
        }
      }

      setPurchaseBillSearch(purchase.billNo);
      setPurchaseSearchOpen(false);
      setPurchaseSearchResults([]);
      setSelectedPurchase(purchase);

      // Fetch units for all distinct products
      const productIds = [...new Set((purchase.items || []).map((i) => i.productId).filter(Boolean))];
      const unitsMap = {};
      await Promise.all(productIds.map(async (pid) => {
        try { unitsMap[pid] = await productService.getProductUnits(pid); }
        catch { unitsMap[pid] = []; }
      }));

      setReturnItems(
        (purchase.items || []).map((item) => {
          const alreadyReturned = alreadyReturnedMap.get(item.id) || 0;
          const returnable = Math.max(0, toNumber(item.quantity) - alreadyReturned);
          const units = unitsMap[item.productId] || [];

          // Find the name of the unit used at purchase time (e.g. "CTN", "BOX")
          const purchaseUnitEntry = item.unitId
            ? units.find((u) => String(u.unitId || u.unit?.id) === String(item.unitId))
            : null;
          const purchaseUnitName = purchaseUnitEntry?.unit?.name || purchaseUnitEntry?.unit?.code || '';
          // The original purchase qty in purchase-unit terms (e.g. 1 CTN, 2 BOX)
          const purchaseUnitQty = toNumber(item.unitQty) > 0 ? toNumber(item.unitQty) : toNumber(item.quantity);

          // Find base unit name (conversionFactor == 1)
          const baseUnitEntry = units.find((u) => toNumber(u.conversionFactor) === 1);
          const baseUnitName = baseUnitEntry?.unit?.name || baseUnitEntry?.unit?.code || 'PC';

          return {
            purchaseItemId: item.id,
            productId: item.productId,
            productName: item.product?.name || `Product #${item.productId}`,
            originalQty: toNumber(item.quantity),
            purchaseUnitQty,
            purchaseUnitName,
            baseUnitName,
            alreadyReturned,
            returnable,
            returnQty: '',
            unitPrice: toNumber(item.unitPrice),           // price per original purchase unit (e.g. per CTN)
            purchaseConvFactor: toNumber(item.conversionFactor) || 1, // CTN→base factor at time of purchase
            salePrice: toNumber(item.salePrice || 0),
            units,
            selectedUnitId: '',
          };
        })
      );
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    loadReturns();
    settingsService.getCompanySettings().then(setCompany).catch(() => {});
    const purchaseIdParam = searchParams.get('purchaseId');
    if (purchaseIdParam) {
      loadPurchaseForReturn(Number(purchaseIdParam));
    }
  }, []);

  useEffect(() => {
    if (!selectedPurchase?.contact?.id) { setPurchaseLedgerBalance(null); return; }
    ledgerService.getContactLedger(selectedPurchase.contact.id)
      .then((data) => {
        const entries = data.entries || [];
        const last = entries[entries.length - 1];
        setPurchaseLedgerBalance(last ? Number(last.runningBalance || 0) : 0);
      })
      .catch(() => setPurchaseLedgerBalance(null));
  }, [selectedPurchase?.contact?.id]);

  const triggerPurchaseSearch = (q) => {
    clearTimeout(searchTimer.current);
    if (!q || q.length < 2) {
      setPurchaseSearchResults([]);
      setPurchaseSearchOpen(false);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        const results = await purchaseService.getPurchases({ search: q, status: 'posted' });
        setPurchaseSearchResults(results.slice(0, 8));
        setPurchaseSearchOpen(true);
      } catch {
        // silent
      }
    }, 300);
  };

  const onPurchaseBillSearchChange = (e) => {
    const q = e.target.value;
    setPurchaseBillSearch(q);
    setSelectedPurchase(null);
    setReturnItems([]);
    triggerPurchaseSearch(q);
  };

  const onSelectPurchase = (purchase) => {
    loadPurchaseForReturn(purchase.id);
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
      next[index] = { ...next[index], selectedUnitId: unitId };
      return next;
    });
  };

  // Effective unit price in terms of the currently selected return unit.
  // baseUnitPrice = purchaseUnitPrice / purchaseConvFactor (price per single base unit)
  // effectiveUnitPrice = baseUnitPrice × returnUnitConvFactor
  const getEffectiveUnitPrice = (ri) => {
    const baseUnitPrice = ri.unitPrice / (ri.purchaseConvFactor || 1);
    const selUnit = ri.selectedUnitId && ri.units
      ? ri.units.find((u) => String(u.unitId || u.unit?.id) === String(ri.selectedUnitId))
      : null;
    const returnConvFactor = selUnit ? toNumber(selUnit.conversionFactor) || 1 : 1;
    return baseUnitPrice * returnConvFactor;
  };

  // Compute total return amount (qty is entered qty, price is per selected return unit)
  const totalReturnAmount = returnItems.reduce((sum, ri) => {
    const qty = toNumber(ri.returnQty);
    return sum + qty * getEffectiveUnitPrice(ri);
  }, 0);

  const submitReturn = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const activeItems = returnItems.filter((ri) => toNumber(ri.returnQty) > 0);
    if (activeItems.length === 0) {
      setError('Enter a return quantity for at least one item.');
      return;
    }

    for (const ri of activeItems) {
      // Compute base qty entered by user for validation
      let convFactor = 1;
      if (ri.selectedUnitId && ri.units) {
        const sel = ri.units.find((u) => String(u.unitId || u.unit?.id) === String(ri.selectedUnitId));
        if (sel) convFactor = toNumber(sel.conversionFactor) || 1;
      }
      const returnBaseQty = toNumber(ri.returnQty) * convFactor;
      if (returnBaseQty > ri.returnable + 0.00001) {
        setError(`Return qty for "${ri.productName}" exceeds returnable qty (${ri.returnable} base units).`);
        return;
      }
    }

    setSubmitting(true);
    try {
      await purchaseService.createReturn({
        purchaseIdReference: selectedPurchase.id,
        branchId: selectedPurchase.branchId ? Number(selectedPurchase.branchId) : undefined,
        returnDate,
        reason: reason || undefined,
        items: activeItems.map((ri) => ({
          purchaseItemId: ri.purchaseItemId,
          quantity: toNumber(ri.returnQty),
          unitPrice: getEffectiveUnitPrice(ri), // price per selected return unit
          salePrice: ri.salePrice > 0 ? ri.salePrice : undefined,
          unitId: ri.selectedUnitId ? Number(ri.selectedUnitId) : undefined,
        })),
      });

      setSuccess(`Return for ${selectedPurchase.billNo} saved successfully.`);
      setSelectedPurchase(null);
      setPurchaseBillSearch('');
      setReturnItems([]);
      setReason('');
      setReturnDate(new Date().toISOString().split('T')[0]);
      await loadReturns();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReturn = async (entry) => {
    const yes = window.confirm(
      `Delete return for bill "${entry.purchase?.billNo || '#' + entry.id}"?\n\nThis will reverse inventory and ledger entries.`
    );
    if (!yes) return;
    setDeletingId(entry.id);
    setError('');
    try {
      await purchaseService.cancelReturn(entry.id);
      setViewReturn(null);
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
      const updated = await purchaseService.updateReturn(editingReturn.id, {
        returnDate: editForm.returnDate || undefined,
        reason: editForm.reason,
      });
      setEditingReturn(null);
      // Refresh viewReturn if it was open
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
        <ReturnViewModal
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
          title={`Edit Return — ${editingReturn.purchase?.billNo || '#' + editingReturn.id}`}
          subtitle="Update return date or reason (quantities cannot be changed)"
          onClose={() => setEditingReturn(null)}
        >
          <div className="modal-form-grid">
            <label className="form-field" htmlFor="er-date">
              <span>Return Date</span>
              <input
                id="er-date"
                type="date"
                value={editForm.returnDate}
                onChange={(e) => setEditForm((p) => ({ ...p, returnDate: e.target.value }))}
              />
            </label>
            <label className="form-field" htmlFor="er-reason">
              <span>Reason</span>
              <input
                id="er-reason"
                type="text"
                value={editForm.reason}
                placeholder="Optional reason"
                onChange={(e) => setEditForm((p) => ({ ...p, reason: e.target.value }))}
              />
            </label>
          </div>
          {error && <p className="error-text">{error}</p>}
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
      {/* ── Create Return Form ── */}
      <PageCard
        title="New Purchase Return"
        subtitle="Select a purchase bill, then enter return quantities per product line"
      >
        {error ? <p className="error-text">{error}</p> : null}
        {success ? <p className="success-text">{success}</p> : null}

        <form onSubmit={submitReturn}>
          {/* Purchase search */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div className="form-field" style={{ flex: '1', minWidth: '220px', position: 'relative' }}>
              <span>Purchase Bill *</span>
              <input
                type="text"
                value={purchaseBillSearch}
                onChange={onPurchaseBillSearchChange}
                placeholder="Type bill no to search…"
                autoComplete="off"
              />
              {purchaseSearchOpen && purchaseSearchResults.length > 0 ? (
                <ul className="product-search-dropdown">
                  {purchaseSearchResults.map((p) => (
                    <li
                      key={p.id}
                      className="product-search-item"
                      onMouseDown={() => onSelectPurchase(p)}
                    >
                      <span>{p.billNo}</span>
                      <span className="product-search-sku">{p.contact?.name || ''}</span>
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
                placeholder="Optional — e.g. Defective goods"
              />
            </label>
          </div>

          {/* Selected purchase info */}
          {selectedPurchase ? (
            <div className="view-header" style={{ marginBottom: '1rem' }}>
              <p>
                <strong>{selectedPurchase.billNo}</strong> &nbsp;·&nbsp;
                {selectedPurchase.purchaseDate} &nbsp;·&nbsp;
                {selectedPurchase.contact?.name || ''}
              </p>
              {purchaseLedgerBalance !== null ? (
                <p style={{ marginTop: '0.4rem', fontSize: '0.82rem' }}>
                  <span style={{ color: '#6b7280' }}>Supplier Balance (Before Return): </span>
                  <strong style={{ color: purchaseLedgerBalance >= 0 ? '#15803d' : '#dc2626' }}>
                    {Math.abs(purchaseLedgerBalance).toFixed(2)} {purchaseLedgerBalance >= 0 ? 'Dr' : 'Cr'}
                  </strong>
                  {(() => {
                    const returnTotal = returnItems.reduce((s, ri) => s + toNumber(ri.returnQty) * getEffectiveUnitPrice(ri), 0);
                    if (returnTotal <= 0) return null;
                    const after = purchaseLedgerBalance + returnTotal;
                    return (
                      <span style={{ marginLeft: 24 }}>
                        <span style={{ color: '#6b7280' }}>After Return: </span>
                        <strong style={{ color: after >= 0 ? '#15803d' : '#dc2626' }}>
                          {Math.abs(after).toFixed(2)} {after >= 0 ? 'Dr' : 'Cr'}
                        </strong>
                      </span>
                    );
                  })()}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Return items table */}
          {returnItems.length > 0 ? (
            <>
              <div className="table-wrap table-wrap--full">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Return Unit</th>
                      <th className="text-right">Purchased</th>
                      <th className="text-right">Returned (base)</th>
                      <th className="text-right">Returnable (base)</th>
                      <th className="text-right">Return Qty</th>
                      <th className="text-right">Unit Price</th>
                      <th className="text-right">Return Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnItems.map((ri, index) => {
                      const retQty = toNumber(ri.returnQty);
                      // Derive conversion factor for selected unit
                      const selUnit = ri.selectedUnitId && ri.units
                        ? ri.units.find((u) => String(u.unitId || u.unit?.id) === String(ri.selectedUnitId))
                        : null;
                      const convFactor = selUnit ? toNumber(selUnit.conversionFactor) || 1 : 1;
                      // max returnable in selected unit terms
                      const maxReturnableInUnit = convFactor > 0 ? ri.returnable / convFactor : ri.returnable;
                      const effectiveUnitPrice = getEffectiveUnitPrice(ri);
                      const retAmount = retQty * effectiveUnitPrice;
                      const overLimit = retQty > maxReturnableInUnit + 0.00001 && ri.returnable > 0;

                      return (
                        <tr key={ri.purchaseItemId}>
                          <td>{ri.productName}</td>
                          <td>
                            {ri.units && ri.units.length > 0 ? (
                              <>
                                <Select
                                  value={ri.selectedUnitId}
                                  onChange={(e) => onReturnUnitChange(index, e.target.value)}
                                  options={[{ value: '', label: '— base unit —' }, ...(ri.units || []).map((u) => ({ value: String(u.unitId || u.unit?.id), label: `${u.unit?.name || u.unit?.code || `Unit #${u.unitId}`}${u.conversionFactor && u.conversionFactor !== 1 ? ` (×${u.conversionFactor})` : ''}` }))]}
                                  style={{ minWidth: '100px' }}
                                />
                                {ri.selectedUnitId && toNumber(ri.returnQty) > 0 ? (() => {
                                  const sel = ri.units.find((u) => String(u.unitId || u.unit?.id) === String(ri.selectedUnitId));
                                  if (!sel || !sel.conversionFactor || sel.conversionFactor <= 1) return null;
                                  const baseQty = (toNumber(ri.returnQty) * toNumber(sel.conversionFactor)).toFixed(4);
                                  return <span style={{ fontSize: '0.72rem', color: '#6b7280', display: 'block' }}>= {baseQty} base</span>;
                                })() : null}
                              </>
                            ) : (
                              <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>—</span>
                            )}
                          </td>
                          <td className="text-right">
                            <strong>{ri.purchaseUnitQty}</strong>
                            {ri.purchaseUnitName && <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: 3 }}>{ri.purchaseUnitName}</span>}
                          </td>
                          <td className="text-right">
                            {ri.alreadyReturned > 0
                              ? <>{ri.alreadyReturned} <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{ri.baseUnitName}</span></>
                              : <span style={{ color: '#9ca3af' }}>–</span>}
                          </td>
                          <td className="text-right">
                            {ri.returnable} <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{ri.baseUnitName}</span>
                          </td>
                          <td className="text-right">
                            {ri.returnable > 0 ? (
                              <input
                                className={`form-input-sm text-right${overLimit ? ' input-error' : ''}`}
                                type="number"
                                min="0"
                                max={maxReturnableInUnit}
                                step="0.0001"
                                value={ri.returnQty}
                                onChange={(e) => onReturnQtyChange(index, e.target.value)}
                                style={{ width: '80px' }}
                              />
                            ) : (
                              <span style={{ color: 'var(--color-muted, #999)' }}>Fully returned</span>
                            )}
                          </td>
                          <td className="text-right">{effectiveUnitPrice.toFixed(2)}</td>
                          <td className="text-right">{retAmount > 0 ? retAmount.toFixed(2) : '–'}</td>
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
                  onClick={() => { setSelectedPurchase(null); setPurchaseBillSearch(''); setReturnItems([]); }}
                >
                  Clear
                </button>
                <button type="submit" disabled={submitting || totalReturnAmount <= 0}>
                  {submitting ? 'Saving...' : 'Submit Return'}
                </button>
              </div>
            </>
          ) : selectedPurchase ? (
            <p style={{ color: 'var(--color-muted, #999)', marginTop: '0.5rem' }}>
              All items in this purchase have already been fully returned.
            </p>
          ) : null}
        </form>
      </PageCard>

      {/* ── Returns List ── */}
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
                <div className="page-stat-tile__value">{totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
            </>
          );
        })()}
      </div>

      <PageCard title="Purchase Return Records" subtitle="History of all purchase returns">
        <div className="table-filters no-print">
          <label className="form-field" htmlFor="returnStartDate">
            <span>From</span>
            <input
              id="returnStartDate"
              type="date"
              value={returnFilters.startDate}
              onChange={(e) => setReturnFilters((prev) => ({ ...prev, startDate: e.target.value }))}
            />
          </label>
          <label className="form-field" htmlFor="returnEndDate">
            <span>To</span>
            <input
              id="returnEndDate"
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
                  <th>Bill No</th>
                  <th>Supplier</th>
                  <th>Reason</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right no-print">Action</th>
                </tr>
              </thead>
              <tbody>
                {returns.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.returnDate}</td>
                    <td>{entry.purchase?.billNo || '–'}</td>
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
                    <td colSpan="6" className="empty-state-cell">No purchase returns found.</td>
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

function ReturnViewModal({ ret, onClose, onPrint, onEdit, onDelete, deletingId }) {
  const toNum = (v) => Number(v || 0);
  return (
    <ModalDialog
      title={`Purchase Return: ${ret.purchase?.billNo || '#' + ret.id}`}
      subtitle={`${ret.returnDate || ''}${ret.contact?.name ? ' · ' + ret.contact.name : ''}`}
      onClose={onClose}
    >
      <div className="print-area">
        <div className="view-header">
          <div>
            <p><strong>Return Date:</strong> {ret.returnDate || '–'}</p>
            <p><strong>Original Bill:</strong> {ret.purchase?.billNo || '–'}</p>
            <p><strong>Supplier:</strong> {ret.contact?.name || '–'}</p>
            <p><strong>Reason:</strong> {ret.reason || '–'}</p>
          </div>
        </div>

        <div className="table-wrap table-wrap--full" style={{ marginTop: '1rem' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th className="text-right">Qty / Unit</th>
                <th className="text-right">Unit Price</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(ret.items || []).map((item, i) => {
                const displayQty = toNum(item.unitQty) > 0 ? toNum(item.unitQty) : toNum(item.quantity);
                const unitLabel = item.unit?.name || item.unit?.code || (item.unitId ? `Unit #${item.unitId}` : 'Base Unit');
                const amount = toNum(item.lineAmount) || displayQty * toNum(item.unitPrice);
                return (
                  <tr key={item.id}>
                    <td>{i + 1}</td>
                    <td>{item.product?.name || '–'}</td>
                    <td className="text-right">{displayQty} {unitLabel}</td>
                    <td className="text-right">{toNum(item.unitPrice).toFixed(2)}</td>
                    <td className="text-right">{amount.toFixed(2)}</td>
                  </tr>
                );
              })}
              {(ret.items || []).length === 0 && (
                <tr><td colSpan="5" className="empty-state-cell">No items</td></tr>
              )}
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
