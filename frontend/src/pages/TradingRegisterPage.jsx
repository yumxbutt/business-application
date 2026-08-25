import { useEffect, useState } from 'react';
import PageCard from '../components/ui/PageCard';
import { useAuth } from '../context/AuthContext';
import { productService } from '../services/productService';
import { ledgerService } from '../services/ledgerService';
import { downloadCsv, downloadPdfFromPrintArea } from '../utils/export';
import { settingsService } from '../services/settingsService';
import { openPrintWindow, fmtPrintDate, fmtNum } from '../utils/printHelper';

const today = new Date().toISOString().slice(0, 10);
const monthStart = `${today.slice(0, 8)}01`;

const fmt = (n) => Math.round(Number(n || 0)).toLocaleString('en-US');
const fileSafe = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const formatDate = (iso) => {
  if (!iso) return '–';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

export default function TradingRegisterPage() {
  const { user } = useAuth();
  const [generatedOn] = useState(() =>
    new Date().toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    })
  );

  const [branches, setBranches] = useState([]);
  const [filters, setFilters] = useState({
    branchId: user?.role === 'main_admin' ? '' : String(user?.branchId || ''),
    startDate: monthStart,
    endDate: today,
  });

  const [openingForm, setOpeningForm] = useState({
    openingBalance: '',
    openingDate: today,
    notes: '',
  });

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savingOpening, setSavingOpening] = useState(false);
  const [error, setError] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [company, setCompany] = useState({});

  const selectedBranchName =
    branches.find((branch) => String(branch.id) === String(filters.branchId))?.name || `Branch-${filters.branchId || 'NA'}`;

  const loadOpening = async () => {
    if (!filters.branchId) return;
    try {
      const opening = await ledgerService.getOpeningBalance({ branchId: Number(filters.branchId) });
      setOpeningForm((prev) => ({
        ...prev,
        openingBalance: String(opening.openingBalance ?? 0),
        openingDate: opening.openingDate || prev.openingDate,
        notes: opening.notes || '',
      }));
    } catch (e) {
      setError(e.message || 'Failed to load opening balance');
    }
  };

  const loadReport = async () => {
    if (!filters.branchId) {
      setError('Please select a branch.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await ledgerService.getTradingLedgerRegister({
        branchId: Number(filters.branchId),
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      });
      setReport(data);
    } catch (e) {
      setError(e.message || 'Failed to load trading register');
    } finally {
      setLoading(false);
    }
  };

  const saveOpeningBalance = async () => {
    if (!filters.branchId) {
      setError('Please select a branch first.');
      return;
    }

    setSavingOpening(true);
    setError('');
    try {
      await ledgerService.setOpeningBalance({
        branchId: Number(filters.branchId),
        openingBalance: Number(openingForm.openingBalance || 0),
        openingDate: openingForm.openingDate || null,
        notes: openingForm.notes || null,
      });
      await loadReport();
    } catch (e) {
      setError(e.message || 'Failed to save opening balance');
    } finally {
      setSavingOpening(false);
    }
  };

  const handlePrint = () => {
    if (!report) return;
    let body = '';
    (report.days || []).forEach((day) => {
      const crEntries = day.entries.filter((e) => Number(e.credit) > 0);
      const drEntries = day.entries.filter((e) => Number(e.debit) > 0);
      const crRows = crEntries.map((e) =>
        `<tr><td>${e.referenceNo || e.referenceType || '–'}</td><td>${e.displayDescription || '–'}</td><td class="tr cr">${fmtNum(e.credit)}</td></tr>`
      ).join('');
      const drRows = drEntries.map((e) =>
        `<tr><td>${e.referenceNo || e.referenceType || '–'}</td><td>${e.displayDescription || '–'}</td><td class="tr dr">${fmtNum(e.debit)}</td></tr>`
      ).join('');
      body += `<div class="day-hdr"><span>${fmtPrintDate(day.date)}</span><span>Opening: ${fmtNum(day.openingBalance)} | Closing: ${fmtNum(day.closingBalance)}</span></div>
        <div class="split">
          <div>
            <table><thead><tr><th>Ref</th><th>Description</th><th class="tr">Credit</th></tr></thead>
            <tbody>${crRows || '<tr><td colspan="3" class="mt" style="text-align:center;padding:8px">No credit entries</td></tr>'}</tbody>
            <tfoot><tr><td colspan="2">CR Total</td><td class="tr">${fmtNum(day.totalCredit)}</td></tr></tfoot></table>
          </div>
          <div>
            <table><thead><tr><th>Ref</th><th>Description</th><th class="tr">Debit</th></tr></thead>
            <tbody>${drRows || '<tr><td colspan="3" class="mt" style="text-align:center;padding:8px">No debit entries</td></tr>'}</tbody>
            <tfoot><tr><td colspan="2">DR Total</td><td class="tr">${fmtNum(day.totalDebit)}</td></tr></tfoot></table>
          </div>
        </div>`;
    });
    const summary = `<div class="tot" style="margin-bottom:14px">
      <div class="tot-row"><span>Opening Balance</span><span>${fmtNum(report.openingBalance)}</span></div>
      <div class="tot-row"><span>Total Credit</span><span>${fmtNum(report.totalCredit)}</span></div>
      <div class="tot-row"><span>Total Debit</span><span>${fmtNum(report.totalDebit)}</span></div>
      <div class="tot-row"><span>Closing Balance</span><span>${fmtNum(report.closingBalance)}</span></div>
    </div>`;
    openPrintWindow({
      title: 'Trading Ledger Register',
      titleBar: 'TRADING LEDGER REGISTER',
      company,
      metaFields: [
        ['Branch', selectedBranchName],
        ['From', filters.startDate || '–'],
        ['To', filters.endDate || '–'],
        ['Generated On', generatedOn],
        ['Generated By', user?.fullName || user?.username || 'System'],
      ],
      bodyHtml: summary + body,
    });
  };

  const exportPdf = async () => {
    if (!report) return;
    setExportingPdf(true);
    setError('');
    try {
      const fileName = `trading-ledger-${fileSafe(selectedBranchName)}-${filters.startDate || 'from'}-to-${filters.endDate || 'to'}.pdf`;
      await downloadPdfFromPrintArea(fileName, '.print-area');
    } catch (exportError) {
      setError(exportError.message || 'PDF export failed');
    } finally {
      setExportingPdf(false);
    }
  };

  const exportExcel = () => {
    if (!report) return;

    const rows = [
      ['Trading Ledger Register'],
      ['Branch', selectedBranchName],
      ['Date Range', `${filters.startDate || '-'} to ${filters.endDate || '-'}`],
      ['Generated On', generatedOn],
      ['Generated By', user?.fullName || user?.username || 'System'],
      ['Opening Balance', fmt(report.openingBalance)],
      ['Total Credit', fmt(report.totalCredit)],
      ['Total Debit', fmt(report.totalDebit)],
      ['Closing Balance', fmt(report.closingBalance)],
      [],
    ];

    (report.days || []).forEach((day) => {
      rows.push([`Date: ${formatDate(day.date)}`]);
      rows.push(['Opening', fmt(day.openingBalance)]);
      rows.push(['Side', 'Date', 'Ref No', 'Party / Description', 'Amount']);

      (day.entries || []).forEach((entry) => {
        if (Number(entry.credit) > 0) {
          rows.push(['CR', formatDate(entry.entryDate), entry.referenceNo || entry.referenceType || '-', entry.displayDescription || '-', fmt(entry.credit)]);
        }
      });
      rows.push(['', '', '', 'CR Total', fmt(day.totalCredit)]);

      (day.entries || []).forEach((entry) => {
        if (Number(entry.debit) > 0) {
          rows.push(['DR', formatDate(entry.entryDate), entry.referenceNo || entry.referenceType || '-', entry.displayDescription || '-', fmt(entry.debit)]);
        }
      });
      rows.push(['', '', '', 'DR Total', fmt(day.totalDebit)]);
      rows.push(['Closing', fmt(day.closingBalance)]);
      rows.push([]);
    });

    const fileName = `trading-register-${fileSafe(selectedBranchName)}-${filters.startDate || 'from'}-to-${filters.endDate || 'to'}.csv`;
    downloadCsv(rows, fileName);
  };

  useEffect(() => {
    settingsService.getCompanySettings().then(setCompany).catch(() => {});
  }, []);

  useEffect(() => {
    if (user?.role !== 'main_admin') return;

    productService
      .getMeta()
      .then((data) => {
        const items = data.branches || [];
        setBranches(items);
        if (!filters.branchId && items[0]) {
          setFilters((prev) => ({ ...prev, branchId: String(items[0].id) }));
        }
      })
      .catch(() => {});
  }, [user?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!filters.branchId) return;
    loadOpening();
    loadReport();
  }, [filters.branchId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="dashboard-stack">
      <PageCard
        title="Trading Ledger Register"
        subtitle="Date-wise trading ledger with opening/closing carry forward: closing = opening + credit - debit"
        actions={
          <div className="inline-actions no-print">
            <button type="button" className="secondary-action-button" onClick={exportExcel} disabled={!report}>
              Export Excel
            </button>
            <button type="button" className="secondary-action-button" onClick={exportPdf} disabled={!report || exportingPdf}>
              {exportingPdf ? 'Exporting PDF…' : 'Export PDF'}
            </button>
            <button type="button" className="secondary-action-button" onClick={handlePrint} disabled={!report}>
              &#128424; Print
            </button>
          </div>
        }
      >
        {error ? <p className="error-text">{error}</p> : null}

        <div className="table-filters no-print">
          {user?.role === 'main_admin' ? (
            <label className="form-field" htmlFor="trading-register-branch">
              <span>Branch</span>
              <select
                id="trading-register-branch"
                value={filters.branchId}
                onChange={(e) => setFilters((prev) => ({ ...prev, branchId: e.target.value }))}
              >
                <option value="">— Select branch —</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="form-field" htmlFor="trading-register-start">
            <span>From</span>
            <input
              id="trading-register-start"
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
            />
          </label>

          <label className="form-field" htmlFor="trading-register-end">
            <span>To</span>
            <input
              id="trading-register-end"
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
            />
          </label>
        </div>

        <div className="table-filters no-print" style={{ marginTop: 6 }}>
          <label className="form-field" htmlFor="opening-balance">
            <span>Opening Balance</span>
            <input
              id="opening-balance"
              type="number"
              step="0.01"
              value={openingForm.openingBalance}
              onChange={(e) => setOpeningForm((prev) => ({ ...prev, openingBalance: e.target.value }))}
            />
          </label>

          <label className="form-field" htmlFor="opening-date">
            <span>Opening Date</span>
            <input
              id="opening-date"
              type="date"
              value={openingForm.openingDate || ''}
              onChange={(e) => setOpeningForm((prev) => ({ ...prev, openingDate: e.target.value }))}
            />
          </label>

          <label className="form-field" htmlFor="opening-notes">
            <span>Opening Notes</span>
            <input
              id="opening-notes"
              type="text"
              value={openingForm.notes}
              onChange={(e) => setOpeningForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Optional"
            />
          </label>
        </div>

        <div className="inline-actions inline-actions--end no-print">
          <button type="button" className="secondary-action-button" onClick={saveOpeningBalance} disabled={savingOpening || !filters.branchId}>
            {savingOpening ? 'Saving…' : 'Save Opening'}
          </button>
          <button type="button" className="primary-action-button" onClick={loadReport} disabled={loading}>
            {loading ? 'Loading…' : 'Load Register'}
          </button>
        </div>

        {report ? (
          <div className="dashboard-stack print-area">
            <div className="view-header">
              <strong>Trading Ledger Register</strong>
              <span>
                Branch: {selectedBranchName} | Date Range: {filters.startDate || '-'} to {filters.endDate || '-'} | Generated On: {generatedOn} | Generated By: {user?.fullName || user?.username || 'System'}
              </span>
            </div>

            <div className="totals-panel" style={{ maxWidth: 440 }}>
              <div className="totals-row">
                <span>Opening Balance</span>
                <strong>{fmt(report.openingBalance)}</strong>
              </div>
              <div className="totals-row">
                <span>Total Credit</span>
                <strong>{fmt(report.totalCredit)}</strong>
              </div>
              <div className="totals-row">
                <span>Total Debit</span>
                <strong>{fmt(report.totalDebit)}</strong>
              </div>
              <div className="totals-row totals-row--total">
                <span>Closing Balance</span>
                <strong>{fmt(report.closingBalance)}</strong>
              </div>
            </div>

            {report.days?.map((day) => {
              const creditEntries = day.entries.filter((entry) => Number(entry.credit) > 0);
              const debitEntries = day.entries.filter((entry) => Number(entry.debit) > 0);

              return (
                <div key={day.date} className="table-wrap table-wrap--full cashbook-day-card">
                  <div className="view-header">
                    <strong>{formatDate(day.date)}</strong>
                    <span>
                      Opening: {fmt(day.openingBalance)} | Closing: {fmt(day.closingBalance)}
                    </span>
                  </div>
                  <p className="view-note">
                    Trading register entries for this day (cash legs excluded). Closing = Opening + Credit − Debit.
                  </p>

                  <div className="cashbook-split-row">
                    <div className="table-wrap table-wrap--full cashbook-wrap">
                      <table className="data-table cashbook-table">
                        <thead>
                          <tr>
                            <th colSpan="3">Credit Entries</th>
                          </tr>
                          <tr>
                            <th>Ref No.</th>
                            <th>Party / Description</th>
                            <th className="text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {creditEntries.map((entry) => (
                            <tr key={`cr-${entry.id}`}>
                              <td>{entry.referenceNo || entry.referenceType || '–'}</td>
                              <td>{entry.displayDescription || '–'}</td>
                              <td className="text-right ledger-credit">{fmt(entry.credit)}</td>
                            </tr>
                          ))}

                          {creditEntries.length === 0 ? (
                            <tr>
                              <td colSpan="3" className="empty-state-cell">No credit entries.</td>
                            </tr>
                          ) : (
                            <tr className="table-total-row">
                              <td colSpan="2"><strong>CR Total</strong></td>
                              <td className="text-right"><strong>{fmt(day.totalCredit)}</strong></td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="table-wrap table-wrap--full cashbook-wrap">
                      <table className="data-table cashbook-table">
                        <thead>
                          <tr>
                            <th colSpan="3">Debit Entries</th>
                          </tr>
                          <tr>
                            <th>Ref No.</th>
                            <th>Party / Description</th>
                            <th className="text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {debitEntries.map((entry) => (
                            <tr key={`dr-${entry.id}`}>
                              <td>{entry.referenceNo || entry.referenceType || '–'}</td>
                              <td>{entry.displayDescription || '–'}</td>
                              <td className="text-right ledger-debit">{fmt(entry.debit)}</td>
                            </tr>
                          ))}

                          {debitEntries.length === 0 ? (
                            <tr>
                              <td colSpan="3" className="empty-state-cell">No debit entries.</td>
                            </tr>
                          ) : (
                            <tr className="table-total-row">
                              <td colSpan="2"><strong>DR Total</strong></td>
                              <td className="text-right"><strong>{fmt(day.totalDebit)}</strong></td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })}

            {report.days?.length === 0 ? (
              <div className="table-wrap table-wrap--full">
                <table className="data-table">
                  <tbody>
                    <tr>
                      <td className="empty-state-cell">No financial entries found for the selected period.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}
      </PageCard>
    </div>
  );
}
