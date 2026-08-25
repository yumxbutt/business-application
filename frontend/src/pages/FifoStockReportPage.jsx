import { useEffect, useMemo, useState } from 'react';
import PageCard from '../components/ui/PageCard';
import { productService } from '../services/productService';
import Select from '../ui-kit/Select';
import { inventoryService } from '../services/inventoryService';
import { downloadPdfFromPrintArea } from '../utils/export';

const formatDate = (value) => {
  if (!value) return '–';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtQty = (value) => Number(value || 0).toFixed(4);
const fmtMoney = (value) => Number(value || 0).toFixed(2);

export default function FifoStockReportPage() {
  const [meta, setMeta] = useState({ branches: [], products: [] });
  const [filters, setFilters] = useState({
    branchId: '',
    productId: '',
    fromDate: '',
    toDate: '',
    onlyOpen: true,
  });

  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const metaRes = await productService.getMeta();
        const products = await productService.getProducts({});
        const branches = metaRes.branches || [];
        setMeta({ branches, products: products || [] });
        if (branches[0]) {
          setFilters((prev) => ({ ...prev, branchId: String(branches[0].id) }));
        }
      } catch (e) {
        setError(e.message || 'Failed to load metadata');
      }
    };

    loadMeta();
  }, []);

  const verifyStats = useMemo(() => {
    if (!rows.length) return { mismatches: 0, mismatchPct: '0.00' };
    const mismatches = rows.filter((row) => !row.verification?.isVerified).length;
    const mismatchPct = ((mismatches / rows.length) * 100).toFixed(2);
    return { mismatches, mismatchPct };
  }, [rows]);

  const loadReport = async () => {
    if (!filters.branchId) {
      setError('Please select a branch');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await inventoryService.getFifoReport({
        branchId: Number(filters.branchId),
        productId: filters.productId ? Number(filters.productId) : undefined,
        fromDate: filters.fromDate || undefined,
        toDate: filters.toDate || undefined,
        onlyOpen: !!filters.onlyOpen,
      });

      setRows(res.rows || []);
      setSummary(res.summary || null);
      setSearched(true);
    } catch (e) {
      setError(e.message || 'Failed to load FIFO report');
    } finally {
      setLoading(false);
    }
  };

  const exportPdf = async () => {
    if (!searched) return;
    setExportingPdf(true);
    setError('');
    try {
      await downloadPdfFromPrintArea('fifo-stock-report.pdf', '.print-area');
    } catch (exportError) {
      setError(exportError.message || 'PDF export failed');
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="dashboard-stack">
      <PageCard
        title="FIFO Stock Verification"
        subtitle="Check FIFO batches against itemized purchase returns"
        actions={
          searched ? (
            <button type="button" className="secondary-action-button no-print" onClick={exportPdf} disabled={exportingPdf}>
              {exportingPdf ? 'Exporting PDF…' : 'Export PDF'}
            </button>
          ) : null
        }
      >
        {error ? <p className="error-text">{error}</p> : null}

        <div className="table-filters no-print">
          <label className="form-field" htmlFor="fifo-branch">
            <span>Branch</span>
            <Select
              id="fifo-branch"
              value={filters.branchId}
              onChange={(e) => setFilters((prev) => ({ ...prev, branchId: e.target.value }))}
              options={[{ value: '', label: '— select branch —' }, ...(meta.branches || []).map((b) => ({ value: String(b.id), label: b.name }))]}
            />
          </label>

          <label className="form-field" htmlFor="fifo-product">
            <span>Product (optional)</span>
            <Select
              id="fifo-product"
              value={filters.productId}
              onChange={(e) => setFilters((prev) => ({ ...prev, productId: e.target.value }))}
              options={[{ value: '', label: 'All products' }, ...(meta.products || []).map((p) => ({ value: String(p.id), label: `${p.name} (${p.sku || 'N/A'})` }))]}
            />
          </label>

          <label className="form-field" htmlFor="fifo-from-date">
            <span>From date</span>
            <input
              id="fifo-from-date"
              type="date"
              value={filters.fromDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, fromDate: e.target.value }))}
            />
          </label>

          <label className="form-field" htmlFor="fifo-to-date">
            <span>To date</span>
            <input
              id="fifo-to-date"
              type="date"
              value={filters.toDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, toDate: e.target.value }))}
            />
          </label>

          <label className="form-field" htmlFor="fifo-only-open">
            <span>Show only open batches</span>
            <Select
              id="fifo-only-open"
              value={filters.onlyOpen ? 'true' : 'false'}
              onChange={(e) => setFilters((prev) => ({ ...prev, onlyOpen: e.target.value === 'true' }))}
              options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]}
            />
          </label>
        </div>

        <div className="inline-actions inline-actions--end no-print">
          <button type="button" className="primary-action-button" onClick={loadReport} disabled={loading}>
            {loading ? 'Loading…' : 'Generate Report'}
          </button>
        </div>

        {searched ? (
          <div className="print-area">
          <>
            <div className="totals-panel" style={{ maxWidth: 420 }}>
              <div className="totals-row">
                <span>Total Batches</span>
                <strong>{summary?.totalBatches || 0}</strong>
              </div>
              <div className="totals-row">
                <span>Verified</span>
                <strong>{summary?.verifiedBatches || 0}</strong>
              </div>
              <div className="totals-row">
                <span>Open Batches</span>
                <strong>{summary?.openBatches || 0}</strong>
              </div>
              <div className="totals-row due-row">
                <span>Mismatches</span>
                <strong>{verifyStats.mismatches} ({verifyStats.mismatchPct}%)</strong>
              </div>
            </div>

            <div className="table-wrap table-wrap--full">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Received</th>
                    <th>Product</th>
                    <th>Bill</th>
                    <th>Supplier</th>
                    <th className="text-right">Received Qty</th>
                    <th className="text-right">Returned Qty</th>
                    <th className="text-right">Remaining Qty</th>
                    <th className="text-right">Expected Qty</th>
                    <th className="text-right">Cost</th>
                    <th className="text-right">Sale</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>{formatDate(row.receivedDate)}</td>
                      <td>{row.productName} ({row.sku || 'N/A'})</td>
                      <td>{row.billNo}</td>
                      <td>{row.supplierName}</td>
                      <td className="text-right">{fmtQty(row.quantityReceived)}</td>
                      <td className="text-right">{fmtQty(row.returnedQty)}</td>
                      <td className="text-right">{fmtQty(row.quantityRemaining)}</td>
                      <td className="text-right">{fmtQty(row.expectedRemaining)}</td>
                      <td className="text-right">{fmtMoney(row.costPrice)}</td>
                      <td className="text-right">{fmtMoney(row.salePrice)}</td>
                      <td>
                        <span className={`badge ${row.verification?.isVerified ? 'badge--green' : 'badge--red'}`}>
                          {row.verification?.isVerified ? 'Verified' : 'Mismatch'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan="11" className="empty-state-cell">No FIFO batches found for selected filters.</td>
                    </tr>
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
