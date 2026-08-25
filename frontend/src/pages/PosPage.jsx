import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAccess } from '../hooks/useAccess';
import { contactService } from '../services/contactService';
import { productService } from '../services/productService';
import { inventoryService } from '../services/inventoryService';
import { salesService } from '../services/salesService';
import { paymentAccountService } from '../services/paymentAccountService';
import { settingsService } from '../services/settingsService';
import {
  WALK_IN_CUSTOMER_NAME,
  resolveWalkInCustomerId,
  POS_SUCCESS_AUTO_MS,
  POS_AUTO_PRINT_KEY,
  POS_PRINT_TOKENS_KEY,
  normalizeBusinessMode,
  BUSINESS_MODE_WHOLESALE,
  isRestaurantMode,
  TAX_MODE_OPTIONS,
  TAX_MODE_NONE,
  TAX_MODE_CASH,
  TAX_MODE_CARD,
  normalizeTaxMode,
  resolveTaxRate,
} from '../config/posDefaults';
import { openPosReceiptWindow, openKitchenTokensWindow } from '../utils/printHelper';
import { listHeldOrders, saveHeldOrder, removeHeldOrder, makeHoldId } from '../utils/posHoldStore';
import './PosPage.css';

const toNumber = (value) => Number(value || 0);
const money = (value) => toNumber(value).toFixed(2);

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

const pickBaseUnit = (units = []) => {
  if (!units.length) return null;
  const base = units.find((u) => toNumber(u.conversionFactor) === 1) || units[0];
  return {
    unitId: base.unitId || base.unit?.id || base.id,
    conversionFactor: toNumber(base.conversionFactor) || 1,
    unitName: base.unitName || base.unit?.name || base.name || 'Unit',
  };
};

