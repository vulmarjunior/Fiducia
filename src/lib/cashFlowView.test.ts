import { describe, expect, it } from 'vitest';
import type { Invoice, Transaction } from '../types';
import { buildDailyCashFlow } from './cashFlowView';

const tx = (overrides: Partial<Transaction>): Transaction => ({
  id: 'tx', userId: 'user', type: 'despesa', amount: 100, date: '2026-08-05',
  description: 'Teste', status: 'pago', createdAt: '2026-08-05', ...overrides,
});

describe('buildDailyCashFlow', () => {
  it('reconcilia o mês por dia incluindo pagamento vinculado de fatura', () => {
    const transactions = [
      tx({ id: 'income', type: 'receita', amount: 3000, date: '2026-08-01' }),
      tx({ id: 'expense', amount: 368.99, date: '2026-08-05' }),
      tx({ id: 'payment', type: 'transferencia', amount: 2000, date: '2026-08-10' }),
      tx({ id: 'card-purchase', creditCardId: 'card', amount: 700, date: '2026-08-06' }),
    ];
    const invoices = [{ id: 'invoice', cardId: 'card', period: '2026-07', status: 'paga', totalAmount: 2000, paymentTransactionIds: ['payment'] }] as Invoice[];
    const days = buildDailyCashFlow(transactions, invoices, ['card'], '2026-08', false);

    expect(days[0].Receitas).toBe(3000);
    expect(days[4].Despesas).toBe(368.99);
    expect(days[9].Despesas).toBe(2000);
    expect(days.at(-1)?.Acumulado).toBe(631.01);
  });

  it('inclui pendentes somente quando solicitado e ignora compras de cartão', () => {
    const pending = tx({ id: 'pending', amount: 250, status: 'pendente' });
    const card = tx({ id: 'card', amount: 500, status: 'pendente', creditCardId: 'card' });

    expect(buildDailyCashFlow([pending, card], [], ['card'], '2026-08', false)[4].entries).toHaveLength(0);
    expect(buildDailyCashFlow([pending, card], [], ['card'], '2026-08', true)[4].entries.map(entry => entry.transaction.id)).toEqual(['pending']);
  });
});
