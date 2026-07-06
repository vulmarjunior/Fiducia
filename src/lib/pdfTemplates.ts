import { createPdf, addTable, getAutoTable, savePdf } from '../services/pdfExportService';
import {
  fmtMoneyPDF, fmtDatePDF, fmtDateShort, fmtMonthYear, generateFilename,
  MARGIN_LEFT, MARGIN_RIGHT, PAGE_WIDTH, CONTENT_WIDTH,
} from '../lib/pdfFormatUtils';

function classifyInvoiceGroup(t: any, cardId: string): string {
  if ((t.type === 'transfer' || t.type === 'transferencia') && t.destinationAccountId === cardId) return 'PAGAMENTOS_AJUSTES';
  if ((t.type === 'transfer' || t.type === 'transferencia') && t.accountId === cardId) return 'OUTROS_DEBITOS';
  if ((t.type === 'income' || t.type === 'receita') && t.accountId === cardId) return 'CREDITOS_ESTORNOS';
  if (t.installmentNumber && t.installmentNumber >= 2) return 'PARCELAMENTOS_ANTERIORES';
  return 'COMPRAS_DO_PERIODO';
}

function resolveCategoryName(categoryId: string | undefined, categories: any[]): string {
  if (!categoryId) return '—';
  const cat = categories.find(c => c.id === categoryId);
  return cat?.name || categoryId;
}

function txTypeLabel(t: any): string {
  const tipe = t.type;
  if (tipe === 'receita' || tipe === 'income') return 'Receita';
  if (tipe === 'despesa' || tipe === 'expense') return 'Despesa';
  if (tipe === 'transferencia' || tipe === 'transfer') return 'Transferência';
  return tipe;
}

function resolveAccountName(accountId: string | undefined, accounts: any[], creditCards: any[]): string {
  if (!accountId) return '—';
  const acc = accounts.find(a => a.id === accountId);
  if (acc) return acc.name;
  const card = creditCards.find(c => c.id === accountId);
  if (card) return card.name;
  return accountId;
}

function isExpense(t: any): boolean {
  return t.type === 'despesa' || t.type === 'expense';
}

function isIncome(t: any): boolean {
  return t.type === 'receita' || t.type === 'income';
}

function isTransfer(t: any): boolean {
  return t.type === 'transferencia' || t.type === 'transfer';
}

function isPaid(t: any): boolean {
  return t.status === 'pago' || t.status === 'realizado' || t.status === 'paid';
}

// ─── CASH FLOW REPORT ──────────────────────────────────────────────────────

export async function generateCashFlowPDF(opts: {
  cashFlowData: { name: string; month: string; Receitas: number; Despesas: number; Saldo: number }[];
  cashTotals: { totalR: number; totalD: number; savings: number; rate: number };
  cashflowPeriod: string;
  showPending: boolean;
}) {
  const doc = await createPdf();
  const autoTable = await getAutoTable();

  const periodLabel = opts.cashflowPeriod === '3months' ? '3 Meses' : opts.cashflowPeriod === '6months' ? '6 Meses' : opts.cashflowPeriod === '12months' ? '12 Meses' : 'Ano atual';
  const periodRange = opts.cashFlowData.length > 0
    ? `${fmtMonthYear(opts.cashFlowData[0].month)} — ${fmtMonthYear(opts.cashFlowData[opts.cashFlowData.length - 1].month)}`
    : '';

  let y = MARGIN_LEFT + 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  doc.text('Fiducia', MARGIN_LEFT, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  doc.text('Gestão Financeira Pessoal', MARGIN_LEFT + 20, y - 0.5);

  y += 4;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);

  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text('Fluxo de Caixa', MARGIN_LEFT, y);

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text('Relatório de Receitas e Despesas', MARGIN_LEFT, y);

  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text('Período:', MARGIN_LEFT, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(70, 70, 70);
  doc.text(`${periodLabel} (${periodRange})`, MARGIN_LEFT + 18, y);

  y += 3.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text('Emitido em:', MARGIN_LEFT, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(70, 70, 70);
  doc.text(new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }), MARGIN_LEFT + 18, y);

  y += 3.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text('Filtro:', MARGIN_LEFT, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(70, 70, 70);
  doc.text(opts.showPending ? 'Realizados + Pendentes' : 'Somente Realizados', MARGIN_LEFT + 18, y);

  y += 2;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.2);
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
  y += 3;

  // KPIs
  const kpis = [
    { label: 'Receitas no Período', value: opts.cashTotals.totalR },
    { label: 'Despesas no Período', value: opts.cashTotals.totalD },
    { label: 'Economia do Mês', value: opts.cashTotals.savings },
    { label: 'Taxa de Poupança', display: `${opts.cashTotals.rate.toFixed(1)}%` },
  ];

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 40);
  doc.text('Resumo', MARGIN_LEFT, y);
  y += 4;

  const kpiW = CONTENT_WIDTH / 4;
  let kx = MARGIN_LEFT;
  kpis.forEach((kpi) => {
    doc.setFillColor(248, 250, 252);
    doc.rect(kx, y, kpiW - 1.5, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(120, 120, 120);
    doc.text(kpi.label, kx + 2, y + 3.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(40, 40, 40);
    doc.text(kpi.display || fmtMoneyPDF(kpi.value!), kx + 2, y + 7.5);
    kx += kpiW;
  });
  y += 12;

  // Table
  const body = opts.cashFlowData.map(m => [
    m.name,
    fmtMoneyPDF(m.Receitas),
    fmtMoneyPDF(m.Despesas),
    fmtMoneyPDF(m.Saldo),
  ]);

  const foot = [[
    'Totais',
    fmtMoneyPDF(opts.cashTotals.totalR),
    fmtMoneyPDF(opts.cashTotals.totalD),
    fmtMoneyPDF(opts.cashTotals.totalR - opts.cashTotals.totalD),
  ]];

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
    head: [['Mês', 'Receitas', 'Despesas', 'Saldo']],
    body,
    foot,
    showFoot: true,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2.5, lineColor: [220, 220, 220], lineWidth: 0.1 },
    headStyles: { fillColor: [240, 242, 245], textColor: [60, 60, 60], fontStyle: 'bold', fontSize: 7 },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
    },
    footStyles: { fillColor: [248, 250, 252], textColor: [40, 40, 40], fontStyle: 'bold', fontSize: 7.5 },
    pageBreak: 'auto',
    didDrawPage: (data: any) => {
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text('Fiducia — Gestão Financeira', MARGIN_LEFT, 287);
        doc.text(`Página ${i} de ${totalPages}`, PAGE_WIDTH - MARGIN_RIGHT, 287, { align: 'right' });
      }
    },
  });

  const filename = generateFilename('relatorio-fluxo-de-caixa', undefined, opts.cashFlowData[0]?.month, opts.cashFlowData[opts.cashFlowData.length - 1]?.month);
  await savePdf(doc, filename);
}

