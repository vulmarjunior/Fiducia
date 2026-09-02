import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  AccountFlowReportResult,
  CashFlowReportResult,
  CategoryReportResult,
  ReportFilters,
} from '../../types/reports';
import { formatCurrency } from '../utils';

// Prevenção de CSV Injection para Excel/Calc
function sanitizeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(str)) {
    return `"'${str.replace(/"/g, '""')}"`;
  }
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadCsvFile(content: string, filename: string) {
  const bom = '\uFEFF'; // UTF-8 BOM para o Excel abrir com acentuação correta
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function buildCategoryReportCsv(
  result: CategoryReportResult,
  filters: ReportFilters
): string {
  const title = result.type === 'expenses' ? 'Despesas por Categoria' : 'Receitas por Categoria';
  const lines: string[] = [
    `# ${title}`,
    `# Periodo: ${filters.selectedMonth}`,
    `# Situacao: ${filters.status === 'all' ? 'Todas' : filters.status === 'paid' ? 'Realizadas' : 'Pendentes'}`,
    `# Total: ${formatCurrency(result.total)}`,
    '',
    ['Categoria', 'Valor (R$)', '% do Total', 'Direto (R$)', 'Cartao (R$)', 'Lancamentos'].map(sanitizeCsvCell).join(';'),
  ];

  for (const cat of result.categories) {
    lines.push(
      [
        cat.categoryName,
        cat.total.toFixed(2).replace('.', ','),
        `${cat.percent}%`,
        (cat.directCents / 100).toFixed(2).replace('.', ','),
        (cat.cardCents / 100).toFixed(2).replace('.', ','),
        cat.entriesCount,
      ].map(sanitizeCsvCell).join(';')
    );
  }

  return lines.join('\r\n');
}

export function exportCategoryReportToCsv(
  result: CategoryReportResult,
  filters: ReportFilters
) {
  const csv = buildCategoryReportCsv(result, filters);
  downloadCsvFile(csv, `fiducia-${result.type}-${filters.selectedMonth}.csv`);
}

export function buildCashFlowReportCsv(
  result: CashFlowReportResult,
  filters: ReportFilters
): string {
  const lines: string[] = [
    '# Entradas x Saidas',
    `# Periodo: ${filters.selectedMonth}`,
    `# Agrupamento: ${filters.intervalType} (Acumulado: ${filters.accumulated ? 'Sim' : 'Nao'}, Incluir Pendentes: ${filters.includePending ? 'Sim' : 'Nao'})`,
    `# Total Entradas: ${formatCurrency(result.totalInflow)}`,
    `# Total Saidas: ${formatCurrency(result.totalOutflow)}`,
    `# Resultado Liquido: ${formatCurrency(result.netResult)}`,
    '',
    ['Periodo', 'Entradas (R$)', 'Saidas (R$)', 'Resultado (R$)', 'Saldo Final (R$)'].map(sanitizeCsvCell).join(';'),
  ];

  for (const pt of result.points) {
    lines.push(
      [
        pt.label,
        pt.inflow.toFixed(2).replace('.', ','),
        pt.outflow.toFixed(2).replace('.', ','),
        pt.result.toFixed(2).replace('.', ','),
        pt.endingBalance !== undefined ? pt.endingBalance.toFixed(2).replace('.', ',') : '-',
      ].map(sanitizeCsvCell).join(';')
    );
  }

  return lines.join('\r\n');
}

export function exportCashFlowReportToCsv(
  result: CashFlowReportResult,
  filters: ReportFilters
) {
  const csv = buildCashFlowReportCsv(result, filters);
  downloadCsvFile(csv, `fiducia-entradas-saidas-${filters.selectedMonth}.csv`);
}

export function buildAccountFlowReportCsv(
  result: AccountFlowReportResult,
  filters: ReportFilters
): string {
  const lines: string[] = [
    '# Fluxo por Conta',
    `# Periodo: ${filters.selectedMonth}`,
    `# Saldo Inicial Consolidado: ${formatCurrency(result.consolidatedStartingBalance)}`,
    `# Saldo Final Consolidado: ${formatCurrency(result.consolidatedEndingBalance)}`,
    `# Saldo Previsto Consolidado: ${formatCurrency(result.consolidatedProjectedEndingBalance)}`,
    '',
    ['Conta', 'Tipo', 'Saldo Inicial (R$)', 'Entradas (R$)', 'Saidas (R$)', 'Resultado (R$)', 'Saldo Final (R$)', 'Saldo Previsto (R$)'].map(sanitizeCsvCell).join(';'),
  ];

  for (const acc of result.accounts) {
    lines.push(
      [
        acc.accountName,
        acc.accountType,
        acc.startingBalance.toFixed(2).replace('.', ','),
        acc.inflow.toFixed(2).replace('.', ','),
        acc.outflow.toFixed(2).replace('.', ','),
        acc.netResult.toFixed(2).replace('.', ','),
        acc.endingBalance.toFixed(2).replace('.', ','),
        acc.projectedEndingBalance.toFixed(2).replace('.', ','),
      ].map(sanitizeCsvCell).join(';')
    );
  }

  if (result.unallocatedInvoices.length > 0) {
    lines.push('');
    lines.push('# Faturas com Conta a Definir (Obrigacoes Previstas)');
    lines.push(['Cartao', 'Periodo', 'Vencimento', 'Total (R$)', 'Pago (R$)', 'Residual (R$)'].map(sanitizeCsvCell).join(';'));
    for (const inv of result.unallocatedInvoices) {
      lines.push(
        [
          inv.cardName,
          inv.period,
          inv.dueDate || '-',
          (inv.totalAmountCents / 100).toFixed(2).replace('.', ','),
          (inv.paidAmountCents / 100).toFixed(2).replace('.', ','),
          (inv.remainingAmountCents / 100).toFixed(2).replace('.', ','),
        ].map(sanitizeCsvCell).join(';')
      );
    }
  }

  return lines.join('\r\n');
}

export function exportAccountFlowReportToCsv(
  result: AccountFlowReportResult,
  filters: ReportFilters
) {
  const csv = buildAccountFlowReportCsv(result, filters);
  downloadCsvFile(csv, `fiducia-fluxo-contas-${filters.selectedMonth}.csv`);
}

export function exportCategoryReportToPdf(
  result: CategoryReportResult,
  filters: ReportFilters
) {
  const doc = new jsPDF();
  const title = result.type === 'expenses' ? 'Relatório de Despesas por Categoria' : 'Relatório de Receitas por Categoria';

  doc.setFontSize(16);
  doc.text(title, 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Período: ${filters.selectedMonth}  |  Total: ${formatCurrency(result.total)}`, 14, 28);
  doc.text(`Emitido em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, 14, 34);

  const tableData = result.categories.map(cat => [
    cat.categoryName,
    formatCurrency(cat.total),
    `${cat.percent}%`,
    formatCurrency(cat.directCents / 100),
    formatCurrency(cat.cardCents / 100),
    cat.entriesCount.toString(),
  ]);

  autoTable(doc, {
    startY: 40,
    head: [['Categoria', 'Valor', '% Total', 'Direto', 'Cartão', 'Lançamentos']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: result.type === 'expenses' ? [220, 38, 38] : [16, 185, 129] },
  });

  const filename = `fiducia-${result.type}-${filters.selectedMonth}.pdf`;
  doc.save(filename);
}

export function exportCashFlowReportToPdf(
  result: CashFlowReportResult,
  filters: ReportFilters
) {
  const doc = new jsPDF();
  const periodLabel = filters.customRange
    ? `${filters.customRange.startDate} a ${filters.customRange.endDate}`
    : filters.selectedMonth;

  doc.setFontSize(16);
  doc.text('Relatório de Entradas × Saídas', 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(
    `Período: ${periodLabel}  |  Agrupamento: ${filters.intervalType}  |  Pendentes: ${filters.includePending ? 'Sim' : 'Não'}`,
    14,
    28
  );
  doc.text(
    `Entradas: ${formatCurrency(result.totalInflow)}  |  Saídas: ${formatCurrency(result.totalOutflow)}  |  Resultado: ${formatCurrency(result.netResult)}`,
    14,
    34
  );
  if (result.startingBalance !== undefined && result.endingBalance !== undefined) {
    doc.text(
      `Saldo Inicial: ${formatCurrency(result.startingBalance)}  |  Saldo Final: ${formatCurrency(result.endingBalance)}`,
      14,
      40
    );
  }

  const startY = result.startingBalance !== undefined ? 46 : 40;

  const tableData = result.points.map(pt => [
    pt.label,
    formatCurrency(pt.inflow),
    formatCurrency(pt.outflow),
    formatCurrency(pt.result),
    pt.endingBalance !== undefined ? formatCurrency(pt.endingBalance) : '-',
  ]);

  autoTable(doc, {
    startY,
    head: [['Período', 'Entradas', 'Saídas', 'Resultado Líquido', 'Saldo']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
  });

  const filename = `fiducia-entradas-saidas-${filters.selectedMonth}.pdf`;
  doc.save(filename);
}

export function exportAccountFlowReportToPdf(
  result: AccountFlowReportResult,
  filters: ReportFilters
) {
  const doc = new jsPDF();
  const periodLabel = filters.customRange
    ? `${filters.customRange.startDate} a ${filters.customRange.endDate}`
    : filters.selectedMonth;

  doc.setFontSize(16);
  doc.text('Relatório de Fluxo por Conta', 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Período: ${periodLabel}`, 14, 28);
  doc.text(
    `Saldo Inicial: ${formatCurrency(result.consolidatedStartingBalance)}  |  Saldo Final: ${formatCurrency(result.consolidatedEndingBalance)}  |  Previsto: ${formatCurrency(result.consolidatedProjectedEndingBalance)}`,
    14,
    34
  );

  const tableData = result.accounts.map(acc => [
    acc.accountName,
    acc.accountType === 'checking'
      ? 'Corrente'
      : acc.accountType === 'savings'
      ? 'Poupança'
      : acc.accountType === 'investment'
      ? 'Investimento'
      : acc.accountType === 'wallet'
      ? 'Carteira'
      : acc.accountType,
    formatCurrency(acc.startingBalance),
    formatCurrency(acc.inflow),
    formatCurrency(acc.outflow),
    formatCurrency(acc.netResult),
    formatCurrency(acc.endingBalance),
    formatCurrency(acc.projectedEndingBalance),
    acc.isReconciled ? 'Sim' : 'Não',
  ]);

  autoTable(doc, {
    startY: 42,
    head: [['Conta', 'Tipo', 'Inicial', 'Entradas', 'Saídas', 'Resultado', 'Final', 'Previsto', 'Conciliado']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 241] },
  });

  if (result.unallocatedInvoices.length > 0) {
    const finalY = (doc as any).lastAutoTable?.finalY || 100;
    doc.setFontSize(12);
    doc.setTextColor(30);
    doc.text('Faturas com Conta a Definir (Obrigações Previstas)', 14, finalY + 12);

    const invData = result.unallocatedInvoices.map(inv => [
      inv.cardName,
      inv.period,
      inv.dueDate || '-',
      formatCurrency(inv.totalAmountCents / 100),
      formatCurrency(inv.paidAmountCents / 100),
      formatCurrency(inv.remainingAmountCents / 100),
    ]);

    autoTable(doc, {
      startY: finalY + 16,
      head: [['Cartão', 'Período', 'Vencimento', 'Total', 'Pago', 'Residual']],
      body: invData,
      theme: 'striped',
      headStyles: { fillColor: [245, 158, 11] },
    });
  }

  const filename = `fiducia-fluxo-contas-${filters.selectedMonth}.pdf`;
  doc.save(filename);
}

