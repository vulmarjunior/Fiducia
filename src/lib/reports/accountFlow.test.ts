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
    const startingCents = calculateStartingBalanceCents(account, normalized, '2026-08-01', '2026-08-31');

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

  describe('conformidade estrita com a auditoria v0.16.0', () => {
    const acc = (id: string, initialBalance: number, balance = initialBalance, extra: Partial<Account> = {}): Account => ({
      id, name: id, userId: 'u1', type: 'checking', initialBalance, balance, createdAt: '2026-01-01', openingDate: '2026-01-01', ...extra,
    });
    const tx = (overrides: Partial<Transaction>): Transaction => ({
      id: 'tx-syn', userId: 'u1', type: 'expense', status: 'paid', amount: 100,
      date: '2026-08-10', description: 'Syn', accountId: 'A', createdAt: '2026-08-10', ...overrides,
    });
    const card: CreditCard = { id: 'card', name: 'Card', userId: 'u1', limit: 5000, closingDay: 20, dueDay: 27, createdAt: '' };
    const inv = (overrides: Partial<Invoice> = {}): Invoice => ({
      id: 'invoice', userId: 'u1', cardId: 'card', period: '2026-08', status: 'aberta', totalAmount: 1000, ...overrides,
    });
    const baseFilters = { selectedMonth: '2026-08', status: 'all' as const, intervalType: 'day' as const, accumulated: false, includePending: false };

    it('01 movimentos de uma conta nao pertencem a outra', () => {
      const multiTx = [tx({ id: 'income-A', type: 'income', amount: 500 }), tx({ id: 'expense-B', accountId: 'B', amount: 100 })];
      const multiAccounts = [acc('A', 1000, 1500), acc('B', 2000, 1900)];
      const res = buildAccountFlowReport(multiAccounts, [card], [], normalizeTransactions(multiTx, [], [card]), baseFilters);
      expect(res.accountFlowResult.accounts.map(a => a.endingBalance)).toEqual([1500, 1900]);
    });

    it('02 saldo do indicador coincide com ultimo ponto do grafico', () => {
      const multiTx = [tx({ id: 'income-A', type: 'income', amount: 500 }), tx({ id: 'expense-B', accountId: 'B', amount: 100 })];
      const multiAccounts = [acc('A', 1000, 1500), acc('B', 2000, 1900)];
      const res = buildAccountFlowReport(multiAccounts, [card], [], normalizeTransactions(multiTx, [], [card]), baseFilters);
      expect(res.cashFlowResult.endingBalance).toBe(3400);
      expect(res.cashFlowResult.points.at(-1)?.endingBalance).toBe(3400);
    });

    it('03 identidade saldo inicial + entradas - saidas = saldo final', () => {
      const multiTx = [tx({ id: 'income-A', type: 'income', amount: 500 }), tx({ id: 'expense-B', accountId: 'B', amount: 100 })];
      const multiAccounts = [acc('A', 1000, 1500), acc('B', 2000, 1900)];
      const res = buildAccountFlowReport(multiAccounts, [card], [], normalizeTransactions(multiTx, [], [card]), baseFilters);
      const calculated = res.cashFlowResult.startingBalance! + res.cashFlowResult.totalInflow - res.cashFlowResult.totalOutflow;
      expect(res.cashFlowResult.endingBalance).toBe(calculated);
    });

    it('04 saldo historico nao incorpora movimentos de outras contas', () => {
      const pastTx = [tx({ id: 'income-A', type: 'income', amount: 500, date: '2026-07-10' }), tx({ id: 'expense-B', accountId: 'B', amount: 100, date: '2026-07-10' })];
      const multiAccounts = [acc('A', 1000, 1500), acc('B', 2000, 1900)];
      const res = buildAccountFlowReport(multiAccounts, [card], [], normalizeTransactions(pastTx, [], [card]), baseFilters);
      expect(res.accountFlowResult.accounts.map(a => a.startingBalance)).toEqual([1500, 1900]);
    });

    it('05 selecao vazia nao equivale a todas as contas', () => {
      const multiTx = [tx({ id: 'income-A', type: 'income', amount: 500 })];
      const multiAccounts = [acc('A', 1000), acc('B', 2000)];
      const res = buildAccountFlowReport(multiAccounts, [card], [], normalizeTransactions(multiTx, [], [card]), { ...baseFilters, originIds: [] });
      expect(res.accountFlowResult.accounts).toHaveLength(0);
    });

    it('07 pagamento oficial pendente reduz residual sem precisar creditCardId', () => {
      const partial = inv({ status: 'parcial', paidAmount: 400, paymentTransactionIds: ['scheduled'] });
      const scheduled = tx({ id: 'scheduled', status: 'pending', amount: 200, date: '2026-08-27' });
      const res = buildAccountFlowReport([acc('A', 1000)], [card], [partial], normalizeTransactions([scheduled], [], [card], [partial]), { ...baseFilters, includePending: true });
      expect(res.accountFlowResult.unallocatedInvoiceObligations).toBe(400);
      expect(res.accountFlowResult.consolidatedProjectedEndingBalance).toBe(400);
    });

    it('10 desativar pendencias nao desconta fatura do saldo previsto', () => {
      const res = buildAccountFlowReport([acc('A', 1000)], [card], [inv({ totalAmount: 100 })], [], baseFilters);
      expect(res.accountFlowResult.consolidatedProjectedEndingBalance).toBe(1000);
    });

    it('11 selecao parcial nao recebe obrigacao sem conta arbitraria', () => {
      const res = buildAccountFlowReport([acc('A', 1000), acc('B', 2000)], [card], [inv({ totalAmount: 100 })], [], { ...baseFilters, originIds: ['A'], includePending: true });
      expect(res.accountFlowResult.consolidatedProjectedEndingBalance).toBe(1000);
    });

    it('12 vencimento fora do intervalo personalizado nao entra', () => {
      const res = buildAccountFlowReport([acc('A', 1000)], [card], [inv({ totalAmount: 100 })], [], {
        ...baseFilters,
        includePending: true,
        customRange: { startDate: '2026-08-01', endDate: '2026-08-05' },
      });
      expect(res.accountFlowResult.unallocatedInvoiceObligations).toBe(0);
    });

    it('14 incluir pendentes afeta valores exibidos em entradas x saidas', () => {
      const pendingTx = tx({ id: 'pending', status: 'pending', amount: 100 });
      const res = buildAccountFlowReport([acc('A', 1000)], [card], [], normalizeTransactions([pendingTx], [], [card]), { ...baseFilters, includePending: true });
      expect(res.cashFlowResult.totalOutflow).toBe(100);
    });

    it('15 somente realizados exclui pendencias tambem do detalhamento', () => {
      const pendingTx = tx({ id: 'pending', status: 'pending', amount: 100 });
      const res = buildAccountFlowReport([acc('A', 1000)], [card], [], normalizeTransactions([pendingTx], [], [card]), baseFilters);
      expect(res.cashFlowResult.points.flatMap(p => p.entries)).toHaveLength(0);
    });

    it('16 nao declarar conciliacao sem comparar saldo persistido', () => {
      const res = buildAccountFlowReport([acc('A', 1000, 9000)], [card], [], [], baseFilters);
      expect(res.accountFlowResult.accounts[0].isReconciled).toBe(false);
    });

    it('17 ausencia de saldo inicial nao pode resultar em conciliado', () => {
      const noInit = { ...acc('A', 0, 9000), initialBalance: undefined };
      const res = buildAccountFlowReport([noInit], [card], [], [], baseFilters);
      expect(res.accountFlowResult.accounts[0].isReconciled).toBe(false);
    });

    it('18 conta aberta em setembro nao fornece capital em agosto', () => {
      const futureAcc = { ...acc('A', 1000), openingDate: '2026-09-01', createdAt: '2026-09-01' };
      const res = buildAccountFlowReport([futureAcc], [card], [], [], baseFilters);
      expect(res.accountFlowResult.consolidatedStartingBalance).toBe(0);
    });
  });

  describe('fechamento do plano — matriz seção 8', () => {
    const acc = (id: string, initialBalance: number, balance = initialBalance, extra: Partial<Account> = {}): Account => ({
      id, name: id, userId: 'u1', type: 'checking', initialBalance, balance, createdAt: '2026-01-01', openingDate: '2026-01-01', ...extra,
    });
    const tx = (overrides: Partial<Transaction>): Transaction => ({
      id: 'tx-syn', userId: 'u1', type: 'expense', status: 'paid', amount: 100,
      date: '2026-08-10', description: 'Syn', accountId: 'A', createdAt: '2026-08-10', ...overrides,
    });
    const card: CreditCard = { id: 'card', name: 'Card', userId: 'u1', limit: 5000, closingDay: 20, dueDay: 27, createdAt: '' };
    const inv = (overrides: Partial<Invoice> = {}): Invoice => ({
      id: 'invoice', userId: 'u1', cardId: 'card', period: '2026-08', status: 'aberta', totalAmount: 1000, ...overrides,
    });
    const baseFilters = { selectedMonth: '2026-08', status: 'all' as const, intervalType: 'day' as const, accumulated: false, includePending: false };

    it('fatura R$ 1.000, pago R$ 400 sem agendamento: residual R$ 600 (matriz caso 10)', () => {
      const partial = inv({ status: 'parcial', paidAmount: 400 });
      const res = buildAccountFlowReport([acc('A', 1000)], [card], [partial], [], { ...baseFilters, includePending: true });
      expect(res.accountFlowResult.unallocatedInvoiceObligations).toBe(600);
      expect(res.accountFlowResult.unallocatedInvoices[0].remainingAmountCents).toBe(60000);
    });

    it('fatura paga legada sem paidAmount: residual zero (matriz caso 12)', () => {
      const paidLegacy = inv({ status: 'paga' });
      const res = buildAccountFlowReport([acc('A', 1000)], [card], [paidLegacy], [], { ...baseFilters, includePending: true });
      expect(res.accountFlowResult.unallocatedInvoiceObligations).toBe(0);
      expect(res.accountFlowResult.unallocatedInvoices).toHaveLength(0);
    });

    it('conta aberta no meio do período: capital de abertura separado, não vira receita (matriz caso 17)', () => {
      const opened = acc('A', 2000, 2000, { openingDate: '2026-08-15', createdAt: '2026-08-15' });
      const incomeTx = tx({ id: 'income', type: 'income', amount: 500, date: '2026-08-20' });
      const res = buildAccountFlowReport([opened], [card], [], normalizeTransactions([incomeTx], [], [card]), baseFilters);

      const item = res.accountFlowResult.accounts[0];
      // Capital NÃO entra nas entradas operacionais
      expect(item.openingCapital).toBe(2000);
      expect(item.inflow).toBe(500);
      expect(item.startingBalance).toBe(0);
      // Saldo final = capital + entradas
      expect(item.endingBalance).toBe(2500);
      // No ponto do dia 15, o capital aparece como saldo de abertura, não como entrada
      const openPoint = item.points.find(p => p.periodKey === '2026-08-15');
      expect(openPoint?.openingCapitalCents).toBe(200000);
      expect(openPoint?.inflowCents).toBe(0);
      // No consolidado, igual
      expect(res.accountFlowResult.consolidatedOpeningCapital).toBe(2000);
      expect(res.cashFlowResult.totalInflow).toBe(500);
      expect(res.cashFlowResult.endingBalance).toBe(2500);
    });

    it('pago com data futura e pendente atrasado fora do intervalo (matriz caso 19)', () => {
      const futurePaid = tx({ id: 'future-paid', type: 'income', amount: 300, date: '2026-09-30', status: 'paid' });
      const overduePending = tx({ id: 'overdue', amount: 100, date: '2026-07-05', status: 'pending' });
      const res = buildAccountFlowReport([acc('A', 1000, 1300)], [card], [], normalizeTransactions([futurePaid, overduePending], [], [card]), {
        ...baseFilters,
        includePending: true,
      });

      // Futuro pago fora do intervalo: não infla o período
      expect(res.cashFlowResult.totalInflow).toBe(0);
      // Pendente atrasado é sinalizado como priorPending, sem incorporar ao saldo
      expect(res.cashFlowResult.priorPendingCents).toBe(10000);
      expect(res.accountFlowResult.consolidatedPriorPending).toBe(100);
      expect(res.cashFlowResult.endingBalance).toBe(1000);
      expect(res.accountFlowResult.accounts[0].priorPending).toBe(100);
    });

    it('cartão legado por accountId não entra no saldo bancário (matriz caso 20)', () => {
      const legacyCard = { ...card, id: 'card' };
      const cardTx = tx({ id: 'card-purchase', accountId: 'card', status: 'paid', amount: 400 });
      const res = buildAccountFlowReport([acc('A', 1000)], [legacyCard], [], normalizeTransactions([cardTx], [], [legacyCard]), baseFilters);
      expect(res.cashFlowResult.totalOutflow).toBe(0);
      expect(res.cashFlowResult.endingBalance).toBe(1000);
    });

    it('isReconciledToday: posição até hoje conciliada mesmo com pagamento futuro marcado como pago', () => {
      // Data garantidamente futura em relação ao relógio do ambiente de teste
      const futureYear = new Date().getFullYear() + 1;
      const pastExpense = tx({ id: 'past-expense', amount: 200, date: '2026-07-10', status: 'paid' });
      const futurePaid = tx({ id: 'future-paid', type: 'income', amount: 500, date: `${futureYear}-01-15`, status: 'paid' });
      const res = buildAccountFlowReport(
        [acc('A', 1000, 800)],
        [card],
        [],
        normalizeTransactions([pastExpense, futurePaid], [], [card]),
        baseFilters
      );
      // Total (com futuro pago) diverge do saldo persistido; posição até hoje concilia
      expect(res.accountFlowResult.accounts[0].isReconciled).toBe(false);
      expect(res.accountFlowResult.accounts[0].isReconciledToday).toBe(true);
    });

    it('cancelado é excluído do fluxo e contado no diagnóstico', () => {
      const cancelled = tx({ id: 'cancelled', status: 'cancelled', amount: 100 });
      const invalid = { ...tx({ id: 'invalid-amt' }), amount: undefined as unknown as number };
      const res = buildAccountFlowReport([acc('A', 1000)], [card], [], normalizeTransactions([cancelled, invalid], [], [card]), baseFilters);
      expect(res.cashFlowResult.totalOutflow).toBe(0);
      expect(res.cashFlowResult.diagnostics.excludedCount).toBe(1);
      expect(res.cashFlowResult.diagnostics.invalidCount).toBe(1);
    });

    it('fatura fechada com residual aparece como saída pendente no vencimento e no saldo previsto', () => {
      // Fatura fechada (total 1000, sem pagamento) → obrigação residual R$ 1.000
      const closed = inv({ status: 'fechada', totalAmount: 1000 });
      const cardFechada: CreditCard = { ...card, dueDay: 10 };
      const res = buildAccountFlowReport([acc('A', 1000)], [cardFechada], [closed], [], {
        ...baseFilters,
        includePending: true,
      });

      // A obrigação é injetada no ponto do vencimento (10/08)
      const duePoint = res.cashFlowResult.points.find(p => p.periodKey === '2026-08-10');
      expect(duePoint?.pendingOutflowCents).toBe(100000);
      expect(duePoint?.hasPending).toBe(true);
      expect(res.cashFlowResult.invoiceObligationsCents).toBe(100000);
      expect(res.cashFlowResult.invoiceObligationsIncludedInPoints).toBe(true);
      // O saldo previsto final desconta a fatura: 1000 - 1000 = 0
      expect(res.cashFlowResult.endingBalance).toBe(1000);
      expect(res.accountFlowResult.consolidatedProjectedEndingBalance).toBe(0);
    });

    it('fatura fechada aparece como nota sem débito em seleção parcial de contas', () => {
      const closed = inv({ status: 'fechada', totalAmount: 1000 });
      const cardFechada: CreditCard = { ...card, dueDay: 10 };
      const res = buildAccountFlowReport([acc('A', 1000), acc('B', 500)], [cardFechada], [closed], [], {
        ...baseFilters,
        originIds: ['A'],
        includePending: true,
      });

      // Não é debitada de nenhuma conta da seleção parcial
      expect(res.cashFlowResult.invoiceObligationsCents).toBe(100000);
      expect(res.cashFlowResult.invoiceObligationsIncludedInPoints).toBe(false);
      expect(res.cashFlowResult.points.every(p => p.pendingOutflowCents === 0)).toBe(true);
      expect(res.accountFlowResult.consolidatedProjectedEndingBalance).toBe(1000);
    });

    it('sem incluir pendentes, faturas não são injetadas nos pontos', () => {
      const closed = inv({ status: 'fechada', totalAmount: 1000 });
      const cardFechada: CreditCard = { ...card, dueDay: 10 };
      const res = buildAccountFlowReport([acc('A', 1000)], [cardFechada], [closed], [], baseFilters);
      expect(res.cashFlowResult.invoiceObligationsIncludedInPoints).toBe(false);
      expect(res.cashFlowResult.points.every(p => p.pendingOutflowCents === 0)).toBe(true);
      expect(res.cashFlowResult.endingBalance).toBe(1000);
    });

    it('com incluir pendentes, faturas fechadas aparecem no ponto exibido e nos totais do gráfico', () => {
      const closed = inv({ status: 'fechada', totalAmount: 1000 });
      const cardFechada: CreditCard = { ...card, dueDay: 10 };

      const res = buildAccountFlowReport([acc('A', 1000)], [cardFechada], [closed], [], {
        ...baseFilters,
        includePending: true,
      });

      // Valor exibido no ponto do vencimento (gráfico/tabela) inclui a fatura
      const duePoint = res.cashFlowResult.points.find(p => p.periodKey === '2026-08-10');
      expect(duePoint?.outflow).toBe(1000);
      expect(duePoint?.result).toBe(-1000);
      // Totais dos cards refletem a fatura
      expect(res.cashFlowResult.totalOutflow).toBe(1000);
      expect(res.cashFlowResult.netResult).toBe(-1000);
      // Saldo previsto desconta a fatura sobre o realizado
      expect(res.accountFlowResult.consolidatedProjectedEndingBalance).toBe(0);

      // Sem pendentes, a fatura não aparece no ponto exibido
      const res2 = buildAccountFlowReport([acc('A', 1000)], [cardFechada], [closed], [], baseFilters);
      expect(res2.cashFlowResult.points.find(p => p.periodKey === '2026-08-10')?.outflow).toBe(0);
      expect(res2.cashFlowResult.totalOutflow).toBe(0);
    });

    it('conta de investimento fica fora do saldo por padrão e entra quando selecionada', () => {
      const invest = { ...acc('INV', 5000), type: 'investment' as const };
      const checking = acc('A', 1000);

      // Padrão (originIds undefined): só contas com disponibilidade imediata
      const resDefault = buildAccountFlowReport([checking, invest], [card], [], [], baseFilters);
      expect(resDefault.accountFlowResult.accounts.map(a => a.accountId)).toEqual(['A']);
      expect(resDefault.accountFlowResult.consolidatedStartingBalance).toBe(1000);
      expect(resDefault.cashFlowResult.startingBalance).toBe(1000);

      // Seleção explícita: investimento entra
      const resExpl = buildAccountFlowReport([checking, invest], [card], [], [], {
        ...baseFilters,
        originIds: ['A', 'INV'],
      });
      expect(resExpl.accountFlowResult.accounts.map(a => a.accountId).sort()).toEqual(['A', 'INV']);
      expect(resExpl.accountFlowResult.consolidatedStartingBalance).toBe(6000);
    });
  });
});
