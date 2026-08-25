import { Link } from 'react-router-dom';
import PageCard from '../components/ui/PageCard';
import { useAccess } from '../hooks/useAccess';

const reportLinks = [
  { to: '/reports/sales', label: 'Sales Summary', description: 'Invoice totals, returns and customer breakdown', rights: ['reports:sales'] },
  { to: '/reports/purchase', label: 'Purchase Summary', description: 'Bill totals, returns and supplier breakdown', rights: ['reports:purchase'] },
  { to: '/reports/profit-loss', label: 'Profit & Loss', description: 'Income and expense accounts for the period', rights: ['reports:profit-loss'] },
  { to: '/reports/ledger', label: 'Ledger Report', description: 'All account entries with running balances', rights: ['reports:ledger'] },
  { to: '/fifo-stock-report', label: 'FIFO Stock Report', description: 'Open batches and stock valuation', rights: ['inventory:read'] },
  { to: '/product-history', label: 'Product History', description: 'Stock movements by product', rights: ['inventory:read'] },
  { to: '/receivables', label: 'Receivables', description: 'Customer outstanding balances', rights: ['financial:receivables:read'] },
  { to: '/payables', label: 'Payables', description: 'Supplier outstanding balances', rights: ['financial:payables:read'] },
  { to: '/cash-book', label: 'Daily Cash Report', description: 'Opening, cash in, cash out and closing balance', rights: ['financial:cashbook:read'] },
  { to: '/trading-ledger', label: 'Trading Ledger', description: 'Trading account register', rights: ['financial:trading:read'] },
];

export default function ReportsPage() {
  const { hasAny } = useAccess();
  const visibleLinks = reportLinks.filter((item) => hasAny(item.rights));

  return (
    <div className="dashboard-stack">
      <PageCard title="Reports" subtitle="Business reports and financial summaries">
        <div className="quick-actions-grid">
          {visibleLinks.map((item) => (
            <Link key={item.to} to={item.to} className="quick-action-card">
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </Link>
          ))}
        </div>
      </PageCard>
    </div>
  );
}
