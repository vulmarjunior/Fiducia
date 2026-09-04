import { describe, it, expect } from 'vitest';
import { calculateCreditLimitUsage, getInvoicePeriod, getInvoiceStatus } from './creditCardUtils';

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
});
