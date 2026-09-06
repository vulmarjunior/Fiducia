import React, { useState } from 'react';
import { doc, runTransaction } from 'firebase/firestore';
import { toast } from 'sonner';
import { ArrowLeftRight, CreditCard, Trash2, Wallet } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { formatCurrency } from '../../lib/utils';
import { useTransactionDialog } from '../../contexts/TransactionDialogContext';
import { useAuth } from '../../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { logActivity } from '../../services/activityLogService';
import type { NormalizedTransaction, UnallocatedInvoiceObligation } from '../../types/reports';

interface PriorPendingDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bankEntries: NormalizedTransaction[];
  invoiceObligations: UnallocatedInvoiceObligation[];
  entityNames?: Record<string, string>;
}

export function PriorPendingDetailsDialog({
  open,
  onOpenChange,
  bankEntries,
  invoiceObligations,
  entityNames,
}: PriorPendingDetailsDialogProps) {
  const { open: openTransactionDialog } = useTransactionDialog();
  const { user } = useAuth();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const bankTotal = bankEntries.reduce((sum, entry) => sum + entry.amountCents, 0);
  const invoiceTotal = invoiceObligations.reduce((sum, item) => sum + item.remainingAmountCents, 0);
  const resolveName = (id?: string) => (id ? entityNames?.[id] || id : undefined);

  const handleDeleteSourceEntry = async (entry: NormalizedTransaction) => {
    const transactionId = entry.raw?.id;
    if (!transactionId || !user || deletingId) return;

    const confirmed = window.confirm(
      `Excluir definitivamente o lançamento "${entry.description || 'Sem descrição'}" de ${entry.date.split('-').reverse().join('/')} no valor de ${formatCurrency(entry.amountCents / 100)}?\n\nUse esta ação apenas quando o registro estiver órfão ou incorreto.`
    );
    if (!confirmed) return;

    try {
      setDeletingId(transactionId);
      const transactionRef = doc(db, 'transactions', transactionId);
      await runTransaction(db, async firestoreTransaction => {
        const snapshot = await firestoreTransaction.get(transactionRef);
        if (!snapshot.exists()) throw new Error('Lançamento não encontrado');
        if (snapshot.data().userId !== user.uid) throw new Error('Lançamento não pertence ao usuário autenticado');
        firestoreTransaction.delete(transactionRef);
      });

      logActivity({
        userId: user.uid,
        action: 'delete',
        entityType: 'transaction',
        entityId: transactionId,
        description: `Lançamento órfão removido pela auditoria: ${entry.description || 'Sem descrição'} (${formatCurrency(entry.amountCents / 100)})`,
      }).catch(() => {});
      toast.success('Lançamento excluído. O diagnóstico será recalculado automaticamente.');
    } catch (error) {
      toast.error('Não foi possível excluir o lançamento');
      handleFirestoreError(error, OperationType.DELETE, 'transactions');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-6">
        <DialogHeader className="pb-2 border-b border-border">
          <DialogTitle className="text-xl font-bold">Pendências anteriores ao período</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Origem dos valores carregados para o saldo inicial previsto.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-3 space-y-5">
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Lançamentos bancários pendentes</h3>
                <p className="text-xs text-muted-foreground">Lançamentos anteriores ao período que ainda estão com status pendente.</p>
              </div>
              <strong className="font-mono text-sm text-foreground">{formatCurrency(bankTotal / 100)}</strong>
            </div>

            {bankEntries.length === 0 ? (
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                Nenhum lançamento bancário pendente anterior encontrado.
              </div>
            ) : (
              <div className="divide-y divide-border/40 rounded-lg border border-border overflow-hidden">
                {bankEntries.map(entry => {
                  const origin = resolveName(entry.accountId);
                  const destination = resolveName(entry.destinationAccountId);
                  const isTransfer = entry.type === 'transfer';
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => entry.raw?.id && openTransactionDialog({ editId: entry.raw.id })}
                      className="w-full p-3 text-left hover:bg-muted/50 transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-full shrink-0 ${isTransfer ? 'bg-blue-500/10 text-blue-500' : entry.type === 'income' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                          {isTransfer ? <ArrowLeftRight className="w-4 h-4" /> : <Wallet className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">{entry.description || 'Sem descrição'}</div>
                          <div className="text-xs text-muted-foreground flex flex-wrap gap-x-1.5">
                            <span>{entry.date.split('-').reverse().join('/')}</span>
                            {entry.categoryName && <><span>•</span><span>{entry.categoryName}</span></>}
                            {isTransfer && (origin || destination) && <><span>•</span><span>{origin || 'Origem externa'} → {destination || 'Destino externo'}</span></>}
                            {!isTransfer && origin && <><span>•</span><span>{origin}</span></>}
                          </div>
                        </div>
                      </div>
                      <strong className={`font-mono text-sm shrink-0 ${entry.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {entry.type === 'income' ? '+' : '-'}{formatCurrency(entry.amountCents / 100)}
                      </strong>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Faturas anteriores com saldo residual</h3>
                <p className="text-xs text-muted-foreground">Resíduos calculados pelo motor de faturas após pagamentos já registrados.</p>
              </div>
              <strong className="font-mono text-sm text-foreground">{formatCurrency(invoiceTotal / 100)}</strong>
            </div>

            {invoiceObligations.length === 0 ? (
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                Nenhuma obrigação residual de fatura anterior encontrada.
              </div>
            ) : (
              <div className="space-y-3">
                {invoiceObligations.map(item => {
                  const sourceEntries = item.sourceEntries || [];
                  const sourceTotal = sourceEntries.reduce((sum, entry) => sum + (entry.isCredit ? -entry.amountCents : entry.amountCents), 0);
                  return (
                    <div key={`${item.cardId}-${item.period}`} className="rounded-lg border border-border overflow-hidden">
                      <div className="p-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 rounded-full shrink-0 bg-amber-500/10 text-amber-500">
                            <CreditCard className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-foreground truncate">{item.cardName}</div>
                            <div className="text-xs text-muted-foreground flex flex-wrap gap-x-1.5">
                              <span>Fatura {item.period}</span>
                              {item.dueDate && <><span>•</span><span>Venc. {item.dueDate.split('-').reverse().join('/')}</span></>}
                              <span>•</span>
                              <span>Status: {item.invoiceStatus}</span>
                              {item.hasPendingPayment && <><span>•</span><span>há pagamento pendente abatido</span></>}
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              Total {formatCurrency(item.totalAmountCents / 100)} · pago {formatCurrency(item.paidAmountCents / 100)}
                            </div>
                          </div>
                        </div>
                        <strong className="font-mono text-sm text-rose-600 dark:text-rose-400 shrink-0">
                          -{formatCurrency(item.remainingAmountCents / 100)}
                        </strong>
                      </div>

                      <div className="border-t border-border bg-muted/20 p-3 space-y-2">
                        <div className="text-[11px] text-muted-foreground">
                          Origem do total: <strong className="text-foreground">{item.sourceKind === 'card_transactions' ? 'compras/lançamentos do cartão' : 'documento de fatura salvo'}</strong>.
                        </div>

                        {sourceEntries.length > 0 ? (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                              <span>{sourceEntries.length} lançamento(s) associado(s) a {item.period}</span>
                              <span>Soma: {formatCurrency(sourceTotal / 100)}</span>
                            </div>
                            {sourceEntries.map(entry => (
                              <div
                                key={entry.id}
                                className="w-full rounded-md border border-border bg-background/50 px-2.5 py-2 flex items-center justify-between gap-3"
                              >
                                <button
                                  type="button"
                                  onClick={() => entry.raw?.id && openTransactionDialog({ editId: entry.raw.id })}
                                  className="min-w-0 flex-1 text-left hover:opacity-80 transition-opacity"
                                >
                                  <div className="text-xs font-medium text-foreground truncate">{entry.description || 'Sem descrição'}</div>
                                  <div className="text-[10px] text-muted-foreground">
                                    {entry.date.split('-').reverse().join('/')} · período da fatura {entry.invoicePeriod || entry.month}
                                  </div>
                                </button>
                                <div className="flex items-center gap-2 shrink-0">
                                  <strong className={`font-mono text-xs ${entry.isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                    {entry.isCredit ? '+' : '-'}{formatCurrency(entry.amountCents / 100)}
                                  </strong>
                                  <button
                                    type="button"
                                    onClick={() => void handleDeleteSourceEntry(entry)}
                                    disabled={deletingId === entry.raw?.id}
                                    aria-label={`Excluir ${entry.description || 'lançamento'}`}
                                    title="Excluir registro órfão/incorreto"
                                    className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-muted-foreground">
                            Nenhuma compra do cartão foi encontrada para compor este valor. O residual vem do documento de fatura salvo no banco de dados. Nesse caso, a inconsistência está no registro da própria fatura, não em um lançamento visível.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
