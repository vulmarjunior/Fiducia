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

  it('13 evolucao mensal coincide com distribuicao do mes da fatura (compra de julho na fatura de agosto)', () => {
    const transactions: Transaction[] = [
      {
        id: 'july-purchase',
        userId: 'u1',
        description: 'Compra Julho',
        type: 'expense',
        amount: 100,
        date: '2026-07-25',
        postingDate: '2026-07-25',
        invoicePeriod: '2026-08',
        creditCardId: 'card-c6',
        accountId: 'card-c6',
        categoryId: 'cat-alimentacao',
        status: 'paid',
        createdAt: '',
      },
    ];

    const normalized = normalizeTransactions(transactions, categories, creditCards);
    const report = buildCategoryReport('expenses', normalized, categories, [], {
      selectedMonth: '2026-08',
      status: 'all',
      intervalType: 'month',
      accumulated: false,
      includePending: false,
    });

    expect(report.total).toBe(100);
    const evolutionSum = report.evolution.reduce((s, p) => s + p.total, 0);
    expect(evolutionSum).toBe(100);
  });

  it('fechamento: receita sem categoria aparece no grupo apropriado com total preservado', () => {
    const transactions: Transaction[] = [
      {
        id: 'income-no-cat',
        userId: 'u1',
        description: 'Freelance',
        type: 'income',
        amount: 800,
        date: '2026-08-05',
        status: 'paid',
        createdAt: '',
      },
    ];

    const normalized = normalizeTransactions(transactions, categories, creditCards);
    const report = buildCategoryReport('income', normalized, categories, [], {
      selectedMonth: '2026-08',
      status: 'all',
      intervalType: 'day',
      accumulated: false,
      includePending: false,
    });

    expect(report.total).toBe(800);
    expect(report.categories).toHaveLength(1);
    expect(report.categories[0].categoryId).toBe('sem_categoria');
    expect(report.categories[0].categoryName).toBe('Sem categoria');
  });

  it('fechamento: compra de cartão sem invoicePeriod deriva pela regra canônica do cartão', () => {
    // C6: fecha dia 25, vence dia 05 → compra em 01/07 pertence à fatura de agosto
    const transactions: Transaction[] = [
      {
        id: 'card-no-period',
        userId: 'u1',
        description: 'Compra sem periodo',
        type: 'expense',
        amount: 150,
        date: '2026-07-01',
        creditCardId: 'card-c6',
        accountId: 'card-c6',
        categoryId: 'cat-alimentacao',
        status: 'paid',
        createdAt: '',
      },
    ];

    const normalized = normalizeTransactions(transactions, categories, creditCards);
    expect(normalized[0].invoicePeriod).toBe('2026-08');

    const report = buildCategoryReport('expenses', normalized, categories, [], {
      selectedMonth: '2026-08',
      status: 'all',
      intervalType: 'month',
      accumulated: false,
      includePending: false,
    });

    expect(report.total).toBe(150);
    expect(report.itemsWithoutInvoicePeriodTotal).toBe(0);
  });

  it('fechamento: cartão sem período derivável não soma em mês inventado', () => {
    const transactions: Transaction[] = [
      {
        id: 'card-no-data',
        userId: 'u1',
        description: 'Compra sem data e sem periodo',
        type: 'expense',
        amount: 200,
        date: '',
        creditCardId: 'card-c6',
        categoryId: 'cat-alimentacao',
        status: 'paid',
        createdAt: '',
      },
    ];

    const normalized = normalizeTransactions(transactions, categories, creditCards);
    const report = buildCategoryReport('expenses', normalized, categories, [], {
      selectedMonth: '2026-08',
      status: 'all',
      intervalType: 'month',
      accumulated: false,
      includePending: false,
    });

    // Aparece como item sem período de fatura, não somado a agosto
    expect(report.itemsWithoutInvoicePeriodTotal).toBe(200);
    expect(report.total).toBe(0);
    const monthBuckets = report.evolution.filter(p => p.periodKey === '2026-08');
    expect(monthBuckets.reduce((s, p) => s + p.totalCents, 0)).toBe(0);
  });

  it('fechamento: agrupamento diário com compra de cartão sem dia dentro do mês da fatura', () => {
    const transactions: Transaction[] = [
      {
        id: 'card-july',
        userId: 'u1',
        description: 'Compra Julho',
        type: 'expense',
        amount: 90,
        date: '2026-07-10',
        invoicePeriod: '2026-08',
        creditCardId: 'card-c6',
        accountId: 'card-c6',
        categoryId: 'cat-alimentacao',
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

    expect(report.total).toBe(90);
    expect(report.itemsWithoutInvoiceDayTotal).toBe(90);
    // Nenhum bucket diário de agosto recebe o valor
    const bucketSum = report.evolution.reduce((s, p) => s + p.totalCents, 0);
    expect(bucketSum).toBe(0);
  });

  it('fechamento: registros com valor inválido não viram zero silencioso', () => {
    const transactions: Transaction[] = [
      {
        id: 'invalid-amount',
        userId: 'u1',
        description: 'Valor invalido',
        type: 'expense',
        amount: undefined as unknown as number,
        date: '2026-08-10',
        status: 'paid',
        createdAt: '',
      },
      {
        id: 'cancelled-tx',
        userId: 'u1',
        description: 'Cancelada',
        type: 'expense',
        amount: 50,
        date: '2026-08-11',
        status: 'cancelled',
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

    expect(report.total).toBe(0);
    expect(report.diagnostics.invalidCount).toBe(1);
    expect(report.diagnostics.excludedCount).toBe(1);
  });

  it('fechamento: evolução em centavos é a fonte canônica e fecha com o total', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx-1',
        userId: 'u1',
        type: 'expense',
        amount: 100.1,
        date: '2026-08-01',
        description: 'A',
        categoryId: 'cat-transporte',
        status: 'paid',
        createdAt: '',
      },
      {
        id: 'tx-2',
        userId: 'u1',
        type: 'expense',
        amount: 200.2,
        date: '2026-08-02',
        description: 'B',
        categoryId: 'cat-alimentacao',
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

    const bucketTotalCents = report.evolution.reduce((s, p) => s + p.totalCents, 0);
    expect(bucketTotalCents).toBe(report.totalCents);
    expect(bucketTotalCents).toBe(30030); // R$ 300,30 em centavos, sem drift de arredondamento
  });

  it('fechamento: origem de investimento excluída por padrão e incluída quando selecionada', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx-inv',
        userId: 'u1',
        type: 'expense',
        amount: 100,
        date: '2026-08-05',
        accountId: 'inv-1',
        categoryId: 'cat-alimentacao',
        status: 'paid',
        description: 'Aporte',
        createdAt: '',
      },
      {
        id: 'tx-check',
        userId: 'u1',
        type: 'expense',
        amount: 50,
        date: '2026-08-05',
        accountId: 'acc-1',
        categoryId: 'cat-alimentacao',
        status: 'paid',
        description: 'Mercado',
        createdAt: '',
      },
    ];

    const normalized = normalizeTransactions(transactions, categories, creditCards);

    // Padrão: availableOriginIds não inclui investimentos
    const reportDefault = buildCategoryReport('expenses', normalized, categories, [], {
      selectedMonth: '2026-08',
      status: 'all',
      intervalType: 'day',
      accumulated: false,
      includePending: false,
    }, ['acc-1']);

    expect(reportDefault.total).toBe(50);
    expect(reportDefault.categories[0].entries).toHaveLength(1);

    // Seleção explícita: investimento incluído
    const reportExplicit = buildCategoryReport('expenses', normalized, categories, [], {
      selectedMonth: '2026-08',
      status: 'all',
      intervalType: 'day',
      accumulated: false,
      includePending: false,
      originIds: ['inv-1', 'acc-1'],
    });

    expect(reportExplicit.total).toBe(150);
  });
});
