import React, { useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from 'recharts';
import type { CategoryDistributionItem, CategoryReportResult, NormalizedTransaction } from '../../types/reports';
import { formatCurrency } from '../../lib/utils';
import { ReportDetailsDialog } from './ReportDetailsDialog';
import { PieChart as PieIcon, BarChart3, Info, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';

interface CategoryDistributionChartProps {
  reportResult: CategoryReportResult;
  title: string;
}

const PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6',
  '#84cc16', '#a855f7', '#0ea5e9', '#d946ef', '#64748b',
];

function getColorForCategory(catId: string, index: number): string {
  let hash = 0;
  for (let i = 0; i < catId.length; i++) {
    hash = catId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % PALETTE.length;
  return PALETTE[(idx + index) % PALETTE.length];
}

export function CategoryDistributionChart({
  reportResult,
  title,
}: CategoryDistributionChartProps) {
  const [chartType, setChartType] = useState<'pie' | 'bar'>('pie');
  const [selectedCategory, setSelectedCategory] = useState<CategoryDistributionItem | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { categories, total, hasNegativeCategories } = reportResult;

  const effectiveChartType = hasNegativeCategories ? 'bar' : chartType;

  // Prepara dados para os gráficos
  const chartData = categories.map((cat, idx) => ({
    name: cat.categoryName,
    value: cat.total,
    color: getColorForCategory(cat.categoryId, idx),
    percent: cat.percent,
  }));

  const handleOpenDetails = (cat: CategoryDistributionItem) => {
    setSelectedCategory(cat);
    setDetailsOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho do Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-xl border border-border">
        <div>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
            {title}
          </span>
          <span className="text-2xl sm:text-3xl font-bold text-foreground">
            {formatCurrency(total)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!hasNegativeCategories && (
            <div className="flex items-center bg-muted/60 p-1 rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setChartType('pie')}
                className={`p-1.5 rounded-md transition-colors ${
                  effectiveChartType === 'pie'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Gráfico de Rosca"
              >
                <PieIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setChartType('bar')}
                className={`p-1.5 rounded-md transition-colors ${
                  effectiveChartType === 'bar'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Gráfico de Barras"
              >
                <BarChart3 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {hasNegativeCategories && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center gap-2.5 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            Existem categorias com saldo líquido negativo devido a estornos/créditos de cartão. Gráfico alternado para barras horizontais para representação fiel.
          </span>
        </div>
      )}

      {categories.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm bg-card rounded-xl border border-border">
          Nenhum lançamento encontrado para os filtros selecionados.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Gráfico */}
          <div className="lg:col-span-5 bg-card p-4 rounded-xl border border-border flex flex-col items-center justify-center min-h-[340px]">
            <div className="w-full h-72">
              <ResponsiveContainer width="100%" height="100%">
                {effectiveChartType === 'pie' ? (
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={105}
                      paddingAngle={2}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any) => [formatCurrency(Number(val)), 'Valor']}
                    />
                  </PieChart>
                ) : (
                  <BarChart
                    layout="vertical"
                    data={chartData}
                    margin={{ top: 10, right: 20, left: 40, bottom: 10 }}
                  >
                    <XAxis type="number" tickFormatter={(v) => `R$ ${v}`} />
                    <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(val: any) => [formatCurrency(Number(val)), 'Valor']} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`bar-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
            <span className="text-[11px] text-muted-foreground mt-2">
              Clique em qualquer categoria na lista para ver os lançamentos
            </span>
          </div>

          {/* Tabela / Lista de Categorias */}
          <div className="lg:col-span-7 bg-card rounded-xl border border-border overflow-hidden">
            <div className="p-3 border-b border-border bg-muted/30 flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span>Categoria</span>
              <div className="flex items-center gap-8 pr-2">
                <span>%</span>
                <span>Valor Total</span>
              </div>
            </div>

            <div className="divide-y divide-border/50 max-h-[460px] overflow-y-auto">
              {categories.map((cat, idx) => {
                const color = getColorForCategory(cat.categoryId, idx);
                return (
                  <div
                    key={cat.categoryId}
                    onClick={() => handleOpenDetails(cat)}
                    className="p-3 hover:bg-muted/50 transition-colors cursor-pointer flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="font-medium truncate text-foreground">
                          {cat.categoryName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({cat.entriesCount})
                        </span>
                      </div>

                      <div className="flex items-center gap-8 shrink-0 text-right">
                        <span className="text-xs text-muted-foreground w-12 font-medium">
                          {cat.percent}%
                        </span>
                        <span className={`font-semibold text-sm ${
                          cat.total < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'
                        }`}>
                          {formatCurrency(cat.total)}
                        </span>
                      </div>
                    </div>

                    {/* Barra de progresso visual */}
                    <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(100, Math.max(0, cat.percent))}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>

                    {/* Divisão Direto vs Cartão */}
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                      <span>Conta: {formatCurrency(cat.directCents / 100)}</span>
                      <span>Cartão: {formatCurrency(cat.cardCents / 100)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhes da Categoria */}
      {selectedCategory && (
        <ReportDetailsDialog
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          title={`Lançamentos — ${selectedCategory.categoryName}`}
          subtitle={`${selectedCategory.entriesCount} lançamento(s) na categoria`}
          entries={selectedCategory.entries}
          context={{ type: reportResult.type === 'expenses' ? 'expenses' : 'income' }}
        />
      )}
    </div>
  );
}
