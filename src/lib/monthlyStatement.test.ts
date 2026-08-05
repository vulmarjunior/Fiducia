import { describe, expect, it } from 'vitest';
import type { Invoice, Transaction } from '../types';
import { buildMonthlyStatement } from './monthlyStatement';

const tx = (overrides: Partial<Transaction>): Transaction => ({
  id: 'tx', userId: 'user', type: 'despesa', amount: 100, date: '2026-08-10',
  description: 'Lançamento', status: 'pago', createdAt: '2026-08-10', ...overrides,
});

describe('buildMonthlyStatement', () => {
  it('reconcilia receitas, despesas bancárias e pagamento legado de fatura', () => {
    const transactions = [
      tx({ id: 'income', type: 'receita', amount: 5000 }),
      tx({ id: 'expense', amount: 368.99 }),
      tx({ id: 'invoice-payment', type: 'transferencia', amount: 2000 }),
      tx({ id: 'card-purchase', creditCardId: 'card', amount: 900 }),
      tx({ id: 'pending', amount: 300, status: 'pendente' }),
    ];
    const invoices = [{ id: 'invoice', cardId: 'card', period: '2026-07', status: 'paga', totalAmount: 2000, paymentTransactionIds: ['invoice-payment'] }] as Invoice[];

    const result = buildMonthlyStatement(transactions, invoices, ['card'], '2026-08');

    expect(result.incomeTotal).toBe(5000);
    expect(result.accountExpenseTotal).toBe(368.99);
    expect(result.invoicePaymentTotal).toBe(2000);
    expect(result.expenseTotal).toBe(2368.99);
    expect(result.balance).toBe(2631.01);
    expect(result.expenseEntries.map(entry => entry.transaction.id)).toEqual(['expense', 'invoice-payment']);
  });

  it('exclui lançamentos de outro mês, pendentes, compras de cartão e transferências comuns', () => {
    const result = buildMonthlyStatement([
      tx({ id: 'other-month', date: '2026-07-31' }),
      tx({ id: 'pending', status: 'pendente' }),
      tx({ id: 'card', accountId: 'card' }),
      tx({ id: 'transfer', type: 'transferencia' }),
    ], [], ['card'], '2026-08');

    expect(result.incomeEntries).toHaveLength(0);
    expect(result.expenseEntries).toHaveLength(0);
  });
});
