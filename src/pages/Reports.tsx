import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTransactionDialog } from '../contexts/TransactionDialogContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, ReferenceLine,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Target, Sparkles, Loader2, Brain,
  ArrowUpRight, ArrowDownRight, ChevronDown, ChevronRight,
  CreditCard, BarChart2, Calendar, FileDown, ReceiptText,
} from 'lucide-react';
import { generateCashFlowPDF, generateCategoryPDF, generateTrendPDF, generateProjectionPDF, generateInvoiceAnalysisPDF } from '../lib/pdfTemplates';
import { toast } from 'sonner';
import { isEffectivelyPaid, getBudgetImpact } from '../lib/utils';
import { fmtMonthYear } from '../lib/pdfFormatUtils';
import { buildCashCoverageProjection, calculateCashMargin, CASH_SAFETY_RESERVE_KEY } from '../lib/cashCoverage';
import { buildInvoiceAnalysis } from '../lib/invoiceAnalysis';
import { buildFinancialInsightContext, buildGroqFinancialAnalysisPrompt } from '../lib/financialInsight';
import { PageHelp } from '../components/PageHelp';
import { callGroq } from '../services/groqService';
import { Button } from '../components/ui/button';
import { useReportingPeriod } from '../contexts/ReportingPeriodContext';
import { buildMonthlyStatement } from '../lib/monthlyStatement';
import { MonthlyStatementEntries } from '../components/MonthlyStatementEntries';
import { buildDailyCashFlow } from '../lib/cashFlowView';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { buildConsumptionAnalysis } from '../lib/consumptionAnalysis';
import { buildMonthlyStatementCsv } from '../lib/monthlyStatementCsv';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6'];

const isTransfer = (t: any) => t.type === 'transferencia' || t.type === 'transfer';
const isCreditCardTx = (t: any) => !!t.creditCardId;
const isIncome = (t: any) => t.type === 'receita' || t.type === 'income';
const isExpense = (t: any) => t.type === 'despesa' || t.type === 'expense';

// Safe local date helpers — evitam bug de timezone do toISOString()
const toMonthStr = (d: Date) => `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
const toDateStr = (d: Date) => `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
const shiftMonth = (month: string, offset: number) => {
  const [year, monthNumber] = month.split('-').map(Number);
  return toMonthStr(new Date(year, monthNumber - 1 + offset, 1));
};

type Tab = 'statement' | 'cashflow' | 'categories' | 'trend' | 'projection' | 'invoices' | 'ai';

