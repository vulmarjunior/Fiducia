import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
  CartesianGrid,
  LineChart,
  Line
} from 'recharts';
import { Transaction, Category } from '../types';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  PieChart as PieChartIcon, 
  BarChart2, 
  Target 
} from 'lucide-react';

interface AnalyticsDashboardProps {
  transactions: Transaction[];
  categories: Category[];
  view?: string;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ transactions, categories, view }) => {
  const [timeRange, setTimeRange] = useState<'3m' | '6m' | '1y'>('6m');

  // Helper to filter by date
  const now = new Date();
  const monthsDiff = timeRange === '3m' ? 3 : timeRange === '6m' ? 6 : 12;
  const startDate = new Date(now.getFullYear(), now.getMonth() - monthsDiff, 1);

  const filteredTxs = transactions.filter(tx => {
    if (tx.status === 'cancelled' || tx.status === 'cancelado') return false;
    const dateObj = new Date(tx.date);
    return dateObj >= startDate && !isNaN(dateObj.getTime());
  });

  // 1. Process data for monthly cashflow comparison
  const monthlyDataMap: { [month: string]: { income: number; expense: number; balance: number } } = {};
  
  let runningBalance = 0; // Simplified cumulative state
  
  // Sort ascending for cumulative calculations
  const sortedTxs = [...filteredTxs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  sortedTxs.forEach(tx => {
    const dateObj = new Date(tx.date);
    const yearMonth = dateObj.toLocaleDateString('pt-BR', { year: '2-digit', month: 'short' });
    
    if (!monthlyDataMap[yearMonth]) {
      monthlyDataMap[yearMonth] = { income: 0, expense: 0, balance: runningBalance };
    }
    
    const isIncome = tx.type === 'income' || tx.type === 'receita';
    const isExpense = tx.type === 'expense' || tx.type === 'despesa';

    if (isIncome) {
      monthlyDataMap[yearMonth].income += tx.amount;
      runningBalance += tx.amount;
    } else if (isExpense) {
      monthlyDataMap[yearMonth].expense += tx.amount;
      runningBalance -= tx.amount;
    }
    
    monthlyDataMap[yearMonth].balance = runningBalance;
  });

  const cashFlowData = Object.keys(monthlyDataMap).map(token => ({
    name: token,
    Receita: Number(monthlyDataMap[token].income.toFixed(2)),
    Despesa: Number(monthlyDataMap[token].expense.toFixed(2)),
    Patrimonio: Number(monthlyDataMap[token].balance.toFixed(2))
  }));

  // 2. Map Category expenses
  const expenseByCategoryMap: { [catId: string]: number } = {};
  filteredTxs.forEach(tx => {
    const isExpense = tx.type === 'expense' || tx.type === 'despesa';
    if (isExpense && tx.categoryId) {
      const cat = categories.find(c => c.id === tx.categoryId);
      const targetId = (cat && cat.parentId) ? cat.parentId : tx.categoryId;
      expenseByCategoryMap[targetId] = (expenseByCategoryMap[targetId] || 0) + tx.amount;
    }
  });

  const categoryExpensesData = Object.keys(expenseByCategoryMap)
    .map(catId => {
      const matchedCategory = categories.find(c => c.id === catId);
      return {
        name: matchedCategory ? matchedCategory.name : 'Outros',
        value: Number(expenseByCategoryMap[catId].toFixed(2))
      };
    })
    .filter(item => item.value > 0)
    .sort((a, b) => b.value - a.value); // Sort max to min

  // Top 5 establishments (based on description)
  const establishmentMap: { [name: string]: number } = {};
  filteredTxs.forEach(tx => {
    const isExpense = tx.type === 'expense' || tx.type === 'despesa';
    if (isExpense) {
      // Very basic normalization (uppercase, remove extra spaces)
      const name = tx.description.toUpperCase().trim();
      establishmentMap[name] = (establishmentMap[name] || 0) + tx.amount;
    }
  });

  const topEstablishments = Object.keys(establishmentMap)
    .map(name => ({ name, value: establishmentMap[name] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b', '#0ea5e9', '#d946ef'];

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border border-border p-4 rounded-2xl shadow-sm">
        <div>
          <h2 className="text-base font-bold text-foreground">Análises Avançadas</h2>
          <p className="text-xs text-muted-foreground">Diagnóstico profundo da sua saúde financeira</p>
        </div>
        <div className="flex bg-muted p-1 rounded-xl">
          {(['3m', '6m', '1y'] as const).map(tr => (
            <button
              key={tr}
              onClick={() => setTimeRange(tr)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                timeRange === tr
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tr === '3m' ? 'Três Meses' : tr === '6m' ? 'Seis Meses' : 'Um Ano'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Evolução Patrimonial & Fluxo de Caixa */}
        {(!view || view === 'analytics-cashflow') && (
        <div className="bg-card border border-border p-5 rounded-2xl shadow-card transition-all duration-300">
          <div className="flex items-center gap-2 mb-1">
            <Activity size={18} className="text-primary" />
            <h3 className="text-base font-semibold text-foreground">Evolução Patrimonial</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Acumulado do período ({timeRange})</p>
          
          <div className="h-64 w-full">
            {cashFlowData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                Dados insuficientes.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashFlowData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPatrimonio" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }} dy={10} />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-card)', fontSize: '12px' }}
                    itemStyle={{ color: 'var(--color-foreground)' }}
                    formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Acumulado']}
                  />
                  <Area type="monotone" dataKey="Patrimonio" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorPatrimonio)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        )}

        {/* Despesas por Categoria */}
        {(!view || view === 'analytics-category') && (
        <div className="bg-card border border-border p-5 rounded-2xl shadow-card transition-all duration-300">
          <div className="flex items-center gap-2 mb-1">
            <PieChartIcon size={18} className="text-rose-500" />
            <h3 className="text-base font-semibold text-foreground">Distribuição de Despesas</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">As categorias onde você mais investe o seu dinheiro</p>

          <div className="h-64 w-full">
            {categoryExpensesData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                Nenhuma despesa no período.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryExpensesData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {categoryExpensesData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    contentStyle={{ borderRadius: '12px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-card)', fontSize: '12px' }}
                  />
                  <Legend 
                    layout="vertical" 
                    verticalAlign="middle" 
                    align="right"
                    wrapperStyle={{ fontSize: '11px', color: 'var(--color-foreground)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        )}

        {/* Top 10 Estabelecimentos */}
        {(!view || view === 'analytics-period') && (
        <div className="bg-card border border-border p-5 rounded-2xl shadow-card transition-all duration-300 lg:col-span-2">
          <div className="flex items-center gap-2 mb-1">
            <BarChart2 size={18} className="text-blue-500" />
            <h3 className="text-base font-semibold text-foreground">Top 10 Estabelecimentos (Despesas)</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Descubra para onde seu dinheiro está indo</p>

          <div className="h-72 w-full">
            {topEstablishments.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                Sem despesas suficientes no período.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topEstablishments} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }} />
                  <YAxis type="category" dataKey="name" width={100} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'var(--color-foreground)' }} />
                  <Tooltip 
                    cursor={{ fill: 'var(--color-muted)', opacity: 0.4 }}
                    contentStyle={{ borderRadius: '12px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-card)', fontSize: '12px' }}
                    formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Total']}
                  />
                  <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20}>
                    {topEstablishments.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
};
