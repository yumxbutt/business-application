import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageCard from '../components/ui/PageCard';
import { Select } from '../ui-kit';
import { useAuth } from '../context/AuthContext';
import { productService } from '../services/productService';
import { reportsService } from '../services/reportsService';
import { downloadCsv, downloadPdfFromPrintArea } from '../utils/export';

const today = new Date().toISOString().slice(0, 10);
const monthStart = `${today.slice(0, 8)}01`;
const fmt = (n) => Number(n || 0).toFixed(2);

export default function PurchaseSummaryReportPage() {
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);
  const [filters, setFilters] = useState({
    branchId: user?.role === 'main_admin' ? '' : String(user?.branchId || ''),
    startDate: monthStart,
    endDate: today,
  });
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);

  const selectedBranchName = useMemo(() => {
    const match = branches.find((b) => String(b.id) === String(filters.branchId));
    return match?.name || (user?.branchName || 'Branch');
  }, [branches, filters.branchId, user?.branchName]);

  useEffect(() => {
    productService.getMeta().then((meta) => {
      const list = meta.branches || [];
      setBranches(list);
      if (user?.role === 'main_admin' && !filters.branchId && list[0]) {
        setFilters((prev) => ({ ...prev, branchId: String(list[0].id) }));
      }
    }).catch(() => {});
  }, [user?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadReport = async () => {
    if (!filters.branchId) {
      setError('Please select a branch.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await reportsService.getPurchaseSummary({
        branchId: Number(filters.branchId),
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      });
      setSummary(data);
    } catch (err) {
      setError(err.message || 'Failed to load purchase summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (filters.branchId) loadReport();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const exportCsv = () => {
    if (!summary) return;
    const rows = [
      ['Purchase Summary Report'],
      ['Branch', selectedBranchName],
      ['From', filters.startDate || ''],
      ['To', filters.endDate || ''],
      [],
      ['Metric', 'Value'],
      ['Bill Count', summary.purchases?.documentCount || 0],
      ['Sub Total', fmt(summary.purchases?.subTotal)],
      ['Discount', fmt(summary.purchases?.discount)],
      ['Additional Expenses', fmt(summary.purchases?.additionalExpensesTotal)],
      ['Total Amount', fmt(summary.purchases?.totalAmount)],
      ['Paid Amount', fmt(summary.purchases?.paidAmount)],
      ['Due Amount', fmt(summary.purchases?.dueAmount)],
      ['Return Count', summary.returns?.returnCount || 0],
      ['Return Amount', fmt(summary.returns?.totalAmount)],
      ['Net Total', fmt(summary.netTotalAmount)],
      [],
      ['Supplier', 'Bills', 'Total', 'Paid', 'Due'],
      ...(summary.bySupplier || []).map((row) => [
        row.contactName,
        row.billCount,
        fmt(row.totalAmount),
        fmt(row.paidAmount),
        fmt(row.dueAmount),
      ]),
    ];
    downloadCsv(rows, `purchase-summary-${filters.startDate}-to-${filters.endDate}.csv`);
  };

  const exportPdf = async () => {
    if (!summary) return;
    setExportingPdf(true);
    setError('');
    try {
      await downloadPdfFromPrintArea(`purchase-summary-${filters.startDate}-to-${filters.endDate}.pdf`, '.print-area');
    } catch (exportError) {
      setError(exportError.message || 'PDF export failed');
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="dashboard-stack">
      <PageCard
        title="Purchase Summary"
        subtitle={`${selectedBranchName} · posted bills and returns`}
        actions={
          <>
            <Link to="/reports" className="secondary-action-button">Back to Reports</Link>
            <button type="button" className="secondary-action-button" onClick={exportCsv} disabled={!summary}>
              Export CSV
            </button>
            <button type="button" className="secondary-action-button" onClick={exportPdf} disabled={!summary || exportingPdf}>
              {exportingPdf ? 'Exporting PDF…' : 'Export PDF'}
            </button>
          </>
        }
      >
        {error ? <p className="error-text">{error}</p> : null}

        <div className="table-filters no-print">
          {user?.role === 'main_admin' ? (
            <label className="form-field" htmlFor="purchaseSummaryBranch">
              <span>Branch</span>
              <Select
                id="purchaseSummaryBranch"
                value={filters.branchId}
                onChange={(e) => setFilters((p) => ({ ...p, branchId: e.target.value }))}
                options={[{ value: '', label: 'Select branch' }, ...branches.map((b) => ({ value: String(b.id), label: b.name }))]}
              />
            </label>
          ) : null}
          <label className="form-field" htmlFor="purchaseSummaryStart">
            <span>From</span>
            <input id="purchaseSummaryStart" type="date" value={filters.startDate}
              onChange={(e) => setFilters((p) => ({ ...p, startDate: e.target.value }))} />
          </label>
          <label className="form-field" htmlFor="purchaseSummaryEnd">
            <span>To</span>
            <input id="purchaseSummaryEnd" type="date" value={filters.endDate}
              onChange={(e) => setFilters((p) => ({ ...p, endDate: e.target.value }))} />
          </label>
          <button type="button" className="primary-action-button" style={{ alignSelf: 'flex-end' }} onClick={loadReport}>
            Apply
          </button>
        </div>

        {loading ? (
          <p>Loading report…</p>
        ) : summary ? (
          <div className="print-area">
          <>
            <div className="page-stats-strip no-print" style={{ marginBottom: '1rem' }}>
              <div className="page-stat-tile">
                <span className="page-stat-tile__label">Bills</span>
                <span className="page-stat-tile__value">{summary.purchases?.documentCount || 0}</span>
              </div>
              <div className="page-stat-tile page-stat-tile--warning">
                <span className="page-stat-tile__label">Purchase Total</span>
                <span className="page-stat-tile__value">{fmt(summary.purchases?.totalAmount)}</span>
              </div>
              <div className="page-stat-tile page-stat-tile--danger">
                <span className="page-stat-tile__label">Returns</span>
                <span className="page-stat-tile__value">{fmt(summary.returns?.totalAmount)}</span>
              </div>
              <div className="page-stat-tile page-stat-tile--primary">
                <span className="page-stat-tile__label">Net Purchase</span>
                <span className="page-stat-tile__value">{fmt(summary.netTotalAmount)}</span>
              </div>
            </div>

            <div className="table-wrap table-wrap--full">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th className="text-right">Bills</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Paid</th>
                    <th className="text-right">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {(summary.bySupplier || []).map((row) => (
                    <tr key={row.contactId || row.contactName}>
                      <td>{row.contactName}</td>
                      <td className="text-right">{row.billCount}</td>
                      <td className="text-right">{fmt(row.totalAmount)}</td>
                      <td className="text-right">{fmt(row.paidAmount)}</td>
                      <td className="text-right">{fmt(row.dueAmount)}</td>
                    </tr>
                  ))}
                  {(summary.bySupplier || []).length === 0 ? (
                    <tr><td colSpan="5" className="empty-state-cell">No purchases found for this period.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
          </div>
        ) : null}
      </PageCard>
    </div>
  );
}