// ─── CATEGORIES REPORT ─────────────────────────────────────────────────────

export async function generateCategoryPDF(opts: {
  categoryData: { name: string; value: number; pct: number; pctIncome: number }[];
  catPeriod: string;
  catType: 'expense' | 'income';
}) {
  const doc = await createPdf();
  const autoTable = await getAutoTable();

  const title = opts.catType === 'expense' ? 'Relatório por Categoria — Despesas' : 'Relatório por Categoria — Receitas';
  const periodLabel = opts.catPeriod === 'month' ? 'Mês atual' : opts.catPeriod === '3months' ? '3 Meses' : opts.catPeriod === '6months' ? '6 Meses' : opts.catPeriod === '12months' ? '12 Meses' : 'Ano atual';

  let y = MARGIN_LEFT + 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  doc.text('Fiducia', MARGIN_LEFT, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  doc.text('Gestão Financeira Pessoal', MARGIN_LEFT + 20, y - 0.5);

  y += 4;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);

  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text(title, MARGIN_LEFT, y);

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text('Distribuição por categoria', MARGIN_LEFT, y);

  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text('Período:', MARGIN_LEFT, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(70, 70, 70);
  doc.text(periodLabel, MARGIN_LEFT + 18, y);

  y += 3.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text('Emitido em:', MARGIN_LEFT, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(70, 70, 70);
  doc.text(new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }), MARGIN_LEFT + 18, y);

  y += 2;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.2);
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
  y += 3;

  const total = opts.categoryData.reduce((s, c) => s + c.value, 0);

  // KPI bar
  doc.setFillColor(248, 250, 252);
  doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.setTextColor(120, 120, 120);
  doc.text('Total do Período', MARGIN_LEFT + 2, y + 3.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  doc.text(fmtMoneyPDF(total), MARGIN_LEFT + 2, y + 7.5);

  doc.setTextColor(120, 120, 120);
  doc.setFontSize(5.5);
  doc.text('Categorias', MARGIN_LEFT + 60, y + 3.5);
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  doc.text(String(opts.categoryData.length), MARGIN_LEFT + 60, y + 7.5);

  y += 13;

  const body = opts.categoryData.map(c => [
    c.name,
    fmtMoneyPDF(c.value),
    `${c.pct.toFixed(1)}%`,
    c.pctIncome > 0 ? `${c.pctIncome.toFixed(1)}%` : '—',
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
    head: [['Categoria', 'Valor', '% Categoria', '% Renda']],
    body,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2.5, lineColor: [220, 220, 220], lineWidth: 0.1 },
    headStyles: { fillColor: [240, 242, 245], textColor: [60, 60, 60], fontStyle: 'bold', fontSize: 7 },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    pageBreak: 'auto',
    didDrawPage: (data: any) => {
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text('Fiducia — Gestão Financeira', MARGIN_LEFT, 287);
        doc.text(`Página ${i} de ${totalPages}`, PAGE_WIDTH - MARGIN_RIGHT, 287, { align: 'right' });
      }
    },
  });

  const filename = generateFilename(`relatorio-categorias-${opts.catType === 'expense' ? 'despesas' : 'receitas'}`);
  await savePdf(doc, filename);
}

// ─── TREND & BUDGET REPORT ─────────────────────────────────────────────────

