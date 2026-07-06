const MARGIN_LEFT = 14;
const MARGIN_RIGHT = 14;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

export function fmtMoneyPDF(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function fmtDatePDF(dateStr: string | undefined | null): string {
  if (!dateStr) return '—';
  const clean = dateStr.split('T')[0];
  const [y, m, d] = clean.split('-');
  return `${d}/${m}/${y}`;
}

export function fmtDateShort(dateStr: string | undefined | null): string {
  if (!dateStr) return '—';
  const clean = dateStr.split('T')[0];
  const [, m, d] = clean.split('-');
  return `${d}/${m}`;
}

export function fmtMonthYear(monthStr: string): string {
  const [y, m] = monthStr.split('-');
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${months[parseInt(m) - 1]}/${y}`;
}

export interface PdfHeaderOptions {
  title: string;
  subtitle?: string;
  periodLabel?: string;
  periodValue?: string;
  filters?: { label: string; value: string }[];
  logo?: string;
  orgName?: string;
}

export function buildPdfHeader(doc: any, opts: PdfHeaderOptions) {
  const x = MARGIN_LEFT;
  let y = 14;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  doc.text('Fiducia', x, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  doc.text(opts.orgName || 'Gestão Financeira Pessoal', x + 20, y - 0.5);

  y += 4;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(x, y, PAGE_WIDTH - MARGIN_RIGHT, y);

  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text(opts.title, x, y);

  if (opts.subtitle) {
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text(opts.subtitle, x, y);
  }

  y += 3;
  const infoLines: { label: string; value: string }[] = [];
  if (opts.periodLabel) infoLines.push({ label: 'Período', value: `${opts.periodLabel}${opts.periodValue ? `: ${opts.periodValue}` : ''}` });
  infoLines.push({ label: 'Emitido em', value: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) });
  if (opts.filters) infoLines.push(...opts.filters);

  const infoY = y + 4;
  infoLines.forEach((line, i) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(`${line.label}:`, x, infoY + i * 4);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(70, 70, 70);
    doc.text(line.value, x + doc.getTextWidth(`${line.label}: `), infoY + i * 4);
  });

  y = infoY + infoLines.length * 4 + 2;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.2);
  doc.line(x, y, PAGE_WIDTH - MARGIN_RIGHT, y);

  return y + 3;
}

export function buildPdfFooter(doc: any, currentPage: number, totalPages: number) {
  const pageH = doc.internal.pageSize.height;
  const x = MARGIN_LEFT;
  const y = pageH - 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);

  doc.text('Fiducia — Gestão Financeira', x, y);
  doc.text(`Página ${currentPage} de ${totalPages}`, PAGE_WIDTH - MARGIN_RIGHT, y, { align: 'right' });
}

export function generateFilename(type: string, identifier?: string, startDate?: string, endDate?: string): string {
  const parts = [type];
  if (identifier) parts.push(identifier.replace(/\s+/g, '-').toLowerCase());
  if (startDate && endDate) {
    parts.push(`${startDate.split('T')[0]}-a-${endDate.split('T')[0]}`);
  } else if (startDate) {
    parts.push(startDate.split('T')[0]);
  }
  parts.push(new Date().toISOString().split('T')[0]);
  return parts.join('_').replace(/[^a-z0-9_-]/gi, '-').toLowerCase() + '.pdf';
}

export { MARGIN_LEFT, MARGIN_RIGHT, PAGE_WIDTH, CONTENT_WIDTH };
