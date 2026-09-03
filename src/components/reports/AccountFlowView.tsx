import React, { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import type {
  AccountFlowItem,
  AccountFlowReportResult,
  NormalizedTransaction,
} from '../../types/reports';
import { formatCurrency } from '../../lib/utils';
import { ReportDetailsDialog } from './ReportDetailsDialog';
import { Wallet, AlertCircle, CreditCard, ArrowUpRight, ArrowDownRight, Clock, ShieldCheck, ShieldAlert, Info } from 'lucide-react';

interface AccountFlowViewProps {
  reportResult: AccountFlowReportResult;
  showPending: boolean;
  entityNames?: Record<string, string>;
}

const PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6',
];

export function AccountFlowView({ reportResult, showPending, entityNames }: AccountFlowViewProps) {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'consolidated' | 'by_account'>('consolidated');
  const [selectedAccount, setSelectedAccount] = useState<AccountFlowItem | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const {
    consolidatedStartingBalance,
    consolidatedInflow,
    consolidatedOutflow,
    consolidatedNetResult,
    consolidatedEndingBalance,
    consolidatedProjectedEndingBalance,
    consolidatedOpeningCapital,
    consolidatedPriorPending,
    unallocatedInvoiceObligations,
    unallocatedInvoices,
    accounts,
    consolidatedPoints,
    diagnostics,
  } = reportResult;

  const handleOpenAccountDetails = (acc: AccountFlowItem) => {
    setSelectedAccount(acc);
    setDetailsOpen(true);
  };

  // Dados do gráfico consolidado
  const consolidatedChartData = consolidatedPoints.map(pt => ({
    label: pt.label,
    saldo: pt.endingBalance,
    previsto: pt.projectedEndingBalanceCents !== undefined ? pt.projectedEndingBalanceCents / 100 : undefined,
  }));

  // Dados do gráfico por conta
  const byAccountChartData = consolidatedPoints.map((pt, idx) => {
    const row: Record<string, any> = { label: pt.label };
    for (const acc of accounts) {
      const accPt = acc.points[idx];
      row[acc.accountId] = accPt?.endingBalance || 0;
      row[`${acc.accountId}_prev`] = accPt?.projectedEndingBalanceCents !== undefined ? accPt.projectedEndingBalanceCents / 100 : undefined;
    }
    return row;
  });

  return (
    <div className="space-y-6">
      {/* Seletor de Modo: Consolidado vs Por Conta */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-xl border border-border">
        <div>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
            Fluxo Financeiro de Contas
          </span>
          <span className="text-sm text-muted-foreground">
            Acompanhe a evolução do saldo bancário e reconciliação
          </span>
        </div>

        <div className="flex items-center bg-muted/60 p-1 rounded-lg border border-border self-start sm:self-auto text-xs">
          <button
            type="button"
            onClick={() => setViewMode('consolidated')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              viewMode === 'consolidated'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Consolidado
          </button>
          <button
            type="button"
            onClick={() => setViewMode('by_account')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              viewMode === 'by_account'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Por Conta ({accounts.length})
          </button>
        </div>
      </div>

      {/* Visão 1: Consolidada */}
      {viewMode === 'consolidated' && (
        <div className="space-y-6">
          {/* 4 Cards de Totais Consolidados */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card p-4 rounded-xl border border-border">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Saldo Inicial Consolidado
              </span>
              <div className="mt-2 text-2xl font-bold text-foreground">
                {formatCurrency(consolidatedStartingBalance)}
              </div>
              <span className="text-[11px] text-muted-foreground mt-0.5 block">
                Posição no primeiro dia do período
              </span>
            </div>

            <div className="bg-card p-4 rounded-xl border border-border">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Resultado do Período
              </span>
              <div className={`mt-2 text-2xl font-bold ${
                consolidatedNetResult >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}>
                {formatCurrency(consolidatedNetResult)}
              </div>
              <span className="text-[11px] text-muted-foreground mt-0.5 block">
                Entradas: {formatCurrency(consolidatedInflow)} | Saídas: {formatCurrency(consolidatedOutflow)}
              </span>
            </div>

            <div className="bg-card p-4 rounded-xl border border-border">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Saldo Final Realizado
              </span>
              <div className="mt-2 text-2xl font-bold text-foreground">
                {formatCurrency(consolidatedEndingBalance)}
              </div>
              <span className="text-[11px] text-muted-foreground mt-0.5 block">
                Saldo de caixa realizado nas contas
              </span>
            </div>

            <div className="bg-card p-4 rounded-xl border border-border">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Saldo Previsto Final
              </span>
              <div className="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(consolidatedProjectedEndingBalance)}
              </div>
              <span className="text-[11px] text-muted-foreground mt-0.5 block">
                Inclui pendências e faturas de cartão
              </span>
            </div>
          </div>

          {/* Card explicativo: Faturas com conta a definir */}
          {unallocatedInvoiceObligations > 0 && (
            <div className="p-4 bg-muted/40 border border-border rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <CreditCard className="w-4 h-4 text-primary" />
                <span>Faturas de Cartão com Conta Pagadora a Definir ({formatCurrency(unallocatedInvoiceObligations)})</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                As faturas de cartão abaixo representam obrigações previstas de vencimento no período sem conta bancária vinculada. Elas são deduzidas na projeção consolidada geral, sem debitar arbitrariamente nenhuma conta individual.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                {unallocatedInvoices.map((inv, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => navigate('/cards')}
                    title={`Ver faturas do cartão ${inv.cardName}`}
                    className="p-2.5 bg-card rounded-lg border border-border/80 text-xs flex justify-between items-center hover:border-primary/50 transition-colors text-left"
                  >
                    <div>
                      <span className="font-semibold block">{inv.cardName}</span>
                      <span className="text-muted-foreground text-[11px]">Venc: {inv.dueDate || inv.period} · {inv.invoiceStatus === 'parcial' ? 'Pagamento parcial' : 'Aberta'}</span>
                    </div>
                    <span className="font-bold text-rose-600 dark:text-rose-400 shrink-0 ml-2">
                      {formatCurrency(inv.remainingAmountCents / 100)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {(consolidatedOpeningCapital !== 0 || consolidatedPriorPending !== 0 || diagnostics.invalidCount > 0) && (
            <div className="flex flex-col gap-1.5 p-3 bg-muted/40 border border-border rounded-lg text-xs text-muted-foreground">
              {consolidatedOpeningCapital !== 0 && (
                <span className="flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-primary shrink-0" />
                  Capital de abertura de contas abertas no período: <strong>{formatCurrency(consolidatedOpeningCapital)}</strong> — Saldo de abertura, separado de receitas.
                </span>
              )}
              {consolidatedPriorPending !== 0 && (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  Pendentes anteriores ao período: <strong>{formatCurrency(consolidatedPriorPending)}</strong> — sinalizados fora do período.
                </span>
              )}
              {diagnostics.invalidCount > 0 && (
                <span className="flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  Diagnóstico: {diagnostics.invalidCount} registro(s) não contabilizado(s) por data/valor inválido; {diagnostics.excludedCount} cancelado(s) excluído(s).
                </span>
              )}
            </div>
          )}

          {/* Gráfico Consolidado */}
          <div className="bg-card p-4 rounded-xl border border-border space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Evolução do Saldo Consolidado
              </span>
              {showPending && (
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" />Realizado</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" />Previsto (com pendências)</span>
                </div>
              )}
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={consolidatedChartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$ ${v}`} />
                  <Tooltip formatter={(val: any, name: any) => [formatCurrency(Number(val)), name === 'previsto' ? 'Saldo Previsto' : 'Saldo Consolidado']} />
                  <Line
                    type="monotone"
                    dataKey="saldo"
                    name="Saldo Consolidado"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                  {showPending && (
                    <Line
                      type="monotone"
                      dataKey="previsto"
                      name="Saldo Previsto"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      dot={false}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Visão 2: Por Conta */}
      {viewMode === 'by_account' && (
        <div className="space-y-6">
          {/* Gráfico Comparativo de Contas */}
          <div className="bg-card p-4 rounded-xl border border-border space-y-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Comparativo de Saldos por Conta
            </span>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={byAccountChartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$ ${v}`} />
                  <Tooltip formatter={(val: any) => [formatCurrency(Number(val)), '']} />
                  <Legend />
                  {accounts.map((acc, idx) => (
                    <Line
                      key={acc.accountId}
                      type="monotone"
                      dataKey={acc.accountId}
                      name={acc.accountName}
                      stroke={PALETTE[idx % PALETTE.length]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                  {showPending && accounts.map((acc, idx) => (
                    <Line
                      key={`${acc.accountId}_prev`}
                      type="monotone"
                      dataKey={`${acc.accountId}_prev`}
                      name={`${acc.accountName} (previsto)`}
                      stroke={PALETTE[idx % PALETTE.length]}
                      strokeWidth={1.5}
                      strokeDasharray="6 4"
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cards individuais por conta */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accounts.map(acc => (
              <div
                key={acc.accountId}
                onClick={() => handleOpenAccountDetails(acc)}
                className="bg-card p-4 rounded-xl border border-border hover:border-primary/50 transition-all cursor-pointer space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-semibold text-sm text-foreground block">{acc.accountName}</span>
                      <span className="text-xs text-muted-foreground capitalize">{acc.accountType}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-muted-foreground block">Saldo Atual/Final</span>
                    <span className="text-base font-bold text-foreground">{formatCurrency(acc.endingBalance)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {acc.isReconciled ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                      <ShieldCheck className="w-3 h-3" />
                      Saldo conciliado
                    </span>
                  ) : acc.isReconciledToday ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">
                      <ShieldAlert className="w-3 h-3" />
                      Posição até hoje conciliada; divergência com lançamentos futuros pagos
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-full">
                      <ShieldAlert className="w-3 h-3" />
                      Saldo não conciliado — ver detalhes
                    </span>
                  )}
                  {acc.divergenceMessage && <span className="text-[10px] text-muted-foreground">{acc.divergenceMessage}</span>}
                </div>

                {acc.openingCapital !== 0 && (
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-primary" />
                    Saldo de abertura no período: <strong className="text-foreground">{formatCurrency(acc.openingCapital)}</strong> (não conta como receita)
                  </div>
                )}
                {acc.priorPending !== 0 && (
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    Pendentes anteriores ao período: <strong className="text-foreground">{formatCurrency(acc.priorPending)}</strong>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/40 text-xs">
                  <div>
                    <span className="text-muted-foreground block">Inicial</span>
                    <span className="font-medium text-foreground">{formatCurrency(acc.startingBalance)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Resultado</span>
                    <span className={`font-medium ${
                      acc.netResult >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {formatCurrency(acc.netResult)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Previsto</span>
                    <span className="font-medium text-blue-600 dark:text-blue-400">{formatCurrency(acc.projectedEndingBalance)}</span>
                  </div>
                </div>

                <div className="text-[11px] text-primary flex items-center justify-end font-medium">
                  <span>Ver {acc.entries.length} movimentação(ões) →</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de Detalhes da Conta */}
      {selectedAccount && (
        <ReportDetailsDialog
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          title={`Movimentações — ${selectedAccount.accountName}`}
          subtitle={`${selectedAccount.entries.length} movimentação(ões) no período`}
          entries={selectedAccount.entries}
          context={{ type: 'account', accountId: selectedAccount.accountId }}
          entityNames={entityNames}
        />
      )}
    </div>
  );
}
