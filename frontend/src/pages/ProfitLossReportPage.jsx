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

export default function ProfitLossReportPage() {
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);
  const [filters, setFilters] = useState({
    branchId: user?.role === 'main_admin' ? '' : String(user?.branchId || ''),
    startDate: monthStart,
    endDate: today,
  });
  const [report, setReport] = useState(null);
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
      const data = await reportsService.getProfitLoss({
        branchId: Number(filters.branchId),
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      });
      setReport(data);
    } catch (err) {
      setError(err.message || 'Failed to load profit & loss report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (filters.branchId) loadReport();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const exportCsv = () => {
    if (!report) return;
    const rows = [
      ['Profit & Loss Report'],
      ['Branch', selectedBranchName],
      ['From', filters.startDate || ''],
      ['To', filters.endDate || ''],
      [],
      ['Income Accounts'],
      ['Account', 'Code', 'Amount'],
      ...(report.income || []).map((row) => [row.name, row.code || '', fmt(row.amount)]),
      ['Total Income', '', fmt(report.totalIncome)],
      [],
      ['Expense Accounts'],
      ['Account', 'Code', 'Amount'],
      ...(report.expense || []).map((row) => [row.name, row.code || '', fmt(row.amount)]),
      ['Total Expense', '', fmt(report.totalExpense)],
      [],
      ['Net Profit', '', fmt(report.netProfit)],
    ];
    downloadCsv(rows, `profit-loss-${filters.startDate}-to-${filters.endDate}.csv`);
  };

  const exportPdf = async () => {
    if (!report) return;
    setExportingPdf(true);
    setError('');
    try {
      await downloadPdfFromPrintArea(`profit-loss-${filters.startDate}-to-${filters.endDate}.pdf`, '.print-area');
    } catch (exportError) {
      setError(exportError.message || 'PDF export failed');
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="dashboard-stack">
      <PageCard
        title="Profit & Loss"
        subtitle={`${selectedBranchName} · income and expense accounts`}
        actions={
          <>
            <Link to="/reports" className="secondary-action-button">Back to Reports</Link>
            <button type="button" className="secondary-action-button" onClick={exportCsv} disabled={!report}>
              Export CSV
            </button>
            <button type="button" className="secondary-action-button" onClick={exportPdf} disabled={!report || exportingPdf}>
              {exportingPdf ? 'Exporting PDF…' : 'Export PDF'}
            </button>
          </>
        }
      >
        {error ? <p className="error-text">{error}</p> : null}

        <div className="table-filters no-print">
          {user?.role === 'main_admin' ? (
            <label className="form-field" htmlFor="plBranch">
              <span>Branch</span>
              <Select
                id="plBranch"
                value={filters.branchId}
                onChange={(e) => setFilters((p) => ({ ...p, branchId: e.target.value }))}
                options={[{ value: '', label: 'Select branch' }, ...branches.map((b) => ({ value: String(b.id), label: b.name }))]}
              />
            </label>
          ) : null}
          <label className="form-field" htmlFor="plStart">
            <span>From</span>
            <input id="plStart" type="date" value={filters.startDate}
              onChange={(e) => setFilters((p) => ({ ...p, startDate: e.target.value }))} />
          </label>
          <label className="form-field" htmlFor="plEnd">
            <span>To</span>
            <input id="plEnd" type="date" value={filters.endDate}
              onChange={(e) => setFilters((p) => ({ ...p, endDate: e.target.value }))} />
          </label>
          <button type="button" className="primary-action-button" style={{ alignSelf: 'flex-end' }} onClick={loadReport}>
            Apply
          </button>
        </div>

        {loading ? (
          <p>Loading report…</p>
        ) : report ? (
          <div className="print-area">
          <>
            <div className="page-stats-strip no-print" style={{ marginBottom: '1rem' }}>
              <div className="page-stat-tile page-stat-tile--success">
                <span className="page-stat-tile__label">Total Income</span>
                <span className="page-stat-tile__value">{fmt(report.totalIncome)}</span>
              </div>
              <div className="page-stat-tile page-stat-tile--danger">
                <span className="page-stat-tile__label">Total Expense</span>
                <span className="page-stat-tile__value">{fmt(report.totalExpense)}</span>
              </div>
              <div className={`page-stat-tile ${Number(report.netProfit) >= 0 ? 'page-stat-tile--primary' : 'page-stat-tile--warning'}`}>
                <span className="page-stat-tile__label">Net Profit</span>
                <span className="page-stat-tile__value">{fmt(report.netProfit)}</span>
              </div>
            </div>

            <div className="dashboard-stack" style={{ gap: '1.5rem' }}>
              <div className="table-wrap table-wrap--full">
                <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>Income</h3>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Code</th>
                      <th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(report.income || []).map((row) => (
                      <tr key={row.accountHeadId}>
                        <td>{row.name}</td>
                        <td>{row.code || '–'}</td>
                        <td className="text-right">{fmt(row.amount)}</td>
                      </tr>
                    ))}
                    {(report.income || []).length === 0 ? (
                      <tr><td colSpan="3" className="empty-state-cell">No income entries.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div className="table-wrap table-wrap--full">
                <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>Expenses</h3>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Code</th>
                      <th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(report.expense || []).map((row) => (
                      <tr key={row.accountHeadId}>
                        <td>{row.name}</td>
                        <td>{row.code || '–'}</td>
                        <td className="text-right">{fmt(row.amount)}</td>
                      </tr>
                    ))}
                    {(report.expense || []).length === 0 ? (
                      <tr><td colSpan="3" className="empty-state-cell">No expense entries.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </>
          </div>
        ) : null}
      </PageCard>
    </div>
  );
}
