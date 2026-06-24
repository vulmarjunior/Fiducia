import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTransactionDialog } from '../contexts/TransactionDialogContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, ComposedChart, Line,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Target, Sparkles, Loader2, Brain,
  ArrowUpRight, ArrowDownRight, ChevronDown, ChevronRight,
  CreditCard, BarChart2, Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { isEffectivelyPaid } from '../lib/utils';
import { buildCashCoverageProjection } from '../lib/cashCoverage';
import { buildInvoiceAnalysis } from '../lib/invoiceAnalysis';
import { buildFinancialInsightContext, buildGroqFinancialAnalysisPrompt } from '../lib/financialInsight';
import { PageHelp } from '../components/PageHelp';
import { callGroq } from '../services/groqService';
import { Button } from '../components/ui/button';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6'];

const isTransfer = (t: any) => t.type === 'transferencia' || t.type === 'transfer';
const isCreditCardTx = (t: any) => !!t.creditCardId;
const isIncome = (t: any) => t.type === 'receita' || t.type === 'income';
const isExpense = (t: any) => t.type === 'despesa' || t.type === 'expense';
const isPending = (t: any) => t.status === 'pendente' || t.status === 'pending';

// Safe local date helpers — evitam bug de timezone do toISOString()
const toMonthStr = (d: Date) => `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
const toDateStr = (d: Date) => `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;

type Tab = 'cashflow' | 'categories' | 'trend' | 'projection' | 'invoices' | 'ai';

