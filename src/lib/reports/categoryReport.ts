import type { Category, Invoice } from '../../types';
import type {
  CategoryDistributionItem,
  CategoryEvolutionPoint,
  CategoryReportResult,
  NormalizedTransaction,
  PaymentStatusFilter,
  ReportFilters,
} from '../../types/reports';
import { fromCents, getReportDiagnostics, toCents } from './normalize';
import { generateBuckets, getMonthBounds } from './periods';

function getInvoiceStatus(
  tx: NormalizedTransaction,
  invoices: Invoice[]
): 'paga' | 'a_quitar' | 'parcial' {
  if (!tx.isCard) {
    return tx.status === 'paid' ? 'paga' : 'a_quitar';
  }

  const invoice = invoices.find(
    i => i.cardId === tx.cardId && i.period === tx.invoicePeriod
  );

  if (!invoice) {
    return tx.status === 'paid' ? 'paga' : 'a_quitar';
  }

  if (invoice.status === 'paga') return 'paga';
  if (invoice.status === 'parcial') return 'parcial';
  return 'a_quitar';
}

function matchesStatusFilter(
  tx: NormalizedTransaction,
  filter: PaymentStatusFilter,
  invoices: Invoice[]
): boolean {
  if (filter === 'all') return true;

  if (tx.isCard) {
    const invStatus = getInvoiceStatus(tx, invoices);
    if (filter === 'paid') return invStatus === 'paga';
    // 'pending' inclui 'a_quitar' e 'parcial'
    return invStatus === 'a_quitar' || invStatus === 'parcial';
  }

  if (filter === 'paid') return tx.status === 'paid';
  return tx.status === 'pending';
}

function getCategoryDescendants(categoryId: string, categories: Category[]): Set<string> {
  const result = new Set<string>([categoryId]);
  const queue = [categoryId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const cat of categories) {
      if (cat.parentId === current && !result.has(cat.id || '')) {
        const id = cat.id || '';
        result.add(id);
        queue.push(id);
      }
    }
  }

  return result;
}

