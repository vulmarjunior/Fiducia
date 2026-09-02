import { describe, expect, it } from 'vitest';
import type { CreditCard, Invoice, Transaction } from '../../types';
import { normalizeTransactions } from './normalize';
import { buildInvoiceObligations } from './invoiceEvents';

describe('invoiceEvents - conformidade com auditoria', () => {
  const card: CreditCard = {
    id: 'card-1',
    name: 'Cartão 1',
    userId: 'u1',
    limit: 5000,
    closingDay: 20,
    dueDay: 27,
    createdAt: '',
  };

  it('06 compra pendente nao e agendamento de pagamento de fatura', () => {
    const inv: Invoice = {
      id: 'inv-1',
      userId: 'u1',
      cardId: 'card-1',
      period: '2026-08',
      status: 'aberta',
      totalAmount: 1000,
    };

    const purchase: Transaction = {
      id: 'tx-purchase-pend',
      userId: 'u1',
      type: 'expense',
      status: 'pending',
      amount: 1000,
      date: '2026-08-10',
      description: 'Compra pendente',
      accountId: 'card-1',
      creditCardId: 'card-1',
      invoicePeriod: '2026-08',
      createdAt: '',
    };

    const normalized = normalizeTransactions([purchase], [], [card], [inv]);
    const res = buildInvoiceObligations([inv], [card], normalized, '2026-08');

    // A compra pendente não deve abater o residual da fatura!
    expect(res.totalResidualCents).toBe(100000);
    expect(res.obligations[0].remainingAmountCents).toBe(100000);
  });

  it('09 compras sem documento de fatura continuam sendo obrigacao', () => {
    const paidPurchase: Transaction = {
      id: 'tx-purchase-paid',
      userId: 'u1',
      type: 'expense',
      status: 'paid',
      amount: 1000,
      date: '2026-08-10',
      description: 'Compra realizada',
      accountId: 'card-1',
      creditCardId: 'card-1',
      invoicePeriod: '2026-08',
      createdAt: '',
    };

    const normalized = normalizeTransactions([paidPurchase], [], [card]);
    // Sem passar invoices ([])
    const res = buildInvoiceObligations([], [card], normalized, '2026-08');

    expect(res.totalResidualCents).toBe(100000);
    expect(res.obligations).toHaveLength(1);
    expect(res.obligations[0].totalAmountCents).toBe(100000);
    expect(res.obligations[0].remainingAmountCents).toBe(100000);
  });
});
