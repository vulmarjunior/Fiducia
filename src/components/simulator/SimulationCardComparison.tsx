import React from 'react';
import { SimulationSummary } from '../../types/simulator';
import { ArrowRight, TrendingUp, TrendingDown, Wallet } from 'lucide-react';

interface SimulationCardComparisonProps {
  summary: SimulationSummary;
  horizonLabel: string;
  safetyReserve?: number;
}

export function SimulationCardComparison({
  summary,
  horizonLabel,
  safetyReserve = 0,
}: SimulationCardComparisonProps) {
  const fmt = (val: number) =>
    `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const isAtDeficit = summary.simulatedFinalBalance < 0;
  const isConsumingReserve = safetyReserve > 0 && (summary.simulatedFinalBalance - safetyReserve < 0) && !isAtDeficit;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Saldo Final Previsto */}
      <div className={`p-4 rounded-2xl border transition-all ${
        isAtDeficit
          ? 'bg-rose-500/5 border-rose-500/30'
          : isConsumingReserve
            ? 'bg-amber-500/5 border-amber-500/30'
            : 'bg-card border-border'
      } shadow-xs flex flex-col justify-between`}>
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Saldo Final Previsto ({horizonLabel})
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              isAtDeficit
                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                : isConsumingReserve
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
            }`}>
              {isAtDeficit ? 'Déficit' : isConsumingReserve ? 'Consome Reserva' : 'Positivo'}
            </span>
          </div>

          <div className="flex items-baseline gap-2 mb-1">
            <div className="text-[13px] font-mono text-muted-foreground line-through">
              {fmt(summary.realFinalBalance)}
            </div>
            <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
            <div className={`text-[22px] font-bold font-mono tracking-tight ${
              summary.simulatedFinalBalance < 0 ? 'text-fiducia-red' : 'text-fiducia-green'
            }`}>
              {fmt(summary.simulatedFinalBalance)}
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-border/60 text-[11px] flex items-center justify-between text-muted-foreground">
          <span>Impacto no bolso:</span>
          <strong className={`font-mono font-bold ${summary.finalBalanceDelta < 0 ? 'text-fiducia-red' : summary.finalBalanceDelta > 0 ? 'text-fiducia-green' : 'text-muted-foreground'}`}>
            {summary.finalBalanceDelta > 0 ? '+' : ''}{fmt(summary.finalBalanceDelta)}
          </strong>
        </div>
      </div>

      {/* 2. Total de Entradas Previstas */}
      <div className="p-4 rounded-2xl bg-card border border-border shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Entradas Previstas
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>

          <div className="flex items-baseline gap-2 mb-1">
            <div className="text-[13px] font-mono text-muted-foreground line-through">
              {fmt(summary.realTotalInflow)}
            </div>
            <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
            <div className="text-[22px] font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
              {fmt(summary.simulatedTotalInflow)}
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-border/60 text-[11px] flex items-center justify-between text-muted-foreground">
          <span>Receitas simuladas:</span>
          <strong className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
            +{fmt(summary.inflowDelta)}
          </strong>
        </div>
      </div>

      {/* 3. Saídas e Faturas Previstas */}
      <div className="p-4 rounded-2xl bg-card border border-border shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Saídas e Faturas
            </span>
            <TrendingDown className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>

          <div className="flex items-baseline gap-2 mb-1">
            <div className="text-[13px] font-mono text-muted-foreground line-through">
              {fmt(summary.realTotalOutflow)}
            </div>
            <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
            <div className="text-[22px] font-bold font-mono tracking-tight text-rose-600 dark:text-rose-400">
              {fmt(summary.simulatedTotalOutflow)}
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-border/60 text-[11px] flex items-center justify-between text-muted-foreground">
          <span>Gastos / Parcelas simulados:</span>
          <strong className="font-mono font-semibold text-rose-600 dark:text-rose-400">
            +{fmt(summary.outflowDelta)}
          </strong>
        </div>
      </div>

      {/* 4. Variação Líquida de Caixa */}
      <div className="p-4 rounded-2xl bg-card border border-border shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Variação Líquida (Delta)
            </span>
            <Wallet className="w-4 h-4 text-fiducia-blue" />
          </div>

          <div className="flex items-baseline gap-2 mb-1">
            <div className={`text-[22px] font-bold font-mono tracking-tight ${
              summary.finalBalanceDelta < 0
                ? 'text-fiducia-red'
                : summary.finalBalanceDelta > 0
                  ? 'text-fiducia-green'
                  : 'text-foreground'
            }`}>
              {summary.finalBalanceDelta > 0 ? '+' : ''}{fmt(summary.finalBalanceDelta)}
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-border/60 text-[11px] flex items-center justify-between text-muted-foreground">
          <span>Saldo inicial do caixa:</span>
          <strong className="font-mono font-semibold text-foreground">
            {fmt(summary.initialBalance)}
          </strong>
        </div>
      </div>
    </div>
  );
}
