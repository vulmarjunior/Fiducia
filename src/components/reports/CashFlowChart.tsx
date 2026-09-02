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
  LineChart,
  Line,
} from 'recharts';
import type { CashFlowPoint, CashFlowReportResult, NormalizedTransaction } from '../../types/reports';
import { formatCurrency } from '../../lib/utils';
import { ReportDetailsDialog } from './ReportDetailsDialog';
import { ArrowUpRight, ArrowDownRight, Scale, Wallet, Clock } from 'lucide-react';

interface CashFlowChartProps {
  reportResult: CashFlowReportResult;
  showPending: boolean;
}

export function CashFlowChart({ reportResult, showPending }: CashFlowChartProps) {
  const {
    totalInflow,
    totalOutflow,
    netResult,
    startingBalance,
    endingBalance,
    points,
  } = reportResult;

  const [selectedPoint, setSelectedPoint] = useState<CashFlowPoint | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const handleOpenDetails = (pt: CashFlowPoint) => {
    setSelectedPoint(pt);
    setDetailsOpen(true);
  };

  const chartData = points.map(pt => ({
    label: pt.label,
    periodKey: pt.periodKey,
    entradas: pt.inflow,
    saidas: pt.outflow,
    resultado: pt.result,
    saldo: pt.endingBalance,
  }));

  return (
    <div className="space-y-6">
      {/* 4 Cards de Indicadores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Entradas */}
        <div className="bg-card p-4 rounded-xl border border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Entradas
            </span>
            <div className="p-1.5 rounded-full bg-emerald-500/10 text-emerald-500">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(totalInflow)}
          </div>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">
            Receitas bancárias realizadas
          </span>
        </div>

        {/* Saídas */}
        <div className="bg-card p-4 rounded-xl border border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Saídas
            </span>
            <div className="p-1.5 rounded-full bg-rose-500/10 text-rose-500">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400">
            {formatCurrency(totalOutflow)}
          </div>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">
            Despesas bancárias e pagamentos de fatura
          </span>
        </div>

        {/* Resultado Líquido */}
        <div className="bg-card p-4 rounded-xl border border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Resultado Líquido
            </span>
            <div className={`p-1.5 rounded-full ${
              netResult >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
            }`}>
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className={`mt-2 text-2xl font-bold ${
            netResult >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
          }`}>
            {formatCurrency(netResult)}
          </div>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">
            Entradas menos saídas
          </span>
        </div>

        {/* Saldo Final */}
        <div className="bg-card p-4 rounded-xl border border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Saldo Final
            </span>
            <div className="p-1.5 rounded-full bg-blue-500/10 text-blue-500">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {endingBalance !== undefined ? formatCurrency(endingBalance) : '-'}
          </div>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">
            Inicial: {startingBalance !== undefined ? formatCurrency(startingBalance) : '-'}
          </span>
        </div>
      </div>

      {/* Gráfico 1: Entradas x Saídas */}
      <div className="bg-card p-4 rounded-xl border border-border space-y-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
          Comparativo de Movimentação (Entradas × Saídas)
        </span>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$ ${v}`} />
              <Tooltip formatter={(val: any) => [formatCurrency(Number(val)), '']} />
              <Legend />
              <Bar dataKey="entradas" name="Entradas" fill="#10b981" radius={[3, 3, 0, 0]} />
              <Bar dataKey="saidas" name="Saídas" fill="#ef4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gráfico 2: Evolução de Saldo em Escala Separada */}
      {endingBalance !== undefined && (
        <div className="bg-card p-4 rounded-xl border border-border space-y-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
            Evolução do Saldo de Caixa
          </span>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$ ${v}`} />
                <Tooltip formatter={(val: any) => [formatCurrency(Number(val)), 'Saldo']} />
                <Line
                  type="monotone"
                  dataKey="saldo"
                  name="Saldo de Caixa"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tabela de Conferência */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-3 border-b border-border bg-muted/30 flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Detalhamento por Período
          </span>
          <span className="text-xs text-muted-foreground">
            Clique em uma linha para ver os lançamentos
          </span>
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/50 text-muted-foreground border-b border-border sticky top-0">
              <tr>
                <th className="p-3 font-semibold">Período</th>
                <th className="p-3 font-semibold text-right">Entradas</th>
                <th className="p-3 font-semibold text-right">Saídas</th>
                <th className="p-3 font-semibold text-right">Resultado</th>
                <th className="p-3 font-semibold text-right">Saldo Final</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {points.map(pt => (
                <tr
                  key={pt.periodKey}
                  onClick={() => handleOpenDetails(pt)}
                  className="hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <td className="p-3 font-medium text-foreground flex items-center gap-1.5">
                    <span>{pt.label}</span>
                    {pt.hasPending && (
                      <span title="Possui pendências no período">
                        <Clock className="w-3 h-3 text-amber-500 shrink-0" />
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(pt.inflow)}
                  </td>
                  <td className="p-3 text-right font-medium text-rose-600 dark:text-rose-400">
                    {formatCurrency(pt.outflow)}
                  </td>
                  <td className={`p-3 text-right font-semibold ${
                    pt.result >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}>
                    {formatCurrency(pt.result)}
                  </td>
                  <td className="p-3 text-right text-foreground font-medium">
                    {pt.endingBalance !== undefined ? formatCurrency(pt.endingBalance) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/30 font-semibold border-t border-border">
              <tr>
                <td className="p-3 text-foreground">Total</td>
                <td className="p-3 text-right text-emerald-600 dark:text-emerald-400 font-bold">
                  {formatCurrency(totalInflow)}
                </td>
                <td className="p-3 text-right text-rose-600 dark:text-rose-400 font-bold">
                  {formatCurrency(totalOutflow)}
                </td>
                <td className={`p-3 text-right font-bold ${
                  netResult >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}>
                  {formatCurrency(netResult)}
                </td>
                <td className="p-3 text-right text-foreground font-bold">
                  {endingBalance !== undefined ? formatCurrency(endingBalance) : '-'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Modal de Detalhes do Período */}
      {selectedPoint && (
        <ReportDetailsDialog
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          title={`Lançamentos — ${selectedPoint.label}`}
          subtitle={`${selectedPoint.entries.length} lançamento(s) de caixa no período`}
          entries={selectedPoint.entries}
        />
      )}
    </div>
  );
}
