import { describe, it, expect } from 'vitest';
import { generateSimulatedTransactions, runSimulationComparison } from './simulatorEngine';
import { SimulatedItem } from '../types/simulator';

describe('simulatorEngine', () => {
  const mockCreditCards = [
    {
      id: 'card-1',
      name: 'Nubank',
      limit: 5000,
      closingDay: 25,
      dueDay: 5,
      userId: 'user-1',
      createdAt: '2026-01-01',
    },
  ];

  const mockAccounts = [
    {
      id: 'acc-1',
      name: 'Conta Corrente',
      balance: 4000,
      type: 'checking',
      userId: 'user-1',
      createdAt: '2026-01-01',
    },
  ];

  it('gera parcelas sintéticas no cartão com invoicePeriod correto', () => {
    const items: SimulatedItem[] = [
      {
        id: 'sim-1',
        name: 'Notebook',
        type: 'card_expense',
        amount: 3000,
        date: '2026-09-10',
        enabled: true,
        installments: 3,
        cardId: 'card-1',
        createdAt: '2026-09-05',
      },
    ];

    const txs = generateSimulatedTransactions(items, mockCreditCards, 90);
    expect(txs).toHaveLength(3);
    expect(txs[0].amount).toBe(1000);
    expect(txs[1].amount).toBe(1000);
    expect(txs[2].amount).toBe(1000);
    expect(txs[0].invoicePeriod).toBe('2026-10'); // Fecha 25/set, vence 5/out
    expect(txs[0].status).toBe('pendente');
    expect(txs[0].creditCardId).toBe('card-1');
  });

  it('ignora itens desabilitados no cálculo', () => {
    const items: SimulatedItem[] = [
      {
        id: 'sim-1',
        name: 'Gasto Teste',
        type: 'expense',
        amount: 500,
        date: '2026-09-15',
        enabled: false,
        createdAt: '2026-09-05',
      },
    ];

    const txs = generateSimulatedTransactions(items, mockCreditCards, 90);
    expect(txs).toHaveLength(0);
  });

  it('calcula comparativo de Folga Livre e delta de saldo corretamente', () => {
    const items: SimulatedItem[] = [
      {
        id: 'sim-1',
        name: 'Curso Online',
        type: 'expense',
        amount: 1000,
        date: '2026-09-15',
        enabled: true,
        createdAt: '2026-09-05',
      },
    ];

    const result = runSimulationComparison({
      accounts: mockAccounts,
      transactions: [],
      creditCards: mockCreditCards,
      invoices: [],
      simulatedItems: items,
      safetyReserve: 500,
      days: 30,
    });

    // Saldo real inicial é 4000. Sem gastos reais, menor saldo real é 4000.
    // Margem real = 4000 - 500 = 3500.
    expect(result.comparison.realMargin).toBe(3500);

    // Com gasto de 1000, menor saldo simulado é 3000.
    // Margem simulada = 3000 - 500 = 2500.
    expect(result.comparison.simulatedMargin).toBe(2500);
    expect(result.comparison.marginDelta).toBe(-1000);
    expect(result.comparison.simulatedEndingBalance).toBe(3000);
    expect(result.chartData.length).toBeGreaterThan(0);
  });

  it('detecta dias em risco quando o gasto simulado causa déficit', () => {
    const items: SimulatedItem[] = [
      {
        id: 'sim-deficit',
        name: 'Gasto Alto',
        type: 'expense',
        amount: 6000, // Saldo é 4000 -> vai para -2000
        date: '2026-09-10',
        enabled: true,
        createdAt: '2026-09-05',
      },
    ];

    const result = runSimulationComparison({
      accounts: mockAccounts,
      transactions: [],
      creditCards: mockCreditCards,
      invoices: [],
      simulatedItems: items,
      safetyReserve: 0,
      days: 30,
    });

    expect(result.comparison.simulatedMinBalance).toBe(-2000);
    expect(result.comparison.simulatedDaysAtRisk).toBeGreaterThan(0);
    expect(result.dailyAlerts.length).toBeGreaterThan(0);
  });
});
