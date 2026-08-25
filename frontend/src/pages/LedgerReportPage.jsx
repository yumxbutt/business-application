import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageCard from '../components/ui/PageCard';
import { Select } from '../ui-kit';
import { useAuth } from '../context/AuthContext';
import { productService } from '../services/productService';
import { ledgerService } from '../services/ledgerService';
import { downloadCsv, downloadPdfFromPrintArea } from '../utils/export';

const today = new Date().toISOString().slice(0, 10);
const monthStart = `${today.slice(0, 8)}01`;
const fmt = (n) => Number(n || 0).toFixed(2);

export default function LedgerReportPage() {
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);
  const [filters, setFilters] = useState({
    branchId: user?.role === 'main_admin' ? '' : String(user?.branchId || ''),
    startDate: monthStart,
    endDate: today,
  });
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);

  const selectedBranchName =
    branches.find((branch) => String(branch.id) === String(filters.branchId))?.name || `Branch-${filters.branchId || 'NA'}`;

  const loadReport = async () => {
    if (!filters.branchId) {
      setEntries([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await ledgerService.getLedgerReport(filters);
      setEntries(data);
    } catch (err) {
      setError(err.message || 'Failed to load ledger report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    productService.getMeta().then((meta) => {
      const list = meta.branches || [];
      setBranches(list);
      if (user?.role === 'main_admin' && !filters.branchId && list[0]) {
        setFilters((prev) => ({ ...prev, branchId: String(list[0].id) }));
      }
    }).catch(() => {});
  }, [user?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (filters.branchId) loadReport();
  }, [filters.branchId]); // eslint-disable-line react-hooks/exhaustive-deps

  const exportCsv = () => {
    downloadCsv(
      [
        ['Date', 'Account', 'Contact', 'Description', 'Debit', 'Credit', 'Balance'],
        ...entries.map((row) => [
          row.entryDate,
          row.accountHead?.name || '',
          row.contact?.name || '',
          row.description || '',
          row.debit,
          row.credit,
          row.accountBalance,
        ]),
      ],
      `ledger-report-${filters.startDate}-to-${filters.endDate}.csv`
    );
  };

  const exportPdf = async () => {
    if (!entries.length) return;
    setExportingPdf(true);
    setError('');
    try {
      await downloadPdfFromPrintArea(`ledger-report-${filters.startDate}-to-${filters.endDate}.pdf`, '.print-area');
    } catch (exportError) {
      setError(exportError.message || 'PDF export failed');
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="dashboard-stack">
      <PageCard
        title="Ledger Report"
        subtitle="All account entries with running balances"
        actions={
          <>
            <Link to="/reports" className="secondary-action-button">Back to Reports</Link>
            <button type="button" className="secondary-action-button" onClick={exportCsv} disabled={!entries.length}>
              Export CSV
            </button>
            <button type="button" className="secondary-action-button" onClick={exportPdf} disabled={!entries.length || exportingPdf}>
              {exportingPdf ? 'Exporting PDF…' : 'Export PDF'}
            </button>
          </>
        }
      >
        {error ? <p className="error-text">{error}</p> : null}

        <div className="table-filters no-print">
          {user?.role === 'main_admin' ? (
            <label className="form-field" htmlFor="ledgerBranch">
              <span>Branch</span>
              <Select
                id="ledgerBranch"
                value={filters.branchId}
                onChange={(e) => setFilters((p) => ({ ...p, branchId: e.target.value }))}
                options={[{ value: '', label: 'Select branch' }, ...branches.map((b) => ({ value: String(b.id), label: b.name }))]}
              />
            </label>
          ) : null}
          <label className="form-field" htmlFor="ledgerStart">
            <span>From</span>
            <input
              id="ledgerStart"
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters((p) => ({ ...p, startDate: e.target.value }))}
            />
          </label>
          <label className="form-field" htmlFor="ledgerEnd">
            <span>To</span>
            <input
              id="ledgerEnd"
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters((p) => ({ ...p, endDate: e.target.value }))}
            />
          </label>
          <button type="button" className="primary-action-button" style={{ alignSelf: 'flex-end' }} onClick={loadReport}>
            Apply
          </button>
        </div>

        {loading ? (
          <p>Loading report…</p>
        ) : (
          <div className="print-area">
            <div className="view-header">
              <strong>Ledger Report</strong>
              <span>
                Branch: {selectedBranchName} | {filters.startDate || '-'} to {filters.endDate || '-'}
              </span>
            </div>
            <div className="table-wrap table-wrap--full">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Account</th>
                    <th>Contact</th>
                    <th>Description</th>
                    <th className="text-right">Debit</th>
                    <th className="text-right">Credit</th>
                    <th className="text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((row) => (
                    <tr key={row.id}>
                      <td>{row.entryDate}</td>
                      <td>{row.accountHead?.name || '–'}</td>
                      <td>{row.contact?.name || '–'}</td>
                      <td>{row.description || '–'}</td>
                      <td className="text-right">{fmt(row.debit)}</td>
                      <td className="text-right">{fmt(row.credit)}</td>
                      <td className="text-right">{fmt(row.accountBalance)}</td>
                    </tr>
                  ))}
                  {entries.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="empty-state-cell">No ledger entries found.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </PageCard>
    </div>
  );
}
