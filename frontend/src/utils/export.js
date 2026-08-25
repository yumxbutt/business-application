import html2pdf from 'html2pdf.js';

const escapeCsv = (value) => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

export const downloadCsv = (rows, fileName) => {
  const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

export const exportPdfViaPrint = () => {
  window.print();
};

const resolveElement = (target) => {
  if (!target) return null;
  if (typeof target === 'string') return document.querySelector(target);
  return target;
};

export const downloadPdf = async (target, fileName, options = {}) => {
  const element = resolveElement(target);
  if (!element) {
    throw new Error('PDF export area not found');
  }

  const worker = html2pdf()
    .set({
      margin: [8, 8, 8, 8],
      filename: fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'] },
      ...options,
    })
    .from(element);

  await worker.save();
};

export const downloadPdfFromPrintArea = async (fileName, selector = '.print-area') => {
  return downloadPdf(selector, fileName);
};
