import { describe, expect, it } from 'vitest';
import type { Category, CreditCard, Invoice, Transaction } from '../../types';
import { normalizeTransactions } from './normalize';
import { buildCategoryReport } from './categoryReport';

describe('categoryReport', () => {
  const categories: Category[] = [
    { id: 'cat-alimentacao', name: 'Alimentação', type: 'expense', icon: 'Utensils', isDefault: true, createdAt: '', userId: 'u1' },
    { id: 'cat-mercado', name: 'Supermercado', type: 'expense', icon: 'ShoppingCart', isDefault: false, parentId: 'cat-alimentacao', createdAt: '', userId: 'u1' },
    { id: 'cat-transporte', name: 'Transporte', type: 'expense', icon: 'Car', isDefault: true, createdAt: '', userId: 'u1' },
    { id: 'cat-salario', name: 'Salário', type: 'income', icon: 'Briefcase', isDefault: true, createdAt: '', userId: 'u1' },
  ];

  const creditCards: CreditCard[] = [
    { id: 'card-c6', name: 'C6 Bank', limit: 5000, closingDay: 25, dueDay: 5, createdAt: '', userId: 'u1' },
  ];

  it('compra R$ 300 e estorno R$ 50 no cartão: despesa líquida R$ 250; receitas não aumentam', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx-1',
        userId: 'u1',
        type: 'expense',
        amount: 300,
        date: '2026-08-10',
        description: 'Supermercado',
        categoryId: 'cat-mercado',
        creditCardId: 'card-c6',
        invoicePeriod: '2026-08',
        status: 'paid',
        createdAt: '',
      },
      {
        id: 'tx-2',
        userId: 'u1',
        type: 'income', // Estorno no cartão
        amount: 50,
        date: '2026-08-12',
        description: 'Estorno Supermercado',
        categoryId: 'cat-mercado',
        creditCardId: 'card-c6',
        invoicePeriod: '2026-08',
        status: 'paid',
        createdAt: '',
      },
    ];

    const normalized = normalizeTransactions(transactions, categories, creditCards);

    // Relatório de Despesas
    const expReport = buildCategoryReport('expenses', normalized, categories, [], {
      selectedMonth: '2026-08',
      status: 'all',
      intervalType: 'day',
      accumulated: false,
      includePending: false,
    });

    expect(expReport.total).toBe(250);
    expect(expReport.categories).toHaveLength(1);
    expect(expReport.categories[0].categoryId).toBe('cat-mercado');
    expect(expReport.categories[0].total).toBe(250);

    // Relatório de Receitas: o estorno do cartão NÃO deve aparecer como receita
    const incReport = buildCategoryReport('income', normalized, categories, [], {
      selectedMonth: '2026-08',
      status: 'all',
      intervalType: 'day',
      accumulated: false,
      includePending: false,
    });

    expect(incReport.total).toBe(0);
    expect(incReport.categories).toHaveLength(0);
  });

  it('categoria pai e filha selecionadas: cada transação entra uma vez sem duplicação', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx-1',
        userId: 'u1',
        type: 'expense',
        amount: 100,
        date: '2026-08-05',
        description: 'Compras',
        categoryId: 'cat-mercado', // Filha de Alimentação
        accountId: 'acc-1',
        status: 'paid',
        createdAt: '',
      },
    ];

    const normalized = normalizeTransactions(transactions, categories, creditCards);

    // Seleciona tanto a pai (Alimentação) quanto a filha (Supermercado)
    const report = buildCategoryReport('expenses', normalized, categories, [], {
      selectedMonth: '2026-08',
      categoryIds: ['cat-alimentacao', 'cat-mercado'],
      status: 'all',
      intervalType: 'month',
      accumulated: false,
      includePending: false,
    });

    expect(report.total).toBe(100);
    expect(report.categories).toHaveLength(1);
    expect(report.categories[0].total).toBe(100);
    expect(report.categories[0].entriesCount).toBe(1);
  });

  it('filtra com interseção: (Alimentação OU Transporte) E (Conta 1)', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx-1',
        userId: 'u1',
        type: 'expense',
        amount: 100,
        date: '2026-08-05',
        description: 'Alimentação Conta 1',
        categoryId: 'cat-alimentacao',
        accountId: 'acc-1',
        status: 'paid',
        createdAt: '',
      },
      {
        id: 'tx-2',
        userId: 'u1',
        type: 'expense',
        amount: 50,
        date: '2026-08-06',
        description: 'Transporte Conta 2',
        categoryId: 'cat-transporte',
        accountId: 'acc-2', // Não selecionada
        status: 'paid',
        createdAt: '',
      },
    ];

    const normalized = normalizeTransactions(transactions, categories, creditCards);

    const report = buildCategoryReport('expenses', normalized, categories, [], {
      selectedMonth: '2026-08',
      categoryIds: ['cat-alimentacao', 'cat-transporte'],
      originIds: ['acc-1'], // Apenas acc-1
      status: 'all',
      intervalType: 'day',
      accumulated: false,
      includePending: false,
    });

    expect(report.total).toBe(100);
    expect(report.categories).toHaveLength(1);
    expect(report.categories[0].categoryId).toBe('cat-alimentacao');
  });

  it('identifica categoria líquida negativa e sinaliza flag hasNegativeCategories', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx-1',
        userId: 'u1',
        type: 'income', // Estorno maior que compra
        amount: 80,
        date: '2026-08-15',
        description: 'Estorno Total',
        categoryId: 'cat-transporte',
        creditCardId: 'card-c6',
        invoicePeriod: '2026-08',
        status: 'paid',
        createdAt: '',
      },
    ];

    const normalized = normalizeTransactions(transactions, categories, creditCards);

    const report = buildCategoryReport('expenses', normalized, categories, [], {
      selectedMonth: '2026-08',
      status: 'all',
      intervalType: 'day',
      accumulated: false,
      includePending: false,
    });

    expect(report.total).toBe(-80);
    expect(report.hasNegativeCategories).toBe(true);
    expect(report.categories[0].total).toBe(-80);
  });

  it('exclui pagamentos de fatura da visão de categoria de despesas', () => {
    const invoices: Invoice[] = [
      {
        id: 'inv-1',
        userId: 'u1',
        cardId: 'card-c6',
        period: '2026-08',
        status: 'paga',
        totalAmount: 1500,
        paymentTransactionIds: ['tx-pay-1'],
      },
    ];

    const transactions: Transaction[] = [
      {
        id: 'tx-pay-1',
        userId: 'u1',
        type: 'expense',
        amount: 1500,
        date: '2026-08-05',
        description: 'Pagamento de fatura C6',
        accountId: 'acc-1',
        categoryId: 'cat-alimentacao',
        status: 'paid',
        createdAt: '',
      },
      {
        id: 'tx-normal',
        userId: 'u1',
        type: 'expense',
        amount: 80,
        date: '2026-08-08',
        description: 'Lanche',
        accountId: 'acc-1',
        categoryId: 'cat-alimentacao',
        status: 'paid',
        createdAt: '',
      },
    ];

    const normalized = normalizeTransactions(transactions, categories, creditCards, invoices);

    const report = buildCategoryReport('expenses', normalized, categories, invoices, {
      selectedMonth: '2026-08',
      status: 'all',
      intervalType: 'day',
      accumulated: false,
      includePending: false,
    });

    expect(report.total).toBe(80);
    expect(report.categories).toHaveLength(1);
  });
});
