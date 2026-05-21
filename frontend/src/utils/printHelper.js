/**
 * Shared branded print utility — same styling as Cash Voucher printout.
 * All report prints use this to get a consistent company-headed layout.
 */

const PRINT_CSS = `
*{box-sizing:border-box;margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif}
body{background:#fff;padding:20px 24px;font-size:12px;color:#111827}
.ph{background:#1f2937;color:#fff;padding:16px 22px;display:flex;align-items:center;gap:14px;margin-bottom:0}
.ph-logo{width:58px;height:58px;object-fit:contain;border-radius:4px;background:#fff;padding:3px}
.ph-logop{width:58px;height:58px;border-radius:4px;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;font-size:26px}
.ph-co{flex:1}.ph-co h1{font-size:18px;font-weight:700;letter-spacing:.4px;margin:0}.ph-co p{font-size:10px;opacity:.8;margin-top:2px}
.pt{background:#374151;color:#e5e7eb;text-align:center;padding:8px;font-size:12px;font-weight:700;letter-spacing:2px}
.pm{padding:14px 22px 6px;display:flex;flex-wrap:wrap;gap:8px 32px;border-bottom:1px solid #e5e7eb;margin-bottom:12px}
.pm-field{min-width:140px}.pm-field .lbl{font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:1px}
.pm-field .val{font-size:12px;font-weight:600;color:#111827}
.pb{padding:0 22px 20px}
table{width:100%;border-collapse:collapse;font-size:11px;margin-top:8px}
thead th{background:#f3f4f6;padding:6px 8px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:#374151;border-bottom:2px solid #d1d5db}
thead th.tr{text-align:right}
tbody td{padding:5px 8px;border-bottom:1px solid #f0f0f0;vertical-align:top}
tbody td.tr{text-align:right}
.cr{color:#16a34a;font-weight:600}.dr{color:#dc2626;font-weight:600}.mt{color:#6b7280}
tfoot td{padding:6px 8px;font-weight:700;border-top:2px solid #d1d5db;background:#f9fafb}
tfoot td.tr{text-align:right}
.tot{margin:12px 0 0;border:1px solid #e5e7eb;border-radius:4px;overflow:hidden;display:inline-block;min-width:260px}
.tot-row{display:flex;justify-content:space-between;padding:5px 12px;border-bottom:1px solid #f0f0f0;font-size:11px}
.tot-row:last-child{border-bottom:none;font-weight:700;background:#f9fafb}
.badge{display:inline-block;padding:1px 7px;border-radius:10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.4px}
.badge-g{background:#dcfce7;color:#16a34a}.badge-r{background:#fee2e2;color:#dc2626}.badge-b{background:#e0e7ff;color:#4338ca}
.day-hdr{background:#f8fafc;border:1px solid #e5e7eb;border-radius:4px;padding:6px 10px;margin:14px 0 4px;display:flex;justify-content:space-between;font-size:11px;font-weight:700}
.split{display:flex;gap:10px}
.split > div{flex:1;min-width:0}
.sig{display:flex;justify-content:space-between;margin-top:32px;padding-top:10px;font-size:10px;color:#374151}
.sig .sl{text-align:center;min-width:110px}.sig .sl::before{content:'';display:block;border-top:1px solid #374151;margin-bottom:5px}
.pfoot{background:#f9fafb;border-top:1px solid #e5e7eb;padding:8px 22px;font-size:9px;color:#6b7280;text-align:center}
@media print{body{padding:0}button{display:none}}
`;

/**
 * Build the company header HTML (logo + name + details).
 * @param {object} company - from settingsService
 */
function buildHeader(company) {
  const logo = company && company.logoUrl
    ? `<img src="${company.logoUrl}" alt="logo" class="ph-logo" />`
    : `<div class="ph-logop">&#127962;</div>`;
  const name = (company && company.companyName) ? company.companyName : 'Your Company';
  const tagline = (company && company.tagline) ? `<p>${company.tagline}</p>` : '';
  const address = (company && company.address) ? `<p>${company.address}</p>` : '';
  const phone = (company && company.phone) ? `<p>Tel: ${company.phone}</p>` : '';
  const email = (company && company.email) ? `<p>${company.email}</p>` : '';
  return `<div class="ph">${logo}<div class="ph-co"><h1>${name}</h1>${tagline}${address}${phone}${email}</div></div>`;
}

/**
 * Build meta row (date range, branch, generated on, etc.)
 * @param {Array<[string,string]>} fields - array of [label, value] pairs
 */
function buildMeta(fields) {
  const items = fields.map(([lbl, val]) =>
    `<div class="pm-field"><span class="lbl">${lbl}</span><span class="val">${val || '–'}</span></div>`
  ).join('');
  return `<div class="pm">${items}</div>`;
}

/**
 * Open a new print window with branded layout.
 * @param {string} title - document title (shown in title bar of print window)
 * @param {string} titleBar - text for the dark title stripe
 * @param {object} company - company settings
 * @param {Array<[string,string]>} metaFields - label/value pairs for the meta row
 * @param {string} bodyHtml - the main content HTML (tables, sections, etc.)
 * @param {string} [footNote] - optional override; defaults to company.footerNote
 * @param {boolean} [showSignatures] - show Prepared/Authorized/Received signature row
 */
export function openPrintWindow({
  title,
  titleBar,
  company = {},
  metaFields = [],
  bodyHtml = '',
  footNote,
  showSignatures = false,
}) {
  const header = buildHeader(company);
  const meta = metaFields.length ? buildMeta(metaFields) : '';
  const footer = (footNote || (company && company.footerNote))
    ? `<div class="pfoot">${footNote || company.footerNote}</div>`
    : '';
  const sigs = showSignatures
    ? `<div class="sig"><div class="sl">Prepared By</div><div class="sl">Authorized By</div><div class="sl">Received By</div></div>`
    : '';

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>${PRINT_CSS}</style></head><body>
${header}
<div class="pt">${titleBar}</div>
${meta}
<div class="pb">${bodyHtml}${sigs}</div>
${footer}
</body></html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 450);
}

/** Format a date ISO string to readable format */
export function fmtPrintDate(iso) {
  if (!iso) return '–';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Format number to 2 dp */
export function fmtNum(n) {
  return Number(n || 0).toFixed(2);
}
