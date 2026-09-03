import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import type { CategoryReportResult, NormalizedTransaction } from '../../types/reports';
import type { Invoice } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { ReportDetailsDialog } from './ReportDetailsDialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Popover, PopoverContent, PopoverTrigger, PopoverClose } from '../ui/popover';
import {
  Calendar, HelpCircle, Info, Search, X, ChevronDown, CheckSquare, Square,
} from 'lucide-react';

interface CategoryEvolutionChartProps {
  reportResult: CategoryReportResult;
  evolutionWindow?: 1 | 3 | 6 | 12;
  onEvolutionWindowChange?: (window: 1 | 3 | 6 | 12) => void;
  invoices?: Invoice[];
  entityNames?: Record<string, string>;
}

const PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6',
];

function getColorForCategory(catId: string): string {
  let hash = 0;
  for (let i = 0; i < catId.length; i++) {
    hash = catId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function CategoryEvolutionChart({
  reportResult,
  evolutionWindow = 1,
  onEvolutionWindowChange,
  invoices,
  entityNames,
}: CategoryEvolutionChartProps) {
  const { evolution, categories, itemsWithoutInvoiceDayTotal, itemsWithoutInvoiceDayEntries, itemsWithoutInvoicePeriodTotal, itemsWithoutInvoicePeriodEntries } = reportResult;

  // Seleção de séries: por padrão, as top 5 categorias ou todas se <= 5
  const [selectedCatIds, setSelectedCatIds] = useState<string[]>(() =>
    categories.slice(0, 5).map(c => c.categoryId)
  );

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsTitle, setDetailsTitle] = useState('');
  const [detailsEntries, setDetailsEntries] = useState<NormalizedTransaction[]>([]);

  const [seriesMenuOpen, setSeriesMenuOpen] = useState(false);
  const [seriesSearch, setSeriesSearch] = useState('');

  const isMonthGrouping = evolution.length > 0 && evolution[0].periodKey.length === 7;

  const toggleCategorySeries = (id: string) => {
    setSelectedCatIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectTopN = (n: number) => {
    setSelectedCatIds(categories.slice(0, n).map(c => c.categoryId));
    setSeriesSearch('');
  };

  const selectAllCategories = () => {
    setSelectedCatIds(categories.map(c => c.categoryId));
    setSeriesSearch('');
  };

  const clearAllCategories = () => {
    setSelectedCatIds([]);
    setSeriesSearch('');
  };

  const filteredCategories = categories.filter(c =>
    c.categoryName.toLowerCase().includes(seriesSearch.toLowerCase())
  );

  const selectedCategories = categories.filter(c => selectedCatIds.includes(c.categoryId));

  const chartData = evolution.map(pt => {
    const row: Record<string, any> = {
      label: pt.label,
      periodKey: pt.periodKey,
      total: pt.total,
    };
    for (const catId of selectedCatIds) {
      row[catId] = pt.values[catId] || 0;
    }
    return row;
  });

  const handleOpenBucketDetails = (point: typeof evolution[0], catId?: string) => {
    // Coleta transações que caíram neste bucket
    const targetEntries: NormalizedTransaction[] = [];
    const catsToInspect = catId
      ? categories.filter(c => c.categoryId === catId)
      : categories;

    for (const cat of catsToInspect) {
      for (const entry of cat.entries) {
        let belongs = false;
        if (point.periodKey.length === 7 && point.periodKey.includes('-')) {
          // Mês: YYYY-MM
          const mKey = entry.isCard
            ? (entry.invoicePeriod || entry.month || entry.date.slice(0, 7))
            : (entry.month || entry.date.slice(0, 7));
          belongs = mKey === point.periodKey;
        } else if (point.periodKey.length === 10) {
          // Dia: YYYY-MM-DD
          belongs = entry.date === point.periodKey;
        } else {
          // Semana ou genérico: verifica se a data está no período
          belongs = entry.date.includes(point.periodKey) || (point.label && entry.date >= point.periodKey);
        }

        if (belongs) {
          targetEntries.push(entry);
        }
      }
    }

    const catName = catId ? categories.find(c => c.categoryId === catId)?.categoryName : '';
    setDetailsTitle(catName ? `${catName} — ${point.label}` : `Lançamentos do Período — ${point.label}`);
    setDetailsEntries(targetEntries);
    setDetailsOpen(true);
  };

  const handleOpenUnassignedInvoiceDay = () => {
    setDetailsTitle('Compras de Cartão com data fora do mês civil');
    setDetailsEntries(itemsWithoutInvoiceDayEntries);
    setDetailsOpen(true);
  };

  const handleOpenNoInvoicePeriod = () => {
    setDetailsTitle('Compras de Cartão sem período de fatura derivável');
    setDetailsEntries(itemsWithoutInvoicePeriodEntries);
    setDetailsOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Seletor de séries ativas e janela da evolução */}
      <div className="bg-card p-4 rounded-xl border border-border space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
            Categorias na Evolução
          </span>
          {isMonthGrouping && onEvolutionWindowChange && (
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border text-xs">
              {([1, 3, 6, 12] as const).map(w => (
                <button
                  key={w}
                  type="button"
                  onClick={() => onEvolutionWindowChange(w)}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    evolutionWindow === w
                      ? 'bg-background font-semibold text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {w === 1 ? '1M' : `${w}M`}
                </button>
              ))}
              <span className="px-1 text-[10px] text-muted-foreground">janela</span>
            </div>
          )}
        </div>

        {/* Seleção por dropdown: busca, checkboxes e atalhos em massa */}
        <div className="flex flex-wrap items-center gap-2">
          <Popover open={seriesMenuOpen} onOpenChange={setSeriesMenuOpen}>
            <PopoverTrigger render={(props) => (
              <Button
                {...props}
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                title="Escolher categorias exibidas no gráfico"
              >
                <span>{selectedCatIds.length} de {categories.length} categorias</span>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
            )} />
            <PopoverContent className="w-80 p-2.5">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/60">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Séries exibidas
                </span>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <button type="button" onClick={selectAllCategories} className="text-primary hover:underline">
                    Todas
                  </button>
                  <span className="text-muted-foreground">•</span>
                  <button type="button" onClick={() => selectTopN(5)} className="text-primary hover:underline">
                    Top 5
                  </button>
                  <span className="text-muted-foreground">•</span>
                  <button type="button" onClick={() => selectTopN(10)} className="text-primary hover:underline">
                    Top 10
                  </button>
                  <span className="text-muted-foreground">•</span>
                  <button type="button" onClick={clearAllCategories} className="text-muted-foreground hover:underline">
                    Limpar
                  </button>
                </div>
              </div>

              <div className="relative mt-2">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Buscar categoria..."
                  value={seriesSearch}
                  onChange={e => setSeriesSearch(e.target.value)}
                  className="pl-8 text-xs h-8"
                />
              </div>

              <div className="mt-2 space-y-0.5 max-h-56 overflow-y-auto pr-1">
                {filteredCategories.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    Nenhuma categoria encontrada.
                  </p>
                ) : (
                  filteredCategories.map(cat => {
                    const isSelected = selectedCatIds.includes(cat.categoryId);
                    const color = getColorForCategory(cat.categoryId);
                    return (
                      <button
                        key={cat.categoryId}
                        type="button"
                        onClick={() => toggleCategorySeries(cat.categoryId)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
                          isSelected ? 'bg-muted/60' : 'hover:bg-muted/40'
                        }`}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-primary shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <span className="truncate flex-1 text-left">{cat.categoryName}</span>
                        <span className="text-muted-foreground shrink-0">{formatCurrency(cat.total)}</span>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="pt-2 mt-2 border-t border-border/60 flex justify-end">
                <PopoverClose render={(props) => (
                  <Button {...props} size="sm" className="h-8 text-xs">
                    Concluir
                  </Button>
                )} />
              </div>
            </PopoverContent>
          </Popover>

          <span className="text-[11px] text-muted-foreground">
            A seleção de séries não altera os totais financeiros — a matriz abaixo sempre mostra todas as categorias.
          </span>
        </div>

        {/* Badges das categorias selecionadas (remoção rápida) */}
        {selectedCategories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectedCategories.map(cat => {
              const color = getColorForCategory(cat.categoryId);
              return (
                <span
                  key={cat.categoryId}
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium border border-border bg-muted/40 rounded-full px-2 py-1"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-foreground">{cat.categoryName}</span>
                  <button
                    type="button"
                    onClick={() => toggleCategorySeries(cat.categoryId)}
                    className="p-0.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title={`Remover ${cat.categoryName}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Gráfico de Evolução */}
      <div className="bg-card p-4 rounded-xl border border-border">
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$ ${v}`} />
              <Tooltip formatter={(val: any) => [formatCurrency(Number(val)), 'Valor']} />
              <Legend />
              {selectedCatIds.map((catId) => {
                const catObj = categories.find(c => c.categoryId === catId);
                const color = getColorForCategory(catId);
                return (
                  <Bar
                    key={catId}
                    dataKey={catId}
                    name={catObj?.categoryName || catId}
                    fill={color}
                    stackId="a"
                    radius={[2, 2, 0, 0]}
                  />
                );
              })}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Alerta de itens de cartão fora do mês civil */}
      {itemsWithoutInvoiceDayTotal > 0 && (
        <div
          onClick={handleOpenUnassignedInvoiceDay}
          className="p-3 bg-muted/50 border border-border rounded-lg flex items-center justify-between text-xs text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-primary" />
            <span>
              Compras de fatura com data de compra fora do mês civil: <strong>{formatCurrency(itemsWithoutInvoiceDayTotal)}</strong>
            </span>
          </div>
          <span className="text-primary font-medium underline">Ver compras</span>
        </div>
      )}

      {/* Alerta de itens de cartão sem período de fatura */}
      {itemsWithoutInvoicePeriodTotal !== 0 && (
        <div
          onClick={handleOpenNoInvoicePeriod}
          className="p-3 bg-muted/50 border border-border rounded-lg flex items-center justify-between text-xs text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" />
            <span>
              Compras de cartão sem período de fatura derivável: <strong>{formatCurrency(itemsWithoutInvoicePeriodTotal)}</strong> — não somadas a meses inventados
            </span>
          </div>
          <span className="text-primary font-medium underline">Ver compras</span>
        </div>
      )}

      {/* Tabela Categoria x Período */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-3 border-b border-border bg-muted/30">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Matriz Categoria × Período
          </span>
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/50 text-muted-foreground border-b border-border sticky top-0">
              <tr>
                <th className="p-3 font-semibold min-w-[150px]">Categoria</th>
                {evolution.map(pt => (
                  <th key={pt.periodKey} className="p-3 font-semibold text-right min-w-[100px]">
                    {pt.label}
                  </th>
                ))}
                <th className="p-3 font-semibold text-right min-w-[110px]">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {categories.map(cat => (
                <tr key={cat.categoryId} className="hover:bg-muted/40 transition-colors">
                  <td className="p-3 font-medium text-foreground">{cat.categoryName}</td>
                  {evolution.map(pt => {
                    const val = pt.values[cat.categoryId] || 0;
                    return (
                      <td
                        key={pt.periodKey}
                        onClick={() => {
                          if (val !== 0) handleOpenBucketDetails(pt, cat.categoryId);
                        }}
                        className={`p-3 text-right text-muted-foreground ${val !== 0 ? 'cursor-pointer hover:bg-muted/70 hover:text-foreground font-medium' : ''}`}
                      >
                        {val !== 0 ? formatCurrency(val) : '-'}
                      </td>
                    );
                  })}
                  <td className="p-3 text-right font-semibold text-foreground">
                    {formatCurrency(cat.total)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/30 font-semibold border-t border-border">
              <tr>
                <td className="p-3 text-foreground">Total do Período</td>
                {evolution.map(pt => (
                  <td
                    key={pt.periodKey}
                    onClick={() => {
                      if (pt.total !== 0) handleOpenBucketDetails(pt);
                    }}
                    className={`p-3 text-right text-foreground ${pt.total !== 0 ? 'cursor-pointer hover:bg-muted/80 font-bold' : ''}`}
                  >
                    {formatCurrency(pt.total)}
                  </td>
                ))}
                <td className="p-3 text-right text-foreground font-bold">
                  {formatCurrency(reportResult.total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Modal de Detalhes */}
      <ReportDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        title={detailsTitle}
        entries={detailsEntries}
        context={{ type: reportResult.type === 'expenses' ? 'expenses' : 'income' }}
        invoices={invoices}
        entityNames={entityNames}
      />
    </div>
  );
}
