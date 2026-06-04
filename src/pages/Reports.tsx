import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid, AreaChart, Area 
} from 'recharts';
import { FileText, Sparkles, TrendingUp, TrendingDown, Wallet, Target, AlertCircle, Loader2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { toast } from 'sonner';

import { resolveAccountName, isEffectivelyPaid } from '../lib/utils';
import { PageHelp } from '../components/PageHelp';
import { callGroq } from '../services/groqService';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6'];

const isTransfer = (t: any) => t.type === 'transferencia' || t.type === 'transfer';
const isCreditCardTx = (t: any) => !!t.creditCardId;
const isIncome = (t: any) => t.type === 'receita' || t.type === 'income';
const isExpense = (t: any) => t.type === 'despesa' || t.type === 'expense';

export function Reports() {
  const { user, isAuthReady } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [creditCards, setCreditCards] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [aiInsight, setAiInsight] = useState<string>('');
  const [isLoadingAi, setIsLoadingAi] = useState<boolean>(false);
  const [reportPeriod, setReportPeriod] = useState<'today' | 'week' | 'month' | '3months' | '6months' | '12months' | 'year' | 'custom'>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showPending, setShowPending] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);

  const getDateRange = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let start: Date, end = new Date(now);
    switch(reportPeriod) {
      case 'today': start = today; break;
      case 'week': start = new Date(today); start.setDate(start.getDate() - start.getDay()); break;
      case 'month': start = new Date(now.getFullYear(), now.getMonth(), 1); break;
      case '3months': start = new Date(now); start.setMonth(start.getMonth() - 3); break;
      case '6months': start = new Date(now); start.setMonth(start.getMonth() - 6); break;
      case '12months': start = new Date(now); start.setMonth(start.getMonth() - 12); break;
      case 'year': start = new Date(now.getFullYear(), 0, 1); break;
      case 'custom': start = new Date(customStart + 'T00:00:00'); end = new Date(customEnd + 'T23:59:59'); break;
    }
    return { start, end };
  };
  const isRelevant = (t: any) => isEffectivelyPaid(t) || (showPending && (t.status === 'pendente' || t.status === 'pending'));

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const transactionsQuery = query(collection(db, 'transactions'), where('userId', '==', user.uid));
    const unsubscribeTransactions = onSnapshot(transactionsQuery, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'transactions'));

    const categoriesQuery = query(collection(db, 'categories'), where('userId', '==', user.uid));
    const unsubscribeCategories = onSnapshot(categoriesQuery, (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'categories'));

    const accountsQuery = query(collection(db, 'accounts'), where('userId', '==', user.uid));
    const unsubscribeAccounts = onSnapshot(accountsQuery, (snapshot) => {
      setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'accounts'));

    const budgetsQuery = query(collection(db, 'budgets'), where('userId', '==', user.uid));
    const unsubscribeBudgets = onSnapshot(budgetsQuery, (snapshot) => {
      setBudgets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'budgets'));

    const ccQuery = query(collection(db, 'creditCards'), where('userId', '==', user.uid));
    const unsubscribeCC = onSnapshot(ccQuery, (snapshot) => {
      setCreditCards(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'creditCards'));

    const invoicesQuery = query(collection(db, 'invoices'), where('userId', '==', user.uid));
    const unsubscribeInvoices = onSnapshot(invoicesQuery, (snapshot) => {
      setInvoices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'invoices'));

    return () => {
      unsubscribeTransactions();
      unsubscribeCategories();
      unsubscribeAccounts();
      unsubscribeBudgets();
      unsubscribeCC();
      unsubscribeInvoices();
    };
  }, [user, isAuthReady]);

  const generateAIAnalysis = async () => {
    if (isLoadingAi || transactions.length < 5) return;
    setIsLoadingAi(true);
    try {
      const recentTransactions = transactions
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 50)
        .map(t => ({
          date: t.date,
          desc: t.description,
          amount: t.amount,
          type: t.type,
          category: categories.find(c => c.id === t.categoryId)?.name || 'Geral'
        }));

      const monthlySummary = cashFlowData.slice(-3);

      const prompt = `Como um consultor financeiro especialista (Fiducia AI), analise os dados financeiros abaixo e forneça:
      1. Um Score de Saúde Financeira (0-100) com uma breve explicação.
      2. Três dicas personalizadas e acionáveis para melhorar as finanças do usuário.
      3. Uma previsão otimista e uma realista para o próximo mês.

      Dados:
      Saldo Total Atual: R$ ${accounts.reduce((sum, a) => sum + (a.balance || 0), 0).toFixed(2)}
      Resumo Mensal (Últimos 3 meses): ${JSON.stringify(monthlySummary)}
      Transações Recentes: ${JSON.stringify(recentTransactions)}

      Responda em Português usando Markdown básico (bullets, negrito). Seja empático e profissional.`;

      const insight = await callGroq(
        [{ role: "user", content: prompt }],
        { maxTokens: 1000 }
      );
      setAiInsight(insight || 'Não foi possível gerar a análise no momento.');
    } catch (error) {
      console.error("AI Analysis Error:", error);
      toast.error('Erro ao gerar análise. Verifique sua conexão e tente novamente.');
      setAiInsight('Ocorreu um erro ao gerar a análise automática. Verifique sua conexão ou tente novamente mais tarde.');
    } finally {
      setIsLoadingAi(false);
    }
  };

  const getPeriodStart = (): string => {
    const now = new Date();
    const range = getDateRange();
    return range.start.toISOString().substring(0, 7);
  };
  const periodStart = getPeriodStart();
  const isInPeriod = (d: string) => d >= periodStart;

  // Fluxo de Caixa Mensal (cash basis: só conta corrente, sem transferência, sem cartão)
  const cashFlowData = useMemo(() => {
    const count = reportPeriod === 'year' ? 12 : reportPeriod === '12months' ? 12 : reportPeriod === '6months' ? 6 : reportPeriod === '3months' ? 3 : 6;
    const months = Array.from({length: count}, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - count + i + 1);
      return { month: d.toISOString().substring(0, 7), label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') };
    });
    return months.map(m => {
      const monthTx = transactions.filter(t => t.date.startsWith(m.month) && !isCreditCardTx(t) && !isTransfer(t));
      return {
        name: m.label.charAt(0).toUpperCase() + m.label.slice(1),
        Receitas: monthTx.filter(t => isIncome(t) && isRelevant(t)).reduce((sum, t) => sum + t.amount, 0),
        Despesas: monthTx.filter(t => isExpense(t) && isRelevant(t)).reduce((sum, t) => sum + t.amount, 0),
      };
    });
  }, [transactions, reportPeriod, showPending]);

  const projectionData = useMemo(() => {
    if (!showPending) return [];
    const now = new Date();
    const currentMonth = now.toISOString().substring(0, 7);
    const saldoAtual = accounts.filter(a => !a.excludeFromCashFlow).reduce((s, a) => s + (a.balance || 0), 0);
    
    const months = Array.from({length: 6}, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() + i);
      return d.toISOString().substring(0, 7);
    });
    
    let accum = saldoAtual;
    return months.map(m => {
      const mTx = transactions.filter(t => t.date.startsWith(m) && (t.status === 'pendente' || t.status === 'pending') && !isTransfer(t));
      const income = mTx.filter(t => isIncome(t) && !isCreditCardTx(t)).reduce((s, t) => s + t.amount, 0);
      const expense = mTx.filter(t => isExpense(t) && !isCreditCardTx(t)).reduce((s, t) => s + t.amount, 0);
      const invoiceExp = invoices.filter(i => i.period === m && i.status !== 'paga').reduce((s, i) => s + (i.totalAmount || 0), 0);
      const net = income - expense - invoiceExp;
      accum += net;
      const [y, mn] = m.split('-').map(Number);
      return { month: m, label: new Date(y, mn-1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }), income, expense, invoiceExp, net, accum };
    });
  }, [transactions, accounts, invoices, showPending]);

  // Despesas por Categoria (accrual basis: conta corrente + cartão, por data, sem transferência)
  const categoryData = useMemo(() => {
    const periodTx = transactions.filter(t => isInPeriod(t.date.substring(0, 7)) && !isTransfer(t) && isExpense(t));
    const periodIncome = transactions.filter(t => isInPeriod(t.date.substring(0, 7)) && !isCreditCardTx(t) && isIncome(t) && isEffectivelyPaid(t) && !isTransfer(t))
      .reduce((sum, t) => sum + t.amount, 0);
    const totalSpent = periodTx.reduce((sum, t) => sum + t.amount, 0);
    return categories
      .filter(c => c.type === 'despesa' || c.type === 'expense')
      .map(c => {
        const spent = periodTx.filter(t => t.categoryId === c.id).reduce((sum, t) => sum + t.amount, 0);
        return { name: c.name, value: spent, pct: totalSpent > 0 ? (spent / totalSpent * 100) : 0, pctIncome: periodIncome > 0 ? (spent / periodIncome * 100) : 0 };
      })
      .sort((a, b) => b.value - a.value);
  }, [transactions, categories, reportPeriod, periodStart]);

  // Tendência de Gastos Acumulados (cash basis)
  const trendData = useMemo(() => {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentMonth = now.toISOString().substring(0, 7);
    const days = Array.from({length: daysInMonth}, (_, i) => i + 1);
    let cumulative = 0;
    return days.map(day => {
      const dateStr = `${currentMonth}-${day.toString().padStart(2, '0')}`;
      const dayTotal = transactions
        .filter(t => isExpense(t) && isEffectivelyPaid(t) && !isCreditCardTx(t) && !isTransfer(t) && t.date.startsWith(dateStr))
        .reduce((sum, t) => sum + t.amount, 0);
      cumulative += dayTotal;
      return { day, amount: cumulative };
    }).filter(d => d.day <= now.getDate());
  }, [transactions]);

  // Orçado x Realizado
  const budgetComparison = useMemo(() => {
    const now = new Date();
    const currentMonth = now.toISOString().substring(0, 7);
    return budgets
      .filter(b => b.period === 'monthly' || !b.period)
      .map(b => {
        const spent = transactions
          .filter(t => isExpense(t) && t.categoryId === b.categoryId && t.date.startsWith(currentMonth))
          .reduce((sum, t) => sum + t.amount, 0);
        const cat = categories.find(c => c.id === b.categoryId);
        return { name: cat?.name || b.categoryId || 'Geral', budget: b.amount, spent, diff: b.amount - spent };
      })
      .filter(b => b.budget > 0 || b.spent > 0)
      .sort((a, b) => b.spent - a.spent);
  }, [transactions, budgets, categories]);

  const formatCurrency = (value: number) => {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const totalBalance = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  const latestCashFlow = cashFlowData.length > 0 ? cashFlowData[cashFlowData.length - 1] : { Receitas: 0, Despesas: 0 };
  const currentMonthIncome = latestCashFlow.Receitas;
  const currentMonthExpense = latestCashFlow.Despesas;
  const currentMonthSavings = currentMonthIncome - currentMonthExpense;
  const savingsRate = currentMonthIncome > 0 ? (currentMonthSavings / currentMonthIncome) * 100 : 0;
  const totalIncome6m = cashFlowData.reduce((s, m) => s + m.Receitas, 0);
  const totalExpense6m = cashFlowData.reduce((s, m) => s + m.Despesas, 0);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2 text-foreground">
              <TrendingUp className="h-8 w-8 text-fiducia-blue" />
              Análise Financeira
            </h2>
            <PageHelp
              title="Relatórios"
              description="Gráficos detalhados de receitas vs despesas, evolução mensal e distribuição por categoria. Gere análises inteligentes com IA."
              items={[
                { label: "Gráficos", desc: "Acompanhe a evolução mensal, distribuição por categoria e comparativo de receitas e despesas." },
                { label: "IA Analysis", desc: "Clique em 'Análise Completa' para gerar um relatório textual com score de saúde financeira, dicas personalizadas e previsões." },
              ]}
            />
          </div>
          <p className="text-muted-foreground mt-1 text-sm font-medium">Relatórios detalhados e insights inteligentes sobre sua saúde financeira.</p>
        </div>
        <div className="flex items-center gap-2">
          <div>
            <div className="flex p-1 bg-secondary/30 rounded-xl flex-wrap gap-0.5">
              {(['today', 'week', 'month', '3months', '6months', '12months', 'year', 'custom'] as const).map(p => (
                <button key={p} onClick={() => setReportPeriod(p)}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all ${reportPeriod === p ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                  {{ today: 'Hoje', week: 'Semana', month: 'Mês', '3months': '3M', '6months': '6M', '12months': '12M', year: 'Ano', custom: 'Período' }[p]}
                </button>
              ))}
            </div>
            {reportPeriod === 'custom' && (
              <div className="flex items-center gap-2 mt-1.5">
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                  className="h-8 bg-background border border-border rounded-lg px-2 text-xs" />
                <span className="text-muted-foreground text-xs">até</span>
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                  className="h-8 bg-background border border-border rounded-lg px-2 text-xs" />
              </div>
            )}
          </div>
          <button onClick={() => setShowPending(!showPending)}
            className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border transition-all ${showPending ? 'bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-400' : 'bg-transparent border-border text-muted-foreground hover:border-muted-foreground/50'}`}>
            {showPending ? 'Incluindo Pendentes' : 'Só Realizados'}
          </button>
          <Button 
            onClick={generateAIAnalysis} 
            disabled={isLoadingAi || transactions.length < 5}
            className="bg-fiducia-blue hover:bg-fiducia-blue/90 text-white gap-2 font-semibold shadow-lg shadow-fiducia-blue/20"
        >
          {isLoadingAi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {aiInsight ? 'Renovar Análise IA' : 'Gerar Análise IA'}
          </Button>
          </div>
        </div>

        {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-none shadow-sm bg-fiducia-blue/5">
          <CardContent className="p-4">
            <p className="text-xs font-bold text-fiducia-blue uppercase tracking-wider mb-1">Patrimônio Líquido</p>
            <h3 className="text-2xl font-bold font-mono">{formatCurrency(totalBalance)}</h3>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-fiducia-green/5">
          <CardContent className="p-4">
            <p className="text-xs font-bold text-fiducia-green uppercase tracking-wider mb-1">Economia do Mês</p>
            <h3 className="text-2xl font-bold font-mono">{formatCurrency(currentMonthSavings)}</h3>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-fiducia-amber/5">
          <CardContent className="p-4">
            <p className="text-xs font-bold text-fiducia-amber uppercase tracking-wider mb-1">Taxa de Poupança</p>
            <h3 className="text-2xl font-bold font-mono">{savingsRate.toFixed(1)}%</h3>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-fiducia-red/5">
          <CardContent className="p-4">
            <p className="text-xs font-bold text-fiducia-red uppercase tracking-wider mb-1">Gastos Totais (Mês)</p>
            <h3 className="text-2xl font-bold font-mono">{formatCurrency(currentMonthExpense)}</h3>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Charts Col */}
        <div className="md:col-span-2 space-y-6">
          <Card className="bg-card border-border shadow-sm overflow-hidden">
            <CardHeader className="p-5 border-b border-border bg-secondary/5">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-fiducia-green" /> Fluxo de Caixa Mensal
              </CardTitle>
              <CardDescription>Receitas vs Despesas nos últimos 6 meses</CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              <div className="w-full">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={cashFlowData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 500 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 500 }} tickFormatter={(value) => `R$${value}`} />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                    <Legend iconType="circle" />
                    <Bar dataKey="Receitas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border shadow-sm overflow-hidden">
            <CardHeader className="p-5 border-b border-border bg-secondary/5">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-fiducia-blue" /> Tendência de Gastos
              </CardTitle>
              <CardDescription>Evolução cumulativa das despesas no mês atual</CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              <div className="w-full">
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 500 }} tickFormatter={(val) => `Dia ${val}`} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 500 }} tickFormatter={(value) => `R$${value}`} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Area type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorAmt)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Info Col */}
        <div className="space-y-6">
          {/* AI Insights Card */}
          <Card className="bg-gradient-to-br from-fiducia-blue/10 to-fiducia-blue/5 border-fiducia-blue/20 shadow-md">
            <CardHeader className="p-4 border-b border-fiducia-blue/20">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-fiducia-blue">
                <Sparkles className="h-4 w-4" /> Insight Inteligente
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {aiInsight ? (
                <div className="prose prose-sm dark:prose-invert text-[13px] leading-relaxed">
                  <div dangerouslySetInnerHTML={{
                    __html: aiInsight
                      .replace(/&/g, '&amp;')
                      .replace(/</g, '&lt;')
                      .replace(/>/g, '&gt;')
                      .replace(/"/g, '&quot;')
                      .replace(/\n/g, '<br/>')
                  }} />
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-white/50 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
                    <Sparkles className="h-6 w-6 text-fiducia-blue animate-pulse" />
                  </div>
                  <p className="text-xs font-semibold text-fiducia-blue">Pense com a Fiducia AI</p>
                  <p className="text-[11px] text-muted-foreground mt-2 px-4 italic leading-tight">
                    Receba dicas personalizadas baseadas no seu comportamento de gastos recente.
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={generateAIAnalysis}
                    className="mt-4 text-xs font-bold border-fiducia-blue bg-white hover:bg-fiducia-blue/10 text-fiducia-blue"
                  >
                    Gerar agora
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gastos por Categoria */}
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="p-4 border-b border-border">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Target className="h-4 w-4 text-fiducia-amber" /> Gastos por Categoria
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {categoryData.length > 0 ? (
                <div className="space-y-1 max-h-[400px] overflow-y-auto">
                  <div className="grid grid-cols-12 text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 pb-2 border-b border-border">
                    <span className="col-span-4">Categoria</span>
                    <span className="col-span-3 text-right">Valor</span>
                    <span className="col-span-3 text-right">% Gastos</span>
                    <span className="col-span-2 text-right">% Renda</span>
                  </div>
                  {categoryData.map((item, i) => {
                    const barW = Math.min(item.pct, 100);
                    return (
                      <div key={item.name} className="grid grid-cols-12 text-xs px-2 py-1.5 rounded-lg hover:bg-muted/30 items-center">
                        <span className="col-span-4 truncate font-medium flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          {item.name}
                        </span>
                        <span className="col-span-3 text-right font-mono">{item.value > 0 ? formatCurrency(item.value) : '—'}</span>
                        <span className="col-span-3 text-right">
                          <span className="font-mono text-muted-foreground">{item.pct.toFixed(1)}%</span>
                          <div className="mt-0.5 h-1 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${barW}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                          </div>
                        </span>
                        <span className="col-span-2 text-right font-mono text-muted-foreground">{item.value > 0 ? item.pctIncome.toFixed(1) + '%' : '—'}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-[11px] text-muted-foreground italic">Nenhum gasto no período.</div>
              )}
            </CardContent>
          </Card>

          {/* Projeção de Caixa */}
          {showPending && projectionData.length > 0 && (
            <Card className="bg-card border-border shadow-sm">
              <CardHeader className="p-4 border-b border-border">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4 text-fiducia-blue" /> Projeção de Caixa (6 meses)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-1 max-h-[320px] overflow-y-auto">
                  <div className="grid grid-cols-10 text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 pb-2 border-b border-border">
                    <span className="col-span-2">Mês</span>
                    <span className="col-span-2 text-right">Receitas</span>
                    <span className="col-span-2 text-right">Despesas</span>
                    <span className="col-span-2 text-right">Saldo</span>
                    <span className="col-span-2 text-right">Acumulado</span>
                  </div>
                  {projectionData.map(p => (
                    <div key={p.month} className="grid grid-cols-10 text-xs px-2 py-1.5 rounded-lg hover:bg-muted/30 items-center">
                      <span className="col-span-2 truncate font-medium capitalize">{p.label}</span>
                      <span className="col-span-2 text-right font-mono text-fiducia-green">+{formatCurrency(p.income)}</span>
                      <span className="col-span-2 text-right font-mono text-fiducia-red">-{formatCurrency(p.expense + p.invoiceExp)}</span>
                      <span className={`col-span-2 text-right font-mono font-bold ${p.net >= 0 ? 'text-fiducia-green' : 'text-fiducia-red'}`}>
                        {p.net >= 0 ? '+' : ''}{formatCurrency(p.net)}
                      </span>
                      <span className={`col-span-2 text-right font-mono font-bold ${p.accum >= 0 ? 'text-fiducia-blue' : 'text-fiducia-red'}`}>
                        {formatCurrency(p.accum)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Orçado x Realizado */}
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="p-4 border-b border-border">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Target className="h-4 w-4 text-fiducia-amber" /> Orçado x Realizado
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {budgetComparison.length > 0 ? (
                <div className="space-y-2 max-h-[260px] overflow-y-auto">
                  <div className="grid grid-cols-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2">
                    <span>Categoria</span>
                    <span className="text-right">Orçado</span>
                    <span className="text-right">Gasto</span>
                    <span className="text-right">Diferença</span>
                  </div>
                  {budgetComparison.slice(0, 8).map(b => {
                    const perc = b.budget > 0 ? Math.round((b.spent / b.budget) * 100) : 0;
                    return (
                      <div key={b.name} className="grid grid-cols-4 text-xs px-2 py-1.5 rounded-lg bg-muted/30">
                        <span className="truncate font-medium">{b.name}</span>
                        <span className="text-right text-muted-foreground">{formatCurrency(b.budget)}</span>
                        <span className={`text-right font-mono font-bold ${perc > 90 ? 'text-fiducia-red' : 'text-muted-foreground'}`}>{formatCurrency(b.spent)}</span>
                        <span className={`text-right font-mono font-bold ${b.diff < 0 ? 'text-fiducia-red' : b.diff > 0 ? 'text-fiducia-green' : 'text-muted-foreground'}`}>
                          {b.diff >= 0 ? '+' : ''}{formatCurrency(b.diff)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground italic text-center py-6">Configure orçamentos para ver a comparação.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

