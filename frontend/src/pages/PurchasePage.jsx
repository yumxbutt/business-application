import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '../ui-kit/modal-zfix.css';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageCard from '../components/ui/PageCard';
import Button from '../ui-kit/Button';
import { Select, Input } from '../ui-kit';
import { ModernDataTable } from '../ui-kit/ModernDataTable';
import { ActionCard } from '../ui-kit/ActionCard';
import { StockBadge } from '../ui-kit/StockBadge';
import ModalDialog from '../components/ui/ModalDialog';
import { contactService } from '../services/contactService';
import { productService } from '../services/productService';
import { purchaseService } from '../services/purchaseService';
import { inventoryService } from '../services/inventoryService';
import { settingsService } from '../services/settingsService';
import { openPrintWindow, fmtPrintDate, fmtNum } from '../utils/printHelper';
import { ledgerService } from '../services/ledgerService';
import PaymentSelector from '../components/PaymentSelector';

const defaultFilters = {
  search: '',
  status: 'all',
  startDate: '',
  endDate: '',
  branchId: '',
};

const defaultForm = {
  contactId: '',
  billNo: '',
  purchaseDate: new Date().toISOString().split('T')[0],
  discount: '0',
  paidAmount: '0',
  branchId: '',
};

const defaultItem = {
  productId: '',
  productName: '',
  quantity: '1',
  currentStock: null,
  unitPrice: '0',
  salePrice: '0',
  notes: '',
  unitId: '',
  units: [],        // available units for the selected product
};

const toNumber = (value) => Number(value || 0);
const fmtBal = (n) => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '–';
  const v = Number(n);
  return `${Math.abs(v).toFixed(2)} ${v >= 0 ? 'Dr' : 'Cr'}`;
};

// Utility to summarize overall stock (all branches)
function getOverallStockSummary(stockOptions = []) {
  const totalAvailable = (stockOptions || []).reduce((sum, opt) => sum + toNumber(opt.availableQty), 0);
  const unitTotals = new Map();
  (stockOptions || []).forEach((opt) => {
    (opt.breakdown || []).forEach((b) => {
      const qty = toNumber(b.qty);
      if (qty <= 0) return;
      const key = (b.unitCode || b.unitName || 'UNIT').toUpperCase();
      unitTotals.set(key, (unitTotals.get(key) || 0) + qty);
    });
  });
  const unitText = Array.from(unitTotals.entries())
    .map(([unit, qty]) => `${qty} ${unit}`)
    .join(' + ');
  return { totalAvailable, unitText };
}

