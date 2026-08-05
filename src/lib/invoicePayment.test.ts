import { describe, expect, it } from 'vitest';
import { calculateInvoicePayment, getInvoiceFinancialSummary, getInvoicePaymentTransactionIds } from './invoicePayment';

describe('getInvoicePaymentTransactionIds', () => {
  it('reconhece IDs dos pagamentos atuais e do campo legado', () => {
    const ids = getInvoicePaymentTransactionIds([
      { paymentTransactionIds: ['payment-current', 'payment-partial'] },
      { paymentTransactionId: 'payment-legacy' },
    ]);

    expect([...ids]).toEqual(['payment-current', 'payment-partial', 'payment-legacy']);
  });

  it('ignora valores ausentes ou inválidos sem inferir pela descrição', () => {
    const ids = getInvoicePaymentTransactionIds([
      { paymentTransactionIds: [null, '', 123] },
      { description: 'Pagamento Fatura sem vínculo oficial' },
      null,
    ]);

    expect(ids.size).toBe(0);
  });
});

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
  it('trata fatura legada paga sem paidAmount como totalmente quitada', () => {
    expect(getInvoiceFinancialSummary({ totalAmount: 8452.63, status: 'paga' })).toEqual({
      totalAmount: 8452.63, paidAmount: 8452.63, remainingAmount: 0, paymentProgress: 100, status: 'paga',
    });
  });
  it('remove de contas a pagar uma fatura atual quitada por pagamentos vinculados', () => {
    const summary = getInvoiceFinancialSummary({
      totalAmount: 15237.36,
      paidAmount: 15237.36,
      status: 'paga',
      paymentTransactionIds: ['payment-1', 'payment-2'],
    }, 15237.36);

    expect(summary).toMatchObject({ paidAmount: 15237.36, remainingAmount: 0, status: 'paga' });
  });
  it('mantém em contas a pagar somente o saldo parcial oficial', () => {
    const summary = getInvoiceFinancialSummary({
      totalAmount: 15237.36,
      paidAmount: 7618.68,
      status: 'parcial',
      paymentTransactionIds: ['payment-1'],
    }, 15237.36);

    expect(summary).toMatchObject({ paidAmount: 7618.68, remainingAmount: 7618.68, status: 'parcial' });
  });
  it('não carrega fatura paga legada para o total do mês seguinte', () => {
    const previous = getInvoiceFinancialSummary({ totalAmount: 8452.63, paidAmount: 0, status: 'paga' });
    const current = getInvoiceFinancialSummary(null, previous.remainingAmount + 3375.18);

    expect(current).toMatchObject({ totalAmount: 3375.18, remainingAmount: 3375.18, status: 'aberta' });
  });
});