export function Reports() {
  const { user, isAuthReady } = useAuth();
  const { open: openTxDialog } = useTransactionDialog();
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedMonth, setSelectedMonth } = useReportingPeriod();

  const [transactions, setTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [creditCards, setCreditCards] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [recurrenceRules, setRecurrenceRules] = useState<any[]>([]);

  const [activeTab, setActiveTab] = useState<Tab>('statement');
  const [statementFilter, setStatementFilter] = useState<'all' | 'income' | 'expense'>('all');

  useEffect(() => {
    const state = location.state as { tab?: Tab; month?: string } | null;
    if (state?.tab) setActiveTab(state.tab);
    if (state?.month && /^\d{4}-\d{2}$/.test(state.month)) setSelectedMonth(state.month);
    if (state?.tab || state?.month) window.history.replaceState({}, '');
  }, [location.state, setSelectedMonth]);

  // Aba 1 — Fluxo de Caixa
  const [cashflowPeriod, setCashflowPeriod] = useState<'month' | '3months' | '6months' | '12months'>('month');
  const [showPending, setShowPending] = useState(false);
  const [selectedCashFlowDay, setSelectedCashFlowDay] = useState<string | null>(null);

  // Aba 2 — Categorias
  const [catPeriod, setCatPeriod] = useState<'month' | '3months' | '6months' | '12months'>('month');
  const [catType, setCatType] = useState<'expense' | 'income'>('expense');
  const [selectedConsumptionCategory, setSelectedConsumptionCategory] = useState<string | null>(null);

  // Aba 4 — Projeção Futura
  const [projPeriod, setProjPeriod] = useState<'30d' | '60d' | '90d' | '180d' | '365d' | 'custom'>('90d');
  const [projCustomEnd, setProjCustomEnd] = useState('');
  const [includeSavings, setIncludeSavings] = useState(false);
  const [includeRecurrences, setIncludeRecurrences] = useState(false);
  const [safetyReserve, setSafetyReserve] = useState(() => Math.max(0, Number(localStorage.getItem(CASH_SAFETY_RESERVE_KEY)) || 0));
  const [showDailyView, setShowDailyView] = useState(false);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  // Aba 5 — IA
  const [aiInsight, setAiInsight] = useState('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  // PDF export
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handleExportCashFlowPDF = async () => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      await generateCashFlowPDF({ cashFlowData, cashTotals, cashflowPeriod, showPending });
    } catch (err) {
      console.error('PDF export error:', err);
      toast.error('Erro ao gerar PDF');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportCategoryPDF = async () => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      await generateCategoryPDF({ categoryData, catPeriod, catType });
    } catch (err) {
      console.error('PDF export error:', err);
      toast.error('Erro ao gerar PDF');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportTrendPDF = async () => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      await generateTrendPDF({ trendData, budgetComparison, currentMonthStr: selectedMonth });
    } catch (err) {
      console.error('PDF export error:', err);
      toast.error('Erro ao gerar PDF');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportProjectionPDF = async () => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      await generateProjectionPDF({ filteredProjData, projKPIs, projPeriod, includeSavings, projCategory: 'all', categories, accounts, creditCards, projEndDate, projCustomEnd });
    } catch (err) {
      console.error('PDF export error:', err);
      toast.error('Erro ao gerar PDF');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportInvoiceAnalysisPDF = async () => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      await generateInvoiceAnalysisPDF({ invoiceAnalysis, invPeriod, invSelectedCard, creditCards });
    } catch (err) {
      console.error('PDF export error:', err);
      toast.error('Erro ao gerar PDF');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Aba 6 — Faturas de Cartão
  const [invPeriod, setInvPeriod] = useState<'3months' | '6months' | '12months'>('6months');
  const [invSelectedCard, setInvSelectedCard] = useState<string>('all');

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
    const u7 = onSnapshot(q('recurrenceRules'), s => setRecurrenceRules(s.docs.map(d => ({ id: d.id, ...d.data() }))), e => handleFirestoreError(e, OperationType.GET, 'recurrenceRules'));
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); };
  }, [user, isAuthReady]);

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const now = new Date();
  const todayStr = toDateStr(now);
  const currentMonthStr = toMonthStr(now);
  const totalBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);
  const monthlyStatement = useMemo(
    () => buildMonthlyStatement(transactions, invoices, creditCards.flatMap(card => card.id ? [card.id] : []), selectedMonth),
    [transactions, invoices, creditCards, selectedMonth],
  );
  const statementEntries = statementFilter === 'income'
    ? monthlyStatement.incomeEntries
    : statementFilter === 'expense'
      ? monthlyStatement.expenseEntries
      : [...monthlyStatement.incomeEntries, ...monthlyStatement.expenseEntries].sort((a, b) => b.transaction.date.localeCompare(a.transaction.date));

  const handleExportStatementCsv = () => {
    const csv = buildMonthlyStatementCsv(monthlyStatement, accounts, categories, creditCards);
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `fiducia-extrato-${selectedMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ─── ABA 1: FLUXO DE CAIXA ───────────────────────────────────────────────
  const cashFlowMonths = useMemo(() => {
    const count = cashflowPeriod === 'month' ? 1 : cashflowPeriod === '12months' ? 12 : cashflowPeriod === '6months' ? 6 : 3;
    const [selectedYear, selectedMonthNumber] = selectedMonth.split('-').map(Number);
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(selectedYear, selectedMonthNumber - count + i, 1);
      return { month: toMonthStr(d), label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') };
    });
  }, [cashflowPeriod, selectedMonth]);

  const cashFlowData = useMemo(() => {
    return cashFlowMonths.map(m => {
      const days = buildDailyCashFlow(transactions, invoices, creditCards.flatMap(card => card.id ? [card.id] : []), m.month, showPending);
      const receitas = days.reduce((sum, day) => sum + day.Receitas, 0);
      const despesas = days.reduce((sum, day) => sum + day.Despesas, 0);
      return { name: m.label.charAt(0).toUpperCase() + m.label.slice(1), month: m.month, Receitas: receitas, Despesas: despesas, Saldo: receitas - despesas };
    });
  }, [transactions, invoices, creditCards, cashFlowMonths, showPending]);

  const dailyCashFlow = useMemo(
    () => buildDailyCashFlow(transactions, invoices, creditCards.flatMap(card => card.id ? [card.id] : []), selectedMonth, showPending),
    [transactions, invoices, creditCards, selectedMonth, showPending],
  );
  const selectedDayData = selectedCashFlowDay ? dailyCashFlow.find(day => day.date === selectedCashFlowDay) : undefined;

  const cashTotals = useMemo(() => {
    const totalR = cashFlowData.reduce((s, m) => s + m.Receitas, 0);
    const totalD = cashFlowData.reduce((s, m) => s + m.Despesas, 0);
    const last = cashFlowData[cashFlowData.length - 1] || { Receitas: 0, Despesas: 0 };
    const savings = last.Receitas - last.Despesas;
    const rate = last.Receitas > 0 ? (savings / last.Receitas * 100) : 0;
    return { totalR, totalD, savings, rate };
  }, [cashFlowData]);

  const cashKpis = useMemo(() => {
    const months = Math.max(1, cashFlowData.length);
    const latest = cashFlowData.at(-1) || { name: '—', Receitas: 0, Despesas: 0, Saldo: 0 };
    if (cashflowPeriod === 'month') {
      const heaviestDay = dailyCashFlow.reduce((max, day) => day.Despesas > max.Despesas ? day : max, dailyCashFlow[0] || { name: '—', Despesas: 0 });
      return [
        { label: 'Entradas recebidas', value: cashTotals.totalR, color: 'text-fiducia-green', bg: 'bg-fiducia-green/5', Icon: ArrowUpRight },
        { label: 'Saídas pagas', value: cashTotals.totalD, color: 'text-fiducia-red', bg: 'bg-fiducia-red/5', Icon: ArrowDownRight },
        { label: 'Resultado de caixa', value: latest.Saldo, color: latest.Saldo >= 0 ? 'text-fiducia-blue' : 'text-fiducia-red', bg: 'bg-fiducia-blue/5', Icon: TrendingUp },
        { label: 'Dia com mais saídas', value: heaviestDay.Despesas, detail: heaviestDay.Despesas > 0 ? `Dia ${heaviestDay.name}` : 'Sem saídas', color: 'text-fiducia-amber', bg: 'bg-fiducia-amber/5', Icon: Calendar },
      ];
    }
    const averageIncome = cashTotals.totalR / months;
    const averageExpense = cashTotals.totalD / months;
    const averageResult = (cashTotals.totalR - cashTotals.totalD) / months;
    return [
      { label: 'Média mensal de entradas', value: averageIncome, color: 'text-fiducia-green', bg: 'bg-fiducia-green/5', Icon: ArrowUpRight },
      { label: 'Média mensal de saídas', value: averageExpense, color: 'text-fiducia-red', bg: 'bg-fiducia-red/5', Icon: ArrowDownRight },
      { label: 'Resultado médio mensal', value: averageResult, color: averageResult >= 0 ? 'text-fiducia-blue' : 'text-fiducia-red', bg: 'bg-fiducia-blue/5', Icon: TrendingUp },
      { label: 'Resultado do último mês', value: latest.Saldo, detail: latest.name, color: latest.Saldo >= 0 ? 'text-fiducia-green' : 'text-fiducia-red', bg: 'bg-secondary/40', Icon: Calendar },
    ];
  }, [cashFlowData, cashTotals, cashflowPeriod, dailyCashFlow]);

  // ─── ABA 2: CATEGORIAS ───────────────────────────────────────────────────
  const catDateRange = useMemo(() => {
    const count = catPeriod === 'month' ? 1 : catPeriod === '3months' ? 3 : catPeriod === '6months' ? 6 : 12;
    const startMonth = shiftMonth(selectedMonth, -(count - 1));
    const previousEndMonth = shiftMonth(startMonth, -1);
    const previousStartMonth = shiftMonth(previousEndMonth, -(count - 1));
    const [endYear, endMonth] = selectedMonth.split('-').map(Number);
    return {
      startMonth,
      endMonth: selectedMonth,
      previousStartMonth,
      previousEndMonth,
      startStr: `${startMonth}-01`,
      endStr: toDateStr(new Date(endYear, endMonth, 0)),
    };
  }, [catPeriod, selectedMonth]);

  const consumptionAnalysis = useMemo(() => buildConsumptionAnalysis(
    transactions,
    invoices,
    categories,
    creditCards.flatMap(card => card.id ? [card.id] : []),
    catDateRange.startMonth,
    catDateRange.endMonth,
    catDateRange.previousStartMonth,
    catDateRange.previousEndMonth,
  ), [transactions, invoices, categories, creditCards, catDateRange]);
  const selectedConsumption = selectedConsumptionCategory ? consumptionAnalysis.categories.find(category => category.id === selectedConsumptionCategory) : undefined;
  const consumptionHighlights = useMemo(() => {
    const increases = consumptionAnalysis.categories.filter(category => category.change > 0).sort((a, b) => b.change - a.change);
    const reductions = consumptionAnalysis.categories.filter(category => category.change < 0).sort((a, b) => a.change - b.change);
    return { increase: increases[0], reduction: reductions[0] };
  }, [consumptionAnalysis]);

  const categoryData = useMemo(() => {
    const { startStr, endStr } = catDateRange;
    if (catType === 'expense') return consumptionAnalysis.categories.map(category => ({ ...category, pct: category.percent, pctIncome: 0 }));
    const periodTx = transactions.filter(t => !isTransfer(t) && isIncome(t) && isEffectivelyPaid(t) && t.date >= startStr && t.date <= endStr);
    const total = periodTx.reduce((s, t) => s + t.amount, 0);
    const incomeBase = transactions.filter(t => !isCreditCardTx(t) && isIncome(t) && isEffectivelyPaid(t) && !isTransfer(t) && t.date >= startStr && t.date <= endStr).reduce((s, t) => s + t.amount, 0);
    return categories
      .filter(c => c.type === 'receita' || c.type === 'income')
      .map(c => {
        const val = periodTx.filter(t => t.categoryId === c.id).reduce((s, t) => s + t.amount, 0);
        return { id: c.id || c.name, name: c.name, value: val, change: 0, pct: total > 0 ? (val / total * 100) : 0, pctIncome: incomeBase > 0 ? (val / incomeBase * 100) : 0 };
      })
      .filter(c => c.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [transactions, categories, catDateRange, catType, consumptionAnalysis]);

  // ─── ABA 3: TENDÊNCIA & ORÇAMENTOS ───────────────────────────────────────
  const trendData = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const visibleDays = selectedMonth === currentMonthStr ? Math.min(now.getDate(), daysInMonth) : daysInMonth;
    let cumulative = 0;
    return Array.from({ length: visibleDays }, (_, i) => {
      const day = i + 1;
      const dateStr = `${selectedMonth}-${day.toString().padStart(2, '0')}`;
      cumulative += transactions.filter(t => isExpense(t) && isEffectivelyPaid(t) && !isCreditCardTx(t) && !isTransfer(t) && t.date.startsWith(dateStr)).reduce((s, t) => s + t.amount, 0);
      return { day, amount: cumulative };
    });
  }, [transactions, selectedMonth, currentMonthStr]);

  const budgetComparison = useMemo(() => {
    return budgets
      .filter(b => b.period === 'monthly' || !b.period)
      .map(b => {
        const paradigm = localStorage.getItem('fiducia_budgetParadigm') || 'fracionado';
        const spent = transactions.filter(t => isExpense(t) && isEffectivelyPaid(t) && t.categoryId === b.categoryId && t.date.startsWith(selectedMonth)).reduce((s, t) => s + getBudgetImpact(t, paradigm), 0);
        const cat = categories.find(c => c.id === b.categoryId);
        return { name: cat?.name || 'Geral', budget: b.amount, spent, diff: b.amount - spent, pct: b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0 };
      })
      .filter(b => b.budget > 0 || b.spent > 0)
      .sort((a, b) => b.spent - a.spent);
  }, [transactions, budgets, categories, selectedMonth]);

  // ─── ABA 4: PROJEÇÃO FUTURA ───────────────────────────────────────────────
  const projEndDate = useMemo(() => {
    if (projPeriod === 'custom') {
      if (projCustomEnd) return new Date(projCustomEnd + 'T23:59:59');
      const fallback = new Date(now);
      fallback.setDate(fallback.getDate() + 89);
      return fallback;
    }
    const days = Number.parseInt(projPeriod, 10);
    const end = new Date(now);
    end.setDate(end.getDate() + days - 1);
    return end;
  }, [projPeriod, projCustomEnd]);

  const projEndMonthStr = toMonthStr(projEndDate);

  const cashCoverageProjection = useMemo(() => buildCashCoverageProjection({
    accounts,
    transactions,
    creditCards,
    invoices,
    recurrenceRules,
    options: {
      startDate: now,
      endDate: projEndDate,
      includeSavings,
      includeRecurrences,
    },
  }), [accounts, transactions, creditCards, invoices, recurrenceRules, includeSavings, includeRecurrences, projEndDate]);

  const projectionData = useMemo(() => cashCoverageProjection.monthlyProjection.map(m => ({
    ...m,
    incomeTxList: m.incomeEvents.map(event => event.raw || ({ id: event.id, date: event.date, amount: event.amount, description: event.label, categoryId: event.categoryId, accountId: event.accountId, projected: true })),
    expenseTxList: m.expenseEvents.map(event => event.raw || ({ id: event.id, date: event.date, amount: event.amount, description: event.label, categoryId: event.categoryId, accountId: event.accountId, projected: true })),
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
    daysAtRisk: cashCoverageProjection.daysAtRisk,
    coverageBalance: cashCoverageProjection.coverageBalance,
    bankExpenses: cashCoverageProjection.totalBankExpenses,
    closedInvoices: cashCoverageProjection.totalClosedInvoices,
    openInvoices: cashCoverageProjection.totalOpenInvoices,
    futureCard: cashCoverageProjection.totalFutureCard,
    excludedOverdueIncome: cashCoverageProjection.excludedOverdueIncome,
    safetyReserve,
    cashMargin: calculateCashMargin(cashCoverageProjection.minimumBalance, safetyReserve),
  }), [cashCoverageProjection, safetyReserve]);

  const projChartData = useMemo(() =>
    projectionData.map(m => ({
      name: m.shortLabel.charAt(0).toUpperCase() + m.shortLabel.slice(1),
      'A Receber': m.incomeTotal,
      'A Pagar': m.expenseTotal + m.invoiceTotal,
    })), [projectionData]);

  const projBalanceChartData = useMemo(() => [
    { name: 'Hoje', 'Saldo projetado': cashCoverageProjection.startingBalance },
    ...projectionData.map(m => ({
      name: m.shortLabel.charAt(0).toUpperCase() + m.shortLabel.slice(1),
      'Saldo projetado': m.accum,
    })),
  ], [cashCoverageProjection.startingBalance, projectionData]);

  const filteredProjData = projectionData;

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
    const months = invPeriod === '3months' ? 3 : invPeriod === '6months' ? 6 : 12;
    start = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
    end = new Date(now);
    end.setDate(end.getDate() + 90);
    return { start, end };
  }, [invPeriod]);

  const invoiceAnalysis = useMemo(() => buildInvoiceAnalysis({
    creditCards,
    transactions,
    invoices,
    startDate: invDateRange.start,
    endDate: invDateRange.end,
    selectedCardId: invSelectedCard,
    statusFilter: 'all',
    includeCredits: true,
    referenceDate: now,
  }), [creditCards, transactions, invoices, invDateRange, invSelectedCard]);

  const invChartBars = useMemo(() => {
    const cardSet = new Set<string>();
    invoiceAnalysis.monthlyData.filter(month => month.month <= currentMonthStr).forEach(m => {
      Object.keys(m.cards).forEach(id => cardSet.add(id));
    });
    return Array.from(cardSet).map(id => {
      const card = creditCards.find(c => c.id === id);
      return { id, name: card?.name || id };
    });
  }, [invoiceAnalysis.monthlyData, creditCards, currentMonthStr]);

  const invChartData = useMemo(() =>
    invoiceAnalysis.monthlyData
      .filter(m => m.total > 0 && m.month <= currentMonthStr)
      .map(m => {
        const data: any = { name: m.label.split(' de ')[0], month: m.month };
        Object.entries(m.cards).forEach(([cardId, cardData]) => {
          data[cardData.name] = cardData.amount;
        });
        return data;
      }), [invoiceAnalysis.monthlyData]);

  const invFutureData = useMemo(() =>
    Array.from(invoiceAnalysis.detailList
      .filter(item => item.status === 'future' && item.dueDate <= toDateStr(invDateRange.end))
      .reduce((months, item) => months.set(item.period, (months.get(item.period) || 0) + item.amount), new Map<string, number>()))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total]) => ({ name: fmtMonthYear(month).split(' de ')[0], total })),
    [invoiceAnalysis.detailList, invDateRange.end],
  );

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
        recurrenceRules,
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
    { id: 'statement', label: 'Extrato', icon: ReceiptText },
    { id: 'cashflow', label: 'Fluxo', icon: BarChart2 },
    { id: 'categories', label: 'Consumo', icon: Target },
    { id: 'trend', label: 'Orçamento', icon: TrendingDown },
    { id: 'projection', label: 'Futuro', icon: TrendingUp },
    { id: 'invoices', label: 'Faturas', icon: CreditCard },
    { id: 'ai', label: 'IA', icon: Brain },
  ];

  return (
    <div className="space-y-6 pb-20">
      <Dialog open={Boolean(selectedDayData)} onOpenChange={(open) => { if (!open) setSelectedCashFlowDay(null); }}>
        <DialogContent className="flex w-[calc(100vw-1rem)] max-w-none max-h-[calc(100dvh-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl sm:max-h-[88vh]">
          <DialogHeader className="border-b border-border p-4 pr-12 sm:p-5 sm:pr-12">
            <DialogTitle>Movimento do dia</DialogTitle>
            <DialogDescription>{selectedDayData ? new Date(`${selectedDayData.date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : ''}</DialogDescription>
            {selectedDayData && <div className={`pt-1 font-mono text-2xl font-bold ${selectedDayData.Saldo >= 0 ? 'text-fiducia-green' : 'text-fiducia-red'}`}>{fmt(selectedDayData.Saldo)}</div>}
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1 sm:p-2">
            <MonthlyStatementEntries entries={selectedDayData?.entries || []} accounts={accounts} categories={categories} emptyMessage="Nenhum movimento neste dia." onOpenTransaction={(id) => { setSelectedCashFlowDay(null); openTxDialog({ editId: id }); }} />
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(selectedConsumption)} onOpenChange={(open) => { if (!open) setSelectedConsumptionCategory(null); }}>
        <DialogContent className="flex w-[calc(100vw-1rem)] max-w-none max-h-[calc(100dvh-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl sm:max-h-[88vh]">
          <DialogHeader className="border-b border-border p-4 pr-12 sm:p-5 sm:pr-12">
            <DialogTitle>{selectedConsumption?.name || 'Categoria'}</DialogTitle>
            <DialogDescription>{catDateRange.startMonth === catDateRange.endMonth ? catDateRange.endMonth : `${catDateRange.startMonth} a ${catDateRange.endMonth}`} · {selectedConsumption?.entries.length || 0} lançamento(s)</DialogDescription>
            <div className="pt-1 font-mono text-2xl font-bold text-fiducia-red">{fmt(selectedConsumption?.value || 0)}</div>
            {selectedConsumption && <p className="text-xs text-muted-foreground">Conta {fmt(selectedConsumption.directTotal)} · Cartão {fmt(selectedConsumption.cardTotal)}</p>}
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1 sm:p-2">
            <MonthlyStatementEntries
              entries={(selectedConsumption?.entries || []).map(transaction => ({ transaction, kind: transaction.type === 'receita' || transaction.type === 'income' ? 'card_credit' : transaction.creditCardId || creditCards.some(card => card.id === transaction.accountId) ? 'card_expense' : 'account_expense' }))}
              accounts={accounts}
              creditCards={creditCards}
              categories={categories}
              emptyMessage="Nenhuma despesa nesta categoria."
              onOpenTransaction={(id) => { setSelectedConsumptionCategory(null); openTxDialog({ editId: id }); }}
            />
          </div>
        </DialogContent>
      </Dialog>
      {/* ── HEADER ── */}
      <div className="flex items-center gap-3">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Relatórios</h2>
        <PageHelp
          title="Relatórios"
          description="Analise suas finanças sob diferentes perspectivas. Abaixo está a metodologia utilizada em cada relatório:"
          items={[
            { label: 'Extrato Mensal', desc: 'Reconcilia exatamente os cards mensais do Dashboard. Separa receitas recebidas, despesas pagas diretamente em conta e pagamentos de fatura, permitindo abrir cada lançamento que compõe os totais.' },
            { label: '1. Fluxo de Caixa', desc: 'Mostra entradas, saídas e o resultado do período. O resultado acumulado começa em zero e não representa saldo bancário. No modo Mês, cada dia abre os lançamentos; em 3/6/12 meses, os cards exibem médias coerentes e o resultado do último mês.' },
            { label: '2. Consumo', desc: 'Mostra onde o dinheiro foi gasto sem duplicar o pagamento da fatura. Compras de cartão usam o período da fatura; despesas diretas usam a data efetiva. Cada categoria separa conta/cartão, compara com o período anterior e abre seus lançamentos.' },
            { label: '3. Orçamento', desc: 'Curva cumulativa das despesas e comparação com os limites configurados para o mês selecionado. Permite consultar tanto o período atual quanto meses anteriores.' },
            { label: '4. Projeção Futura', desc: 'Simula o saldo diário usando compromissos registrados, faturas abertas e fechadas e parcelas futuras. O horizonte pode ser 30, 60, 90, 180 ou 365 dias, ou uma data escolhida. Recorrências ainda não geradas e reservas financeiras são opções explícitas.' },
            { label: '4a. Margem de Caixa', desc: 'Mostra quanto pode ser assumido em novos compromissos sem reduzir o menor saldo projetado abaixo da reserva de segurança. Compromissos registrados entram sempre; recorrências ainda não geradas e reservas financeiras são opções explícitas.' },
            { label: '5. Faturas de Cartão', desc: 'Separa situação atual, parcelas dos próximos 90 dias e histórico pago. Valores são líquidos de créditos e estornos. Faturas fechadas mostram o que precisa ser pago agora; abertas mostram consumo em andamento; histórico não é tratado como dívida.' },
            { label: '6. Análise IA', desc: 'O assistente Fiducia processa seus últimos meses de fluxo de caixa e lançamentos recentes para gerar uma nota de saúde financeira com recomendações personalizadas. A análise considera padrões de gasto, consistência de receitas, evolução do saldo e riscos identificados na projeção de caixa.' },
          ]}
        />
      </div>

      {/* ── TAB BAR ── */}
      <div className="flex gap-1 bg-secondary/50 dark:bg-secondary/80 p-1 rounded-2xl border border-border overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
