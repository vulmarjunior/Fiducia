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
import type {
  AccountFlowItem,
  AccountFlowReportResult,
  NormalizedTransaction,
} from '../../types/reports';
import { formatCurrency } from '../../lib/utils';
import { ReportDetailsDialog } from './ReportDetailsDialog';
import { Wallet, AlertCircle, CreditCard, ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';

interface AccountFlowViewProps {
  reportResult: AccountFlowReportResult;
  showPending: boolean;
}

const PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6',
];

export function AccountFlowView({ reportResult, showPending }: AccountFlowViewProps) {
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
    unallocatedInvoiceObligations,
    unallocatedInvoices,
    accounts,
    consolidatedPoints,
  } = reportResult;

  const handleOpenAccountDetails = (acc: AccountFlowItem) => {
    setSelectedAccount(acc);
    setDetailsOpen(true);
  };

  // Dados do gráfico consolidado
  const consolidatedChartData = consolidatedPoints.map(pt => ({
    label: pt.label,
    saldo: pt.endingBalance,
  }));

  // Dados do gráfico por conta
  const byAccountChartData = consolidatedPoints.map((pt, idx) => {
    const row: Record<string, any> = { label: pt.label };
    for (const acc of accounts) {
      const accPt = acc.points[idx];
      row[acc.accountId] = accPt?.endingBalance || 0;
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
                  <div key={i} className="p-2.5 bg-card rounded-lg border border-border/80 text-xs flex justify-between items-center">
                    <div>
                      <span className="font-semibold block">{inv.cardName}</span>
                      <span className="text-muted-foreground text-[11px]">Venc: {inv.dueDate || inv.period}</span>
                    </div>
                    <span className="font-bold text-rose-600 dark:text-rose-400">
                      {formatCurrency(inv.remainingAmountCents / 100)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Gráfico Consolidado */}
          <div className="bg-card p-4 rounded-xl border border-border space-y-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Evolução do Saldo Consolidado
            </span>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={consolidatedChartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$ ${v}`} />
                  <Tooltip formatter={(val: any) => [formatCurrency(Number(val)), 'Saldo Consolidado']} />
                  <Line
                    type="monotone"
                    dataKey="saldo"
                    name="Saldo Consolidado"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
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
        />
      )}
    </div>
  );
}