export async function generateTrendPDF(opts: {
  trendData: { day: number; amount: number }[];
  budgetComparison: { name: string; budget: number; spent: number; diff: number; pct: number }[];
  currentMonthStr: string;
}) {
  const doc = await createPdf();
  const autoTable = await getAutoTable();

  const monthLabel = fmtMonthYear(opts.currentMonthStr);

  let y = MARGIN_LEFT + 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  doc.text('Fiducia', MARGIN_LEFT, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  doc.text('Gestão Financeira Pessoal', MARGIN_LEFT + 20, y - 0.5);

  y += 4;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);

  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text('Tendência & Orçamentos', MARGIN_LEFT, y);

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text(`Análise de gastos acumulados — ${monthLabel}`, MARGIN_LEFT, y);

  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text('Emitido em:', MARGIN_LEFT, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(70, 70, 70);
  doc.text(new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }), MARGIN_LEFT + 18, y);

  y += 2;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.2);
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
  y += 3;

  if (opts.trendData.length > 0) {
    const totalSpent = opts.trendData[opts.trendData.length - 1].amount;
    doc.setFillColor(248, 250, 252);
    doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(120, 120, 120);
    doc.text('Gasto Acumulado no Mês', MARGIN_LEFT + 2, y + 3.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    doc.text(fmtMoneyPDF(totalSpent), MARGIN_LEFT + 2, y + 7.5);
    y += 13;
  }

  if (opts.budgetComparison.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(40, 40, 40);
    doc.text('Orçamento × Realizado', MARGIN_LEFT, y);
    y += 5;

    const body = opts.budgetComparison.map(b => [
      b.name,
      fmtMoneyPDF(b.budget),
      fmtMoneyPDF(b.spent),
      fmtMoneyPDF(b.diff),
      `${b.pct}%`,
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
      head: [['Categoria', 'Orçamento', 'Realizado', 'Diferença', 'Uso']],
      body,
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2.5, lineColor: [220, 220, 220], lineWidth: 0.1 },
      headStyles: { fillColor: [240, 242, 245], textColor: [60, 60, 60], fontStyle: 'bold', fontSize: 7 },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
      pageBreak: 'auto',
      didDrawPage: (data: any) => {
        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(150, 150, 150);
          doc.text('Fiducia — Gestão Financeira', MARGIN_LEFT, 287);
          doc.text(`Página ${i} de ${totalPages}`, PAGE_WIDTH - MARGIN_RIGHT, 287, { align: 'right' });
        }
      },
    });
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(130, 130, 130);
    doc.text('Nenhum orçamento configurado para este período.', MARGIN_LEFT, y);
  }

  const filename = generateFilename('relatorio-tendencia-orcamento', undefined, opts.currentMonthStr);
  await savePdf(doc, filename);
}

// ─── PROJECTION REPORT ─────────────────────────────────────────────────────

