import { describe, expect, it } from 'vitest';
import type { Account, Category, CreditCard, Invoice, Transaction } from '../../types';
import { normalizeTransactions } from './normalize';
import { buildAccountFlowReport, calculateStartingBalanceCents } from './accountFlow';

describe('accountFlow', () => {
  const categories: Category[] = [
    { id: 'cat-salario', name: 'Salário', type: 'income', icon: 'Briefcase', isDefault: true, createdAt: '', userId: 'u1' },
    { id: 'cat-aluguel', name: 'Aluguel', type: 'expense', icon: 'Home', isDefault: true, createdAt: '', userId: 'u1' },
  ];

  const creditCards: CreditCard[] = [
    { id: 'card-1', name: 'Nubank', limit: 3000, closingDay: 20, dueDay: 27, createdAt: '', userId: 'u1' },
  ];

  it('calcula saldo inicial histórico a partir de initialBalance + movimentos passados', () => {
    const account: Account = {
      id: 'acc-1',
      name: 'Itaú',
      type: 'checking',
      balance: 1500,
      initialBalance: 1000,
      createdAt: '',
      userId: 'u1',
    };

    const pastTransactions: Transaction[] = [
      {
        id: 'tx-past-1',
        userId: 'u1',
        type: 'income',
        amount: 300,
        date: '2026-07-15',
        accountId: 'acc-1',
        status: 'paid',
        description: 'Receita Julho',
        createdAt: '',
      },
      {
        id: 'tx-past-2',
        userId: 'u1',
        type: 'expense',
        amount: 100,
        date: '2026-07-20',
        accountId: 'acc-1',
        status: 'paid',
        description: 'Despesa Julho',
        createdAt: '',
      },
      {
        id: 'tx-past-pending',
        userId: 'u1',
        type: 'expense',
        amount: 50,
        date: '2026-07-25',
        accountId: 'acc-1',
        status: 'pending', // Pendente não afeta saldo inicial realizado
        description: 'Pendente Julho',
        createdAt: '',
      },
    ];

    const normalized = normalizeTransactions(pastTransactions, categories, creditCards);
    const startingCents = calculateStartingBalanceCents(account, normalized, '2026-08-01');

    // 1000 + 300 - 100 = 1200
    expect(startingCents).toBe(120000);
  });

  it('saldo inicial R$ 1.000, receita R$ 500, despesa R$ 200: resultado R$ 300, saldo final R$ 1.300', () => {
    const account: Account = {
      id: 'acc-1',
      name: 'Itaú',
      type: 'checking',
      balance: 1300,
      initialBalance: 1000,
      createdAt: '',
      userId: 'u1',
    };

    const transactions: Transaction[] = [
      {
        id: 'tx-1',
        userId: 'u1',
        type: 'income',
        amount: 500,
        date: '2026-08-05',
        accountId: 'acc-1',
        status: 'paid',
        description: 'Salário',
        createdAt: '',
      },
      {
        id: 'tx-2',
        userId: 'u1',
        type: 'expense',
        amount: 200,
        date: '2026-08-10',
        accountId: 'acc-1',
        status: 'paid',
        description: 'Aluguel',
        createdAt: '',
      },
    ];

    const normalized = normalizeTransactions(transactions, categories, creditCards);
    const { accountFlowResult, cashFlowResult } = buildAccountFlowReport(
      [account],
      creditCards,
      [],
      normalized,
      {
        selectedMonth: '2026-08',
        status: 'all',
        intervalType: 'day',
        accumulated: false,
        includePending: false,
      }
    );

    expect(cashFlowResult.totalInflow).toBe(500);
    expect(cashFlowResult.totalOutflow).toBe(200);
    expect(cashFlowResult.netResult).toBe(300);
    expect(cashFlowResult.startingBalance).toBe(1000);
    expect(cashFlowResult.endingBalance).toBe(1300);

    const accItem = accountFlowResult.accounts[0];
    expect(accItem.startingBalance).toBe(1000);
    expect(accItem.netResult).toBe(300);
    expect(accItem.endingBalance).toBe(1300);
  });

  it('com despesa pendente R$ 100: realizado R$ 1.300, previsto R$ 1.200', () => {
    const account: Account = {
      id: 'acc-1',
      name: 'Itaú',
      type: 'checking',
      balance: 1300,
      initialBalance: 1000,
      createdAt: '',
      userId: 'u1',
    };

    const transactions: Transaction[] = [
      {
        id: 'tx-1',
        userId: 'u1',
        type: 'income',
        amount: 500,
        date: '2026-08-05',
        accountId: 'acc-1',
        status: 'paid',
        description: 'Salário',
        createdAt: '',
      },
      {
        id: 'tx-2',
        userId: 'u1',
        type: 'expense',
        amount: 200,
        date: '2026-08-10',
        accountId: 'acc-1',
        status: 'paid',
        description: 'Aluguel',
        createdAt: '',
      },
      {
        id: 'tx-3',
        userId: 'u1',
        type: 'expense',
        amount: 100,
        date: '2026-08-25',
        accountId: 'acc-1',
        status: 'pending',
        description: 'Conta de Luz',
        createdAt: '',
      },
    ];

    const normalized = normalizeTransactions(transactions, categories, creditCards);
    const { accountFlowResult } = buildAccountFlowReport(
      [account],
      creditCards,
      [],
      normalized,
      {
        selectedMonth: '2026-08',
        status: 'all',
        intervalType: 'day',
        accumulated: false,
        includePending: true,
      }
    );

    const accItem = accountFlowResult.accounts[0];
    expect(accItem.endingBalance).toBe(1300);
    expect(accItem.projectedEndingBalance).toBe(1200);
  });

  it('transferência interna entre duas contas selecionadas neutraliza no total consolidado', () => {
    const accA: Account = { id: 'acc-a', name: 'Conta A', type: 'checking', balance: 1000, initialBalance: 1000, createdAt: '', userId: 'u1' };
    const accB: Account = { id: 'acc-b', name: 'Conta B', type: 'savings', balance: 500, initialBalance: 500, createdAt: '', userId: 'u1' };

    const transactions: Transaction[] = [
      {
        id: 'tx-tr-1',
        userId: 'u1',
        type: 'transfer',
        amount: 200,
        date: '2026-08-12',
        accountId: 'acc-a',
        destinationAccountId: 'acc-b',
        status: 'paid',
        description: 'Reserva',
        createdAt: '',
      },
    ];

    const normalized = normalizeTransactions(transactions, categories, creditCards);
    const { cashFlowResult, accountFlowResult } = buildAccountFlowReport(
      [accA, accB],
      creditCards,
      [],
      normalized,
      {
        selectedMonth: '2026-08',
        status: 'all',
        intervalType: 'day',
        accumulated: false,
        includePending: false,
      }
    );

    // No consolidado, as transferências entre A e B não inflam entradas nem saídas
    expect(cashFlowResult.totalInflow).toBe(0);
    expect(cashFlowResult.totalOutflow).toBe(0);
    expect(cashFlowResult.netResult).toBe(0);
    expect(cashFlowResult.startingBalance).toBe(1500);
    expect(cashFlowResult.endingBalance).toBe(1500);

    // No individual:
    const itemA = accountFlowResult.accounts.find(a => a.accountId === 'acc-a')!;
    const itemB = accountFlowResult.accounts.find(a => a.accountId === 'acc-b')!;
    expect(itemA.outflow).toBe(200);
    expect(itemA.endingBalance).toBe(800);
    expect(itemB.inflow).toBe(200);
    expect(itemB.endingBalance).toBe(700);
  });

  it('fatura R$ 1.000, pago R$ 400 e pagamento pendente R$ 200: deduz agendamento e deixa residual em R$ 400', () => {
    const invoices: Invoice[] = [
      {
        id: 'inv-1',
        userId: 'u1',
        cardId: 'card-1',
        period: '2026-08',
        status: 'parcial',
        totalAmount: 1000,
        paidAmount: 400,
      },
    ];

    // Transação pendente para a mesma fatura
    const transactions: Transaction[] = [
      {
        id: 'tx-pend-pay',
        userId: 'u1',
        type: 'expense',
        amount: 200,
        date: '2026-08-27',
        accountId: 'acc-1',
        creditCardId: 'card-1',
        invoicePeriod: '2026-08',
        status: 'pending',
        description: 'Pagamento Fatura Nubank',
        createdAt: '',
      },
    ];

    const account: Account = { id: 'acc-1', name: 'Conta 1', type: 'checking', balance: 1000, initialBalance: 1000, createdAt: '', userId: 'u1' };

    const normalized = normalizeTransactions(transactions, categories, creditCards, invoices);
    const { accountFlowResult } = buildAccountFlowReport(
      [account],
      creditCards,
      invoices,
      normalized,
      {
        selectedMonth: '2026-08',
        status: 'all',
        intervalType: 'day',
        accumulated: false,
        includePending: true,
      }
    );

    // O total residual não alocado é R$ 400 (porque R$ 200 já estão na transação pendente do banco!)
    expect(accountFlowResult.unallocatedInvoiceObligations).toBe(400);
    expect(accountFlowResult.unallocatedInvoices).toHaveLength(1);
    expect(accountFlowResult.unallocatedInvoices[0].remainingAmountCents).toBe(40000);
  });
});
