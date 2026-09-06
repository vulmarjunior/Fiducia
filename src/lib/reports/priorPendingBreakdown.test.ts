import { describe, expect, it } from 'vitest';
import type { Account, CreditCard, Invoice, Transaction } from '../../types';
import { buildAccountFlowReport } from './accountFlow';
import { normalizeTransactions } from './normalize';

const account: Account = {
  id: 'acc-1',
  name: 'Conta Principal',
  type: 'checking',
  balance: 1000,
  initialBalance: 1000,
  createdAt: '',
  userId: 'u1',
};

const filters = {
  selectedMonth: '2026-10',
  status: 'all' as const,
  intervalType: 'day' as const,
  accumulated: false,
  includePending: true,
};

const card: CreditCard = {
  id: 'card-1',
  name: 'C6',
  limit: 5000,
  closingDay: 2,
  dueDay: 10,
  createdAt: '',
  userId: 'u1',
};

describe('origem auditável das pendências anteriores', () => {
  it('expõe lançamentos bancários pendentes anteriores sem duplicar transferência interna', () => {
    const secondAccount: Account = {
      id: 'acc-2',
      name: 'Conta Reserva',
      type: 'savings',
      balance: 500,
      initialBalance: 500,
      createdAt: '',
      userId: 'u1',
    };

    const transactions: Transaction[] = [
      {
        id: 'pending-expense',
        userId: 'u1',
        type: 'expense',
        amount: 357.97,
        date: '2026-09-28',
        accountId: 'acc-1',
        status: 'pending',
        description: 'Despesa pendente antiga',
        createdAt: '',
      },
      {
        id: 'internal-transfer',
        userId: 'u1',
        type: 'transfer',
        amount: 200,
        date: '2026-09-29',
        accountId: 'acc-1',
        destinationAccountId: 'acc-2',
        status: 'pending',
        description: 'Transferência interna',
        createdAt: '',
      },
    ];

    const normalized = normalizeTransactions(transactions, [], []);
    const { cashFlowResult } = buildAccountFlowReport(
      [account, secondAccount],
      [],
      [],
      normalized,
      { ...filters, includeSavings: true }
    );

    expect(cashFlowResult.priorPendingBankCents).toBe(35797);
    expect(cashFlowResult.priorPendingEntries.map(entry => entry.id)).toEqual(['pending-expense']);
    expect(cashFlowResult.priorInvoiceObligationsCents).toBe(0);
    expect(cashFlowResult.priorPendingCents).toBe(35797);
  });

  it('identifica quando o residual vem do documento de fatura sem compras correspondentes', () => {
    const invoices: Invoice[] = [
      {
        id: 'invoice-sep',
        userId: 'u1',
        cardId: 'card-1',
        period: '2026-09',
        status: 'aberta',
        totalAmount: 357.97,
        paidAmount: 0,
      },
    ];

    const { cashFlowResult } = buildAccountFlowReport(
      [account],
      [card],
      invoices,
      [],
      filters
    );

    expect(cashFlowResult.priorPendingBankCents).toBe(0);
    expect(cashFlowResult.priorInvoiceObligationsCents).toBe(35797);
    expect(cashFlowResult.priorInvoiceObligations[0]).toMatchObject({
      cardId: 'card-1',
      cardName: 'C6',
      period: '2026-09',
      remainingAmountCents: 35797,
      sourceKind: 'invoice_document',
      sourceEntries: [],
    });
  });

  it('mostra quais compras de cartão reconstruíram uma fatura sem documento salvo', () => {
    const transactions: Transaction[] = [
      {
        id: 'card-purchase-1',
        userId: 'u1',
        type: 'expense',
        amount: 200,
        date: '2025-12-03',
        creditCardId: 'card-1',
        invoicePeriod: '2025-12',
        status: 'paid',
        description: 'Compra antiga 1',
        createdAt: '',
      },
      {
        id: 'card-purchase-2',
        userId: 'u1',
        type: 'expense',
        amount: 157.97,
        date: '2025-12-09',
        creditCardId: 'card-1',
        invoicePeriod: '2025-12',
        status: 'paid',
        description: 'Compra antiga 2',
        createdAt: '',
      },
    ];

    const normalized = normalizeTransactions(transactions, [card], []);
    const { cashFlowResult } = buildAccountFlowReport(
      [account],
      [card],
      [],
      normalized,
      filters
    );

    const obligation = cashFlowResult.priorInvoiceObligations.find(item => item.period === '2025-12');
    expect(obligation).toBeDefined();
    expect(obligation).toMatchObject({
      remainingAmountCents: 35797,
      sourceKind: 'card_transactions',
    });
    expect(obligation?.sourceEntries?.map(entry => entry.id)).toEqual(['card-purchase-1', 'card-purchase-2']);
  });
});
