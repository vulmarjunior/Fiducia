import type { Invoice, Transaction } from '../types';
import { getInvoicePaymentTransactionIds } from './invoicePayment';
import { buildMonthlyStatement, type MonthlyStatementEntry } from './monthlyStatement';

export interface DailyCashFlow {
  date: string;
  name: string;
  Receitas: number;
  Despesas: number;
  Saldo: number;
  Acumulado: number;
  entries: MonthlyStatementEntry[];
}

const isPending = (transaction: Transaction) => transaction.status === 'pendente' || transaction.status === 'pending';
const isIncome = (transaction: Transaction) => transaction.type === 'receita' || transaction.type === 'income';
const isExpense = (transaction: Transaction) => transaction.type === 'despesa' || transaction.type === 'expense';
const sumInCurrency = (entries: MonthlyStatementEntry[]) => entries.reduce((sum, entry) => sum + Math.round(entry.transaction.amount * 100), 0) / 100;
const roundCurrency = (value: number) => Math.round(value * 100) / 100;

export function buildDailyCashFlow(
  transactions: Transaction[],
  invoices: Invoice[],
  creditCardIds: string[],
  month: string,
  includePending: boolean,
): DailyCashFlow[] {
  const statement = buildMonthlyStatement(transactions, invoices, creditCardIds, month);
  const entries = [...statement.incomeEntries, ...statement.expenseEntries];

  if (includePending) {
    const cardIds = new Set(creditCardIds);
    const paymentIds = getInvoicePaymentTransactionIds(invoices);
    for (const transaction of transactions) {
      if (!transaction.date?.split('T')[0].startsWith(month) || !isPending(transaction)) continue;
      const isInvoicePayment = paymentIds.has(transaction.id || '');
      const belongsToCard = Boolean(transaction.creditCardId) || Boolean(transaction.accountId && cardIds.has(transaction.accountId));
      if (isInvoicePayment) entries.push({ transaction, kind: 'invoice_payment' });
      else if (!belongsToCard && isIncome(transaction)) entries.push({ transaction, kind: 'income' });
      else if (!belongsToCard && isExpense(transaction)) entries.push({ transaction, kind: 'account_expense' });
    }
  }

  const [year, monthNumber] = month.split('-').map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  let accumulated = 0;

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = String(index + 1).padStart(2, '0');
    const date = `${month}-${day}`;
    const dayEntries = entries
      .filter(entry => entry.transaction.date.split('T')[0] === date)
      .sort((a, b) => (b.transaction.createdAt || b.transaction.date).localeCompare(a.transaction.createdAt || a.transaction.date));
    const income = sumInCurrency(dayEntries.filter(entry => entry.kind === 'income'));
    const expense = sumInCurrency(dayEntries.filter(entry => entry.kind !== 'income'));
    const balance = roundCurrency(income - expense);
    accumulated = roundCurrency(accumulated + balance);
    return { date, name: day, Receitas: income, Despesas: expense, Saldo: balance, Acumulado: accumulated, entries: dayEntries };
  });
}