export function buildCategoryReport(
  type: 'expenses' | 'income',
  transactions: NormalizedTransaction[],
  categories: Category[],
  invoices: Invoice[],
  filters: ReportFilters
): CategoryReportResult {
  const { selectedMonth, customRange, categoryIds, originIds, status, intervalType } = filters;
  const { startDate, endDate } = customRange || getMonthBounds(selectedMonth);

  // Expansão de categorias para incluir filhas caso pai tenha sido selecionada
  let allowedCategoryIds: Set<string> | null = null;
  if (categoryIds !== undefined) {
    if (categoryIds.length === 0) {
      // Seleção vazia explícita: não mostra nada
      allowedCategoryIds = new Set();
    } else {
      allowedCategoryIds = new Set();
      for (const id of categoryIds) {
        const set = getCategoryDescendants(id, categories);
        for (const childId of set) allowedCategoryIds.add(childId);
      }
    }
  }

  const allowedOrigins = originIds ? new Set(originIds) : null;

  // Compras de cartão sem período de fatura derivável: expostas como diagnóstico,
  // nunca somadas a um mês inventado
  const noPeriodCardEntries = transactions.filter(tx =>
    tx.isCard && !tx.isInvoicePayment && !tx.invoicePeriod &&
    tx.isValid && tx.status !== 'cancelled' &&
    (type === 'expenses' ? (tx.type === 'expense' || tx.isCredit) : false) &&
    (allowedOrigins === null ||
      (allowedOrigins.size > 0 && tx.cardId !== undefined && allowedOrigins.has(tx.cardId)))
  );
  let itemsWithoutInvoicePeriodTotalCents = 0;
  for (const tx of noPeriodCardEntries) {
    itemsWithoutInvoicePeriodTotalCents += type === 'expenses' && tx.isCredit ? -tx.amountCents : tx.amountCents;
  }

  // Filtragem dos itens elegíveis
  const eligibleTransactions = transactions.filter(tx => {
    // Registros com data/valor inválidos são excluídos e contados no diagnóstico
    if (tx.isValid === false) return false;

    // Cancelados nunca entram
    if (tx.status === 'cancelled') return false;

    // Nunca incluir transferências
    if (tx.type === 'transfer') return false;

    // Nunca incluir pagamentos de fatura em relatório de despesa/receita
    if (tx.isInvoicePayment) return false;

    // Se for despesas:
    if (type === 'expenses') {
      if (tx.isCard) {
        // No cartão, despesas normais OU créditos (que abatem)
        // Período do cartão é o invoicePeriod
        if (!tx.invoicePeriod) return false; // sem período → grupo de diagnóstico
        const period = tx.invoicePeriod;
        const matchesMonth = customRange
          ? (tx.date >= startDate && tx.date <= endDate)
          : period === selectedMonth;
        if (!matchesMonth) return false;
      } else {
        // Direto em conta: deve ser despesa
        if (tx.type !== 'expense') return false;
        if (tx.date < startDate || tx.date > endDate) return false;
      }
    }

    // Se for receitas:
    if (type === 'income') {
      // Cartão não gera receita em categoria (créditos de cartão reduzem despesa)
      if (tx.isCard) return false;
      if (tx.type !== 'income') return false;
      if (tx.date < startDate || tx.date > endDate) return false;
    }

    // Filtro de status
    if (!matchesStatusFilter(tx, status, invoices)) return false;

    // Filtro de categoria
    if (allowedCategoryIds !== null) {
      if (!allowedCategoryIds.has(tx.categoryId)) return false;
    }

    // Filtro de origem
    if (allowedOrigins !== null) {
      if (allowedOrigins.size === 0) return false;
      const originId = tx.isCard ? tx.cardId : tx.accountId;
      if (!originId || !allowedOrigins.has(originId)) return false;
    }

    return true;
  });

  // Agrupamento por Categoria
  const catMap = new Map<string, {
    totalCents: number;
    directCents: number;
    cardCents: number;
    entries: NormalizedTransaction[];
  }>();

  let overallTotalCents = 0;
  const itemsWithoutInvoiceDayEntries: NormalizedTransaction[] = [];
  let itemsWithoutInvoiceDayTotalCents = 0;
  const itemsWithoutInvoicePeriodEntries: NormalizedTransaction[] = noPeriodCardEntries;

  for (const tx of eligibleTransactions) {
    let itemCents = tx.amountCents;
    if (type === 'expenses' && tx.isCredit) {
      // Crédito de cartão abate despesa
      itemCents = -tx.amountCents;
    }

    overallTotalCents += itemCents;

    let group = catMap.get(tx.categoryId);
    if (!group) {
      group = { totalCents: 0, directCents: 0, cardCents: 0, entries: [] };
      catMap.set(tx.categoryId, group);
    }

    group.totalCents += itemCents;
    if (tx.isCard) {
      group.cardCents += itemCents;
    } else {
      group.directCents += itemCents;
    }
    group.entries.push(tx);

    // Checagem de data para evolução temporal de cartão
    if (tx.isCard && intervalType !== 'month') {
      const txDayDate = tx.raw.postingDate || tx.date;
      if (txDayDate < startDate || txDayDate > endDate) {
        itemsWithoutInvoiceDayEntries.push(tx);
        itemsWithoutInvoiceDayTotalCents += itemCents;
      }
    }
  }

  let hasNegativeCategories = false;
  const categoriesList: CategoryDistributionItem[] = [];

  for (const [catId, data] of catMap.entries()) {
    if (data.totalCents < 0) {
      hasNegativeCategories = true;
    }

    const catObj = categories.find(c => c.id === catId);
    let categoryName = 'Sem categoria';
    if (catId === 'sem_categoria') {
      categoryName = 'Sem categoria';
    } else if (catObj) {
      categoryName = catObj.name;
    } else if (catId === 'Pagamento de Cartão') {
      categoryName = 'Pagamento de Cartão';
    } else {
      categoryName = 'Categoria desconhecida';
    }

    const percent = overallTotalCents > 0
      ? Math.round((data.totalCents / overallTotalCents) * 1000) / 10
      : 0;

    categoriesList.push({
      categoryId: catId,
      categoryName,
      icon: catObj?.icon,
      totalCents: data.totalCents,
      total: fromCents(data.totalCents),
      percent,
      directCents: data.directCents,
      cardCents: data.cardCents,
      entriesCount: data.entries.length,
      entries: data.entries,
    });
  }

  // Ordenação decrescente por total
  categoriesList.sort((a, b) => b.totalCents - a.totalCents);

  // Evolução temporal (fonte canônica em centavos; reais derivados para retrocompatibilidade)
  const buckets = generateBuckets(startDate, endDate, intervalType);
  const evolution: CategoryEvolutionPoint[] = buckets.map(b => ({
    periodKey: b.key,
    label: b.label,
    values: {},
    total: 0,
    entriesCount: 0,
    valuesCents: {},
    totalCents: 0,
  }));

  for (const tx of eligibleTransactions) {
    let itemCents = tx.amountCents;
    if (type === 'expenses' && tx.isCredit) {
      itemCents = -tx.amountCents;
    }

    // Cartão sem período de fatura não entra em buckets mensais inventados
    if (tx.isCard && !tx.invoicePeriod) continue;

    // Data a considerar para o bucket
    let targetDate = tx.date;
    if (tx.isCard) {
      const posting = tx.raw.postingDate || tx.date;
      if (posting >= startDate && posting <= endDate) {
        targetDate = posting;
      } else {
        // Fora do intervalo civil do mês da fatura: não posiciona em bucket diário/semanal
        if (intervalType !== 'month') {
          continue;
        }
      }
    }

    // Encontra o bucket correspondente
    let bucketIdx = -1;
    if (intervalType === 'month') {
      const monthKey = tx.isCard
        ? (tx.invoicePeriod || tx.month || tx.date.slice(0, 7))
        : (tx.month || tx.date.slice(0, 7));
      bucketIdx = buckets.findIndex(b => b.key === monthKey);
    } else {
      bucketIdx = buckets.findIndex(
        b => targetDate >= b.startDate && targetDate <= b.endDate
      );
    }

    if (bucketIdx !== -1) {
      const pt = evolution[bucketIdx];
      pt.valuesCents[tx.categoryId] = (pt.valuesCents[tx.categoryId] || 0) + itemCents;
      pt.totalCents += itemCents;
      pt.entriesCount += 1;
      pt.values[tx.categoryId] = Math.round(fromCents(pt.valuesCents[tx.categoryId]) * 100) / 100;
      pt.total = Math.round(fromCents(pt.totalCents) * 100) / 100;
    }
  }

  const diagnostics = getReportDiagnostics(
    transactions.map(tx => tx.raw),
    transactions
  );

  return {
    type,
    totalCents: overallTotalCents,
    total: fromCents(overallTotalCents),
    categories: categoriesList,
    evolution,
    hasNegativeCategories,
    itemsWithoutInvoiceDayTotal: fromCents(itemsWithoutInvoiceDayTotalCents),
    itemsWithoutInvoiceDayEntries,
    itemsWithoutInvoicePeriodTotal: fromCents(itemsWithoutInvoicePeriodTotalCents),
    itemsWithoutInvoicePeriodEntries,
    diagnostics,
  };
}
