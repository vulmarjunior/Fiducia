import { describe, it, expect } from 'vitest';
import { getInvoicePeriod, getInvoiceStatus } from './creditCardUtils';

describe('getInvoicePeriod', () => {
  it('Compra antes do corte (deve ficar no mês atual)', () => {
    const purchaseDate = new Date(2025, 5, 3); // 3 de Junho
    expect(getInvoicePeriod(purchaseDate, 5)).toBe('2025-06');
  });

  it('Compra depois do corte (deve ir para o próximo mês)', () => {
    const purchaseDate = new Date(2025, 5, 7); // 7 de Junho
    expect(getInvoicePeriod(purchaseDate, 5)).toBe('2025-07');
  });

  it('Compra no dia exato do corte (deve ficar no mês atual)', () => {
    const purchaseDate = new Date(2025, 5, 5); // 5 de Junho
    expect(getInvoicePeriod(purchaseDate, 5)).toBe('2025-06');
  });

  it('Compra em dezembro após o corte (deve ir para janeiro do ano seguinte)', () => {
    const purchaseDate = new Date(2025, 11, 28); // 28 de Dezembro
    expect(getInvoicePeriod(purchaseDate, 5)).toBe('2026-01');
  });

  it('Compra em dezembro antes do corte (deve ficar em dezembro)', () => {
    const purchaseDate = new Date(2025, 11, 3); // 3 de Dezembro
    expect(getInvoicePeriod(purchaseDate, 5)).toBe('2025-12');
  });
});