export default function PurchasePage({ createMode = false }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [filters, setFilters] = useState(defaultFilters);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewPurchase, setViewPurchase] = useState(null);
  const [editingPurchaseId, setEditingPurchaseId] = useState(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [createdPurchase, setCreatedPurchase] = useState(null);
  const [formData, setFormData] = useState(defaultForm);
  const [items, setItems] = useState([{ ...defaultItem }]);
  const [purchasePayments, setPurchasePayments] = useState([]);

  // Example: Modern ActionCard usage for dashboard stats (replace with real data)
  // <div className="flex gap-4 mb-6">
  //   <ActionCard title="Total Purchases" value={purchases.length} icon={<svg width="24" height="24" />} />
  //   <ActionCard title="Suppliers" value={suppliers.length} icon={<svg width="24" height="24" />} />
  // </div>

  // ModernDataTable columns and actions
  const columns = [
    { key: 'productName', title: 'Product' },
    { key: 'quantity', title: 'Qty' },
    { key: 'unitPrice', title: 'Cost Price' },
    { key: 'salePrice', title: 'Sale Price' },
    { key: 'stock', title: 'Stock' },
    { key: 'notes', title: 'Notes' },
  ];
  const actions = [
    { key: 'edit', icon: <span role="img" aria-label="edit">✏️</span>, onClick: (row) => {/* edit logic */}, color: '#21E6C1' },
    { key: 'delete', icon: <span role="img" aria-label="delete">🗑️</span>, onClick: (row) => {/* delete logic */}, color: '#FF5E5B' },
  ];

  // Example: ModernDataTable usage for items
  // <ModernDataTable columns={columns} data={items.map(item => ({
  //   ...item,
  //   stock: <StockBadge qty={item.currentStock ?? 0} />,
  // }))} actions={actions} />

  // Per-item product search state: array of { query, results, open, units }
  const [itemSearch, setItemSearch] = useState([{ query: '', results: [], open: false, units: [] }]);
  const searchTimers = useRef([]);

  const loadPurchases = async (nextFilters = filters) => {
    setLoading(true);
    setError('');
    try {
      const data = await purchaseService.getPurchases(nextFilters);
      setPurchases(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const [company, setCompany] = useState({});
  const [viewLedgerBalance, setViewLedgerBalance] = useState(null);
  const [supplierLedgerBalance, setSupplierLedgerBalance] = useState(null);

  const selectedBranchName = useMemo(() => {
    const match = branches.find((branch) => String(branch.id) === String(formData.branchId));
    return match?.name || user?.branchName || `Branch ${user?.branchId || ''}` || 'Assigned Branch';
  }, [branches, formData.branchId, user?.branchId, user?.branchName]);

  const resetCreateForm = useCallback(() => {
    setError('');
    const initialBranchId = user?.role !== 'main_admin' ? String(user?.branchId || '') : '';
    setEditingPurchaseId(null);
    setCreatedPurchase(null);
    setSupplierLedgerBalance(null);
    setFormData({
      ...defaultForm,
      purchaseDate: new Date().toISOString().split('T')[0],
      branchId: initialBranchId,
    });
    setItems([{ ...defaultItem }]);
    setItemSearch([{ query: '', results: [], open: false, units: [] }]);
  }, [user?.branchId, user?.role]);

  const loadMeta = async () => {
    try {
      if (user?.role === 'main_admin') {
        const meta = await productService.getMeta();
        setBranches(meta.branches || []);
      }
      const scopedBranchId = user?.role === 'main_admin' ? undefined : user?.branchId;
      const supplierRows = await contactService.getSuppliers(scopedBranchId);
      setSuppliers(supplierRows);
    } catch (err) {
      setError(err.message);
    }
  };

  // Reload suppliers when the form branch changes (main_admin only)
  useEffect(() => {
    if (user?.role !== 'main_admin') return;
    contactService.getSuppliers(formData.branchId || undefined)
      .then(setSuppliers)
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.branchId]);

  useEffect(() => {
    if (!createMode) {
      loadPurchases();
    }
    settingsService.getCompanySettings().then(setCompany).catch(() => {});
  }, [createMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-run loadMeta when user role resolves (auth may load after mount)
  useEffect(() => {
    if (user === undefined) return; // still loading
    loadMeta();
  }, [user?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!createMode) return;
    resetCreateForm();
  }, [createMode, resetCreateForm]);

  const printPurchase = (p, balances = {}) => {
    if (!p) return;
    const hasBalanceSummary = balances.previousBalance !== undefined && balances.netBalance !== undefined;
    const currentAfter = hasBalanceSummary
      ? Number(balances.netBalance)
      : viewLedgerBalance !== null
        ? Number(viewLedgerBalance)
        : undefined;
    const previousBefore = hasBalanceSummary
      ? Number(balances.previousBalance)
      : currentAfter !== undefined
        ? currentAfter + Number(p.totalAmount || 0)
        : undefined;
    const itemRows = (p.items || []).map((item, i) =>
      `<tr>
        <td>${i + 1}</td>
        <td>${item.product?.name || item.productId}</td>
        <td class="tr">${Number(item.quantity)}</td>
        <td class="tr">${fmtNum(item.unitPrice)}</td>
        <td class="tr">${item.salePrice != null ? fmtNum(item.salePrice) : '–'}</td>
        <td class="tr">${fmtNum(item.lineAmount)}</td>
      </tr>`
    ).join('');
    const splits = p.paymentSplits || [];
    const paymentSplitHtml = Number(p.paidAmount) > 0 ? `
      <div class="tot" style="margin-top:8px">
        <div class="tot-row" style="background:#eff6ff;font-weight:700"><span>Payment Method(s)</span><span>${fmtNum(p.paidAmount)}</span></div>
        ${splits.length > 0
          ? splits.map((s) => `<div class="tot-row"><span>${s.name || 'Cash'}${s.accountType === 'bank' && s.bankName ? ` (${s.bankName})` : ''}</span><span>${fmtNum(s.amount)}</span></div>`).join('')
          : `<div class="tot-row"><span>Cash</span><span>${fmtNum(p.paidAmount)}</span></div>`}
      </div>` : '';

    const body = `
      <table>
        <thead><tr><th>#</th><th>Product</th><th class="tr">Qty</th><th class="tr">Cost</th><th class="tr">Sale Price</th><th class="tr">Line Total</th></tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div class="tot" style="margin-top:14px">
        <div class="tot-row"><span>Sub Total</span><span>${fmtNum(p.subTotal)}</span></div>
        <div class="tot-row"><span>Discount</span><span>(${fmtNum(p.discount)})</span></div>
        <div class="tot-row"><span>Total</span><span>${fmtNum(p.totalAmount)}</span></div>
        <div class="tot-row"><span>Paid</span><span>${fmtNum(p.paidAmount)}</span></div>
        <div class="tot-row"><span>Due</span><span>${fmtNum(p.dueAmount)}</span></div>
        ${previousBefore !== undefined ? `<div class="tot-row" style="background:#fef9c3"><span>Previous Balance</span><span>${fmtBal(previousBefore)}</span></div>` : ''}
        ${currentAfter !== undefined ? `<div class="tot-row" style="background:#fef9c3;font-weight:700"><span>Net Balance</span><span>${fmtBal(currentAfter)}</span></div>` : ''}
      </div>
      ${paymentSplitHtml}`;
    openPrintWindow({
      title: 'Purchase Bill',
      titleBar: 'PURCHASE BILL',
      company,
      metaFields: [
        ['Bill No.', p.billNo],
        ['Date', fmtPrintDate(p.purchaseDate)],
        ['Supplier', p.contact?.name || '–'],
        ['Status', p.status || '–'],
      ],
      bodyHtml: body,
      showSignatures: true,
    });
  };

  const printGoodsReceiptNote = (purchaseRecord) => {
    if (!purchaseRecord) return;
    const itemRows = (purchaseRecord.items || []).map((item, i) =>
      `<tr>
        <td>${i + 1}</td>
        <td>${item.product?.name || item.productId}</td>
        <td class="tr">${Number(item.quantity || 0)}</td>
        <td>${item.notes || '–'}</td>
      </tr>`
    ).join('');

    const body = `
      <table>
        <thead><tr><th>#</th><th>Product</th><th class="tr">Qty</th><th>Remarks</th></tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div class="tot" style="margin-top:14px">
        <div class="tot-row"><span>Total Items</span><span>${purchaseRecord.items?.length || 0}</span></div>
        <div class="tot-row"><span>Total Quantity</span><span>${fmtNum((purchaseRecord.items || []).reduce((sum, row) => sum + Number(row.quantity || 0), 0))}</span></div>
      </div>`;

    openPrintWindow({
      title: 'Goods Receipt Note',
      titleBar: 'GOODS RECEIPT NOTE',
      company,
      metaFields: [
        ['GRN Ref', `GRN-${purchaseRecord.billNo || 'NA'}`],
        ['Bill No.', purchaseRecord.billNo],
        ['Date', fmtPrintDate(purchaseRecord.purchaseDate)],
        ['Supplier', purchaseRecord.contact?.name || '–'],
        ['Status', purchaseRecord.status || '–'],
      ],
      bodyHtml: body,
      showSignatures: true,
    });
  };

  const printGateEntryPass = (purchaseRecord) => {
    if (!purchaseRecord) return;
    const itemRows = (purchaseRecord.items || []).map((item, i) =>
      `<tr>
        <td>${i + 1}</td>
        <td>${item.product?.name || item.productId}</td>
        <td class="tr">${Number(item.quantity || 0)}</td>
      </tr>`
    ).join('');

    const body = `
      <table>
        <thead><tr><th>#</th><th>Product</th><th class="tr">Qty</th></tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div class="tot" style="margin-top:14px">
        <div class="tot-row"><span>Gate Entry Ref</span><span>GEP-${purchaseRecord.billNo || 'NA'}</span></div>
        <div class="tot-row"><span>Total Quantity</span><span>${fmtNum((purchaseRecord.items || []).reduce((sum, row) => sum + Number(row.quantity || 0), 0))}</span></div>
      </div>`;

    openPrintWindow({
      title: 'Gate Entry Pass',
      titleBar: 'GATE ENTRY PASS',
      company,
      metaFields: [
        ['Gate Entry No.', `GEP-${purchaseRecord.billNo || 'NA'}`],
        ['Date', fmtPrintDate(purchaseRecord.purchaseDate)],
        ['Supplier', purchaseRecord.contact?.name || '–'],
        ['Bill Ref', purchaseRecord.billNo],
      ],
      bodyHtml: body,
      showSignatures: true,
    });
  };

  const totals = useMemo(() => {
    const subTotal = items.reduce((sum, item) => {
      return sum + toNumber(item.quantity) * toNumber(item.unitPrice);
    }, 0);
    const discount = toNumber(formData.discount);
    const paidAmount = toNumber(formData.paidAmount);
    const totalAmount = Math.max(0, subTotal - discount);
    const dueAmount = Math.max(0, totalAmount - paidAmount);
    return { subTotal, totalAmount, dueAmount };
  }, [items, formData.discount, formData.paidAmount]);

  const openCreate = () => {
    if (!createMode) {
      navigate('/purchase/new');
      return;
    }
    resetCreateForm();
  };

  const openEdit = async (purchase) => {
    setError('');
    try {
      const detail = await purchaseService.getPurchase(purchase.id);
      setEditingPurchaseId(detail.id);
      setFormData({
        contactId: String(detail.contactId || ''),
        billNo: detail.billNo || '',
        purchaseDate: detail.purchaseDate || new Date().toISOString().split('T')[0],
        discount: String(detail.discount || '0'),
        paidAmount: String(detail.paidAmount || '0'),
        branchId: String(detail.branchId || ''),
      });

      // Fetch units per item in parallel
      const itemUnitsArr = await Promise.all(
        (detail.items || []).map(async (item) => {
          if (!item.productId) return [];
          try { return await productService.getProductUnits(item.productId); }
          catch { return []; }
        })
      );

      const mappedItems = (detail.items || []).map((item, idx) => ({
        productId: String(item.productId || ''),
        productName: item.product?.name || '',
        quantity: String(item.unitQty ?? item.quantity ?? '1'),
        unitPrice: String(item.unitPrice || '0'),
        salePrice: String(item.salePrice || '0'),
        notes: item.notes || '',
        unitId: item.unitId ? String(item.unitId) : '',
        units: itemUnitsArr[idx] || [],
      }));
      setItems(mappedItems);
      setItemSearch(mappedItems.map((item, idx) => ({
        query: item.productName,
        results: [],
        open: false,
        units: itemUnitsArr[idx] || [],
      })));
      setIsModalOpen(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const openView = async (purchase) => {
    setError('');
    setViewLedgerBalance(null);
    try {
      const detail = await purchaseService.getPurchase(purchase.id);
      setViewPurchase(detail);
      setIsViewModalOpen(true);
      if (detail.contact?.id) {
        ledgerService.getContactLedger(detail.contact.id)
          .then((data) => {
            const entries = data.entries || [];
            const last = entries[entries.length - 1];
            setViewLedgerBalance(last ? Number(last.runningBalance || 0) : 0);
          })
          .catch(() => {});
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const closeModal = () => {
    if (createMode) {
      navigate('/purchase');
      return;
    }
    setEditingPurchaseId(null);
    setSupplierLedgerBalance(null);
    setPurchasePayments([]);
    setIsModalOpen(false);
  };

  useEffect(() => {
    const shouldLoadLedger = createMode || isModalOpen;
    if (!shouldLoadLedger || !formData.contactId) {
      setSupplierLedgerBalance(null);
      return;
    }
    ledgerService
      .getContactLedger(formData.contactId, {
        branchId: formData.branchId ? Number(formData.branchId) : undefined,
      })
      .then((data) => {
        const entries = data.entries || [];
        const last = entries[entries.length - 1];
        setSupplierLedgerBalance(last ? Number(last.runningBalance || 0) : 0);
      })
      .catch(() => setSupplierLedgerBalance(null));
  }, [createMode, isModalOpen, formData.contactId, formData.branchId]);

  const onCancelPurchase = async (purchase) => {
    const yes = window.confirm(`Cancel purchase ${purchase.billNo}?`);
    if (!yes) return;
    setError('');
    try {
      await purchaseService.cancelPurchase(purchase.id);
      await loadPurchases(filters);
    } catch (err) {
      setError(err.message);
    }
  };

  const onFormChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Debounced product search for a specific item row
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
        // silent
      }
    }, 300);
  }, []);

  const onItemSearchChange = (index, query) => {
    setItemSearch((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], query };
      return next;
    });
    // Clear product selection when typing
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], productId: '', productName: query };
      return next;
    });
    triggerProductSearch(index, query);
  };

  const fetchCurrentStockForRow = useCallback(async (index, productId) => {
    const scopedBranchId = formData.branchId || (user?.role !== 'main_admin' ? user?.branchId : '');
    if (!productId || !scopedBranchId) {
      setItems((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], currentStock: null };
        return next;
      });
      return;
    }

    try {
      const stockRows = await inventoryService.getBranchStock(scopedBranchId, { mode: 'all' });
      const row = (stockRows || []).find((entry) => String(entry.productId) === String(productId));
      setItems((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], currentStock: row ? Number(row.baseQty || 0) : 0 };
        return next;
      });
    } catch {
      setItems((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], currentStock: null };
        return next;
      });
    }
  }, [formData.branchId, user?.branchId, user?.role]);

  const selectProduct = async (index, product) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        productId: String(product.id),
        productName: product.name,
        unitPrice: String(product.purchasePrice || '0'),
        salePrice: String(product.salePrice || '0'),
        unitId: '',
        units: [],
      };
      return next;
    });
    setItemSearch((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], query: product.name, results: [], open: false, units: [] };
      return next;
    });

    // Asynchronously fetch product units
    try {
      const units = await productService.getProductUnits(product.id);
      setItems((prev) => {
        const next = [...prev];
        // If there is exactly one unit (or a default purchase unit), pre-select it
        const defaultUnit = units.find((u) => u.isPurchaseUnit) || (units.length === 1 ? units[0] : null);
        next[index] = {
          ...next[index],
          units,
          unitId: defaultUnit ? String(defaultUnit.unitId) : '',
        };
        return next;
      });
      setItemSearch((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], units };
        return next;
      });
      fetchCurrentStockForRow(index, product.id);
    } catch {
      // silent — unit dropdown just stays empty
      fetchCurrentStockForRow(index, product.id);
    }
  };

  useEffect(() => {
    const hasBranch = formData.branchId || (user?.role !== 'main_admin' ? user?.branchId : '');
    if (!hasBranch) return;
    items.forEach((item, idx) => {
      if (item.productId) fetchCurrentStockForRow(idx, item.productId);
    });
  }, [formData.branchId, fetchCurrentStockForRow]); // eslint-disable-line react-hooks/exhaustive-deps

  const onItemChange = (index, field, value) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addItemRow = () => {
    setItems((prev) => [...prev, { ...defaultItem }]);
    setItemSearch((prev) => [...prev, { query: '', results: [], open: false, units: [] }]);
  };

  const removeItemRow = (index) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((_, idx) => idx !== index));
    setItemSearch((prev) => prev.filter((_, idx) => idx !== index));
  };

  const submitPurchase = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        branchId: formData.branchId ? Number(formData.branchId) : undefined,
        contactId: Number(formData.contactId),
        billNo: formData.billNo,
        purchaseDate: formData.purchaseDate,
        discount: toNumber(formData.discount),
        paidAmount: toNumber(formData.paidAmount),
        payments: toNumber(formData.paidAmount) > 0 ? purchasePayments : [],
        items: items.map((item) => ({
          productId: Number(item.productId),
          quantity: toNumber(item.quantity),
          unitPrice: toNumber(item.unitPrice),
          salePrice: item.salePrice !== '' ? toNumber(item.salePrice) : null,
          notes: item.notes || null,
          unitId: item.unitId ? Number(item.unitId) : null,
        })),
      };
      if (editingPurchaseId) {
        await purchaseService.updatePurchase(editingPurchaseId, payload);
        closeModal();
        await loadPurchases();
      } else {
        const created = await purchaseService.createPurchase(payload);
        const createdDetail = created?.id ? await purchaseService.getPurchase(created.id) : created;
        const previousBalance = supplierLedgerBalance !== null ? Number(supplierLedgerBalance) : undefined;
        const createdDue = Number(createdDetail?.dueAmount || 0);
        const netBalance = previousBalance !== undefined ? previousBalance + createdDue : undefined;
        setCreatedPurchase({
          ...createdDetail,
          paymentSplits: (createdDetail.paymentSplits && createdDetail.paymentSplits.length > 0)
            ? createdDetail.paymentSplits
            : purchasePayments.filter((p) => Number(p.amount) > 0).map((p) => ({
                name: p.accountName || p.name || 'Cash',
                accountType: p.accountType || 'cash',
                bankName: p.bankName || null,
                amount: Number(p.amount),
              })),
          _balanceSummary:
            previousBalance !== undefined && netBalance !== undefined
              ? { previousBalance, netBalance }
              : undefined,
        });
        setIsSuccessModalOpen(true);
        if (!createMode) {
          await loadPurchases();
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadgeClass = (status) => {
    if (status === 'posted') return 'badge badge--green';
    if (status === 'cancelled') return 'badge badge--red';
    return 'badge badge--gray';
  };

  const renderPurchaseForm = () => (
    <form className="auth-form modal-form" onSubmit={submitPurchase}>
      {error ? <p className="error-text">{error}</p> : null}

      {user?.role === 'main_admin' ? (
        <div className="modal-form-grid">
          <label className="form-field" htmlFor="purchaseBranchId">
            <span>Branch *</span>
            <Select
              id="purchaseBranchId"
              name="branchId"
              value={formData.branchId}
              onChange={onFormChange}
              options={[{ value: '', label: 'Select branch' }, ...(branches || []).map((b) => ({ value: String(b.id), label: b.name }))]}
              required
            />
          </label>
        </div>
      ) : null}

      <div className="modal-form-grid">
        <label className="form-field" htmlFor="purchaseSupplier">
          <span>Supplier *</span>
          <Select
            id="purchaseSupplier"
            name="contactId"
            value={formData.contactId}
            onChange={onFormChange}
            options={[{ value: '', label: 'Select supplier' }, ...(suppliers || []).map((s) => ({ value: String(s.id), label: s.name }))]}
            required
          />
        </label>

        <label className="form-field" htmlFor="purchaseBillNo">
          <span>Bill No *</span>
          <input
            id="purchaseBillNo"
            name="billNo"
            value={formData.billNo}
            onChange={onFormChange}
            required
            placeholder="e.g. BILL-1001"
          />
        </label>
      </div>

      {supplierLedgerBalance !== null ? (
        <div style={{ marginTop: '-0.35rem', marginBottom: '0.75rem', fontSize: '0.82rem' }}>
          <span style={{ color: '#6b7280' }}>Previous Balance: </span>
          <strong style={{ color: supplierLedgerBalance >= 0 ? '#15803d' : '#dc2626' }}>
            {fmtBal(supplierLedgerBalance)}
          </strong>
          {totals.dueAmount > 0 ? (
            <span style={{ marginLeft: 24 }}>
              <span style={{ color: '#6b7280' }}>Net Balance: </span>
              <strong style={{ color: (supplierLedgerBalance + totals.dueAmount) >= 0 ? '#15803d' : '#dc2626' }}>
                {fmtBal(supplierLedgerBalance + totals.dueAmount)}
              </strong>
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="modal-form-grid">
        <label className="form-field" htmlFor="purchaseDate">
          <span>Purchase Date *</span>
          <input
            id="purchaseDate"
            name="purchaseDate"
            type="date"
            value={formData.purchaseDate}
            onChange={onFormChange}
            required
          />
        </label>

        <label className="form-field" htmlFor="purchaseDiscount">
          <span>Discount</span>
          <input
            id="purchaseDiscount"
            name="discount"
            type="number"
            min="0"
            step="0.01"
            value={formData.discount}
            onChange={onFormChange}
          />
        </label>

        <label className="form-field" htmlFor="purchasePaidAmount">
          <span>Paid Amount</span>
          <input
            id="purchasePaidAmount"
            name="paidAmount"
            type="number"
            min="0"
            step="0.01"
            value={formData.paidAmount}
            onChange={onFormChange}
          />
        </label>
      </div>

      <div className="inline-actions inline-actions--end" style={{ marginTop: '0.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '140px 140px', gap: '0.5rem', alignItems: 'end' }}>
          <label className="form-field" htmlFor="purchaseDiscount" style={{ marginBottom: 0 }}>
            <span style={{ fontSize: '0.78rem' }}>Discount</span>
            <Input
              id="purchaseDiscount"
              name="discount"
              type="number"
              min="0"
              step="0.01"
              value={formData.discount}
              onChange={onFormChange}
            />
          </label>

          <label className="form-field" htmlFor="purchasePaidAmount" style={{ marginBottom: 0 }}>
            <span style={{ fontSize: '0.78rem' }}>Paid</span>
            <Input
              id="purchasePaidAmount"
              name="paidAmount"
              type="number"
              min="0"
              step="0.01"
              value={formData.paidAmount}
              onChange={onFormChange}
            />
          </label>
        </div>
      </div>

      {toNumber(formData.paidAmount) > 0 && (
        <PaymentSelector
          totalAmount={toNumber(formData.paidAmount)}
          branchId={formData.branchId ? Number(formData.branchId) : (user?.branchId ? Number(user.branchId) : undefined)}
          onChange={setPurchasePayments}
          disabled={submitting}
          label="Payment Accounts"
        />
      )}

      <div className="table-wrap table-wrap--full" style={{ overflow: 'visible' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ minWidth: '130px' }}>Stock Branch</th>
              <th style={{ minWidth: '180px' }}>Product</th>
              <th style={{ minWidth: '120px' }}>Unit</th>
              <th style={{ minWidth: '120px' }} className="text-right">Available</th>
              <th style={{ minWidth: '80px' }}>Qty</th>
              <th style={{ minWidth: '110px' }}>Cost Price</th>
              <th style={{ minWidth: '100px' }}>Sale Price</th>
              <th style={{ minWidth: '90px' }} className="text-right">Line Total</th>
              <th style={{ minWidth: '80px' }}>Notes</th>
              <th className="text-right" style={{ minWidth: '70px' }}>Del</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const lineAmount = toNumber(item.quantity) * toNumber(item.unitPrice);
              const search = itemSearch[index] || { query: '', results: [], open: false };

              // Stock branch select options
              const branchOptions = (item.stockOptions?.length ? item.stockOptions : branches.map((branch) => ({ branchId: branch.id, branchName: branch.name }))).map((opt) => ({ value: String(opt.branchId), label: opt.branchName }));

              // Available stock display logic
              const selected = (item.stockOptions || []).find(
                (opt) => String(opt.branchId) === String(item.sourceBranchId)
              );
              const factor = toNumber(item.conversionFactor) || 1;
              let availableDisplay = '–';
              if (selected) {
                const unitText = (selected.breakdown || [])
                  .filter((b) => toNumber(b.qty) > 0)
                  .map((b) => `${Number(b.qty)} ${b.unitCode || b.unitName || ''}`.trim())
                  .join(' + ');
                const availableInSelectedUnit = Math.floor((toNumber(selected.availableQty) || 0) / (factor || 1));
                availableDisplay = (
                  <div>
                    <div>{availableInSelectedUnit}</div>
                    {unitText ? (
                      <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>{unitText}</div>
                    ) : null}
                    <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>
                      Cost: {toNumber(item.unitPrice).toFixed(2)}
                    </div>
                  </div>
                );
              } else if (item.currentStock !== null && item.currentStock !== undefined) {
                availableDisplay = Math.floor(toNumber(item.currentStock) / (factor || 1));
              }

              // Show overall stock (all branches) as in sales invoice
              let overallStockDisplay = null;
              if (item.stockOptions && item.stockOptions.length > 0) {
                const overall = getOverallStockSummary(item.stockOptions);
                overallStockDisplay = (
                  <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginTop: 3 }}>
                    Stock (All Branches): {overall.totalAvailable}
                    {overall.unitText ? ` (${overall.unitText})` : ''}
                  </span>
                );
              }

              return (
                <tr key={`item-${index}`}>
                  <td>
                    <Select
                      value={item.sourceBranchId}
                      onChange={(e) => onItemChange(index, 'sourceBranchId', e.target.value)}
                      options={branchOptions}
                      required
                    />
                  </td>
                  <td style={{ position: 'relative' }}>
                    <Input
                      className=""
                      type="text"
                      value={search.query}
                      onChange={(e) => onItemSearchChange(index, e.target.value)}
                      placeholder="Type to search…"
                      required
                    />
                    {/* Show overall stock summary below product input, like sales invoice */}
                    {(() => {
                      if (!item.stockOptions || !item.stockOptions.length) return null;
                      const overall = getOverallStockSummary(item.stockOptions);
                      return (
                        <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginTop: 3 }}>
                          {overall.totalAvailable}
                          {overall.unitText ? ` (${overall.unitText})` : ''}
                        </span>
                      );
                    })()}
                    {search.open && search.results.length > 0 ? (
                      <ul className="product-search-dropdown" style={{ zIndex: 10001, position: 'absolute' }}>
                        {search.results.map((product) => (
                          <li
                            key={product.id}
                            className="product-search-item"
                            onMouseDown={() => selectProduct(index, product)}
                          >
                            <span>{product.name}</span>
                            <span className="product-search-sku">{product.sku || ''}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </td>
                  <td>
                    {item.units && item.units.length > 0 ? (
                      <Select
                        className="form-input-sm"
                        value={item.unitId}
                        onChange={(e) => onItemChange(index, 'unitId', e.target.value)}
                        options={[{ value: '', label: '— base unit —' }, ...(item.units || []).map((u) => ({ value: String(u.unitId || u.unit?.id), label: `${u.unit?.name || u.unit?.code || `Unit #${u.unitId}`}${u.conversionFactor && u.conversionFactor !== 1 ? ` (×${u.conversionFactor})` : ''}` }))]}
                      />
                    ) : (
                      <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>—</span>
                    )}
                  </td>
                  <td className="text-right">{availableDisplay}</td>
                  <td>
                    <Input
                      className=""
                      type="number"
                      min="0.0001"
                      step="0.0001"
                      value={item.quantity}
                      onChange={(e) => onItemChange(index, 'quantity', e.target.value)}
                      required
                    />
                  </td>
                  <td>
                    <Input
                      className=""
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) => onItemChange(index, 'unitPrice', e.target.value)}
                      required
                    />
                  </td>
                  <td>
                    <Input
                      className=""
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.salePrice}
                      onChange={(e) => onItemChange(index, 'salePrice', e.target.value)}
                      placeholder="0.00"
                    />
                  </td>
                  <td className="text-right">{lineAmount.toFixed(2)}</td>
                  <td>
                    <Input
                      className=""
                      type="text"
                      value={item.notes}
                      onChange={(e) => onItemChange(index, 'notes', e.target.value)}
                      placeholder="Optional"
                    />
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      className="table-action-button table-action-button--danger"
                      onClick={() => removeItemRow(index)}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="inline-actions">
        <button type="button" className="secondary-action-button" onClick={addItemRow}>
          + Add Item
        </button>
      </div>

      <div className="totals-panel">
        <div className="totals-row"><span>Sub Total</span><span>{totals.subTotal.toFixed(2)}</span></div>
        <div className="totals-row"><span>Discount</span><span>({toNumber(formData.discount).toFixed(2)})</span></div>
        <div className="totals-row totals-row--total"><span>Total</span><span>{totals.totalAmount.toFixed(2)}</span></div>
        <div className="totals-row"><span>Paid</span><span>{toNumber(formData.paidAmount).toFixed(2)}</span></div>
        <div className="totals-row due-row"><span>Due</span><span>{totals.dueAmount.toFixed(2)}</span></div>
      </div>

      <div className="inline-actions inline-actions--end">
        <button type="button" className="secondary-action-button" onClick={closeModal}>
          {createMode ? 'Back to Purchases' : 'Cancel'}
        </button>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : editingPurchaseId ? 'Update Purchase' : 'Create Purchase'}
        </button>
      </div>
    </form>
  );

  // Must be declared before any conditional return (React hooks rules)
  const purchaseSummary = useMemo(() => {
    const posted = purchases.filter((p) => p.status === 'posted');
    const totalAmount = posted.reduce((sum, p) => sum + toNumber(p.totalAmount), 0);
    const totalPaid = posted.reduce((sum, p) => sum + toNumber(p.paidAmount), 0);
    const totalDue = posted.reduce((sum, p) => sum + toNumber(p.dueAmount), 0);
    return { count: purchases.length, posted: posted.length, totalAmount, totalPaid, totalDue };
  }, [purchases]);

  if (createMode) {
    return (
      <div className="dashboard-stack">
        <PageCard
          title="Create Purchase Bill"
          subtitle="Posted purchase with line items — inventory and payable updated on save"
          actions={
            <button type="button" className="secondary-action-button no-print" onClick={() => navigate('/purchase')}>
              Back to Purchases
            </button>
          }
        >
          {renderPurchaseForm()}
        </PageCard>

        {isSuccessModalOpen && createdPurchase ? (
          <ModalDialog
            title="Purchase Created"
            subtitle={`Purchase bill ${createdPurchase.billNo} created successfully`}
            onClose={() => setIsSuccessModalOpen(false)}
          >
            <p style={{ margin: 0 }}>Purchase has been posted successfully.</p>
            <div className="inline-actions inline-actions--end" style={{ marginTop: '1rem' }}>
              <button
                type="button"
                className="secondary-action-button"
                onClick={() => printPurchase(createdPurchase, createdPurchase._balanceSummary || {})}
              >
                &#128424; Print Bill
              </button>
              <button
                type="button"
                className="secondary-action-button"
                onClick={() => printGoodsReceiptNote(createdPurchase)}
              >
                &#128424; Goods Receipt Note
              </button>
              <button
                type="button"
                className="secondary-action-button"
                onClick={() => printGateEntryPass(createdPurchase)}
              >
                &#128424; Gate Entry Pass
              </button>
              <button
                type="button"
                className="secondary-action-button"
                onClick={() => {
                  setIsSuccessModalOpen(false);
                  resetCreateForm();
                }}
              >
                Create Another
              </button>
              <button
                type="button"
                className="primary-action-button"
                onClick={() => {
                  setIsSuccessModalOpen(false);
                  navigate('/purchase');
                }}
              >
                Back to Purchases
              </button>
            </div>
          </ModalDialog>
        ) : null}
      </div>
    );
  }

  return (
    <div className="dashboard-stack">
      <div className="page-stats-strip no-print">
        <div className="page-stat-tile">
          <span className="page-stat-tile__label">Total Bills</span>
          <span className="page-stat-tile__value">{purchaseSummary.count}</span>
        </div>
        <div className="page-stat-tile page-stat-tile--purple">
          <span className="page-stat-tile__label">Posted</span>
          <span className="page-stat-tile__value">{purchaseSummary.posted}</span>
        </div>
        <div className="page-stat-tile page-stat-tile--primary">
          <span className="page-stat-tile__label">Total Cost (Posted)</span>
          <span className="page-stat-tile__value">{purchaseSummary.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div className="page-stat-tile page-stat-tile--success">
          <span className="page-stat-tile__label">Paid</span>
          <span className="page-stat-tile__value">{purchaseSummary.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div className="page-stat-tile page-stat-tile--danger">
          <span className="page-stat-tile__label">Payable</span>
          <span className="page-stat-tile__value">{purchaseSummary.totalDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      </div>
      <PageCard
        title="Purchases"
        subtitle="Create and manage supplier purchase bills with FIFO inventory tracking"
        actions={
          <Button type="button" variant="primary" className="no-print" onClick={openCreate}>
            Add Purchase
          </Button>
        }
      >
        {error ? <p className="error-text">{error}</p> : null}

        <div className="table-filters no-print">
          <label className="form-field table-filters__search" htmlFor="purchaseSearch">
            <span>Search Bill No</span>
            <input
              id="purchaseSearch"
              type="text"
              placeholder="e.g. BILL-001"
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            />
          </label>

          <label className="form-field" htmlFor="purchaseStatus">
            <span>Status</span>
            <Select
              id="purchaseStatus"
              value={filters.status}
              onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
              options={[{ value: 'all', label: 'All' }, { value: 'posted', label: 'Posted' }, { value: 'draft', label: 'Draft' }, { value: 'cancelled', label: 'Cancelled' }]}
            />
          </label>

          <label className="form-field" htmlFor="purchaseStartDate">
            <span>From</span>
            <input
              id="purchaseStartDate"
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
            />
          </label>

          <label className="form-field" htmlFor="purchaseEndDate">
            <span>To</span>
            <input
              id="purchaseEndDate"
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
            />
          </label>

          {user?.role === 'main_admin' ? (
            <label className="form-field" htmlFor="purchaseBranchFilter">
              <span>Branch</span>
              <select
                id="purchaseBranchFilter"
                value={filters.branchId}
                onChange={(e) => setFilters((prev) => ({ ...prev, branchId: e.target.value }))}
              >
                <option value="">All branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>
          ) : null}

          <button
            type="button"
            className="secondary-action-button no-print"
            style={{ alignSelf: 'flex-end' }}
            onClick={() => loadPurchases(filters)}
          >
            Apply Filters
          </button>
        </div>

        {loading ? (
          <p>Loading purchases…</p>
        ) : (
          <div className="table-wrap table-wrap--full">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Bill No</th>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>Status</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Paid</th>
                  <th className="text-right">Due</th>
                  <th className="text-right no-print">Action</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((row) => (
                  <tr key={row.id}>
                    <td>{row.billNo}</td>
                    <td>{row.purchaseDate}</td>
                    <td>{row.contact?.name || '–'}</td>
                    <td>
                      <span className={statusBadgeClass(row.status)}>{row.status}</span>
                    </td>
                    <td className="text-right">{toNumber(row.totalAmount).toFixed(2)}</td>
                    <td className="text-right">{toNumber(row.paidAmount).toFixed(2)}</td>
                    <td className="text-right">{toNumber(row.dueAmount).toFixed(2)}</td>
                    <td className="text-right no-print">
                      <div className="inline-actions inline-actions--end">
                        <button
                          type="button"
                          className="table-action-button"
                          onClick={() => openView(row)}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className="table-action-button"
                          onClick={() => openEdit(row)}
                          disabled={row.status === 'cancelled'}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="table-action-button"
                          onClick={() => navigate(`/purchase-returns?purchaseId=${row.id}&billNo=${encodeURIComponent(row.billNo)}`)}
                          disabled={row.status === 'cancelled'}
                        >
                          Return
                        </button>
                        <button
                          type="button"
                          className="table-action-button table-action-button--danger"
                          onClick={() => onCancelPurchase(row)}
                          disabled={row.status === 'cancelled'}
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {purchases.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="empty-state-cell">
                      No purchase records found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </PageCard>

      {/* ── View / Print Modal ── */}
      {isViewModalOpen && viewPurchase ? (
        <ModalDialog
          title={`Purchase: ${viewPurchase.billNo}`}
          subtitle={`${viewPurchase.purchaseDate} · ${viewPurchase.contact?.name || ''}`}
          onClose={() => setIsViewModalOpen(false)}
        >
          <div className="print-area">
            <div className="view-header">
              <div>
                <p><strong>Bill No:</strong> {viewPurchase.billNo}</p>
                <p><strong>Date:</strong> {viewPurchase.purchaseDate}</p>
                <p><strong>Supplier:</strong> {viewPurchase.contact?.name || '–'}</p>
                <p><strong>Status:</strong> {viewPurchase.status}</p>
              </div>
            </div>

            <div className="table-wrap table-wrap--full" style={{ marginTop: '1rem' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Cost</th>
                    <th className="text-right">Sale Price</th>
                    <th className="text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewPurchase.items || []).map((item, i) => (
                    <tr key={item.id}>
                      <td>{i + 1}</td>
                      <td>{item.product?.name || item.productId}</td>
                      <td className="text-right">{toNumber(item.quantity)}</td>
                      <td className="text-right">{toNumber(item.unitPrice).toFixed(2)}</td>
                      <td className="text-right">{item.salePrice != null ? toNumber(item.salePrice).toFixed(2) : '–'}</td>
                      <td className="text-right">{toNumber(item.lineAmount).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="totals-panel">
              <div className="totals-row"><span>Sub Total</span><span>{toNumber(viewPurchase.subTotal).toFixed(2)}</span></div>
              <div className="totals-row"><span>Discount</span><span>({toNumber(viewPurchase.discount).toFixed(2)})</span></div>
              <div className="totals-row totals-row--total"><span>Total</span><span>{toNumber(viewPurchase.totalAmount).toFixed(2)}</span></div>
              <div className="totals-row"><span>Paid</span><span>{toNumber(viewPurchase.paidAmount).toFixed(2)}</span></div>
              <div className="totals-row due-row"><span>Due</span><span>{toNumber(viewPurchase.dueAmount).toFixed(2)}</span></div>
            </div>
            {viewLedgerBalance !== null ? (
              <div style={{ marginTop: '0.75rem', padding: '8px 13px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: '0.82rem', lineHeight: '1.7' }}>
                <span style={{ color: '#6b7280' }}>Balance Before Purchase: </span>
                <strong style={{ color: (viewLedgerBalance + toNumber(viewPurchase.totalAmount)) >= 0 ? '#15803d' : '#dc2626' }}>
                  {Math.abs(viewLedgerBalance + toNumber(viewPurchase.totalAmount)).toFixed(2)}{' '}
                  {(viewLedgerBalance + toNumber(viewPurchase.totalAmount)) >= 0 ? 'Dr' : 'Cr'}
                </strong>
                <span style={{ color: '#6b7280', marginLeft: 24 }}>Current Balance (After): </span>
                <strong style={{ color: viewLedgerBalance >= 0 ? '#15803d' : '#dc2626' }}>
                  {Math.abs(viewLedgerBalance).toFixed(2)} {viewLedgerBalance >= 0 ? 'Dr' : 'Cr'}
                </strong>
              </div>
            ) : null}
          </div>

          <div className="inline-actions inline-actions--end no-print" style={{ marginTop: '1rem' }}>
            <button type="button" className="secondary-action-button" onClick={() => printPurchase(viewPurchase)}>
              &#128424; Print
            </button>
            <button type="button" className="secondary-action-button" onClick={() => printGoodsReceiptNote(viewPurchase)}>
              &#128424; Goods Receipt Note
            </button>
            <button type="button" className="secondary-action-button" onClick={() => printGateEntryPass(viewPurchase)}>
              &#128424; Gate Entry Pass
            </button>
            <button type="button" className="primary-action-button" onClick={() => setIsViewModalOpen(false)}>
              Close
            </button>
          </div>
        </ModalDialog>
      ) : null}

      {/* ── Create / Edit Modal ── */}
      {isModalOpen ? (
        <ModalDialog
          title={editingPurchaseId ? 'Edit Purchase' : 'Create Purchase'}
          subtitle="Posted purchase with line items — inventory and payable updated on save"
          onClose={closeModal}
        >
          {renderPurchaseForm()}
        </ModalDialog>
      ) : null}

      {isSuccessModalOpen && createdPurchase ? (
        <ModalDialog
          title="Purchase Created"
          subtitle={`Purchase bill ${createdPurchase.billNo} created successfully`}
          onClose={() => setIsSuccessModalOpen(false)}
        >
          <p style={{ margin: 0 }}>Purchase has been posted successfully.</p>
          <div className="inline-actions inline-actions--end" style={{ marginTop: '1rem' }}>
            <button
              type="button"
              className="secondary-action-button"
              onClick={() => printPurchase(createdPurchase, createdPurchase._balanceSummary || {})}
            >
              &#128424; Print Bill
            </button>
            <button
              type="button"
              className="secondary-action-button"
              onClick={() => printGoodsReceiptNote(createdPurchase)}
            >
              &#128424; Goods Receipt Note
            </button>
            <button
              type="button"
              className="secondary-action-button"
              onClick={() => printGateEntryPass(createdPurchase)}
            >
              &#128424; Gate Entry Pass
            </button>
            <button
              type="button"
              className="secondary-action-button"
              onClick={() => {
                setIsSuccessModalOpen(false);
                openCreate();
              }}
            >
              Create Another
            </button>
            <button
              type="button"
              className="primary-action-button"
              onClick={() => {
                setIsSuccessModalOpen(false);
                navigate('/purchase');
              }}
            >
              Back to Purchases
            </button>
          </div>
        </ModalDialog>
      ) : null}
    </div>
  );
}

