import { describe, expect, it } from 'vitest';
import { calculateInvoicePayment, getInvoiceFinancialSummary } from './invoicePayment';
import { getTransactionEffect } from './utils';
import { isCreditCardTransaction, normalizeCreditCardTransaction } from './creditCardTransaction';

describe('integração do domínio de pagamentos e faturas', () => {
  it('aplica dois pagamentos, atualiza a conta e quita a fatura sem afetar saldo pelo consumo do cartão', () => {
    let accountBalance = 2_000;
    let invoice = { totalAmount: 1_000, paidAmount: 0, status: 'fechada' };
    const cardPurchase = { type: 'despesa', amount: 1_000, accountId: 'card-1', creditCardId: 'card-1' };
    expect(isCreditCardTransaction(cardPurchase, ['card-1'])).toBe(true);

    const firstPayment = calculateInvoicePayment(invoice.totalAmount, invoice.paidAmount, 400);
    const firstPaymentTx = { type: 'despesa', amount: 400, accountId: 'bank-1' };
    accountBalance += getTransactionEffect(firstPaymentTx, 'bank-1');
    invoice = { totalAmount: firstPayment.totalAmount, paidAmount: firstPayment.paidAmount, status: firstPayment.status };
    expect(accountBalance).toBe(1_600);
    expect(getInvoiceFinancialSummary(invoice)).toMatchObject({ paidAmount: 400, remainingAmount: 600, status: 'parcial' });

    const finalPayment = calculateInvoicePayment(invoice.totalAmount, invoice.paidAmount, 600);
    accountBalance += getTransactionEffect({ type: 'despesa', amount: 600, accountId: 'bank-1' }, 'bank-1');
    invoice = { totalAmount: finalPayment.totalAmount, paidAmount: finalPayment.paidAmount, status: finalPayment.status };
    expect(accountBalance).toBe(1_000);
    expect(getInvoiceFinancialSummary(invoice)).toMatchObject({ paidAmount: 1_000, remainingAmount: 0, status: 'paga' });
  });

  it('normaliza lançamento importado para edição sem transformá-lo em movimentação bancária', () => {
    const imported = normalizeCreditCardTransaction({ id: 'tx-1', creditCardId: 'card-1', type: 'despesa', amount: 250 });
    expect(imported.accountId).toBe('card-1');
    expect(isCreditCardTransaction(imported, new Set(['card-1']))).toBe(true);
  });

  it('mantém precisão em centavos durante pagamentos acumulados', () => {
    const first = calculateInvoicePayment(100.01, 0, 33.34);
    const second = calculateInvoicePayment(100.01, first.paidAmount, 66.67);
    expect(second).toMatchObject({ paidAmount: 100.01, remainingAmount: 0, status: 'paga' });
  });
});