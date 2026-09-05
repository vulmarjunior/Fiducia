import React from 'react';
import { SimulationComparison } from '../../types/simulator';
import { ShieldCheck, ShieldAlert, AlertTriangle, TrendingDown, ArrowRight, Calendar, Info } from 'lucide-react';

interface SimulationCardComparisonProps {
  comparison: SimulationComparison;
  days: number;
  safetyReserve: number;
}

export function SimulationCardComparison({
  comparison,
  days,
  safetyReserve,
}: SimulationCardComparisonProps) {
  const fmt = (val: number) =>
    `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const fmtDate = (dStr: string) => {
    if (!dStr) return '—';
    const [y, m, d] = dStr.split('-');
    return `${d}/${m}/${y}`;
  };

  const isAtDeficitRisk = comparison.simulatedMinBalance < 0;
  const isConsumingReserve = comparison.simulatedMargin < 0 && !isAtDeficitRisk;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Card Folga Livre (Margem de Caixa) */}
      <div className={`p-4 rounded-2xl border transition-all ${
        isAtDeficitRisk
          ? 'bg-rose-500/5 border-rose-500/30'
          : isConsumingReserve
            ? 'bg-amber-500/5 border-amber-500/30'
            : 'bg-card border-border'
      } shadow-xs flex flex-col justify-between`}>
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Folga Livre ({days}d)
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              isAtDeficitRisk
                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                : isConsumingReserve
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
            }`}>
              {isAtDeficitRisk ? 'Déficit' : isConsumingReserve ? 'Consome Reserva' : 'Seguro'}
            </span>
          </div>

          <div className="flex items-baseline gap-2 mb-1">
            <div className="text-[13px] font-mono text-muted-foreground line-through">
              {fmt(comparison.realMargin)}
            </div>
            <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
            <div className={`text-[22px] font-bold font-mono tracking-tight ${
              comparison.simulatedMargin < 0 ? 'text-fiducia-red' : 'text-fiducia-green'
            }`}>
              {fmt(comparison.simulatedMargin)}
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-border/60 text-[11px] flex items-center justify-between text-muted-foreground">
          <span>Impacto na margem:</span>
          <strong className={`font-mono font-bold ${comparison.marginDelta < 0 ? 'text-fiducia-red' : 'text-fiducia-green'}`}>
            {comparison.marginDelta > 0 ? '+' : ''}{fmt(comparison.marginDelta)}
          </strong>
        </div>
      </div>

      {/* 2. Card Pior Saldo Previsto (Menor Saldo) */}
      <div className="p-4 rounded-2xl bg-card border border-border shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Menor Saldo Previsto
            </span>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Calendar className="w-3 h-3" />
              <span>{fmtDate(comparison.simulatedMinBalanceDate)}</span>
            </div>
          </div>

          <div className="flex items-baseline gap-2 mb-1">
            <div className="text-[13px] font-mono text-muted-foreground line-through">
              {fmt(comparison.realMinBalance)}
            </div>
            <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
            <div className={`text-[22px] font-bold font-mono tracking-tight ${
              comparison.simulatedMinBalance < 0 ? 'text-fiducia-red' : 'text-foreground'
            }`}>
              {fmt(comparison.simulatedMinBalance)}
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-border/60 text-[11px] flex items-center justify-between text-muted-foreground">
          <span>Reserva protegida:</span>
          <strong className="font-mono font-semibold text-foreground">
            {fmt(safetyReserve)}
          </strong>
        </div>
      </div>

      {/* 3. Card Dias em Risco de Déficit */}
      <div className="p-4 rounded-2xl bg-card border border-border shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Dias com Saldo Negativo
            </span>
            {comparison.simulatedDaysAtRisk > 0 ? (
              <ShieldAlert className="w-4 h-4 text-fiducia-red" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-fiducia-green" />
            )}
          </div>

          <div className="flex items-baseline gap-2 mb-1">
            <div className="text-[13px] font-mono text-muted-foreground line-through">
              {comparison.realDaysAtRisk} dia{comparison.realDaysAtRisk !== 1 ? 's' : ''}
            </div>
            <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
            <div className={`text-[22px] font-bold font-mono tracking-tight ${
              comparison.simulatedDaysAtRisk > 0 ? 'text-fiducia-red' : 'text-fiducia-green'
            }`}>
              {comparison.simulatedDaysAtRisk} dia{comparison.simulatedDaysAtRisk !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-border/60 text-[11px] flex items-center justify-between text-muted-foreground">
          <span>Variação de risco:</span>
          <strong className={comparison.simulatedDaysAtRisk > comparison.realDaysAtRisk ? 'text-fiducia-red' : 'text-foreground'}>
            {comparison.simulatedDaysAtRisk > comparison.realDaysAtRisk
              ? `+${comparison.simulatedDaysAtRisk - comparison.realDaysAtRisk} dia(s) crítico(s)`
              : 'Sem aumento de risco'}
          </strong>
        </div>
      </div>

      {/* 4. Card Saldo Final Projetado */}
      <div className="p-4 rounded-2xl bg-card border border-border shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Saldo Final ({days}d)
            </span>
            <TrendingDown className="w-4 h-4 text-fiducia-blue" />
          </div>

          <div className="flex items-baseline gap-2 mb-1">
            <div className="text-[13px] font-mono text-muted-foreground line-through">
              {fmt(comparison.realEndingBalance)}
            </div>
            <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
            <div className={`text-[22px] font-bold font-mono tracking-tight ${
              comparison.simulatedEndingBalance < 0 ? 'text-fiducia-red' : 'text-fiducia-blue'
            }`}>
              {fmt(comparison.simulatedEndingBalance)}
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-border/60 text-[11px] flex items-center justify-between text-muted-foreground">
          <span>Impacto líquido total:</span>
          <strong className={`font-mono font-bold ${comparison.endingBalanceDelta < 0 ? 'text-fiducia-red' : 'text-fiducia-green'}`}>
            {comparison.endingBalanceDelta > 0 ? '+' : ''}{fmt(comparison.endingBalanceDelta)}
          </strong>
        </div>
      </div>
    </div>
  );
}
