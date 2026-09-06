import React, { useState } from 'react';
import { SimulationMonthPoint, SimulationIntervalType } from '../../types/simulator';
import { Calendar, ArrowRight, Eye, EyeOff, ChevronRight } from 'lucide-react';

interface SimulationMonthTableProps {
  monthPoints: SimulationMonthPoint[];
  intervalType?: SimulationIntervalType;
  safetyReserve?: number;
  onSelectPoint?: (point: SimulationMonthPoint) => void;
}

export function SimulationMonthTable({
  monthPoints,
  intervalType = 'month',
  safetyReserve = 0,
  onSelectPoint,
}: SimulationMonthTableProps) {
  const [hideEmptyDays, setHideEmptyDays] = useState(false);
  const fmt = (val: number) =>
    `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const isDaily = intervalType === 'day';

  const displayPoints = isDaily && hideEmptyDays
    ? monthPoints.filter(p => p.simulatedInflow > 0 || p.simulatedOutflow > 0 || p.inflowDelta !== 0 || p.outflowDelta !== 0)
    : monthPoints;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
      <div className="p-4 sm:p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-fiducia-blue/10 text-fiducia-blue flex items-center justify-center">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-foreground">
              {isDaily ? 'Comparativo Diário de Fluxo de Caixa' : 'Comparativo Mensal de Fluxo de Caixa'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {isDaily
                ? 'Clique em qualquer dia para ver os lançamentos detalhados'
                : 'Clique em qualquer mês para ver os lançamentos detalhados'}
            </p>
          </div>
        </div>

        {isDaily && (
          <button
            type="button"
            onClick={() => setHideEmptyDays(prev => !prev)}
            className="self-start sm:self-auto px-2.5 py-1 rounded-lg text-xs font-semibold border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {hideEmptyDays ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>{hideEmptyDays ? 'Exibir todos os dias' : 'Ocultar dias sem movimentação'}</span>
          </button>
        )}
      </div>

      <div className="overflow-x-auto max-h-[460px]">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-border bg-muted/80 backdrop-blur-xs text-muted-foreground font-semibold">
              <th className="py-3 px-4">{isDaily ? 'Dia' : 'Mês'}</th>
              <th className="py-3 px-4">Entradas (Real vs Simulado)</th>
              <th className="py-3 px-4">Saídas & Faturas (Real vs Simulado)</th>
              <th className="py-3 px-4">{isDaily ? 'Resultado do Dia' : 'Resultado do Mês'}</th>
              <th className="py-3 px-4 text-right">Saldo Final Previsto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {displayPoints.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted-foreground text-xs">
                  Nenhuma movimentação encontrada nos dias filtrados.
                </td>
              </tr>
            ) : (
              displayPoints.map((pt) => {
                const hasInflowDelta = pt.inflowDelta !== 0;
                const hasOutflowDelta = pt.outflowDelta !== 0;
                const isNegativeFinal = pt.simulatedEndingBalance < 0;
                const isConsumingReserve = safetyReserve > 0 && (pt.simulatedEndingBalance - safetyReserve < 0) && !isNegativeFinal;

                return (
                  <tr
                    key={pt.monthKey}
                    onClick={() => onSelectPoint?.(pt)}
                    className="hover:bg-muted/40 transition-colors cursor-pointer group"
                    title="Clique para ver os lançamentos deste período"
                  >
                    {/* Data / Mês */}
                    <td className="py-3 px-4 font-bold text-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="group-hover:text-fiducia-blue transition-colors">{pt.monthLabel}</span>
                        <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-fiducia-blue transition-opacity shrink-0" />
                      </div>
                    </td>

                    {/* Entradas */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-baseline gap-1.5 font-mono">
                        {hasInflowDelta ? (
                          <>
                            <span className="text-muted-foreground line-through text-[11px]">
                              {fmt(pt.realInflow)}
                            </span>
                            <ArrowRight className="w-3 h-3 text-muted-foreground" />
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              {fmt(pt.simulatedInflow)}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-sans font-semibold">
                              +{fmt(pt.inflowDelta)}
                            </span>
                          </>
                        ) : (
                          <span className={pt.realInflow > 0 ? 'text-foreground' : 'text-muted-foreground/60'}>
                            {fmt(pt.realInflow)}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Saídas & Faturas */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-baseline gap-1.5 font-mono">
                        {hasOutflowDelta ? (
                          <>
                            <span className="text-muted-foreground line-through text-[11px]">
                              {fmt(pt.realOutflow)}
                            </span>
                            <ArrowRight className="w-3 h-3 text-muted-foreground" />
                            <span className="font-bold text-rose-600 dark:text-rose-400">
                              {fmt(pt.simulatedOutflow)}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 font-sans font-semibold">
                              +{fmt(pt.outflowDelta)}
                            </span>
                          </>
                        ) : (
                          <span className={pt.realOutflow > 0 ? 'text-foreground' : 'text-muted-foreground/60'}>
                            {fmt(pt.realOutflow)}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Resultado Líquido */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className={`font-mono font-medium ${
                        pt.simulatedNetResult > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : pt.simulatedNetResult < 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-muted-foreground/60'
                      }`}>
                        {pt.simulatedNetResult > 0 ? '+' : ''}{fmt(pt.simulatedNetResult)}
                      </div>
                    </td>

                    {/* Saldo Final Previsto */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex flex-col items-end">
                        <div className="flex items-baseline gap-1.5 font-mono">
                          {pt.endingBalanceDelta !== 0 && (
                            <>
                              <span className="text-muted-foreground line-through text-[11px]">
                                {fmt(pt.realEndingBalance)}
                              </span>
                              <ArrowRight className="w-3 h-3 text-muted-foreground" />
                            </>
                          )}
                          <span className={`font-bold text-sm ${
                            isNegativeFinal
                              ? 'text-fiducia-red'
                              : isConsumingReserve
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-fiducia-green'
                          }`}>
                            {fmt(pt.simulatedEndingBalance)}
                          </span>
                        </div>
                        {pt.endingBalanceDelta !== 0 && (
                          <span className={`text-[10px] font-mono font-semibold ${
                            pt.endingBalanceDelta < 0 ? 'text-fiducia-red' : 'text-fiducia-green'
                          }`}>
                            {pt.endingBalanceDelta > 0 ? '+' : ''}{fmt(pt.endingBalanceDelta)}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
