import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { SimulationMonthPoint, SimulationIntervalType } from '../../types/simulator';

interface SimulationChartProps {
  data: SimulationMonthPoint[];
  intervalType?: SimulationIntervalType;
  safetyReserve?: number;
}

export function SimulationChart({
  data,
  intervalType = 'month',
  safetyReserve = 0,
}: SimulationChartProps) {
  const fmt = (v: number) =>
    `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const isDaily = intervalType === 'day';
  const minEnding = data.length > 0 ? Math.min(...data.map(d => d.simulatedEndingBalance)) : 0;
  const simColor =
    minEnding < 0
      ? '#ef4444' // red
      : minEnding < safetyReserve
        ? '#f59e0b' // amber
        : '#10b981'; // emerald

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
        <div>
          <h3 className="text-[14px] font-bold text-foreground">
            {isDaily ? 'Fluxo Diário e Trajetória do Saldo' : 'Fluxo Mensal e Trajetória do Saldo'}
          </h3>
          <p className="text-[11px] text-muted-foreground">
            {isDaily
              ? 'Barras mostram entradas e saídas de cada dia; as linhas comparam a trajetória do saldo diário'
              : 'Barras mostram as entradas e saídas simuladas; as linhas comparam a evolução do saldo final previsto'}
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold flex-wrap">
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <span className="w-2.5 h-2.5 rounded bg-emerald-500/80"></span>
            <span>Entradas</span>
          </div>
          <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
            <span className="w-2.5 h-2.5 rounded bg-rose-500/80"></span>
            <span>Saídas & Faturas</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="w-3 h-0.5 bg-muted-foreground/60 rounded-full"></span>
            <span>Saldo Base</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 rounded-full" style={{ backgroundColor: simColor }}></span>
            <span className="font-bold text-foreground">Saldo Simulado</span>
          </div>
        </div>
      </div>

      <div className="h-[300px] w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
            <XAxis
              dataKey="monthLabel"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: isDaily && data.length > 20 ? 9 : 11 }}
              dy={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => `R$${Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
            />

            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0]?.payload as SimulationMonthPoint;
                if (!point) return null;

                const titleLabel = isDaily
                  ? `Data: ${point.monthKey.split('-').reverse().join('/')}`
                  : `Mês: ${point.monthLabel}`;

                return (
                  <div className="bg-popover border border-border p-3 rounded-xl shadow-xl text-xs space-y-1.5 min-w-[220px]">
                    <div className="font-bold text-foreground border-b border-border pb-1">
                      {titleLabel}
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Entradas:</span>
                      <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {fmt(point.simulatedInflow)}
                        {point.inflowDelta !== 0 && ` (+${fmt(point.inflowDelta)})`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Saídas & Faturas:</span>
                      <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
                        {fmt(point.simulatedOutflow)}
                        {point.outflowDelta !== 0 && ` (+${fmt(point.outflowDelta)})`}
                      </span>
                    </div>
                    <div className="pt-1 border-t border-border flex items-center justify-between text-muted-foreground">
                      <span>Saldo Base:</span>
                      <span className="font-mono font-semibold text-foreground">
                        {fmt(point.realEndingBalance)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">Saldo Simulado:</span>
                      <span className="font-mono font-bold" style={{ color: simColor }}>
                        {fmt(point.simulatedEndingBalance)}
                      </span>
                    </div>
                  </div>
                );
              }}
            />

            <ReferenceLine y={0} stroke="currentColor" strokeOpacity={0.2} strokeDasharray="3 3" />
            {safetyReserve > 0 && (
              <ReferenceLine
                y={safetyReserve}
                stroke="#f59e0b"
                strokeOpacity={0.4}
                strokeDasharray="4 4"
                label={{
                  value: 'Reserva Protegida',
                  fill: '#f59e0b',
                  fontSize: 10,
                  position: 'insideTopRight',
                }}
              />
            )}

            {/* Barras de Entradas e Saídas */}
            <Bar dataKey="simulatedInflow" fill="#10b981" opacity={0.65} radius={[4, 4, 0, 0]} maxBarSize={isDaily ? 18 : 32} />
            <Bar dataKey="simulatedOutflow" fill="#f43f5e" opacity={0.65} radius={[4, 4, 0, 0]} maxBarSize={isDaily ? 18 : 32} />

            {/* Linha do Saldo Base Real */}
            <Line
              type="monotone"
              dataKey="realEndingBalance"
              stroke="#94a3b8"
              strokeWidth={1.8}
              strokeDasharray="4 4"
              dot={isDaily && data.length > 31 ? false : { r: 3, fill: '#94a3b8' }}
              isAnimationActive={false}
            />

            {/* Linha do Saldo Simulado */}
            <Line
              type="monotone"
              dataKey="simulatedEndingBalance"
              stroke={simColor}
              strokeWidth={2.5}
              dot={isDaily && data.length > 31 ? false : { r: 4, fill: simColor }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
