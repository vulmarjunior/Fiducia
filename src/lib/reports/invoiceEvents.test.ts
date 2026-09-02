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

  it('faturas em intervalos que atravessam multiplos meses incluem todas as faturas com vencimento no intervalo', () => {
    const cardJulyAugust: CreditCard = {
      id: 'card-1',
      name: 'Cartão 1',
      userId: 'u1',
      limit: 5000,
      closingDay: 20,
      dueDay: 27, // Vencimento no dia 27 do mês da fatura
      createdAt: '',
    };

    const invJuly: Invoice = {
      id: 'inv-july',
      userId: 'u1',
      cardId: 'card-1',
      period: '2026-07',
      status: 'aberta',
      totalAmount: 300,
    };

    const invAugust: Invoice = {
      id: 'inv-august',
      userId: 'u1',
      cardId: 'card-1',
      period: '2026-08',
      status: 'aberta',
      totalAmount: 500,
    };

    // customRange de 2026-07-25 a 2026-08-28 (atravessa julho e agosto, e engloba o vencimento 27/07 e 27/08)
    const customRange = { startDate: '2026-07-25', endDate: '2026-08-28' };
    const res = buildInvoiceObligations([invJuly, invAugust], [cardJulyAugust], [], '2026-07', customRange);

    // Ambas as faturas devem ser incluídas nas obrigações (R$ 300 + R$ 500 = R$ 800)
    expect(res.obligations).toHaveLength(2);
    expect(res.totalResidualCents).toBe(80000);
  });
});
