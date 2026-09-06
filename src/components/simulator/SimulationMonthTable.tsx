import React from 'react';
import { SimulationMonthPoint } from '../../types/simulator';
import { Calendar, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';

interface SimulationMonthTableProps {
  monthPoints: SimulationMonthPoint[];
  safetyReserve?: number;
}

export function SimulationMonthTable({
  monthPoints,
  safetyReserve = 0,
}: SimulationMonthTableProps) {
  const fmt = (val: number) =>
    `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
      <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-fiducia-blue/10 text-fiducia-blue flex items-center justify-center">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-foreground">
              Comparativo Mensal de Fluxo de Caixa
            </h3>
            <p className="text-xs text-muted-foreground">
              Acompanhe mês a mês como as hipóteses afetam entradas, faturas e o saldo final previsto
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
              <th className="py-3 px-4">Mês</th>
              <th className="py-3 px-4">Entradas (Real vs Simulado)</th>
              <th className="py-3 px-4">Saídas & Faturas (Real vs Simulado)</th>
              <th className="py-3 px-4">Resultado do Mês</th>
              <th className="py-3 px-4 text-right">Saldo Final Previsto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {monthPoints.map((pt) => {
              const hasInflowDelta = pt.inflowDelta !== 0;
              const hasOutflowDelta = pt.outflowDelta !== 0;
              const isNegativeFinal = pt.simulatedEndingBalance < 0;
              const isConsumingReserve = safetyReserve > 0 && (pt.simulatedEndingBalance - safetyReserve < 0) && !isNegativeFinal;

              return (
                <tr key={pt.monthKey} className="hover:bg-muted/20 transition-colors">
                  {/* Mês */}
                  <td className="py-3.5 px-4 font-bold text-foreground whitespace-nowrap">
                    {pt.monthLabel}
                  </td>

                  {/* Entradas */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
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
                        <span className="text-foreground">{fmt(pt.realInflow)}</span>
                      )}
                    </div>
                  </td>

                  {/* Saídas & Faturas */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
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
                        <span className="text-foreground">{fmt(pt.realOutflow)}</span>
                      )}
                    </div>
                  </td>

                  {/* Resultado do Mês */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className={`font-mono font-medium ${
                      pt.simulatedNetResult >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {pt.simulatedNetResult > 0 ? '+' : ''}{fmt(pt.simulatedNetResult)}
                    </div>
                  </td>

                  {/* Saldo Final Previsto */}
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
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
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
