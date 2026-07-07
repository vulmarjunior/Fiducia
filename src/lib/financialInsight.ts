import { buildCashCoverageProjection } from './cashCoverage';
import { buildInvoiceAnalysis } from './invoiceAnalysis';

export interface FinancialInsightContext {
  health: {
    totalBalance: number;
    savingsRate: number;
    monthlySavings: number;
    isAtRisk: boolean;
  };
  cashCoverage: {
    isAtRisk: boolean;
    firstRiskDate: string | null;
    minimumBalance: number;
    minimumBalanceDate: string;
    coverageBalance: number;
    startingBalance: number;
    totalIncome: number;
    totalObligations: number;
    totalBankExpenses: number;
    totalInvoices: number;
    totalClosedInvoices: number;
    totalOpenInvoices: number;
    totalFutureCard: number;
  };
  invoices: {
    totalOpen: number;
    totalClosed: number;
    totalPaid: number;
    totalFuture: number;
    monthlyAverage: number;
    largestInvoice: number;
    cardsCount: number;
    cardBreakdown: Array<{ name: string; total: number; pct: number }>;
  };
  categories: {
    topExpenses: Array<{ name: string; amount: number; pct: number }>;
    topIncomes: Array<{ name: string; amount: number; pct: number }>;
  };
  cashflow: {
    lastMonths: Array<{ month: string; receitas: number; despesas: number; saldo: number }>;
    trend: 'up' | 'down' | 'stable';
  };
  budgets: {
    items: Array<{ name: string; budget: number; spent: number; pct: number; overspent: boolean }>;
    totalOverspent: number;
  };
  criticalDates: Array<{
    date: string;
    type: 'risk' | 'invoice_due' | 'income_arrival' | 'expense_due';
    label: string;
    amount: number;
  }>;
}

export interface FinancialInsightParams {
  accounts: any[];
  transactions: any[];
  categories: any[];
  creditCards: any[];
  invoices: any[];
  budgets: any[];
  recurrenceRules?: any[];
}

const isIncome = (t: any) => t.type === 'receita' || t.type === 'income';
const isExpense = (t: any) => t.type === 'despesa' || t.type === 'expense';
const isTransfer = (t: any) => t.type === 'transferencia' || t.type === 'transfer';
const isCreditCardTx = (t: any) => !!t.creditCardId;
const isEffectivelyPaid = (t: any) =>
  t.status === 'pago' || t.status === 'realizado' || t.status === 'paid';
const isPending = (t: any) => t.status === 'pendente' || t.status === 'pending';

