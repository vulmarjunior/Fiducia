import type { Transaction } from '../types';
import { isEffectivelyPaid } from './utils';

export type TransactionDateFilter = 'month' | 'range' | 'all';
export type TransactionWithBalance = Transaction & { runningBalance?: number };

export interface TransactionViewOptions {
  accountId: string;
  accountBalance: number;
  tagIds: string[];
  dateFilter: TransactionDateFilter;
  month: string;
  startDate: string;
  endDate: string;
  searchTerm: string;
  aiSearchResultIds: Set<string> | null;
  sortOrder: 'asc' | 'desc';
}

export function amountMatchesSearch(amount: number, term: string): boolean {
  const representations = [
    amount.toString(),
    amount.toFixed(2),
    new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount),
    new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }).format(amount),
  ];
  if (representations.some((representation) => representation.includes(term))) return true;
  const parsedAmount = Number.parseFloat(term.replace(/\./g, '').replace(',', '.'));
  return !Number.isNaN(parsedAmount) && Math.abs(amount - parsedAmount) < 0.001;
}

export function processTransactions(
  transactions: Transaction[],
  options: TransactionViewOptions,
): TransactionWithBalance[] {
  let result: TransactionWithBalance[] = [...transactions];

  if (options.accountId !== 'all') {
    const accountTransactions = result
      .filter((transaction) => transaction.accountId === options.accountId || transaction.destinationAccountId === options.accountId)
      .sort((a, b) => {
        const dateDifference = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateDifference !== 0) return dateDifference;
        return new Date(a.createdAt || a.date).getTime() - new Date(b.createdAt || b.date).getTime();
      })
      .reverse();

    let currentBalance = options.accountBalance;
    const balancesById = new Map<string | undefined, number>();
    accountTransactions.forEach((transaction) => {
      balancesById.set(transaction.id, currentBalance);
      if (!isEffectivelyPaid(transaction)) return;
      if (transaction.accountId === options.accountId) {
        if (transaction.type === 'receita') currentBalance -= transaction.amount;
        if (transaction.type === 'despesa' || transaction.type === 'transferencia') currentBalance += transaction.amount;
      } else if (transaction.destinationAccountId === options.accountId && transaction.type === 'transferencia') {
        currentBalance -= transaction.amount;
      }
    });
    result = result.map((transaction) => ({ ...transaction, runningBalance: balancesById.get(transaction.id) }));
  }

  return result.filter((transaction) => {
    const matchesTags = options.tagIds.length === 0 || Boolean(
      transaction.tags?.length && options.tagIds.some((tagId) => transaction.tags!.includes(tagId)),
    );
    const matchesAccount = options.accountId === 'all'
      || transaction.accountId === options.accountId
      || transaction.destinationAccountId === options.accountId;
    const date = transaction.date.split('T')[0];
    const matchesDate = options.dateFilter === 'all'
      || (options.dateFilter === 'month' && date.startsWith(options.month))
      || (options.dateFilter === 'range' && date >= options.startDate && date <= options.endDate);
    const normalizedSearch = options.searchTerm.toLowerCase();
    const matchesSearch = options.aiSearchResultIds
      ? Boolean(transaction.id && options.aiSearchResultIds.has(transaction.id))
      : !normalizedSearch
        || transaction.description?.toLowerCase().includes(normalizedSearch)
        || amountMatchesSearch(transaction.amount, normalizedSearch);
    return !transaction.creditCardId && matchesTags && matchesAccount && matchesDate && matchesSearch;
  }).sort((a, b) => {
    const multiplier = options.sortOrder === 'asc' ? -1 : 1;
    const dateDifference = (new Date(b.date).getTime() - new Date(a.date).getTime()) * multiplier;
    if (dateDifference !== 0) return dateDifference;
    return (new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime()) * multiplier;
  });
}

export function summarizeTransactions(transactions: Transaction[], accountId: string) {
  return transactions.reduce((summary, transaction) => {
    if (!isEffectivelyPaid(transaction)) return summary;
    if (transaction.type === 'receita') summary.income += transaction.amount;
    if (transaction.type === 'despesa') summary.expense += transaction.amount;
    if (transaction.type === 'transferencia' && accountId !== 'all') {
      if (transaction.accountId === accountId) summary.expense += transaction.amount;
      if (transaction.destinationAccountId === accountId) summary.income += transaction.amount;
    }
    return summary;
  }, { income: 0, expense: 0 });
}

export function groupTransactionsByDate<T extends Transaction>(transactions: T[]): Record<string, T[]> {
  return transactions.reduce<Record<string, T[]>>((groups, transaction) => {
    const date = transaction.date.split('T')[0];
    (groups[date] ??= []).push(transaction);
    return groups;
  }, {});
}