<button key={tab.id} onClick={() => setActiveTab(tab.id)} aria-current={isActive ? 'page' : undefined}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-xl text-[12px] sm:text-[13px] font-semibold whitespace-nowrap transition-all ${isActive ? 'bg-background shadow-sm text-foreground border border-border/50' : 'text-muted-foreground hover:text-foreground'}`}>
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          ABA 1 — FLUXO DE CAIXA
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'statement' && (
        <div className="space-y-5">
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-bold text-foreground">Extrato financeiro mensal</p>
              <p className="mt-1 text-xs text-muted-foreground">A mesma composição dos cards do Dashboard, com pagamentos de fatura identificados separadamente.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Button variant="outline" size="sm" className="h-10 gap-1.5" onClick={handleExportStatementCsv}>
                <FileDown className="h-3.5 w-3.5" /> Exportar CSV
              </Button>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Mês de referência
                <input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} className="mt-1 block h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground sm:w-44" />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-2xl border border-border bg-card p-4"><span className="text-[10px] font-bold uppercase text-muted-foreground">Receitas recebidas</span><strong className="mt-2 block font-mono text-lg text-fiducia-green sm:text-xl">{fmt(monthlyStatement.incomeTotal)}</strong></div>
            <div className="rounded-2xl border border-border bg-card p-4"><span className="text-[10px] font-bold uppercase text-muted-foreground">Despesas em conta</span><strong className="mt-2 block font-mono text-lg text-fiducia-red sm:text-xl">{fmt(monthlyStatement.accountExpenseTotal)}</strong></div>
            <div className="rounded-2xl border border-border bg-card p-4"><span className="text-[10px] font-bold uppercase text-muted-foreground">Pagamentos de fatura</span><strong className="mt-2 block font-mono text-lg text-fiducia-amber sm:text-xl">{fmt(monthlyStatement.invoicePaymentTotal)}</strong></div>
            <div className="rounded-2xl border border-border bg-card p-4"><span className="text-[10px] font-bold uppercase text-muted-foreground">Resultado do mês</span><strong className={`mt-2 block font-mono text-lg sm:text-xl ${monthlyStatement.balance >= 0 ? 'text-fiducia-blue' : 'text-fiducia-red'}`}>{fmt(monthlyStatement.balance)}</strong></div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div><h3 className="text-sm font-bold text-foreground">Composição do mês</h3><p className="text-xs text-muted-foreground">{statementEntries.length} lançamento(s) · saídas totais de {fmt(monthlyStatement.expenseTotal)}</p></div>
              <div className="flex rounded-xl border border-border bg-secondary/50 p-1">
                <FBtn active={statementFilter === 'all'} onClick={() => setStatementFilter('all')}>Tudo</FBtn>
                <FBtn active={statementFilter === 'income'} onClick={() => setStatementFilter('income')}>Receitas</FBtn>
                <FBtn active={statementFilter === 'expense'} onClick={() => setStatementFilter('expense')}>Despesas</FBtn>
              </div>
            </div>
            <MonthlyStatementEntries entries={statementEntries} accounts={accounts} creditCards={creditCards} categories={categories} emptyMessage="Nenhum lançamento efetivado para este filtro." onOpenTransaction={(id) => openTxDialog({ editId: id })} />
          </div>
        </div>
      )}

      {activeTab === 'cashflow' && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 flex-wrap">
<div className="flex p-1 bg-secondary/50 dark:bg-secondary/80 rounded-xl border border-border gap-0.5">
              {(['month', '3months', '6months', '12months'] as const).map(p => (
                <FBtn key={p} active={cashflowPeriod === p} onClick={() => setCashflowPeriod(p)}>
                  {p === 'month' ? 'Mês' : p === '3months' ? '3 Meses' : p === '6months' ? '6 Meses' : '12 Meses'}
                </FBtn>
              ))}
            </div>
            {cashflowPeriod === 'month' && <input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} aria-label="Mês do fluxo de caixa" className="h-8 rounded-xl border border-border bg-background px-2 text-xs font-semibold" />}
            <button onClick={() => setShowPending(!showPending)}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all ${showPending ? 'bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-400' : 'bg-transparent border-border text-muted-foreground hover:border-muted-foreground/50'}`}>
              {showPending ? 'Incluindo Pendentes' : 'Só Realizados'}
            </button>
            <Button variant="outline" size="sm" className="h-8 ml-auto gap-1.5" onClick={handleExportCashFlowPDF} disabled={isExportingPdf}>
              <FileDown className="h-3.5 w-3.5" />
              {isExportingPdf ? 'Gerando...' : 'Exportar PDF'}
            </Button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {cashKpis.map((k, i) => (
              <div key={i} className={`${k.bg} border border-border rounded-2xl p-5`}>
                <div className="flex items-center gap-2 mb-3">
                  <k.Icon className={`w-4 h-4 ${k.color}`} />
                  <span className={`text-[10px] font-bold ${k.color} uppercase tracking-wider`}>{k.label}</span>
                </div>
                <div className={`text-2xl font-bold font-mono ${k.color}`}>{fmt(k.value)}</div>
                {'detail' in k && k.detail && <div className="mt-1 text-[11px] text-muted-foreground capitalize">{k.detail}</div>}
              </div>
            ))}
          </div>

          {cashflowPeriod === 'month' && (
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 p-5 border-b border-border">
                <Calendar className="w-4 h-4 text-fiducia-blue" />
                <div><h3 className="text-[15px] font-bold text-foreground">Movimento por dia</h3><p className="text-[12px] text-muted-foreground">Toque em um dia para conferir os lançamentos</p></div>
              </div>
              <div className="divide-y divide-border">
                {dailyCashFlow.filter(day => day.entries.length > 0).map(day => (
                  <button key={day.date} type="button" onClick={() => setSelectedCashFlowDay(day.date)} className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 p-4 text-left transition-colors hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className="flex h-10 w-10 flex-col items-center justify-center rounded-xl bg-secondary text-foreground"><strong className="text-sm leading-none">{day.name}</strong><small className="mt-0.5 text-[9px] uppercase text-muted-foreground">dia</small></span>
                    <span className="min-w-0"><strong className="block text-xs text-foreground">{day.entries.length} lançamento(s)</strong><small className="block truncate text-[11px] text-muted-foreground">Entradas {fmt(day.Receitas)} · Saídas {fmt(day.Despesas)}</small></span>
                    <strong className={`font-mono text-sm ${day.Saldo >= 0 ? 'text-fiducia-green' : 'text-fiducia-red'}`}>{day.Saldo >= 0 ? '+' : ''}{fmt(day.Saldo)}</strong>
                  </button>
                ))}
                {dailyCashFlow.every(day => day.entries.length === 0) && <p className="p-10 text-center text-sm text-muted-foreground">Nenhum movimento encontrado neste mês.</p>}
              </div>
            </div>
          )}

          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-fiducia-blue" />
                  <h3 className="text-[15px] font-bold text-foreground">{cashflowPeriod === 'month' ? 'Movimentos diários' : 'Entradas vs Saídas'}</h3>
                </div>
                <p className="text-[12px] text-muted-foreground mt-0.5">{cashflowPeriod === 'month' ? 'Valores efetivamente recebidos e pagos em cada dia' : 'Comparação mensal ancorada no período selecionado'}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><div className="w-2.5 h-2.5 rounded-full bg-fiducia-green" />Receitas</div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><div className="w-2.5 h-2.5 rounded-full bg-fiducia-red" />Despesas</div>
              </div>
            </div>
            <div className="p-5">
              {cashflowPeriod === 'month' ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={dailyCashFlow} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} interval={4} dy={10} />
                    <YAxis domain={[0, 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={v => `R$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                    <Tooltip formatter={(v: number) => fmt(v)} labelFormatter={label => `Dia ${label}`} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="Receitas" fill="#22c55e" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Despesas" fill="#ef4444" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
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
              )}
            </div>
          </div>

          {cashflowPeriod === 'month' && (
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
              <div className="p-5 border-b border-border">
                <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-fiducia-blue" /><h3 className="text-[15px] font-bold text-foreground">Resultado acumulado do mês</h3></div>
                <p className="mt-1 text-[12px] text-muted-foreground">Começa em zero e soma entradas menos saídas. Não representa o saldo das contas bancárias.</p>
              </div>
              <div className="p-5">
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={dailyCashFlow} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} interval={4} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={v => `R$${Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                    <ReferenceLine y={0} stroke="currentColor" strokeOpacity={0.5} />
                    <Tooltip formatter={(value: number) => [fmt(value), 'Resultado acumulado']} labelFormatter={label => `Dia ${label}`} />
                    <Area type="monotone" dataKey="Acumulado" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.12} strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {cashflowPeriod !== 'month' && <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
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
          </div>}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          ABA 2 — CATEGORIAS
      ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'categories' && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 flex-wrap">
<div className="flex p-1 bg-secondary/50 dark:bg-secondary/80 rounded-xl border border-border gap-0.5">
              {(['month', '3months', '6months', '12months'] as const).map(p => (
                <FBtn key={p} active={catPeriod === p} onClick={() => setCatPeriod(p)}>
                  {p === 'month' ? 'Mês' : p === '3months' ? '3M' : p === '6months' ? '6M' : '12M'}
                </FBtn>
              ))}
            </div>
            <input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} aria-label="Mês final da análise de consumo" className="h-8 rounded-xl border border-border bg-background px-2 text-xs font-semibold" />
            <div className="flex p-1 bg-secondary/50 dark:bg-secondary/80 rounded-xl border border-border gap-0.5">
              <FBtn active={catType === 'expense'} onClick={() => setCatType('expense')}>Despesas</FBtn>
              <FBtn active={catType === 'income'} onClick={() => setCatType('income')}>Receitas</FBtn>
            </div>
            <Button variant="outline" size="sm" className="h-8 ml-auto gap-1.5" onClick={handleExportCategoryPDF} disabled={isExportingPdf}>
              <FileDown className="h-3.5 w-3.5" />
              {isExportingPdf ? 'Gerando...' : 'Exportar PDF'}
            </Button>
          </div>

          {catType === 'expense' && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-2xl border border-border bg-card p-4"><span className="text-[10px] font-bold uppercase text-muted-foreground">Consumo total</span><strong className="mt-2 block font-mono text-lg text-fiducia-red">{fmt(consumptionAnalysis.total)}</strong></div>
              <div className="rounded-2xl border border-border bg-card p-4"><span className="text-[10px] font-bold uppercase text-muted-foreground">Direto em conta</span><strong className="mt-2 block font-mono text-lg text-foreground">{fmt(consumptionAnalysis.directTotal)}</strong></div>
              <div className="rounded-2xl border border-border bg-card p-4"><span className="text-[10px] font-bold uppercase text-muted-foreground">Compras no cartão</span><strong className="mt-2 block font-mono text-lg text-fiducia-amber">{fmt(consumptionAnalysis.cardTotal)}</strong></div>
              <div className="rounded-2xl border border-border bg-card p-4"><span className="text-[10px] font-bold uppercase text-muted-foreground">Variação anterior</span><strong className={`mt-2 block font-mono text-lg ${consumptionAnalysis.change <= 0 ? 'text-fiducia-green' : 'text-fiducia-red'}`}>{consumptionAnalysis.change >= 0 ? '+' : ''}{fmt(consumptionAnalysis.change)}{consumptionAnalysis.changePercent !== null && <small className="ml-1 text-xs">({consumptionAnalysis.changePercent >= 0 ? '+' : ''}{consumptionAnalysis.changePercent.toFixed(1)}%)</small>}</strong></div>
            </div>
          )}

          {catType === 'expense' && (consumptionHighlights.increase || consumptionHighlights.reduction || consumptionAnalysis.uncategorizedTotal > 0) && (
            <div className="flex flex-col gap-2 rounded-2xl border border-border bg-secondary/30 p-4 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
              {consumptionHighlights.increase && <span><strong className="text-fiducia-red">Maior aumento:</strong> {consumptionHighlights.increase.name} (+{fmt(consumptionHighlights.increase.change)})</span>}
              {consumptionHighlights.reduction && <span><strong className="text-fiducia-green">Maior redução:</strong> {consumptionHighlights.reduction.name} ({fmt(consumptionHighlights.reduction.change)})</span>}
              {consumptionAnalysis.uncategorizedTotal > 0 && <button type="button" onClick={() => setSelectedConsumptionCategory('uncategorized')} className="text-left font-semibold text-fiducia-amber underline underline-offset-2">Sem categoria: {fmt(consumptionAnalysis.uncategorizedTotal)}</button>}
            </div>
          )}

          <div className="grid md:grid-cols-[1fr_300px] gap-6 items-start">
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 p-5 border-b border-border">
                <Target className="w-4 h-4 text-fiducia-amber" />
                <h3 className="text-[15px] font-bold text-foreground">{catType === 'expense' ? 'Consumo por Categoria' : 'Receitas por Categoria'}</h3>
              </div>
              <div className="p-4">
                {categoryData.length > 0 ? (
                  <div className="space-y-1">
                    <div className="grid grid-cols-12 text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 pb-2 border-b border-border">
                      <span className="col-span-5">Categoria</span>
                      <span className="col-span-3 text-right">Valor</span>
                      <span className="col-span-2 text-right">% Total</span>
                      <span className="col-span-2 text-right">{catType === 'expense' ? 'Variação' : '% Renda'}</span>
                    </div>
                    {categoryData.map((item, i) => (
                      <button key={item.name} type="button" disabled={catType !== 'expense'} onClick={() => setSelectedConsumptionCategory(item.id)} className="grid w-full grid-cols-12 text-xs px-2 py-2.5 rounded-lg hover:bg-muted/30 items-center transition-colors text-left disabled:cursor-default">
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
                        <span className={`col-span-2 text-right font-mono text-[10px] ${catType === 'expense' && item.change > 0 ? 'text-fiducia-red' : 'text-muted-foreground'}`}>{catType === 'expense' ? `${item.change >= 0 ? '+' : ''}${fmt(item.change)}` : item.value > 0 ? `${item.pctIncome.toFixed(1)}%` : '—'}</span>
                      </button>
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
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-fiducia-blue" />
              <h3 className="text-[15px] font-bold text-foreground">{fmtMonthYear(selectedMonth)}</h3>
            </div>
            <div className="flex items-center gap-2">
              <input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} aria-label="Mês do orçamento" className="h-8 rounded-xl border border-border bg-background px-2 text-xs font-semibold" />
              <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={handleExportTrendPDF} disabled={isExportingPdf}>
                <FileDown className="h-3.5 w-3.5" />
                {isExportingPdf ? 'Gerando...' : 'Exportar PDF'}
              </Button>
            </div>
          </div>
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-border">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-fiducia-blue" />
                <h3 className="text-[15px] font-bold text-foreground">Evolução de Gastos — {fmtMonthYear(selectedMonth)}</h3>
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
                {fmtMonthYear(selectedMonth)} — somente despesas efetivadas
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
          {/* Filtros */}
          {/* Filtros */}
<div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
            <div className="space-y-3">
            <div className="flex flex-nowrap gap-2 items-center overflow-x-auto pb-1">
              <div className="flex p-1 bg-secondary/50 dark:bg-secondary/80 rounded-xl border border-border gap-0.5 shrink-0">
                {(['30d', '60d', '90d', '180d', '365d'] as const).map(p => (
                  <FBtn key={p} active={projPeriod === p} onClick={() => setProjPeriod(p)}>
                    {p.replace('d', ' dias')}
                  </FBtn>
                ))}
                <FBtn active={projPeriod === 'custom'} onClick={() => setProjPeriod('custom')}>
                  <span className="hidden sm:inline">Personalizado</span>
                  <span className="sm:hidden">Data</span>
                </FBtn>
              </div>
              {projPeriod === 'custom' && (
                <input type="date" value={projCustomEnd} onChange={e => setProjCustomEnd(e.target.value)}
                  className="h-8 bg-background border border-border rounded-xl px-3 text-xs shrink-0" />
              )}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-muted-foreground font-medium whitespace-nowrap">Reservas:</span>
                <button onClick={() => setIncludeSavings(!includeSavings)}
                  type="button" aria-label="Incluir reservas e investimentos" aria-pressed={includeSavings}
                  className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${includeSavings ? 'bg-fiducia-blue' : 'bg-secondary border border-border'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${includeSavings ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>
            <div className="flex flex-nowrap gap-3 items-center overflow-x-auto pb-1 pt-3 border-t border-border/50">
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-muted-foreground font-medium whitespace-nowrap">Recorrências futuras:</span>
                <button onClick={() => setIncludeRecurrences(!includeRecurrences)} type="button" aria-label="Incluir recorrências futuras ainda não geradas" aria-pressed={includeRecurrences}
                  className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${includeRecurrences ? 'bg-fiducia-blue' : 'bg-secondary border border-border'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${includeRecurrences ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </div>
              <label className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium shrink-0">
                Reserva protegida
                <input type="number" min="0" step="100" value={safetyReserve} onChange={event => {
                  const value = Math.max(0, Number(event.target.value) || 0);
                  setSafetyReserve(value);
                  localStorage.setItem(CASH_SAFETY_RESERVE_KEY, String(value));
                }} className="h-8 w-28 rounded-xl border border-border bg-background px-2 font-mono text-xs text-foreground" />
              </label>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 shrink-0" onClick={handleExportProjectionPDF} disabled={isExportingPdf}>
                <FileDown className="h-3.5 w-3.5" />
                {isExportingPdf ? 'Gerando...' : 'Exportar PDF'}
              </Button>
            </div>
            </div>
          </div>
          <div className={`border rounded-2xl p-5 shadow-sm ${projKPIs.cashMargin < 0 ? 'bg-fiducia-red/5 border-fiducia-red/20' : 'bg-fiducia-green/5 border-fiducia-green/20'}`}>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <div className={`text-[11px] font-bold uppercase tracking-wider ${projKPIs.cashMargin < 0 ? 'text-fiducia-red' : 'text-fiducia-green'}`}>
                  {projKPIs.cashMargin < 0 ? 'Margem de caixa insuficiente' : 'Margem disponível para novos compromissos'}
                </div>
                <div className={`mt-1 font-mono text-3xl font-bold ${projKPIs.cashMargin >= 0 ? 'text-fiducia-green' : 'text-fiducia-red'}`}>
                  {fmt(projKPIs.cashMargin)}
                </div>
                <div className="text-[12px] text-muted-foreground mt-1">
                  Menor saldo previsto: {fmt(projKPIs.minimumBalance)} em {projKPIs.minimumBalanceDate.split('-').reverse().join('/')} · reserva protegida: {fmt(projKPIs.safetyReserve)}.
                  {projKPIs.daysAtRisk > 0 && (
                    <span className="block mt-1 text-fiducia-red font-semibold">
                      ⚠️ {projKPIs.daysAtRisk} dia{projKPIs.daysAtRisk > 1 ? 's' : ''} com saldo negativo no periodo
                    </span>
                  )}
                  {projKPIs.excludedOverdueIncome > 0 && <span className="block mt-1 text-fiducia-amber font-semibold">Receitas vencidas não recebidas, no total de {fmt(projKPIs.excludedOverdueIncome)}, não foram usadas como cobertura.</span>}
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
              <div className="text-[11px] text-muted-foreground mt-1">Abertas, fechadas e parcelas futuras</div>
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

          {/* Gráficos */}
          {projChartData.length > 1 && (
            <div className="grid gap-4 xl:grid-cols-2">
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
              <div className="flex flex-col gap-3 p-5 border-b border-border sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-fiducia-blue" />
                    <h3 className="text-[15px] font-bold text-foreground">Compromissos por mês</h3>
                  </div>
                  <p className="text-[12px] text-muted-foreground mt-0.5">Entradas e saídas previstas no período</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><div className="w-2.5 h-2.5 rounded-full bg-fiducia-green" />A Receber</div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><div className="w-2.5 h-2.5 rounded-full bg-fiducia-red" />A Pagar</div>
                </div>
              </div>
              <div className="p-5">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={projChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} dy={10} />
                    <YAxis domain={[0, 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={v => `R$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
                    <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="A Receber" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="A Pagar" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
              <div className="p-5 border-b border-border">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-fiducia-blue" />
                  <h3 className="text-[15px] font-bold text-foreground">Evolução do saldo projetado</h3>
                </div>
                <p className="text-[12px] text-muted-foreground mt-0.5">Parte do saldo atual das contas e incorpora os compromissos futuros</p>
              </div>
              <div className="p-5">
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={projBalanceChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={v => `R$${Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                    <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <ReferenceLine y={0} stroke="currentColor" strokeOpacity={0.55} ifOverflow="extendDomain" />
                    <Area type="monotone" dataKey="Saldo projetado" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.12} strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Saldo inicial: <span className="font-mono font-semibold text-foreground">{fmt(cashCoverageProjection.startingBalance)}</span>. Valores abaixo de zero indicam falta de cobertura projetada, não despesa mensal.
                </p>
              </div>
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
                    className="w-full flex items-center justify-between p-5 hover:bg-secondary/50 dark:bg-secondary/80 transition-colors text-left">
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
                              <div key={t.id} onClick={() => { if (!t.projected) openTxDialog({ editId: t.id }); }}
                                className={`flex items-center gap-3 px-5 py-3 transition-colors border-t border-border/20 ${t.projected ? '' : 'hover:bg-secondary/50 dark:bg-secondary/80 cursor-pointer'}`}>
                                <div className="w-8 h-8 rounded-lg bg-fiducia-green/10 flex items-center justify-center shrink-0">
                                  <ArrowUpRight className="w-4 h-4 text-fiducia-green" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-[13px] font-semibold text-foreground truncate">{t.description || 'Sem descrição'}</div>
                                  <div className="text-[11px] text-muted-foreground">{[cat?.name, acc?.name].filter(Boolean).join(' · ')}</div>
                                  {t.projected && <div className="text-[10px] font-semibold text-fiducia-blue">Recorrência estimada</div>}
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
                              <div key={t.id} onClick={() => { if (!t.projected) openTxDialog({ editId: t.id }); }}
                                className={`flex items-center gap-3 px-5 py-3 transition-colors border-t border-border/20 ${t.projected ? '' : 'hover:bg-secondary/50 dark:bg-secondary/80 cursor-pointer'}`}>
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isPast ? 'bg-fiducia-red/20' : 'bg-fiducia-red/10'}`}>
                                  <ArrowDownRight className="w-4 h-4 text-fiducia-red" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[13px] font-semibold text-foreground truncate">{t.description || 'Sem descrição'}</span>
                                    {isPast && <span className="text-[9px] font-bold bg-fiducia-red text-white dark:text-background px-1.5 py-0.5 rounded-full shrink-0">Atrasada</span>}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground">{[cat?.name, acc?.name].filter(Boolean).join(' · ')}</div>
                                  {t.projected && <div className="text-[10px] font-semibold text-fiducia-blue">Recorrência estimada</div>}
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
                            const displayedAmount = inv.status === 'parcial' ? Math.max(0, (inv.totalAmount || 0) - (inv.paidAmount || 0)) : (inv.totalAmount || 0);
                            return (
                              <div key={inv.id} onClick={() => navigate('/cards')}
                                className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/50 dark:bg-secondary/80 cursor-pointer transition-colors border-t border-border/20">
                                <div className="w-8 h-8 rounded-lg bg-fiducia-amber/10 flex items-center justify-center shrink-0">
                                  <CreditCard className="w-4 h-4 text-fiducia-amber" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[13px] font-semibold text-foreground">Fatura {card?.name || 'Cartão'}</span>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${inv.status === 'fechada' ? 'bg-fiducia-red/10 text-fiducia-red' : inv.status === 'parcial' ? 'bg-fiducia-amber/10 text-fiducia-amber' : 'bg-fiducia-amber/10 text-fiducia-amber'}`}>
                                      {inv.status === 'fechada' ? 'Fechada' : inv.status === 'parcial' ? 'Pagamento Parcial' : 'Aberta'}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-muted-foreground capitalize">{periodLabel}</div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="text-[13px] font-bold font-mono text-fiducia-amber">-{fmt(displayedAmount)}</div>
                                  {inv.status === 'parcial' && <div className="text-[10px] text-fiducia-green">{fmt(inv.paidAmount || 0)} já pagos</div>}
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
              <div className="flex p-1 bg-secondary/50 dark:bg-secondary/80 rounded-xl border border-border gap-0.5">
                {(['3months', '6months', '12months'] as const).map(p => (
                  <FBtn key={p} active={invPeriod === p} onClick={() => setInvPeriod(p)}>
                    Histórico {p === '3months' ? '3M' : p === '6months' ? '6M' : '12M'}
                  </FBtn>
                ))}
              </div>
              <select value={invSelectedCard} onChange={e => setInvSelectedCard(e.target.value)}
                className="h-8 bg-background border border-border rounded-xl px-3 text-xs text-foreground">
                <option value="all">Todos os cartões</option>
                {creditCards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <span className="text-[11px] text-muted-foreground">Valores líquidos após créditos e estornos · futuro limitado a 90 dias</span>
              <Button variant="outline" size="sm" className="h-8 ml-auto gap-1.5" onClick={handleExportInvoiceAnalysisPDF} disabled={isExportingPdf}>
                <FileDown className="h-3.5 w-3.5" />
                {isExportingPdf ? 'Gerando...' : 'Exportar PDF'}
              </Button>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-fiducia-red/5 border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3"><ArrowDownRight className="w-4 h-4 text-fiducia-red" /><span className="text-[10px] font-bold text-fiducia-red uppercase tracking-wider">A pagar agora</span></div>
              <div className="text-2xl font-bold font-mono text-fiducia-red">{fmt(invoiceAnalysis.summary.totalClosed)}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{invoiceAnalysis.summary.nextDueDate ? `Próximo vencimento em ${invoiceAnalysis.summary.nextDueDate.split('-').reverse().join('/')}` : 'Nenhuma fatura fechada'}</div>
            </div>
            <div className="bg-fiducia-amber/5 border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3"><CreditCard className="w-4 h-4 text-fiducia-amber" /><span className="text-[10px] font-bold text-fiducia-amber uppercase tracking-wider">Em andamento</span></div>
              <div className="text-2xl font-bold font-mono text-fiducia-amber">{fmt(invoiceAnalysis.summary.totalOpen)}</div>
              <div className="text-[11px] text-muted-foreground mt-1">Compras atuais ainda sujeitas a mudança</div>
            </div>
            <div className="bg-fiducia-blue/5 border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3"><TrendingUp className="w-4 h-4 text-fiducia-blue" /><span className="text-[10px] font-bold text-fiducia-blue uppercase tracking-wider">Próximos 90 dias</span></div>
              <div className="text-2xl font-bold font-mono text-fiducia-blue">{fmt(invoiceAnalysis.summary.totalFuture)}</div>
              <div className="text-[11px] text-muted-foreground mt-1">Parcelas futuras já contratadas</div>
            </div>
            <div className="bg-secondary/40 border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3"><Target className="w-4 h-4 text-purple-600 dark:text-purple-400" /><span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Média histórica paga</span></div>
              <div className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400">{fmt(invoiceAnalysis.summary.monthlyAverage)}</div>
              <div className="text-[11px] text-muted-foreground mt-1">Somente faturas efetivamente pagas</div>
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
                    <h3 className="text-[15px] font-bold text-foreground">Histórico mensal por cartão</h3>
                  </div>
                  <p className="text-[12px] text-muted-foreground mt-0.5">Faturas líquidas até o mês atual — cada cor é um cartão</p>
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
                    <h3 className="text-[14px] font-bold text-foreground">Distribuição histórica</h3>
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

              {invFutureData.length > 0 && (
                <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2 p-4 border-b border-border">
                    <TrendingUp className="w-4 h-4 text-fiducia-amber" />
                    <div><h3 className="text-[14px] font-bold text-foreground">Parcelas futuras</h3><p className="text-[11px] text-muted-foreground">Compromissos distribuídos nos próximos 90 dias</p></div>
                  </div>
                  <div className="p-4">
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={invFutureData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} tickFormatter={v => `R$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
                        <Tooltip formatter={(v: number) => fmt(v)} />
                        <Bar dataKey="total" name="Parcelas futuras" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
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

          <button
            onClick={() => setShowDailyView(!showDailyView)}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-card border border-border rounded-2xl text-[13px] font-bold text-muted-foreground hover:text-foreground transition-colors shadow-sm"
          >
            {showDailyView ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            {showDailyView ? 'Ocultar' : 'Mostrar'} Visão Diária ({cashCoverageProjection.dailyProjection.length} dias)
          </button>

          {showDailyView && (
            <div className="space-y-4">
              {projKPIs.daysAtRisk > 0 && (
                <div className="bg-fiducia-red/5 border border-fiducia-red/20 rounded-2xl p-4">
                  <div className="text-[11px] font-bold text-fiducia-red uppercase tracking-wider mb-2">Dias Críticos</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                    {cashCoverageProjection.dailyProjection
                      .filter(d => d.endingBalance < 0)
                      .sort((a, b) => a.endingBalance - b.endingBalance)
                      .slice(0, 5)
                      .map(d => (
                        <div key={d.date} className="bg-card border border-border rounded-xl p-3">
                          <div className="text-[10px] text-muted-foreground">{d.date.split('-').reverse().join('/')}</div>
                          <div className="text-[14px] font-bold font-mono text-fiducia-red mt-1">{fmt(d.endingBalance)}</div>
                          <div className="text-[9px] text-muted-foreground mt-0.5">
                            {d.expense > 0 ? `Saídas: ${fmt(d.expense)}` : ''}
                            {d.income > 0 ? ` ${d.expense > 0 ? '·' : ''} Entradas: ${fmt(d.income)}` : ''}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-secondary/50 dark:bg-secondary/80">
                      <tr className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        <th className="text-left py-3 px-4">Data</th>
                        <th className="text-right py-3 px-4">Saldo Inicial</th>
                        <th className="text-right py-3 px-4">Entradas</th>
                        <th className="text-right py-3 px-4">Saídas</th>
                        <th className="text-right py-3 px-4">Saldo Final</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {cashCoverageProjection.dailyProjection.map(d => {
                        const isRisk = d.endingBalance < 0;
                        const isTight = !isRisk && d.endingBalance < (projKPIs.totalPay * 0.2);
                        return (
                          <tr key={d.date} className={isRisk ? 'bg-fiducia-red/5' : isTight ? 'bg-fiducia-amber/5' : ''}>
                            <td className="py-2.5 px-4 font-medium text-foreground">
                              {d.date.split('-').slice(1).reverse().join('/')}
                              {isRisk && <span className="ml-2 text-[9px] text-fiducia-red font-bold">⬤</span>}
                              {isTight && <span className="ml-2 text-[9px] text-fiducia-amber font-bold">⬤</span>}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono">{fmt(d.startingBalance)}</td>
                            <td className="py-2.5 px-4 text-right font-mono text-fiducia-green">{d.income > 0 ? `+${fmt(d.income)}` : '—'}</td>
                            <td className="py-2.5 px-4 text-right font-mono text-fiducia-red">{d.expense > 0 ? `-${fmt(d.expense)}` : '—'}</td>
                            <td className={`py-2.5 px-4 text-right font-mono font-bold ${isRisk ? 'text-fiducia-red' : isTight ? 'text-fiducia-amber' : 'text-fiducia-green'}`}>
                              {fmt(d.endingBalance)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
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
                  <Brain className="w-5 h-5 text-white dark:text-[#0a101c]" />
                </div>
                <div>
                  <div className="text-[16px] font-bold text-foreground">Fiducia AI</div>
                  <div className="text-[12px] text-muted-foreground">Análise inteligente — IA interpreta, sistema calcula</div>
                </div>
              </div>
              <Button onClick={generateAI} disabled={isLoadingAi || transactions.length < 5}
                className="bg-fiducia-blue hover:bg-fiducia-blue/90 text-white dark:text-background gap-2 font-semibold shadow-lg shadow-fiducia-blue/20">
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