export function buildFinancialInsightContext(params: FinancialInsightParams): FinancialInsightContext | null {
  const { accounts, transactions, categories, creditCards, invoices, budgets, recurrenceRules = [] } = params;

  if (!transactions.length) return null;

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const totalBalance = accounts.reduce((s: number, a: any) => s + (a.balance || 0), 0);

  const coverage = buildCashCoverageProjection({
    accounts,
    transactions,
    creditCards,
    invoices,
    recurrenceRules,
    options: { startDate: now, days: 90 },
  });

  const invStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const invEnd = new Date(now.getFullYear(), now.getMonth() + 4, 0);
  const invoiceAnalysis = buildInvoiceAnalysis({
    creditCards,
    transactions,
    invoices,
    startDate: invStart,
    endDate: invEnd,
  });

  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const cashflowMonths = last6Months.map(month => {
    const mTx = transactions.filter(t =>
      t.date.startsWith(month) && !isCreditCardTx(t) && !isTransfer(t) && isEffectivelyPaid(t)
    );
    const receitas = mTx.filter(t => isIncome(t)).reduce((s: number, t: any) => s + t.amount, 0);
    const despesas = mTx.filter(t => isExpense(t)).reduce((s: number, t: any) => s + t.amount, 0);
    return { month, receitas, despesas, saldo: receitas - despesas };
  });

  const last3 = cashflowMonths.slice(-3);
  const totalIncome3m = last3.reduce((s, m) => s + m.receitas, 0);
  const totalExpense3m = last3.reduce((s, m) => s + m.despesas, 0);
  const savingsRate = totalIncome3m > 0 ? ((totalIncome3m - totalExpense3m) / totalIncome3m) * 100 : 0;

  const currentMonthTx = transactions.filter(t =>
    t.date.startsWith(currentMonthStr) && !isCreditCardTx(t) && !isTransfer(t) && isEffectivelyPaid(t)
  );
  const monthlyIncome = currentMonthTx.filter(t => isIncome(t)).reduce((s: number, t: any) => s + t.amount, 0);
  const monthlyExpense = currentMonthTx.filter(t => isExpense(t)).reduce((s: number, t: any) => s + t.amount, 0);

  const totalCatExpense = transactions
    .filter(t => isExpense(t) && isEffectivelyPaid(t) && !isTransfer(t) && t.date >= `${now.getFullYear()}-01`)
    .reduce((s: number, t: any) => s + t.amount, 0);
  const totalCatIncome = transactions
    .filter(t => isIncome(t) && isEffectivelyPaid(t) && !isTransfer(t) && t.date >= `${now.getFullYear()}-01`)
    .reduce((s: number, t: any) => s + t.amount, 0);

  const topExpenses = categories
    .filter((c: any) => c.type === 'despesa' || c.type === 'expense')
    .map((c: any) => {
      const val = transactions
        .filter(t => t.categoryId === c.id && isExpense(t) && isEffectivelyPaid(t) && t.date >= `${now.getFullYear()}-01`)
        .reduce((s: number, t: any) => s + t.amount, 0);
      return { name: c.name, amount: val, pct: totalCatExpense > 0 ? (val / totalCatExpense) * 100 : 0 };
    })
    .filter(c => c.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const topIncomes = categories
    .filter((c: any) => c.type === 'receita' || c.type === 'income')
    .map((c: any) => {
      const val = transactions
        .filter(t => t.categoryId === c.id && isIncome(t) && isEffectivelyPaid(t) && t.date >= `${now.getFullYear()}-01`)
        .reduce((s: number, t: any) => s + t.amount, 0);
      return { name: c.name, amount: val, pct: totalCatIncome > 0 ? (val / totalCatIncome) * 100 : 0 };
    })
    .filter(c => c.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const budgetItems = budgets
    .filter((b: any) => b.period === 'monthly' || !b.period)
    .map((b: any) => {
      const spent = transactions
        .filter(t =>
          isExpense(t) && isEffectivelyPaid(t) &&
          t.categoryId === b.categoryId &&
          t.date.startsWith(currentMonthStr)
        )
        .reduce((s: number, t: any) => s + t.amount, 0);
      const cat = categories.find((c: any) => c.id === b.categoryId);
      const pct = b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0;
      return {
        name: cat?.name || 'Geral',
        budget: b.amount,
        spent,
        pct,
        overspent: spent > b.amount,
      };
    })
    .filter(b => b.budget > 0 || b.spent > 0)
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 8);

  const cashflowTrend = (() => {
    if (last3.length < 2) return 'stable';
    const diffs = [];
    for (let i = 1; i < last3.length; i++) {
      diffs.push(last3[i].saldo - last3[i - 1].saldo);
    }
    const avgDiff = diffs.reduce((s, d) => s + d, 0) / diffs.length;
    if (avgDiff > 50) return 'up';
    if (avgDiff < -50) return 'down';
    return 'stable';
  })();

  const criticalDates: FinancialInsightContext['criticalDates'] = [];

  if (coverage.firstRiskDate) {
    criticalDates.push({
      date: coverage.firstRiskDate,
      type: 'risk',
      label: 'Primeiro dia com saldo negativo',
      amount: coverage.minimumBalance,
    });
  }

  const overdueExpenses = transactions.filter(t =>
    isExpense(t) && isPending(t) && !isCreditCardTx(t) && !isTransfer(t)
    && (t.date || '') < `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  );
  overdueExpenses.slice(0, 3).forEach(t => {
    criticalDates.push({
      date: (t.date || '').split('T')[0],
      type: 'expense_due',
      label: t.description || 'Despesa atrasada',
      amount: t.amount || 0,
    });
  });

  coverage.events
    .filter(e => e.source === 'invoice_closed' && e.status === 'overdue')
    .slice(0, 2)
    .forEach(e => {
      criticalDates.push({
        date: e.originalDate,
        type: 'invoice_due',
        label: e.label,
        amount: e.amount,
      });
    });

  coverage.events
    .filter(e => e.direction === 'in' && e.status === 'future')
    .slice(0, 2)
    .forEach(e => {
      criticalDates.push({
        date: e.originalDate,
        type: 'income_arrival',
        label: e.label,
        amount: e.amount,
      });
    });

  return {
    health: {
      totalBalance,
      savingsRate: Math.round(savingsRate * 10) / 10,
      monthlySavings: monthlyIncome - monthlyExpense,
      isAtRisk: coverage.isAtRisk,
    },
    cashCoverage: {
      isAtRisk: coverage.isAtRisk,
      firstRiskDate: coverage.firstRiskDate,
      minimumBalance: coverage.minimumBalance,
      minimumBalanceDate: coverage.minimumBalanceDate,
      coverageBalance: coverage.coverageBalance,
      startingBalance: coverage.startingBalance,
      totalIncome: coverage.totalIncome,
      totalObligations: coverage.totalObligations,
      totalBankExpenses: coverage.totalBankExpenses,
      totalInvoices: coverage.totalInvoices,
      totalClosedInvoices: coverage.totalClosedInvoices,
      totalOpenInvoices: coverage.totalOpenInvoices,
      totalFutureCard: coverage.totalFutureCard,
    },
    invoices: {
      totalOpen: invoiceAnalysis.summary.totalOpen,
      totalClosed: invoiceAnalysis.summary.totalClosed,
      totalPaid: invoiceAnalysis.summary.totalPaid,
      totalFuture: invoiceAnalysis.summary.totalFuture,
      monthlyAverage: invoiceAnalysis.summary.monthlyAverage,
      largestInvoice: invoiceAnalysis.summary.largestInvoice,
      cardsCount: invoiceAnalysis.summary.cardsCount,
      cardBreakdown: invoiceAnalysis.cardBreakdown.map(c => ({
        name: c.name,
        total: c.total,
        pct: Math.round(c.pct * 10) / 10,
      })),
    },
    categories: {
      topExpenses,
      topIncomes,
    },
    cashflow: {
      lastMonths: cashflowMonths.slice(-3),
      trend: cashflowTrend,
    },
    budgets: {
      items: budgetItems.slice(0, 5),
      totalOverspent: budgetItems.filter(b => b.overspent).length,
    },
    criticalDates,
  };
}

export function buildGroqFinancialAnalysisPrompt(context: FinancialInsightContext): string {
  const fmtBR = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtDate = (d: string | null) => {
    if (!d) return 'N/A';
    return d.split('-').reverse().join('/');
  };

  const ctxSummary = {
    saude_financeira: {
      saldo_total: fmtBR(context.health.totalBalance),
      economia_mensal: fmtBR(context.health.monthlySavings),
      taxa_poupanca: `${context.health.savingsRate.toFixed(1)}%`,
      em_risco: context.health.isAtRisk ? 'SIM' : 'NÃO',
    },
    cobertura_caixa_90dias: {
      caixa_inicial: fmtBR(context.cashCoverage.startingBalance),
      total_a_receber: fmtBR(context.cashCoverage.totalIncome),
      total_obrigacoes: fmtBR(context.cashCoverage.totalObligations),
      despesas_banco: fmtBR(context.cashCoverage.totalBankExpenses),
      faturas_total: fmtBR(context.cashCoverage.totalInvoices),
      faturas_fechadas: fmtBR(context.cashCoverage.totalClosedInvoices),
      faturas_abertas: fmtBR(context.cashCoverage.totalOpenInvoices),
      faturas_futuras: fmtBR(context.cashCoverage.totalFutureCard),
      menor_saldo_projetado: fmtBR(context.cashCoverage.minimumBalance),
      data_menor_saldo: fmtDate(context.cashCoverage.minimumBalanceDate),
      primeira_data_risco: fmtDate(context.cashCoverage.firstRiskDate),
      cobertura_final: fmtBR(context.cashCoverage.coverageBalance),
    },
    faturas_cartao: {
      abertas: fmtBR(context.invoices.totalOpen),
      fechadas: fmtBR(context.invoices.totalClosed),
      pagas: fmtBR(context.invoices.totalPaid),
      comprometimento_futuro: fmtBR(context.invoices.totalFuture),
      media_mensal: fmtBR(context.invoices.monthlyAverage),
      maior_fatura: fmtBR(context.invoices.largestInvoice),
      cartoes: context.invoices.cardBreakdown.map(c => ({
        nome: c.name,
        total: fmtBR(c.total),
        participacao: `${c.pct}%`,
      })),
    },
    categorias: {
      maiores_despesas: context.categories.topExpenses.map(c => ({
        nome: c.name,
        valor: fmtBR(c.amount),
        peso: `${c.pct.toFixed(1)}%`,
      })),
      maiores_receitas: context.categories.topIncomes.map(c => ({
        nome: c.name,
        valor: fmtBR(c.amount),
        peso: `${c.pct.toFixed(1)}%`,
      })),
    },
    fluxo_caixa_ultimos3meses: context.cashflow.lastMonths.map(m => ({
      mes: m.month,
      receitas: fmtBR(m.receitas),
      despesas: fmtBR(m.despesas),
      saldo: `${m.saldo >= 0 ? '+' : ''}${fmtBR(m.saldo)}`,
    })),
    tendencia: context.cashflow.trend === 'up' ? 'CRESCENDO' : context.cashflow.trend === 'down' ? 'CAINDO' : 'ESTÁVEL',
    orcamentos: context.budgets.items.length > 0 ? {
      itens: context.budgets.items.map(b => ({
        nome: b.name,
        orcado: fmtBR(b.budget),
        gasto: fmtBR(b.spent),
        percentual: `${b.pct}%`,
        estourado: b.overspent ? 'SIM ⚠️' : 'NÃO',
      })),
      total_estourados: context.budgets.totalOverspent,
    } : 'Nenhum orçamento configurado',
    datas_criticas: context.criticalDates.slice(0, 8).map(d => ({
      data: fmtDate(d.date),
      tipo: d.type === 'risk' ? 'RISCO DE SALDO NEGATIVO' :
        d.type === 'invoice_due' ? 'VENCIMENTO DE FATURA' :
        d.type === 'income_arrival' ? 'ENTRADA PREVISTA' : 'DESPESA ATRASADA',
      descricao: d.label,
      valor: fmtBR(d.amount),
    })),
  };

  return `Você é o analista financeiro do Fiducia, um sistema de gestão financeira pessoal. Sua função é interpretar os dados calculados pelo sistema e fornecer recomendações acionáveis.

REGRAS ABSOLUTAS:
- JAMAIS invente dados. Use apenas os valores, datas e nomes exatos do contexto abaixo.
- JAMAIS recalcule. Todos os cálculos (saldos, médias, projeções, percentuais) foram feitos pelo sistema.
- Seja ESPECÍFICO: cite valores exatos, datas reais, nomes de categorias e cartões do contexto.
- Evite conselhos genéricos como "controle seus gastos" ou "economize mais".
- Se houver risco de saldo negativo, APONTE o primeiro dia crítico, o valor e a causa principal.
- Se não houver risco, explique a folga e sugira como otimizar o excedente.
- Responda em Português claro, parágrafos curtos e diretos.

CONTEXTO FINANCEIRO (dados calculados pelo Fiducia):
${JSON.stringify(ctxSummary, null, 2)}

FORMATO EXIGIDO DA RESPOSTA:

1. DIAGNÓSTICO PRINCIPAL
[2-3 frases resumindo a situação financeira atual. Comece com a conclusão principal.]

2. DATAS CRÍTICAS
[Se houver datas críticas, liste as 3 mais importantes com data, motivo e valor. Se não houver, diga que o horizonte está tranquilo.]

3. PRINCIPAIS CAUSAS
[O que está pressionando as finanças (ex: fatura alta do cartão X, categoria Y concentrando gastos) ou o que está aliviando (ex: receita prevista antes dos vencimentos). Cite valores e nomes.]

4. RISCOS SE NADA MUDAR
[Cenário do que acontece se nenhuma ação for tomada. Se for positivo, destaque a folga e o que poderia ser investido.]

5. AÇÕES RECOMENDADAS
[3 a 5 ações em ordem de impacto, cada uma com: o que fazer, por que e o impacto estimado em R$. Seja específico com datas e valores.]

Lembrete: você está interpretando dados já calculados. Não os questione. Seja empático mas direto.`;
}
