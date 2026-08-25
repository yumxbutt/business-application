import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageCard from '../components/ui/PageCard';
import { useAuth } from '../context/AuthContext';
import { productService } from '../services/productService';
import { contactService } from '../services/contactService';
import { financialService } from '../services/financialService';
import { settingsService } from '../services/settingsService';
import { downloadCsv } from '../utils/export';
import { Select } from '../ui-kit';
import { ledgerService } from '../services/ledgerService';
import PaymentSelector from '../components/PaymentSelector';

const today = new Date().toISOString().slice(0, 10);
const monthStart = today.slice(0, 7) + '-01';
const fmt = (n) => Number(n || 0).toFixed(2);
const fmtBal = (n) => {
  if (n === null || n === undefined) return '–';
  const v = Number(n);
  return Math.abs(v).toFixed(2) + (v >= 0 ? ' Dr' : ' Cr');
};
const fileSafe = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const fmtDate = (iso) => {
  if (!iso) return '\u2013';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Amount in words
const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tensArr = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
function twoDigits(n) { return n < 20 ? ones[n] : tensArr[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : ''); }
function threeDigits(n) { return n >= 100 ? ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + twoDigits(n % 100) : '') : twoDigits(n); }
function amountInWords(amount) {
  const n = Math.round(Number(amount || 0) * 100);
  const rupees = Math.floor(n / 100); const cents = n % 100;
  if (!rupees && !cents) return 'Zero Only';
  let w = '';
  if (rupees > 0) {
    const cr = Math.floor(rupees / 10000000);
    const lk = Math.floor((rupees % 10000000) / 100000);
    const th = Math.floor((rupees % 100000) / 1000);
    const rm = rupees % 1000;
    if (cr) w += threeDigits(cr) + ' Crore ';
    if (lk) w += threeDigits(lk) + ' Lakh ';
    if (th) w += threeDigits(th) + ' Thousand ';
    if (rm) w += threeDigits(rm);
    w = w.trim();
  }
  if (cents > 0) w += (w ? ' and ' : '') + twoDigits(cents) + ' Cents';
  return w.trim() + ' Only';
}

const blankForm = (branchId = '') => ({
  branchId, transactionType: 'receipt', contactId: '',
  amount: '', entryDate: today, referenceNo: '', description: '',
});

// ─── Modal overlay ──────────────────────────────────────────────────────────
function Modal({ children, onClose, wide }) {
  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={wide ? 'modal-box modal-box--wide' : 'modal-box'} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">&#x2715;</button>
        {children}
      </div>
    </div>
  );
}

