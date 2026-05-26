import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid, AreaChart, Area 
} from 'recharts';
import { FileText, Sparkles, TrendingUp, TrendingDown, Wallet, Target, AlertCircle, Loader2 } from 'lucide-react';

import { resolveAccountName } from '../lib/utils';
import { callGroq } from '../services/groqService';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6'];

export function Reports() {
  const { user, isAuthReady } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [aiInsight, setAiInsight] = useState<string>('');
  const [isLoadingAi, setIsLoadingAi] = useState<boolean>(false);

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

    return () => {
      unsubscribeTransactions();
      unsubscribeCategories();
      unsubscribeAccounts();
      unsubscribeBudgets();
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

      const monthlySummary = monthlyData.slice(-3);

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
      setAiInsight('Ocorreu um erro ao gerar a análise automática. Verifique sua conexão ou tente novamente mais tarde.');
    } finally {
      setIsLoadingAi(false);
    }
  };

  // Prepare data for Monthly Income vs Expense chart
  const monthlyData = useMemo(() => {
    const last6Months = Array.from({length: 6}, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - 5 + i);
      return { 
        month: d.toISOString().substring(0, 7), 
        label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') 
      };
    });
    
    return last6Months.map(m => {
      const monthTx = transactions.filter(t => t.date.startsWith(m.month));
      return {
        name: m.label.charAt(0).toUpperCase() + m.label.slice(1),
        Receitas: monthTx.filter(t => t.type === 'receita' || t.type === 'income').reduce((sum, t) => sum + t.amount, 0),
        Despesas: monthTx.filter(t => t.type === 'despesa' || t.type === 'expense').reduce((sum, t) => sum + t.amount, 0),
      };
    });
  }, [transactions]);

  // Category data for current month
  const categoryData = useMemo(() => {
    const now = new Date();
    const currentMonth = now.toISOString().substring(0, 7);
    const currentMonthExpenses = transactions.filter(t => (t.type === 'despesa' || t.type === 'expense') && t.date.startsWith(currentMonth));
    
    return categories
      .filter(c => c.type === 'despesa' || c.type === 'expense')
      .map(c => {
        const spent = currentMonthExpenses.filter(t => t.categoryId === c.id).reduce((sum, t) => sum + t.amount, 0);
        return { name: c.name, value: spent };
      })
      .filter(c => c.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [transactions, categories]);

  // Accumulative Spending Trend
  const trendData = useMemo(() => {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentMonth = now.toISOString().substring(0, 7);
    
    const days = Array.from({length: daysInMonth}, (_, i) => i + 1);
    let cumulative = 0;
    
    return days.map(day => {
      const dateStr = `${currentMonth}-${day.toString().padStart(2, '0')}`;
      const dayTotal = transactions
        .filter(t => (t.type === 'despesa' || t.type === 'expense') && t.date.startsWith(dateStr))
        .reduce((sum, t) => sum + t.amount, 0);
      cumulative += dayTotal;
      return { day, amount: cumulative };
    }).filter(d => d.day <= now.getDate());
  }, [transactions]);

  const formatCurrency = (value: number) => {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const totalBalance = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  const currentMonthIncome = monthlyData[monthlyData.length - 1]?.Receitas || 0;
  const currentMonthExpense = monthlyData[monthlyData.length - 1]?.Despesas || 0;
  const currentMonthSavings = currentMonthIncome - currentMonthExpense;
  const savingsRate = currentMonthIncome > 0 ? (currentMonthSavings / currentMonthIncome) * 100 : 0;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2 text-foreground">
            <TrendingUp className="h-8 w-8 text-fiducia-blue" />
            Análise Financeira
          </h2>
          <p className="text-muted-foreground mt-1 text-sm font-medium">Relatórios detalhados e insights inteligentes sobre sua saúde financeira.</p>
        </div>
        <Button 
          onClick={generateAIAnalysis} 
          disabled={isLoadingAi || transactions.length < 5}
          className="bg-fiducia-blue hover:bg-fiducia-blue/90 text-white gap-2 font-semibold shadow-lg shadow-fiducia-blue/20"
        >
          {isLoadingAi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {aiInsight ? 'Renovar Análise IA' : 'Gerar Análise IA'}
        </Button>
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
                  <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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
                  <div dangerouslySetInnerHTML={{ __html: aiInsight.replace(/\n/g, '<br/>') }} />
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

          {/* Category Breakdown */}
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="p-4 border-b border-border">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Target className="h-4 w-4 text-fiducia-amber" /> Gastos por Categoria
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="w-full" style={{ minHeight: 220 }}>
                {categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground bg-secondary/20 rounded-lg italic">
                    Dados insuficientes para este mês.
                  </div>
                )}
              </div>
              <div className="mt-4 space-y-2">
                {categoryData.slice(0, 5).map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between text-xs font-medium">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="text-muted-foreground truncate max-w-[100px]">{item.name}</span>
                    </div>
                    <span className="font-mono">{formatCurrency(item.value)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Budget Health */}
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="p-4 border-b border-border">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-fiducia-red" /> Alertas de Orçamento
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-4">
                {budgets.length > 0 ? budgets.slice(0, 3).map(b => {
                  const cat = categories.find(c => c.id === b.categoryId);
                  const spent = transactions
                    .filter(t => t.categoryId === b.categoryId && (t.type === 'despesa' || t.type === 'expense'))
                    .reduce((sum, t) => sum + t.amount, 0);
                  const perc = Math.round((spent / b.amount) * 100);
                  return (
                    <div key={b.id} className="space-y-1">
                      <div className="flex justify-between text-[11px] font-bold uppercase tracking-tight">
                        <span className="text-muted-foreground">{cat?.name || 'Geral'}</span>
                        <span className={perc > 90 ? 'text-fiducia-red' : 'text-foreground'}>{perc}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${perc > 100 ? 'bg-fiducia-red' : perc > 80 ? 'bg-fiducia-amber' : 'bg-fiducia-blue'}`}
                          style={{ width: `${Math.min(100, perc)}%` }}
                        />
                      </div>
                    </div>
                  );
                }) : (
                  <p className="text-[11px] text-muted-foreground italic text-center py-4">Configure orçamentos para acompanhar metas.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