export function Reports() {
  const { user, isAuthReady } = useAuth();
  const { open: openTxDialog } = useTransactionDialog();
  const navigate = useNavigate();

  const [transactions, setTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [creditCards, setCreditCards] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);

  const [activeTab, setActiveTab] = useState<Tab>('cashflow');

  // Aba 1 — Fluxo de Caixa
  const [cashflowPeriod, setCashflowPeriod] = useState<'3months' | '6months' | '12months' | 'year'>('6months');
  const [showPending, setShowPending] = useState(false);

  // Aba 2 — Categorias
  const [catPeriod, setCatPeriod] = useState<'month' | '3months' | '6months' | '12months' | 'year'>('month');
  const [catType, setCatType] = useState<'expense' | 'income'>('expense');

  // Aba 4 — Projeção Futura
  const [projPeriod, setProjPeriod] = useState<'1month' | '3months' | '6months' | '12months' | 'custom'>('3months');
  const [projCustomEnd, setProjCustomEnd] = useState('');
  const [includeSavings, setIncludeSavings] = useState(false);
  const [projType, setProjType] = useState<'all' | 'income' | 'expense'>('all');
  const [projCategory, setProjCategory] = useState<string>('all');
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  // Aba 5 — IA
  const [aiInsight, setAiInsight] = useState('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  // Aba 6 — Faturas de Cartão
  const [invPeriod, setInvPeriod] = useState<'3months' | '6months' | '12months' | 'custom'>('6months');
  const [invCustomEnd, setInvCustomEnd] = useState('');
  const [invSelectedCard, setInvSelectedCard] = useState<string>('all');
  const [invStatusFilter, setInvStatusFilter] = useState<'all' | 'open' | 'closed' | 'paid' | 'future'>('all');
  const [invIncludeCredits, setInvIncludeCredits] = useState(false);

  useEffect(() => {
    if (!isAuthReady || !user) return;
    const uid = user.uid;
    const q = (col: string) => query(collection(db, col), where('userId', '==', uid));
    const u1 = onSnapshot(q('transactions'), s => setTransactions(s.docs.map(d => ({ id: d.id, ...d.data() }))), e => handleFirestoreError(e, OperationType.GET, 'transactions'));
    const u2 = onSnapshot(q('categories'), s => setCategories(s.docs.map(d => ({ id: d.id, ...d.data() }))), e => handleFirestoreError(e, OperationType.GET, 'categories'));
    const u3 = onSnapshot(q('accounts'), s => setAccounts(s.docs.map(d => ({ id: d.id, ...d.data() }))), e => handleFirestoreError(e, OperationType.GET, 'accounts'));
    const u4 = onSnapshot(q('creditCards'), s => setCreditCards(s.docs.map(d => ({ id: d.id, ...d.data() }))), e => handleFirestoreError(e, OperationType.GET, 'creditCards'));
    const u5 = onSnapshot(q('budgets'), s => setBudgets(s.docs.map(d => ({ id: d.id, ...d.data() }))), e => handleFirestoreError(e, OperationType.GET, 'budgets'));
    const u6 = onSnapshot(q('invoices'), s => setInvoices(s.docs.map(d => ({ id: d.id, ...d.data() }))), e => handleFirestoreError(e, OperationType.GET, 'invoices'));
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); };
  }, [user, isAuthReady]);

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const now = new Date();
  const todayStr = toDateStr(now);
  const currentMonthStr = toMonthStr(now);
  const totalBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);

  // ─── ABA 1: FLUXO DE CAIXA ───────────────────────────────────────────────
  const cashFlowMonths = useMemo(() => {
    const count = cashflowPeriod === 'year' || cashflowPeriod === '12months' ? 12 : cashflowPeriod === '6months' ? 6 : 3;
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - count + i + 1, 1);
      return { month: toMonthStr(d), label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') };
    });
  }, [cashflowPeriod]);

  const cashFlowData = useMemo(() => {
    return cashFlowMonths.map(m => {
      const mTx = transactions.filter(t =>
        t.date.startsWith(m.month) && !isCreditCardTx(t) && !isTransfer(t) &&
        (isEffectivelyPaid(t) || (showPending && isPending(t)))
      );
      const receitas = mTx.filter(t => isIncome(t)).reduce((s, t) => s + t.amount, 0);
      const despesas = mTx.filter(t => isExpense(t)).reduce((s, t) => s + t.amount, 0);
      return { name: m.label.charAt(0).toUpperCase() + m.label.slice(1), month: m.month, Receitas: receitas, Despesas: despesas, Saldo: receitas - despesas };
    });
  }, [transactions, cashFlowMonths, showPending]);

  const cashTotals = useMemo(() => {
    const totalR = cashFlowData.reduce((s, m) => s + m.Receitas, 0);
    const totalD = cashFlowData.reduce((s, m) => s + m.Despesas, 0);
    const last = cashFlowData[cashFlowData.length - 1] || { Receitas: 0, Despesas: 0 };
    const savings = last.Receitas - last.Despesas;
    const rate = last.Receitas > 0 ? (savings / last.Receitas * 100) : 0;
    return { totalR, totalD, savings, rate };
  }, [cashFlowData]);

  // ─── ABA 2: CATEGORIAS ───────────────────────────────────────────────────
  const catDateRange = useMemo(() => {
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    let start: Date;
    switch (catPeriod) {
      case 'month': start = new Date(now.getFullYear(), now.getMonth(), 1); break;
      case '3months': start = new Date(now.getFullYear(), now.getMonth() - 2, 1); break;
      case '6months': start = new Date(now.getFullYear(), now.getMonth() - 5, 1); break;
      case '12months': start = new Date(now.getFullYear(), now.getMonth() - 11, 1); break;
      default: start = new Date(now.getFullYear(), 0, 1);
    }
    return { startStr: toDateStr(start), endStr: toDateStr(end) };
  }, [catPeriod]);

  const categoryData = useMemo(() => {
    const { startStr, endStr } = catDateRange;
    const typeFilter = catType === 'expense' ? isExpense : isIncome;
    const periodTx = transactions.filter(t => !isTransfer(t) && typeFilter(t) && isEffectivelyPaid(t) && t.date >= startStr && t.date <= endStr);
    const total = periodTx.reduce((s, t) => s + t.amount, 0);
    const incomeBase = transactions.filter(t => !isCreditCardTx(t) && isIncome(t) && isEffectivelyPaid(t) && !isTransfer(t) && t.date >= startStr && t.date <= endStr).reduce((s, t) => s + t.amount, 0);
    return categories
      .filter(c => catType === 'expense' ? (c.type === 'despesa' || c.type === 'expense') : (c.type === 'receita' || c.type === 'income'))
      .map(c => {
        const val = periodTx.filter(t => t.categoryId === c.id).reduce((s, t) => s + t.amount, 0);
        return { name: c.name, value: val, pct: total > 0 ? (val / total * 100) : 0, pctIncome: incomeBase > 0 ? (val / incomeBase * 100) : 0 };
      })
      .filter(c => c.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [transactions, categories, catDateRange, catType]);

  // ─── ABA 3: TENDÊNCIA & ORÇAMENTOS ───────────────────────────────────────
  const trendData = useMemo(() => {
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    let cumulative = 0;
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dateStr = `${currentMonthStr}-${day.toString().padStart(2, '0')}`;
      cumulative += transactions.filter(t => isExpense(t) && isEffectivelyPaid(t) && !isCreditCardTx(t) && !isTransfer(t) && t.date.startsWith(dateStr)).reduce((s, t) => s + t.amount, 0);
      return { day, amount: cumulative };
    }).filter(d => d.day <= now.getDate());
  }, [transactions, currentMonthStr]);

  const budgetComparison = useMemo(() => {
    return budgets
      .filter(b => b.period === 'monthly' || !b.period)
      .map(b => {
        const spent = transactions.filter(t => isExpense(t) && isEffectivelyPaid(t) && t.categoryId === b.categoryId && t.date.startsWith(currentMonthStr)).reduce((s, t) => s + t.amount, 0);
        const cat = categories.find(c => c.id === b.categoryId);
        return { name: cat?.name || 'Geral', budget: b.amount, spent, diff: b.amount - spent, pct: b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0 };
      })
      .filter(b => b.budget > 0 || b.spent > 0)
      .sort((a, b) => b.spent - a.spent);
  }, [transactions, budgets, categories, currentMonthStr]);

  // ─── ABA 4: PROJEÇÃO FUTURA ───────────────────────────────────────────────
  const projEndDate = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    switch (projPeriod) {
      case '1month': d.setMonth(d.getMonth() + 1); break;
      case '3months': d.setMonth(d.getMonth() + 3); break;
      case '6months': d.setMonth(d.getMonth() + 6); break;
      case '12months': d.setMonth(d.getMonth() + 12); break;
      case 'custom':
        if (projCustomEnd) return new Date(projCustomEnd + 'T23:59:59');
        d.setMonth(d.getMonth() + 3);
    }
    return d;
  }, [projPeriod, projCustomEnd]);

  const projEndMonthStr = toMonthStr(projEndDate);

  const cashCoverageProjection = useMemo(() => buildCashCoverageProjection({
    accounts,
    transactions,
    creditCards,
    invoices,
    options: {
      startDate: now,
      endDate: projEndDate,
      includeSavings,
    },
  }), [accounts, transactions, creditCards, invoices, includeSavings, projEndDate]);

  const projectionData = useMemo(() => cashCoverageProjection.monthlyProjection.map(m => ({
    ...m,
    incomeTxList: m.incomeEvents.map(event => event.raw).filter(Boolean),
    expenseTxList: m.expenseEvents.map(event => event.raw).filter(Boolean),
    invoiceList: m.invoiceEvents.map(event => ({
      id: event.invoiceId || event.id,
      cardId: event.cardId,
      period: event.invoicePeriod,
      status: event.source === 'invoice_closed' ? 'fechada' : 'aberta',
      totalAmount: event.amount,
      source: event.source,
      certainty: event.certainty,
      originalDate: event.originalDate,
    })),
  })), [cashCoverageProjection]);
  const projKPIs = useMemo(() => ({
    totalIncome: cashCoverageProjection.totalIncome,
    totalPay: cashCoverageProjection.totalObligations,
    totalInvoice: cashCoverageProjection.totalInvoices,
    finalAccum: cashCoverageProjection.endingBalance,
    minimumBalance: cashCoverageProjection.minimumBalance,
    minimumBalanceDate: cashCoverageProjection.minimumBalanceDate,
    firstRiskDate: cashCoverageProjection.firstRiskDate,
    isAtRisk: cashCoverageProjection.isAtRisk,
    coverageBalance: cashCoverageProjection.coverageBalance,
    bankExpenses: cashCoverageProjection.totalBankExpenses,
    closedInvoices: cashCoverageProjection.totalClosedInvoices,
    openInvoices: cashCoverageProjection.totalOpenInvoices,
    futureCard: cashCoverageProjection.totalFutureCard,
  }), [cashCoverageProjection]);

  const projChartData = useMemo(() =>
    projectionData.map(m => ({
      name: m.shortLabel.charAt(0).toUpperCase() + m.shortLabel.slice(1),
      'A Receber': m.incomeTotal,
      'A Pagar': m.expenseTotal + m.invoiceTotal,
      Acumulado: m.accum,
    })), [projectionData]);

  const filteredProjData = useMemo(() => {
    return projectionData.map(m => {
      let { incomeTxList, expenseTxList, invoiceList } = m;
      if (projCategory !== 'all') {
        incomeTxList = incomeTxList.filter(t => t.categoryId === projCategory);
        expenseTxList = expenseTxList.filter(t => t.categoryId === projCategory);
        invoiceList = [];
      }
      if (projType === 'income') { expenseTxList = []; invoiceList = []; }
      else if (projType === 'expense') { incomeTxList = []; }
      return { ...m, incomeTxList, expenseTxList, invoiceList };
    }).filter(m => m.incomeTxList.length > 0 || m.expenseTxList.length > 0 || m.invoiceList.length > 0 || projType === 'all');
  }, [projectionData, projType, projCategory]);

  const orphanInvoices = useMemo(() => {
    return invoices
      .filter(inv => inv.status !== 'paga' && inv.totalAmount > 0)
      .filter(inv => {
        const hasTx = transactions.some(t =>
          (t.creditCardId === inv.cardId || t.accountId === inv.cardId || t.destinationAccountId === inv.cardId) &&
          t.invoicePeriod === inv.period
        );
        return !hasTx;
      })
      .map(inv => ({
        ...inv,
        cardName: creditCards.find(c => c.id === inv.cardId)?.name || 'Desconhecido',
      }));
  }, [invoices, transactions, creditCards]);

  const allNonPaidInvoices = useMemo(() => {
    return invoices
      .filter(inv => inv.status !== 'paga' && (inv.totalAmount || 0) > 0)
      .map(inv => ({
        ...inv,
        cardName: creditCards.find(c => c.id === inv.cardId)?.name || 'Desconhecido',
        hasTransactions: transactions.some(t =>
          (t.creditCardId === inv.cardId || t.accountId === inv.cardId || t.destinationAccountId === inv.cardId) &&
          t.invoicePeriod === inv.period
        ),
      }));
  }, [invoices, transactions, creditCards]);

  const fixOrphanInvoice = async (invId: string) => {
    try {
      await updateDoc(doc(db, 'invoices', invId), { totalAmount: 0 });
      toast.success('Fatura zerada com sucesso');
    } catch {
      toast.error('Erro ao zerar fatura');
    }
  };

  const toggleMonth = (month: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month); else next.add(month);
      return next;
    });
  };

  // ─── ABA 6: FATURAS DE CARTÃO ──────────────────────────────────────────────
  const invDateRange = useMemo(() => {
    let start: Date;
    let end: Date;
    if (invPeriod === 'custom' && invCustomEnd) {
      end = new Date(invCustomEnd + 'T23:59:59');
      start = new Date(end.getFullYear(), end.getMonth() - 12, 1);
    } else {
      const months = invPeriod === '3months' ? 3 : invPeriod === '6months' ? 6 : 12;
      start = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
      end = new Date(now.getFullYear(), now.getMonth() + 4, 0);
    }
    return { start, end };
  }, [invPeriod, invCustomEnd]);

  const invoiceAnalysis = useMemo(() => buildInvoiceAnalysis({
    creditCards,
    transactions,
    invoices,
    startDate: invDateRange.start,
    endDate: invDateRange.end,
    selectedCardId: invSelectedCard,
    statusFilter: invStatusFilter,
    includeCredits: invIncludeCredits,
  }), [creditCards, transactions, invoices, invDateRange, invSelectedCard, invStatusFilter, invIncludeCredits]);

  const invChartBars = useMemo(() => {
    const cardSet = new Set<string>();
    invoiceAnalysis.monthlyData.forEach(m => {
      Object.keys(m.cards).forEach(id => cardSet.add(id));
    });
    return Array.from(cardSet).map(id => {
      const card = creditCards.find(c => c.id === id);
      return { id, name: card?.name || id };
    });
  }, [invoiceAnalysis.monthlyData, creditCards]);

  const invChartData = useMemo(() =>
    invoiceAnalysis.monthlyData
      .filter(m => m.total > 0)
      .map(m => {
        const data: any = { name: m.label.split(' de ')[0], month: m.month };
        Object.entries(m.cards).forEach(([cardId, cardData]) => {
          data[cardData.name] = cardData.amount;
        });
        return data;
      }), [invoiceAnalysis.monthlyData]);

  const invTrendData = useMemo(() =>
    invoiceAnalysis.trend.map(t => ({
      ...t,
      name: t.label.split(' de ')[0],
    })), [invoiceAnalysis.trend]);

  // ─── ABA 6: IA ────────────────────────────────────────────────────────────
  const [financialContext, setFinancialContext] = useState<any>(null);

  const generateAI = async () => {
    if (isLoadingAi || transactions.length < 5) return;
    setIsLoadingAi(true);
    try {
      const context = buildFinancialInsightContext({
        accounts,
        transactions,
        categories,
        creditCards,
        invoices,
        budgets,
      });
      if (!context) {
        toast.error('Dados insuficientes para gerar análise.');
        setIsLoadingAi(false);
        return;
      }
      setFinancialContext(context);
      const prompt = buildGroqFinancialAnalysisPrompt(context);
      const res = await callGroq([{ role: 'user', content: prompt }], { maxTokens: 1200, temperature: 0.5 });
      setAiInsight(res || 'Não foi possível gerar a análise.');
    } catch {
      toast.error('Erro ao gerar análise. Tente novamente.');
    } finally {
      setIsLoadingAi(false);
    }
  };

  // ─── COMPONENTES LOCAIS ────────────────────────────────────────────────────
  const FBtn = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button onClick={onClick}
      className={`px-3 py-1.5 text-[11px] font-bold rounded-xl transition-all ${active ? 'bg-background shadow-sm text-foreground border border-border' : 'text-muted-foreground hover:text-foreground'}`}>
      {children}
    </button>
  );

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'cashflow', label: 'Fluxo de Caixa', icon: BarChart2 },
    { id: 'categories', label: 'Categorias', icon: Target },
    { id: 'trend', label: 'Tendência', icon: TrendingDown },
    { id: 'projection', label: 'Projeção Futura', icon: TrendingUp },
    { id: 'invoices', label: 'Faturas', icon: CreditCard },
    { id: 'ai', label: 'Análise IA', icon: Brain },
  ];

  return (
    <div className="space-y-6 pb-20">
      {/* ── HEADER ── */}
      <div className="flex items-center gap-3">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Relatórios</h2>
        <PageHelp
          title="Relatórios"
          description="Analise suas finanças sob diferentes perspectivas. Abaixo está a metodologia utilizada em cada relatório:"
          items={[
            { label: '1. Fluxo de Caixa', desc: 'Mapeia receitas vs despesas realizadas (sem cartão e sem transferências entre contas) nos últimos meses. Apresenta a Taxa de Poupança (% que sobra do seu ganho líquido).' },
            { label: '2. Categorias', desc: 'Distribuição percentual dos gastos ou receitas. Traz a métrica % Renda, que mostra o impacto real de cada grupo de despesa frente ao seu faturamento total.' },
            { label: '3. Tendência & Orçamento', desc: 'Curva cumulativa diária de saídas no mês e comparação direta com os limites de gastos configurados em sua conta.' },
            { label: '4. Projeção Futura', desc: 'Simulação matemática de saldo futuro: Saldo Base Atual + Receitas Pendentes - Despesas Pendentes - Faturas de Cartão projetadas no mês de vencimento. Permite incluir ou excluir investimentos do cálculo.' },
            { label: '5. Faturas de Cartão', desc: 'Análise do comportamento das faturas ao longo do tempo: evolução mensal, peso por cartão, status (aberta/fechada/paga/futura) e comprometimento futuro já assumido com parcelamentos.' },
            { label: '6. Análise IA', desc: 'O assistente Fiducia processa seus últimos 3 meses de fluxo de caixa e os lançamentos recentes para dar uma nota de score financeiro e recomendações personalizadas.' },
          ]}
        />
      </div>

      {/* ── TAB BAR ── */}
      <div className="flex gap-1 bg-secondary/30 p-1 rounded-2xl border border-border overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold whitespace-nowrap transition-all ${isActive ? 'bg-background shadow-sm text-foreground border border-border/50' : 'text-muted-foreground hover:text-foreground'}`}>
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.id === 'projection' && <span className="text-[9px] font-bold bg-fiducia-blue text-white px-1.5 py-0.5 rounded-full leading-none">Novo</span>}
              {tab.id === 'invoices' && <span className="text-[9px] font-bold bg-fiducia-amber text-white px-1.5 py-0.5 rounded-full leading-none">Novo</span>}
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          ABA 1 — FLUXO DE CAIXA
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'cashflow' && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex p-1 bg-secondary/30 rounded-xl border border-border gap-0.5">
              {(['3months', '6months', '12months', 'year'] as const).map(p => (
                <FBtn key={p} active={cashflowPeriod === p} onClick={() => setCashflowPeriod(p)}>
                  {p === '3months' ? '3 Meses' : p === '6months' ? '6 Meses' : p === '12months' ? '12 Meses' : 'Ano'}
                </FBtn>
              ))}
            </div>
            <button onClick={() => setShowPending(!showPending)}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all ${showPending ? 'bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-400' : 'bg-transparent border-border text-muted-foreground hover:border-muted-foreground/50'}`}>
              {showPending ? 'Incluindo Pendentes' : 'Só Realizados'}
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Receitas no Período', value: cashTotals.totalR, color: 'text-fiducia-green', bg: 'bg-fiducia-green/5', Icon: ArrowUpRight },
              { label: 'Despesas no Período', value: cashTotals.totalD, color: 'text-fiducia-red', bg: 'bg-fiducia-red/5', Icon: ArrowDownRight },
              { label: 'Economia do Mês', value: cashTotals.savings, color: cashTotals.savings >= 0 ? 'text-fiducia-blue' : 'text-fiducia-red', bg: 'bg-fiducia-blue/5', Icon: TrendingUp },
              { label: 'Taxa de Poupança', value: null, custom: `${cashTotals.rate.toFixed(1)}%`, color: 'text-fiducia-amber', bg: 'bg-fiducia-amber/5', Icon: Target },
            ].map((k, i) => (
              <div key={i} className={`${k.bg} border border-border rounded-2xl p-5`}>
                <div className="flex items-center gap-2 mb-3">
                  <k.Icon className={`w-4 h-4 ${k.color}`} />
                  <span className={`text-[10px] font-bold ${k.color} uppercase tracking-wider`}>{k.label}</span>
                </div>
                <div className={`text-2xl font-bold font-mono ${k.color}`}>{k.custom ?? fmt(k.value!)}</div>
              </div>
            ))}
          </div>

          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-fiducia-blue" />
                  <h3 className="text-[15px] font-bold text-foreground">Receitas vs Despesas</h3>
                </div>
                <p className="text-[12px] text-muted-foreground mt-0.5">Evolução mensal — somente conta corrente, sem cartão</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><div className="w-2.5 h-2.5 rounded-full bg-fiducia-green" />Receitas</div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><div className="w-2.5 h-2.5 rounded-full bg-fiducia-red" />Despesas</div>
              </div>
            </div>
            <div className="p-5">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={cashFlowData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 500 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={v => `R$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="Receitas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 p-5 border-b border-border">
              <Calendar className="w-4 h-4 text-fiducia-blue" />
              <h3 className="text-[15px] font-bold text-foreground">Resumo por Mês</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border">
                    <th className="text-left py-3 px-4">Mês</th>
                    <th className="text-right py-3 px-4">Receitas</th>
                    <th className="text-right py-3 px-4">Despesas</th>
                    <th className="text-right py-3 px-4">Saldo do Mês</th>
                  </tr>
                </thead>
                <tbody>
                  {cashFlowData.map(m => (
                    <tr key={m.month} className="hover:bg-muted/30 border-b border-border/30 transition-colors">
                      <td className="py-2.5 px-4 font-semibold capitalize">{m.name}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-fiducia-green">{m.Receitas > 0 ? `+${fmt(m.Receitas)}` : '—'}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-fiducia-red">{m.Despesas > 0 ? `-${fmt(m.Despesas)}` : '—'}</td>
                      <td className={`py-2.5 px-4 text-right font-mono font-bold ${m.Saldo >= 0 ? 'text-fiducia-green' : 'text-fiducia-red'}`}>
                        {m.Saldo >= 0 ? `+${fmt(m.Saldo)}` : fmt(m.Saldo)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          ABA 2 — CATEGORIAS
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'categories' && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex p-1 bg-secondary/30 rounded-xl border border-border gap-0.5">
              {(['month', '3months', '6months', '12months', 'year'] as const).map(p => (
                <FBtn key={p} active={catPeriod === p} onClick={() => setCatPeriod(p)}>
                  {p === 'month' ? 'Mês' : p === '3months' ? '3M' : p === '6months' ? '6M' : p === '12months' ? '12M' : 'Ano'}
                </FBtn>
              ))}
            </div>
            <div className="flex p-1 bg-secondary/30 rounded-xl border border-border gap-0.5">
              <FBtn active={catType === 'expense'} onClick={() => setCatType('expense')}>Despesas</FBtn>
              <FBtn active={catType === 'income'} onClick={() => setCatType('income')}>Receitas</FBtn>
            </div>
          </div>

          <div className="grid md:grid-cols-[1fr_300px] gap-6 items-start">
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 p-5 border-b border-border">
                <Target className="w-4 h-4 text-fiducia-amber" />
                <h3 className="text-[15px] font-bold text-foreground">{catType === 'expense' ? 'Despesas por Categoria' : 'Receitas por Categoria'}</h3>
              </div>
              <div className="p-4">
                {categoryData.length > 0 ? (
                  <div className="space-y-1">
                    <div className="grid grid-cols-12 text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 pb-2 border-b border-border">
                      <span className="col-span-5">Categoria</span>
                      <span className="col-span-3 text-right">Valor</span>
                      <span className="col-span-2 text-right">% Total</span>
                      <span className="col-span-2 text-right">% Renda</span>
                    </div>
                    {categoryData.map((item, i) => (
                      <div key={item.name} className="grid grid-cols-12 text-xs px-2 py-2.5 rounded-lg hover:bg-muted/30 items-center transition-colors">
                        <span className="col-span-5 truncate font-medium flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          {item.name}
                        </span>
                        <span className="col-span-3 text-right font-mono">{fmt(item.value)}</span>
                        <span className="col-span-2 text-right">
                          <span className="text-muted-foreground">{item.pct.toFixed(1)}%</span>
                          <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${Math.min(item.pct, 100)}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                          </div>
                        </span>
                        <span className="col-span-2 text-right font-mono text-muted-foreground text-[10px]">{item.value > 0 ? `${item.pctIncome.toFixed(1)}%` : '—'}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center py-8 text-[13px] text-muted-foreground italic">Nenhum dado no período selecionado.</p>
                )}
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 p-4 border-b border-border">
                <Target className="w-4 h-4 text-fiducia-blue" />
                <h3 className="text-[14px] font-bold text-foreground">Distribuição</h3>
              </div>
              <div className="p-4">
                {categoryData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45}>
                          {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => fmt(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1.5 mt-3">
                      {categoryData.slice(0, 6).map((item, i) => (
                        <div key={item.name} className="flex items-center justify-between text-[11px]">
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            <span className="truncate text-muted-foreground">{item.name}</span>
                          </span>
                          <span className="font-mono font-bold ml-2 shrink-0">{item.pct.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-center py-8 text-[12px] text-muted-foreground italic">Sem dados.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          ABA 3 — TENDÊNCIA & ORÇAMENTOS
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'trend' && (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-border">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-fiducia-blue" />
                <h3 className="text-[15px] font-bold text-foreground">Evolução de Gastos — Mês Atual</h3>
              </div>
              <p className="text-[12px] text-muted-foreground mt-0.5">Curva cumulativa diária das despesas realizadas em conta corrente</p>
            </div>
            <div className="p-5">
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={v => `Dia ${v}`} interval={4} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={v => `R$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
                    <Tooltip formatter={(v: number) => fmt(v)} labelFormatter={v => `Dia ${v}`} />
                    <Area type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorAmt)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center py-10 text-[13px] text-muted-foreground italic">Nenhuma despesa realizada este mês.</p>
              )}
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-border">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-fiducia-amber" />
                <h3 className="text-[15px] font-bold text-foreground">Orçado × Realizado</h3>
              </div>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })} — somente despesas efetivadas
              </p>
            </div>
            <div className="p-5">
              {budgetComparison.length > 0 ? (
                <div className="space-y-4">
                  {budgetComparison.map(b => (
                    <div key={b.name} className="space-y-1.5">
                      <div className="flex justify-between items-end">
                        <div>
                          <span className="text-[13px] font-bold text-foreground">{b.name}</span>
                          <span className="ml-2 text-[11px] text-muted-foreground">{b.pct}% utilizado</span>
                        </div>
                        <div className="text-right text-[12px]">
                          <span className={`font-mono font-bold ${b.diff < 0 ? 'text-fiducia-red' : 'text-fiducia-green'}`}>{fmt(b.spent)}</span>
                          <span className="text-muted-foreground font-normal"> / {fmt(b.budget)}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${b.diff < 0 ? 'bg-fiducia-red' : b.pct > 80 ? 'bg-fiducia-amber' : 'bg-fiducia-green'}`}
                          style={{ width: `${Math.min(b.pct, 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-8 text-[13px] text-muted-foreground italic">
                  Configure orçamentos em <strong>Orçamentos</strong> para ver a comparação.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          ABA 4 — PROJEÇÃO FUTURA
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'projection' && (
        <div className="space-y-6">
          <div className="bg-muted/30 border border-border rounded-2xl p-4">
            <div className="text-[13px] font-bold text-foreground mb-2">Diagnóstico de Faturas</div>
            <div className="text-[12px] text-muted-foreground space-y-1">
              <div>Total de invoices no Firestore: <span className="font-mono font-bold">{invoices.length}</span></div>
              <div>Não pagas com saldo &gt; 0: <span className="font-mono font-bold">{allNonPaidInvoices.length}</span></div>
              <div>Órfãs (sem transações): <span className="font-mono font-bold">{orphanInvoices.length}</span></div>
              <div>Total de transações carregadas: <span className="font-mono font-bold">{transactions.length}</span></div>
              <div>Total de cartões carregados: <span className="font-mono font-bold">{creditCards.length}</span></div>
            </div>
            {allNonPaidInvoices.length > 0 && (
              <div className="mt-3 space-y-2">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Lista:</div>
                {allNonPaidInvoices.map(inv => (
                  <div key={inv.id} className={`flex items-center justify-between rounded-xl px-3 py-2 ${inv.hasTransactions ? 'bg-blue-100/50 dark:bg-blue-900/30' : 'bg-amber-100/50 dark:bg-amber-900/30'}`}>
                    <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] font-semibold text-foreground">{inv.cardName}</span>
                      <span className="text-[11px] text-muted-foreground">{inv.period}</span>
                      <span className="text-[11px] font-mono text-foreground">R$ {(inv.totalAmount || 0).toFixed(2)} [{inv.status}]</span>
                      {!inv.hasTransactions && (
                        <span className="text-[10px] font-bold bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 px-1.5 py-0.5 rounded-full">Órfã</span>
                      )}
                    </div>
                    <button onClick={() => fixOrphanInvoice(inv.id)}
                      className={`text-[11px] font-bold px-3 py-1 rounded-lg transition-colors shrink-0 ml-2 ${inv.hasTransactions ? 'text-muted-foreground hover:bg-secondary' : 'text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800/40'}`}>
                      Zerar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Filtros */}
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex p-1 bg-secondary/30 rounded-xl border border-border gap-0.5">
                {(['1month', '3months', '6months', '12months'] as const).map(p => (
                  <FBtn key={p} active={projPeriod === p} onClick={() => setProjPeriod(p)}>
                    {p === '1month' ? 'Próx. mês' : p === '3months' ? '3 meses' : p === '6months' ? '6 meses' : '12 meses'}
                  </FBtn>
                ))}
                <FBtn active={projPeriod === 'custom'} onClick={() => setProjPeriod('custom')}>Personalizado</FBtn>
              </div>
              {projPeriod === 'custom' && (
                <input type="date" value={projCustomEnd} onChange={e => setProjCustomEnd(e.target.value)}
                  className="h-8 bg-background border border-border rounded-xl px-3 text-xs" />
              )}
              <div className="flex p-1 bg-secondary/30 rounded-xl border border-border gap-0.5">
                {([['all', 'Todos'], ['income', 'Receitas'], ['expense', 'Despesas']] as const).map(([v, l]) => (
                  <FBtn key={v} active={projType === v} onClick={() => setProjType(v)}>{l}</FBtn>
                ))}
              </div>
              <select value={projCategory} onChange={e => setProjCategory(e.target.value)}
                className="h-8 bg-background border border-border rounded-xl px-3 text-xs text-foreground">
                <option value="all">Todas as categorias</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div className="ml-auto flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-muted-foreground font-medium whitespace-nowrap">Incluir investimentos:</span>
                <button onClick={() => setIncludeSavings(!includeSavings)}
                  className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${includeSavings ? 'bg-fiducia-blue' : 'bg-secondary border border-border'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${includeSavings ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>
          </div>
          <div className={`border rounded-2xl p-5 shadow-sm ${projKPIs.isAtRisk ? 'bg-fiducia-red/5 border-fiducia-red/20' : 'bg-fiducia-green/5 border-fiducia-green/20'}`}>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <div className={`text-[11px] font-bold uppercase tracking-wider ${projKPIs.isAtRisk ? 'text-fiducia-red' : 'text-fiducia-green'}`}>
                  {projKPIs.isAtRisk ? 'Risco de caixa detectado' : 'Cobertura positiva no periodo'}
                </div>
                <div className="text-[15px] font-semibold text-foreground mt-1">
                  {projKPIs.isAtRisk
                    ? `O saldo fica negativo em ${projKPIs.firstRiskDate?.split('-').reverse().join('/')}.`
                    : `Caixa e recebiveis cobrem as obrigacoes ate ${toDateStr(projEndDate).split('-').reverse().join('/')}.`}
                </div>
                <div className="text-[12px] text-muted-foreground mt-1">
                  Caixa inicial + a receber - obrigacoes = {fmt(projKPIs.coverageBalance)}. Menor saldo projetado: {fmt(projKPIs.minimumBalance)} em {projKPIs.minimumBalanceDate.split('-').reverse().join('/')}.
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-right">
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Banco</div>
                  <div className="text-[13px] font-bold font-mono text-fiducia-red">-{fmt(projKPIs.bankExpenses)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Fechadas</div>
                  <div className="text-[13px] font-bold font-mono text-fiducia-red">-{fmt(projKPIs.closedInvoices)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Abertas</div>
                  <div className="text-[13px] font-bold font-mono text-fiducia-amber">-{fmt(projKPIs.openInvoices)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Futuras</div>
                  <div className="text-[13px] font-bold font-mono text-fiducia-blue">-{fmt(projKPIs.futureCard)}</div>
                </div>
              </div>
            </div>
          </div>


          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-fiducia-green/5 border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3"><ArrowUpRight className="w-4 h-4 text-fiducia-green" /><span className="text-[10px] font-bold text-fiducia-green uppercase tracking-wider">Total a Receber</span></div>
              <div className="text-2xl font-bold font-mono text-fiducia-green">+{fmt(projKPIs.totalIncome)}</div>
              <div className="text-[11px] text-muted-foreground mt-1">Receitas pendentes no período</div>
            </div>
            <div className="bg-fiducia-red/5 border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3"><ArrowDownRight className="w-4 h-4 text-fiducia-red" /><span className="text-[10px] font-bold text-fiducia-red uppercase tracking-wider">Total a Pagar</span></div>
              <div className="text-2xl font-bold font-mono text-fiducia-red">-{fmt(projKPIs.totalPay)}</div>
              <div className="text-[11px] text-muted-foreground mt-1">Despesas + faturas no período</div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3"><CreditCard className="w-4 h-4 text-fiducia-amber" /><span className="text-[10px] font-bold text-fiducia-amber uppercase tracking-wider">Faturas Cartão</span></div>
              <div className="text-2xl font-bold font-mono text-fiducia-amber">-{fmt(projKPIs.totalInvoice)}</div>
              <div className="text-[11px] text-muted-foreground mt-1">Faturas abertas e fechadas</div>
            </div>
            <div className={`border border-border rounded-2xl p-5 ${projKPIs.finalAccum >= 0 ? 'bg-fiducia-blue/5' : 'bg-fiducia-red/5'}`}>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className={`w-4 h-4 ${projKPIs.finalAccum >= 0 ? 'text-fiducia-blue' : 'text-fiducia-red'}`} />
                <span className={`text-[10px] font-bold uppercase tracking-wider ${projKPIs.finalAccum >= 0 ? 'text-fiducia-blue' : 'text-fiducia-red'}`}>Saldo Projetado</span>
              </div>
              <div className={`text-2xl font-bold font-mono ${projKPIs.finalAccum >= 0 ? 'text-fiducia-blue' : 'text-fiducia-red'}`}>{fmt(projKPIs.finalAccum)}</div>
              <div className="text-[11px] text-muted-foreground mt-1">Estimado ao final do período</div>
            </div>
          </div>

          {/* Gráfico */}
          {projChartData.length > 1 && (
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-fiducia-blue" />
                    <h3 className="text-[15px] font-bold text-foreground">Projeção Mensal</h3>
                  </div>
                  <p className="text-[12px] text-muted-foreground mt-0.5">Comprometimentos mensais + saldo acumulado projetado</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><div className="w-2.5 h-2.5 rounded-full bg-fiducia-green" />A Receber</div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><div className="w-2.5 h-2.5 rounded-full bg-fiducia-red" />A Pagar</div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><div className="w-2.5 h-2.5 rounded-full bg-fiducia-blue" />Acumulado</div>
                </div>
              </div>
              <div className="p-5">
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={projChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={v => `R$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
                    <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="A Receber" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="A Pagar" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="Acumulado" stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: '#3b82f6', r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Lista expandível por mês */}
          <div className="space-y-3">
            {filteredProjData.length === 0 && (
              <div className="bg-card border border-border rounded-2xl shadow-sm text-center py-12">
                <TrendingUp className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-[13px] text-muted-foreground font-medium">Nenhum lançamento pendente no período.</p>
                <p className="text-[11px] text-muted-foreground mt-1">Verifique se há lançamentos com status "Pendente" cadastrados em Lançamentos.</p>
              </div>
            )}
            {filteredProjData.map(m => {
              const isExpanded = expandedMonths.has(m.month);
              const totalItems = m.incomeTxList.length + m.expenseTxList.length + m.invoiceList.length;
              return (
                <div key={m.month} className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                  <button onClick={() => toggleMonth(m.month)}
                    className="w-full flex items-center justify-between p-5 hover:bg-secondary/30 transition-colors text-left">
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                      <div>
                        <div className="text-[15px] font-bold text-foreground capitalize">{m.label}</div>
                        <div className="text-[11px] text-muted-foreground">{totalItems} item{totalItems !== 1 ? 's' : ''}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-5 text-right flex-wrap justify-end">
                      {m.incomeTotal > 0 && (
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">A Receber</div>
                          <div className="text-[13px] font-bold font-mono text-fiducia-green">+{fmt(m.incomeTotal)}</div>
                        </div>
                      )}
                      {(m.expenseTotal + m.invoiceTotal) > 0 && (
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">A Pagar</div>
                          <div className="text-[13px] font-bold font-mono text-fiducia-red">-{fmt(m.expenseTotal + m.invoiceTotal)}</div>
                        </div>
                      )}
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Saldo Mês</div>
                        <div className={`text-[13px] font-bold font-mono ${m.net >= 0 ? 'text-fiducia-green' : 'text-fiducia-red'}`}>
                          {m.net >= 0 ? '+' : ''}{fmt(m.net)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Acumulado</div>
                        <div className={`text-[13px] font-bold font-mono ${m.accum >= 0 ? 'text-fiducia-blue' : 'text-fiducia-red'}`}>
                          {fmt(m.accum)}
                        </div>
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border">
                      {/* Receitas */}
                      {m.incomeTxList.length > 0 && (
                        <>
                          <div className="px-5 py-2 bg-fiducia-green/5 text-[10px] font-bold text-fiducia-green uppercase tracking-wider border-b border-border/30">
                            ↑ Receitas a Receber ({m.incomeTxList.length})
                          </div>
                          {m.incomeTxList.map((t: any) => {
                            const cat = categories.find(c => c.id === t.categoryId);
                            const acc = accounts.find(a => a.id === t.accountId);
                            return (
                              <div key={t.id} onClick={() => openTxDialog({ editId: t.id })}
                                className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/30 cursor-pointer transition-colors border-t border-border/20">
                                <div className="w-8 h-8 rounded-lg bg-fiducia-green/10 flex items-center justify-center shrink-0">
                                  <ArrowUpRight className="w-4 h-4 text-fiducia-green" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-[13px] font-semibold text-foreground truncate">{t.description || 'Sem descrição'}</div>
                                  <div className="text-[11px] text-muted-foreground">{[cat?.name, acc?.name].filter(Boolean).join(' · ')}</div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="text-[13px] font-bold font-mono text-fiducia-green">+{fmt(t.amount)}</div>
                                  <div className="text-[11px] text-muted-foreground">{t.date.substring(8, 10)}/{t.date.substring(5, 7)}</div>
                                </div>
                              </div>
                            );
                          })}
                        </>
                      )}

                      {/* Despesas */}
                      {m.expenseTxList.length > 0 && (
                        <>
                          <div className="px-5 py-2 bg-fiducia-red/5 text-[10px] font-bold text-fiducia-red uppercase tracking-wider border-b border-border/30">
                            ↓ Despesas a Pagar ({m.expenseTxList.length})
                          </div>
                          {m.expenseTxList.map((t: any) => {
                            const cat = categories.find(c => c.id === t.categoryId);
                            const acc = accounts.find(a => a.id === t.accountId);
                            const isPast = t.date.substring(0, 10) < todayStr;
                            return (
                              <div key={t.id} onClick={() => openTxDialog({ editId: t.id })}
                                className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/30 cursor-pointer transition-colors border-t border-border/20">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isPast ? 'bg-fiducia-red/20' : 'bg-fiducia-red/10'}`}>
                                  <ArrowDownRight className="w-4 h-4 text-fiducia-red" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[13px] font-semibold text-foreground truncate">{t.description || 'Sem descrição'}</span>
                                    {isPast && <span className="text-[9px] font-bold bg-fiducia-red text-white px-1.5 py-0.5 rounded-full shrink-0">Atrasada</span>}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground">{[cat?.name, acc?.name].filter(Boolean).join(' · ')}</div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="text-[13px] font-bold font-mono text-fiducia-red">-{fmt(t.amount)}</div>
                                  <div className="text-[11px] text-muted-foreground">{t.date.substring(8, 10)}/{t.date.substring(5, 7)}</div>
                                </div>
                              </div>
                            );
                          })}
                        </>
                      )}

                      {/* Faturas de cartão */}
                      {m.invoiceList.length > 0 && (
                        <>
                          <div className="px-5 py-2 bg-fiducia-amber/5 text-[10px] font-bold text-fiducia-amber uppercase tracking-wider border-b border-border/30">
                            ◈ Faturas de Cartão ({m.invoiceList.length})
                          </div>
                          {m.invoiceList.map((inv: any) => {
                            const card = creditCards.find(c => c.id === inv.cardId);
                            const [y, mn] = inv.period.split('-').map(Number);
                            const periodLabel = new Date(y, mn - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                            return (
                              <div key={inv.id} onClick={() => navigate('/cards')}
                                className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/30 cursor-pointer transition-colors border-t border-border/20">
                                <div className="w-8 h-8 rounded-lg bg-fiducia-amber/10 flex items-center justify-center shrink-0">
                                  <CreditCard className="w-4 h-4 text-fiducia-amber" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[13px] font-semibold text-foreground">Fatura {card?.name || 'Cartão'}</span>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${inv.status === 'fechada' ? 'bg-fiducia-red/10 text-fiducia-red' : 'bg-fiducia-amber/10 text-fiducia-amber'}`}>
                                      {inv.status === 'fechada' ? 'Fechada' : 'Aberta'}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-muted-foreground capitalize">{periodLabel}</div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="text-[13px] font-bold font-mono text-fiducia-amber">-{fmt(inv.totalAmount || 0)}</div>
                                  <div className="text-[11px] text-fiducia-blue hover:underline">→ Ver cartão</div>
                                </div>
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          ABA 5 — FATURAS DE CARTÃO
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'invoices' && (
        <div className="space-y-6">
          {/* Filtros */}
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex p-1 bg-secondary/30 rounded-xl border border-border gap-0.5">
                {(['3months', '6months', '12months', 'custom'] as const).map(p => (
                  <FBtn key={p} active={invPeriod === p} onClick={() => setInvPeriod(p)}>
                    {p === '3months' ? '3 Meses' : p === '6months' ? '6 Meses' : p === '12months' ? '12 Meses' : 'Personalizado'}
                  </FBtn>
                ))}
              </div>
              {invPeriod === 'custom' && (
                <input type="date" value={invCustomEnd} onChange={e => setInvCustomEnd(e.target.value)}
                  className="h-8 bg-background border border-border rounded-xl px-3 text-xs" />
              )}
              <select value={invSelectedCard} onChange={e => setInvSelectedCard(e.target.value)}
                className="h-8 bg-background border border-border rounded-xl px-3 text-xs text-foreground">
                <option value="all">Todos os cartões</option>
                {creditCards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div className="flex p-1 bg-secondary/30 rounded-xl border border-border gap-0.5">
                {(['all', 'open', 'closed', 'paid', 'future'] as const).map(p => (
                  <FBtn key={p} active={invStatusFilter === p} onClick={() => setInvStatusFilter(p)}>
                    {p === 'all' ? 'Todas' : p === 'open' ? 'Abertas' : p === 'closed' ? 'Fechadas' : p === 'paid' ? 'Pagas' : 'Futuras'}
                  </FBtn>
                ))}
              </div>
              <button onClick={() => setInvIncludeCredits(!invIncludeCredits)}
                className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all ${invIncludeCredits ? 'bg-fiducia-green/10 border-fiducia-green/30 text-fiducia-green dark:text-fiducia-green' : 'bg-transparent border-border text-muted-foreground hover:border-muted-foreground/50'}`}>
                {invIncludeCredits ? 'Incluindo Estornos' : 'S/ Estornos'}
              </button>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-fiducia-amber/5 border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3"><CreditCard className="w-4 h-4 text-fiducia-amber" /><span className="text-[10px] font-bold text-fiducia-amber uppercase tracking-wider">Faturas Abertas</span></div>
              <div className="text-2xl font-bold font-mono text-fiducia-amber">{fmt(invoiceAnalysis.summary.totalOpen)}</div>
              <div className="text-[11px] text-muted-foreground mt-1">Em andamento no período</div>
            </div>
            <div className="bg-fiducia-red/5 border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3"><ArrowDownRight className="w-4 h-4 text-fiducia-red" /><span className="text-[10px] font-bold text-fiducia-red uppercase tracking-wider">Faturas Fechadas</span></div>
              <div className="text-2xl font-bold font-mono text-fiducia-red">{fmt(invoiceAnalysis.summary.totalClosed)}</div>
              <div className="text-[11px] text-muted-foreground mt-1">Aguardando pagamento</div>
            </div>
            <div className="bg-fiducia-green/5 border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3"><ArrowUpRight className="w-4 h-4 text-fiducia-green" /><span className="text-[10px] font-bold text-fiducia-green uppercase tracking-wider">Pagas no Período</span></div>
              <div className="text-2xl font-bold font-mono text-fiducia-green">{fmt(invoiceAnalysis.summary.totalPaid)}</div>
              <div className="text-[11px] text-muted-foreground mt-1">Faturas quitadas</div>
            </div>
            <div className="bg-fiducia-blue/5 border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3"><TrendingUp className="w-4 h-4 text-fiducia-blue" /><span className="text-[10px] font-bold text-fiducia-blue uppercase tracking-wider">Comprometimento Futuro</span></div>
              <div className="text-2xl font-bold font-mono text-fiducia-blue">{fmt(invoiceAnalysis.summary.totalFuture)}</div>
              <div className="text-[11px] text-muted-foreground mt-1">Parcelas a vencer</div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-950/20 border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3"><Target className="w-4 h-4 text-purple-600 dark:text-purple-400" /><span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Média Mensal</span></div>
              <div className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400">{fmt(invoiceAnalysis.summary.monthlyAverage)}</div>
              <div className="text-[11px] text-muted-foreground mt-1">Por mês com dados</div>
            </div>
            <div className="bg-orange-50 dark:bg-orange-950/20 border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3"><BarChart2 className="w-4 h-4 text-orange-600 dark:text-orange-400" /><span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">Maior Fatura</span></div>
              <div className="text-2xl font-bold font-mono text-orange-600 dark:text-orange-400">{fmt(invoiceAnalysis.summary.largestInvoice)}</div>
              <div className="text-[11px] text-muted-foreground mt-1">Recorde no período</div>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid lg:grid-cols-[2fr_300px] gap-6 items-start">
            {/* Barras empilhadas */}
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div>
                  <div className="flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-fiducia-blue" />
                    <h3 className="text-[15px] font-bold text-foreground">Evolução Mensal por Cartão</h3>
                  </div>
                  <p className="text-[12px] text-muted-foreground mt-0.5">Total de faturas por mês — cada cor é um cartão</p>
                </div>
                {invChartBars.length > 0 && (
                  <div className="flex items-center gap-3">
                    {invChartBars.map(card => {
                      const cardData = invoiceAnalysis.cardBreakdown.find(c => c.cardId === card.id);
                      return (
                        <div key={card.id} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cardData?.color || '#888' }} />{card.name}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="p-5">
                {invChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={invChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 500 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={v => `R$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
                      <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                      {invChartBars.map(card => {
                        const cardData = invoiceAnalysis.cardBreakdown.find(c => c.cardId === card.id);
                        return <Bar key={card.id} dataKey={card.name} fill={cardData?.color || '#888'} stackId="cards" radius={[0, 0, 0, 0]} />;
                      })}
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center py-12 text-[13px] text-muted-foreground italic">Nenhum dado de fatura no período selecionado.</p>
                )}
              </div>
            </div>

            {/* Donut + Tendência */}
            <div className="space-y-6">
              {invoiceAnalysis.cardBreakdown.length > 0 && (
                <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2 p-4 border-b border-border">
                    <CreditCard className="w-4 h-4 text-fiducia-blue" />
                    <h3 className="text-[14px] font-bold text-foreground">Participação por Cartão</h3>
                  </div>
                  <div className="p-4">
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={invoiceAnalysis.cardBreakdown} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={55}>
                          {invoiceAnalysis.cardBreakdown.map(c => <Cell key={c.cardId} fill={c.color} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => fmt(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1.5 mt-3">
                      {invoiceAnalysis.cardBreakdown.map(c => (
                        <div key={c.cardId} className="flex items-center justify-between text-[11px]">
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                            <span className="truncate text-muted-foreground">{c.name}</span>
                          </span>
                          <span className="font-mono font-bold ml-2 shrink-0">{c.pct.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {invTrendData.some(t => t.total > 0) && (
                <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2 p-4 border-b border-border">
                    <TrendingUp className="w-4 h-4 text-fiducia-amber" />
                    <h3 className="text-[14px] font-bold text-foreground">Tendência Mensal</h3>
                  </div>
                  <div className="p-4">
                    <ResponsiveContainer width="100%" height={180}>
                      <AreaChart data={invTrendData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} tickFormatter={v => `R$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
                        <Tooltip formatter={(v: number) => fmt(v)} />
                        <Area type="monotone" dataKey="total" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tabela detalhada */}
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 p-5 border-b border-border">
              <CreditCard className="w-4 h-4 text-fiducia-blue" />
              <h3 className="text-[15px] font-bold text-foreground">Detalhamento de Faturas</h3>
              <span className="text-[11px] text-muted-foreground ml-2">({invoiceAnalysis.detailList.length} registros)</span>
            </div>
            <div className="overflow-x-auto">
              {invoiceAnalysis.detailList.length > 0 ? (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border">
                      <th className="text-left py-3 px-4">Cartão</th>
                      <th className="text-left py-3 px-4">Período</th>
                      <th className="text-left py-3 px-4">Status</th>
                      <th className="text-left py-3 px-4">Vencimento</th>
                      <th className="text-right py-3 px-4">Valor</th>
                      <th className="text-right py-3 px-4">% Total</th>
                      <th className="text-right py-3 px-4">Var. Mês Ant.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceAnalysis.detailList.map(item => {
                      const [y, mn] = item.period.split('-').map(Number);
                      const periodLabel = new Date(y, mn - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                      const dueDateLabel = item.dueDate.split('-').reverse().join('/');
                      const statusBadge = item.status === 'paid'
                        ? 'bg-fiducia-green/10 text-fiducia-green'
                        : item.status === 'closed'
                        ? 'bg-fiducia-red/10 text-fiducia-red'
                        : item.status === 'open'
                        ? 'bg-fiducia-amber/10 text-fiducia-amber'
                        : 'bg-fiducia-blue/10 text-fiducia-blue';
                      const statusLabel = item.status === 'open' ? 'Aberta' : item.status === 'closed' ? 'Fechada' : item.status === 'paid' ? 'Paga' : 'Futura';
                      return (
                        <tr key={`${item.cardId}-${item.period}`} onClick={() => navigate('/cards')}
                          className="hover:bg-muted/30 border-b border-border/30 transition-colors cursor-pointer">
                          <td className="py-2.5 px-4 font-semibold">{item.cardName}</td>
                          <td className="py-2.5 px-4 capitalize">{periodLabel}</td>
                          <td className="py-2.5 px-4">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadge}`}>{statusLabel}</span>
                          </td>
                          <td className="py-2.5 px-4 text-muted-foreground">{dueDateLabel}</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold">{fmt(item.amount)}</td>
                          <td className="py-2.5 px-4 text-right text-muted-foreground">{item.pctOfTotal.toFixed(1)}%</td>
                          <td className="py-2.5 px-4 text-right font-mono">
                            {item.variation === 0 && item.previousAmount === 0 ? (
                              <span className="text-muted-foreground">—</span>
                            ) : item.variation > 0 ? (
                              <span className="text-fiducia-red flex items-center justify-end gap-0.5"><ArrowUpRight className="w-3 h-3" />+{item.variation.toFixed(0)}%</span>
                            ) : (
                              <span className="text-fiducia-green flex items-center justify-end gap-0.5"><ArrowDownRight className="w-3 h-3" />{item.variation.toFixed(0)}%</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p className="text-center py-12 text-[13px] text-muted-foreground italic">
                  {creditCards.length === 0 ? 'Cadastre um cartão de crédito para ver a análise.' : 'Nenhuma fatura encontrada com os filtros atuais.'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          ABA 6 — ANÁLISE IA
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'ai' && (
        <div className="space-y-6">
          {/* Bloco principal */}
          <div className="bg-gradient-to-br from-fiducia-blue/10 to-fiducia-blue/5 border border-fiducia-blue/20 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 via-cyan-400 to-blue-500 flex items-center justify-center shadow-lg">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-[16px] font-bold text-foreground">Fiducia AI</div>
                  <div className="text-[12px] text-muted-foreground">Análise inteligente — IA interpreta, sistema calcula</div>
                </div>
              </div>
              <Button onClick={generateAI} disabled={isLoadingAi || transactions.length < 5}
                className="bg-fiducia-blue hover:bg-fiducia-blue/90 text-white gap-2 font-semibold shadow-lg shadow-fiducia-blue/20">
                {isLoadingAi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {aiInsight ? 'Renovar Análise' : 'Gerar Análise Inteligente'}
              </Button>
            </div>
            {aiInsight ? (
              <div className="space-y-4">
                <div className="bg-background/50 rounded-xl p-5 text-[13px] leading-relaxed border border-border/50">
                  <div dangerouslySetInnerHTML={{
                    __html: aiInsight
                      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/\n/g, '<br/>')
                  }} />
                </div>
                <div className="text-[10px] text-muted-foreground/60 italic px-1">
                  Os cálculos financeiros são feitos pelo motor do Fiducia. A IA apenas interpreta os resultados. Verifique os números nos relatórios antes de tomar decisões.
                </div>
              </div>
            ) : (
              <div className="text-center py-10">
                <Sparkles className="w-8 h-8 text-fiducia-blue animate-pulse mx-auto mb-3" />
                <p className="text-[13px] text-muted-foreground font-medium">
                  {transactions.length < 5 ? 'Adicione pelo menos 5 lançamentos para gerar a análise.' : 'Clique em "Gerar Análise Inteligente" para receber um diagnóstico completo baseado nos dados calculados pelo sistema.'}
                </p>
              </div>
            )}
          </div>

          {/* Contexto usado na análise */}
          {financialContext && aiInsight && (
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 p-4 border-b border-border">
                <Sparkles className="w-4 h-4 text-fiducia-amber" />
                <h3 className="text-[14px] font-bold text-foreground">Contexto Enviado à IA</h3>
                <span className="text-[10px] text-muted-foreground ml-2">(dados calculados pelo Fiducia)</span>
              </div>
              <div className="p-4 grid md:grid-cols-2 lg:grid-cols-3 gap-4 text-[12px]">
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Saúde Financeira</div>
                  <div className="space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">Saldo:</span><span className="font-mono font-bold">{fmt(financialContext.health.totalBalance)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Economia mensal:</span><span className={`font-mono font-bold ${financialContext.health.monthlySavings >= 0 ? 'text-fiducia-green' : 'text-fiducia-red'}`}>{financialContext.health.monthlySavings >= 0 ? '+' : ''}{fmt(financialContext.health.monthlySavings)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Poupança:</span><span className="font-mono font-bold">{financialContext.health.savingsRate}%</span></div>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Cobertura 90 dias</div>
                  <div className="space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">Inicial:</span><span className="font-mono font-bold">{fmt(financialContext.cashCoverage.startingBalance)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">A receber:</span><span className="font-mono font-bold text-fiducia-green">+{fmt(financialContext.cashCoverage.totalIncome)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Obrigações:</span><span className="font-mono font-bold text-fiducia-red">-{fmt(financialContext.cashCoverage.totalObligations)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Cobertura:</span><span className={`font-mono font-bold ${financialContext.cashCoverage.coverageBalance >= 0 ? 'text-fiducia-green' : 'text-fiducia-red'}`}>{fmt(financialContext.cashCoverage.coverageBalance)}</span></div>
                  </div>
                </div>
                {financialContext.invoices.cardsCount > 0 && (
                  <div>
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Faturas Cartão</div>
                    <div className="space-y-1">
                      <div className="flex justify-between"><span className="text-muted-foreground">Abertas:</span><span className="font-mono font-bold text-fiducia-amber">{fmt(financialContext.invoices.totalOpen)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Fechadas:</span><span className="font-mono font-bold text-fiducia-red">{fmt(financialContext.invoices.totalClosed)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Futuras:</span><span className="font-mono font-bold text-fiducia-blue">{fmt(financialContext.invoices.totalFuture)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Média:</span><span className="font-mono font-bold">{fmt(financialContext.invoices.monthlyAverage)}</span></div>
                    </div>
                  </div>
                )}
                {financialContext.budgets.totalOverspent > 0 && (
                  <div>
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Orçamentos ⚠️</div>
                    <div className="space-y-1">
                      <span className="text-fiducia-red text-[11px]">{financialContext.budgets.totalOverspent} categorias estouradas</span>
                    </div>
                  </div>
                )}
                {financialContext.criticalDates.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Datas Críticas</div>
                    <div className="space-y-1">
                      {financialContext.criticalDates.slice(0, 3).map((d: any, i: number) => (
                        <div key={i} className="text-[11px]">
                          <span className="text-muted-foreground">{d.date.split('-').reverse().join('/')}:</span>
                          <span className="font-semibold ml-1">{d.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Resumo dos últimos meses */}
          <div className="grid md:grid-cols-3 gap-4">
            {cashFlowData.slice(-3).map(m => (
              <div key={m.month} className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3 capitalize">{m.name}</div>
                <div className="space-y-2 text-[12px]">
                  <div className="flex justify-between"><span className="text-muted-foreground">Receitas</span><span className="font-mono text-fiducia-green font-bold">{fmt(m.Receitas)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Despesas</span><span className="font-mono text-fiducia-red font-bold">{fmt(m.Despesas)}</span></div>
                  <div className="flex justify-between pt-2 border-t border-border/30">
                    <span className="text-muted-foreground font-semibold">Saldo</span>
                    <span className={`font-mono font-bold ${m.Saldo >= 0 ? 'text-fiducia-green' : 'text-fiducia-red'}`}>{m.Saldo >= 0 ? '+' : ''}{fmt(m.Saldo)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
