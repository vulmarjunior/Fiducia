import { describe, expect, it } from 'vitest';
import type { Account, Transaction } from '../../types';
import { runMonthlySimulationComparison } from '../simulatorEngine';
import { buildAccountFlowReport } from './accountFlow';
import { normalizeTransactions } from './normalize';

describe('continuidade do saldo projetado entre períodos', () => {
  const account: Account = {
    id: 'acc-1',
    name: 'Conta Principal',
    type: 'checking',
    balance: 13591.18,
    initialBalance: 8896.35,
    createdAt: '',
    userId: 'u1',
  };

  const transactions: Transaction[] = [
    {
      id: 'income-sep',
      userId: 'u1',
      type: 'income',
      amount: 24342,
      date: '2026-09-05',
      accountId: 'acc-1',
      status: 'paid',
      description: 'Receitas de setembro',
      createdAt: '',
    },
    {
      id: 'expense-paid-sep',
      userId: 'u1',
      type: 'expense',
      amount: 19647.17,
      date: '2026-09-20',
      accountId: 'acc-1',
      status: 'paid',
      description: 'Despesas realizadas de setembro',
      createdAt: '',
    },
    {
      id: 'expense-pending-sep',
      userId: 'u1',
      type: 'expense',
      amount: 8479.95,
      date: '2026-09-28',
      accountId: 'acc-1',
      status: 'pending',
      description: 'Despesas pendentes de setembro',
      createdAt: '',
    },
  ];

  it('mantém fechamento previsto de setembro como abertura prevista de outubro sem alterar a abertura realizada', () => {
    const normalized = normalizeTransactions(transactions, [], []);

    const september = buildAccountFlowReport(
      [account],
      [],
      [],
      normalized,
      {
        selectedMonth: '2026-09',
        status: 'all',
        intervalType: 'day',
        accumulated: false,
        includePending: true,
      }
    );

    const octoberProjected = buildAccountFlowReport(
      [account],
      [],
      [],
      normalized,
      {
        selectedMonth: '2026-10',
        status: 'all',
        intervalType: 'day',
        accumulated: false,
        includePending: true,
      }
    );

    const octoberRealized = buildAccountFlowReport(
      [account],
      [],
      [],
      normalized,
      {
        selectedMonth: '2026-10',
        status: 'all',
        intervalType: 'day',
        accumulated: false,
        includePending: false,
      }
    );

    const septemberLastPoint = september.cashFlowResult.points.at(-1)!;
    const octoberLastPoint = octoberProjected.cashFlowResult.points.at(-1)!;

    expect(september.cashFlowResult.startingBalance).toBe(8896.35);
    expect(september.cashFlowResult.totalInflow).toBe(24342);
    expect(september.cashFlowResult.totalOutflow).toBe(28127.12);
    expect(septemberLastPoint.projectedEndingBalanceCents).toBe(511123);

    expect(octoberProjected.cashFlowResult.startingBalance).toBe(5111.23);
    expect(octoberProjected.accountFlowResult.consolidatedStartingBalance).toBe(13591.18);
    expect(octoberLastPoint.projectedEndingBalanceCents).toBe(511123);

    expect(octoberRealized.cashFlowResult.startingBalance).toBe(13591.18);
    expect(octoberRealized.cashFlowResult.endingBalance).toBe(13591.18);
  });

  it('faz o simulador iniciado em outubro herdar a abertura projetada de setembro', () => {
    const simulation = runMonthlySimulationComparison({
      accounts: [account],
      transactions,
      creditCards: [],
      invoices: [],
      categories: [],
      simulatedItems: [],
      horizon: 'current_month',
      intervalType: 'month',
      includeSavings: false,
      referenceDate: new Date(2026, 9, 1),
    });

    expect(simulation.summary.initialBalance).toBe(5111.23);
    expect(simulation.summary.realFinalBalance).toBe(5111.23);
    expect(simulation.monthPoints[0].realEndingBalance).toBe(5111.23);
  });
});