export async function generateProjectionPDF(opts: {
  filteredProjData: any[];
  projKPIs: any;
  projPeriod: string;
  includeSavings: boolean;
  projCategory: string;
  categories: any[];
  accounts: any[];
  creditCards: any[];
  projEndDate: Date;
  projCustomEnd: string;
}) {
  const doc = await createPdf('l');
  const autoTable = await getAutoTable();

  const periodLabel = opts.projPeriod === '1month' ? '1 Mês' : opts.projPeriod === '3months' ? '3 Meses' : opts.projPeriod === '6months' ? '6 Meses' : opts.projPeriod === '12months' ? '12 Meses' : opts.projCustomEnd ? `Até ${fmtDatePDF(opts.projCustomEnd)}` : 'Personalizado';

  let y = MARGIN_LEFT + 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  doc.text('Fiducia', MARGIN_LEFT, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  doc.text('Gestão Financeira Pessoal', MARGIN_LEFT + 20, y - 0.5);

  y += 4;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);

  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text('Projeção Futura', MARGIN_LEFT, y);

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text('Simulação de cobertura de caixa', MARGIN_LEFT, y);

  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text('Horizonte:', MARGIN_LEFT, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(70, 70, 70);
  doc.text(`${periodLabel} (até ${fmtDatePDF(opts.projEndDate.toISOString())})`, MARGIN_LEFT + 18, y);

  y += 3.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text('Emitido em:', MARGIN_LEFT, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(70, 70, 70);
  doc.text(new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }), MARGIN_LEFT + 18, y);

  y += 3.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  const filterParts: string[] = [];
  if (opts.includeSavings) filterParts.push('Investimentos incluídos');
  if (opts.projCategory !== 'all') {
    const cat = opts.categories.find(c => c.id === opts.projCategory);
    filterParts.push(`Categoria: ${cat?.name || opts.projCategory}`);
  }
  doc.text(`Filtros: ${filterParts.length > 0 ? filterParts.join(' | ') : 'Nenhum'}`, MARGIN_LEFT + 18, y);

  y += 2;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.2);
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
  y += 3;

  const kps = opts.projKPIs;
  const landscapeW = 297 - MARGIN_LEFT * 2;

  // Top KPIs
  const kpiItems = [
    { label: 'A Receber', value: kps.totalIncome, color: [16, 185, 129] },
    { label: 'A Pagar', value: kps.totalPay, color: [239, 68, 68] },
    { label: 'Faturas', value: kps.totalInvoice, color: [245, 158, 11] },
    { label: 'Saldo Final Proj.', value: kps.finalAccum, color: kps.finalAccum >= 0 ? [16, 185, 129] : [239, 68, 68] },
    { label: 'Cobertura', value: kps.coverageBalance, color: kps.coverageBalance >= 0 ? [16, 185, 129] : [239, 68, 68] },
    { label: 'Saldo Mínimo', value: kps.minimumBalance, color: kps.minimumBalance >= 0 ? [59, 130, 246] : [239, 68, 68] },
  ];

  const kpiW = landscapeW / 6;
  let kx = MARGIN_LEFT;
  kpiItems.forEach((ki) => {
    doc.setFillColor(248, 250, 252);
    doc.rect(kx, y, kpiW - 1.5, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5);
    doc.setTextColor(120, 120, 120);
    doc.text(ki.label, kx + 2, y + 3.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(ki.color[0], ki.color[1], ki.color[2]);
    doc.text(fmtMoneyPDF(ki.value), kx + 2, y + 7.5);
    kx += kpiW;
  });
  y += 12;

  // Risk alert
  if (kps.isAtRisk && kps.firstRiskDate) {
    doc.setFillColor(254, 242, 242);
    doc.rect(MARGIN_LEFT, y, landscapeW, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(185, 28, 28);
    const riskDate = typeof kps.firstRiskDate === 'string' ? fmtDatePDF(kps.firstRiskDate) : fmtDatePDF(kps.firstRiskDate.toISOString());
    doc.text(`⚠ Risco de descoberto detectado a partir de ${riskDate}`, MARGIN_LEFT + 2, y + 4);
    y += 8;
  }

  // Monthly breakdown
  const body = opts.filteredProjData.map((m: any) => {
    const incomeTotal = m.incomeTxList?.reduce((s: number, t: any) => s + t.amount, 0) || 0;
    const expenseTotal = m.expenseTxList?.reduce((s: number, t: any) => s + t.amount, 0) || 0;
    const invoiceTotal = m.invoiceList?.reduce((s: number, t: any) => s + t.totalAmount || t.amount, 0) || 0;
    return [
      m.label,
      fmtMoneyPDF(incomeTotal),
      fmtMoneyPDF(expenseTotal),
      fmtMoneyPDF(invoiceTotal),
      fmtMoneyPDF(m.endingBalance || m.accum),
    ];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
    head: [['Mês', 'A Receber', 'A Pagar', 'Faturas', 'Saldo Proj.']],
    body,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 2.5, lineColor: [220, 220, 220], lineWidth: 0.1 },
    headStyles: { fillColor: [240, 242, 245], textColor: [60, 60, 60], fontStyle: 'bold', fontSize: 7 },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
    pageBreak: 'auto',
    didDrawPage: (data: any) => {
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text('Fiducia — Gestão Financeira', MARGIN_LEFT, 287);
        doc.text(`Página ${i} de ${totalPages}`, PAGE_WIDTH - MARGIN_RIGHT, 287, { align: 'right' });
      }
    },
  });

  const filename = generateFilename('relatorio-projecao-futura');
  await savePdf(doc, filename);
}

// ─── INVOICE ANALYSIS REPORT ───────────────────────────────────────────────