// ─── Voucher Print ──────────────────────────────────────────────────────────
function VoucherPrint({ voucher, company, branchName, onClose }) {
  const printRef = useRef();
  const isReceipt = voucher.transactionType === 'receipt';
  const title = isReceipt ? 'CASH RECEIPT VOUCHER' : 'CASH PAYMENT VOUCHER';
  const partyLabel = isReceipt ? 'Received From' : 'Paid To';
  const hasBalanceSummary = voucher.previousBalance !== undefined && voucher.netBalance !== undefined;

  const css = [
    '*{box-sizing:border-box;margin:0;padding:0;font-family:\'Segoe UI\',Arial,sans-serif}',
    'body{background:#fff;padding:20px 24px}',
    '.vw{max-width:660px;margin:0 auto;border:2px solid #1e293b;border-radius:6px;overflow:hidden}',
    '.vh{background:#1e293b;color:#fff;padding:18px 24px;display:flex;align-items:center;gap:16px}',
    '.vlogo{width:60px;height:60px;object-fit:contain;border-radius:4px;background:#fff;padding:4px}',
    '.vlogop{width:60px;height:60px;border-radius:4px;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-size:26px}',
    '.vco{flex:1}.vco h1{font-size:19px;font-weight:700;letter-spacing:.4px}.vco p{font-size:11px;opacity:.78;margin-top:2px}',
    '.vtype{background:#334155;color:#e2e8f0;text-align:center;padding:9px;font-size:13px;font-weight:700;letter-spacing:3px}',
    '.vbody{padding:20px 26px}',
    '.vmeta{display:flex;justify-content:space-between;margin-bottom:14px;font-size:12px;color:#374151}',
    '.vmeta strong{font-size:13px;color:#111827;display:block}',
    '.vfield{margin-bottom:11px;padding-bottom:8px;border-bottom:1px dashed #d1d5db}',
    '.vfield label{font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:2px}',
    '.vfield .val{font-size:14px;color:#111827;font-weight:500}',
    '.abox{background:#f8fafc;border:1px solid #cbd5e1;border-radius:4px;padding:12px 18px;margin:14px 0}',
    '.abox .fig{font-size:24px;font-weight:700;color:#1e293b}',
    '.abox .wrd{font-size:11px;color:#64748b;margin-top:4px;font-style:italic}',
    '.vsig{display:flex;justify-content:space-between;margin-top:38px;padding-top:14px;font-size:11px;color:#374151}',
    '.vsig .sl{text-align:center;min-width:110px}.vsig .sl::before{content:\'\';display:block;border-top:1px solid #374151;margin-bottom:6px}',
    '.vfoot{background:#f8fafc;border-top:1px solid #e2e8f0;padding:9px 26px;font-size:10px;color:#64748b;text-align:center}',
    '@media print{body{padding:0}}',
  ].join('');

  const handlePrint = () => {
    const html = printRef.current ? printRef.current.innerHTML : '';
    if (!html) return;
    const win = window.open('', '_blank', 'width=760,height=680');
    win.document.write('<!DOCTYPE html><html><head><title>' + title + '</title><style>' + css + '</style></head><body>' + html + '</body></html>');
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  };

  return (
    <Modal onClose={onClose} wide>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{title} Preview</h3>
        <div className="inline-actions">
          <button type="button" className="primary-action-button" onClick={handlePrint}>&#128424; Print</button>
          <button type="button" className="secondary-action-button" onClick={onClose}>Close</button>
        </div>
      </div>
      <div ref={printRef}>
        <div className="vw" style={{ maxWidth: 660, margin: '0 auto', border: '2px solid #1e293b', borderRadius: 6, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ background: '#1e293b', color: '#fff', padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
            {company.logoUrl
              ? <img src={company.logoUrl} alt="logo" style={{ width: 60, height: 60, objectFit: 'contain', borderRadius: 4, background: '#fff', padding: 4 }} />
              : <div style={{ width: 60, height: 60, borderRadius: 4, background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>&#127962;</div>
            }
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 19, fontWeight: 700, letterSpacing: '.4px', margin: 0 }}>{company.companyName || 'Your Company'}</h1>
              {company.tagline && <p style={{ fontSize: 11, opacity: .78, marginTop: 2 }}>{company.tagline}</p>}
              {company.address && <p style={{ fontSize: 11, opacity: .78, marginTop: 2 }}>{company.address}</p>}
              {company.phone && <p style={{ fontSize: 11, opacity: .78, marginTop: 2 }}>Tel: {company.phone}</p>}
              {company.email && <p style={{ fontSize: 11, opacity: .78, marginTop: 2 }}>{company.email}</p>}
            </div>
          </div>
          {/* Type bar */}
          <div style={{ background: '#334155', color: '#e2e8f0', textAlign: 'center', padding: 9, fontSize: 13, fontWeight: 700, letterSpacing: 3 }}>{title}</div>
          {/* Body */}
          <div style={{ padding: '20px 26px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14, fontSize: 12 }}>
              <div>
                <span style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase' }}>Voucher No.</span>
                <strong style={{ display: 'block', fontSize: 13, color: '#111827' }}>{voucher.referenceNo || '\u2013'}</strong>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase' }}>Date</span>
                <strong style={{ display: 'block', fontSize: 13, color: '#111827' }}>{fmtDate(voucher.entryDate)}</strong>
              </div>
            </div>

            <div style={{ marginBottom: 11, paddingBottom: 8, borderBottom: '1px dashed #d1d5db' }}>
              <label style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Branch</label>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{branchName}</div>
            </div>
            <div style={{ marginBottom: 11, paddingBottom: 8, borderBottom: '1px dashed #d1d5db' }}>
              <label style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>{partyLabel}</label>
              <div style={{ fontSize: 14, fontWeight: 500 }}>
                {voucher.contact ? voucher.contact.name : '\u2013'}
                {voucher.contact && voucher.contact.phone && <span style={{ color: '#6b7280', fontSize: 12 }}> | {voucher.contact.phone}</span>}
              </div>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 4, padding: '12px 18px', margin: '14px 0' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#1e293b' }}>{fmt(voucher.amount)}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, fontStyle: 'italic' }}>{amountInWords(voucher.amount)}</div>
            </div>

            {hasBalanceSummary ? (
              <div style={{ marginBottom: 11, paddingBottom: 8, borderBottom: '1px dashed #d1d5db' }}>
                <label style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Balance Summary</label>
                <div style={{ fontSize: 13, fontWeight: 500 }}>Previous: {fmtBal(voucher.previousBalance)}</div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>Net: {fmtBal(voucher.netBalance)}</div>
              </div>
            ) : null}

            {voucher.paymentSplits && voucher.paymentSplits.length > 0 && (
              <div style={{ marginBottom: 11, paddingBottom: 8, borderBottom: '1px dashed #d1d5db' }}>
                <label style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Payment Method(s)</label>
                {voucher.paymentSplits.map((s, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 500, padding: '2px 0' }}>
                    <span>{s.name || 'Cash'}{s.accountType === 'bank' && s.bankName ? ` (${s.bankName})` : ''}</span>
                    <span>{fmt(s.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            {voucher.description && (
              <div style={{ marginBottom: 11, paddingBottom: 8, borderBottom: '1px dashed #d1d5db' }}>
                <label style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Narration</label>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{voucher.description}</div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 38, paddingTop: 14, fontSize: 11 }}>
              {['Prepared By', 'Authorized By', 'Received By'].map((l) => (
                <div key={l} style={{ textAlign: 'center', minWidth: 110 }}>
                  <div style={{ borderTop: '1px solid #374151', marginBottom: 6 }} />
                  {l}
                </div>
              ))}
            </div>
          </div>
          {company.footerNote && (
            <div style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '9px 26px', fontSize: 10, color: '#64748b', textAlign: 'center' }}>{company.footerNote}</div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─── Confirm Dialog ─────────────────────────────────────────────────────────
function ConfirmDialog({ form, contacts, branchName, onConfirm, onCancel, saving, ledgerBalance }) {
  const contact = contacts.find((c) => String(c.id) === String(form.contactId));
  const isReceipt = form.transactionType === 'receipt';
  const afterBalance = ledgerBalance !== null
    ? (isReceipt ? ledgerBalance - Number(form.amount || 0) : ledgerBalance + Number(form.amount || 0))
    : null;
  const rows = [
    ['Type', isReceipt ? 'Cash Receipt (CRV)' : 'Cash Payment (CPV)'],
    ['Branch', branchName],
    ['Contact', contact ? contact.name : '\u2013'],
    ['Date', fmtDate(form.entryDate)],
    ['Amount', fmt(form.amount)],
    ['In Words', amountInWords(form.amount)],
    ...(ledgerBalance !== null ? [
      ['Balance Before', fmtBal(ledgerBalance)],
      ['Balance After', fmtBal(afterBalance)],
    ] : []),
    ['Reference', form.referenceNo || 'Auto-generated'],
    ['Narration', form.description || '\u2013'],
  ];
  return (
    <Modal onClose={onCancel}>
      <h3 style={{ fontWeight: 700, marginBottom: 14 }}>Confirm Voucher</h3>
      <p className="view-note" style={{ marginBottom: 12 }}>Please review before saving. This will post to the ledger.</p>
      <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '7px 4px', color: '#6b7280', fontWeight: 600, width: '40%' }}>{label}</td>
              <td style={{ padding: '7px 4px', fontWeight: 500 }}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="inline-actions inline-actions--end" style={{ marginTop: 18 }}>
        <button type="button" className="secondary-action-button" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="button" className="primary-action-button" onClick={onConfirm} disabled={saving}>
          {saving ? 'Processing\u2026' : 'Confirm & Save'}
        </button>
      </div>
    </Modal>
  );
}

// ─── Voucher Form Modal ──────────────────────────────────────────────────────
function VoucherFormModal({ form, setForm, branches, contacts, loadingContacts, user, onClose, onSubmit, ledgerBalance, loadingLedger }) {
  const isAdmin = !user || user.role === 'main_admin';
  const amount = Number(form.amount || 0);
  const netBalance = ledgerBalance !== null
    ? (form.transactionType === 'receipt' ? ledgerBalance - amount : ledgerBalance + amount)
    : null;
  return (
    <Modal onClose={onClose} wide>
      <h3 style={{ fontWeight: 700, marginBottom: 14, fontSize: '1rem' }}>New Voucher</h3>
      <form onSubmit={onSubmit}>
        <div className="table-filters">
          {isAdmin && (
            <label className="form-field" htmlFor="vf-branch">
              <span>Branch</span>
              <Select
                id="vf-branch"
                value={form.branchId}
                required
                onChange={(e) => setForm((p) => ({ ...p, branchId: e.target.value, contactId: '' }))}
                options={[{ value: '', label: '-- Select branch --' }, ...(branches || []).map((b) => ({ value: String(b.id), label: b.name }))]}
              />
            </label>
          )}
          <label className="form-field" htmlFor="vf-type">
            <span>Voucher Type</span>
            <Select
              id="vf-type"
              value={form.transactionType}
              onChange={(e) => setForm((p) => ({ ...p, transactionType: e.target.value, contactId: '' }))}
              options={[{ value: 'receipt', label: 'Cash Receipt (CRV)' }, { value: 'payment', label: 'Cash Payment (CPV)' }]}
            />
          </label>
          <label className="form-field" htmlFor="vf-contact">
            <span>{form.transactionType === 'receipt' ? 'Customer (Received From)' : 'Supplier (Paid To)'}</span>
            <Select
              id="vf-contact"
              value={form.contactId}
              required
              disabled={loadingContacts || !form.branchId}
              onChange={(e) => setForm((p) => ({ ...p, contactId: e.target.value }))}
              options={[{ value: '', label: '-- Select contact --' }, ...(contacts || []).map((c) => ({ value: String(c.id), label: c.name }))]}
            />
          </label>
          {form.contactId ? (
            <div style={{ gridColumn: '1 / -1', padding: '9px 13px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 4, fontSize: '0.82rem', lineHeight: '1.6' }}>
              {loadingLedger
                ? <span style={{ color: '#6b7280' }}>Loading balance…</span>
                : ledgerBalance !== null
                  ? <span>
                      <span style={{ color: '#6b7280' }}>Current Balance: </span>
                      <strong style={{ color: ledgerBalance >= 0 ? '#15803d' : '#dc2626' }}>{fmtBal(ledgerBalance)}</strong>
                      {amount > 0 && netBalance !== null && (
                        <span style={{ marginLeft: 24 }}>
                          <span style={{ color: '#6b7280' }}>After this {form.transactionType === 'receipt' ? 'receipt' : 'payment'}: </span>
                          <strong style={{ color: netBalance >= 0 ? '#15803d' : '#dc2626' }}>{fmtBal(netBalance)}</strong>
                        </span>
                      )}
                    </span>
                  : <span style={{ color: '#6b7280' }}>Balance unavailable</span>
              }
            </div>
          ) : null}
          <label className="form-field" htmlFor="vf-date">
            <span>Date</span>
            <input id="vf-date" type="date" value={form.entryDate} required
              onChange={(e) => setForm((p) => ({ ...p, entryDate: e.target.value }))} />
          </label>
          <label className="form-field" htmlFor="vf-amount">
            <span>Amount</span>
            <input id="vf-amount" type="number" min="0.01" step="0.01" value={form.amount} required
              onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} />
          </label>

          {Number(form.amount) > 0 && (
            <PaymentSelector
              totalAmount={Number(form.amount)}
              branchId={form.branchId ? Number(form.branchId) : (user?.branchId ? Number(user.branchId) : undefined)}
              onChange={setVoucherPayments}
              disabled={saving}
              label="Payment Account"
            />
          )}
          <label className="form-field" htmlFor="vf-ref">
            <span>Reference No. (optional)</span>
            <input id="vf-ref" type="text" value={form.referenceNo}
              placeholder="Auto-generated if blank"
              onChange={(e) => setForm((p) => ({ ...p, referenceNo: e.target.value }))} />
          </label>
          <label className="form-field" htmlFor="vf-desc">
            <span>Narration</span>
            <input id="vf-desc" type="text" value={form.description}
              placeholder="Voucher narration"
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          </label>
        </div>
        {form.amount ? (
          <p className="view-note" style={{ marginTop: 8 }}>
            In Words: <em>{amountInWords(form.amount)}</em>
          </p>
        ) : null}
        <div className="inline-actions inline-actions--end" style={{ marginTop: 14 }}>
          <button type="button" className="secondary-action-button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary-action-button">Review &amp; Confirm</button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function CashVoucherPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [generatedOn] = useState(() =>
    new Date().toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    })
  );
  const [branches, setBranches] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [company, setCompany] = useState({});
  const defaultBranchId = user ? (user.role === 'main_admin' ? '' : String(user.branchId || '')) : '';
  const [form, setForm] = useState(() => blankForm(defaultBranchId));
  const [filters, setFilters] = useState({
    branchId: defaultBranchId,
    transactionType: 'all',
    startDate: monthStart,
    endDate: today,
  });
  const [rows, setRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [saving, setSaving] = useState(false);
  const [voucherPayments, setVoucherPayments] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [printVoucher, setPrintVoucher] = useState(null);
  const [error, setError] = useState('');
  const [ledgerBalance, setLedgerBalance] = useState(null);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const deepLinkHandled = useRef(false);

  const activeBranchId = useMemo(() => form.branchId || filters.branchId, [form.branchId, filters.branchId]);
  const selectedBranchName = useMemo(() => {
    const id = filters.branchId || form.branchId;
    const found = branches.find((b) => String(b.id) === String(id));
    if (found) return found.name;
    if (user && user.role !== 'main_admin') return 'Branch-' + (user.branchId || 'NA');
    return 'Branch-' + (id || 'NA');
  }, [branches, filters.branchId, form.branchId, user]);

  useEffect(() => {
    if (deepLinkHandled.current) return;
    const type = searchParams.get('type');
    const openNew = searchParams.get('new') === '1';
    if (type !== 'receipt' && type !== 'payment') return;

    deepLinkHandled.current = true;
    const branchId = filters.branchId || defaultBranchId;
    setForm({ ...blankForm(branchId), transactionType: type });
    if (openNew) setShowForm(true);
    setSearchParams({}, { replace: true });
  }, [searchParams, filters.branchId, defaultBranchId, setSearchParams]);

  useEffect(() => {
    settingsService.getCompanySettings().then(setCompany).catch(() => {});
    if (!user || user.role !== 'main_admin') return;
    productService.getMeta().then((meta) => {
      const list = meta.branches || [];
      setBranches(list);
      if (!form.branchId && list[0]) {
        const id = String(list[0].id);
        setForm((p) => ({ ...p, branchId: id }));
        setFilters((p) => ({ ...p, branchId: id }));
      }
    }).catch(() => {});
  }, [user ? user.role : null]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeBranchId) { setContacts([]); return; }
    setLoadingContacts(true);
    contactService.getContacts({ branchId: Number(activeBranchId), recordType: 'all', isActive: 'active' })
      .then(setContacts).catch(() => {}).finally(() => setLoadingContacts(false));
  }, [activeBranchId]);

  useEffect(() => {
    if (!form.contactId) { setLedgerBalance(null); return; }
    setLoadingLedger(true);
    ledgerService.getContactLedger(
      form.contactId,
      form.branchId ? { branchId: Number(form.branchId) } : {},
    ).then((data) => {
      const entries = data.entries || [];
      const last = entries[entries.length - 1];
      setLedgerBalance(last ? Number(last.runningBalance || 0) : 0);
    }).catch(() => setLedgerBalance(null))
      .finally(() => setLoadingLedger(false));
  }, [form.contactId, form.branchId]);

  const loadRows = async () => {
    const bid = filters.branchId || (user && user.role !== 'main_admin' ? String(user.branchId || '') : '');
    if (!bid) return;
    setLoadingRows(true); setError('');
    try {
      const data = await financialService.getCashVouchers({
        branchId: Number(bid),
        transactionType: filters.transactionType,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      });
      setRows(data);
    } catch (e) { setError(e.message || 'Failed to load vouchers'); }
    finally { setLoadingRows(false); }
  };

  useEffect(() => { loadRows(); }, [filters.branchId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFormSubmit = (e) => { e.preventDefault(); setError(''); setShowConfirm(true); };

  const handleConfirm = async () => {
    setSaving(true); setError('');
    try {
      const result = await financialService.createCashVoucher({
        branchId: Number(form.branchId),
        contactId: Number(form.contactId),
        transactionType: form.transactionType,
        amount: Number(form.amount),
        entryDate: form.entryDate,
        referenceNo: form.referenceNo || undefined,
        description: form.description || undefined,
        payments: Number(form.amount) > 0 ? voucherPayments : [],
      });
      const contact = contacts.find((c) => String(c.id) === String(form.contactId));
      const saved = result.paymentTransaction || result;
      // Show print dialog immediately after save
      setPrintVoucher({
        ...saved,
        contact: result.contact || contact,
        transactionType: form.transactionType,
        amount: form.amount,
        entryDate: form.entryDate,
        description: form.description,
        referenceNo: saved.referenceNo || form.referenceNo,
        previousBalance: ledgerBalance,
        netBalance: ledgerBalance !== null
          ? (form.transactionType === 'receipt' ? ledgerBalance - Number(form.amount || 0) : ledgerBalance + Number(form.amount || 0))
          : undefined,
        paymentSplits: result.paymentSplits || voucherPayments.filter((p) => Number(p.amount) > 0).map((p) => ({
          name: p.accountName || p.name || 'Cash',
          accountType: p.accountType || 'cash',
          bankName: p.bankName || null,
          amount: Number(p.amount),
        })),
      });
      setShowConfirm(false);
      setShowForm(false);
      setForm(blankForm(form.branchId));
      setVoucherPayments([]);
      setFilters((p) => ({ ...p, branchId: form.branchId }));
      await loadRows();
    } catch (e) { setError(e.message || 'Failed to save voucher'); }
    finally { setSaving(false); }
  };

  const totalReceipt = rows.filter((r) => r.transactionType === 'receipt').reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalPayment = rows.filter((r) => r.transactionType === 'payment').reduce((s, r) => s + Number(r.amount || 0), 0);

  const exportExcel = () => {
    const csvRows = [
      ['Voucher Report'], ['Branch', selectedBranchName],
      ['Date Range', (filters.startDate || '-') + ' to ' + (filters.endDate || '-')],
      ['Generated On', generatedOn], ['Generated By', user ? (user.fullName || user.username || 'System') : 'System'],
      ['Total Receipts', fmt(totalReceipt)], ['Total Payments', fmt(totalPayment)],
      ['Net', fmt(totalReceipt - totalPayment)], [],
      ['Date', 'Voucher No.', 'Type', 'Contact', 'Description', 'Amount'],
      ...rows.map((r) => [r.entryDate, r.referenceNo || '-',
        r.transactionType === 'receipt' ? 'Receipt' : 'Payment',
        r.contact ? r.contact.name : '-', r.description || '-', fmt(r.amount)]),
    ];
    downloadCsv(csvRows, 'vouchers-' + fileSafe(selectedBranchName) + '-' + (filters.startDate || 'from') + '-to-' + (filters.endDate || 'to') + '.csv');
  };

  return (
    <div className="dashboard-stack">
      <div className="page-stats-strip no-print">
        <div className="page-stat-tile">
          <span className="page-stat-tile__label">Total Vouchers</span>
          <span className="page-stat-tile__value">{rows.length}</span>
        </div>
        <div className="page-stat-tile page-stat-tile--success">
          <span className="page-stat-tile__label">Total Receipts</span>
          <span className="page-stat-tile__value">{totalReceipt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div className="page-stat-tile page-stat-tile--danger">
          <span className="page-stat-tile__label">Total Payments</span>
          <span className="page-stat-tile__value">{totalPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div className={`page-stat-tile ${totalReceipt - totalPayment >= 0 ? 'page-stat-tile--primary' : 'page-stat-tile--warning'}`}>
          <span className="page-stat-tile__label">Net</span>
          <span className="page-stat-tile__value">{(totalReceipt - totalPayment).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      </div>
      {showForm && !showConfirm && (
        <VoucherFormModal form={form} setForm={setForm} branches={branches}
          contacts={contacts} loadingContacts={loadingContacts} user={user}
          onClose={() => setShowForm(false)} onSubmit={handleFormSubmit}
          ledgerBalance={ledgerBalance} loadingLedger={loadingLedger} />
      )}
      {showConfirm && (
        <ConfirmDialog form={form} contacts={contacts} branchName={selectedBranchName}
          onConfirm={handleConfirm} onCancel={() => setShowConfirm(false)} saving={saving}
          ledgerBalance={ledgerBalance} />
      )}
      {printVoucher && (
        <VoucherPrint voucher={printVoucher} company={company}
          branchName={selectedBranchName} onClose={() => setPrintVoucher(null)} />
      )}

      <PageCard title="Vouchers" subtitle="Cash receipt and payment vouchers"
        actions={
          <div className="inline-actions">
            <button type="button" className="primary-action-button"
              onClick={() => { setForm(blankForm(filters.branchId || defaultBranchId)); setShowForm(true); }}>
              + New Voucher
            </button>
            <button type="button" className="secondary-action-button" onClick={exportExcel} disabled={!rows.length}>
              Export Excel
            </button>
          </div>
        }
      >
        {error && <p className="error-text">{error}</p>}

        <div className="table-filters no-print">
          {user && user.role === 'main_admin' && (
            <label className="form-field" htmlFor="cv-branch">
              <span>Branch</span>
              <select id="cv-branch" value={filters.branchId}
                onChange={(e) => setFilters((p) => ({ ...p, branchId: e.target.value }))}>
                <option value="">-- Select branch --</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
          )}
          <label className="form-field" htmlFor="cv-ftype">
            <span>Type</span>
            <select id="cv-ftype" value={filters.transactionType}
              onChange={(e) => setFilters((p) => ({ ...p, transactionType: e.target.value }))}>
              <option value="all">All</option>
              <option value="receipt">Receipt (CRV)</option>
              <option value="payment">Payment (CPV)</option>
            </select>
          </label>
          <label className="form-field" htmlFor="cv-from">
            <span>From</span>
            <input id="cv-from" type="date" value={filters.startDate}
              onChange={(e) => setFilters((p) => ({ ...p, startDate: e.target.value }))} />
          </label>
          <label className="form-field" htmlFor="cv-to">
            <span>To</span>
            <input id="cv-to" type="date" value={filters.endDate}
              onChange={(e) => setFilters((p) => ({ ...p, endDate: e.target.value }))} />
          </label>
        </div>

        <div className="inline-actions inline-actions--end no-print">
          <button type="button" className="secondary-action-button" onClick={loadRows} disabled={loadingRows}>
            {loadingRows ? 'Loading\u2026' : 'Load / Refresh'}
          </button>
        </div>

        <div className="totals-panel" style={{ maxWidth: 380 }}>
          <div className="totals-row"><span>Total Receipts (CRV)</span><strong className="ledger-debit">{fmt(totalReceipt)}</strong></div>
          <div className="totals-row"><span>Total Payments (CPV)</span><strong className="ledger-credit">{fmt(totalPayment)}</strong></div>
          <div className="totals-row totals-row--total"><span>Net</span><strong>{fmt(totalReceipt - totalPayment)}</strong></div>
        </div>

        <div className="table-wrap table-wrap--full">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th><th>Voucher No.</th><th>Type</th>
                <th>Contact</th><th>Description</th>
                <th className="text-right">Amount</th><th>Print</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{fmtDate(row.entryDate)}</td>
                  <td>{row.referenceNo || '\u2013'}</td>
                  <td>
                    <span className={'badge ' + (row.transactionType === 'receipt' ? 'badge--green' : 'badge--red')}>
                      {row.transactionType === 'receipt' ? 'Receipt' : 'Payment'}
                    </span>
                  </td>
                  <td>{row.contact ? row.contact.name : '\u2013'}</td>
                  <td>{row.description || '\u2013'}</td>
                  <td className={'text-right ' + (row.transactionType === 'receipt' ? 'ledger-debit' : 'ledger-credit')}>
                    {fmt(row.amount)}
                  </td>
                  <td>
                    <button type="button" style={{ padding: '2px 10px', fontSize: '0.78rem' }}
                      className="secondary-action-button"
                      onClick={() => setPrintVoucher({ ...row, transactionType: row.transactionType })}>
                      Print
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan="7" className="empty-state-cell">No vouchers found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </PageCard>
    </div>
  );
}