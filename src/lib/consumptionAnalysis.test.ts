import { describe, expect, it } from 'vitest';
import type { Category, Invoice, Transaction } from '../types';
import { buildConsumptionAnalysis } from './consumptionAnalysis';

const tx = (overrides: Partial<Transaction>): Transaction => ({ id: 'tx', userId: 'user', type: 'despesa', amount: 100, date: '2026-08-10', description: 'Teste', status: 'pago', createdAt: '2026-08-10', ...overrides });
const categories = [{ id: 'food', userId: 'user', name: 'Alimentação', type: 'expense', icon: '', isDefault: false, createdAt: '' }] as Category[];

describe('buildConsumptionAnalysis', () => {
  it('separa despesas diretas e cartão sem duplicar pagamento de fatura', () => {
    const transactions = [
      tx({ id: 'direct', categoryId: 'food', amount: 300 }),
      tx({ id: 'card', categoryId: 'food', creditCardId: 'card', accountId: 'card', invoicePeriod: '2026-08', status: 'pendente', amount: 700 }),
      tx({ id: 'refund', type: 'receita', categoryId: 'food', creditCardId: 'card', accountId: 'card', invoicePeriod: '2026-08', status: 'pendente', amount: 100 }),
      tx({ id: 'payment', type: 'despesa', amount: 700 }),
    ];
    const invoices = [{ id: 'invoice', cardId: 'card', period: '2026-08', status: 'paga', totalAmount: 700, paymentTransactionIds: ['payment'] }] as Invoice[];
    const result = buildConsumptionAnalysis(transactions, invoices, categories, ['card'], '2026-08', '2026-08', '2026-07', '2026-07');

    expect(result.total).toBe(900);
    expect(result.directTotal).toBe(300);
    expect(result.cardTotal).toBe(600);
    expect(result.categories[0].entries).toHaveLength(3);
  });

  it('compara com o período anterior e evidencia itens sem categoria', () => {
    const result = buildConsumptionAnalysis([
      tx({ id: 'current', amount: 400, categoryId: undefined }),
      tx({ id: 'previous', amount: 250, categoryId: undefined, date: '2026-07-10' }),
    ], [], categories, [], '2026-08', '2026-08', '2026-07', '2026-07');

    expect(result.change).toBe(150);
    expect(result.changePercent).toBe(60);
    expect(result.uncategorizedTotal).toBe(400);
    expect(result.categories[0].name).toBe('Sem categoria');
  });
});
