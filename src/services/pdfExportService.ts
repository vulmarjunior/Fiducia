import { MARGIN_LEFT, MARGIN_RIGHT } from '../lib/pdfFormatUtils';

let _jsPDF: any = null;
let _autoTable: any = null;

async function ensureLibs() {
  if (!_jsPDF) {
    const mod = await import('jspdf');
    _jsPDF = mod.default || mod.jsPDF;
  }
  if (!_autoTable) {
    const mod = await import('jspdf-autotable');
    _autoTable = mod.default;
  }
  return { jsPDF: _jsPDF, autoTable: _autoTable };
}

const PAGE_W = 210;
const PAGE_H = 297;

export async function createPdf(orientation: 'p' | 'l' = 'p'): Promise<any> {
  const { jsPDF } = await ensureLibs();
  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  });
  doc.setProperties({
    title: 'Fiducia — Relatório Financeiro',
    creator: 'Fiducia',
  });
  return doc;
}

export function addTable(
  doc: any,
  autoTable: any,
  options: {
    startY: number;
    headers: string[][];
    body: any[][];
    columnStyles?: Record<number, any>;
    headerStyles?: Record<string, any>;
    bodyStyles?: Record<string, any>;
    foot?: any[][];
    showFoot?: boolean;
    headStyles?: Record<string, any>;
  },
): number {
  return autoTable(doc, {
    startY: options.startY,
    margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
    head: [options.headers],
    body: options.body,
    foot: options.foot ? options.foot : undefined,
    showFoot: options.showFoot ?? !!options.foot,
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: 2,
      lineColor: [220, 220, 220],
      lineWidth: 0.1,
      ...options.bodyStyles,
    },
    headStyles: {
      fillColor: [240, 242, 245],
      textColor: [60, 60, 60],
      fontStyle: 'bold',
      fontSize: 7,
      cellPadding: 2.5,
      ...options.headStyles,
    },
    columnStyles: options.columnStyles || {},
    footStyles: {
      fillColor: [248, 250, 252],
      textColor: [40, 40, 40],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    pageBreak: 'auto',
    rowPageBreak: 'auto',
    didDrawPage: (data: any) => {
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text('Fiducia — Gestão Financeira', MARGIN_LEFT, PAGE_H - 10);
        doc.text(`Página ${i} de ${totalPages}`, PAGE_W - MARGIN_RIGHT, PAGE_H - 10, { align: 'right' });
      }
    },
  });
}

export async function savePdf(doc: any, filename: string) {
  doc.save(filename);
}

export async function getAutoTable() {
  const { autoTable } = await ensureLibs();
  return autoTable;
}