export async function generateInvoiceAnalysisPDF(opts: {
  invoiceAnalysis: any;
  invPeriod: string;
  invSelectedCard: string;
  creditCards: any[];
}) {
  const doc = await createPdf('l');
  const autoTable = await getAutoTable();

  const periodLabel = opts.invPeriod === '3months' ? '3 Meses' : opts.invPeriod === '6months' ? '6 Meses' : opts.invPeriod === '12months' ? '12 Meses' : opts.invPeriod === 'custom' ? 'Personalizado' : '12 Meses';
  const analysis = opts.invoiceAnalysis;

  let y = MARGIN_LEFT + 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  doc.text('Fiducia', MARGIN_LEFT, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  doc.text('Gestão Financeira Pessoal', MARGIN_LEFT + 20, y - 0.5);

  y += 4;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);

  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text('Análise de Faturas de Cartão', MARGIN_LEFT, y);

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text('Evolução mensal e distribuição por cartão', MARGIN_LEFT, y);

  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text('Período:', MARGIN_LEFT, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(70, 70, 70);
  doc.text(periodLabel, MARGIN_LEFT + 18, y);

  y += 3.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text('Emitido em:', MARGIN_LEFT, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(70, 70, 70);
  doc.text(new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }), MARGIN_LEFT + 18, y);

  y += 2;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.2);
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
  y += 3;

  // KPIs
  const landscapeW = 297 - MARGIN_LEFT * 2;
  const kpiData = [
    { label: 'Total Faturas', value: analysis.grandTotal },
    { label: 'Abertas', value: analysis.totalOpen },
    { label: 'Fechadas', value: analysis.totalClosed },
    { label: 'Pagas', value: analysis.totalPaid },
    { label: 'Média Mensal', value: analysis.monthlyAverage },
    { label: 'Cartões', display: String(analysis.cardsCount || 0) },
  ];

  const kpiW = landscapeW / 6;
  let kx = MARGIN_LEFT;
  kpiData.forEach((ki) => {
    doc.setFillColor(248, 250, 252);
    doc.rect(kx, y, kpiW - 1.5, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5);
    doc.setTextColor(120, 120, 120);
    doc.text(ki.label, kx + 2, y + 3.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(40, 40, 40);
    doc.text(ki.display || fmtMoneyPDF(ki.value), kx + 2, y + 7.5);
    kx += kpiW;
  });
  y += 13;

  // Monthly data table
  if (analysis.monthlyData && analysis.monthlyData.length > 0) {
    const headers = ['Mês'];
    const cardIds = Object.keys(analysis.monthlyData[0]?.cards || {});
    cardIds.forEach(id => {
      const card = opts.creditCards.find(c => c.id === id);
      headers.push(card?.name || id);
    });
    headers.push('Total');

    const body = analysis.monthlyData
      .filter((m: any) => m.total > 0)
      .map((m: any) => {
        const row = [m.label];
        cardIds.forEach(id => {
          row.push(fmtMoneyPDF(m.cards[id]?.amount || 0));
        });
        row.push(fmtMoneyPDF(m.total));
        return row;
      });

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
      head: [headers],
      body,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2.5, lineColor: [220, 220, 220], lineWidth: 0.1 },
      headStyles: { fillColor: [240, 242, 245], textColor: [60, 60, 60], fontStyle: 'bold', fontSize: 7 },
      columnStyles: headers.reduce((acc, _, i) => { if (i > 0) acc[i] = { halign: 'right' }; return acc; }, {} as any),
      pageBreak: 'auto',
      didDrawPage: (data: any) => {
        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(150, 150, 150);
          doc.text('Fiducia — Gestão Financeira', MARGIN_LEFT, 287);
          doc.text(`Página ${i} de ${totalPages}`, PAGE_WIDTH - MARGIN_RIGHT, 287, { align: 'right' });
        }
      },
    });
  }

  const filename = generateFilename('relatorio-faturas-cartao');
  await savePdf(doc, filename);
}

// ─── ACCOUNT STATEMENT (EXTRACT) ────────────────────────────────────────────

