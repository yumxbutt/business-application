import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import PageCard from '../components/ui/PageCard';
import ModalDialog from '../components/ui/ModalDialog';
import { Button, Input, Select } from '../ui-kit';
import { useAuth } from '../context/AuthContext';
import { useAccess } from '../hooks/useAccess';
import { contactService } from '../services/contactService';
import { productService } from '../services/productService';
import { inventoryService } from '../services/inventoryService';
import { salesService } from '../services/salesService';
import { ledgerService } from '../services/ledgerService';
import { settingsService } from '../services/settingsService';
import { openPrintWindow, fmtPrintDate, fmtNum } from '../utils/printHelper';
import { getOverallStockSummary } from '../utils/stockDisplay';
import PaymentSelector from '../components/PaymentSelector';
import {
  WALK_IN_CUSTOMER_NAME,
  resolveWalkInCustomerId,
  TAX_MODE_OPTIONS,
  TAX_MODE_NONE,
  normalizeTaxMode,
  resolveTaxRate,
  taxModeLabel,
} from '../config/posDefaults';

const defaultFilters = {
  search: '',
  status: 'all',
  startDate: '',
  endDate: '',
  branchId: '',
};

const defaultForm = {
  contactId: '',
  invoiceNo: '',
  saleDate: new Date().toISOString().split('T')[0],
  discount: '0',
  paidAmount: '0',
  branchId: '',
  taxMode: TAX_MODE_NONE,
};

const defaultItem = {
  productId: '',
  productName: '',
  units: [],
  unitId: '',
  conversionFactor: '1',
  sourceBranchId: '',
  stockOptions: [],
  currentBranchAvailable: null,
  productSalePrice: '0',
  productCostPrice: '0',
  quantity: '1',
  unitPrice: '0',
  notes: '',
};

const defaultAdditionalExpenses = [
  { name: 'Loading', amount: '0' },
  { name: 'UnLoading', amount: '0' },
  { name: 'Freight', amount: '0' },
  { name: 'Others', amount: '0' },
];

const toNumber = (value) => Number(value || 0);
const fmtBal = (n) => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '–';
  const v = Number(n);
  return `${Math.abs(v).toFixed(2)} ${v >= 0 ? 'Dr' : 'Cr'}`;
};
const formatQty = (value) => {
  const n = toNumber(value);
  if (!Number.isFinite(n)) return '0';
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
};
const getSellableQtyInSelectedUnit = (baseQty, conversionFactor) => {
  const factor = toNumber(conversionFactor) || 1;
  const qty = toNumber(baseQty) / factor;
  if (factor > 1) return Math.floor(Math.max(0, qty));
  return Math.max(0, qty);
};
const getAdditionalExpenseRows = (record) => {
  const raw = record?.additionalExpenses;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};
const makeInvoiceNo = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `INV-${y}${m}${d}-${hh}${mm}${ss}${ms}`;
};

