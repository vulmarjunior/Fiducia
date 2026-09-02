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
    `# Agrupamento: ${filters.intervalType} (Acumulado: ${filters.accumulated ? 'Sim' : 'Nao'})`,
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

  doc.save(`fiducia-${result.type}-${filters.selectedMonth}.pdf`);
}
