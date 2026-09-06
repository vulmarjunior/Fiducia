import { describe, it, expect } from 'vitest';
import { calculateCreditLimitUsage, getInvoicePeriod, transactionBelongsToCard } from './creditCardUtils';

describe('getInvoicePeriod', () => {
  it('Compra antes do corte (deve ficar no mês atual)', () => {
    const purchaseDate = new Date(2025, 5, 3);
    expect(getInvoicePeriod(purchaseDate, 5)).toBe('2025-06');
  });

  it('Compra depois do corte (deve ir para o próximo mês)', () => {
    const purchaseDate = new Date(2025, 5, 7);
    expect(getInvoicePeriod(purchaseDate, 5)).toBe('2025-07');
  });

  it('Compra no dia exato do corte (deve ficar no mês atual)', () => {
    const purchaseDate = new Date(2025, 5, 5);
    expect(getInvoicePeriod(purchaseDate, 5)).toBe('2025-06');
  });

  it('Compra em dezembro após o corte (deve ir para janeiro do ano seguinte)', () => {
    const purchaseDate = new Date(2025, 11, 28);
    expect(getInvoicePeriod(purchaseDate, 5)).toBe('2026-01');
  });

  it('Compra em dezembro antes do corte (deve ficar em dezembro)', () => {
    const purchaseDate = new Date(2025, 11, 3);
    expect(getInvoicePeriod(purchaseDate, 5)).toBe('2025-12');
  });
});

describe('transactionBelongsToCard', () => {
  it('reconhece lançamento atual somente por creditCardId', () => {
    expect(transactionBelongsToCard({ creditCardId: 'c6' }, 'c6')).toBe(true);
  });

  it('mantém compatibilidade com lançamento legado por accountId', () => {
    expect(transactionBelongsToCard({ accountId: 'c6' }, 'c6')).toBe(true);
  });

  it('mantém compatibilidade com pagamento legado por destinationAccountId', () => {
    expect(transactionBelongsToCard({ destinationAccountId: 'c6' }, 'c6')).toBe(true);
  });

  it('faz creditCardId prevalecer sobre vínculo legado divergente', () => {
    const tx = { creditCardId: 'c6', accountId: 'itau', destinationAccountId: 'itau' };
    expect(transactionBelongsToCard(tx, 'c6')).toBe(true);
    expect(transactionBelongsToCard(tx, 'itau')).toBe(false);
  });
});

describe('calculateCreditLimitUsage', () => {
  it('ignora compras de fatura totalmente paga', () => {
    const transactions = [
      { id: 'old', creditCardId: 'itau', accountId: 'itau', type: 'expense', amount: 500, invoicePeriod: '2026-07' },
      { id: 'current', creditCardId: 'itau', accountId: 'itau', type: 'expense', amount: 200, invoicePeriod: '2026-08' },
    ];
    const invoices = [
      { cardId: 'itau', period: '2026-07', status: 'paga', totalAmount: 500, paidAmount: 500 },
      { cardId: 'itau', period: '2026-08', status: 'aberta', totalAmount: 200, paidAmount: 0 },
    ];
    expect(calculateCreditLimitUsage('itau', transactions, invoices)).toBe(200);
  });

  it('considera apenas o saldo remanescente de pagamento parcial', () => {
    const transactions = [{ id: 'current', creditCardId: 'itau', accountId: 'itau', type: 'expense', amount: 1000, invoicePeriod: '2026-08' }];
    const invoices = [{ cardId: 'itau', period: '2026-08', status: 'parcial', totalAmount: 1000, paidAmount: 400 }];
    expect(calculateCreditLimitUsage('itau', transactions, invoices)).toBe(600);
  });

  it('inclui compra moderna sem accountId na utilização do limite', () => {
    const transactions = [{ id: 'modern', creditCardId: 'c6', type: 'expense', amount: 357.97, invoicePeriod: '2025-12' }];
    expect(calculateCreditLimitUsage('c6', transactions, [])).toBe(357.97);
  });
});
