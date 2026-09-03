import React, { useState } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import type { CashFlowPoint, CashFlowReportResult, NormalizedTransaction } from '../../types/reports';
import { formatCurrency } from '../../lib/utils';
import { ReportDetailsDialog } from './ReportDetailsDialog';
import { ArrowUpRight, ArrowDownRight, Scale, Wallet, Clock, ArrowLeftRight, Info, CreditCard, ShieldCheck, ShieldAlert } from 'lucide-react';

interface CashFlowChartProps {
  reportResult: CashFlowReportResult;
  showPending: boolean;
  entityNames?: Record<string, string>;
}

function CustomCashFlowTooltip({ active, payload, showPending }: any) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="bg-popover border border-border p-3 rounded-xl shadow-xl text-xs space-y-2 min-w-[210px]">
      <div className="font-semibold text-foreground pb-1 border-b border-border/60">
        {data.label}
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3 text-emerald-600 dark:text-emerald-400">
          <span>Entradas:</span>
          <span className="font-mono font-medium">+{formatCurrency(data.entradas)}</span>
        </div>
        <div className="flex items-center justify-between gap-3 text-rose-600 dark:text-rose-400">
          <span>Saídas:</span>
          <span className="font-mono font-medium">-{formatCurrency(data.saidas)}</span>
        </div>
        <div className="flex items-center justify-between gap-3 text-muted-foreground pt-1 border-t border-border/40 font-medium">
          <span>Resultado:</span>
          <span className={`font-mono ${data.resultado >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {data.resultado >= 0 ? '+' : ''}{formatCurrency(data.resultado)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 text-blue-600 dark:text-blue-400 pt-1 border-t border-border/40 font-semibold">
          <span>{showPending ? 'Saldo Previsto:' : 'Saldo Acumulado:'}</span>
          <span className="font-mono">{formatCurrency(data.saldo)}</span>
        </div>
      </div>
    </div>
  );
}

export function CashFlowChart({ reportResult, showPending, entityNames }: CashFlowChartProps) {
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

  const projectedBalance = points.length > 0
    ? (points[points.length - 1].projectedEndingBalanceCents ?? 0) / 100
    : undefined;

  // Derivação correta da curva de saldo: quando showPending estiver ativo,
  // utiliza o saldo projetado acumulado (que já incorpora as faturas e pendências).
  const chartData = points.map(pt => {
    const ptSaldo = showPending && pt.projectedEndingBalanceCents !== undefined
      ? pt.projectedEndingBalanceCents / 100
      : (pt.endingBalance ?? 0);
    return {
      label: pt.label,
      periodKey: pt.periodKey,
      entradas: pt.inflow,
      saidas: pt.outflow,
      resultado: pt.result,
      saldo: ptSaldo,
    };
  });

  // Diagnóstico de menor saldo do período para conferência de cobertura
  const minSaldoPoint = points.length > 0
    ? points.reduce((min, curr) => {
        const currVal = showPending && curr.projectedEndingBalanceCents !== undefined
          ? curr.projectedEndingBalanceCents / 100
          : (curr.endingBalance ?? 0);
        const minVal = showPending && min.projectedEndingBalanceCents !== undefined
          ? min.projectedEndingBalanceCents / 100
          : (min.endingBalance ?? 0);
        return currVal < minVal ? curr : min;
      }, points[0])
    : null;

  const minSaldoVal = minSaldoPoint
    ? (showPending && minSaldoPoint.projectedEndingBalanceCents !== undefined
        ? minSaldoPoint.projectedEndingBalanceCents / 100
        : (minSaldoPoint.endingBalance ?? 0))
    : undefined;

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
            {showPending ? 'Entradas realizadas e pendentes' : 'Receitas bancárias realizadas'}
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
            {showPending ? 'Saídas realizadas e pendentes' : 'Despesas bancárias e pagamentos de fatura'}
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
            {showPending ? 'Resultado previsto (inclui pendências)' : 'Entradas menos saídas realizadas'}
          </span>
        </div>

        {/* Saldo Final / Previsto */}
        <div className="bg-card p-4 rounded-xl border border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {showPending ? 'Saldo Previsto' : 'Saldo Final'}
            </span>
            <div className="p-1.5 rounded-full bg-blue-500/10 text-blue-500">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {showPending && projectedBalance !== undefined
              ? formatCurrency(projectedBalance)
              : endingBalance !== undefined
                ? formatCurrency(endingBalance)
                : '-'}
          </div>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">
            Inicial: {startingBalance !== undefined ? formatCurrency(startingBalance) : '-'}
          </span>
        </div>
      </div>

      {/* Banner de Diagnóstico de Cobertura */}
      {minSaldoVal !== undefined && (
        <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
          minSaldoVal >= 0
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-950 dark:text-emerald-200'
            : 'bg-rose-500/10 border-rose-500/20 text-rose-950 dark:text-rose-200'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-lg shrink-0 ${
              minSaldoVal >= 0 ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
            }`}>
              {minSaldoVal >= 0 ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
            </div>
            <div>
              <span className="font-semibold block">
                {minSaldoVal >= 0
                  ? 'Cobertura total de pagamentos no período'
                  : 'Atenção: risco de insuficiência de saldo no período'}
              </span>
              <span className="text-muted-foreground text-[11px]">
                {minSaldoVal >= 0
                  ? 'Todas as obrigações e contas previstas mantêm o saldo bancário positivo ao longo do intervalo.'
                  : 'Em determinado ponto do período as despesas e faturas previstas superam a liquidez disponível.'}
              </span>
            </div>
          </div>
          <div className="sm:text-right shrink-0">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
              Menor saldo {showPending ? 'previsto' : 'atingido'}
            </span>
            <span className={`text-sm font-mono font-bold ${minSaldoVal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {formatCurrency(minSaldoVal)}
            </span>
            {minSaldoPoint && (
              <span className="text-[10px] text-muted-foreground block">
                em {minSaldoPoint.label}
              </span>
            )}
          </div>
        </div>
      )}

      {(reportResult.openingCapitalCents !== 0 || reportResult.priorPendingCents !== 0 || reportResult.diagnostics.invalidCount > 0 || (showPending && reportResult.invoiceObligationsCents > 0)) && (
        <div className="flex flex-col gap-1.5 p-3 bg-muted/40 border border-border rounded-lg text-xs text-muted-foreground">
          {reportResult.openingCapitalCents !== 0 && (
            <span className="flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-primary shrink-0" />
              Capital de abertura de contas abertas no período: <strong>{formatCurrency(reportResult.openingCapitalCents / 100)}</strong> — exibido como Saldo de abertura, não como receita.
            </span>
          )}
          {reportResult.priorPendingCents !== 0 && (
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              Pendentes anteriores ao período: <strong>{formatCurrency(reportResult.priorPendingCents / 100)}</strong> — sinalizados fora do período, sem incorporação silenciosa.
            </span>
          )}
          {showPending && reportResult.invoiceObligationsCents > 0 && (
            <span className="flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              {reportResult.invoiceObligationsIncludedInPoints ? (
                <>
                  Faturas de cartão (valor residual) incluídas nas pendências: <strong>{formatCurrency(reportResult.invoiceObligationsCents / 100)}</strong> — distribuídas pelo vencimento.
                </>
              ) : (
                <>
                  Faturas de cartão com conta a definir, não alocadas à seleção: <strong>{formatCurrency(reportResult.invoiceObligationsCents / 100)}</strong> — não debitadas de nenhuma conta selecionada.
                </>
              )}
            </span>
          )}
          {reportResult.diagnostics.invalidCount > 0 && (
            <span className="flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              Diagnóstico: {reportResult.diagnostics.invalidCount} registro(s) não contabilizado(s) por data/valor inválido; {reportResult.diagnostics.excludedCount} cancelado(s) excluído(s).
            </span>
          )}
        </div>
      )}

      {/* Gráfico Integrado: Movimentações (Barras) + Evolução do Saldo (Linha Contínua) */}
      <div className="bg-card p-4 sm:p-5 rounded-xl border border-border space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Visão Integrada de Caixa
            </span>
            <p className="text-xs text-muted-foreground mt-0.5">
              {showPending
                ? 'Barras mostram receitas e despesas/faturas previstas no período; a linha indica o nível de saldo resultante.'
                : 'Barras mostram receitas e despesas realizadas; a linha indica a evolução do saldo de caixa.'}
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 shrink-0" />
              Entradas (Esq.)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 shrink-0" />
              Saídas (Esq.)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-blue-500 shrink-0" />
              Saldo {showPending ? 'Previsto' : 'de Caixa'} (Dir.)
            </span>
          </div>
        </div>

        <div className="h-80 sm:h-96 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 15, left: -5, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis
                yAxisId="movimento"
                orientation="left"
                tick={{ fontSize: 11 }}
                tickFormatter={v => `R$ ${Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
              />
              <YAxis
                yAxisId="saldo"
                orientation="right"
                tick={{ fontSize: 11 }}
                tickFormatter={v => `R$ ${Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
              />
              <Tooltip content={<CustomCashFlowTooltip showPending={showPending} />} />
              <ReferenceLine y={0} yAxisId="saldo" stroke="currentColor" strokeOpacity={0.35} strokeDasharray="3 3" />
              <Bar
                yAxisId="movimento"
                dataKey="entradas"
                name="Entradas"
                fill="#10b981"
                radius={[3, 3, 0, 0]}
                maxBarSize={36}
              />
              <Bar
                yAxisId="movimento"
                dataKey="saidas"
                name="Saídas"
                fill="#ef4444"
                radius={[3, 3, 0, 0]}
                maxBarSize={36}
              />
              <Line
                yAxisId="saldo"
                type="monotone"
                dataKey="saldo"
                name={showPending ? 'Saldo Previsto' : 'Saldo de Caixa'}
                stroke="#3b82f6"
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: '#3b82f6' }}
                activeDot={{ r: 6 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

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
                <th className="p-3 font-semibold text-right">Saldo {showPending ? 'Previsto' : 'Final'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {points.map(pt => {
                const externalTransfers = pt.entries.filter(
                  e => e.type === 'transfer' && (e.isValid === undefined || e.isValid)
                ).length;
                return (
                  <tr
                    key={pt.periodKey}
                    onClick={() => handleOpenDetails(pt)}
                    className="hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <td className="p-3 font-medium text-foreground">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{pt.label}</span>
                        {pt.hasPending && (
                          <span title="Possui pendências no período">
                            <Clock className="w-3 h-3 text-amber-500 shrink-0" />
                          </span>
                        )}
                        {externalTransfers > 0 && (
                          <span title={`${externalTransfers} transferência(s) com origem/destino fora da seleção`}>
                            <ArrowLeftRight className="w-3 h-3 text-blue-500 shrink-0" />
                          </span>
                        )}
                      </div>
                      {showPending && (pt.pendingInflowCents !== 0 || pt.pendingOutflowCents !== 0) && (
                        <div className="mt-1 text-[10px] text-muted-foreground flex items-center gap-1 flex-wrap">
                          <span className="text-amber-600 dark:text-amber-400 font-medium">Pendentes:</span>
                          {pt.pendingInflowCents !== 0 && <span>+{formatCurrency(pt.pendingInflowCents / 100)} entradas</span>}
                          {pt.pendingOutflowCents !== 0 && <span>-{formatCurrency(pt.pendingOutflowCents / 100)} saídas</span>}
                        </div>
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
                      {showPending && pt.projectedEndingBalanceCents !== undefined
                        ? formatCurrency(pt.projectedEndingBalanceCents / 100)
                        : pt.endingBalance !== undefined
                          ? formatCurrency(pt.endingBalance)
                          : '-'}
                    </td>
                  </tr>
                );
              })}
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
                  {showPending && projectedBalance !== undefined
                    ? formatCurrency(projectedBalance)
                    : endingBalance !== undefined
                      ? formatCurrency(endingBalance)
                      : '-'}
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
          context={{ type: 'cashflow' }}
          entityNames={entityNames}
        />
      )}
    </div>
  );
}
