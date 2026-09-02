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
import { formatCurrency } from '../../lib/utils';
import { ReportDetailsDialog } from './ReportDetailsDialog';
import { Calendar, HelpCircle } from 'lucide-react';

interface CategoryEvolutionChartProps {
  reportResult: CategoryReportResult;
}

const PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6',
];

export function CategoryEvolutionChart({ reportResult }: CategoryEvolutionChartProps) {
  const { evolution, categories, itemsWithoutInvoiceDayTotal, itemsWithoutInvoiceDayEntries } = reportResult;

  // Seleção de séries: por padrão, as top 5 categorias ou todas se <= 5
  const [selectedCatIds, setSelectedCatIds] = useState<string[]>(() =>
    categories.slice(0, 5).map(c => c.categoryId)
  );

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsTitle, setDetailsTitle] = useState('');
  const [detailsEntries, setDetailsEntries] = useState<NormalizedTransaction[]>([]);

  const toggleCategorySeries = (id: string) => {
    setSelectedCatIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

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

  const handleOpenBucketDetails = (point: typeof evolution[0]) => {
    // Coleta transações que caíram neste bucket
    const allEntriesInBucket: NormalizedTransaction[] = [];
    for (const cat of categories) {
      for (const entry of cat.entries) {
        if (entry.date >= point.periodKey && entry.date <= point.periodKey) {
          allEntriesInBucket.push(entry);
        }
      }
    }
    setDetailsTitle(`Lançamentos do Período — ${point.label}`);
    setDetailsEntries(allEntriesInBucket);
    setDetailsOpen(true);
  };

  const handleOpenUnassignedInvoiceDay = () => {
    setDetailsTitle('Compras de Cartão com data fora do mês civil');
    setDetailsEntries(itemsWithoutInvoiceDayEntries);
    setDetailsOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Seletor de séries ativas */}
      <div className="bg-card p-4 rounded-xl border border-border space-y-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
          Categorias em Destaque na Evolução
        </span>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat, idx) => {
            const isSelected = selectedCatIds.includes(cat.categoryId);
            const color = PALETTE[idx % PALETTE.length];
            return (
              <button
                key={cat.categoryId}
                type="button"
                onClick={() => toggleCategorySeries(cat.categoryId)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'border-transparent text-white font-medium shadow-xs'
                    : 'border-border text-muted-foreground hover:bg-muted'
                }`}
                style={{
                  backgroundColor: isSelected ? color : undefined,
                }}
              >
                <span>{cat.categoryName}</span>
                <span className="opacity-75">({formatCurrency(cat.total)})</span>
              </button>
            );
          })}
        </div>
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
              {selectedCatIds.map((catId, idx) => {
                const catObj = categories.find(c => c.categoryId === catId);
                const color = PALETTE[idx % PALETTE.length];
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
                      <td key={pt.periodKey} className="p-3 text-right text-muted-foreground">
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
                  <td key={pt.periodKey} className="p-3 text-right text-foreground">
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
      />
    </div>
  );
}
