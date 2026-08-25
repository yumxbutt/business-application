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

  const printViaIframeFallback = () => {
    const frame = document.createElement('iframe');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    frame.setAttribute('aria-hidden', 'true');

    const cleanup = () => {
      try {
        frame.remove();
      } catch {
        // no-op
      }
    };

    frame.onload = () => {
      try {
        const frameWin = frame.contentWindow;
        if (!frameWin) {
          cleanup();
          return;
        }

        frameWin.onafterprint = cleanup;
        frameWin.focus();
        setTimeout(() => {
          try {
            frameWin.print();
          } finally {
            setTimeout(cleanup, 2000);
          }
        }, 120);
      } catch {
        cleanup();
      }
    };

    frame.srcdoc = html;
    document.body.appendChild(frame);
  };

  if (!win) {
    printViaIframeFallback();
    return;
  }

  try {
    win.document.open();
    win.document.write(html);
    win.document.close();
  } catch {
    try {
      win.close();
    } catch {
      // no-op
    }
    printViaIframeFallback();
    return;
  }

  let hasPrinted = false;

  const triggerPrint = () => {
    if (hasPrinted) return;
    hasPrinted = true;
    try {
      win.focus();
      win.print();
    } catch {
      // no-op
    }
  };

  if (win.document?.readyState === 'complete') {
    setTimeout(triggerPrint, 200);
  } else {
    win.onload = () => setTimeout(triggerPrint, 200);
  }

  // Fallback if load event does not fire on some browsers/webviews.
  setTimeout(triggerPrint, 1200);

  // If popup prints fail/blank, fallback to iframe print in current window context.
  setTimeout(() => {
    if (!hasPrinted) {
      printViaIframeFallback();
    }
  }, 1800);
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

