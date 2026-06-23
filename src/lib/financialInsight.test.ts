import { describe, expect, it } from 'vitest';
import { buildFinancialInsightContext, buildGroqFinancialAnalysisPrompt } from './financialInsight';

const BASE_DATE = '2026-06-23';

describe('buildFinancialInsightContext', () => {
  it('retorna null quando nao ha transacoes', () => {
    const result = buildFinancialInsightContext({
      accounts: [{ id: 'acc-1', balance: 1000 }],
      transactions: [],
      categories: [],
      creditCards: [],
      invoices: [],
      budgets: [],
    });
    expect(result).toBeNull();
  });

  it('extrai cobertura de caixa com risco detectado', () => {
    const result = buildFinancialInsightContext({
      accounts: [{ id: 'acc-1', balance: 1000 }],
      transactions: [
        {
          id: 'rent', type: 'despesa', status: 'pendente', amount: 1500,
          date: '2026-06-25', description: 'Aluguel', accountId: 'acc-1',
        },
        {
          id: 'salary', type: 'receita', status: 'pendente', amount: 2000,
          date: '2026-06-30', description: 'Salario', accountId: 'acc-1',
        },
      ],
      categories: [],
      creditCards: [],
      invoices: [],
      budgets: [],
    });

    expect(result).not.toBeNull();
    expect(result!.cashCoverage.isAtRisk).toBe(true);
    expect(result!.cashCoverage.firstRiskDate).toBe('2026-06-25');
    expect(result!.cashCoverage.minimumBalance).toBe(-500);
    expect(result!.health.isAtRisk).toBe(true);
  });

  it('extrai analise de faturas de cartao', () => {
    const result = buildFinancialInsightContext({
      accounts: [{ id: 'acc-1', balance: 2000 }],
      transactions: [
        {
          id: 'p1', type: 'despesa', status: 'realizado', amount: 500,
          date: '2026-05-25', description: 'Mercado', accountId: 'card-1',
          creditCardId: 'card-1', invoicePeriod: '2026-06',
        },
      ],
      categories: [],
      creditCards: [{ id: 'card-1', name: 'Nubank', limit: 3000, closingDay: 20, dueDay: 5 }],
      invoices: [{ id: 'inv-1', cardId: 'card-1', period: '2026-06', status: 'fechada', totalAmount: 500 }],
      budgets: [],
    });

    expect(result).not.toBeNull();
    expect(result!.invoices.totalClosed).toBe(500);
    expect(result!.invoices.cardsCount).toBe(1);
    expect(result!.invoices.cardBreakdown).toHaveLength(1);
    expect(result!.invoices.cardBreakdown[0].name).toBe('Nubank');
    expect(result!.invoices.cardBreakdown[0].total).toBe(500);
  });

  it('extrai categorias com totais e percentuais', () => {
    const result = buildFinancialInsightContext({
      accounts: [{ id: 'acc-1', balance: 3000 }],
      transactions: [
        {
          id: 't1', type: 'despesa', status: 'realizado', amount: 400,
          date: '2026-06-10', description: 'Alimentacao', categoryId: 'cat-1',
        },
        {
          id: 't2', type: 'despesa', status: 'realizado', amount: 200,
          date: '2026-06-15', description: 'Transporte', categoryId: 'cat-2',
        },
        {
          id: 't3', type: 'receita', status: 'realizado', amount: 3000,
          date: '2026-06-05', description: 'Salario', categoryId: 'cat-3',
        },
      ],
      categories: [
        { id: 'cat-1', name: 'Alimentação', type: 'despesa' },
        { id: 'cat-2', name: 'Transporte', type: 'despesa' },
        { id: 'cat-3', name: 'Salário', type: 'receita' },
      ],
      creditCards: [],
      invoices: [],
      budgets: [],
    });

    expect(result).not.toBeNull();
    expect(result!.categories.topExpenses).toHaveLength(2);
    expect(result!.categories.topExpenses[0].name).toBe('Alimentação');
    expect(result!.categories.topExpenses[0].amount).toBe(400);
    expect(result!.categories.topIncomes).toHaveLength(1);
    expect(result!.categories.topIncomes[0].name).toBe('Salário');
  });

  it('detecta datas criticas de faturas e despesas atrasadas', () => {
    const result = buildFinancialInsightContext({
      accounts: [{ id: 'acc-1', balance: 500 }],
      transactions: [
        {
          id: 'late', type: 'despesa', status: 'pendente', amount: 300,
          date: '2026-06-10', description: 'Conta vencida', accountId: 'acc-1',
        },
        {
          id: 'nubank', type: 'despesa', status: 'realizado', amount: 800,
          date: '2026-05-20', description: 'Compras', accountId: 'card-1',
          creditCardId: 'card-1', invoicePeriod: '2026-06',
        },
      ],
      categories: [],
      creditCards: [{ id: 'card-1', name: 'Nubank', limit: 2000, closingDay: 15, dueDay: 5 }],
      invoices: [{ id: 'inv-1', cardId: 'card-1', period: '2026-06', status: 'fechada', totalAmount: 800 }],
      budgets: [],
    });

    expect(result).not.toBeNull();
    expect(result!.criticalDates.length).toBeGreaterThan(0);
  });

  it('extrai orcamentos com items estourados', () => {
    const result = buildFinancialInsightContext({
      accounts: [{ id: 'acc-1', balance: 1000 }],
      transactions: [
        {
          id: 't1', type: 'despesa', status: 'realizado', amount: 600,
          date: '2026-06-10', description: 'Alimentacao', categoryId: 'cat-1',
        },
      ],
      categories: [{ id: 'cat-1', name: 'Alimentação', type: 'despesa' }],
      creditCards: [],
      invoices: [],
      budgets: [
        { id: 'b1', categoryId: 'cat-1', amount: 400, period: 'monthly' },
      ],
    });

    expect(result).not.toBeNull();
    expect(result!.budgets.items).toHaveLength(1);
    expect(result!.budgets.items[0].overspent).toBe(true);
    expect(result!.budgets.items[0].pct).toBe(150);
    expect(result!.budgets.totalOverspent).toBe(1);
  });

  it('calcula tendencia do fluxo de caixa', () => {
    const result = buildFinancialInsightContext({
      accounts: [{ id: 'acc-1', balance: 5000 }],
      transactions: Array.from({ length: 3 }, (_, i) => ({
        id: `inc-${i}`,
        type: 'receita',
        status: 'realizado',
        amount: 3000 + i * 500,
        date: `${2026}-${String(4 + i).padStart(2, '0')}-05`,
        description: `Salario mes ${i + 1}`,
      })),
      categories: [],
      creditCards: [],
      invoices: [],
      budgets: [],
    });

    expect(result).not.toBeNull();
    expect(result!.cashflow.trend).toBe('up');
    expect(result!.cashflow.lastMonths).toHaveLength(3);
  });

  it('identifica quando nao ha risco', () => {
    const result = buildFinancialInsightContext({
      accounts: [{ id: 'acc-1', balance: 10000 }],
      transactions: [
        {
          id: 'income', type: 'receita', status: 'pendente', amount: 5000,
          date: '2026-06-25', description: 'Salario', accountId: 'acc-1',
        },
      ],
      categories: [],
      creditCards: [],
      invoices: [],
      budgets: [],
    });

    expect(result).not.toBeNull();
    expect(result!.cashCoverage.isAtRisk).toBe(false);
    expect(result!.cashCoverage.firstRiskDate).toBeNull();
    expect(result!.health.isAtRisk).toBe(false);
  });
});