export async function generateAccountStatementPDF(opts: {
  account: any;
  transactions: any[];
  categories: any[];
  accounts: any[];
  creditCards: any[];
  startDate: string;
  endDate: string;
  selectedAccountFilter: string;
  filterType: string;
  selectedMonth?: string;
}) {
  const doc = await createPdf();
  const autoTable = await getAutoTable();

  const acc = opts.account;
  const txs = opts.transactions.filter(t => {
    if (opts.selectedAccountFilter !== 'all') {
      if (t.accountId !== opts.selectedAccountFilter && t.destinationAccountId !== opts.selectedAccountFilter) return false;
    }
    return true;
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let periodLabel = '';
  if (opts.filterType === 'month' && opts.selectedMonth) {
    periodLabel = `${fmtMonthYear(opts.selectedMonth)}`;
  } else if (opts.filterType === 'range') {
    periodLabel = `${fmtDatePDF(opts.startDate)} — ${fmtDatePDF(opts.endDate)}`;
  } else {
    periodLabel = 'Todos os períodos';
  }

  let y = MARGIN_LEFT + 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  doc.text('Fiducia', MARGIN_LEFT, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  doc.text('Gestão Financeira Pessoal', MARGIN_LEFT + 20, y - 0.5);

  y += 4;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);

  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text('Extrato de Conta', MARGIN_LEFT, y);

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text(acc?.name || 'Todas as Contas', MARGIN_LEFT, y);

  y += 4;
  const infoItems = [
    { label: 'Conta', value: acc?.name || 'Todas as contas' },
    { label: 'Período', value: periodLabel },
    { label: 'Emitido em', value: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) },
  ];
  if (acc?.bankName) infoItems.splice(1, 0, { label: 'Instituição', value: acc.bankName });

  infoItems.forEach((info) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(`${info.label}:`, MARGIN_LEFT, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(70, 70, 70);
    doc.text(info.value, MARGIN_LEFT + 18, y);
    y += 3.5;
  });

  y += 1;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.2);
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
  y += 3;

  if (acc) {
    doc.setFillColor(248, 250, 252);
    doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(120, 120, 120);
    doc.text('Saldo Atual', MARGIN_LEFT + 2, y + 3.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    doc.text(fmtMoneyPDF(acc.balance || 0), MARGIN_LEFT + 2, y + 7.5);

    const totalEntradas = txs.filter(t => {
      if (t.type === 'receita' || t.type === 'income') return true;
      if ((t.type === 'transferencia' || t.type === 'transfer') && t.destinationAccountId === acc.id && t.accountId !== acc.id) return true;
      return false;
    }).reduce((s, t) => s + t.amount, 0);

    const totalSaidas = txs.filter(t => {
      if (t.type === 'despesa' || t.type === 'expense') return true;
      if ((t.type === 'transferencia' || t.type === 'transfer') && t.accountId === acc.id && t.destinationAccountId !== acc.id) return true;
      return false;
    }).reduce((s, t) => s + t.amount, 0);

    doc.setTextColor(120, 120, 120);
    doc.setFontSize(5.5);
    doc.text('Entradas', MARGIN_LEFT + 62, y + 3.5);
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    doc.text(fmtMoneyPDF(totalEntradas), MARGIN_LEFT + 62, y + 7.5);

    doc.setTextColor(120, 120, 120);
    doc.setFontSize(5.5);
    doc.text('Saídas', MARGIN_LEFT + 112, y + 3.5);
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    doc.text(fmtMoneyPDF(totalSaidas), MARGIN_LEFT + 112, y + 7.5);

    doc.setTextColor(120, 120, 120);
    doc.setFontSize(5.5);
    doc.text('Movim. Líquido', MARGIN_LEFT + 152, y + 3.5);
    doc.setFontSize(9);
    const net = totalEntradas - totalSaidas;
    doc.setTextColor(net >= 0 ? 16 : 239, net >= 0 ? 185 : 68, net >= 0 ? 129 : 68);
    doc.text(fmtMoneyPDF(net), MARGIN_LEFT + 152, y + 7.5);
    y += 13;
  }

  if (txs.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(130, 130, 130);
    doc.text('Nenhum lançamento encontrado no período.', MARGIN_LEFT, y);
  } else {
    // Running balance
    let runningBalance = acc ? (acc.initialBalance ?? 0) : 0;

    const body = txs.map(t => {
      const effect = getTxEffectForExtract(t, acc?.id);
      if (isPaid(t) && acc) runningBalance += effect;
      const typeLabel = txTypeLabel(t);
      const catName = resolveCategoryName(t.categoryId, opts.categories);
      const accLabel = typeLabel === 'Transferência'
        ? `${resolveAccountName(t.accountId, opts.accounts, opts.creditCards)} → ${resolveAccountName(t.destinationAccountId, opts.accounts, opts.creditCards)}`
        : '';
      return [
        fmtDatePDF(t.date),
        t.description,
        catName,
        accLabel || typeLabel,
        effect > 0 ? fmtMoneyPDF(Math.abs(effect)) : '',
        effect < 0 ? fmtMoneyPDF(Math.abs(effect)) : '',
        isPaid(t) && acc ? fmtMoneyPDF(runningBalance) : '—',
      ];
    });

    const totalEntradasFinal = txs.reduce((s, t) => {
      const effect = getTxEffectForExtract(t, acc?.id);
      return effect > 0 && isPaid(t) ? s + effect : s;
    }, 0);
    const totalSaidasFinal = txs.reduce((s, t) => {
      const effect = getTxEffectForExtract(t, acc?.id);
      return effect < 0 && isPaid(t) ? s + Math.abs(effect) : s;
    }, 0);

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
      head: [['Data', 'Descrição', 'Categoria', 'Tipo', 'Entrada', 'Saída', 'Saldo']],
      body,
      foot: [['', '', '', 'Totais', fmtMoneyPDF(totalEntradasFinal), fmtMoneyPDF(totalSaidasFinal), fmtMoneyPDF(acc?.balance || 0)]],
      showFoot: true,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2, lineColor: [220, 220, 220], lineWidth: 0.1 },
      headStyles: { fillColor: [240, 242, 245], textColor: [60, 60, 60], fontStyle: 'bold', fontSize: 6.5 },
      columnStyles: {
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
      },
      footStyles: { fillColor: [248, 250, 252], textColor: [40, 40, 40], fontStyle: 'bold', fontSize: 7 },
      pageBreak: 'auto',
      didDrawPage: (data: any) => {
        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(150, 150, 150);
          doc.text('Fiducia — Gestão Financeira', MARGIN_LEFT, 287);
          doc.text(`Página ${i} de ${totalPages}`, PAGE_WIDTH - MARGIN_RIGHT, 287, { align: 'right' });
        }
      },
    });
  }

  const filename = generateFilename('extrato', acc?.name, opts.startDate, opts.endDate);
  await savePdf(doc, filename);
}

function getTxEffectForExtract(t: any, accountId: string | undefined): number {
  if (!accountId) return 0;
  const ti = t.type;
  if (ti === 'receita' || ti === 'income') return t.amount;
  if (ti === 'despesa' || ti === 'expense') return -t.amount;
  if (ti === 'transferencia' || ti === 'transfer') {
    if (t.accountId === accountId) return -t.amount;
    if (t.destinationAccountId === accountId) return t.amount;
  }
  return 0;
}

// ─── CREDIT CARD INVOICE ───────────────────────────────────────────────────

const INVOICE_GROUPS = [
  { key: 'COMPRAS_DO_PERIODO', label: 'Compras do Período' },
  { key: 'PARCELAMENTOS_ANTERIORES', label: 'Parcelamentos Anteriores' },
  { key: 'OUTROS_DEBITOS', label: 'Outros Débitos' },
  { key: 'CREDITOS_ESTORNOS', label: 'Créditos e Estornos' },
  { key: 'PAGAMENTOS_AJUSTES', label: 'Pagamentos e Ajustes' },
];

