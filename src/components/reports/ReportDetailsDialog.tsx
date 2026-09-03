import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { formatCurrency } from '../../lib/utils';
import { useTransactionDialog } from '../../contexts/TransactionDialogContext';
import type { Invoice, Transaction } from '../../types';
import type { NormalizedTransaction } from '../../types/reports';
import { CreditCard, Wallet, CheckCircle2, Clock, ArrowLeftRight } from 'lucide-react';

export type ReportDetailsContext =
  | { type: 'expenses' }
  | { type: 'income' }
  | { type: 'cashflow' }
  | { type: 'account'; accountId: string };

interface ReportDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  entries: NormalizedTransaction[];
  context?: ReportDetailsContext;
  invoices?: Invoice[];
  entityNames?: Record<string, string>;
}

function getInvoiceStatusForEntry(
  entry: NormalizedTransaction,
  invoices?: Invoice[]
): 'paga' | 'a_quitar' | 'parcial' | undefined {
  if (!entry.isCard || !invoices) return undefined;
  const invoice = invoices.find(
    i => i.cardId === entry.cardId && i.period === entry.invoicePeriod
  );
  if (!invoice) return undefined;
  if (invoice.status === 'paga') return 'paga';
  if (invoice.status === 'parcial') return 'parcial';
  return 'a_quitar';
}

function getItemEffect(entry: NormalizedTransaction, context?: ReportDetailsContext): { amount: number; isNegative: boolean; sign: string } {
  const amount = entry.amountCents / 100;

  if (!context || context.type === 'expenses') {
    // Em despesas por categoria: compras somam gasto (+), estornos/créditos de cartão reduzem (-)
    if (entry.isCredit || entry.type === 'income') {
      return { amount: -amount, isNegative: true, sign: '- ' };
    }
    return { amount, isNegative: false, sign: '+ ' };
  }

  if (context.type === 'income') {
    return { amount, isNegative: false, sign: '+ ' };
  }

  if (context.type === 'cashflow') {
    if (entry.type === 'income') {
      return { amount, isNegative: false, sign: '+ ' };
    }
    if (entry.type === 'expense') {
      return { amount: -amount, isNegative: true, sign: '- ' };
    }
    // Transferência puramente interna neutralizada
    return { amount: 0, isNegative: false, sign: '' };
  }

  if (context.type === 'account') {
    const isOrigin = entry.accountId === context.accountId;
    const isDest = entry.destinationAccountId === context.accountId;

    if (entry.type === 'transfer') {
      if (isOrigin) return { amount: -amount, isNegative: true, sign: '- ' };
      if (isDest) return { amount, isNegative: false, sign: '+ ' };
      return { amount: 0, isNegative: false, sign: '' };
    }
    if (entry.type === 'expense') {
      return { amount: -amount, isNegative: true, sign: '- ' };
    }
    if (entry.type === 'income') {
      return { amount, isNegative: false, sign: '+ ' };
    }
  }

  return { amount, isNegative: false, sign: '' };
}

export function ReportDetailsDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  entries,
  context,
  invoices,
  entityNames,
}: ReportDetailsDialogProps) {
  const { open: openTxDialog } = useTransactionDialog();

  const total = entries.reduce((sum, e) => sum + getItemEffect(e, context).amount, 0);

  const resolveName = (id?: string) => (id ? entityNames?.[id] || id : undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-6">
        <DialogHeader className="pb-2 border-b border-border">
          <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground flex justify-between items-center mt-1">
            <span>{subtitle || `${entries.length} lançamento(s)`}</span>
            <span className="font-semibold text-foreground text-base">
              Total: {formatCurrency(Math.abs(total))}
              {total < 0 && ' (crédito líquido)'}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-2 space-y-2 divide-y divide-border/40">
          {entries.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              Nenhum lançamento encontrado neste grupo.
            </div>
          ) : (
            entries.map((entry) => {
              const effect = getItemEffect(entry, context);
              const isExpense = entry.type === 'expense';
              const isCredit = entry.isCredit || (entry.type === 'income' && entry.isCard);
              const displayAmount = (entry.amountCents / 100);
              const isTransfer = entry.type === 'transfer';
              const invoiceStatus = getInvoiceStatusForEntry(entry, invoices);
              const originName = resolveName(entry.accountId);
              const destName = resolveName(entry.destinationAccountId);
              const cardName = resolveName(entry.cardId);

              return (
                <div
                  key={entry.id}
                  onClick={() => {
                    if (entry.raw?.id) {
                      openTxDialog({ editId: entry.raw.id });
                    }
                  }}
                  className="pt-2 flex items-center justify-between p-2 rounded-lg hover:bg-muted/60 transition-colors cursor-pointer text-sm"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
                    <div className={`p-2 rounded-full shrink-0 ${
                      isCredit
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : isExpense
                          ? 'bg-rose-500/10 text-rose-500'
                          : isTransfer
                            ? 'bg-blue-500/10 text-blue-500'
                            : 'bg-emerald-500/10 text-emerald-500'
                    }`}>
                      {entry.isCard ? (
                        <CreditCard className="w-4 h-4" />
                      ) : isTransfer ? (
                        <ArrowLeftRight className="w-4 h-4" />
                      ) : (
                        <Wallet className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate text-foreground flex items-center gap-2">
                        <span>{entry.description || 'Sem descrição'}</span>
                        {isCredit && (
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded font-medium">
                            Estorno/Crédito
                          </span>
                        )}
                        {isTransfer && (
                          <span className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded font-medium">
                            Transferência
                          </span>
                        )}
                        {invoiceStatus === 'parcial' && (
                          <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium">
                            Parcial
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5 flex-wrap">
                        <span>{entry.date.split('-').reverse().join('/')}</span>
                        <span>•</span>
                        <span>{entry.categoryName}</span>
                        {isTransfer && (originName || destName) && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <ArrowLeftRight className="w-3 h-3" />
                              {originName || 'Origem desconhecida'} → {destName || 'Destino desconhecido'}
                            </span>
                          </>
                        )}
                        {entry.isCard && cardName && (
                          <>
                            <span>•</span>
                            <span>{cardName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex flex-col items-end">
                    <span className={`font-semibold ${
                      effect.isNegative
                        ? 'text-rose-600 dark:text-rose-400'
                        : isCredit
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-foreground'
                    }`}>
                      {effect.sign}
                      {formatCurrency(displayAmount)}
                    </span>
                    <span className="text-[11px] flex items-center gap-1 text-muted-foreground mt-0.5">
                      {invoiceStatus === 'parcial' ? (
                        <>
                          <Clock className="w-3 h-3 text-amber-500" />
                          <span>Fatura com pagamento parcial</span>
                        </>
                      ) : entry.status === 'paid' ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>Realizado</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-3 h-3 text-amber-500" />
                          <span>Pendente</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="pt-3 border-t border-border flex justify-end">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