describe('buildGroqFinancialAnalysisPrompt', () => {
  it('gera prompt estruturado com dados do contexto', () => {
    const context: any = {
      health: { totalBalance: 5000, savingsRate: 20, monthlySavings: 800, isAtRisk: false },
      cashCoverage: {
        isAtRisk: false, firstRiskDate: null, minimumBalance: 2000,
        minimumBalanceDate: '2026-07-15', coverageBalance: 3500,
        startingBalance: 5000, totalIncome: 3000, totalObligations: 4500,
        totalBankExpenses: 2500, totalInvoices: 2000,
        totalClosedInvoices: 800, totalOpenInvoices: 700, totalFutureCard: 500,
      },
      invoices: {
        totalOpen: 700, totalClosed: 800, totalPaid: 0, totalFuture: 500,
        monthlyAverage: 1000, largestInvoice: 1200, cardsCount: 2,
        cardBreakdown: [{ name: 'Nubank', total: 1200, pct: 60 }, { name: 'Inter', total: 800, pct: 40 }],
      },
      categories: {
        topExpenses: [{ name: 'Alimentação', amount: 1500, pct: 40 }, { name: 'Transporte', amount: 800, pct: 22 }],
        topIncomes: [{ name: 'Salário', amount: 5000, pct: 100 }],
      },
      cashflow: {
        lastMonths: [
          { month: '2026-04', receitas: 5000, despesas: 4000, saldo: 1000 },
          { month: '2026-05', receitas: 5000, despesas: 4200, saldo: 800 },
          { month: '2026-06', receitas: 5000, despesas: 4500, saldo: 500 },
        ],
        trend: 'down',
      },
      budgets: {
        items: [{ name: 'Alimentação', budget: 1000, spent: 1500, pct: 150, overspent: true }],
        totalOverspent: 1,
      },
      criticalDates: [
        { date: '2026-07-05', type: 'invoice_due', label: 'Fatura Nubank 2026-07', amount: 800 },
      ],
    };

    const prompt = buildGroqFinancialAnalysisPrompt(context);

    expect(prompt).toContain('REGRAS ABSOLUTAS');
    expect(prompt).toContain('DIAGNÓSTICO PRINCIPAL');
    expect(prompt).toContain('DATAS CRÍTICAS');
    expect(prompt).toContain('PRINCIPAIS CAUSAS');
    expect(prompt).toContain('RISCOS SE NADA MUDAR');
    expect(prompt).toContain('AÇÕES RECOMENDADAS');
    expect(prompt).toContain('Nubank');
    expect(prompt).toContain('Alimentação');
    expect(prompt).toContain('05/07/2026');
    expect(prompt).toContain('R$ 5.000,00');
    expect(prompt).toContain('CAINDO');
  });

  it('prompt sinaliza risco quando presente', () => {
    const context: any = {
      health: { totalBalance: 1000, savingsRate: -10, monthlySavings: -500, isAtRisk: true },
      cashCoverage: { isAtRisk: true, firstRiskDate: '2026-06-25', minimumBalance: -300, minimumBalanceDate: '2026-06-25', coverageBalance: -200, startingBalance: 1000, totalIncome: 500, totalObligations: 1700, totalBankExpenses: 900, totalInvoices: 800, totalClosedInvoices: 800, totalOpenInvoices: 0, totalFutureCard: 0 },
      invoices: { totalOpen: 0, totalClosed: 800, totalPaid: 0, totalFuture: 0, monthlyAverage: 600, largestInvoice: 800, cardsCount: 1, cardBreakdown: [{ name: 'Nubank', total: 800, pct: 100 }] },
      categories: { topExpenses: [], topIncomes: [] },
      cashflow: { lastMonths: [], trend: 'down' },
      budgets: { items: [], totalOverspent: 0 },
      criticalDates: [{ date: '2026-06-25', type: 'risk', label: 'Saldo negativo', amount: -300 }],
    };

    const prompt = buildGroqFinancialAnalysisPrompt(context);
    expect(prompt).toContain('SIM');
    expect(prompt).toContain('25/06/2026');
  });

  it('prompt inclui dados de orcamento quando ausentes', () => {
    const context: any = {
      health: { totalBalance: 1000, savingsRate: 0, monthlySavings: 0, isAtRisk: false },
      cashCoverage: { isAtRisk: false, firstRiskDate: null, minimumBalance: 500, minimumBalanceDate: '2026-07-01', coverageBalance: 500, startingBalance: 1000, totalIncome: 0, totalObligations: 500, totalBankExpenses: 500, totalInvoices: 0, totalClosedInvoices: 0, totalOpenInvoices: 0, totalFutureCard: 0 },
      invoices: { totalOpen: 0, totalClosed: 0, totalPaid: 0, totalFuture: 0, monthlyAverage: 0, largestInvoice: 0, cardsCount: 0, cardBreakdown: [] },
      categories: { topExpenses: [], topIncomes: [] },
      cashflow: { lastMonths: [], trend: 'stable' },
      budgets: { items: [], totalOverspent: 0 },
      criticalDates: [],
    };

    const prompt = buildGroqFinancialAnalysisPrompt(context);
    expect(prompt).toContain('Nenhum orçamento configurado');
  });
});