const POS_RECEIPT_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Courier New',Courier,monospace;font-size:12px;color:#111;background:#fff;padding:8px}
.wrap{width:72mm;max-width:100%;margin:0 auto}
.center{text-align:center}
.muted{color:#555;font-size:11px}
.hr{border:0;border-top:1px dashed #333;margin:8px 0}
.co{font-size:15px;font-weight:700;letter-spacing:.3px}
.meta{font-size:11px;line-height:1.45}
.meta div{display:flex;justify-content:space-between;gap:8px}
table{width:100%;border-collapse:collapse;font-size:11px}
th,td{padding:2px 0;vertical-align:top}
th{text-align:left;border-bottom:1px solid #333;font-weight:700}
td.tr,th.tr{text-align:right}
.item-name{font-weight:600}
.tot{margin-top:6px;font-size:12px}
.tot-row{display:flex;justify-content:space-between;padding:1px 0}
.tot-row.grand{font-size:14px;font-weight:700;margin-top:4px;border-top:1px dashed #333;padding-top:6px}
.thanks{margin-top:10px;text-align:center;font-size:11px}
@media print{
  @page{size:80mm auto;margin:4mm}
  body{padding:0}
}
`;

/**
 * Open a narrow thermal-style POS receipt and trigger print.
 */
export function openPosReceiptWindow({
  company = {},
  invoiceNo,
  saleDate,
  branchName,
  customerName,
  cashierName,
  items = [],
  subTotal,
  discount,
  taxMode,
  taxRate,
  taxAmount,
  totalAmount,
  paidAmount,
}) {
  const companyName = company.companyName || 'Your Company';
  const address = company.address ? `<div class="muted">${company.address}</div>` : '';
  const phone = company.phone ? `<div class="muted">Tel: ${company.phone}</div>` : '';
  const taxLine = Number(taxAmount || 0) > 0
    ? `<div class="tot-row"><span>Tax (${fmtNum(taxRate)}%)</span><span>${fmtNum(taxAmount)}</span></div>`
    : `<div class="tot-row"><span>Tax</span><span>No Tax</span></div>`;

  const rows = (items || [])
    .map((item) => {
      const name = item.product?.name || item.productName || 'Item';
      const qty = fmtNum(item.quantity ?? item.unitQty);
      const rate = fmtNum(item.unitPrice);
      const amount = fmtNum(item.lineAmount ?? Number(item.quantity || 0) * Number(item.unitPrice || 0));
      return `<tr>
        <td colspan="3"><div class="item-name">${name}</div></td>
      </tr>
      <tr>
        <td>${qty} x ${rate}</td>
        <td></td>
        <td class="tr">${amount}</td>
      </tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt ${invoiceNo || ''}</title>
<style>${POS_RECEIPT_CSS}</style></head><body>
<div class="wrap">
  <div class="center">
    <div class="co">${companyName}</div>
    ${address}${phone}
    <div style="margin-top:6px;font-weight:700">SALES RECEIPT</div>
  </div>
  <hr class="hr" />
  <div class="meta">
    <div><span>Invoice</span><span>${invoiceNo || '–'}</span></div>
    <div><span>Date</span><span>${fmtPrintDate(saleDate)}</span></div>
    <div><span>Branch</span><span>${branchName || '–'}</span></div>
    <div><span>Customer</span><span>${customerName || '–'}</span></div>
    <div><span>Cashier</span><span>${cashierName || '–'}</span></div>
    <div><span>Tax Mode</span><span>${taxMode === 'cash_tax' ? 'Cash Tax' : taxMode === 'card_tax' ? 'Card Tax' : 'No Tax'}</span></div>
  </div>
  <hr class="hr" />
  <table>
    <thead><tr><th>Item</th><th></th><th class="tr">Amt</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="3">No items</td></tr>'}</tbody>
  </table>
  <div class="tot">
    <div class="tot-row"><span>Subtotal</span><span>${fmtNum(subTotal)}</span></div>
    <div class="tot-row"><span>Discount</span><span>${fmtNum(discount)}</span></div>
    ${taxLine}
    <div class="tot-row grand"><span>TOTAL</span><span>${fmtNum(totalAmount)}</span></div>
    <div class="tot-row"><span>Paid</span><span>${fmtNum(paidAmount)}</span></div>
  </div>
  <hr class="hr" />
  <div class="thanks">${company.footerNote || 'Thank you for your purchase'}</div>
</div>
</body></html>`;

  const win = window.open('', '_blank', 'width=420,height=640');
  const printViaIframeFallback = () => {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    frame.setAttribute('aria-hidden', 'true');
    const cleanup = () => {
      try {
        frame.remove();
      } catch {
        // no-op
      }
    };
    frame.onload = () => {
      try {
        const frameWin = frame.contentWindow;
        if (!frameWin) {
          cleanup();
          return;
        }
        frameWin.onafterprint = cleanup;
        frameWin.focus();
        setTimeout(() => {
          try {
            frameWin.print();
          } finally {
            setTimeout(cleanup, 2000);
          }
        }, 120);
      } catch {
        cleanup();
      }
    };
    frame.srcdoc = html;
    document.body.appendChild(frame);
  };

  if (!win) {
    printViaIframeFallback();
    return;
  }

  try {
    win.document.open();
    win.document.write(html);
    win.document.close();
  } catch {
    try {
      win.close();
    } catch {
      // no-op
    }
    printViaIframeFallback();
    return;
  }

  let hasPrinted = false;
  const triggerPrint = () => {
    if (hasPrinted) return;
    hasPrinted = true;
    try {
      win.focus();
      win.print();
    } catch {
      // no-op
    }
  };

  if (win.document?.readyState === 'complete') {
    setTimeout(triggerPrint, 200);
  } else {
    win.onload = () => setTimeout(triggerPrint, 200);
  }
  setTimeout(triggerPrint, 1200);
}

const KITCHEN_TOKEN_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{
  height:auto!important;margin:0;padding:0;background:#fff;color:#111;
  font-family:'Courier New',Courier,monospace;font-size:12px;
}
.token{
  width:72mm;max-width:100%;
  margin:0 auto;
  padding:4px 6px 2px;
  height:auto;
  overflow:visible;
  page-break-inside:avoid;
  break-inside:avoid;
}
.page-break{
  display:block;
  width:100%;
  height:0;
  margin:0;
  padding:0;
  border:0;
  page-break-after:always;
  break-after:page;
}
.center{text-align:center}
.hr{border:0;border-top:1px dashed #333;margin:4px 0}
.stage{display:inline-block;border:2px solid #111;padding:1px 6px;font-weight:700;letter-spacing:.04em;font-size:11px}
.meta{font-size:11px;line-height:1.35}
.meta div{display:flex;justify-content:space-between;gap:6px}
.item{margin:6px 0;text-align:center}
.item-name{font-size:16px;font-weight:700;line-height:1.2}
.item-qty{margin-top:4px;font-size:24px;font-weight:700;line-height:1}
.item-unit{font-size:11px;color:#444;margin-top:2px}
.footer{margin-top:4px;text-align:center;font-size:10px;color:#444}
.cut-feed{
  margin-top:8px;
  padding-top:6px;
  border-top:2px dashed #111;
  text-align:center;
  font-size:10px;
  font-weight:700;
  letter-spacing:.06em;
  /* Extra feed so thermal cutter reaches cut position after text */
  min-height:12mm;
}
@media print{
  html,body{height:auto!important;margin:0!important;padding:0!important}
  /* One short page per token so thermal driver cuts individually */
  @page{size:80mm 100mm;margin:2mm}
  .token{width:100%;padding:0;margin:0}
  .page-break{
    page-break-after:always!important;
    break-after:page!important;
  }
}
`;

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const printHtmlDocument = (html) => {
  const win = window.open('', '_blank', 'width=420,height=640');
  const printViaIframeFallback = () => {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    frame.setAttribute('aria-hidden', 'true');
    const cleanup = () => {
      try {
        frame.remove();
      } catch {
        // no-op
      }
    };
    frame.onload = () => {
      try {
        const frameWin = frame.contentWindow;
        if (!frameWin) {
          cleanup();
          return;
        }
        frameWin.onafterprint = cleanup;
        frameWin.focus();
        setTimeout(() => {
          try {
            frameWin.print();
          } finally {
            setTimeout(cleanup, 2000);
          }
        }, 120);
      } catch {
        cleanup();
      }
    };
    frame.srcdoc = html;
    document.body.appendChild(frame);
  };

  if (!win) {
    printViaIframeFallback();
    return;
  }

  try {
    win.document.open();
    win.document.write(html);
    win.document.close();
  } catch {
    try {
      win.close();
    } catch {
      // no-op
    }
    printViaIframeFallback();
    return;
  }

  let hasPrinted = false;
  const triggerPrint = () => {
    if (hasPrinted) return;
    hasPrinted = true;
    try {
      win.focus();
      win.print();
    } catch {
      // no-op
    }
  };

  if (win.document?.readyState === 'complete') {
    setTimeout(triggerPrint, 200);
  } else {
    win.onload = () => setTimeout(triggerPrint, 200);
  }
  setTimeout(triggerPrint, 1200);
};

/**
 * Print one kitchen token slip per product (restaurant POS).
 * Each token is its own print page + page-break so thermal cutters cut individually.
 * stages: 'new' | 'hold' | 'final'
 */
export function openKitchenTokensWindow({
  company = {},
  branchName,
  orderLabel,
  invoiceNo,
  cashierName,
  stage = 'new',
  items = [],
}) {
  const list = (items || []).filter((item) => Number(item.quantity || item.unitQty || 0) > 0);
  if (!list.length) return;

  const stageLabel =
    stage === 'final' ? 'FINAL' : stage === 'hold' ? 'HOLD / RUNNING' : 'KOT / NEW';
  const now = new Date().toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  // Hard page-break after EVERY token (including last) so cutter fires per slip.
  const slips = list
    .map((item, idx) => {
      const name = escapeHtml(item.product?.name || item.productName || item.name || 'Item');
      const qty = Number(item.quantity ?? item.unitQty ?? 0);
      const qtyLabel = Number.isInteger(qty) ? String(qty) : qty.toFixed(1);
      const unit = escapeHtml(item.unitName || item.unit || '');
      return `<section class="token">
  <div class="center">
    <div style="font-weight:700;font-size:13px">${escapeHtml(company.companyName || 'Kitchen')}</div>
    <div style="margin-top:3px"><span class="stage">${stageLabel}</span></div>
  </div>
  <hr class="hr" />
  <div class="meta">
    <div><span>Token</span><span>#${idx + 1}/${list.length}</span></div>
    <div><span>Time</span><span>${escapeHtml(now)}</span></div>
    <div><span>Table / Order</span><span>${escapeHtml(orderLabel || '-')}</span></div>
    ${invoiceNo ? `<div><span>Invoice</span><span>${escapeHtml(invoiceNo)}</span></div>` : ''}
    <div><span>Branch</span><span>${escapeHtml(branchName || '-')}</span></div>
    <div><span>Cashier</span><span>${escapeHtml(cashierName || '-')}</span></div>
  </div>
  <hr class="hr" />
  <div class="item">
    <div class="item-name">${name}</div>
    <div class="item-qty">x ${qtyLabel}</div>
    ${unit ? `<div class="item-unit">${unit}</div>` : ''}
  </div>
  <hr class="hr" />
  <div class="footer">Kitchen token - tear &amp; prepare</div>
  <div class="cut-feed">--- CUT ---</div>
</section>
<div class="page-break"></div>`;
    })
    .join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Kitchen Tokens</title>
<style>${KITCHEN_TOKEN_CSS}</style></head><body>${slips}</body></html>`;

  printHtmlDocument(html);
}
