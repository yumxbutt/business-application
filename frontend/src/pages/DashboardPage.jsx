import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../ui-kit';
import { useAuth } from '../context/AuthContext';
import { useAccess } from '../hooks/useAccess';
import { productService } from '../services/productService';
import { salesService } from '../services/salesService';
import { purchaseService } from '../services/purchaseService';
import { financialService } from '../services/financialService';
import { ledgerService } from '../services/ledgerService';
import { inventoryService } from '../services/inventoryService';
import './DashboardPage.css';

const today = new Date().toISOString().slice(0, 10);
const monthStart = `${today.slice(0, 8)}01`;

const toNumber = (value) => Number(value || 0);
const money = (value) => Math.round(toNumber(value)).toLocaleString('en-US');

const IconPos = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
    <path d="M7 9h4M7 12h10M7 15h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);
const IconLedger = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M6 4h11a2 2 0 0 1 2 2v14H8a2 2 0 0 1-2-2V4Z" stroke="currentColor" strokeWidth="1.7" />
    <path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);
const IconReceipt = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 4v16m-5-5 5 5 5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
  </svg>
);
const IconPayment = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 20V4m5 5-5-5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
  </svg>
);

const SHORTCUTS = [
  {
    id: 'pos',
    to: '/pos',
    label: 'POS',
    hint: 'Open counter & ring sales',
    rights: ['sales:create'],
    tone: 'pos',
    icon: IconPos,
  },
  {
    id: 'ledger',
    to: '/ledger',
    label: 'Ledgers',
    hint: 'Party balances & history',
    rights: ['financial:ledger:read'],
    tone: 'ledger',
    icon: IconLedger,
  },
  {
    id: 'receipt',
    to: '/cash-vouchers?type=receipt&new=1',
    label: 'Receipt',
    hint: 'Collect from customer',
    rights: ['financial:vouchers:create', 'financial:vouchers:read'],
    tone: 'receipt',
    icon: IconReceipt,
  },
  {
    id: 'payment',
    to: '/cash-vouchers?type=payment&new=1',
    label: 'Payment',
    hint: 'Pay supplier / expense',
    rights: ['financial:vouchers:create', 'financial:vouchers:read'],
    tone: 'payment',
    icon: IconPayment,
  },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const { hasAny } = useAccess();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [clock, setClock] = useState(() => new Date());
  const [ready, setReady] = useState(false);
  const [filters, setFilters] = useState({
    branchId: user?.role === 'main_admin' ? '' : String(user?.branchId || ''),
    startDate: monthStart,
    endDate: today,
  });
  const [metrics, setMetrics] = useState({
    currentClosing: 0,
    salesTotal: 0,
    purchaseTotal: 0,
    receiptTotal: 0,
    paymentTotal: 0,
    receivableOutstanding: 0,
    payableOutstanding: 0,
    outOfStockCount: 0,
  });

  const selectedBranchName = useMemo(() => {
    const match = branches.find((branch) => String(branch.id) === String(filters.branchId));
    return match?.name || (user?.branchId ? `Branch ${user.branchId}` : 'Select branch');
  }, [branches, filters.branchId, user?.branchId]);

  const visibleShortcuts = useMemo(
    () => SHORTCUTS.filter((item) => hasAny(item.rights)),
    [hasAny]
  );

  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date()), 1000);
    const enter = window.requestAnimationFrame(() => setReady(true));
    return () => {
      window.clearInterval(id);
      window.cancelAnimationFrame(enter);
    };
  }, []);

  useEffect(() => {
    productService
      .getMeta()
      .then((meta) => {
        const list = meta.branches || [];
        setBranches(list);
        if (user?.role === 'main_admin' && !filters.branchId && list[0]) {
          setFilters((prev) => ({ ...prev, branchId: String(list[0].id) }));
        }
      })
      .catch(() => {});
  }, [user?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadDashboard = async () => {
    if (!filters.branchId) {
      setError('Please select a branch to load dashboard stats.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const branchId = Number(filters.branchId);
      const sharedDateFilters = {
        branchId,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      };
      const [sales, purchases, vouchers, receivables, payables, trading, stock] = await Promise.all([
        salesService.getSales({ ...sharedDateFilters, status: 'posted' }),
        purchaseService.getPurchases({ ...sharedDateFilters, status: 'posted' }),
        financialService.getCashVouchers({ ...sharedDateFilters, transactionType: 'all' }),
        ledgerService.getReceivables({ branchId }),
        ledgerService.getPayables({ branchId }),
        ledgerService.getTradingLedgerRegister(sharedDateFilters),
        inventoryService.getBranchStock(branchId, { mode: 'all' }),
      ]);

      setMetrics({
        currentClosing: toNumber(trading?.closingBalance),
        salesTotal: sales.reduce((sum, row) => sum + toNumber(row.totalAmount), 0),
        purchaseTotal: purchases.reduce((sum, row) => sum + toNumber(row.totalAmount), 0),
        receiptTotal: vouchers
          .filter((row) => row.transactionType === 'receipt')
          .reduce((sum, row) => sum + toNumber(row.amount), 0),
        paymentTotal: vouchers
          .filter((row) => row.transactionType === 'payment')
          .reduce((sum, row) => sum + toNumber(row.amount), 0),
        receivableOutstanding: receivables.reduce((sum, row) => sum + toNumber(row.outstandingAmount), 0),
        payableOutstanding: payables.reduce((sum, row) => sum + toNumber(row.outstandingAmount), 0),
        outOfStockCount: (stock || []).filter((row) => toNumber(row.baseQty) <= 0).length,
      });
    } catch (err) {
      setError(err.message || 'Failed to load dashboard stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (filters.branchId) loadDashboard();
  }, [filters.branchId, filters.startDate, filters.endDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const greetingName = user?.fullName || user?.username || 'there';
  const clockLabel = clock.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const dateLabel = clock.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });

  const summaryItems = [
    { key: 'sales', label: 'Sales', value: metrics.salesTotal },
    { key: 'purchase', label: 'Purchases', value: metrics.purchaseTotal },
    { key: 'receipt', label: 'Receipts', value: metrics.receiptTotal },
    { key: 'payment', label: 'Payments', value: metrics.paymentTotal },
    { key: 'recv', label: 'Receivable', value: metrics.receivableOutstanding },
    { key: 'pay', label: 'Payable', value: metrics.payableOutstanding },
  ];

  return (
    <div className={`db-page ${ready ? 'is-ready' : ''}`}>
      <section className="db-hero">
        <div className="db-hero__glow" aria-hidden="true" />
        <div className="db-hero__copy">
          <p className="db-hero__eyebrow">{dateLabel} · {clockLabel}</p>
          <h1 className="db-hero__title">Hello, {greetingName}</h1>
          {user?.role === 'main_admin' ? (
            <label className="db-hero__branch">
              <span>Branch</span>
              <select
                value={filters.branchId}
                onChange={(e) => setFilters((prev) => ({ ...prev, branchId: e.target.value }))}
                aria-label="Select branch"
              >
                <option value="">— Select branch —</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="db-hero__subtitle">
              {selectedBranchName} · {filters.startDate} → {filters.endDate}
            </p>
          )}
          {user?.role === 'main_admin' ? (
            <p className="db-hero__subtitle db-hero__subtitle--dates">
              {filters.startDate} → {filters.endDate}
            </p>
          ) : null}
        </div>
        <div className="db-hero__balance">
          <span>Closing balance</span>
          <strong className={loading ? 'is-loading' : ''}>
            {loading ? '…' : money(metrics.currentClosing)}
          </strong>
          <Button variant="secondary" onClick={loadDashboard} loading={loading} className="db-hero__refresh">
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
      </section>

      {visibleShortcuts.length > 0 ? (
        <section className="db-shortcuts" aria-label="Quick shortcuts">
          {visibleShortcuts.map((item, index) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                to={item.to}
                className={`db-shortcut db-shortcut--${item.tone}`}
                style={{ '--db-delay': `${index * 70}ms` }}
              >
                <span className="db-shortcut__icon">
                  <Icon />
                </span>
                <span className="db-shortcut__text">
                  <span className="db-shortcut__label">{item.label}</span>
                  <span className="db-shortcut__hint">{item.hint}</span>
                </span>
                <span className="db-shortcut__arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            );
          })}
        </section>
      ) : null}

      <div className="db-filters">
        <label className="db-field">
          <span>From</span>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
          />
        </label>
        <label className="db-field">
          <span>To</span>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
          />
        </label>
      </div>

      {error ? <div className="db-error">{error}</div> : null}

      <section className="db-summary" aria-label="Period summary">
        {summaryItems.map((item, index) => (
          <article
            key={item.key}
            className={`db-summary__item db-summary__item--${item.key}`}
            style={{ '--db-delay': `${120 + index * 45}ms` }}
          >
            <span>{item.label}</span>
            <strong className={loading ? 'is-loading' : ''}>{loading ? '…' : money(item.value)}</strong>
          </article>
        ))}
      </section>

      <section
        className={`db-stock ${metrics.outOfStockCount > 0 ? 'db-stock--alert' : 'db-stock--ok'}`}
      >
        <div className="db-stock__pulse" aria-hidden="true" />
        <div className="db-stock__copy">
          <h2>{metrics.outOfStockCount > 0 ? 'Stock needs attention' : 'Inventory looks healthy'}</h2>
          <p>
            {metrics.outOfStockCount > 0
              ? `${metrics.outOfStockCount} product${metrics.outOfStockCount === 1 ? '' : 's'} out of stock in ${selectedBranchName}.`
              : `No zero-stock products in ${selectedBranchName}.`}
          </p>
        </div>
        <Link to="/inventory" className="db-stock__cta">
          Open inventory
        </Link>
      </section>
    </div>
  );
}
