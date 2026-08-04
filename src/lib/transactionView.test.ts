import { describe, expect, it } from 'vitest';
import type { Transaction } from '../types';
import { amountMatchesSearch, groupTransactionsByDate, processTransactions, summarizeTransactions } from './transactionView';

const transaction = (overrides: Partial<Transaction>): Transaction => ({
  id: 'tx', userId: 'user', type: 'despesa', amount: 100, date: '2026-08-04',
  description: 'Mercado', status: 'pago', createdAt: '2026-08-04T12:00:00.000Z',
  ...overrides,
});

const options = {
  accountId: 'all', accountBalance: 0, tagIds: [], dateFilter: 'all' as const,
  month: '2026-08', startDate: '2026-08-01', endDate: '2026-08-31',
  searchTerm: '', aiSearchResultIds: null, sortOrder: 'desc' as const,
};

describe('transactionView', () => {
  it('finds amounts written in Brazilian notation', () => {
    expect(amountMatchesSearch(1234.56, '1.234,56')).toBe(true);
    expect(amountMatchesSearch(1234.56, '999,00')).toBe(false);
  });

  it('filters card entries, dates, tags and text without mutating the source', () => {
    const source = [
      transaction({ id: 'visible', tags: ['food'] }),
      transaction({ id: 'card', creditCardId: 'card-a' }),
      transaction({ id: 'old', date: '2026-07-01' }),
    ];
    const result = processTransactions(source, { ...options, dateFilter: 'month', tagIds: ['food'], searchTerm: 'mercado' });
    expect(result.map((item) => item.id)).toEqual(['visible']);
    expect(source[0]).not.toHaveProperty('runningBalance');
  });

  it('calculates running balance backwards for an account', () => {
    const result = processTransactions([
      transaction({ id: 'older', accountId: 'account-a', amount: 200, date: '2026-08-01' }),
      transaction({ id: 'newer', accountId: 'account-a', type: 'receita', amount: 500, date: '2026-08-02' }),
    ], { ...options, accountId: 'account-a', accountBalance: 1_300 });
    expect(result.find((item) => item.id === 'newer')?.runningBalance).toBe(1_300);
    expect(result.find((item) => item.id === 'older')?.runningBalance).toBe(800);
  });

  it('summarizes transfers from the selected account and groups dates', () => {
    const entries = [
      transaction({ id: 'expense', accountId: 'account-a', amount: 100 }),
      transaction({ id: 'transfer', type: 'transferencia', accountId: 'account-a', destinationAccountId: 'account-b', amount: 300 }),
    ];
    expect(summarizeTransactions(entries, 'account-a')).toEqual({ income: 0, expense: 400 });
    expect(Object.keys(groupTransactionsByDate(entries))).toEqual(['2026-08-04']);
  });
});
