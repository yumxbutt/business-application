import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../ui-kit';
import { useAuth } from '../context/AuthContext';
import { productService } from '../services/productService';
import { salesService } from '../services/salesService';
import { purchaseService } from '../services/purchaseService';
import { financialService } from '../services/financialService';
import { ledgerService } from '../services/ledgerService';
import { inventoryService } from '../services/inventoryService';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import EmptyState from '../components/ui/EmptyState';
import Spinner from '../components/ui/Spinner';
import './DashboardPage.css';

const today = new Date().toISOString().slice(0, 10);
const monthStart = `${today.slice(0, 8)}01`;

const toNumber = (value) => Number(value || 0);
const money = (value) => Math.round(toNumber(value)).toLocaleString('en-US');

const eachDay = (startDate, endDate) => {
  if (!startDate || !endDate) return [];
  const out = [];
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];
  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    out.push(cursor.toISOString().slice(0, 10));
  }
  return out;
};

const IconSales = () => (
  <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
    <path d="M3 17h14M3 17V7l7-4 7 4v10M8 17v-5h4v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconPurchase = () => (
  <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
    <path d="M6 2L3 6v12h14V6l-3-4H6ZM3 6h14M13 10a3 3 0 1 1-6 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconReceipt = () => (
  <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
    <path d="M10 3v14m-4-4 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);
const IconPayment = () => (
  <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
    <path d="M10 17V3m4 4-4-4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);
const IconReceivable = () => (
  <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
    <rect x="2" y="5" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M2 9h16M6 13h2m4 0h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const IconPayable = () => (
  <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
    <path d="M4 4h12a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M3 8h14M7 12h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const IconBalance = () => (
  <svg viewBox="0 0 20 20" fill="none" width="22" height="22">
    <path d="M3 10h14M10 3l7 7-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconStock = () => (
  <svg viewBox="0 0 20 20" fill="none" width="24" height="24">
    <path d="M10 3L3 7v6l7 4 7-4V7l-7-4Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M3 7l7 4 7-4M10 11v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

function TrendChart({ data }) {
  const width = 760;
  const height = 260;
  const padX = 44;
  const padY = 20;

  const maxY = Math.max(
    1,
    ...data.map((d) => Math.max(toNumber(d.sales), toNumber(d.purchases), toNumber(d.receipts), toNumber(d.payments)))
  );

  const plotW = width - padX * 2;
  const plotH = height - padY * 2;

  const x = (index, total) => (total <= 1 ? padX : padX + (index * plotW) / (total - 1));
  const y = (value) => padY + plotH - (toNumber(value) / maxY) * plotH;

  const buildPath = (key) =>
    data.map((d, idx) => `${idx === 0 ? 'M' : 'L'} ${x(idx, data.length)} ${y(d[key])}`).join(' ');

  const buildArea = (key) => {
    if (data.length === 0) return '';
    const line = data.map((d, idx) => `${idx === 0 ? 'M' : 'L'} ${x(idx, data.length)} ${y(d[key])}`).join(' ');
    const lastX = x(data.length - 1, data.length);
    return `${line} L ${lastX} ${height - padY} L ${padX} ${height - padY} Z`;
  };

  const gridLines = 4;

  return (
    <div className="db-chart">
      <svg viewBox={`0 0 ${width} ${height}`} className="db-chart__svg" role="img" aria-label="Business trend chart">
        <defs>
          <linearGradient id="grad-sales" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.18"/>
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0"/>
          </linearGradient>
          <linearGradient id="grad-receipt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#16a34a" stopOpacity="0.14"/>
            <stop offset="100%" stopColor="#16a34a" stopOpacity="0"/>
          </linearGradient>
        </defs>

        {Array.from({ length: gridLines + 1 }).map((_, i) => {
          const lineY = padY + (i * plotH) / gridLines;
          const val = Math.round(maxY - (i * maxY) / gridLines);
          return (
            <g key={i}>
              <line x1={padX} y1={lineY} x2={width - padX} y2={lineY} className="db-chart__grid" />
              <text x={padX - 8} y={lineY + 4} className="db-chart__tick" textAnchor="end">
                {val >= 1000000 ? `${(val/1000000).toFixed(1)}M` : val >= 1000 ? `${Math.round(val/1000)}k` : val}
              </text>
            </g>
          );
        })}

        <path d={buildArea('sales')} fill="url(#grad-sales)" />
        <path d={buildArea('receipts')} fill="url(#grad-receipt)" />

        <path d={buildPath('purchases')} className="db-chart__line db-chart__line--purchase" />
        <path d={buildPath('payments')}  className="db-chart__line db-chart__line--payment" />
        <path d={buildPath('receipts')}  className="db-chart__line db-chart__line--receipt" />
        <path d={buildPath('sales')}     className="db-chart__line db-chart__line--sales" />

        <line x1={padX} y1={padY} x2={padX} y2={height - padY} className="db-chart__axis" />
        <line x1={padX} y1={height - padY} x2={width - padX} y2={height - padY} className="db-chart__axis" />
      </svg>

      <div className="db-chart__legend">
        <span className="db-chart__legend-item"><i className="db-dot db-dot--sales" />Sales</span>
        <span className="db-chart__legend-item"><i className="db-dot db-dot--purchase" />Purchase</span>
        <span className="db-chart__legend-item"><i className="db-dot db-dot--receipt" />Customer Receiving</span>
        <span className="db-chart__legend-item"><i className="db-dot db-dot--payment" />Supplier Payment</span>
      </div>
    </div>
  );
}

const quickActions = [
  { to: '/sales',         label: 'Sales Register',    icon: '🧾', color: 'indigo' },
  { to: '/purchase',      label: 'Purchase Register',  icon: '📦', color: 'violet' },
  { to: '/cash-vouchers', label: 'Cash Vouchers',      icon: '💵', color: 'emerald' },
  { to: '/inventory',     label: 'Inventory',          icon: '🏭', color: 'amber' },
  { to: '/receivables',   label: 'Receivables',        icon: '📈', color: 'sky' },
  { to: '/ledger',        label: 'Ledger',             icon: '📒', color: 'rose' },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    branchId: user?.role === 'main_admin' ? '' : String(user?.branchId || ''),
    startDate: monthStart,
    endDate: today,
  });
  const [metrics, setMetrics] = useState({
    currentClosing: 0,
    totalDebit: 0,
    totalCredit: 0,
    salesTotal: 0,
    purchaseTotal: 0,
    receiptTotal: 0,
    paymentTotal: 0,
    receivableOutstanding: 0,
    payableOutstanding: 0,
    outOfStock: [],
    trend: [],
  });

  const selectedBranchName = useMemo(() => {
    const match = branches.find((branch) => String(branch.id) === String(filters.branchId));
    return match?.name || (user?.branchId ? `Branch ${user.branchId}` : 'All Branches');
  }, [branches, filters.branchId, user?.branchId]);

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
      const salesTotal = sales.reduce((sum, row) => sum + toNumber(row.totalAmount), 0);
      const purchaseTotal = purchases.reduce((sum, row) => sum + toNumber(row.totalAmount), 0);
      const receiptTotal = vouchers
        .filter((row) => row.transactionType === 'receipt')
        .reduce((sum, row) => sum + toNumber(row.amount), 0);
      const paymentTotal = vouchers
        .filter((row) => row.transactionType === 'payment')
        .reduce((sum, row) => sum + toNumber(row.amount), 0);
      const receivableOutstanding = receivables.reduce((sum, row) => sum + toNumber(row.outstandingAmount), 0);
      const payableOutstanding = payables.reduce((sum, row) => sum + toNumber(row.outstandingAmount), 0);
      const outOfStock = (stock || [])
        .filter((row) => toNumber(row.baseQty) <= 0)
        .map((row) => ({
          productId: row.productId,
          productName: row.productName,
          sku: row.sku,
          categoryName: row.categoryName || 'Uncategorized',
          stockText: '0',
        }));
      const dayKeys = eachDay(filters.startDate, filters.endDate);
      const trendMap = new Map(
        dayKeys.map((date) => [date, { date, sales: 0, purchases: 0, receipts: 0, payments: 0 }])
      );
      sales.forEach((row) => {
        if (!trendMap.has(row.saleDate)) return;
        trendMap.get(row.saleDate).sales += toNumber(row.totalAmount);
      });
      purchases.forEach((row) => {
        const dateKey = row.purchaseDate || row.billDate || row.entryDate;
        if (!trendMap.has(dateKey)) return;
        trendMap.get(dateKey).purchases += toNumber(row.totalAmount);
      });
      vouchers.forEach((row) => {
        if (!trendMap.has(row.entryDate)) return;
        if (row.transactionType === 'receipt') trendMap.get(row.entryDate).receipts += toNumber(row.amount);
        if (row.transactionType === 'payment') trendMap.get(row.entryDate).payments += toNumber(row.amount);
      });
      setMetrics({
        currentClosing: toNumber(trading?.closingBalance),
        totalDebit: toNumber(trading?.totalDebit),
        totalCredit: toNumber(trading?.totalCredit),
        salesTotal,
        purchaseTotal,
        receiptTotal,
        paymentTotal,
        receivableOutstanding,
        payableOutstanding,
        outOfStock,
        trend: Array.from(trendMap.values()),
      });
    } catch (err) {
      setError(err.message || 'Failed to load dashboard stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (filters.branchId) loadDashboard();
  }, [filters.branchId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="db-page">

      <PageHeader
        title="Dashboard"
        subtitle={`${selectedBranchName} \u00b7 ${filters.startDate} \u2192 ${filters.endDate}`}
        actions={
          <Button onClick={loadDashboard} loading={loading}>
            {loading ? 'Loading\u2026' : 'Refresh'}
          </Button>
        }
      />

      <div className="db-filters">
        {user?.role === 'main_admin' && (
          <label className="db-field">
            <span>Branch</span>
            <select
              value={filters.branchId}
              onChange={(e) => setFilters((prev) => ({ ...prev, branchId: e.target.value }))}
            >
              <option value="">&#8212; Select branch &#8212;</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </label>
        )}
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

      {error && <div className="db-error">{error}</div>}

      <div className="db-balance-card">
        <div className="db-balance-card__left">
          <div className="db-balance-card__icon"><IconBalance /></div>
          <div>
            <p className="db-balance-card__label">Closing Balance</p>
            <p className="db-balance-card__value">{money(metrics.currentClosing)}</p>
          </div>
        </div>
        <div className="db-balance-card__stats">
          <div className="db-balance-stat">
            <span className="db-balance-stat__label">Total Debits</span>
            <span className="db-balance-stat__value db-balance-stat__value--debit">{money(metrics.totalDebit)}</span>
          </div>
          <div className="db-balance-divider" />
          <div className="db-balance-stat">
            <span className="db-balance-stat__label">Total Credits</span>
            <span className="db-balance-stat__value db-balance-stat__value--credit">{money(metrics.totalCredit)}</span>
          </div>
        </div>
      </div>

      <div className="db-kpi-grid">
        <StatCard label="Total Sales"             value={money(metrics.salesTotal)}             icon={<IconSales />}      tone="default" loading={loading} meta="Posted invoices" />
        <StatCard label="Total Purchase"          value={money(metrics.purchaseTotal)}          icon={<IconPurchase />}   tone="warning" loading={loading} meta="Posted bills" />
        <StatCard label="Customer Receiving"      value={money(metrics.receiptTotal)}           icon={<IconReceipt />}    tone="success" loading={loading} meta="Receipts collected" />
        <StatCard label="Supplier Payment"        value={money(metrics.paymentTotal)}           icon={<IconPayment />}    tone="danger"  loading={loading} meta="Payments made" />
        <StatCard label="Receivable Outstanding"  value={money(metrics.receivableOutstanding)}  icon={<IconReceivable />} tone="info"    loading={loading} meta="Amount to collect" />
        <StatCard label="Payable Outstanding"     value={money(metrics.payableOutstanding)}     icon={<IconPayable />}    tone="warning" loading={loading} meta="Amount to pay" />
      </div>

      <div className="db-content-grid">
        <div className="db-card db-card--trend">
          <div className="db-card__head">
            <div>
              <h2 className="db-card__title">Business Trend</h2>
              <p className="db-card__subtitle">Sales, purchases, receipts and payments over time</p>
            </div>
          </div>
          <div className="db-card__body">
            {loading ? (
              <Spinner center size="lg" />
            ) : metrics.trend.length > 0 ? (
              <TrendChart data={metrics.trend} />
            ) : (
              <EmptyState title="No trend data" description="Select a date range and click Refresh." />
            )}
          </div>
        </div>

        <div className="db-card db-card--actions">
          <div className="db-card__head">
            <div>
              <h2 className="db-card__title">Quick Actions</h2>
              <p className="db-card__subtitle">Jump to modules</p>
            </div>
          </div>
          <div className="db-card__body">
            <div className="db-quick-grid">
              {quickActions.map((action) => (
                <Link key={action.to} to={action.to} className={`db-quick-item db-quick-item--${action.color}`}>
                  <span className="db-quick-item__icon">{action.icon}</span>
                  <span className="db-quick-item__label">{action.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="db-card">
        <div className="db-card__head">
          <div>
            <h2 className="db-card__title">Out of Stock Items</h2>
            <p className="db-card__subtitle">Products with zero inventory in selected branch</p>
          </div>
          {metrics.outOfStock.length > 0 && (
            <span className="db-badge db-badge--danger">{metrics.outOfStock.length} items</span>
          )}
        </div>
        <div className="db-card__body db-card__body--flush">
          {metrics.outOfStock.length === 0 ? (
            <EmptyState icon={<IconStock />} title="All items in stock" description="No out-of-stock products found in the selected branch." />
          ) : (
            <div className="db-table-wrap">
              <table className="db-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Category</th>
                    <th className="db-text-right">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.outOfStock.map((row) => (
                    <tr key={row.productId}>
                      <td className="db-table__product">{row.productName}</td>
                      <td className="db-table__mono">{row.sku || '\u2014'}</td>
                      <td>{row.categoryName}</td>
                      <td className="db-text-right">
                        <span className="db-badge db-badge--danger">0</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
