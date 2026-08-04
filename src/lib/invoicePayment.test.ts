import { describe, expect, it } from 'vitest';
import { calculateInvoicePayment, getInvoiceFinancialSummary } from './invoicePayment';

describe('calculateInvoicePayment', () => {
  it('registra pagamento total', () => {
    expect(calculateInvoicePayment(500, 0, 500)).toMatchObject({ paidAmount: 500, remainingAmount: 0, status: 'paga' });
  });
  it('registra pagamento parcial', () => {
    expect(calculateInvoicePayment(500, 0, 125)).toMatchObject({ paidAmount: 125, remainingAmount: 375, status: 'parcial' });
  });
  it('acumula um segundo pagamento e conclui a fatura', () => {
    expect(calculateInvoicePayment(500, 125, 375)).toMatchObject({ paidAmount: 500, remainingAmount: 0, status: 'paga' });
  });
  it('trata valores monetários em centavos sem erro de ponto flutuante', () => {
    expect(calculateInvoicePayment(0.3, 0.1, 0.2)).toMatchObject({ paidAmount: 0.3, remainingAmount: 0, status: 'paga' });
  });
  it('rejeita pagamento acima do saldo remanescente', () => {
    expect(() => calculateInvoicePayment(500, 400, 100.01)).toThrow('excede o saldo remanescente');
  });
  it('rejeita novo pagamento de fatura já paga', () => {
    expect(() => calculateInvoicePayment(500, 500, 1)).toThrow('já está totalmente paga');
  });
});
describe('getInvoiceFinancialSummary', () => {
  it('usa o total persistido e calcula o remanescente parcial', () => {
    expect(getInvoiceFinancialSummary({ totalAmount: 1000, paidAmount: 400, status: 'parcial' })).toEqual({
      totalAmount: 1000, paidAmount: 400, remainingAmount: 600, paymentProgress: 40, status: 'parcial',
    });
  });
  it('usa o total calculado quando a invoice ainda não foi persistida', () => {
    expect(getInvoiceFinancialSummary(null, 250)).toMatchObject({ totalAmount: 250, remainingAmount: 250, status: 'aberta' });
  });
  it('limita pagamentos inconsistentes ao total da fatura', () => {
    expect(getInvoiceFinancialSummary({ totalAmount: 100, paidAmount: 120 })).toMatchObject({ paidAmount: 100, remainingAmount: 0, status: 'paga' });
  });
});