export default function PosPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { has } = useAccess();
  const canCreate = has('sales:create');
  const canQuickAddCustomer = has('financial:contacts:create');
  const searchRef = useRef(null);
  const successTimerRef = useRef(null);
  const [autoPrint, setAutoPrint] = useState(() => {
    try {
      return window.localStorage.getItem(POS_AUTO_PRINT_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [printTokens, setPrintTokens] = useState(() => {
    try {
      const raw = window.localStorage.getItem(POS_PRINT_TOKENS_KEY);
      return raw == null ? true : raw === '1';
    } catch {
      return true;
    }
  });

  const [clock, setClock] = useState(() => new Date());
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState(user?.role === 'main_admin' ? '' : String(user?.branchId || ''));
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState('all');
  const [products, setProducts] = useState([]);
  const [stockByProduct, setStockByProduct] = useState({});
  const [customers, setCustomers] = useState([]);
  const [contactId, setContactId] = useState('');
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState('0');
  const [search, setSearch] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [payMethod, setPayMethod] = useState('cash');
  const [taxMode, setTaxMode] = useState(TAX_MODE_NONE);
  const [paymentAccountId, setPaymentAccountId] = useState(null);
  const [company, setCompany] = useState({});
  const [paidAmount, setPaidAmount] = useState('0');
  const [paidManual, setPaidManual] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickSaving, setQuickSaving] = useState(false);
  const [heldOrders, setHeldOrders] = useState([]);
  const [showHoldPrompt, setShowHoldPrompt] = useState(false);
  const [holdLabel, setHoldLabel] = useState('');
  const [showHeldList, setShowHeldList] = useState(false);
  const [activeHoldId, setActiveHoldId] = useState(null);
  const [activeHoldLabel, setActiveHoldLabel] = useState('');

  const branchName = useMemo(() => {
    const match = branches.find((b) => String(b.id) === String(branchId));
    return match?.name || user?.branchName || 'Branch';
  }, [branches, branchId, user?.branchName]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => String(c.id) === String(contactId)),
    [customers, contactId]
  );

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const catOk = categoryId === 'all' || String(p.categoryId) === String(categoryId);
      if (!catOk) return false;
      if (!q) return true;
      return (
        p.name?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q)
      );
    });
  }, [products, categoryId, search]);

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) => c.name?.toLowerCase().includes(q) || c.phone?.toLowerCase().includes(q)
    );
  }, [customers, customerQuery]);

  const subTotal = useMemo(
    () => cart.reduce((sum, line) => sum + toNumber(line.quantity) * toNumber(line.unitPrice), 0),
    [cart]
  );
  const discountAmt = Math.min(toNumber(discount), subTotal);
  const taxRate = resolveTaxRate(company, taxMode);
  const taxableBase = Math.max(0, subTotal - discountAmt);
  const taxAmount = Math.round(taxableBase * taxRate) / 100;
  const totalAmount = Math.max(0, taxableBase + taxAmount);
  const businessMode = normalizeBusinessMode(company?.businessMode);
  const isWholesale = businessMode === BUSINESS_MODE_WHOLESALE;
  const isRestaurant = isRestaurantMode(businessMode);
  const paidValue = Math.min(Math.max(0, toNumber(paidAmount)), totalAmount);
  const dueAmount = Math.max(0, totalAmount - paidValue);
  const isWalkIn = selectedCustomer?.name === WALK_IN_CUSTOMER_NAME;

  useEffect(() => {
    if (!isWholesale || !paidManual) {
      setPaidAmount(money(totalAmount));
    }
  }, [totalAmount, isWholesale, paidManual]);

  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!branchId) {
      setHeldOrders([]);
      return;
    }
    setHeldOrders(listHeldOrders(branchId));
  }, [branchId]);

  useEffect(() => {
    settingsService.getCompanySettings().then((data) => {
      setCompany(data || {});
    }).catch(() => {});
  }, []);

  const loadCatalog = useCallback(async (activeBranchId) => {
    if (!activeBranchId) {
      setProducts([]);
      setStockByProduct({});
      return;
    }

    setLoading(true);
    setError('');
    try {
      const [productRows, categoryRows, stockRows] = await Promise.all([
        productService.getProducts({ isActive: 'active' }),
        productService.getCategories().catch(() => []),
        inventoryService.getBranchStock(Number(activeBranchId), { mode: 'all' }).catch(() => []),
      ]);

      setProducts(productRows);
      setCategories(categoryRows);

      const map = {};
      (stockRows || []).forEach((row) => {
        map[row.productId] = toNumber(row.baseQty);
      });
      setStockByProduct(map);
    } catch (err) {
      setError(err.message || 'Failed to load catalog');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBranchContext = useCallback(async (activeBranchId) => {
    if (!activeBranchId) {
      setCustomers([]);
      setContactId('');
      setAccounts([]);
      return;
    }

    try {
      const [customerRows, accountRows] = await Promise.all([
        contactService.getCustomers(activeBranchId),
        paymentAccountService.getAccountsForBranch(Number(activeBranchId)).catch(() => []),
      ]);

      setCustomers(customerRows);
      const walkInId = resolveWalkInCustomerId(customerRows);
      setContactId(walkInId || (customerRows[0] ? String(customerRows[0].id) : ''));

      const list = Array.isArray(accountRows) ? accountRows : [];
      setAccounts(list);
      const cash = list.find((a) => a.accountType === 'cash') || list[0];
      setPayMethod('cash');
      setPaymentAccountId(cash?.id || null);
    } catch (err) {
      setError(err.message || 'Failed to load branch context');
    }
  }, []);

  useEffect(() => {
    productService
      .getMeta()
      .then((meta) => {
        const list = meta.branches || [];
        setBranches(list);
        if (user?.role === 'main_admin' && !branchId && list[0]) {
          setBranchId(String(list[0].id));
        }
      })
      .catch(() => {});
  }, [user?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!branchId) return;
    loadCatalog(branchId);
    loadBranchContext(branchId);
  }, [branchId, loadCatalog, loadBranchContext]);

  useEffect(() => {
    window.setTimeout(() => searchRef.current?.focus?.(), 100);
  }, [branchId, success]);

  const focusSearch = () => {
    window.setTimeout(() => searchRef.current?.focus?.(), 0);
  };

  const clearSuccessTimer = () => {
    if (successTimerRef.current) {
      window.clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
  };

  const startNextSaleTimer = () => {
    clearSuccessTimer();
    successTimerRef.current = window.setTimeout(() => {
      setSuccess(null);
      focusSearch();
    }, POS_SUCCESS_AUTO_MS);
  };

  const dismissSuccess = () => {
    clearSuccessTimer();
    setSuccess(null);
    focusSearch();
  };

  useEffect(() => () => clearSuccessTimer(), []);

  const toggleAutoPrint = () => {
    setAutoPrint((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(POS_AUTO_PRINT_KEY, next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  };

  const togglePrintTokens = () => {
    setPrintTokens((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(POS_PRINT_TOKENS_KEY, next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  };

  const printKitchenTokens = (items, { stage = 'hold', orderLabel, invoiceNo } = {}) => {
    if (!isRestaurant || !printTokens) return;
    const list = (items || []).filter((item) => toNumber(item.quantity) > 0);
    if (!list.length) return;
    openKitchenTokensWindow({
      company,
      branchName,
      orderLabel: orderLabel || activeHoldLabel || holdLabel || selectedCustomer?.name || 'Counter',
      invoiceNo,
      cashierName: user?.fullName || user?.username || '–',
      stage,
      items: list,
    });
  };

  const availableFor = (productId) => toNumber(stockByProduct[productId]);

  const cartQtyFor = (productId) =>
    cart
      .filter((line) => String(line.productId) === String(productId))
      .reduce((sum, line) => sum + toNumber(line.quantity), 0);

  const addProduct = async (product) => {
    setError('');
    const available = availableFor(product.id);
    const inCart = cartQtyFor(product.id);
    if (available <= inCart + 0.00001) {
      setError(`No stock available for ${product.name}`);
      focusSearch();
      return;
    }

    const existingIndex = cart.findIndex((line) => String(line.productId) === String(product.id));
    if (existingIndex >= 0) {
      setCart((prev) =>
        prev.map((line, idx) =>
          idx === existingIndex
            ? { ...line, quantity: String(toNumber(line.quantity) + 1) }
            : line
        )
      );
      focusSearch();
      return;
    }

    let unitMeta = { unitId: null, conversionFactor: 1, unitName: 'Unit' };
    try {
      const units = await productService.getProductUnits(product.id);
      unitMeta = pickBaseUnit(units) || unitMeta;
    } catch {
      // use defaults
    }

    setCart((prev) => [
      ...prev,
      {
        key: `${product.id}-${Date.now()}`,
        productId: String(product.id),
        productName: product.name,
        sku: product.sku || '',
        unitId: unitMeta.unitId,
        unitName: unitMeta.unitName,
        conversionFactor: unitMeta.conversionFactor,
        quantity: '1',
        unitPrice: String(toNumber(product.salePrice || product.purchasePrice || 0)),
        costPrice: toNumber(product.purchasePrice || 0),
      },
    ]);
    focusSearch();
  };

  const updateQty = (key, nextQty) => {
    const qty = Math.max(0, toNumber(nextQty));
    setCart((prev) => {
      if (qty <= 0) return prev.filter((line) => line.key !== key);
      return prev.map((line) => {
        if (line.key !== key) return line;
        const available = availableFor(line.productId);
        const others = prev
          .filter((row) => row.key !== key && String(row.productId) === String(line.productId))
          .reduce((sum, row) => sum + toNumber(row.quantity), 0);
        const capped = Math.min(qty, Math.max(0, available - others));
        if (capped < qty) setError(`Only ${money(available)} available for ${line.productName}`);
        return { ...line, quantity: String(capped || 1) };
      });
    });
  };

  const updateLinePrice = (key, nextPrice) => {
    setCart((prev) =>
      prev.map((line) => (line.key === key ? { ...line, unitPrice: String(Math.max(0, toNumber(nextPrice))) } : line))
    );
  };

  const removeLine = (key) => setCart((prev) => prev.filter((line) => line.key !== key));

  const clearCart = () => {
    setCart([]);
    setDiscount('0');
    setPaidAmount('0');
    setPaidManual(false);
    setError('');
    setSuccess(null);
    setActiveHoldId(null);
    setActiveHoldLabel('');
  };

  const buildHoldSnapshot = (label) => ({
    id: activeHoldId || makeHoldId(),
    label: String(label || '').trim() || `Ticket ${heldOrders.length + 1}`,
    contactId,
    contactName: selectedCustomer?.name || WALK_IN_CUSTOMER_NAME,
    cart,
    discount,
    paidAmount,
    paidManual,
    payMethod,
    taxMode,
    paymentAccountId,
    heldAt: new Date().toISOString(),
    totalAmount,
    itemCount: cart.reduce((sum, line) => sum + toNumber(line.quantity), 0),
  });

  const confirmHold = () => {
    if (!branchId) {
      setError('Select a branch first');
      return;
    }
    if (!cart.length) {
      setError('Cart is empty — nothing to hold');
      setShowHoldPrompt(false);
      return;
    }

    if (isRestaurant && printTokens) {
      printKitchenTokens(cart, {
        stage: 'hold',
        orderLabel: holdLabel || activeHoldLabel || 'Hold',
      });
    }

    const order = buildHoldSnapshot(holdLabel);
    const next = saveHeldOrder(branchId, order);
    setHeldOrders(next);
    clearCart();
    setShowHoldPrompt(false);
    setHoldLabel('');
    setSuccess(null);
    focusSearch();
  };

  const openHoldFlow = () => {
    if (!cart.length) {
      setShowHeldList(true);
      return;
    }
    setHoldLabel(activeHoldLabel || '');
    setShowHoldPrompt(true);
  };

  const resumeHeldOrder = (order) => {
    if (cart.length) {
      const keepGoing = window.confirm(
        'Current cart has items. Holding it first, then resume the selected order?'
      );
      if (!keepGoing) return;
      const parked = buildHoldSnapshot(activeHoldLabel || `Auto ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`);
      saveHeldOrder(branchId, parked);
    }

    setCart(Array.isArray(order.cart) ? order.cart : []);
    setDiscount(order.discount != null ? String(order.discount) : '0');
    setContactId(order.contactId ? String(order.contactId) : contactId);
    if (order.payMethod) setPayMethod(order.payMethod);
    if (order.taxMode) setTaxMode(normalizeTaxMode(order.taxMode));
    if (order.paymentAccountId) setPaymentAccountId(order.paymentAccountId);
    if (order.paidAmount != null) {
      setPaidAmount(String(order.paidAmount));
      setPaidManual(Boolean(order.paidManual));
    } else {
      setPaidManual(false);
    }
    setActiveHoldId(order.id);
    setActiveHoldLabel(order.label || '');
    setHeldOrders(removeHeldOrder(branchId, order.id));
    setShowHeldList(false);
    setError('');
    focusSearch();
  };

  const discardHeldOrder = (orderId) => {
    setHeldOrders(removeHeldOrder(branchId, orderId));
  };

  const submitQuickCustomer = async (event) => {
    event?.preventDefault?.();
    if (!canQuickAddCustomer) {
      setError('You do not have permission to create customers');
      return;
    }
    const name = quickName.trim();
    if (!name) {
      setError('Customer name is required');
      return;
    }
    if (!branchId) {
      setError('Select a branch first');
      return;
    }

    setQuickSaving(true);
    setError('');
    try {
      const created = await contactService.createContact({
        branchId: Number(branchId),
        name,
        phone: quickPhone.trim() || null,
        recordType: 'customer',
        openingBalance: 0,
      });
      const rows = await contactService.getCustomers(branchId);
      setCustomers(rows);
      setContactId(String(created.id));
      setShowQuickAdd(false);
      setShowCustomerPicker(false);
      setCustomerQuery('');
      setQuickName('');
      setQuickPhone('');
      focusSearch();
    } catch (err) {
      setError(err.message || 'Failed to create customer');
    } finally {
      setQuickSaving(false);
    }
  };

  const selectPayMethod = (method) => {
    setPayMethod(method);
    if (method === 'cash') {
      const cash = accounts.find((a) => a.accountType === 'cash') || accounts[0];
      setPaymentAccountId(cash?.id || null);
    } else if (method === 'card' || method === 'bank') {
      const bank = accounts.find((a) => a.accountType === 'bank') || accounts[0];
      setPaymentAccountId(bank?.id || null);
    }
  };

  const onSearchKeyDown = async (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const q = search.trim();
    if (!q) return;

    const needle = q.toLowerCase();
    const exactBarcode = products.find((p) => String(p.barcode || '').toLowerCase() === needle);
    if (exactBarcode) {
      await addProduct(exactBarcode);
      setSearch('');
      focusSearch();
      return;
    }

    const exactSku = products.find((p) => String(p.sku || '').toLowerCase() === needle);
    if (exactSku) {
      await addProduct(exactSku);
      setSearch('');
      focusSearch();
      return;
    }

    if (filteredProducts[0]) {
      await addProduct(filteredProducts[0]);
      setSearch('');
      focusSearch();
      return;
    }

    setError(`No product found for “${q}”`);
    setSearch('');
    focusSearch();
  };

  const completeSale = async () => {
    if (!canCreate) {
      setError('You do not have permission to create sales');
      return;
    }
    if (!branchId) {
      setError('Select a branch first');
      return;
    }
    if (!contactId) {
      setError('Select a customer');
      return;
    }
    if (!cart.length) {
      setError('Cart is empty');
      return;
    }
    if (totalAmount <= 0) {
      setError('Total must be greater than zero');
      return;
    }
    if (isWholesale && dueAmount > 0.00001 && isWalkIn) {
      setError('Wholesale due sales need a named customer — change Walk-in first');
      return;
    }
    if (paidValue < 0 || paidValue - totalAmount > 0.00001) {
      setError('Received amount cannot exceed total');
      return;
    }

    for (const line of cart) {
      const available = availableFor(line.productId);
      if (toNumber(line.quantity) > available + 0.00001) {
        setError(`Insufficient stock for ${line.productName}`);
        return;
      }
      if (toNumber(line.unitPrice) + 0.00001 < toNumber(line.costPrice)) {
        setError(`Rate for ${line.productName} is below cost`);
        return;
      }
    }

    setSubmitting(true);
    setError('');
    try {
      const payments =
        paidValue > 0 && paymentAccountId
          ? [
              {
                paymentAccountId,
                amount: paidValue,
              },
            ]
          : [];

      const sale = await salesService.createSale({
        branchId: Number(branchId),
        contactId: Number(contactId),
        invoiceNo: makeInvoiceNo(),
        saleDate: new Date().toISOString().slice(0, 10),
        discount: discountAmt,
        taxMode: normalizeTaxMode(taxMode),
        paidAmount: paidValue,
        payments,
        items: cart.map((line) => ({
          productId: Number(line.productId),
          sourceBranchId: Number(branchId),
          unitId: line.unitId ? Number(line.unitId) : null,
          quantity: toNumber(line.quantity),
          unitQty: toNumber(line.quantity),
          conversionFactor: toNumber(line.conversionFactor) || 1,
          unitPrice: toNumber(line.unitPrice),
          notes: null,
        })),
      });

      const finalTokenItems = cart.map((line) => ({
        productName: line.productName,
        quantity: toNumber(line.quantity),
        unitName: line.unitName,
      }));
      const orderLabelForTokens = activeHoldLabel || selectedCustomer?.name || 'Counter';

      setSuccess(sale);
      setCart([]);
      setDiscount('0');
      setPaidAmount('0');
      setPaidManual(false);
      setActiveHoldId(null);
      setActiveHoldLabel('');
      await loadCatalog(branchId);

      if (isRestaurant && printTokens) {
        printKitchenTokens(finalTokenItems, {
          stage: 'final',
          orderLabel: orderLabelForTokens,
          invoiceNo: sale.invoiceNo,
        });
      }

      if (autoPrint) {
        printReceipt(sale, { pauseAutoNext: false });
      }

      startNextSaleTimer();
    } catch (err) {
      setError(err.message || 'Failed to complete sale');
    } finally {
      setSubmitting(false);
      focusSearch();
    }
  };

  const printReceipt = (sale, { pauseAutoNext = true } = {}) => {
    if (!sale) return;
    if (pauseAutoNext) clearSuccessTimer();
    openPosReceiptWindow({
      company,
      invoiceNo: sale.invoiceNo,
      saleDate: sale.saleDate,
      branchName,
      customerName: sale.contact?.name || selectedCustomer?.name || WALK_IN_CUSTOMER_NAME,
      cashierName: user?.fullName || user?.username || '–',
      items: sale.items || [],
      subTotal: sale.subTotal,
      discount: sale.discount,
      taxMode: sale.taxMode,
      taxRate: sale.taxRate,
      taxAmount: sale.taxAmount,
      totalAmount: sale.totalAmount,
      paidAmount: sale.paidAmount,
    });
  };

  const printAndNext = (sale) => {
    printReceipt(sale);
    dismissSuccess();
  };

  if (!canCreate) {
    return (
      <div className="pos-shell">
        <div className="pos-blocked">
          <h1>POS unavailable</h1>
          <p>You need sales create permission to use the counter screen.</p>
          <Link to="/">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`pos-shell ${isWholesale ? 'pos-shell--wholesale' : 'pos-shell--retail'}`}>
      <header className="pos-topbar">
        <div className="pos-topbar__brand">
          <strong>POS Counter</strong>
          <span>{user?.fullName || user?.username}</span>
        </div>

        <div className="pos-topbar__meta">
          {user?.role === 'main_admin' ? (
            <select
              className="pos-select"
              value={branchId}
              onChange={(e) => {
                clearCart();
                setBranchId(e.target.value);
              }}
            >
              <option value="">Select branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="pos-chip">{branchName}</span>
          )}
          <span
            className={`pos-chip ${
              isWholesale
                ? 'pos-chip--mode-wholesale'
                : isRestaurant
                  ? 'pos-chip--mode-restaurant'
                  : 'pos-chip--mode-retail'
            }`}
          >
            {isWholesale ? 'Wholesale' : isRestaurant ? 'Restaurant' : 'Retail'}
          </span>
          <span className="pos-chip pos-chip--time">
            {clock.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>

        <div className="pos-topbar__actions">
          <button
            type="button"
            className="pos-btn pos-btn--ghost"
            onClick={openHoldFlow}
            title={cart.length ? 'Hold current cart' : 'View held orders'}
          >
            Hold
          </button>
          <button
            type="button"
            className="pos-btn pos-btn--ghost pos-btn--badge"
            onClick={() => setShowHeldList(true)}
          >
            Orders
            {heldOrders.length ? <span className="pos-badge">{heldOrders.length}</span> : null}
          </button>
          <label className="pos-chip pos-chip--toggle" title="Print receipt automatically after each sale">
            <input type="checkbox" checked={autoPrint} onChange={toggleAutoPrint} />
            Auto print
          </label>
          {isRestaurant ? (
            <label
              className="pos-chip pos-chip--toggle"
              title="Print kitchen tokens only when you Hold or Complete the bill"
            >
              <input type="checkbox" checked={printTokens} onChange={togglePrintTokens} />
              Print tokens
            </label>
          ) : null}
          <button type="button" className="pos-btn pos-btn--ghost" onClick={clearCart} disabled={!cart.length}>
            Clear
          </button>
          <button type="button" className="pos-btn pos-btn--ghost" onClick={() => navigate('/sales')}>
            Invoices
          </button>
          <button type="button" className="pos-btn pos-btn--ghost" onClick={() => navigate('/')}>
            Exit
          </button>
        </div>
      </header>

      {error ? <div className="pos-banner pos-banner--error">{error}</div> : null}
      {success ? (
        <div className="pos-banner pos-banner--success">
          <span>
            Sale complete — <strong>{success.invoiceNo}</strong> · {money(success.totalAmount)}
            <em className="pos-banner__hint"> Next sale ready…</em>
          </span>
          <div className="pos-banner__actions">
            <button type="button" className="pos-btn pos-btn--ghost" onClick={() => printReceipt(success)}>
              Print
            </button>
            <button type="button" className="pos-btn pos-btn--primary" onClick={() => printAndNext(success)}>
              Print &amp; Next
            </button>
            <button type="button" className="pos-btn pos-btn--ghost" onClick={dismissSuccess}>
              Next
            </button>
          </div>
        </div>
      ) : null}

      <div className="pos-layout">
        <section className="pos-catalog">
          <div className="pos-search-row">
            <input
              ref={searchRef}
              className="pos-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Scan barcode or search product… (Enter)"
              autoComplete="off"
              autoFocus
              disabled={!branchId}
            />
          </div>

          <div className="pos-categories">
            <button
              type="button"
              className={`pos-cat ${categoryId === 'all' ? 'is-active' : ''}`}
              onClick={() => setCategoryId('all')}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`pos-cat ${String(categoryId) === String(cat.id) ? 'is-active' : ''}`}
                onClick={() => setCategoryId(String(cat.id))}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="pos-empty">Loading catalog…</p>
          ) : !branchId ? (
            <p className="pos-empty">Select a branch to start selling.</p>
          ) : isWholesale ? (
            <div className="pos-list">
              {filteredProducts.map((product) => {
                const stock = availableFor(product.id);
                const disabled = stock <= 0;
                return (
                  <button
                    key={product.id}
                    type="button"
                    className={`pos-row ${disabled ? 'is-disabled' : ''}`}
                    onClick={() => addProduct(product)}
                    disabled={disabled || submitting}
                  >
                    <div className="pos-row__main">
                      <strong>{product.name}</strong>
                      <span>
                        {product.sku || '—'}
                        {product.barcode ? ` · ${product.barcode}` : ''}
                      </span>
                    </div>
                    <div className="pos-row__meta">
                      <strong>{money(product.salePrice)}</strong>
                      <span className={stock > 0 ? 'is-ok' : 'is-out'}>
                        {stock > 0 ? `Stock ${money(stock)}` : 'Out'}
                      </span>
                    </div>
                  </button>
                );
              })}
              {filteredProducts.length === 0 ? (
                <p className="pos-empty">No products match this search.</p>
              ) : null}
            </div>
          ) : (
            <div className="pos-grid">
              {filteredProducts.map((product) => {
                const stock = availableFor(product.id);
                const disabled = stock <= 0;
                return (
                  <button
                    key={product.id}
                    type="button"
                    className={`pos-tile ${disabled ? 'is-disabled' : ''}`}
                    onClick={() => addProduct(product)}
                    disabled={disabled || submitting}
                  >
                    <strong>{product.name}</strong>
                    <span className="pos-tile__sku">{product.sku || '—'}</span>
                    <span className="pos-tile__price">{money(product.salePrice)}</span>
                    <span className={`pos-tile__stock ${stock > 0 ? 'is-ok' : 'is-out'}`}>
                      {stock > 0 ? `Stock ${money(stock)}` : 'Out of stock'}
                    </span>
                  </button>
                );
              })}
              {filteredProducts.length === 0 ? (
                <p className="pos-empty">No products match this search.</p>
              ) : null}
            </div>
          )}
        </section>

        <aside className="pos-cart">
          <div className="pos-cart__customer">
            {activeHoldLabel ? (
              <div className="pos-hold-tag">
                Held ticket: <strong>{activeHoldLabel}</strong>
              </div>
            ) : null}
            <button
              type="button"
              className={`pos-customer-chip ${isWholesale && isWalkIn ? 'is-warn' : ''}`}
              onClick={() => {
                setShowQuickAdd(false);
                setShowCustomerPicker(true);
              }}
            >
              <span>{isWholesale ? 'Customer (named preferred)' : 'Customer'}</span>
              <strong>{selectedCustomer?.name || 'Select customer'}</strong>
            </button>
          </div>

          <div className="pos-cart__lines">
            {cart.length === 0 ? (
              <p className="pos-empty">{isWholesale ? 'Add products for this trade invoice.' : 'Tap products to build the cart.'}</p>
            ) : (
              cart.map((line) => (
                <div key={line.key} className={`pos-line ${isWholesale ? 'pos-line--wholesale' : ''}`}>
                  <div className="pos-line__info">
                    <strong>{line.productName}</strong>
                    {isWholesale ? (
                      <label className="pos-line__rate">
                        <span>Rate</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.unitPrice}
                          onChange={(e) => updateLinePrice(line.key, e.target.value)}
                        />
                      </label>
                    ) : (
                      <span>{money(line.unitPrice)} · {line.unitName}</span>
                    )}
                  </div>
                  <div className="pos-line__qty">
                    <button type="button" onClick={() => updateQty(line.key, toNumber(line.quantity) - 1)}>-</button>
                    <input
                      type="number"
                      min="0.0001"
                      step={isWholesale ? '1' : '1'}
                      value={line.quantity}
                      onChange={(e) => updateQty(line.key, e.target.value)}
                    />
                    <button type="button" onClick={() => updateQty(line.key, toNumber(line.quantity) + 1)}>+</button>
                    {isWholesale ? (
                      <button
                        type="button"
                        className="pos-line__bulk"
                        onClick={() => updateQty(line.key, toNumber(line.quantity) + 10)}
                        title="Add 10"
                      >
                        +10
                      </button>
                    ) : null}
                  </div>
                  <div className="pos-line__amount">
                    <strong>{money(toNumber(line.quantity) * toNumber(line.unitPrice))}</strong>
                    <button type="button" className="pos-line__remove" onClick={() => removeLine(line.key)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="pos-cart__footer">
            <label className="pos-discount">
              <span>Discount</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
            </label>

            <div className="pos-totals">
              <div><span>Subtotal</span><strong>{money(subTotal)}</strong></div>
              <div><span>Discount</span><strong>{money(discountAmt)}</strong></div>
              {taxMode !== TAX_MODE_NONE ? (
                <div>
                  <span>Tax ({taxRate}%)</span>
                  <strong>{money(taxAmount)}</strong>
                </div>
              ) : null}
              <div className="pos-totals__grand"><span>Total</span><strong>{money(totalAmount)}</strong></div>
              {isWholesale ? (
                <>
                  <label className="pos-received">
                    <span>Received</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={paidAmount}
                      onChange={(e) => {
                        setPaidManual(true);
                        setPaidAmount(e.target.value);
                      }}
                    />
                  </label>
                  <div>
                    <span>Due</span>
                    <strong className={dueAmount > 0 ? 'pos-due' : ''}>{money(dueAmount)}</strong>
                  </div>
                  <button
                    type="button"
                    className="pos-btn pos-btn--ghost pos-btn--full"
                    onClick={() => {
                      setPaidManual(false);
                      setPaidAmount(money(totalAmount));
                    }}
                  >
                    Pay full
                  </button>
                </>
              ) : null}
            </div>

            <div className="pos-pay-methods pos-tax-modes" role="group" aria-label="Tax">
              {TAX_MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`pos-pay ${taxMode === opt.value ? 'is-active' : ''}`}
                  onClick={() => {
                    setTaxMode(opt.value);
                    if (opt.value === TAX_MODE_CASH) selectPayMethod('cash');
                    if (opt.value === TAX_MODE_CARD) selectPayMethod('card');
                  }}
                >
                  {opt.label}
                  {opt.value === TAX_MODE_CASH && Number(company?.cashTaxRate || 0) > 0
                    ? ` (${Number(company.cashTaxRate)}%)`
                    : ''}
                  {opt.value === TAX_MODE_CARD && Number(company?.cardTaxRate || 0) > 0
                    ? ` (${Number(company.cardTaxRate)}%)`
                    : ''}
                </button>
              ))}
            </div>

            <div className="pos-pay-methods">
              <button
                type="button"
                className={`pos-pay ${payMethod === 'cash' ? 'is-active' : ''}`}
                onClick={() => selectPayMethod('cash')}
              >
                Cash
              </button>
              <button
                type="button"
                className={`pos-pay ${payMethod === 'card' ? 'is-active' : ''}`}
                onClick={() => selectPayMethod('card')}
              >
                Card / Bank
              </button>
            </div>

            <button
              type="button"
              className="pos-complete"
              onClick={completeSale}
              disabled={submitting || !cart.length || !branchId}
            >
              {submitting
                ? 'Processing…'
                : isWholesale && dueAmount > 0
                  ? `Complete · Pay ${money(paidValue)} (Due ${money(dueAmount)})`
                  : `Complete Sale · ${money(totalAmount)}`}
            </button>
          </div>
        </aside>
      </div>

      {showCustomerPicker ? (
        <div className="pos-modal-backdrop" onClick={() => setShowCustomerPicker(false)}>
          <div className="pos-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pos-modal__head">
              <strong>{showQuickAdd ? 'New customer' : 'Select customer'}</strong>
              <button type="button" className="pos-btn pos-btn--ghost" onClick={() => setShowCustomerPicker(false)}>
                Close
              </button>
            </div>

            {showQuickAdd ? (
              <form className="pos-quick-form" onSubmit={submitQuickCustomer}>
                <label className="pos-field">
                  <span>Name *</span>
                  <input
                    className="pos-search"
                    value={quickName}
                    onChange={(e) => setQuickName(e.target.value)}
                    placeholder="Customer name"
                    autoFocus
                    required
                  />
                </label>
                <label className="pos-field">
                  <span>Phone</span>
                  <input
                    className="pos-search"
                    value={quickPhone}
                    onChange={(e) => setQuickPhone(e.target.value)}
                    placeholder="Optional phone"
                  />
                </label>
                <div className="pos-modal__actions">
                  <button type="button" className="pos-btn pos-btn--ghost" onClick={() => setShowQuickAdd(false)}>
                    Back
                  </button>
                  <button type="submit" className="pos-btn pos-btn--primary" disabled={quickSaving}>
                    {quickSaving ? 'Saving…' : 'Save customer'}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="pos-modal__toolbar">
                  <button
                    type="button"
                    className="pos-customer-option pos-customer-option--pin"
                    onClick={() => {
                      const walkInId = resolveWalkInCustomerId(customers);
                      if (walkInId) setContactId(walkInId);
                      setShowCustomerPicker(false);
                      setCustomerQuery('');
                      focusSearch();
                    }}
                  >
                    <strong>{WALK_IN_CUSTOMER_NAME}</strong>
                    <span>Default counter customer</span>
                  </button>
                  {canQuickAddCustomer ? (
                    <button
                      type="button"
                      className="pos-btn pos-btn--primary"
                      onClick={() => {
                        setShowQuickAdd(true);
                        setQuickName('');
                        setQuickPhone('');
                      }}
                    >
                      + New customer
                    </button>
                  ) : null}
                </div>
                <input
                  className="pos-search"
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.target.value)}
                  placeholder="Search name or phone…"
                  autoFocus
                />
                <div className="pos-customer-list">
                  {filteredCustomers.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      className={`pos-customer-option ${String(contactId) === String(customer.id) ? 'is-active' : ''}`}
                      onClick={() => {
                        setContactId(String(customer.id));
                        setShowCustomerPicker(false);
                        setCustomerQuery('');
                        focusSearch();
                      }}
                    >
                      <strong>{customer.name}</strong>
                      <span>
                        {customer.phone ||
                          (customer.name === WALK_IN_CUSTOMER_NAME ? 'Default counter customer' : '—')}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {showHoldPrompt ? (
        <div className="pos-modal-backdrop" onClick={() => setShowHoldPrompt(false)}>
          <div className="pos-modal pos-modal--sm" onClick={(e) => e.stopPropagation()}>
            <div className="pos-modal__head">
              <strong>Hold order</strong>
              <button type="button" className="pos-btn pos-btn--ghost" onClick={() => setShowHoldPrompt(false)}>
                Close
              </button>
            </div>
            <p className="pos-modal__hint">Park this cart and start a new sale. Resume anytime from Orders.</p>
            <label className="pos-field">
              <span>Table / ticket #</span>
              <input
                className="pos-search"
                value={holdLabel}
                onChange={(e) => setHoldLabel(e.target.value)}
                placeholder="e.g. T-4 or Ali"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    confirmHold();
                  }
                }}
              />
            </label>
            {isRestaurant ? (
              <label className="pos-chip pos-chip--toggle" style={{ alignSelf: 'flex-start' }}>
                <input type="checkbox" checked={printTokens} onChange={togglePrintTokens} />
                Print kitchen tokens on hold
              </label>
            ) : null}
            <div className="pos-modal__actions">
              <button type="button" className="pos-btn pos-btn--ghost" onClick={() => setShowHoldPrompt(false)}>
                Cancel
              </button>
              <button type="button" className="pos-btn pos-btn--primary" onClick={confirmHold}>
                Hold · {money(totalAmount)}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showHeldList ? (
        <div className="pos-modal-backdrop" onClick={() => setShowHeldList(false)}>
          <div className="pos-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pos-modal__head">
              <strong>Held orders</strong>
              <button type="button" className="pos-btn pos-btn--ghost" onClick={() => setShowHeldList(false)}>
                Close
              </button>
            </div>
            {heldOrders.length === 0 ? (
              <p className="pos-empty">No held orders for this branch.</p>
            ) : (
              <div className="pos-held-list">
                {heldOrders.map((order) => (
                  <div key={order.id} className="pos-held-card">
                    <div className="pos-held-card__info">
                      <strong>{order.label || 'Held order'}</strong>
                      <span>
                        {order.contactName || 'Customer'} · {order.itemCount || order.cart?.length || 0} items ·{' '}
                        {money(order.totalAmount)}
                      </span>
                      <span className="pos-held-card__time">
                        {order.heldAt
                          ? new Date(order.heldAt).toLocaleTimeString('en-GB', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''}
                      </span>
                    </div>
                    <div className="pos-held-card__actions">
                      <button type="button" className="pos-btn pos-btn--primary" onClick={() => resumeHeldOrder(order)}>
                        Resume
                      </button>
                      <button
                        type="button"
                        className="pos-btn pos-btn--ghost"
                        onClick={() => discardHeldOrder(order.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
