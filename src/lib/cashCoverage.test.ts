import { describe, expect, it } from 'vitest';
import { buildCashCoverageProjection } from './cashCoverage';

const startDate = '2026-06-23';

describe('buildCashCoverageProjection', () => {
  it('detecta risco diário mesmo quando o período termina coberto', () => {
    const projection = buildCashCoverageProjection({
      accounts: [{ id: 'acc-1', balance: 1000 }],
      creditCards: [],
      invoices: [],
      transactions: [
        {
          id: 'rent',
          type: 'despesa',
          status: 'pendente',
          amount: 1500,
          date: '2026-06-25',
          description: 'Aluguel',
          accountId: 'acc-1',
        },
        {
          id: 'salary',
          type: 'receita',
          status: 'pendente',
          amount: 2000,
          date: '2026-06-30',
          description: 'Salario',
          accountId: 'acc-1',
        },
      ],
      options: { startDate, endDate: '2026-07-05' },
    });

    expect(projection.coverageBalance).toBe(1500);
    expect(projection.isAtRisk).toBe(true);
    expect(projection.firstRiskDate).toBe('2026-06-25');
    expect(projection.minimumBalance).toBe(-500);
  });

  it('inclui fatura fechada como obrigacao confirmada na data de vencimento', () => {
    const projection = buildCashCoverageProjection({
      accounts: [{ id: 'acc-1', balance: 3000 }],
      creditCards: [{ id: 'card-1', name: 'Nubank', limit: 5000, closingDay: 20, dueDay: 5 }],
      invoices: [{ id: 'inv-1', cardId: 'card-1', period: '2026-07', status: 'fechada', totalAmount: 1200 }],
      transactions: [],
      options: { startDate, endDate: '2026-07-31' },
    });

    expect(projection.totalClosedInvoices).toBe(1200);
    expect(projection.totalInvoices).toBe(1200);
    expect(projection.events[0]).toMatchObject({
      source: 'invoice_closed',
      certainty: 'confirmed',
      date: '2026-07-05',
      originalDate: '2026-07-05',
    });
  });

  it('calcula fatura aberta a partir das compras do cartao quando nao ha invoice persistida', () => {
    const projection = buildCashCoverageProjection({
      accounts: [{ id: 'acc-1', balance: 2000 }],
      creditCards: [{ id: 'card-1', name: 'Visa', limit: 5000, closingDay: 28, dueDay: 10 }],
      invoices: [],
      transactions: [
        {
          id: 'purchase-1',
          type: 'despesa',
          status: 'pendente',
          amount: 350,
          date: '2026-06-23',
          description: 'Mercado',
          accountId: 'card-1',
          invoicePeriod: '2026-07',
        },
        {
          id: 'purchase-2',
          type: 'despesa',
          status: 'pendente',
          amount: 150,
          date: '2026-06-24',
          description: 'Farmacia',
          accountId: 'card-1',
          invoicePeriod: '2026-07',
        },
      ],
      options: { startDate, endDate: '2026-07-31' },
    });

    expect(projection.totalOpenInvoices).toBe(500);
    expect(projection.events).toHaveLength(1);
    expect(projection.events[0]).toMatchObject({
      source: 'invoice_open',
      amount: 500,
      date: '2026-07-10',
    });
  });

  it('respeita contas excluidas do fluxo e permite inclui-las por opcao', () => {
    const base = {
      accounts: [
        { id: 'checking', balance: 1000 },
        { id: 'reserve', balance: 5000, excludeFromCashFlow: true },
      ],
      creditCards: [],
      invoices: [],
      transactions: [],
      options: { startDate, endDate: '2026-06-30' },
    };

    expect(buildCashCoverageProjection(base).startingBalance).toBe(1000);
    expect(buildCashCoverageProjection({
      ...base,
      options: { ...base.options, includeSavings: true },
    }).startingBalance).toBe(6000);
  });

  it('move itens atrasados para hoje na simulacao mantendo a data original', () => {
    const projection = buildCashCoverageProjection({
      accounts: [{ id: 'acc-1', balance: 1000 }],
      creditCards: [],
      invoices: [],
      transactions: [
        {
          id: 'late',
          type: 'despesa',
          status: 'pendente',
          amount: 200,
          date: '2026-06-20',
          description: 'Conta atrasada',
          accountId: 'acc-1',
        },
      ],
      options: { startDate, endDate: '2026-06-30' },
    });

    expect(projection.events[0]).toMatchObject({
      date: '2026-06-23',
      originalDate: '2026-06-20',
      status: 'overdue',
    });
    expect(projection.dailyProjection[0].endingBalance).toBe(800);
  });
});
