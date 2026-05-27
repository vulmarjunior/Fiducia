import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Wallet, CreditCard, Eye, EyeOff, Plus, ArrowUpRight, ArrowDownRight, ArrowRightLeft, FileText, Calendar, HelpCircle, Sparkles, Loader2, ChevronDown, ChevronUp, ShieldCheck, ShieldAlert, Info } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid } from 'recharts';
import { getCategoryIcon } from '../lib/categoryIcons';
import { calculateInvoicePeriod, getPreviousPeriod, resolveAccountName } from '../lib/utils';
import { callGroq } from '../services/groqService';
import { toast } from 'sonner';
 
export function Dashboard() {
  const { user, isAuthReady } = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [creditCards, setCreditCards] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [showValues, setShowValues] = useState(true);
  const [aiTip, setAiTip] = useState<string>('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<'week' | 'month' | 'year'>('month');
  const [extraSectionsOpen, setExtraSectionsOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const accountsQuery = query(collection(db, 'accounts'), where('userId', '==', user.uid));
    const unsubscribeAccounts = onSnapshot(accountsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAccounts(data);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'accounts'));

    const cardsQuery = query(collection(db, 'creditCards'), where('userId', '==', user.uid));
    const unsubscribeCards = onSnapshot(cardsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCreditCards(data);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'creditCards'));

    const transactionsQuery = query(
      collection(db, 'transactions'), 
      where('userId', '==', user.uid)
    );
    
    const unsubscribeTransactions = onSnapshot(transactionsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(data);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'transactions'));

    const budgetsQuery = query(collection(db, 'budgets'), where('userId', '==', user.uid));
    const unsubscribeBudgets = onSnapshot(budgetsQuery, (snapshot) => {
      setBudgets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'budgets'));

    const categoriesQuery = query(collection(db, 'categories'), where('userId', '==', user.uid));
    const unsubscribeCategories = onSnapshot(categoriesQuery, (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'categories'));

    const goalsQuery = query(collection(db, 'goals'), where('userId', '==', user.uid));
    const unsubscribeGoals = onSnapshot(goalsQuery, (snapshot) => {
      setGoals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'goals'));

    return () => {
      unsubscribeAccounts();
      unsubscribeCards();
      unsubscribeTransactions();
      unsubscribeBudgets();
      unsubscribeCategories();
      unsubscribeGoals();
    };
  }, [user, isAuthReady]);

  const fetchAiTip = async () => {
    if (!user || transactions.length < 5 || isLoadingAi) return;
    setIsLoadingAi(true);
    try {
      const prevMonthStr = getPreviousPeriod(currentMonthStr);

      const monthExpenses = transactions.filter(t => (t.type === 'despesa' || t.type === 'expense') && t.date.startsWith(currentMonthStr));
      const monthIncome = transactions.filter(t => (t.type === 'receita' || t.type === 'income') && t.date.startsWith(currentMonthStr));
      const prevExpenses = transactions.filter(t => (t.type === 'despesa' || t.type === 'expense') && t.date.startsWith(prevMonthStr));
      const prevIncome = transactions.filter(t => (t.type === 'receita' || t.type === 'income') && t.date.startsWith(prevMonthStr));

      const totalExpense = monthExpenses.reduce((sum, t) => sum + t.amount, 0);
      const totalIncome = monthIncome.reduce((sum, t) => sum + t.amount, 0);
      const prevExpenseTotal = prevExpenses.reduce((sum, t) => sum + t.amount, 0);
      const prevIncomeTotal = prevIncome.reduce((sum, t) => sum + t.amount, 0);

      const topCategories = monthExpenses.reduce<Record<string, number>>((acc, t) => {
        const catName = categories.find(c => c.id === t.categoryId)?.name || 'Geral';
        acc[catName] = (acc[catName] || 0) + t.amount;
        return acc;
      }, {});
      const sortedCategories = Object.entries(topCategories)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, amount]) => `${name}: R$ ${amount.toFixed(2)}`)
        .join('\n');

      const expenseTrend = prevExpenseTotal > 0 ? ((totalExpense - prevExpenseTotal) / prevExpenseTotal * 100).toFixed(0) : null;
      const incomeTrend = prevIncomeTotal > 0 ? ((totalIncome - prevIncomeTotal) / prevIncomeTotal * 100).toFixed(0) : null;

      const invoiceAlerts = creditCards.map(card => {
        const cardExpenses = transactions.filter(t =>
          t.creditCardId === card.id && t.invoicePeriod === currentMonthStr && (t.type === 'despesa' || t.type === 'expense')
        );
        const total = cardExpenses.reduce((s, t) => s + t.amount, 0);
        const usagePct = card.limit > 0 ? (total / card.limit * 100).toFixed(0) : '0';
        return `${card.name}: R$ ${total.toFixed(2)} (${usagePct}% do limite)`;
      }).join('\n');

      const totalBalance = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);

      const prompt = `Você é o assistente financeiro Fiducia. Analise os dados abaixo e gere 2 alertas curtos (máximo 80 caracteres cada, bullet points) em Português.

Mês atual: ${currentMonthStr}
Receitas: R$ ${totalIncome.toFixed(2)}
Despesas: R$ ${totalExpense.toFixed(2)}
Saldo total: R$ ${totalBalance.toFixed(2)}
${expenseTrend ? `Tendência despesas: ${expenseTrend}% vs mês anterior` : ''}
${incomeTrend ? `Tendência receitas: ${incomeTrend}% vs mês anterior` : ''}

Top 3 categorias de gasto:
${sortedCategories || 'Nenhuma'}

Faturas de cartão:
${invoiceAlerts || 'Nenhuma'}

Regras:
- Se houver alerta relevante (gasto alto, tendência preocupante, fatura perto do limite), destaque-o
- Se estiver tudo sob controle, seja motivador
- Responda APENAS com os 2 bullets, um por linha, sem introdução`;

      const tip = await callGroq([{ role: "user", content: prompt }], { maxTokens: 300 });
      setAiTip(tip);
    } catch (error) {
      console.error("Dashboard AI Tip error:", error);
      toast.error('Não foi possível carregar a dica financeira.');
    } finally {
      setIsLoadingAi(false);
    }
  };

  useEffect(() => {
    if (transactions.length >= 1 && !aiTip) {
      fetchAiTip();
    }
  }, [transactions.length]);

  const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
  
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  const currentDateStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
  
  const currentMonthTransactions = transactions.filter(t => {
    if (t.creditCardId || t.accountId && creditCards.some(c => c.id === t.accountId)) {
      return t.invoicePeriod === currentMonthStr;
    }
    return t.date.split('T')[0].startsWith(currentMonthStr);
  });
  
  const isEffectivelyPaid = (t: any) => t.status === 'pago' || t.status === 'realizado' || t.status === 'paid';
  
  const monthlyIncome = currentMonthTransactions.filter(t => (t.type === 'receita' || t.type === 'income') && isEffectivelyPaid(t)).reduce((sum, t) => sum + t.amount, 0);
  const monthlyExpense = currentMonthTransactions.filter(t => (t.type === 'despesa' || t.type === 'expense') && isEffectivelyPaid(t)).reduce((sum, t) => sum + t.amount, 0);
  const monthlyBalance = monthlyIncome - monthlyExpense;

  // Disponível Seguro calculation
  const saldoCirculante = accounts
    .filter(a => !a.excludeFromCashFlow)
    .reduce((sum, a) => sum + (a.balance || 0), 0);
  const hasExcludedAccounts = accounts.some(a => a.excludeFromCashFlow);
  const excludedCount = accounts.filter(a => a.excludeFromCashFlow).length;
  const circulatingCount = accounts.filter(a => !a.excludeFromCashFlow).length;

  const gastosCartao = transactions
    .filter(t => t.creditCardId || creditCards.some(c => c.id === t.accountId))
    .reduce((sum, t) => sum + t.amount, 0);

  const contasPendentes = transactions
    .filter(t =>
      !t.creditCardId &&
      !creditCards.some(c => c.id === t.accountId) &&
      (t.type === 'despesa' || t.type === 'expense') &&
      (t.status === 'pendente' || t.status === 'pending') &&
      t.date.split('T')[0] <= currentDateStr
    )
    .reduce((sum, t) => sum + t.amount, 0);

  const disponivelSeguro = saldoCirculante - gastosCartao - contasPendentes;
  const isPositive = disponivelSeguro >= 0;

  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const prevMonthStr = getPreviousPeriod(currentMonthStr);
  const prevMonthTransactions = transactions.filter(t => {
    if (t.creditCardId || t.accountId && creditCards.some(c => c.id === t.accountId)) {
      return t.invoicePeriod === prevMonthStr;
    }
    return t.date.startsWith(prevMonthStr);
  });
  const prevIncome = prevMonthTransactions.filter(t => (t.type === 'receita' || t.type === 'income') && isEffectivelyPaid(t)).reduce((sum, t) => sum + t.amount, 0);
  const prevExpense = prevMonthTransactions.filter(t => (t.type === 'despesa' || t.type === 'expense') && isEffectivelyPaid(t)).reduce((sum, t) => sum + t.amount, 0);
  const incomeTrendPct = prevIncome > 0 ? ((monthlyIncome - prevIncome) / prevIncome * 100).toFixed(1) : null;
  const expenseTrendPct = prevExpense > 0 ? ((monthlyExpense - prevExpense) / prevExpense * 100).toFixed(1) : null;

  const isExpenseType = (t: any) => t.type === 'despesa' || t.type === 'expense';
  const isIncomeType = (t: any) => t.type === 'receita' || t.type === 'income';
  const isPendingStatus = (t: any) => t.status === 'pendente' || t.status === 'pending' || !t.status;

  const overdueExpenses = transactions.filter(t => {
    const d = t.date.split('T')[0];
    return isExpenseType(t) && isPendingStatus(t) && d < currentDateStr && d >= thirtyDaysAgo;
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const upcomingExpenses = transactions.filter(t => {
    const d = t.date.split('T')[0];
    return isExpenseType(t) && isPendingStatus(t) && d >= currentDateStr && d <= thirtyDaysFromNow;
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 5);

  const overdueIncomes = transactions.filter(t => {
    const d = t.date.split('T')[0];
    return isIncomeType(t) && isPendingStatus(t) && d < currentDateStr && d >= thirtyDaysAgo;
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const upcomingIncomes = transactions.filter(t => {
    const d = t.date.split('T')[0];
    return isIncomeType(t) && isPendingStatus(t) && d >= currentDateStr && d <= thirtyDaysFromNow;
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 5);

  const totalPendingPay = [
    ...overdueExpenses, 
    ...transactions.filter(t => isExpenseType(t) && isPendingStatus(t) && t.date.split('T')[0] >= currentDateStr && t.date.split('T')[0] <= thirtyDaysFromNow)
  ].reduce((sum, t) => sum + t.amount, 0);

  // Calculate unpaid credit card invoices
  const unpaidInvoices = creditCards.flatMap(card => {
    const currentPeriod = calculateInvoicePeriod(new Date(), card.closingDay, card.dueDay);
    const previousPeriod = getPreviousPeriod(currentPeriod);
    
    // Check if an invoice is closed
    const isClosed = (period: string) => {
      const [year, month] = period.split('-').map(Number);
      // The period month is the DUE month.
      // If dueDay <= closingDay, it closed in the PREVIOUS month.
      let closingMonth = month - 1;
      let closingYear = year;
      if (card.dueDay <= card.closingDay) {
        closingMonth -= 1;
        if (closingMonth < 0) { closingMonth = 11; closingYear--; }
      }
      const actualClosingDate = new Date(closingYear, closingMonth, card.closingDay);
      return new Date() >= actualClosingDate;
    };

    return [previousPeriod, currentPeriod].map(period => {
      // Only show if closed
      if (!isClosed(period)) return null;

      const periodTx = transactions.filter(t => 
        (t.accountId === card.id || t.destinationAccountId === card.id) && 
        t.invoicePeriod === period
      );
      
      const expenses = periodTx.filter(t => t.type === 'expense' || t.type === 'despesa').reduce((acc, t) => acc + t.amount, 0);
      const payments = periodTx.filter(t => (t.type === 'transfer' || t.type === 'transferencia') && t.destinationAccountId === card.id).reduce((acc, t) => acc + t.amount, 0);
      const incomes = periodTx.filter(t => (t.type === 'income' || t.type === 'receita') && t.accountId === card.id).reduce((acc, t) => acc + t.amount, 0);
      
      const balance = expenses - payments - incomes;
      
      if (balance > 0.01) {
        const [pYear, pMonth] = period.split('-').map(Number);
        const dueDate = new Date(pYear, pMonth - 1, card.dueDay);
        const periodName = new Date(pYear, pMonth - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        
        return {
          id: `invoice-${card.id}-${period}`,
          description: `Fatura ${card.name} - ${periodName}`,
          amount: balance,
          date: dueDate.toISOString(),
          type: 'despesa',
          status: new Date() > dueDate ? 'atrasado' : 'pendente',
          isInvoice: true
        };
      }
      return null;
    });
  }).flat().filter(Boolean) as any[];

  const allPendingExpenses = [
    ...overdueExpenses,
    ...transactions.filter(t => isExpenseType(t) && isPendingStatus(t) && t.date.split('T')[0] >= currentDateStr && t.date.split('T')[0] <= thirtyDaysFromNow),
    ...unpaidInvoices
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const totalPendingPayWithInvoices = allPendingExpenses.reduce((sum, t) => sum + t.amount, 0);
  const upcomingExpensesWithInvoices = allPendingExpenses.filter(t => t.date.split('T')[0] >= currentDateStr).slice(0, 5);
  const overdueExpensesWithInvoices = allPendingExpenses.filter(t => t.date.split('T')[0] < currentDateStr);

  const totalPendingReceive = [...overdueIncomes, ...transactions.filter(t => isIncomeType(t) && isPendingStatus(t) && t.date.split('T')[0] >= currentDateStr && t.date.split('T')[0] <= thirtyDaysFromNow)].reduce((sum, t) => sum + t.amount, 0);

  const formatShortDate = (dateStr: string) => {
    const datePart = dateStr.split('T')[0];
    const [year, month, day] = datePart.split('-');
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
  };

  const formatFullDate = (dateStr: string) => {
    const datePart = dateStr.split('T')[0];
    const [year, month, day] = datePart.split('-');
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return date.toLocaleDateString('pt-BR');
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const greetingEmoji = hour < 12 ? '☀️' : hour < 18 ? '🌤️' : '🌙';

  const formatCurrency = (value: number) => {
    if (!showValues) return 'R$ •••••';
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getChartPeriods = () => {
    if (periodFilter === 'week') {
      return Array.from({length: 8}, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (7 * (7 - i)));
        const weekStart = new Date(d);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
        const month = weekStart.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
        const day = weekStart.getDate();
        return { label: `${day} ${month}`, start: weekStart };
      });
    } else if (periodFilter === 'year') {
      return Array.from({length: 12}, (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - 11 + i);
        return { 
          month: d.toISOString().substring(0, 7), 
          label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
        };
      });
    }
    return Array.from({length: 6}, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - 5 + i);
      return { 
        month: d.toISOString().substring(0, 7), 
        label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') 
      };
    });
  };

  const chartPeriods = getChartPeriods();

  const chartData = chartPeriods.map(p => {
    if (periodFilter === 'week') {
      const weekEnd = new Date(p.start);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const weekTx = transactions.filter(t => {
        const td = new Date(t.date.split('T')[0]);
        return td >= p.start && td < weekEnd;
      });
      return {
        name: p.label.charAt(0).toUpperCase() + p.label.slice(1),
        income: weekTx.filter(t => isIncomeType(t) && isEffectivelyPaid(t)).reduce((sum, t) => sum + t.amount, 0),
        expense: weekTx.filter(t => isExpenseType(t) && isEffectivelyPaid(t)).reduce((sum, t) => sum + t.amount, 0),
      };
    }
    const mTx = transactions.filter(t => {
      if (t.creditCardId || t.accountId && creditCards.some(c => c.id === t.accountId)) {
        return t.invoicePeriod === p.month;
      }
      return t.date.startsWith(p.month);
    });
    return {
      name: p.label.charAt(0).toUpperCase() + p.label.slice(1),
      income: mTx.filter(t => isIncomeType(t) && isEffectivelyPaid(t)).reduce((sum, t) => sum + t.amount, 0),
      expense: mTx.filter(t => isExpenseType(t) && isEffectivelyPaid(t)).reduce((sum, t) => sum + t.amount, 0),
    };
  });

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="text-[13px] text-muted-foreground font-medium mb-1 flex items-center gap-2">
            {greetingEmoji} {greeting}, {user?.displayName?.split(' ')[0] || 'Usuário'}
            {isLoadingAi && !aiTip && <Loader2 className="w-3 h-3 animate-spin text-fiducia-blue" />}
          </div>
          <div className="text-[28px] font-bold tracking-tight text-foreground">Visão Geral</div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button 
            onClick={() => setShowValues(!showValues)}
            className="p-2 rounded-lg border border-border bg-card hover:bg-secondary transition-colors text-muted-foreground"
            title={showValues ? "Ocultar valores" : "Mostrar valores"}
          >
            {showValues ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <div className="inline-flex bg-secondary/50 border border-border rounded-xl p-1 gap-1">
            {(['week', 'month', 'year'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriodFilter(p)}
                className={`px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${periodFilter === p ? 'bg-white dark:bg-primary shadow-sm text-foreground dark:text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {p === 'week' ? 'Sem.' : p === 'month' ? 'Mês' : 'Ano'}
              </button>
            ))}
          </div>
          <Button nativeButton={false} className="h-10 px-4 text-sm font-semibold rounded-xl gap-2 bg-primary text-primary-foreground hover:opacity-90 transition-opacity" render={<Link to="/transactions" />}>
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Novo lançamento</span>
          </Button>
        </div>
      </div>

      {/* AI Tip Card */}
      {(aiTip || isLoadingAi) && (
        <div className="bg-gradient-to-br from-fiducia-blue/5 via-transparent to-emerald-500/5 border border-border/60 rounded-2xl p-4 mb-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 via-cyan-400 to-blue-500 flex items-center justify-center shrink-0 mt-0.5">
              {isLoadingAi ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Sparkles className="w-4 h-4 text-white" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                Dica Fiducia IA
              </div>
              <div className="text-sm text-foreground leading-relaxed">
                {aiTip || 'Analisando seus dados...'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Saldo Total */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-fiducia-blue/10 text-fiducia-blue flex items-center justify-center group-hover:scale-110 transition-transform">
              <Wallet className="w-5 h-5" />
            </div>
            <div className="text-[11px] font-bold text-fiducia-blue bg-fiducia-blue/10 px-2 py-1 rounded-full">
              Ativo
            </div>
          </div>
          <div className="text-[13px] text-muted-foreground font-medium mb-1">Saldo Geral</div>
          <div className="text-[24px] font-bold tracking-tight font-mono text-foreground">{formatCurrency(totalBalance)}</div>
        </div>

        {/* Receitas */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-fiducia-green/10 text-fiducia-green flex items-center justify-center group-hover:scale-110 transition-transform">
              <ArrowUpRight className="w-5 h-5" />
            </div>
            <div className={`text-[11px] font-bold ${incomeTrendPct && Number(incomeTrendPct) >= 0 ? 'text-fiducia-green' : 'text-fiducia-red'} ${incomeTrendPct ? 'bg-secondary/10' : 'bg-muted/30'} px-2 py-1 rounded-full`}>
              {incomeTrendPct ? `${Number(incomeTrendPct) >= 0 ? '+' : ''}${incomeTrendPct}%` : '—'}
            </div>
          </div>
          <div className="text-[13px] text-muted-foreground font-medium mb-1">Receitas do mês</div>
          <div className="text-[24px] font-bold tracking-tight font-mono text-foreground">{formatCurrency(monthlyIncome)}</div>
        </div>

        {/* Despesas */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-fiducia-red/10 text-fiducia-red flex items-center justify-center group-hover:scale-110 transition-transform">
              <ArrowDownRight className="w-5 h-5" />
            </div>
            <div className={`text-[11px] font-bold ${expenseTrendPct && Number(expenseTrendPct) > 0 ? 'text-fiducia-red' : 'text-fiducia-green'} ${expenseTrendPct ? 'bg-secondary/10' : 'bg-muted/30'} px-2 py-1 rounded-full`}>
              {expenseTrendPct ? `${Number(expenseTrendPct) > 0 ? '+' : ''}${expenseTrendPct}%` : '—'}
            </div>
          </div>
          <div className="text-[13px] text-muted-foreground font-medium mb-1">Despesas do mês</div>
          <div className="text-[24px] font-bold tracking-tight font-mono text-foreground">{formatCurrency(monthlyExpense)}</div>
        </div>

        {/* Disponível Seguro */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow group">
          <div className="flex items-center justify-between mb-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform ${isPositive ? 'bg-fiducia-purple/10 text-fiducia-purple' : 'bg-fiducia-red/10 text-fiducia-red'}`}>
              {isPositive ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
            </div>
            <div className="relative group/tip">
              <Info className="w-4 h-4 text-muted-foreground cursor-help" />
              <div className="absolute right-0 top-6 w-64 p-3 bg-popover border border-border rounded-xl shadow-lg text-[11px] text-popover-foreground leading-relaxed opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all z-10">
                <strong className="block mb-1">Disponível Seguro</strong>
                = (Saldo Circulante) − (Gastos de Cartão) − (Contas Pendentes)
                <br /><br />
                Mostra quanto dinheiro livre você tem hoje depois de pagar todas as faturas de cartão e contas pendentes do mês.
                {hasExcludedAccounts && <><br /><br />Contas marcadas como reserva/investimento são ignoradas deste cálculo.</>}
              </div>
            </div>
          </div>
          <div className="text-[13px] text-muted-foreground font-medium mb-1">Disponível Seguro</div>
          <div className={`text-[24px] font-bold tracking-tight font-mono ${isPositive ? 'text-fiducia-purple' : 'text-fiducia-red'}`}>
            {formatCurrency(disponivelSeguro)}
          </div>
          <div className="mt-3 pt-3 border-t border-border space-y-1.5">
            <div className="flex items-center justify-between text-[12px]">
              <span className="flex items-center gap-1.5 text-fiducia-green">
                <span className="w-2 h-2 rounded-full bg-fiducia-green shrink-0" />
                Saldo Circulante
              </span>
              <span className="font-mono font-semibold text-fiducia-green">+{formatCurrency(saldoCirculante)}</span>
            </div>
            {gastosCartao > 0 && (
              <div className="flex items-center justify-between text-[12px]">
                <span className="flex items-center gap-1.5 text-fiducia-red">
                  <span className="w-2 h-2 rounded-full bg-fiducia-red shrink-0" />
                  Gastos de Cartão
                </span>
                <span className="font-mono font-semibold text-fiducia-red">-{formatCurrency(gastosCartao)}</span>
              </div>
            )}
            {contasPendentes > 0 && (
              <div className="flex items-center justify-between text-[12px]">
                <span className="flex items-center gap-1.5 text-fiducia-amber">
                  <span className="w-2 h-2 rounded-full bg-fiducia-amber shrink-0" />
                  Contas Pendentes
                </span>
                <span className="font-mono font-semibold text-fiducia-amber">-{formatCurrency(contasPendentes)}</span>
              </div>
            )}
            {gastosCartao === 0 && contasPendentes === 0 && (
              <div className="text-[11px] text-muted-foreground italic">Nenhum compromisso pendente</div>
            )}
          </div>
          <div className={`mt-3 pt-2 border-t border-border text-[11px] font-semibold ${isPositive ? 'text-fiducia-purple' : 'text-fiducia-red'}`}>
            {isPositive
              ? '✅ Folga financeira — você tem margem depois de todas as contas.'
              : '⚠️ Atenção — o saldo circulante não cobre todos os compromissos.'}
          </div>
          {hasExcludedAccounts && (
            <div className="mt-2 text-[10px] text-muted-foreground">
              {circulatingCount} conta{circulatingCount !== 1 ? 's' : ''} em circulação · {excludedCount} reserva{excludedCount !== 1 ? 's' : ''} ignorada{excludedCount !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {/* CONTENT GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
        {/* LEFT COL */}
        <div className="flex flex-col gap-6">
           {/* Chart Card */}
           <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
             <div className="flex items-center justify-between p-5 border-b border-border">
               <div>
                 <h3 className="text-[15px] font-bold text-foreground">Fluxo de Caixa</h3>
                 <p className="text-[12px] text-muted-foreground">Comparativo de receitas e despesas</p>
               </div>
               <div className="flex items-center gap-4">
                 <div className="flex items-center gap-4">
                   <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                     <div className="w-2.5 h-2.5 rounded-full bg-fiducia-green"></div>
                     Receitas
                   </div>
                   <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                     <div className="w-2.5 h-2.5 rounded-full bg-fiducia-red"></div>
                     Despesas
                   </div>
                 </div>
                 <Button variant="ghost" size="sm" className="text-[12px] text-fiducia-blue font-bold hover:bg-fiducia-blue/5">
                   Relatório Completo
                 </Button>
               </div>
             </div>
              <div className="p-5">
                <ResponsiveContainer width="100%" height={280}>
                 <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                   <defs>
                     <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="5%" stopColor="var(--fiducia-green)" stopOpacity={0.1}/>
                       <stop offset="95%" stopColor="var(--fiducia-green)" stopOpacity={0}/>
                     </linearGradient>
                     <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="5%" stopColor="var(--fiducia-red)" stopOpacity={0.1}/>
                       <stop offset="95%" stopColor="var(--fiducia-red)" stopOpacity={0}/>
                     </linearGradient>
                   </defs>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.5} />
                   <XAxis 
                     dataKey="name" 
                     axisLine={false} 
                     tickLine={false} 
                     tick={{ fontSize: 11, fontWeight: 500, fill: 'var(--text-muted)' }} 
                     dy={10} 
                   />
                   <Tooltip 
                     contentStyle={{ 
                       borderRadius: '12px', 
                       border: '1px solid var(--border-color)', 
                       fontSize: '12px',
                       boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                       backgroundColor: 'var(--card)'
                     }} 
                   />
                   <Area 
                     type="monotone" 
                     dataKey="income" 
                     stroke="var(--fiducia-green)" 
                     strokeWidth={2}
                     fillOpacity={1} 
                     fill="url(#colorIncome)" 
                   />
                   <Area 
                     type="monotone" 
                     dataKey="expense" 
                     stroke="var(--fiducia-red)" 
                     strokeWidth={2}
                     fillOpacity={1} 
                     fill="url(#colorExpense)" 
                   />
                 </AreaChart>
               </ResponsiveContainer>
             </div>
           </div>

           {/* Transactions Card */}
           <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
             <div className="flex items-center justify-between p-5 border-b border-border">
               <div>
                 <h3 className="text-[15px] font-bold text-foreground">Lançamentos Recentes</h3>
                 <p className="text-[12px] text-muted-foreground">Últimas movimentações da sua conta</p>
               </div>
               <Link to="/transactions" className="text-[12px] text-fiducia-blue font-bold hover:underline">Ver todos</Link>
             </div>
             <div className="divide-y divide-border">
                  {transactions.slice(0, 6).map(t => {
                   const isIncome = t.type === 'receita' || t.type === 'income';
                   const isTransfer = t.type === 'transferencia' || t.type === 'transfer';
                   return (
                   <div key={t.id} onClick={() => navigate('/transactions', { state: { editId: t.id } })} className="flex items-center gap-4 p-4 hover:bg-secondary/50 transition-colors cursor-pointer group">
                     <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                       isIncome ? 'bg-fiducia-green/10 text-fiducia-green' :
                       isTransfer ? 'bg-fiducia-blue/10 text-fiducia-blue' :
                       'bg-fiducia-red/10 text-fiducia-red'
                     }`}>
                       {isIncome ? <ArrowUpRight className="w-5 h-5" /> :
                        isTransfer ? <ArrowRightLeft className="w-5 h-5" /> :
                        <ArrowDownRight className="w-5 h-5" />}
                     </div>
                     <div className="flex-1 min-w-0">
                       <div className="text-[14px] font-semibold text-foreground truncate">{t.description}</div>
                       <div className="text-[12px] text-muted-foreground truncate flex items-center gap-2">
                         <span className="bg-secondary px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">{categories.find(c => c.id === t.categoryId)?.name || 'Geral'}</span>
                         <span>•</span>
                         <span>{resolveAccountName(t.accountId, accounts, creditCards)}</span>
                       </div>
                     </div>
                     <div className="text-right">
                       <div className={`text-[15px] font-bold font-mono ${
                         isIncome ? 'text-fiducia-green' :
                         isTransfer ? 'text-fiducia-blue' :
                         'text-foreground'
                       }`}>
                         {isIncome ? '+ ' : isTransfer ? '' : '- '}{formatCurrency(t.amount)}
                       </div>
                       <div className="text-[11px] text-muted-foreground font-medium">{formatShortDate(t.date)}</div>
                     </div>
                   </div>
                   );
                 })}
               {transactions.length === 0 && (
                 <div className="flex flex-col items-center justify-center p-12 text-center">
                   <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-3">
                     <FileText className="w-6 h-6 text-muted-foreground" />
                   </div>
                   <p className="text-[14px] font-medium text-muted-foreground">Nenhum lançamento encontrado</p>
                 </div>
               )}
             </div>
           </div>
        </div>

        {/* RIGHT COL */}
        <div className="flex flex-col gap-6">
          {/* Accounts */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between p-5 border-b border-border bg-secondary/10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-fiducia-blue/10 text-fiducia-blue flex items-center justify-center">
                  <Wallet className="w-4 h-4" />
                </div>
                <h3 className="text-[15px] font-bold text-foreground">Contas e Cartões</h3>
              </div>
              <div className="text-right">
                <div className="text-[14px] font-bold font-mono text-foreground">{formatCurrency(totalBalance)}</div>
                <div className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Saldo em Contas</div>
              </div>
            </div>
            <div className="divide-y divide-border">
              {accounts.map(acc => (
                <div key={acc.id} className="flex items-center gap-3 p-4 hover:bg-secondary/50 transition-colors cursor-pointer group">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-foreground truncate">{acc.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate capitalize">{acc.type === 'corrente' || acc.type === 'checking' ? 'Conta Corrente' : acc.type === 'poupanca' || acc.type === 'savings' ? 'Poupança' : 'Carteira'}</div>
                  </div>
                  <div className={`text-[15px] font-bold font-mono ${acc.balance >= 0 ? 'text-fiducia-green' : 'text-fiducia-red'}`}>
                    {formatCurrency(acc.balance)}
                  </div>
                </div>
              ))}
              
              {creditCards.length > 0 && (
                <>
                  <div className="px-4 py-2 bg-muted/30 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Cartões de Crédito</div>
                  {creditCards.map(card => {
                    const currentPeriod = calculateInvoicePeriod(new Date(), card.closingDay, card.dueDay);
                    const previousPeriod = getPreviousPeriod(currentPeriod);
                    
                    const calculateBalance = (period: string) => {
                      const periodTx = transactions.filter(t => (t.accountId === card.id || t.destinationAccountId === card.id) && t.invoicePeriod === period);
                      const expenses = periodTx.filter(t => t.type === 'expense' || t.type === 'despesa').reduce((acc, t) => acc + t.amount, 0);
                      const payments = periodTx.filter(t => (t.type === 'transfer' || t.type === 'transferencia') && t.destinationAccountId === card.id).reduce((acc, t) => acc + t.amount, 0);
                      const incomes = periodTx.filter(t => (t.type === 'income' || t.type === 'receita') && t.accountId === card.id).reduce((acc, t) => acc + t.amount, 0);
                      return expenses - payments - incomes;
                    };

                    const prevBalance = calculateBalance(previousPeriod);
                    
                    let displayPeriod = currentPeriod;
                    if (prevBalance > 0.01) {
                      displayPeriod = previousPeriod;
                    }

                    const [pYear, pMonth] = displayPeriod.split('-').map(Number);
                    const periodName = new Date(pYear, pMonth - 1, 1).toLocaleDateString('pt-BR', { month: 'long' });
                    
                    const invoiceTotal = calculateBalance(displayPeriod);
                    
                    return (
                      <div key={card.id} className="flex items-center gap-3 p-4 hover:bg-secondary/50 transition-colors cursor-pointer group">
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-bold text-foreground truncate">{card.name}</div>
                          <div className="text-[11px] text-muted-foreground truncate capitalize">Fatura de {periodName}</div>
                        </div>
                        <div className={`text-[15px] font-bold font-mono ${displayPeriod === previousPeriod ? 'text-fiducia-red' : 'text-foreground'}`}>
                          {formatCurrency(invoiceTotal)}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {accounts.length === 0 && creditCards.length === 0 && (
                <div className="text-center p-6 text-[13px] text-muted-foreground italic">Nenhuma conta ou cartão cadastrado</div>
              )}
            </div>
            <div className="p-3 bg-secondary/5 border-t border-border flex gap-2">
              <Link to="/accounts" className="flex-1 text-center py-2 text-[11px] font-bold uppercase tracking-widest text-fiducia-blue hover:bg-fiducia-blue/5 rounded-lg transition-colors">Contas</Link>
              <Link to="/credit-cards" className="flex-1 text-center py-2 text-[11px] font-bold uppercase tracking-widest text-fiducia-blue hover:bg-fiducia-blue/5 rounded-lg transition-colors">Cartões</Link>
            </div>
          </div>

          {/* Bills to Pay */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between p-5 border-b border-border bg-fiducia-red/5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-fiducia-red/10 text-fiducia-red flex items-center justify-center">
                  <ArrowDownRight className="w-4 h-4" />
                </div>
                <h3 className="text-[15px] font-bold text-foreground">Contas a Pagar</h3>
              </div>
              <div className="text-right">
                <div className="text-[14px] font-bold font-mono text-fiducia-red">{formatCurrency(totalPendingPayWithInvoices)}</div>
                <div className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Pendente</div>
              </div>
            </div>
            <div className="divide-y divide-border">
              {overdueExpensesWithInvoices.map(t => (
                <div key={t.id} onClick={() => !t.isInvoice && navigate('/transactions', { state: { editId: t.id } })} className="flex items-center gap-3 p-4 hover:bg-secondary/50 transition-colors cursor-pointer group">
                  <div className="w-1.5 h-1.5 rounded-full bg-fiducia-red shrink-0 animate-pulse" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-foreground truncate">{t.description}</div>
                    <div className="text-[11px] text-fiducia-red font-semibold truncate">Atrasada • {formatFullDate(t.date)}</div>
                  </div>
                  <div className="text-[14px] font-bold font-mono text-fiducia-red">{formatCurrency(t.amount)}</div>
                </div>
              ))}
              {upcomingExpensesWithInvoices.map(t => (
                <div key={t.id} onClick={() => !t.isInvoice && navigate('/transactions', { state: { editId: t.id } })} className="flex items-center gap-3 p-4 hover:bg-secondary/50 transition-colors cursor-pointer group">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.isInvoice ? 'bg-fiducia-blue' : 'bg-fiducia-amber'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-foreground truncate">{t.description}</div>
                    <div className="text-[11px] text-muted-foreground truncate">Vence em {formatFullDate(t.date)}</div>
                  </div>
                  <div className="text-[14px] font-bold font-mono text-foreground">{formatCurrency(t.amount)}</div>
                </div>
              ))}
              {overdueExpensesWithInvoices.length === 0 && upcomingExpensesWithInvoices.length === 0 && (
                <div className="text-center p-6 text-[13px] text-muted-foreground italic">Tudo em dia por aqui!</div>
              )}
            </div>
          </div>

          {/* Bills to Receive */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between p-5 border-b border-border bg-fiducia-green/5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-fiducia-green/10 text-fiducia-green flex items-center justify-center">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
                <h3 className="text-[15px] font-bold text-foreground">Contas a Receber</h3>
              </div>
              <div className="text-right">
                <div className="text-[14px] font-bold font-mono text-fiducia-green">{formatCurrency(totalPendingReceive)}</div>
                <div className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Pendente</div>
              </div>
            </div>
            <div className="divide-y divide-border">
              {overdueIncomes.map(t => (
                <div key={t.id} onClick={() => navigate('/transactions', { state: { editId: t.id } })} className="flex items-center gap-3 p-4 hover:bg-secondary/50 transition-colors cursor-pointer group">
                  <div className="w-1.5 h-1.5 rounded-full bg-fiducia-red shrink-0 animate-pulse" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-foreground truncate">{t.description}</div>
                    <div className="text-[11px] text-fiducia-red font-semibold truncate">Atrasada • {formatFullDate(t.date)}</div>
                  </div>
                  <div className="text-[14px] font-bold font-mono text-fiducia-green">{formatCurrency(t.amount)}</div>
                </div>
              ))}
              {upcomingIncomes.map(t => (
                <div key={t.id} onClick={() => navigate('/transactions', { state: { editId: t.id } })} className="flex items-center gap-3 p-4 hover:bg-secondary/50 transition-colors cursor-pointer group">
                  <div className="w-1.5 h-1.5 rounded-full bg-fiducia-green shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-foreground truncate">{t.description}</div>
                    <div className="text-[11px] text-muted-foreground truncate">Recebe em {formatFullDate(t.date)}</div>
                  </div>
                  <div className="text-[14px] font-bold font-mono text-fiducia-green">{formatCurrency(t.amount)}</div>
                </div>
              ))}
              {overdueIncomes.length === 0 && upcomingIncomes.length === 0 && (
                <div className="text-center p-6 text-[13px] text-muted-foreground italic">Nenhuma receita pendente</div>
              )}
            </div>
          </div>

          {/* Extra sections toggle for mobile */}
          <div className="lg:hidden">
            <button
              onClick={() => setExtraSectionsOpen(!extraSectionsOpen)}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-card border border-border rounded-2xl text-[13px] font-bold text-muted-foreground hover:text-foreground transition-colors shadow-sm"
            >
              {extraSectionsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {extraSectionsOpen ? 'Mostrar menos' : 'Metas e Orçamentos'}
            </button>
          </div>

          {/* Goals */}
          <div className={`${extraSectionsOpen ? 'block' : 'hidden'} lg:block bg-card border border-border rounded-2xl overflow-hidden shadow-sm`}>
            <div className="flex items-center justify-between p-5 border-b border-border bg-secondary/10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-fiducia-blue/10 text-fiducia-blue flex items-center justify-center">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
                <h3 className="text-[15px] font-bold text-foreground">Metas Financeiras</h3>
              </div>
              <Link to="/goals" className="text-[11px] font-bold uppercase tracking-wider text-fiducia-blue hover:underline">Ver todas</Link>
            </div>
            <div className="p-5 space-y-5">
              {goals.slice(0, 3).map(goal => {
                const percentage = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
                return (
                  <div key={goal.id} className="space-y-2">
                    <div className="flex justify-between items-end">
                      <div>
                        <span className="text-[13px] font-bold text-foreground block">{goal.name}</span>
                        <span className="text-[11px] text-muted-foreground">{percentage}% concluído</span>
                      </div>
                      <span className="text-[12px] font-bold font-mono">
                        {formatCurrency(goal.currentAmount)} <span className="text-muted-foreground font-normal">/ {formatCurrency(goal.targetAmount)}</span>
                      </span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full bg-fiducia-blue transition-all duration-500" 
                        style={{ width: `${percentage}%` }} 
                      />
                    </div>
                  </div>
                );
              })}
              {goals.length === 0 && (
                <div className="text-center p-4 text-[13px] text-muted-foreground italic">Nenhuma meta definida</div>
              )}
            </div>
          </div>

          {/* Budgets */}
          <div className={`${extraSectionsOpen ? 'block' : 'hidden'} lg:block bg-card border border-border rounded-2xl overflow-hidden shadow-sm`}>
            <div className="flex items-center justify-between p-5 border-b border-border bg-secondary/10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-fiducia-amber/10 text-fiducia-amber flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
                <h3 className="text-[15px] font-bold text-foreground">Orçamentos</h3>
              </div>
              <Link to="/budgets" className="text-[11px] font-bold uppercase tracking-wider text-fiducia-blue hover:underline">Ajustar</Link>
            </div>
            <div className="p-5 space-y-5">
              {budgets.slice(0, 4).map(budget => {
                const category = categories.find(c => c.id === budget.categoryId);
                const CategoryIcon = category ? getCategoryIcon(category.icon) : HelpCircle;
                const spent = transactions
                  .filter(t => t.categoryId === budget.categoryId && (t.type === 'despesa' || t.type === 'expense') && t.date.split('T')[0].startsWith(currentMonthStr))
                  .reduce((sum, t) => sum + t.amount, 0);
                const percentage = Math.min(100, Math.round((spent / budget.amount) * 100));
                const isOverBudget = spent > budget.amount;

                return (
                  <div key={budget.id} className="space-y-2">
                    <div className="flex justify-between items-end">
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded bg-secondary">
                          <CategoryIcon className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <div>
                          <span className="text-[13px] font-bold text-foreground block">{category?.name || 'Geral'}</span>
                          <span className="text-[11px] text-muted-foreground">{percentage}% utilizado</span>
                        </div>
                      </div>
                      <span className="text-[12px] font-bold font-mono">
                        {formatCurrency(spent)} <span className="text-muted-foreground font-normal">/ {formatCurrency(budget.amount)}</span>
                      </span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${isOverBudget ? 'bg-fiducia-red' : percentage > 80 ? 'bg-fiducia-amber' : 'bg-fiducia-green'}`} 
                        style={{ width: `${percentage}%` }} 
                      />
                    </div>
                  </div>
                );
              })}
              {budgets.length === 0 && (
                <div className="text-center p-4 text-[13px] text-muted-foreground italic">Nenhum orçamento definido</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