export default function SalesPage({ createMode = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { has } = useAccess();
  const canCreateSale = has('sales:create');
  const canReturnSale = has('sales:return');
  const editIdFromNav = location.state?.editId;
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [filters, setFilters] = useState(defaultFilters);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [company, setCompany] = useState({});
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewSale, setViewSale] = useState(null);
  const [viewLedgerBalance, setViewLedgerBalance] = useState(null);
  const [isConfirmSubmitOpen, setIsConfirmSubmitOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [createdSale, setCreatedSale] = useState(null);
  const [formData, setFormData] = useState(defaultForm);
  const [items, setItems] = useState([{ ...defaultItem }]);
  const [additionalExpenses, setAdditionalExpenses] = useState(defaultAdditionalExpenses.map((row) => ({ ...row })));
  const [customerLedgerBalance, setCustomerLedgerBalance] = useState(null);
  const [salePayments, setSalePayments] = useState([]);
  const [editingSaleId, setEditingSaleId] = useState(null);
  const [autoPayEnabled, setAutoPayEnabled] = useState(true);

  const [itemSearch, setItemSearch] = useState([{ query: '', results: [], open: false }]);
  const searchTimers = useRef([]);
  const productSearchRef = useRef(null);
  const defaultSourceBranchId = String(user?.role === 'main_admin' ? (formData.branchId || '') : (user?.branchId || ''));
  const selectedBranchName = useMemo(() => {
    const match = branches.find((b) => String(b.id) === String(formData.branchId));
    return match?.name || (user?.branchName || 'Assigned Branch');
  }, [branches, formData.branchId, user?.branchName]);

  const salesSummary = useMemo(() => {
    const posted = sales.filter((s) => s.status === 'posted');
    const totalAmount = posted.reduce((sum, s) => sum + toNumber(s.totalAmount), 0);
    const totalPaid = posted.reduce((sum, s) => sum + toNumber(s.paidAmount), 0);
    const totalDue = posted.reduce((sum, s) => sum + toNumber(s.dueAmount), 0);
    return { count: sales.length, posted: posted.length, totalAmount, totalPaid, totalDue };
  }, [sales]);
  const loadSales = async (nextFilters = filters) => {
    setLoading(true);
    setError('');
    try {
      const data = await salesService.getSales(nextFilters);
      setSales(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadMeta = async () => {
    try {
      const meta = await productService.getMeta();
      setBranches(meta.branches || []);

      const scopedBranchId = user?.role === 'main_admin' ? undefined : user?.branchId;
      const customerRows = await contactService.getCustomers(scopedBranchId);
      setCustomers(customerRows);
    } catch (err) {
      setError(err.message);
    }
  };

  const resetCreateForm = useCallback(async () => {
    setError('');
    const initialBranchId = user?.role !== 'main_admin' ? String(user?.branchId || '') : '';
    let walkInId = '';

    try {
      if (initialBranchId) {
        const customerRows = await contactService.getCustomers(initialBranchId);
        setCustomers(customerRows);
        walkInId = resolveWalkInCustomerId(customerRows);
        if (!walkInId) {
          try {
            const defaultCustomer = await contactService.getDefaultCustomer(initialBranchId);
            walkInId = defaultCustomer?.id ? String(defaultCustomer.id) : '';
          } catch {
            walkInId = '';
          }
        }
      }
    } catch {
      // keep form usable even if customer list fails
    }

    setFormData({
      ...defaultForm,
      invoiceNo: makeInvoiceNo(),
      saleDate: new Date().toISOString().split('T')[0],
      branchId: initialBranchId,
      contactId: walkInId,
      paidAmount: '0',
    });
    setItems([{ ...defaultItem, sourceBranchId: initialBranchId }]);
    setAdditionalExpenses(defaultAdditionalExpenses.map((row) => ({ ...row })));
    setItemSearch([{ query: '', results: [], open: false }]);
    setCustomerLedgerBalance(null);
    setSalePayments([]);
    setAutoPayEnabled(Boolean(walkInId));
    setEditingSaleId(null);

    window.setTimeout(() => {
      productSearchRef.current?.focus?.();
    }, 80);
  }, [user?.branchId, user?.role]);

  useEffect(() => {
    if (!createMode) {
      loadSales();
    }
    settingsService.getCompanySettings().then(setCompany).catch(() => {});
  }, [createMode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user === undefined) return;
    loadMeta();
  }, [user?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!createMode) return;
    resetCreateForm();
  }, [createMode, resetCreateForm]);

  useEffect(() => {
    if (!createMode || !editIdFromNav) return;
    loadSaleForEdit(editIdFromNav);
  }, [createMode, editIdFromNav]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user?.role !== 'main_admin') return;
    if (!createMode) return;

    const loadBranchCustomers = async () => {
      if (!formData.branchId) {
        setCustomers([]);
        return;
      }

      try {
        const customerRows = await contactService.getCustomers(formData.branchId);
        setCustomers(customerRows);

        if (editingSaleId) return;

        const walkInId = resolveWalkInCustomerId(customerRows);
        setFormData((prev) => ({
          ...prev,
          contactId: walkInId || '',
        }));
        setAutoPayEnabled(Boolean(walkInId));
      } catch {
        setCustomers([]);
      }
    };

    loadBranchCustomers();
  }, [createMode, formData.branchId, user?.role, editingSaleId]);

  useEffect(() => {
    if (!createMode) return;
    setItems((prev) => prev.map((item) => ({
      ...item,
      sourceBranchId: item.sourceBranchId || defaultSourceBranchId,
    })));
  }, [createMode, defaultSourceBranchId]);

  useEffect(() => {
    if (!createMode) return;
    if (!formData.contactId) {
      setCustomerLedgerBalance(null);
      return;
    }

    ledgerService
      .getContactLedger(formData.contactId, {
        branchId: formData.branchId ? Number(formData.branchId) : undefined,
      })
      .then((data) => {
        const entries = data.entries || [];
        const last = entries[entries.length - 1];
        setCustomerLedgerBalance(last ? Number(last.runningBalance || 0) : 0);
      })
      .catch(() => setCustomerLedgerBalance(null));
  }, [createMode, formData.contactId, formData.branchId]);

  const totals = useMemo(() => {
    const subTotal = items.reduce((sum, item) => {
      return sum + toNumber(item.quantity) * toNumber(item.unitPrice);
    }, 0);

    const additionalExpensesTotal = additionalExpenses.reduce(
      (sum, expense) => sum + toNumber(expense.amount),
      0
    );
    const discount = toNumber(formData.discount);
    const paidAmount = toNumber(formData.paidAmount);
    const taxMode = normalizeTaxMode(formData.taxMode);
    const taxRate = resolveTaxRate(company, taxMode);
    const taxableBase = Math.max(0, subTotal + additionalExpensesTotal - discount);
    const taxAmount = Math.round(taxableBase * taxRate) / 100;
    const totalAmount = Math.max(0, taxableBase + taxAmount);
    const dueAmount = Math.max(0, totalAmount - paidAmount);
    return { subTotal, additionalExpensesTotal, taxMode, taxRate, taxAmount, totalAmount, dueAmount };
  }, [items, additionalExpenses, formData.discount, formData.paidAmount, formData.taxMode, company]);

  useEffect(() => {
    if (!createMode || editingSaleId || !autoPayEnabled) return;
    const nextPaid = String(Number(totals.totalAmount || 0).toFixed(2));
    setFormData((prev) => {
      if (prev.paidAmount === nextPaid) return prev;
      return { ...prev, paidAmount: nextPaid };
    });
  }, [createMode, editingSaleId, autoPayEnabled, totals.totalAmount]);

  const updateAdditionalExpense = (index, field, value) => {
    setAdditionalExpenses((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addAdditionalExpense = () => {
    setAdditionalExpenses((prev) => [...prev, { name: '', amount: '0' }]);
  };

  const removeAdditionalExpense = (index) => {
    setAdditionalExpenses((prev) => prev.filter((_, idx) => idx !== index));
  };

  const buildAdditionalExpensesPayload = () => {
    return additionalExpenses
      .map((expense, idx) => {
        const amount = toNumber(expense.amount);
        if (amount <= 0) return null;
        const name = String(expense.name || '').trim() || `Expense ${idx + 1}`;
        return { name, amount };
      })
      .filter(Boolean);
  };

  const loadSaleForEdit = async (saleId) => {
    setError('');
    try {
      const detail = await salesService.getSale(saleId);
      if (detail.status === 'cancelled') {
        setError('Cancelled invoices cannot be edited.');
        navigate('/sales');
        return;
      }
      setEditingSaleId(detail.id);
      setAutoPayEnabled(false);
      setFormData({
        contactId: String(detail.contactId || ''),
        invoiceNo: detail.invoiceNo || '',
        saleDate: detail.saleDate || new Date().toISOString().split('T')[0],
        discount: String(detail.discount || '0'),
        paidAmount: String(detail.paidAmount || '0'),
        branchId: String(detail.branchId || ''),
        taxMode: normalizeTaxMode(detail.taxMode),
      });
      setAdditionalExpenses(
        getAdditionalExpenseRows(detail).length
          ? getAdditionalExpenseRows(detail).map((expense, idx) => ({
              name: String(expense?.name || `Expense ${idx + 1}`),
              amount: String(expense?.amount || '0'),
            }))
          : defaultAdditionalExpenses.map((row) => ({ ...row }))
      );
      setSalePayments(
        (detail.paymentSplits || []).map((p) => ({
          paymentAccountId: p.paymentAccountId || p.accountId,
          accountName: p.name || p.accountName,
          amount: Number(p.amount || 0),
          accountType: p.accountType,
          bankName: p.bankName,
        }))
      );

      const itemUnitsArr = await Promise.all(
        (detail.items || []).map(async (item) => {
          if (!item.productId) return [];
          try { return await productService.getProductUnits(item.productId); }
          catch { return []; }
        })
      );

      const mappedItems = (detail.items || []).map((item, idx) => {
        const normalizedUnits = (itemUnitsArr[idx] || [])
          .map((u) => ({
            unitId: String(u.unitId || u.unit?.id || ''),
            unitName: u.unit?.name || u.unitName || u.unit?.code || 'Unit',
            unitCode: u.unit?.code || u.unitCode || '',
            conversionFactor: String(toNumber(u.conversionFactor) || 1),
            isSaleUnit: Boolean(u.isSaleUnit),
            isBaseUnit: Boolean(u.isBaseUnit) || toNumber(u.conversionFactor) === 1,
          }))
          .filter((u) => u.unitId)
          .sort((a, b) => toNumber(b.conversionFactor) - toNumber(a.conversionFactor));

        const selectedUnit = normalizedUnits.find((u) => String(u.unitId) === String(item.unitId));
        const fallbackUnit = normalizedUnits.find((u) => u.isSaleUnit) || normalizedUnits.find((u) => u.isBaseUnit) || normalizedUnits[0];
        const chosenUnit = selectedUnit || fallbackUnit;
        const chosenFactor = toNumber(chosenUnit?.conversionFactor) || toNumber(item.conversionFactor) || 1;

        return {
          productId: String(item.productId || ''),
          productName: item.product?.name || '',
          quantity: String(item.unitQty ?? item.quantity ?? '1'),
          unitPrice: String(toNumber(item.unitPrice || 0) * chosenFactor),
          notes: item.notes || '',
          unitId: chosenUnit ? String(chosenUnit.unitId) : '',
          units: normalizedUnits,
          conversionFactor: String(chosenFactor),
          sourceBranchId: String(item.sourceBranchId || detail.branchId || ''),
          stockOptions: [],
          currentBranchAvailable: null,
          productSalePrice: '0',
          productCostPrice: '0',
        };
      });

      setItems(mappedItems.length ? mappedItems : [{ ...defaultItem }]);
      setItemSearch(mappedItems.map((item) => ({
        query: item.productName,
        results: [],
        open: false,
      })));
    } catch (err) {
      setError(err.message);
    }
  };

  const openView = async (sale) => {
    setError('');
    setViewLedgerBalance(null);
    setViewSale(sale);
    setIsViewModalOpen(true);
    try {
      const detail = await salesService.getSale(sale.id);
      setViewSale(detail);
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

  const onRepostSale = async (sale) => {
    const yes = window.confirm(`Re-post invoice ${sale.invoiceNo}?`);
    if (!yes) return;

    setError('');
    try {
      await salesService.repostSale(sale.id);
      await loadSales(filters);
      if (isViewModalOpen && viewSale && Number(viewSale.id) === Number(sale.id)) {
        const refreshed = await salesService.getSale(sale.id);
        setViewSale(refreshed);
      }
    } catch (err) {
      setError(err.message || 'Failed to re-post sale');
    }
  };

  const onCancelSale = async (sale) => {
    const yes = window.confirm(`Cancel invoice ${sale.invoiceNo}?`);
    if (!yes) return;

    setError('');
    try {
      await salesService.cancelSale(sale.id);
      await loadSales(filters);
    } catch (err) {
      setError(err.message || 'Failed to cancel sale');
    }
  };

  const onFormChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === 'contactId') {
      const selected = (customers || []).find((row) => String(row.id) === String(value));
      setAutoPayEnabled(selected?.name === WALK_IN_CUSTOMER_NAME);
    }

    if (name === 'paidAmount') {
      setAutoPayEnabled(false);
    }

    if (name === 'branchId') {
      setAutoPayEnabled(true);
    }
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
        // product search failed — keep previous results
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
      next[index] = { ...next[index], productId: '', productName: query, unitId: '', units: [], conversionFactor: '1' };
      return next;
    });

    triggerProductSearch(index, query);
  };

  const selectProduct = (index, product) => {
    const saleBranchId = Number(formData.branchId || user?.branchId || 0);
    const branchPool = branches.length
      ? branches
      : (saleBranchId ? [{ id: saleBranchId, name: `Branch-${saleBranchId}` }] : []);

    setItems((prev) => {
      const next = [...prev];
      const existingSourceBranchId = next[index]?.sourceBranchId || (saleBranchId ? String(saleBranchId) : '');
      next[index] = {
        ...next[index],
        productId: String(product.id),
        productName: product.name,
        sourceBranchId: existingSourceBranchId,
        unitPrice: String(product.salePrice || product.purchasePrice || '0'),
        units: [],
        unitId: '',
        conversionFactor: '1',
        stockOptions: [],
        currentBranchAvailable: null,
      };
      return next;
    });

    setItemSearch((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], query: product.name, results: [], open: false };
      return next;
    });

    Promise.all([
      productService.getProductUnits(product.id).catch(() => []),
      Promise.all(
      branchPool.map(async (branch) => {
        let availableQty = 0;
        let rate = toNumber(product.salePrice || product.purchasePrice || 0);
        let breakdown = [];
        let latestOpen = null;

        try {
          const stock = await inventoryService.getProductStock(branch.id, product.id, { mode: 'all' });
          availableQty = toNumber(stock.baseQty);
          breakdown = stock?.breakdown || [];
        } catch {
          availableQty = 0;
          breakdown = [];
        }

        try {
          const fifo = await inventoryService.getFifoReport({
            branchId: branch.id,
            productId: product.id,
            onlyOpen: true,
          });
          const rows = fifo?.rows || [];
          latestOpen = rows.length ? rows[rows.length - 1] : null;
          if (latestOpen && toNumber(latestOpen.salePrice) > 0) {
            rate = toNumber(latestOpen.salePrice);
          }
        } catch {
          // fifo lookup failed — keep default rate
        }

        return {
          branchId: Number(branch.id),
          branchName: branch.name,
          availableQty,
          breakdown,
          cost: toNumber(latestOpen?.costPrice || product.purchasePrice || 0),
          refSalePrice: toNumber(product.salePrice || 0),
          rate,
        };
      })
      ),
    ]).then(([unitRows, options]) => {
      setItems((prev) => {
        const next = [...prev];
        const current = next[index];
        if (!current || String(current.productId) !== String(product.id)) return prev;

        const units = (unitRows || [])
          .map((u) => ({
            unitId: String(u.unitId || u.unit?.id || ''),
            unitName: u.unit?.name || u.unitName || u.unit?.code || 'Unit',
            unitCode: u.unit?.code || u.unitCode || '',
            conversionFactor: String(toNumber(u.conversionFactor) || 1),
            isSaleUnit: Boolean(u.isSaleUnit),
            isBaseUnit: Boolean(u.isBaseUnit) || toNumber(u.conversionFactor) === 1,
          }))
          .filter((u) => u.unitId)
          .sort((a, b) => toNumber(b.conversionFactor) - toNumber(a.conversionFactor));
        const normalizedUnits = units.length
          ? units
          : [{ unitId: 'base', unitName: 'Base Unit', unitCode: 'BASE', conversionFactor: '1', isSaleUnit: true, isBaseUnit: true }];

        const selected = options.find((o) => String(o.branchId) === String(current.sourceBranchId))
          || options.find((o) => o.availableQty > 0)
          || options[0];

        const currentBranch = options.find((o) => String(o.branchId) === String(saleBranchId));

        const preferredUnit =
          normalizedUnits.find((u) => u.isSaleUnit)
          || normalizedUnits.find((u) => u.isBaseUnit)
          || normalizedUnits[0]
          || { unitId: '', conversionFactor: '1', unitName: 'Base' };
        const factor = toNumber(preferredUnit.conversionFactor) || 1;
        const displayRate = toNumber(selected?.rate || current.unitPrice || 0) * factor;
        const displayRefSale = toNumber(product.salePrice || selected?.rate || 0) * factor;
        const displayCost = toNumber(selected?.cost || product.purchasePrice || 0) * factor;

        next[index] = {
          ...current,
          stockOptions: options,
          sourceBranchId: selected ? String(selected.branchId) : current.sourceBranchId,
          units: normalizedUnits,
          unitId: preferredUnit.unitId,
          conversionFactor: String(factor),
          productSalePrice: String(displayRefSale),
          productCostPrice: String(displayCost),
          unitPrice: String(displayRate),
          currentBranchAvailable: currentBranch ? toNumber(currentBranch.availableQty) : null,
        };
        return next;
      });
    });
  };

  const onItemUnitChange = (index, unitId) => {
    setItems((prev) => {
      const next = [...prev];
      const row = next[index];
      const selectedUnit = (row.units || []).find((u) => String(u.unitId) === String(unitId));
      const factor = toNumber(selectedUnit?.conversionFactor) || 1;
      const selectedBranch = (row.stockOptions || []).find((o) => String(o.branchId) === String(row.sourceBranchId));
      const currentBaseRate = toNumber(row.unitPrice) / (toNumber(row.conversionFactor) || 1);
      const baseRate = toNumber(selectedBranch?.rate || currentBaseRate || 0);
      const refBaseSale = toNumber(selectedBranch?.refSalePrice || (toNumber(row.productSalePrice) / (toNumber(row.conversionFactor) || 1)) || 0);
      const baseCost = toNumber(selectedBranch?.cost || (toNumber(row.productCostPrice) / (toNumber(row.conversionFactor) || 1)) || 0);
      next[index] = {
        ...row,
        unitId,
        conversionFactor: String(factor),
        productCostPrice: String(baseCost * factor),
        unitPrice: String(baseRate * factor),
        productSalePrice: String(refBaseSale * factor),
      };
      return next;
    });
  };

  const onItemSourceBranchChange = (index, sourceBranchId) => {
    setItems((prev) => {
      const next = [...prev];
      const row = next[index];
      const option = (row.stockOptions || []).find((o) => String(o.branchId) === String(sourceBranchId));
      const factor = toNumber(row.conversionFactor) || 1;
      const baseRate = toNumber(option?.rate || row.unitPrice);
      const baseCost = toNumber(option?.cost || (toNumber(row.productCostPrice) / (factor || 1)) || 0);
      next[index] = {
        ...row,
        sourceBranchId,
        productCostPrice: option ? String(baseCost * factor) : row.productCostPrice,
        unitPrice: option ? String(baseRate * factor) : row.unitPrice,
        productSalePrice: option ? String(toNumber(option.refSalePrice || 0) * factor) : row.productSalePrice,
      };
      return next;
    });
  };

  const onItemChange = (index, field, value) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addItemRow = () => {
    setItems((prev) => [...prev, { ...defaultItem, sourceBranchId: defaultSourceBranchId }]);
    setItemSearch((prev) => [...prev, { query: '', results: [], open: false }]);
  };

  const deriveBalanceSummary = useCallback((saleRecord, overrideCurrentAfter) => {
    if (!saleRecord) return { previousBalance: undefined, netBalance: undefined };

    const currentAfter =
      overrideCurrentAfter !== undefined && overrideCurrentAfter !== null
        ? Number(overrideCurrentAfter)
        : saleRecord?._balanceSummary?.netBalance !== undefined
          ? Number(saleRecord._balanceSummary.netBalance)
          : saleRecord?.contactBalance !== undefined && saleRecord?.contactBalance !== null
            ? Number(saleRecord.contactBalance)
            : undefined;

    if (currentAfter === undefined || Number.isNaN(currentAfter)) {
      return { previousBalance: undefined, netBalance: undefined };
    }

    return {
      previousBalance: Number(currentAfter - toNumber(saleRecord.dueAmount || 0)),
      netBalance: Number(currentAfter),
    };
  }, []);

  const printSale = (saleRecord, balances = {}) => {
    if (!saleRecord) return;
    const fallbackSummary = deriveBalanceSummary(saleRecord, viewLedgerBalance);
    const hasBalanceSummary = balances.previousBalance !== undefined && balances.netBalance !== undefined;
    const currentAfter = hasBalanceSummary
      ? Number(balances.netBalance)
      : fallbackSummary.netBalance;
    const previousBefore = hasBalanceSummary
      ? Number(balances.previousBalance)
      : fallbackSummary.previousBalance;
    const qtyText = (item) => {
      if (item && item.unitQty != null) {
        const code = item.unit?.code || '';
        return `${Number(item.unitQty || 0)} ${code}`.trim();
      }
      return String(Number(item?.quantity || 0));
    };
    const unitRate = (item) => {
      if (item && item.unitQty != null) {
        return Number(item.unitPrice || 0) * (Number(item.conversionFactor || 1) || 1);
      }
      return Number(item?.unitPrice || 0);
    };
    const lineTotal = (item) => {
      if (item && item.unitQty != null) {
        return Number(item.unitQty || 0) * unitRate(item);
      }
      return Number(item?.lineAmount || 0);
    };
    const itemRows = (saleRecord.items || []).map((item, i) =>
      `<tr>
        <td>${i + 1}</td>
        <td>${item.product?.name || item.productId}</td>
        <td>${item.sourceBranch?.name || item.sourceBranchId || '–'}</td>
        <td class="tr">${qtyText(item)}</td>
        <td class="tr">${fmtNum(unitRate(item))}</td>
        <td class="tr">${fmtNum(lineTotal(item))}</td>
      </tr>`
    ).join('');

    const splits = saleRecord.paymentSplits || [];
    const additionalExpenseRows = getAdditionalExpenseRows(saleRecord);
    const paymentSplitHtml = Number(saleRecord.paidAmount) > 0 ? `
      <div class="tot" style="margin-top:8px">
        <div class="tot-row" style="background:#f0fdf4;font-weight:700"><span>Payment Method(s)</span><span>${fmtNum(saleRecord.paidAmount)}</span></div>
        ${splits.length > 0
          ? splits.map((s) => `<div class="tot-row"><span>${s.name || 'Cash'}${s.accountType === 'bank' && s.bankName ? ` (${s.bankName})` : ''}</span><span>${fmtNum(s.amount)}</span></div>`).join('')
          : `<div class="tot-row"><span>Cash</span><span>${fmtNum(saleRecord.paidAmount)}</span></div>`}
      </div>` : '';

    const body = `
      <table>
        <thead><tr><th>#</th><th>Product</th><th>Stock Branch</th><th class="tr">Qty</th><th class="tr">Rate</th><th class="tr">Line Total</th></tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div class="tot" style="margin-top:14px">
        <div class="tot-row"><span>Sub Total</span><span>${fmtNum(saleRecord.subTotal)}</span></div>
        ${additionalExpenseRows.map((exp) =>
          `<div class="tot-row" style="color:#64748b"><span style="padding-left:16px">- ${exp.name}</span><span>${fmtNum(exp.amount)}</span></div>`
        ).join('')}
        <div class="tot-row"><span>Additional Expenses</span><span>${fmtNum(saleRecord.additionalExpensesTotal || 0)}</span></div>
        <div className="tot-row"><span>Discount</span><span>(${fmtNum(saleRecord.discount)})</span></div>
        ${toNumber(saleRecord.taxAmount) > 0
          ? `<div class="tot-row"><span>${taxModeLabel(saleRecord.taxMode)} (${fmtNum(saleRecord.taxRate)}%)</span><span>${fmtNum(saleRecord.taxAmount)}</span></div>`
          : `<div class="tot-row"><span>Tax</span><span>No Tax</span></div>`}
        <div class="tot-row"><span>Total</span><span>${fmtNum(saleRecord.totalAmount)}</span></div>
        <div class="tot-row"><span>Received</span><span>${fmtNum(saleRecord.paidAmount)}</span></div>
        <div class="tot-row"><span>Due</span><span>${fmtNum(saleRecord.dueAmount)}</span></div>
        ${previousBefore !== undefined ? `<div class="tot-row" style="background:#fef9c3"><span>Previous Balance</span><span>${fmtBal(previousBefore)}</span></div>` : ''}
        ${currentAfter !== undefined ? `<div class="tot-row" style="background:#fef9c3;font-weight:700"><span>Net Balance</span><span>${fmtBal(currentAfter)}</span></div>` : ''}
      </div>
      ${paymentSplitHtml}`;

    openPrintWindow({
      title: 'Sales Invoice',
      titleBar: 'SALES INVOICE',
      company,
      metaFields: [
        ['Invoice No.', saleRecord.invoiceNo],
        ['Date', fmtPrintDate(saleRecord.saleDate)],
        ['Customer', saleRecord.contact?.name || '–'],
        ['Status', saleRecord.status || '–'],
      ],
      bodyHtml: body,
      showSignatures: true,
    });
  };

  const printDeliveryChallan = (saleRecord) => {
    if (!saleRecord) return;
    const qtyText = (item) => {
      if (item && item.unitQty != null) {
        const code = item.unit?.code || '';
        return `${Number(item.unitQty || 0)} ${code}`.trim();
      }
      return String(Number(item?.quantity || 0));
    };
    const allUnitCodes = (saleRecord.items || [])
      .map((row) => row?.unit?.code || null)
      .filter(Boolean);
    const singleUnitCode = allUnitCodes.length > 0 && new Set(allUnitCodes).size === 1 ? allUnitCodes[0] : null;
    const totalSelectedUnitQty = singleUnitCode
      ? (saleRecord.items || []).reduce((sum, row) => sum + Number(row.unitQty || 0), 0)
      : null;
    const itemRows = (saleRecord.items || []).map((item, i) =>
      `<tr>
        <td>${i + 1}</td>
        <td>${item.product?.name || item.productId}</td>
        <td>${item.sourceBranch?.name || item.sourceBranchId || '–'}</td>
        <td class="tr">${qtyText(item)}</td>
        <td>${item.notes || '–'}</td>
      </tr>`
    ).join('');

    const body = `
      <table>
        <thead><tr><th>#</th><th>Product</th><th>Stock Branch</th><th class="tr">Qty</th><th>Remarks</th></tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div class="tot" style="margin-top:14px">
        <div class="tot-row"><span>Total Items</span><span>${saleRecord.items?.length || 0}</span></div>
        <div class="tot-row"><span>Total Quantity</span><span>${
          totalSelectedUnitQty != null
            ? `${fmtNum(totalSelectedUnitQty)} ${singleUnitCode}`.trim()
            : fmtNum((saleRecord.items || []).reduce((sum, row) => sum + Number(row.quantity || 0), 0))
        }</span></div>
      </div>`;

    openPrintWindow({
      title: 'Delivery Challan',
      titleBar: 'DELIVERY CHALLAN',
      company,
      metaFields: [
        ['Challan Ref', `DC-${saleRecord.invoiceNo || 'NA'}`],
        ['Invoice No.', saleRecord.invoiceNo],
        ['Date', fmtPrintDate(saleRecord.saleDate)],
        ['Customer', saleRecord.contact?.name || '–'],
        ['Status', saleRecord.status || '–'],
      ],
      bodyHtml: body,
      showSignatures: true,
    });
  };

  const printGatePass = (saleRecord) => {
    if (!saleRecord) return;
    const qtyText = (item) => {
      if (item && item.unitQty != null) {
        const code = item.unit?.code || '';
        return `${Number(item.unitQty || 0)} ${code}`.trim();
      }
      return String(Number(item?.quantity || 0));
    };
    const allUnitCodes = (saleRecord.items || [])
      .map((row) => row?.unit?.code || null)
      .filter(Boolean);
    const singleUnitCode = allUnitCodes.length > 0 && new Set(allUnitCodes).size === 1 ? allUnitCodes[0] : null;
    const totalSelectedUnitQty = singleUnitCode
      ? (saleRecord.items || []).reduce((sum, row) => sum + Number(row.unitQty || 0), 0)
      : null;
    const itemRows = (saleRecord.items || []).map((item, i) =>
      `<tr>
        <td>${i + 1}</td>
        <td>${item.product?.name || item.productId}</td>
        <td class="tr">${qtyText(item)}</td>
        <td>${item.sourceBranch?.name || item.sourceBranchId || '–'}</td>
      </tr>`
    ).join('');

    const body = `
      <table>
        <thead><tr><th>#</th><th>Product</th><th class="tr">Qty</th><th>Source Branch</th></tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div class="tot" style="margin-top:14px">
        <div class="tot-row"><span>Gate Pass Ref</span><span>GP-${saleRecord.invoiceNo || 'NA'}</span></div>
        <div class="tot-row"><span>Total Quantity</span><span>${
          totalSelectedUnitQty != null
            ? `${fmtNum(totalSelectedUnitQty)} ${singleUnitCode}`.trim()
            : fmtNum((saleRecord.items || []).reduce((sum, row) => sum + Number(row.quantity || 0), 0))
        }</span></div>
      </div>`;

    openPrintWindow({
      title: 'Gate Pass',
      titleBar: 'GATE PASS',
      company,
      metaFields: [
        ['Gate Pass No.', `GP-${saleRecord.invoiceNo || 'NA'}`],
        ['Date', fmtPrintDate(saleRecord.saleDate)],
        ['Party', saleRecord.contact?.name || '–'],
        ['Invoice Ref', saleRecord.invoiceNo],
      ],
      bodyHtml: body,
      showSignatures: true,
    });
  };

  const removeItemRow = (index) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((_, idx) => idx !== index));
    setItemSearch((prev) => prev.filter((_, idx) => idx !== index));
  };

  const validateAndBuildPayload = () => {
    for (const item of items) {
      const factor = toNumber(item.conversionFactor) || 1;
      const baseQty = toNumber(item.quantity) * factor;
      const selectedOption = (item.stockOptions || []).find(
        (opt) => String(opt.branchId) === String(item.sourceBranchId)
      );
      const sellableQty = getSellableQtyInSelectedUnit(
        toNumber(selectedOption?.availableQty || 0),
        factor
      );
      if (toNumber(item.quantity) > sellableQty + 0.00001) {
        throw new Error(
          `Quantity for ${item.productName || 'selected product'} exceeds available quantity in selected unit (${formatQty(sellableQty)})`
        );
      }

      const selectedUnitCost = toNumber(item.productCostPrice || 0);
      if (toNumber(item.unitPrice) + 0.00001 < selectedUnitCost) {
        throw new Error(
          `Rate for ${item.productName || 'selected product'} cannot be less than cost (${selectedUnitCost.toFixed(2)})`
        );
      }

      if (selectedOption && baseQty > toNumber(selectedOption.availableQty) + 0.00001) {
        throw new Error(
          `Quantity for ${item.productName || 'selected product'} exceeds available stock in ${selectedOption.branchName}`
        );
      }
    }

    return {
      branchId: formData.branchId ? Number(formData.branchId) : undefined,
      contactId: Number(formData.contactId),
      invoiceNo: String(formData.invoiceNo || makeInvoiceNo()),
      saleDate: formData.saleDate,
      discount: toNumber(formData.discount),
      additionalExpenses: buildAdditionalExpensesPayload(),
      taxMode: normalizeTaxMode(formData.taxMode),
      paidAmount: toNumber(formData.paidAmount),
      payments: toNumber(formData.paidAmount) > 0 ? salePayments : [],
      items: items.map((item) => ({
        unitId: item.unitId ? Number(item.unitId) : null,
        quantity: toNumber(item.quantity),
        unitQty: toNumber(item.quantity),
        conversionFactor: toNumber(item.conversionFactor) || 1,
        productId: Number(item.productId),
        sourceBranchId: item.sourceBranchId ? Number(item.sourceBranchId) : undefined,
        // Send unit price as entered (price in selected unit). Backend will compute base qty/price.
        unitPrice: toNumber(item.unitPrice),
        notes: item.notes || null,
      })),
    };
  };

  const submitSale = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const payload = validateAndBuildPayload();
      setPendingPayload(payload);
      setIsConfirmSubmitOpen(true);
    } catch (err) {
      setError(err.message || 'Please review invoice before submitting');
    }
  };

  const confirmSubmitSale = async () => {
    if (!pendingPayload) return;
    setSubmitting(true);
    setError('');
    try {
      const sale = editingSaleId
        ? await salesService.updateSale(editingSaleId, pendingPayload)
        : await salesService.createSale(pendingPayload);
      const saleNetBalance = customerLedgerBalance !== null
        ? Number(customerLedgerBalance) + Number(sale.dueAmount || 0)
        : undefined;
      setCreatedSale({
        ...sale,
        paymentSplits: (sale.paymentSplits && sale.paymentSplits.length > 0)
          ? sale.paymentSplits
          : salePayments.filter((p) => Number(p.amount) > 0).map((p) => ({
              name: p.accountName || p.name || 'Cash',
              accountType: p.accountType || 'cash',
              bankName: p.bankName || null,
              amount: Number(p.amount),
            })),
        _balanceSummary: customerLedgerBalance !== null
          ? { previousBalance: customerLedgerBalance, netBalance: saleNetBalance }
          : undefined,
      });
      setIsConfirmSubmitOpen(false);
      setPendingPayload(null);
      setIsSuccessModalOpen(true);
    } catch (err) {
      setError(err.message);
      setIsConfirmSubmitOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadgeClass = (status) => {
    if (status === 'posted') return 'badge badge--green';
    if (status === 'cancelled') return 'badge badge--red';
    return 'badge badge--gray';
  };

  const renderCreateForm = () => (
    <form className="auth-form modal-form sale-invoice-form" onSubmit={submitSale}>
      {error ? <p className="error-text">{error}</p> : null}

      <div className="sale-invoice-form__meta">
        {user?.role === 'main_admin' ? (
          <label className="form-field" htmlFor="saleBranchId">
            <span>Branch *</span>
            <Select
              id="saleBranchId"
              name="branchId"
              value={formData.branchId}
              onChange={onFormChange}
              options={[{ value: '', label: 'Select branch' }, ...(branches || []).map((b) => ({ value: String(b.id), label: b.name }))]}
              required
            />
          </label>
        ) : (
          <label className="form-field" htmlFor="saleBranchReadonly">
            <span>Branch</span>
            <input id="saleBranchReadonly" value={selectedBranchName} readOnly />
          </label>
        )}

        <label className="form-field" htmlFor="saleInvoiceNo">
          <span>Invoice No *</span>
          <input
            id="saleInvoiceNo"
            name="invoiceNo"
            value={formData.invoiceNo}
            onChange={onFormChange}
            required
            placeholder="e.g. INV-1001"
          />
        </label>

        <label className="form-field" htmlFor="saleDate">
          <span>Sale Date *</span>
          <input
            id="saleDate"
            name="saleDate"
            type="date"
            value={formData.saleDate}
            onChange={onFormChange}
            required
          />
        </label>
      </div>

      <label className="form-field" htmlFor="saleCustomer">
        <span>Customer *</span>
        <Select
          id="saleCustomer"
          name="contactId"
          value={formData.contactId}
          onChange={onFormChange}
          options={[
            { value: '', label: 'Select customer' },
            ...(customers || []).map((c) => ({
              value: String(c.id),
              label: c.name === WALK_IN_CUSTOMER_NAME ? `${c.name} (default)` : c.name,
            })),
          ]}
          required
        />
      </label>

      {customerLedgerBalance !== null ? (
        <div className="sale-invoice-form__balance">
          <span>Customer Balance: </span>
          <strong className={customerLedgerBalance >= 0 ? 'is-dr' : 'is-cr'}>
            {Math.abs(customerLedgerBalance).toFixed(2)} {customerLedgerBalance >= 0 ? 'Dr' : 'Cr'}
          </strong>
          {totals.dueAmount > 0 ? (
            <>
              <span>After Invoice: </span>
              <strong className={(customerLedgerBalance + totals.dueAmount) >= 0 ? 'is-dr' : 'is-cr'}>
                {Math.abs(customerLedgerBalance + totals.dueAmount).toFixed(2)} {(customerLedgerBalance + totals.dueAmount) >= 0 ? 'Dr' : 'Cr'}
              </strong>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="table-wrap table-wrap--full" style={{ overflow: 'visible' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ minWidth: '160px' }}>Stock Branch</th>
              <th style={{ minWidth: '180px' }}>Product</th>
              <th style={{ minWidth: '120px' }}>Unit</th>
              <th style={{ minWidth: '120px' }} className="text-right">Available</th>
              <th style={{ minWidth: '80px' }}>Qty</th>
              <th style={{ minWidth: '110px' }}>Rate</th>
              <th style={{ minWidth: '110px' }} className="text-right">Line Total</th>
              <th style={{ minWidth: '120px' }}>Notes</th>
              <th className="text-right" style={{ minWidth: '70px' }}>Del</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const lineAmount = toNumber(item.quantity) * toNumber(item.unitPrice);
              const search = itemSearch[index] || { query: '', results: [], open: false };

              return (
                <tr key={`item-${index}`}>
                  <td>
                    <Select
                      value={item.sourceBranchId}
                      onChange={(e) => onItemSourceBranchChange(index, e.target.value)}
                      options={(item.stockOptions?.length ? item.stockOptions : branches.map((branch) => ({ branchId: branch.id, branchName: branch.name }))).map((opt) => ({ value: String(opt.branchId), label: opt.branchName }))}
                      required
                    />
                  </td>
                  <td style={{ position: 'relative' }}>
                    <Input
                      ref={index === 0 ? productSearchRef : undefined}
                      className=""
                      type="text"
                      value={search.query}
                      onChange={(e) => onItemSearchChange(index, e.target.value)}
                      placeholder="Type product / barcode…"
                      required
                    />
                    {(() => {
                      const selected = (item.stockOptions || []).find(
                        (opt) => String(opt.branchId) === String(item.sourceBranchId)
                      );
                      if (!selected) return null;
                      const overall = getOverallStockSummary(item.stockOptions || []);
                      return (
                        <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginTop: 3 }}>
                          {formatQty(overall.totalAvailable)}
                          {overall.unitText ? ` (${overall.unitText})` : ''}
                        </span>
                      );
                    })()}
                    {search.open && search.results.length > 0 ? (
                      <ul className="product-search-dropdown">
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
                    <Select
                      value={item.unitId}
                      onChange={(e) => onItemUnitChange(index, e.target.value)}
                      disabled={!item.productId}
                      options={(item.units || []).map((u) => ({ value: String(u.unitId), label: `${u.unitName}${toNumber(u.conversionFactor) !== 1 ? ` (×${u.conversionFactor})` : ''}` }))}
                    />
                  </td>
                  <td className="text-right">
                    {(() => {
                      const selected = (item.stockOptions || []).find(
                        (opt) => String(opt.branchId) === String(item.sourceBranchId)
                      );
                      const factor = toNumber(item.conversionFactor) || 1;
                      if (selected) {
                        const unitText = (selected.breakdown || [])
                          .filter((b) => toNumber(b.qty) > 0)
                          .map((b) => `${formatQty(b.qty)} ${b.unitCode || b.unitName || ''}`.trim())
                          .join(' + ');
                        const availableInSelectedUnit = getSellableQtyInSelectedUnit(toNumber(selected.availableQty), factor);
                        return (
                          <div>
                            <div>{formatQty(availableInSelectedUnit)}</div>
                            {unitText ? (
                              <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>{unitText}</div>
                            ) : null}
                            <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>
                              Cost: {toNumber(item.productCostPrice).toFixed(2)}
                            </div>
                          </div>
                        );
                      }
                      if (item.currentBranchAvailable !== null && item.currentBranchAvailable !== undefined) {
                        return formatQty(getSellableQtyInSelectedUnit(toNumber(item.currentBranchAvailable), factor || 1));
                      }
                      return '–';
                    })()}
                  </td>
                  <td>
                    <Input
                      className="no-spinner"
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
                      className="no-spinner"
                      type="number"
                      min={toNumber(item.productCostPrice || 0)}
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) => onItemChange(index, 'unitPrice', e.target.value)}
                      required
                    />
                    <span style={{ fontSize: '0.72rem', color: '#6b7280', display: 'block', marginTop: 3 }}>
                      Ref sale: {toNumber(item.productSalePrice || 0).toFixed(2)}
                    </span>
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

      <div className="sale-invoice-form__side-panel">
        <div className="sale-invoice-form__side-title">Additional Expenses</div>
        <div className="sale-invoice-form__expense-list">
          {additionalExpenses.map((expense, index) => (
            <div key={`sale-expense-${index}`} className="sale-invoice-form__expense-row">
              <Input
                type="text"
                value={expense.name}
                placeholder="Expense name"
                onChange={(e) => updateAdditionalExpense(index, 'name', e.target.value)}
              />
              <Input
                className="no-spinner"
                type="number"
                min="0"
                step="0.01"
                value={expense.amount}
                onChange={(e) => updateAdditionalExpense(index, 'amount', e.target.value)}
              />
              <button
                type="button"
                className="table-action-button table-action-button--danger"
                onClick={() => removeAdditionalExpense(index)}
                disabled={additionalExpenses.length === 1}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="inline-actions inline-actions--end">
          <button type="button" className="secondary-action-button" onClick={addAdditionalExpense}>
            + Add Expense
          </button>
        </div>
      </div>

      <div className="sale-invoice-form__side-panel">
        <div className="sale-invoice-form__amounts">
          <label className="form-field" htmlFor="saleTaxMode">
            <span>Tax</span>
            <select
              id="saleTaxMode"
              name="taxMode"
              value={normalizeTaxMode(formData.taxMode)}
              onChange={onFormChange}
            >
              {TAX_MODE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                  {opt.value === 'cash_tax' && Number(company?.cashTaxRate || 0) > 0
                    ? ` (${Number(company.cashTaxRate)}%)`
                    : ''}
                  {opt.value === 'card_tax' && Number(company?.cardTaxRate || 0) > 0
                    ? ` (${Number(company.cardTaxRate)}%)`
                    : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field" htmlFor="saleDiscount">
            <span>Discount</span>
            <input
              id="saleDiscount"
              name="discount"
              className="no-spinner"
              type="number"
              min="0"
              step="0.01"
              value={formData.discount}
              onChange={onFormChange}
            />
          </label>

          <label className="form-field" htmlFor="salePaidAmount">
            <span>Received</span>
            <input
              id="salePaidAmount"
              name="paidAmount"
              className="no-spinner"
              type="number"
              min="0"
              step="0.01"
              value={formData.paidAmount}
              onChange={onFormChange}
            />
          </label>
        </div>

        {toNumber(formData.paidAmount) > 0 ? (
          <PaymentSelector
            totalAmount={toNumber(formData.paidAmount)}
            branchId={formData.branchId ? Number(formData.branchId) : (user?.branchId ? Number(user.branchId) : undefined)}
            onChange={setSalePayments}
            disabled={submitting}
            label="Payment Accounts"
          />
        ) : null}

        <div className="totals-panel sale-invoice-form__totals">
          <div className="totals-row"><span>Sub Total</span><span>{totals.subTotal.toFixed(2)}</span></div>
          <div className="totals-row"><span>Additional Expenses</span><span>{totals.additionalExpensesTotal.toFixed(2)}</span></div>
          <div className="totals-row"><span>Discount</span><span>({toNumber(formData.discount).toFixed(2)})</span></div>
          <div className="totals-row">
            <span>{totals.taxMode === TAX_MODE_NONE ? 'Tax' : `${taxModeLabel(totals.taxMode)} (${totals.taxRate}%)`}</span>
            <span>{totals.taxMode === TAX_MODE_NONE ? 'No Tax' : totals.taxAmount.toFixed(2)}</span>
          </div>
          <div className="totals-row totals-row--total"><span>Total</span><span>{totals.totalAmount.toFixed(2)}</span></div>
          <div className="totals-row"><span>Received</span><span>{toNumber(formData.paidAmount).toFixed(2)}</span></div>
          <div className="totals-row due-row"><span>Due</span><span>{totals.dueAmount.toFixed(2)}</span></div>
        </div>
      </div>

      <div className="inline-actions inline-actions--end">
        <Button variant="secondary" onClick={() => navigate('/sales')}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : (editingSaleId ? 'Update Invoice' : 'Create Invoice')}
        </Button>
      </div>
    </form>
  );

  if (createMode) {
    return (
      <div className="dashboard-stack">
        <PageCard
          title={editingSaleId ? 'Edit Sales Invoice' : 'Create Sales Invoice'}
          subtitle={editingSaleId ? 'Update posted sale line items and amounts' : 'Posted sale with line items — inventory and receivable updated on save'}
          actions={
            <Button variant="secondary" className="no-print" onClick={() => navigate('/sales')}>
              Back to Sales
            </Button>
          }
        >
          {renderCreateForm()}
        </PageCard>

        {isConfirmSubmitOpen ? (
          <ModalDialog
            title={editingSaleId ? 'Confirm Invoice Update' : 'Confirm Invoice Submission'}
            subtitle={editingSaleId ? 'Please confirm before updating this sales invoice' : 'Please confirm before creating this sales invoice'}
            onClose={() => setIsConfirmSubmitOpen(false)}
          >
            <p style={{ margin: 0 }}>{editingSaleId ? 'Are you sure you want to update this invoice?' : 'Are you sure you want to create this invoice?'}</p>
            {customerLedgerBalance !== null ? (
              <div style={{ marginTop: '0.8rem', padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '0.83rem' }}>
                <div><span style={{ color: '#64748b' }}>Previous Balance: </span><strong>{fmtBal(customerLedgerBalance)}</strong></div>
                <div><span style={{ color: '#64748b' }}>Net Balance: </span><strong>{fmtBal(Number(customerLedgerBalance) + Number(totals.dueAmount || 0))}</strong></div>
              </div>
            ) : null}
            <div className="inline-actions inline-actions--end" style={{ marginTop: '1rem' }}>
              <button
                type="button"
                className="secondary-action-button"
                onClick={() => setIsConfirmSubmitOpen(false)}
                disabled={submitting}
              >
                No
              </button>
              <button
                type="button"
                className="primary-action-button"
                onClick={confirmSubmitSale}
                disabled={submitting}
              >
                {submitting ? (editingSaleId ? 'Updating…' : 'Creating…') : (editingSaleId ? 'Yes, Update Invoice' : 'Yes, Create Invoice')}
              </button>
            </div>
          </ModalDialog>
        ) : null}

        {isSuccessModalOpen && createdSale ? (
          <ModalDialog
            title={editingSaleId ? 'Invoice Updated' : 'Invoice Created'}
            subtitle={`Invoice ${createdSale.invoiceNo} ${editingSaleId ? 'updated' : 'created'} successfully`}
            onClose={() => setIsSuccessModalOpen(false)}
          >
            <p style={{ margin: 0 }}>Sales invoice has been {editingSaleId ? 'updated' : 'posted'} successfully.</p>
            <div className="inline-actions inline-actions--end" style={{ marginTop: '1rem' }}>
              <button
                type="button"
                className="secondary-action-button"
                onClick={() => printSale(createdSale, createdSale._balanceSummary || {})}
              >
                &#128424; Print Invoice
              </button>
              <button
                type="button"
                className="secondary-action-button"
                onClick={() => printDeliveryChallan(createdSale)}
              >
                &#128424; Delivery Challan
              </button>
              <button
                type="button"
                className="secondary-action-button"
                onClick={() => printGatePass(createdSale)}
              >
                &#128424; Gate Pass
              </button>
              <button
                type="button"
                className="primary-action-button"
                onClick={() => {
                  setIsSuccessModalOpen(false);
                  resetCreateForm();
                }}
              >
                Save & New
              </button>
              <button
                type="button"
                className="secondary-action-button"
                onClick={() => {
                  setIsSuccessModalOpen(false);
                  navigate('/sales');
                }}
              >
                Back to Sales
              </button>
            </div>
          </ModalDialog>
        ) : null}
      </div>
    );
  }

  return (
    <div className="dashboard-stack">
      {!createMode ? (
        <div className="page-stats-strip no-print">
          <div className="page-stat-tile">
            <span className="page-stat-tile__label">Total Invoices</span>
            <span className="page-stat-tile__value">{salesSummary.count}</span>
          </div>
          <div className="page-stat-tile page-stat-tile--purple">
            <span className="page-stat-tile__label">Posted</span>
            <span className="page-stat-tile__value">{salesSummary.posted}</span>
          </div>
          <div className="page-stat-tile page-stat-tile--primary">
            <span className="page-stat-tile__label">Revenue (Posted)</span>
            <span className="page-stat-tile__value">{salesSummary.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="page-stat-tile page-stat-tile--success">
            <span className="page-stat-tile__label">Collected</span>
            <span className="page-stat-tile__value">{salesSummary.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="page-stat-tile page-stat-tile--danger">
            <span className="page-stat-tile__label">Receivable</span>
            <span className="page-stat-tile__value">{salesSummary.totalDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      ) : null}
      <PageCard
        title="Sales"
        subtitle="Create and manage customer sales invoices"
        actions={
          canCreateSale ? (
            <Button
              variant="primary"
              className="no-print"
              onClick={() => {
                resetCreateForm();
                navigate('/sales/new');
              }}
            >
              Add Invoice
            </Button>
          ) : null
        }
      >
        {error ? <p className="error-text">{error}</p> : null}

        <div className="table-filters no-print">
          <label className="form-field table-filters__search" htmlFor="salesSearch">
            <span>Search Invoice No</span>
            <input
              id="salesSearch"
              type="text"
              placeholder="e.g. INV-1001"
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            />
          </label>

          <label className="form-field" htmlFor="salesStatus">
            <span>Status</span>
            <Select
              id="salesStatus"
              value={filters.status}
              onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
              options={[
                { value: 'all', label: 'All' },
                { value: 'posted', label: 'Posted' },
                { value: 'draft', label: 'Draft' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
            />
          </label>

          <label className="form-field" htmlFor="salesStartDate">
            <span>From</span>
            <input
              id="salesStartDate"
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
            />
          </label>

          <label className="form-field" htmlFor="salesEndDate">
            <span>To</span>
            <input
              id="salesEndDate"
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
            />
          </label>

          {user?.role === 'main_admin' ? (
            <label className="form-field" htmlFor="salesBranchFilter">
              <span>Branch</span>
              <Select
                id="salesBranchFilter"
                value={filters.branchId}
                onChange={(e) => setFilters((prev) => ({ ...prev, branchId: e.target.value }))}
                options={[{ value: '', label: 'All branches' }, ...(branches || []).map((b) => ({ value: String(b.id), label: b.name }))]}
              />
            </label>
          ) : null}

          <button
            type="button"
            className="secondary-action-button no-print"
            style={{ alignSelf: 'flex-end' }}
            onClick={() => loadSales(filters)}
          >
            Apply Filters
          </button>
        </div>

        {loading ? (
          <p>Loading sales…</p>
        ) : (
          <div className="table-wrap table-wrap--full">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice No</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Paid</th>
                  <th className="text-right">Due</th>
                  <th className="text-right no-print">Action</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((row) => (
                  <tr key={row.id}>
                    <td>{row.invoiceNo}</td>
                    <td>{row.saleDate}</td>
                    <td>{row.contact?.name || '–'}</td>
                    <td><span className={statusBadgeClass(row.status)}>{row.status}</span></td>
                    <td className="text-right">{toNumber(row.totalAmount).toFixed(2)}</td>
                    <td className="text-right">{toNumber(row.paidAmount).toFixed(2)}</td>
                    <td className="text-right">{toNumber(row.dueAmount).toFixed(2)}</td>
                    <td className="text-right no-print">
                      <div className="inline-actions inline-actions--end">
                        <button type="button" className="table-action-button" onClick={() => openView(row)}>
                          View
                        </button>
                        {canCreateSale ? (
                          <button
                            type="button"
                            className="table-action-button"
                            onClick={() => navigate('/sales/new', { state: { editId: row.id } })}
                            disabled={row.status === 'cancelled'}
                          >
                            Edit
                          </button>
                        ) : null}
                        {canReturnSale ? (
                          <button
                            type="button"
                            className="table-action-button"
                            onClick={() => navigate(`/sales-returns?saleId=${row.id}&invoiceNo=${encodeURIComponent(row.invoiceNo)}`)}
                            disabled={row.status === 'cancelled'}
                          >
                            Return
                          </button>
                        ) : null}
                        {canCreateSale ? (
                          <button
                            type="button"
                            className={row.status === 'cancelled' ? 'table-action-button' : 'table-action-button table-action-button--danger'}
                            onClick={() => (row.status === 'cancelled' ? onRepostSale(row) : onCancelSale(row))}
                          >
                            {row.status === 'cancelled' ? 'Post' : 'Cancel'}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {sales.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="empty-state-cell">No sales records found.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </PageCard>

      {isViewModalOpen && viewSale ? (
        <ModalDialog
          title={`Invoice: ${viewSale.invoiceNo}`}
          subtitle={`${viewSale.saleDate} · ${viewSale.contact?.name || ''}`}
          onClose={() => setIsViewModalOpen(false)}
        >
          <div className="table-wrap table-wrap--full" style={{ marginTop: '0.5rem' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Product</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Rate</th>
                  <th className="text-right">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {(viewSale.items || []).map((item, i) => (
                  <tr key={item.id}>
                    <td>{i + 1}</td>
                    <td>{item.product?.name || item.productId}</td>
                    <td className="text-right">
                      {item.unitQty != null
                        ? `${toNumber(item.unitQty)} ${item.unit?.code || ''}`.trim()
                        : toNumber(item.quantity)}
                    </td>
                    <td className="text-right">
                      {item.unitQty != null
                        ? toNumber(toNumber(item.unitPrice) * (toNumber(item.conversionFactor) || 1)).toFixed(2)
                        : toNumber(item.unitPrice).toFixed(2)}
                    </td>
                    <td className="text-right">
                      {item.unitQty != null
                        ? (toNumber(item.unitQty) * toNumber(toNumber(item.unitPrice) * (toNumber(item.conversionFactor) || 1))).toFixed(2)
                        : toNumber(item.lineAmount).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="totals-panel">
            <div className="totals-row"><span>Sub Total</span><span>{toNumber(viewSale.subTotal).toFixed(2)}</span></div>
            <div className="totals-row"><span>Additional Expenses</span><span>{toNumber(viewSale.additionalExpensesTotal).toFixed(2)}</span></div>
            {getAdditionalExpenseRows(viewSale).map((expense, idx) => (
              <div className="totals-row" key={`view-sale-expense-${idx}`} style={{ color: '#64748b' }}><span style={{ paddingLeft: 16 }}>- {expense.name}</span><span>{toNumber(expense.amount).toFixed(2)}</span></div>
            ))}
            <div className="totals-row"><span>Discount</span><span>({toNumber(viewSale.discount).toFixed(2)})</span></div>
            <div className="totals-row">
              <span>
                {toNumber(viewSale.taxAmount) > 0
                  ? `${taxModeLabel(viewSale.taxMode)} (${toNumber(viewSale.taxRate)}%)`
                  : 'Tax'}
              </span>
              <span>{toNumber(viewSale.taxAmount) > 0 ? toNumber(viewSale.taxAmount).toFixed(2) : 'No Tax'}</span>
            </div>
            <div className="totals-row totals-row--total"><span>Total</span><span>{toNumber(viewSale.totalAmount).toFixed(2)}</span></div>
            <div className="totals-row"><span>Paid</span><span>{toNumber(viewSale.paidAmount).toFixed(2)}</span></div>
            <div className="totals-row due-row"><span>Due</span><span>{toNumber(viewSale.dueAmount).toFixed(2)}</span></div>
          </div>

          {(() => {
            const summary = deriveBalanceSummary(viewSale, viewLedgerBalance);
            if (summary.netBalance === undefined || summary.previousBalance === undefined) return null;
            return (
              <div style={{ marginTop: '0.75rem', padding: '8px 13px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: '0.82rem', lineHeight: '1.7' }}>
                <span style={{ color: '#6b7280' }}>Previous Balance: </span>
                <strong style={{ color: summary.previousBalance >= 0 ? '#15803d' : '#dc2626' }}>
                  {Math.abs(summary.previousBalance).toFixed(2)} {summary.previousBalance >= 0 ? 'Dr' : 'Cr'}
                </strong>
                <span style={{ color: '#6b7280', marginLeft: 24 }}>Net Balance: </span>
                <strong style={{ color: summary.netBalance >= 0 ? '#15803d' : '#dc2626' }}>
                  {Math.abs(summary.netBalance).toFixed(2)} {summary.netBalance >= 0 ? 'Dr' : 'Cr'}
                </strong>
              </div>
            );
          })()}

          <div className="inline-actions inline-actions--end" style={{ marginTop: '1rem' }}>
            <button
              type="button"
              className="secondary-action-button"
              onClick={() => {
                navigate(`/sales-returns?saleId=${viewSale.id}&invoiceNo=${encodeURIComponent(viewSale.invoiceNo)}`);
                setIsViewModalOpen(false);
              }}
              disabled={viewSale.status === 'cancelled'}
            >
              Create Return
            </button>
            {viewSale.status === 'cancelled' ? (
              <button
                type="button"
                className="secondary-action-button"
                onClick={() => onRepostSale(viewSale)}
              >
                Post Invoice
              </button>
            ) : null}
            <button
              type="button"
              className="secondary-action-button"
              onClick={() => printSale(viewSale, deriveBalanceSummary(viewSale, viewLedgerBalance))}
            >
              &#128424; Print
            </button>
            <button
              type="button"
              className="secondary-action-button"
              onClick={() => printDeliveryChallan(viewSale)}
            >
              &#128424; Delivery Challan
            </button>
            <button
              type="button"
              className="secondary-action-button"
              onClick={() => printGatePass(viewSale)}
            >
              &#128424; Gate Pass
            </button>
            <button type="button" className="primary-action-button" onClick={() => setIsViewModalOpen(false)}>
              Close
            </button>
          </div>
        </ModalDialog>
      ) : null}

      {isConfirmSubmitOpen ? (
        <ModalDialog
          title="Confirm Invoice Submission"
          subtitle="Please confirm before creating this sales invoice"
          onClose={() => setIsConfirmSubmitOpen(false)}
        >
          <p style={{ margin: 0 }}>Are you sure you want to create this invoice?</p>
          {customerLedgerBalance !== null ? (
            <div style={{ marginTop: '0.8rem', padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '0.83rem' }}>
              <div><span style={{ color: '#64748b' }}>Previous Balance: </span><strong>{fmtBal(customerLedgerBalance)}</strong></div>
              <div><span style={{ color: '#64748b' }}>Net Balance: </span><strong>{fmtBal(Number(customerLedgerBalance) + Number(totals.dueAmount || 0))}</strong></div>
            </div>
          ) : null}
          <div className="inline-actions inline-actions--end" style={{ marginTop: '1rem' }}>
            <button
              type="button"
              className="secondary-action-button"
              onClick={() => setIsConfirmSubmitOpen(false)}
              disabled={submitting}
            >
              No
            </button>
            <button
              type="button"
              className="primary-action-button"
              onClick={confirmSubmitSale}
              disabled={submitting}
            >
              {submitting ? 'Creating…' : 'Yes, Create Invoice'}
            </button>
          </div>
        </ModalDialog>
      ) : null}

      {isSuccessModalOpen && createdSale ? (
        <ModalDialog
          title="Invoice Created"
          subtitle={`Invoice ${createdSale.invoiceNo} created successfully`}
          onClose={() => setIsSuccessModalOpen(false)}
        >
          <p style={{ margin: 0 }}>Sales invoice has been posted successfully.</p>
          <div className="inline-actions inline-actions--end" style={{ marginTop: '1rem' }}>
            <button
              type="button"
              className="secondary-action-button"
              onClick={() => printSale(createdSale, createdSale._balanceSummary || {})}
            >
              &#128424; Print Invoice
            </button>
            <button
              type="button"
              className="secondary-action-button"
              onClick={() => printDeliveryChallan(createdSale)}
            >
              &#128424; Delivery Challan
            </button>
            <button
              type="button"
              className="secondary-action-button"
              onClick={() => printGatePass(createdSale)}
            >
              &#128424; Gate Pass
            </button>
            <button
              type="button"
              className="primary-action-button"
              onClick={() => {
                setIsSuccessModalOpen(false);
                resetCreateForm();
              }}
            >
              Save & New
            </button>
            <button
              type="button"
              className="secondary-action-button"
              onClick={() => {
                setIsSuccessModalOpen(false);
                navigate('/sales');
              }}
            >
              Back to Sales
            </button>
          </div>
        </ModalDialog>
      ) : null}
    </div>
  );
}
