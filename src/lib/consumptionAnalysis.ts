import type { Category, Invoice, Transaction } from '../types';
import { getInvoicePaymentTransactionIds } from './invoicePayment';
import { isEffectivelyPaid } from './utils';

export interface ConsumptionCategory {
  id: string;
  name: string;
  value: number;
  previousValue: number;
  change: number;
  changePercent: number | null;
  percent: number;
  directTotal: number;
  cardTotal: number;
  entries: Transaction[];
}

export interface ConsumptionAnalysis {
  total: number;
  previousTotal: number;
  change: number;
  changePercent: number | null;
  directTotal: number;
  cardTotal: number;
  uncategorizedTotal: number;
  categories: ConsumptionCategory[];
}

const round = (value: number) => Math.round(value * 100) / 100;
const isExpense = (transaction: Transaction) => transaction.type === 'despesa' || transaction.type === 'expense';
const isIncome = (transaction: Transaction) => transaction.type === 'receita' || transaction.type === 'income';
const isCancelled = (transaction: Transaction) => transaction.status === 'cancelado' || transaction.status === 'cancelled';

function belongsToPeriod(transaction: Transaction, cardIds: Set<string>, startMonth: string, endMonth: string) {
  const isCard = Boolean(transaction.creditCardId) || Boolean(transaction.accountId && cardIds.has(transaction.accountId));
  const month = isCard ? transaction.invoicePeriod : transaction.date?.slice(0, 7);
  return { isCard, matches: Boolean(month && month >= startMonth && month <= endMonth) };
}

export function buildConsumptionAnalysis(
  transactions: Transaction[],
  invoices: Invoice[],
  categories: Category[],
  creditCardIds: string[],
  startMonth: string,
  endMonth: string,
  previousStartMonth: string,
  previousEndMonth: string,
): ConsumptionAnalysis {
  const cardIds = new Set(creditCardIds);
  const paymentIds = getInvoicePaymentTransactionIds(invoices);
  const categoryNames = new Map(categories.map(category => [category.id, category.name]));

  const eligible = transactions.filter(transaction => {
    if (isCancelled(transaction) || paymentIds.has(transaction.id || '')) return false;
    const { isCard } = belongsToPeriod(transaction, cardIds, startMonth, endMonth);
    return isCard ? isExpense(transaction) || isIncome(transaction) : isExpense(transaction) && isEffectivelyPaid(transaction);
  });

  const currentEntries = eligible.filter(transaction => belongsToPeriod(transaction, cardIds, startMonth, endMonth).matches);
  const previousEntries = eligible.filter(transaction => belongsToPeriod(transaction, cardIds, previousStartMonth, previousEndMonth).matches);
  const sum = (items: Transaction[]) => items.reduce((total, transaction) => total + Math.round(transaction.amount * 100) * (isIncome(transaction) ? -1 : 1), 0) / 100;
  const total = sum(currentEntries);
  const previousTotal = sum(previousEntries);
  const categoryIds = new Set([...currentEntries, ...previousEntries].map(transaction => transaction.categoryId || 'uncategorized'));

  const categoryRows = [...categoryIds].map(id => {
    const entries = currentEntries.filter(transaction => (transaction.categoryId || 'uncategorized') === id);
    const previous = previousEntries.filter(transaction => (transaction.categoryId || 'uncategorized') === id);
    const value = sum(entries);
    const previousValue = sum(previous);
    const change = round(value - previousValue);
    return {
      id,
      name: id === 'uncategorized' ? 'Sem categoria' : categoryNames.get(id) || 'Categoria desconhecida',
      value,
      previousValue,
      change,
      changePercent: previousValue > 0 ? round(change / previousValue * 100) : null,
      percent: total > 0 ? round(value / total * 100) : 0,
      directTotal: sum(entries.filter(transaction => !belongsToPeriod(transaction, cardIds, startMonth, endMonth).isCard)),
      cardTotal: sum(entries.filter(transaction => belongsToPeriod(transaction, cardIds, startMonth, endMonth).isCard)),
      entries: entries.sort((a, b) => b.date.localeCompare(a.date)),
    };
  }).filter(row => row.value !== 0 || row.previousValue !== 0).sort((a, b) => b.value - a.value);

  const directEntries = currentEntries.filter(transaction => !belongsToPeriod(transaction, cardIds, startMonth, endMonth).isCard);
  const cardEntries = currentEntries.filter(transaction => belongsToPeriod(transaction, cardIds, startMonth, endMonth).isCard);
  const change = round(total - previousTotal);

  return {
    total,
    previousTotal,
    change,
    changePercent: previousTotal > 0 ? round(change / previousTotal * 100) : null,
    directTotal: sum(directEntries),
    cardTotal: sum(cardEntries),
    uncategorizedTotal: sum(currentEntries.filter(transaction => !transaction.categoryId)),
    categories: categoryRows,
  };
}
