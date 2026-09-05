import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import { SimulationChartPoint } from '../../types/simulator';

interface SimulationChartProps {
  data: SimulationChartPoint[];
  safetyReserve: number;
  minSimulatedBalance: number;
}

export function SimulationChart({
  data,
  safetyReserve,
  minSimulatedBalance,
}: SimulationChartProps) {
  const fmt = (v: number) =>
    `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const simColor =
    minSimulatedBalance < 0
      ? '#ef4444' // red
      : minSimulatedBalance < safetyReserve
        ? '#f59e0b' // amber
        : '#10b981'; // emerald

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
        <div>
          <h3 className="text-[14px] font-bold text-foreground">Trajetória do Saldo: Real vs. Simulado</h3>
          <p className="text-[11px] text-muted-foreground">
            Acompanhe a curva dia a dia e identifique se as hipóteses aproximam seu caixa do limite de risco
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="w-3 h-0.5 bg-muted-foreground/60 rounded-full"></span>
            <span>Saldo Atual Confirmado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 rounded-full" style={{ backgroundColor: simColor }}></span>
            <span className="font-bold text-foreground">Com Hipóteses Simuladas</span>
          </div>
        </div>
      </div>

      <div className="h-[300px] w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="simAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={simColor} stopOpacity={0.18} />
                <stop offset="100%" stopColor={simColor} stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10 }}
              dy={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => `R$${Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
            />

            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0]?.payload as SimulationChartPoint;
                if (!point) return null;

                return (
                  <div className="bg-popover border border-border p-3 rounded-xl shadow-xl text-xs space-y-1.5 min-w-[200px]">
                    <div className="font-bold text-foreground border-b border-border pb-1">
                      Data: {point.date.split('-').reverse().join('/')}
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Saldo Confirmado:</span>
                      <span className="font-mono font-semibold text-foreground">{fmt(point.realBalance)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">Saldo Simulado:</span>
                      <span className="font-mono font-bold" style={{ color: simColor }}>
                        {fmt(point.simulatedBalance)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-border pt-1 text-[11px]">
                      <span className="text-muted-foreground">Diferença:</span>
                      <span className={`font-mono font-semibold ${point.diff < 0 ? 'text-fiducia-red' : 'text-fiducia-green'}`}>
                        {point.diff > 0 ? '+' : ''}{fmt(point.diff)}
                      </span>
                    </div>
                  </div>
                );
              }}
            />

            <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.6} />

            {safetyReserve > 0 && (
              <ReferenceLine
                y={safetyReserve}
                stroke="#f59e0b"
                strokeDasharray="4 4"
                strokeOpacity={0.7}
                label={{
                  value: 'Reserva Protegida',
                  position: 'insideTopRight',
                  fill: '#f59e0b',
                  fontSize: 10,
                  fontWeight: 600,
                }}
              />
            )}

            {/* Linha 1: Saldo Real */}
            <Line
              type="monotone"
              dataKey="realBalance"
              stroke="currentColor"
              strokeOpacity={0.4}
              strokeWidth={1.8}
              strokeDasharray="4 3"
              dot={false}
              isAnimationActive={false}
            />

            {/* Linha 2 + Área: Saldo Simulado */}
            <Area
              type="monotone"
              dataKey="simulatedBalance"
              stroke={simColor}
              strokeWidth={2.4}
              fill="url(#simAreaGrad)"
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