export async function generateCreditCardInvoicePDF(opts: {
  card: any;
  invoiceTxs: any[];
  categories: any[];
  period: string;
  invoiceStatus: string;
  creditCards?: any[];
  accounts?: any[];
}) {
  const doc = await createPdf();
  const autoTable = await getAutoTable();

  const card = opts.card;
  const invoiceTxs = opts.invoiceTxs;
  const periodStr = opts.period;
  const [yStr, mStr] = periodStr.split('-').map(Number);

  // Calculate period dates from closingDay/dueDay
  const closingDate = new Date(yStr, mStr - 1, card.closingDay);
  const dueDate = new Date(yStr, mStr - 1, card.dueDay);
  if (card.dueDay <= card.closingDay) dueDate.setMonth(dueDate.getMonth() + 1);

  const closingDatePrev = new Date(closingDate);
  closingDatePrev.setMonth(closingDatePrev.getMonth() - 1);
  closingDatePrev.setDate(card.closingDay + 1);

  const statusLabel = opts.invoiceStatus === 'aberta' ? 'ABERTA' : opts.invoiceStatus === 'fechada' ? 'FECHADA' : opts.invoiceStatus === 'paga' ? 'PAGA' : '—';

  let y = MARGIN_LEFT + 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  doc.text('Fiducia', MARGIN_LEFT, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  doc.text('Gestão Financeira Pessoal', MARGIN_LEFT + 20, y - 0.5);

  y += 4;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);

  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text('Fatura de Cartão de Crédito', MARGIN_LEFT, y);

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text(`${card.name} — ${fmtMonthYear(periodStr)}`, MARGIN_LEFT, y);

  y += 4;

  // Status badge
  const statusColors: Record<string, number[]> = { aberta: [59, 130, 246], fechada: [239, 68, 68], paga: [16, 185, 129] };
  const sc = statusColors[opts.invoiceStatus] || [150, 150, 150];
  doc.setFillColor(sc[0], sc[1], sc[2]);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  const statusW = doc.getTextWidth(statusLabel) + 6;
  doc.rect(MARGIN_LEFT, y - 3.5, statusW, 4.5, 'F');
  doc.text(statusLabel, MARGIN_LEFT + 3, y);

  y += 2;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.2);
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
  y += 3;

  // Card info + invoice period
  const infoCols = [
    [
      { label: 'Cartão', value: card.name },
      { label: 'Limite', value: fmtMoneyPDF(card.limit) },
      { label: 'Fechamento', value: `Dia ${card.closingDay}` },
      { label: 'Vencimento', value: `Dia ${card.dueDay}` },
    ],
    [
      { label: 'Período', value: `${fmtDatePDF(closingDatePrev.toISOString())} — ${fmtDatePDF(closingDate.toISOString())}` },
      { label: 'Vencimento', value: fmtDatePDF(dueDate.toISOString()) },
      { label: 'Status', value: statusLabel },
      { label: 'Emitido em', value: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) },
    ],
  ];

  const colW = CONTENT_WIDTH / 2;
  infoCols.forEach((col, ci) => {
    let iy = y;
    col.forEach((info) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text(`${info.label}:`, MARGIN_LEFT + ci * colW, iy);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(70, 70, 70);
      doc.text(info.value, MARGIN_LEFT + ci * colW + 18, iy);
      iy += 3.5;
    });
  });

  const infoRows = Math.max(infoCols[0].length, infoCols[1].length);
  y += infoRows * 3.5 + 2;

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.2);
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
  y += 3;

  // Totals
  const totalExpenses = invoiceTxs
    .filter(t => (t.type === 'despesa' || t.type === 'expense') && t.accountId === card.id)
    .reduce((s, t) => s + t.amount, 0);
  const totalCredits = invoiceTxs
    .filter(t => (t.type === 'receita' || t.type === 'income') && t.accountId === card.id)
    .reduce((s, t) => s + t.amount, 0);
  const totalPayments = invoiceTxs
    .filter(t => (t.type === 'transferencia' || t.type === 'transfer') && t.destinationAccountId === card.id)
    .reduce((s, t) => s + t.amount, 0);
  const totalDebits = invoiceTxs
    .filter(t => (t.type === 'transferencia' || t.type === 'transfer') && t.accountId === card.id)
    .reduce((s, t) => s + t.amount, 0);
  const invoiceTotal = totalExpenses + totalDebits - totalCredits - totalPayments;

  // Total box
  doc.setFillColor(248, 250, 252);
  doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.setTextColor(120, 120, 120);
  doc.text('Total da Fatura', MARGIN_LEFT + 2, y + 3.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  doc.text(fmtMoneyPDF(Math.abs(invoiceTotal)), MARGIN_LEFT + 2, y + 7.5);

  doc.setFontSize(5.5);
  doc.setTextColor(120, 120, 120);
  doc.text('Compras', MARGIN_LEFT + 62, y + 3.5);
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  doc.text(fmtMoneyPDF(totalExpenses), MARGIN_LEFT + 62, y + 7.5);

  doc.setFontSize(5.5);
  doc.setTextColor(120, 120, 120);
  doc.text('Créd./Estornos', MARGIN_LEFT + 112, y + 3.5);
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  doc.text(fmtMoneyPDF(totalCredits + totalPayments), MARGIN_LEFT + 112, y + 7.5);

  const hasPayment = invoiceTxs.some(t => (t.type === 'transferencia' || t.type === 'transfer') && t.destinationAccountId === card.id);
  const totalPaid = hasPayment ? totalPayments : 0;

  doc.setFontSize(5.5);
  doc.setTextColor(120, 120, 120);
  doc.text(opts.invoiceStatus === 'paga' ? 'Pago' : 'Em Aberto', MARGIN_LEFT + 152, y + 3.5);
  doc.setFontSize(9);
  doc.setTextColor(opts.invoiceStatus === 'paga' ? 16 : 239, opts.invoiceStatus === 'paga' ? 185 : 68, opts.invoiceStatus === 'paga' ? 129 : 68);
  doc.text(opts.invoiceStatus === 'paga' ? fmtMoneyPDF(totalPaid) : fmtMoneyPDF(Math.abs(invoiceTotal) - totalPaid), MARGIN_LEFT + 152, y + 7.5);

  y += 13;

  // Transactions by group
  const grouped = new Map<string, any[]>();
  INVOICE_GROUPS.forEach(g => grouped.set(g.key, []));

  invoiceTxs.forEach(t => {
    const grp = classifyInvoiceGroup(t, card.id);
    if (grouped.has(grp)) grouped.get(grp)!.push(t);
  });

  let hasAnyTx = false;
  let currentStartY = y;

  for (const g of INVOICE_GROUPS) {
    const txs = grouped.get(g.key);
    if (!txs || txs.length === 0) continue;
    hasAnyTx = true;

    // Sort by posting date
    const sorted = [...txs].sort((a, b) => {
      const da = parseLocalDateForPdf(a.postingDate || a.date);
      const db = parseLocalDateForPdf(b.postingDate || b.date);
      return da - db;
    });

    const subtotal = sorted.reduce((acc, t) => {
      const isPayment = (t.type === 'transferencia' || t.type === 'transfer') && t.destinationAccountId === card.id;
      const isInc = (t.type === 'receita' || t.type === 'income') && t.accountId === card.id;
      return isPayment || isInc ? acc - t.amount : acc + t.amount;
    }, 0);

    // Group header
    doc.setFillColor(245, 245, 245);
    doc.rect(MARGIN_LEFT, currentStartY, CONTENT_WIDTH, 5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(60, 60, 60);
    doc.text(`${g.label} (${sorted.length} lançamento${sorted.length > 1 ? 's' : ''} — ${fmtMoneyPDF(Math.abs(subtotal))})`, MARGIN_LEFT + 2, currentStartY + 3.5);
    currentStartY += 5;

    const body = sorted.map(t => {
      const isPayment = (t.type === 'transferencia' || t.type === 'transfer') && t.destinationAccountId === card.id;
      const isInc = (t.type === 'receita' || t.type === 'income') && t.accountId === card.id;
      const isNegative = isPayment || isInc;
      const hasOrigDate = t.originalPurchaseDate && t.installmentNumber && t.installmentNumber >= 2;
      const disDate = (t.installmentNumber && t.installmentNumber >= 2) ? (t.postingDate || t.date) : t.date;
      const catName = isPayment ? 'Pagto. Fatura' : resolveCategoryName(t.categoryId, opts.categories);
      const installmentBadge = t.installmentNumber && t.totalInstallments
        ? `${t.installmentNumber}/${t.totalInstallments}`
        : '';
      const origDateInfo = hasOrigDate ? ` (compra ${fmtDateShort(t.originalPurchaseDate)})` : '';
      const desc = (t.description || '').replace(/\s*\(\d+\/\d+\)\s*$/, '') + origDateInfo;

      return [
        fmtDateShort(disDate),
        desc,
        catName,
        installmentBadge,
        isNegative ? '-' : '+',
        fmtMoneyPDF(t.amount),
      ];
    });

    autoTable(doc, {
      startY: currentStartY,
      margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
      head: [['Data', 'Descrição', 'Categoria', 'Parcela', 'Sinal', 'Valor']],
      body,
      theme: 'grid',
      styles: { fontSize: 6.5, cellPadding: 1.8, lineColor: [225, 225, 225], lineWidth: 0.1 },
      headStyles: { fillColor: [248, 250, 252], textColor: [80, 80, 80], fontStyle: 'bold', fontSize: 6 },
      columnStyles: {
        3: { halign: 'center' },
        4: { halign: 'center' },
        5: { halign: 'right' },
      },
      pageBreak: 'auto',
      didDrawPage: (data: any) => {
        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(150, 150, 150);
          doc.text('Fiducia — Gestão Financeira', MARGIN_LEFT, 287);
          doc.text(`Página ${i} de ${totalPages}`, PAGE_WIDTH - MARGIN_RIGHT, 287, { align: 'right' });
        }
      },
    });

    currentStartY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 2 : currentStartY + 10;
  }

  if (!hasAnyTx) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(130, 130, 130);
    doc.text('Nenhum lançamento nesta fatura.', MARGIN_LEFT, currentStartY);
  }

  const filename = generateFilename('fatura', card.name, periodStr);
  await savePdf(doc, filename);
}

function parseLocalDateForPdf(dateStr: string): number {
  if (!dateStr) return 0;
  const clean = dateStr.split('T')[0];
  const [y, m, d] = clean.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}
