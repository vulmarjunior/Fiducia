import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Wallet, CreditCard, Eye, EyeOff, Plus, ArrowUpRight, ArrowDownRight, ArrowRightLeft, FileText, Calendar, HelpCircle, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid } from 'recharts';
import { getCategoryIcon } from '../lib/categoryIcons';
import { calculateInvoicePeriod, getPreviousPeriod, resolveAccountName } from '../lib/utils';
import { GoogleGenAI } from "@google/genai";

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
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const summary = {
        balance: accounts.reduce((sum, a) => sum + (a.balance || 0), 0),
        expenses: transactions.filter(t => (t.type === 'despesa' || t.type === 'expense') && t.date.startsWith(currentMonthStr)).reduce((sum, t) => sum + t.amount, 0),
        income: transactions.filter(t => (t.type === 'receita' || t.type === 'income') && t.date.startsWith(currentMonthStr)).reduce((sum, t) => sum + t.amount, 0),
      };
      
      const prompt = `Como seu assistente financeiro Fiducia, dê uma dica curta (máximo 150 caracteres) baseada nestes dados do mês:
      Gasto: R$ ${summary.expenses.toFixed(2)}, Ganho: R$ ${summary.income.toFixed(2)}, Saldo: R$ ${summary.balance.toFixed(2)}.
      Seja motivador e direto em Português.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
      });
      setAiTip(response.text || '');
    } catch (error) {
      console.error("Dashboard AI Tip error:", error);
    } finally {
      setIsLoadingAi(false);
    }
  };

  useEffect(() => {
    if (transactions.length > 5 && !aiTip) {
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
  
  const monthlyIncome = currentMonthTransactions.filter(t => t.type === 'receita' || t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const monthlyExpense = currentMonthTransactions.filter(t => t.type === 'despesa' || t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const monthlyBalance = monthlyIncome - monthlyExpense;

  const overdueExpenses = transactions.filter(t => {
    const tDatePart = t.date.split('T')[0];
    const isExpense = t.type === 'despesa' || t.type === 'expense';
    const isPending = t.status === 'pendente' || t.status === 'pending' || !t.status;
    return isExpense && isPending && tDatePart < currentDateStr;
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const upcomingExpenses = transactions.filter(t => {
    const tDatePart = t.date.split('T')[0];
    const isExpense = t.type === 'despesa' || t.type === 'expense';
    const isPending = t.status === 'pendente' || t.status === 'pending' || !t.status;
    return isExpense && isPending && tDatePart >= currentDateStr;
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 5);

  const overdueIncomes = transactions.filter(t => {
    const tDatePart = t.date.split('T')[0];
    const isIncome = t.type === 'receita' || t.type === 'income';
    const isPending = t.status === 'pendente' || t.status === 'pending' || !t.status;
    return isIncome && isPending && tDatePart < currentDateStr;
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const upcomingIncomes = transactions.filter(t => {
    const tDatePart = t.date.split('T')[0];
    const isIncome = t.type === 'receita' || t.type === 'income';
    const isPending = t.status === 'pendente' || t.status === 'pending' || !t.status;
    return isIncome && isPending && tDatePart >= currentDateStr;
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 5);

  const totalPendingPay = [
    ...overdueExpenses, 
    ...transactions.filter(t => (t.type === 'despesa' || t.type === 'expense') && (t.status === 'pendente' || t.status === 'pending' || !t.status) && t.date.split('T')[0] >= currentDateStr)
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
    ...transactions.filter(t => (t.type === 'despesa' || t.type === 'expense') && (t.status === 'pendente' || t.status === 'pending' || !t.status) && t.date.split('T')[0] >= currentDateStr),
    ...unpaidInvoices
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const totalPendingPayWithInvoices = allPendingExpenses.reduce((sum, t) => sum + t.amount, 0);
  const upcomingExpensesWithInvoices = allPendingExpenses.filter(t => t.date.split('T')[0] >= currentDateStr).slice(0, 5);
  const overdueExpensesWithInvoices = allPendingExpenses.filter(t => t.date.split('T')[0] < currentDateStr);

  const totalPendingReceive = [...overdueIncomes, ...transactions.filter(t => (t.type === 'receita' || t.type === 'income') && (t.status === 'pendente' || t.status === 'pending' || !t.status) && t.date.split('T')[0] >= currentDateStr)].reduce((sum, t) => sum + t.amount, 0);

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

  // Prepare chart data (last 6 months)
  const last6Months = Array.from({length: 6}, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - 5 + i);
    return { 
      month: d.toISOString().substring(0, 7), 
      label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') 
    };
  });
  
  const chartData = last6Months.map(m => {
    const monthTx = transactions.filter(t => {
      if (t.creditCardId || t.accountId && creditCards.some(c => c.id === t.accountId)) {
        return t.invoicePeriod === m.month;
      }
      return t.date.startsWith(m.month);
    });
    return {
      name: m.label.charAt(0).toUpperCase() + m.label.slice(1),
      income: monthTx.filter(t => t.type === 'receita' || t.type === 'income').reduce((sum, t) => sum + t.amount, 0),
      expense: monthTx.filter(t => t.type === 'despesa' || t.type === 'expense').reduce((sum, t) => sum + t.amount, 0),
    };
  });

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="text-[13px] text-muted-foreground font-medium mb-1 flex items-center gap-2">
            {greetingEmoji} {greeting}, {user?.displayName?.split(' ')[0] || 'Usuário'}
            {aiTip && (
              <span className="flex items-center gap-1 text-fiducia-blue bg-fiducia-blue/5 px-2 py-0.5 rounded-full text-[10px] animate-in fade-in slide-in-from-left-1">
                <Sparkles className="w-3 h-3" /> {aiTip}
              </span>
            )}
            {isLoadingAi && !aiTip && <Loader2 className="w-3 h-3 animate-spin text-fiducia-blue" />}
          </div>
          <div className="text-[28px] font-bold tracking-tight text-foreground">Visão Geral</div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowValues(!showValues)}
            className="p-2 rounded-lg border border-border bg-card hover:bg-secondary transition-colors text-muted-foreground"
            title={showValues ? "Ocultar valores" : "Mostrar valores"}
          >
            {showValues ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <div className="inline-flex bg-secondary/50 border border-border rounded-xl p-1 gap-1">
            <button className="px-4 py-1.5 rounded-lg text-[12px] font-semibold text-muted-foreground hover:text-foreground transition-colors">Sem.</button>
            <button className="px-4 py-1.5 rounded-lg text-[12px] font-semibold bg-white dark:bg-primary shadow-sm text-foreground dark:text-primary-foreground">Mês</button>
            <button className="px-4 py-1.5 rounded-lg text-[12px] font-semibold text-muted-foreground hover:text-foreground transition-colors">Ano</button>
          </div>
          <Button nativeButton={false} className="h-10 px-4 text-sm font-semibold rounded-xl gap-2 bg-primary text-primary-foreground hover:opacity-90 transition-opacity" render={<Link to="/transactions" />}>
            <Plus className="w-4 h-4" /> Novo lançamento
          </Button>
        </div>
      </div>

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
            <div className="text-[11px] font-bold text-fiducia-green bg-fiducia-green/10 px-2 py-1 rounded-full">
              +12.5%
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
            <div className="text-[11px] font-bold text-fiducia-red bg-fiducia-red/10 px-2 py-1 rounded-full">
              -4.2%
            </div>
          </div>
          <div className="text-[13px] text-muted-foreground font-medium mb-1">Despesas do mês</div>
          <div className="text-[24px] font-bold tracking-tight font-mono text-foreground">{formatCurrency(monthlyExpense)}</div>
        </div>

        {/* Balanço Mensal */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow group">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-fiducia-amber/10 text-fiducia-amber flex items-center justify-center group-hover:scale-110 transition-transform">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div className="text-[11px] font-bold text-fiducia-amber bg-fiducia-amber/10 px-2 py-1 rounded-full">
              Balanço
            </div>
          </div>
          <div className="text-[13px] text-muted-foreground font-medium mb-1">Balanço do mês</div>
          <div className={`text-[24px] font-bold tracking-tight font-mono ${monthlyBalance >= 0 ? 'text-fiducia-green' : 'text-fiducia-red'}`}>
            {formatCurrency(monthlyBalance)}
          </div>
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
               {transactions.slice(0, 6).map(t => (
                 <div key={t.id} className="flex items-center gap-4 p-4 hover:bg-secondary/50 transition-colors cursor-pointer group">
                   <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${(t.type === 'receita' || t.type === 'income') ? 'bg-fiducia-green/10 text-fiducia-green' : 'bg-fiducia-red/10 text-fiducia-red'}`}>
                     {(t.type === 'receita' || t.type === 'income') ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
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
                     <div className={`text-[15px] font-bold font-mono ${(t.type === 'receita' || t.type === 'income') ? 'text-fiducia-green' : 'text-foreground'}`}>
                       {(t.type === 'receita' || t.type === 'income') ? '+ ' : '- '}{formatCurrency(t.amount)}
                     </div>
                     <div className="text-[11px] text-muted-foreground font-medium">{formatShortDate(t.date)}</div>
                   </div>
                 </div>
               ))}
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
                <div key={t.id} className="flex items-center gap-3 p-4 hover:bg-secondary/50 transition-colors cursor-pointer group">
                  <div className="w-1.5 h-1.5 rounded-full bg-fiducia-red shrink-0 animate-pulse" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-foreground truncate">{t.description}</div>
                    <div className="text-[11px] text-fiducia-red font-semibold truncate">Atrasada • {formatFullDate(t.date)}</div>
                  </div>
                  <div className="text-[14px] font-bold font-mono text-fiducia-red">{formatCurrency(t.amount)}</div>
                </div>
              ))}
              {upcomingExpensesWithInvoices.map(t => (
                <div key={t.id} className="flex items-center gap-3 p-4 hover:bg-secondary/50 transition-colors cursor-pointer group">
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
                <div key={t.id} className="flex items-center gap-3 p-4 hover:bg-secondary/50 transition-colors cursor-pointer group">
                  <div className="w-1.5 h-1.5 rounded-full bg-fiducia-red shrink-0 animate-pulse" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-foreground truncate">{t.description}</div>
                    <div className="text-[11px] text-fiducia-red font-semibold truncate">Atrasada • {formatFullDate(t.date)}</div>
                  </div>
                  <div className="text-[14px] font-bold font-mono text-fiducia-green">{formatCurrency(t.amount)}</div>
                </div>
              ))}
              {upcomingIncomes.map(t => (
                <div key={t.id} className="flex items-center gap-3 p-4 hover:bg-secondary/50 transition-colors cursor-pointer group">
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

          {/* Goals */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
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
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
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
