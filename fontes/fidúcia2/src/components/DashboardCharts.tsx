import React from 'react';
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
  Bar
} from 'recharts';
import { Transaction, Category } from '../types';

interface ChartsProps {
  transactions: Transaction[];
  categories: Category[];
}

export const DashboardCharts: React.FC<ChartsProps> = ({ transactions, categories }) => {
  // 1. Process data for monthly cashflow comparison
  const monthlyDataMap: { [month: string]: { income: number; expense: number } } = {};
  
  transactions.forEach(tx => {
    if (tx.status === 'cancelled' || tx.status === 'cancelado') return;
    
    const dateObj = new Date(tx.date);
    if (isNaN(dateObj.getTime())) return;
    
    const yearMonth = dateObj.toLocaleDateString('pt-BR', { year: '2-digit', month: 'short' });
    
    if (!monthlyDataMap[yearMonth]) {
      monthlyDataMap[yearMonth] = { income: 0, expense: 0 };
    }
    
    const isIncome = tx.type === 'income' || tx.type === 'receita';
    const isExpense = tx.type === 'expense' || tx.type === 'despesa';

    if (isIncome) {
      monthlyDataMap[yearMonth].income += tx.amount;
    } else if (isExpense) {
      monthlyDataMap[yearMonth].expense += tx.amount;
    }
  });

  const cashFlowData = Object.keys(monthlyDataMap).map(token => ({
    name: token,
    Receita: Number(monthlyDataMap[token].income.toFixed(2)),
    Despesa: Number(monthlyDataMap[token].expense.toFixed(2)),
    Saldo: Number((monthlyDataMap[token].income - monthlyDataMap[token].expense).toFixed(2))
  })).slice(-6); // Last 6 months

  // 2. Process data for Category expenses distribution
  const expenseByCategoryMap: { [catId: string]: number } = {};
  transactions.forEach(tx => {
    if (tx.status === 'cancelled' || tx.status === 'cancelado') return;
    const isExpense = tx.type === 'expense' || tx.type === 'despesa';
    if (isExpense && tx.categoryId) {
      const cat = categories.find(c => c.id === tx.categoryId);
      const targetId = (cat && cat.parentId) ? cat.parentId : tx.categoryId;
      expenseByCategoryMap[targetId] = (expenseByCategoryMap[targetId] || 0) + tx.amount;
    }
  });

  const categoryExpensesData = Object.keys(expenseByCategoryMap).map(catId => {
    const matchedCategory = categories.find(c => c.id === catId);
    return {
      name: matchedCategory ? matchedCategory.name : 'Outros',
      value: Number(expenseByCategoryMap[catId].toFixed(2))
    };
  }).filter(item => item.value > 0);

  // Modern pastel and confident financial palette
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      {/* Fluxo de Caixa (Area Chart) */}
      <div className="bg-card text-card-foreground border border-border p-5 rounded-2xl shadow-card transition-all duration-300">
        <h3 className="text-base font-semibold mb-1 text-foreground">Fluxo de Caixa Mensal</h3>
        <p className="text-xs text-muted-foreground mb-4">Evolução de receitas e despesas nos últimos meses</p>
        
        <div className="h-64 w-full">
          {cashFlowData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
              Sem dados suficientes para exibir o gráfico.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashFlowData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorDespesa" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip 
                  formatter={(value: any) => `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '12px' }}
                  labelStyle={{ color: 'var(--foreground)', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="Receita" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorReceita)" />
                <Area type="monotone" dataKey="Despesa" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorDespesa)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Distribuição de Despesas por Categoria (Pie Chart/Donut Chart) */}
      <div className="bg-card text-card-foreground border border-border p-5 rounded-2xl shadow-card transition-all duration-300">
        <h3 className="text-base font-semibold mb-1 text-foreground">Despesas por Categoria</h3>
        <p className="text-xs text-muted-foreground mb-4">Distribuição percentual dos seus gastos</p>
        
        <div className="h-64 w-full flex flex-col md:flex-row items-center justify-center">
          {categoryExpensesData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
              Nenhuma despesa registrada para exibir.
            </div>
          ) : (
            <>
              <div className="w-full md:w-1/2 h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryExpensesData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {categoryExpensesData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any) => `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full md:w-1/2 max-h-56 overflow-y-auto mt-4 md:mt-0 flex flex-col gap-2 px-4">
                {categoryExpensesData.map((item, index) => {
                  const total = categoryExpensesData.reduce((acc, curr) => acc + curr.value, 0);
                  const percentage = ((item.value / total) * 100).toFixed(1);
                  return (
                    <div key={item.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span 
                          className="w-3 h-3 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="font-medium text-foreground max-w-[120px] truncate">{item.name}</span>
                      </div>
                      <span className="text-muted-foreground font-semibold">
                        R$ {item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ({percentage}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
