import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  AccountFlowReportResult,
  CashFlowReportResult,
  CategoryReportResult,
  ReportFilters,
} from '../../types/reports';
import { formatCurrency } from '../utils';

export interface ReportExportMeta {
  categoryNames?: Record<string, string>;
  originNames?: Record<string, string>;
}

function getPeriodLabel(filters: ReportFilters): string {
  return filters.customRange
    ? `${filters.customRange.startDate} a ${filters.customRange.endDate}`
    : filters.selectedMonth;
}

function getStatusLabel(status: ReportFilters['status']): string {
  return status === 'all' ? 'Todas' : status === 'paid' ? 'Realizadas' : 'Pendentes';
}

function formatSelectionNames(
  ids: string[] | undefined,
  names: Record<string, string> | undefined
): string {
  if (ids === undefined) return 'Todas';
  if (ids.length === 0) return 'Nenhuma';
  return ids.map(id => names?.[id] || id).join(', ');
}

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
  filters: ReportFilters,
  meta?: ReportExportMeta
): string {
  const title = result.type === 'expenses' ? 'Despesas por Categoria' : 'Receitas por Categoria';
  const lines: string[] = [
    `# ${title}`,
    `# Periodo: ${getPeriodLabel(filters)}`,
    `# Situacao: ${getStatusLabel(filters.status)}`,
    `# Categorias: ${formatSelectionNames(filters.categoryIds, meta?.categoryNames)}`,
    `# Origens: ${formatSelectionNames(filters.originIds, meta?.originNames)}`,
    `# Agrupamento: ${filters.intervalType} (Acumulado: ${filters.accumulated ? 'Sim' : 'Nao'})`,
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

  if (result.itemsWithoutInvoicePeriodTotal !== 0) {
    lines.push('');
    lines.push(`# Compras de cartao sem periodo de fatura: ${result.itemsWithoutInvoicePeriodTotal.toFixed(2).replace('.', ',')}`);
    for (const tx of result.itemsWithoutInvoicePeriodEntries) {
      lines.push(
        [
          tx.description || 'Sem descricao',
          tx.categoryName,
          (tx.amountCents / 100).toFixed(2).replace('.', ','),
        ].map(sanitizeCsvCell).join(';')
      );
    }
  }

  if (result.itemsWithoutInvoiceDayTotal !== 0) {
    lines.push('');
    lines.push(`# Compras de fatura fora do mes civil: ${result.itemsWithoutInvoiceDayTotal.toFixed(2).replace('.', ',')}`);
    for (const tx of result.itemsWithoutInvoiceDayEntries) {
      lines.push(
        [
          tx.description || 'Sem descricao',
          tx.categoryName,
          (tx.amountCents / 100).toFixed(2).replace('.', ','),
        ].map(sanitizeCsvCell).join(';')
      );
    }
  }

  if (result.diagnostics.invalidCount > 0) {
    lines.push('');
    lines.push(`# Diagnostico: ${result.diagnostics.invalidCount} registro(s) nao contabilizados por data/valor invalido; ${result.diagnostics.excludedCount} cancelado(s) excluido(s).`);
  }

  return lines.join('\r\n');
}

export function exportCategoryReportToCsv(
  result: CategoryReportResult,
  filters: ReportFilters,
  meta?: ReportExportMeta
) {
  const csv = buildCategoryReportCsv(result, filters, meta);
  downloadCsvFile(csv, `fiducia-${result.type}-${filters.selectedMonth}.csv`);
}

export function buildCashFlowReportCsv(
  result: CashFlowReportResult,
  filters: ReportFilters,
  meta?: ReportExportMeta
): string {
  const lines: string[] = [
    '# Entradas x Saidas',
    `# Periodo: ${getPeriodLabel(filters)}`,
    `# Contas: ${formatSelectionNames(filters.originIds, meta?.originNames)}`,
    `# Agrupamento: ${filters.intervalType} (Acumulado: ${filters.accumulated ? 'Sim' : 'Nao'}, Incluir Pendentes: ${filters.includePending ? 'Sim' : 'Nao'})`,
    `# Total Entradas: ${formatCurrency(result.totalInflow)}`,
    `# Total Saidas: ${formatCurrency(result.totalOutflow)}`,
    `# Resultado Liquido: ${formatCurrency(result.netResult)}`,
    result.openingCapitalCents !== 0
      ? `# Capital de abertura (contas abertas no periodo): ${formatCurrency(result.openingCapitalCents / 100)}`
      : '# Capital de abertura: 0',
    result.priorPendingCents !== 0
      ? `# Pendentes anteriores ao periodo (nao incorporados): ${formatCurrency(result.priorPendingCents / 100)}`
      : null,
    '',
    ['Periodo', 'Entradas (R$)', 'Saidas (R$)', 'Resultado (R$)', 'Saldo Final (R$)'].map(sanitizeCsvCell).join(';'),
  ].filter((line): line is string => line !== null);

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

  if (result.diagnostics.invalidCount > 0) {
    lines.push('');
    lines.push(`# Diagnostico: ${result.diagnostics.invalidCount} registro(s) nao contabilizados por data/valor invalido; ${result.diagnostics.excludedCount} cancelado(s) excluido(s).`);
  }

  return lines.join('\r\n');
}

export function exportCashFlowReportToCsv(
  result: CashFlowReportResult,
  filters: ReportFilters,
  meta?: ReportExportMeta
) {
  const csv = buildCashFlowReportCsv(result, filters, meta);
  downloadCsvFile(csv, `fiducia-entradas-saidas-${filters.selectedMonth}.csv`);
}

export function buildAccountFlowReportCsv(
  result: AccountFlowReportResult,
  filters: ReportFilters,
  meta?: ReportExportMeta
): string {
  const lines: string[] = [
    '# Fluxo por Conta',
    `# Periodo: ${getPeriodLabel(filters)}`,
    `# Situacao: ${getStatusLabel(filters.status)} | Incluir Pendentes: ${filters.includePending ? 'Sim' : 'Nao'}`,
    `# Contas: ${formatSelectionNames(filters.originIds, meta?.originNames)}`,
    `# Saldo Inicial Consolidado: ${formatCurrency(result.consolidatedStartingBalance)}`,
    result.consolidatedOpeningCapitalCents !== 0
      ? `# Capital de abertura (contas abertas no periodo): ${formatCurrency(result.consolidatedOpeningCapital)}`
      : null,
    `# Saldo Final Consolidado: ${formatCurrency(result.consolidatedEndingBalance)}`,
    `# Saldo Previsto Consolidado: ${formatCurrency(result.consolidatedProjectedEndingBalance)}`,
    result.consolidatedPriorPendingCents !== 0
      ? `# Pendentes anteriores ao periodo (nao incorporados): ${formatCurrency(result.consolidatedPriorPending)}`
      : null,
    '',
    ['Conta', 'Tipo', 'Saldo Inicial (R$)', 'Capital (R$)', 'Entradas (R$)', 'Saidas (R$)', 'Resultado (R$)', 'Saldo Final (R$)', 'Saldo Previsto (R$)', 'Conciliado'].map(sanitizeCsvCell).join(';'),
  ].filter((line): line is string => line !== null);

  for (const acc of result.accounts) {
    lines.push(
      [
        acc.accountName,
        acc.accountType,
        acc.startingBalance.toFixed(2).replace('.', ','),
        acc.openingCapital.toFixed(2).replace('.', ','),
        acc.inflow.toFixed(2).replace('.', ','),
        acc.outflow.toFixed(2).replace('.', ','),
        acc.netResult.toFixed(2).replace('.', ','),
        acc.endingBalance.toFixed(2).replace('.', ','),
        acc.projectedEndingBalance.toFixed(2).replace('.', ','),
        acc.isReconciled ? 'Sim' : 'Nao',
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

  if (result.diagnostics.invalidCount > 0) {
    lines.push('');
    lines.push(`# Diagnostico: ${result.diagnostics.invalidCount} registro(s) nao contabilizados por data/valor invalido; ${result.diagnostics.excludedCount} cancelado(s) excluido(s).`);
  }

  return lines.join('\r\n');
}

export function exportAccountFlowReportToCsv(
  result: AccountFlowReportResult,
  filters: ReportFilters,
  meta?: ReportExportMeta
) {
  const csv = buildAccountFlowReportCsv(result, filters, meta);
  downloadCsvFile(csv, `fiducia-fluxo-contas-${filters.selectedMonth}.csv`);
}

export function exportCategoryReportToPdf(
  result: CategoryReportResult,
  filters: ReportFilters,
  meta?: ReportExportMeta
) {
  const doc = new jsPDF();
  const title = result.type === 'expenses' ? 'Relatório de Despesas por Categoria' : 'Relatório de Receitas por Categoria';

  doc.setFontSize(16);
  doc.text(title, 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Período: ${getPeriodLabel(filters)}  |  Situação: ${getStatusLabel(filters.status)}`, 14, 28);
  doc.text(`Categorias: ${formatSelectionNames(filters.categoryIds, meta?.categoryNames)}`, 14, 34);
  doc.text(`Origens: ${formatSelectionNames(filters.originIds, meta?.originNames)}`, 14, 40);
  doc.text(`Agrupamento: ${filters.intervalType}  |  Total: ${formatCurrency(result.total)}`, 14, 46);
  doc.text(`Emitido em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, 14, 52);

  const tableData = result.categories.map(cat => [
    cat.categoryName,
    formatCurrency(cat.total),
    `${cat.percent}%`,
    formatCurrency(cat.directCents / 100),
    formatCurrency(cat.cardCents / 100),
    cat.entriesCount.toString(),
  ]);

  autoTable(doc, {
    startY: 58,
    head: [['Categoria', 'Valor', '% Total', 'Direto', 'Cartão', 'Lançamentos']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: result.type === 'expenses' ? [220, 38, 38] : [16, 185, 129] },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 100;

  if (result.itemsWithoutInvoicePeriodTotal !== 0) {
    doc.setFontSize(11);
    doc.setTextColor(30);
    doc.text(`Compras de cartão sem período de fatura: ${formatCurrency(result.itemsWithoutInvoicePeriodTotal)}`, 14, finalY + 12);
  }

  if (result.itemsWithoutInvoiceDayTotal !== 0) {
    doc.setFontSize(11);
    doc.setTextColor(30);
    doc.text(`Compras de fatura fora do mês civil: ${formatCurrency(result.itemsWithoutInvoiceDayTotal)}`, 14, finalY + (result.itemsWithoutInvoicePeriodTotal !== 0 ? 20 : 12));
  }

  if (result.diagnostics.invalidCount > 0) {
    doc.setFontSize(9);
    doc.setTextColor(180);
    doc.text(
      `Diagnóstico: ${result.diagnostics.invalidCount} registro(s) não contabilizados por data/valor inválido; ${result.diagnostics.excludedCount} cancelado(s) excluído(s).`,
      14,
      finalY + (result.itemsWithoutInvoicePeriodTotal !== 0 || result.itemsWithoutInvoiceDayTotal !== 0 ? 28 : 12)
    );
  }

  const filename = `fiducia-${result.type}-${filters.selectedMonth}.pdf`;
  doc.save(filename);
}

export function exportCashFlowReportToPdf(
  result: CashFlowReportResult,
  filters: ReportFilters,
  meta?: ReportExportMeta
) {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text('Relatório de Entradas × Saídas', 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(
    `Período: ${getPeriodLabel(filters)}  |  Agrupamento: ${filters.intervalType}  |  Pendentes: ${filters.includePending ? 'Sim' : 'Não'}`,
    14,
    28
  );
  doc.text(`Contas: ${formatSelectionNames(filters.originIds, meta?.originNames)}`, 14, 34);
  doc.text(
    `Entradas: ${formatCurrency(result.totalInflow)}  |  Saídas: ${formatCurrency(result.totalOutflow)}  |  Resultado: ${formatCurrency(result.netResult)}`,
    14,
    40
  );
  if (result.startingBalance !== undefined && result.endingBalance !== undefined) {
    doc.text(
      `Saldo Inicial: ${formatCurrency(result.startingBalance)}  |  Saldo Final: ${formatCurrency(result.endingBalance)}`,
      14,
      46
    );
  }
  if (result.openingCapitalCents !== 0) {
    doc.text(`Capital de abertura (contas abertas no período): ${formatCurrency(result.openingCapitalCents / 100)}`, 14, 52);
  }
  if (result.priorPendingCents !== 0) {
    doc.text(`Pendentes anteriores ao período (não incorporados): ${formatCurrency(result.priorPendingCents / 100)}`, 14, 58);
  }

  const startY = 64;

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
  filters: ReportFilters,
  meta?: ReportExportMeta
) {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text('Relatório de Fluxo por Conta', 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Período: ${getPeriodLabel(filters)}  |  Situação: ${getStatusLabel(filters.status)}  |  Pendentes: ${filters.includePending ? 'Sim' : 'Não'}`, 14, 28);
  doc.text(`Contas: ${formatSelectionNames(filters.originIds, meta?.originNames)}`, 14, 34);
  doc.text(
    `Saldo Inicial: ${formatCurrency(result.consolidatedStartingBalance)}  |  Saldo Final: ${formatCurrency(result.consolidatedEndingBalance)}  |  Previsto: ${formatCurrency(result.consolidatedProjectedEndingBalance)}`,
    14,
    40
  );
  if (result.consolidatedOpeningCapitalCents !== 0) {
    doc.text(`Capital de abertura (contas abertas no período): ${formatCurrency(result.consolidatedOpeningCapital)}`, 14, 46);
  }
  if (result.consolidatedPriorPendingCents !== 0) {
    doc.text(`Pendentes anteriores ao período (não incorporados): ${formatCurrency(result.consolidatedPriorPending)}`, 14, 52);
  }

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
    formatCurrency(acc.openingCapital),
    formatCurrency(acc.inflow),
    formatCurrency(acc.outflow),
    formatCurrency(acc.netResult),
    formatCurrency(acc.endingBalance),
    formatCurrency(acc.projectedEndingBalance),
    acc.isReconciled ? 'Sim' : 'Não',
  ]);

  autoTable(doc, {
    startY: 58,
    head: [['Conta', 'Tipo', 'Inicial', 'Capital', 'Entradas', 'Saídas', 'Resultado', 'Final', 'Previsto', 'Conciliado']],
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

