import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { formatCurrency } from '../../lib/utils';
import { useTransactionDialog } from '../../contexts/TransactionDialogContext';
import type { NormalizedTransaction } from '../../types/reports';
import { CreditCard, Wallet, ArrowUpRight, ArrowDownRight, CheckCircle2, Clock } from 'lucide-react';

interface ReportDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  entries: NormalizedTransaction[];
}

export function ReportDetailsDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  entries,
}: ReportDetailsDialogProps) {
  const { open: openTxDialog } = useTransactionDialog();

  const total = entries.reduce((sum, e) => {
    if (e.type === 'expense') {
      return sum + (e.isCredit ? -e.amountCents : e.amountCents);
    }
    return sum + e.amountCents;
  }, 0) / 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-6">
        <DialogHeader className="pb-2 border-b border-border">
          <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground flex justify-between items-center mt-1">
            <span>{subtitle || `${entries.length} lançamento(s)`}</span>
            <span className="font-semibold text-foreground text-base">
              Total: {formatCurrency(total)}
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
              const isExpense = entry.type === 'expense';
              const isCredit = entry.isCredit;
              const displayAmount = (entry.amountCents / 100);

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
                      isExpense
                        ? isCredit ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                        : 'bg-emerald-500/10 text-emerald-500'
                    }`}>
                      {entry.isCard ? (
                        <CreditCard className="w-4 h-4" />
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
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                        <span>{entry.date.split('-').reverse().join('/')}</span>
                        <span>•</span>
                        <span>{entry.categoryName}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex flex-col items-end">
                    <span className={`font-semibold ${
                      isExpense && !isCredit ? 'text-foreground' : 'text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {isExpense && !isCredit ? '- ' : '+ '}
                      {formatCurrency(displayAmount)}
                    </span>
                    <span className="text-[11px] flex items-center gap-1 text-muted-foreground mt-0.5">
                      {entry.status === 'paid' ? (
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
