import type { Invoice, Transaction } from '../types';
import { getInvoicePaymentTransactionIds } from './invoicePayment';
import { isEffectivelyPaid } from './utils';

export type MonthlyStatementEntryKind = 'income' | 'account_expense' | 'invoice_payment';

export interface MonthlyStatementEntry {
  transaction: Transaction;
  kind: MonthlyStatementEntryKind;
}

export interface MonthlyStatement {
  month: string;
  incomeEntries: MonthlyStatementEntry[];
  accountExpenseEntries: MonthlyStatementEntry[];
  invoicePaymentEntries: MonthlyStatementEntry[];
  expenseEntries: MonthlyStatementEntry[];
  incomeTotal: number;
  accountExpenseTotal: number;
  invoicePaymentTotal: number;
  expenseTotal: number;
  balance: number;
}

const isIncome = (transaction: Transaction) => transaction.type === 'receita' || transaction.type === 'income';
const isExpense = (transaction: Transaction) => transaction.type === 'despesa' || transaction.type === 'expense';
const isTransfer = (transaction: Transaction) => transaction.type === 'transferencia' || transaction.type === 'transfer';
const transactionDate = (transaction: Transaction) => transaction.date?.split('T')[0] || '';
const newestFirst = (a: MonthlyStatementEntry, b: MonthlyStatementEntry) =>
  transactionDate(b.transaction).localeCompare(transactionDate(a.transaction));
const sumEntries = (entries: MonthlyStatementEntry[]) => entries.reduce((sum, entry) => sum + entry.transaction.amount, 0);

export function buildMonthlyStatement(
  transactions: Transaction[],
  invoices: Invoice[],
  creditCardIds: string[],
  month: string,
): MonthlyStatement {
  const cardIds = new Set(creditCardIds);
  const paymentIds = getInvoicePaymentTransactionIds(invoices);

  const incomeEntries: MonthlyStatementEntry[] = [];
  const accountExpenseEntries: MonthlyStatementEntry[] = [];
  const invoicePaymentEntries: MonthlyStatementEntry[] = [];

  for (const transaction of transactions) {
    if (!transactionDate(transaction).startsWith(month) || !isEffectivelyPaid(transaction)) continue;

    if (paymentIds.has(transaction.id || '')) {
      invoicePaymentEntries.push({ transaction, kind: 'invoice_payment' });
      continue;
    }

    const belongsToCard = Boolean(transaction.creditCardId) || Boolean(transaction.accountId && cardIds.has(transaction.accountId));
    if (belongsToCard || isTransfer(transaction)) continue;

    if (isIncome(transaction)) incomeEntries.push({ transaction, kind: 'income' });
    if (isExpense(transaction)) accountExpenseEntries.push({ transaction, kind: 'account_expense' });
  }

  incomeEntries.sort(newestFirst);
  accountExpenseEntries.sort(newestFirst);
  invoicePaymentEntries.sort(newestFirst);
  const expenseEntries = [...accountExpenseEntries, ...invoicePaymentEntries].sort(newestFirst);
  const incomeTotal = sumEntries(incomeEntries);
  const accountExpenseTotal = sumEntries(accountExpenseEntries);
  const invoicePaymentTotal = sumEntries(invoicePaymentEntries);
  const expenseTotal = accountExpenseTotal + invoicePaymentTotal;

  return {
    month,
    incomeEntries,
    accountExpenseEntries,
    invoicePaymentEntries,
    expenseEntries,
    incomeTotal,
    accountExpenseTotal,
    invoicePaymentTotal,
    expenseTotal,
    balance: incomeTotal - expenseTotal,
  };
}
