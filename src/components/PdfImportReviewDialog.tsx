import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Loader2, FileText, AlertCircle, CheckSquare, Square, TrendingDown, TrendingUp, Upload } from 'lucide-react';
import { PdfTransaction } from '../services/pdfInvoiceService';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PdfImportReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactions: PdfTransaction[];
  isLoading: boolean;
  loadingStep: 'extracting' | 'analyzing' | null;
  cardName: string;
  onConfirm: (selected: PdfTransaction[]) => Promise<void>;
}

export function PdfImportReviewDialog({
  open,
  onOpenChange,
  transactions,
  isLoading,
  loadingStep,
  cardName,
  onConfirm,
}: PdfImportReviewDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isConfirming, setIsConfirming] = useState(false);

  // Seleciona tudo quando as transações chegam
  React.useEffect(() => {
    if (transactions.length > 0) {
      setSelectedIds(new Set(transactions.map((t) => t.id)));
    }
  }, [transactions]);

  const toggleAll = () => {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transactions.map((t) => t.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleConfirm = async () => {
    const selected = transactions.filter((t) => selectedIds.has(t.id));
    if (selected.length === 0) return;
    setIsConfirming(true);
    try {
      await onConfirm(selected);
      onOpenChange(false);
    } finally {
      setIsConfirming(false);
    }
  };

  const totalExpenses = transactions
    .filter((t) => selectedIds.has(t.id) && t.type === 'despesa')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalCredits = transactions
    .filter((t) => selectedIds.has(t.id) && t.type === 'receita')
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[760px] max-h-[90vh] flex flex-col p-0 overflow-hidden gap-0">
        <DialogHeader className="p-6 pb-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Importar Fatura PDF</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {cardName} — revise e selecione as transações antes de confirmar
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Estado de loading */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-600/20 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-violet-600 animate-spin" />
                </div>
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground">
                  {loadingStep === 'extracting' ? 'Extraindo texto do PDF...' : 'Analisando com IA...'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {loadingStep === 'extracting'
                    ? 'Lendo as páginas do documento'
                    : 'Identificando transações com Groq llama-3.3-70b'}
                </p>
              </div>
            </div>
          )}

          {/* Sem transações */}
          {!isLoading && transactions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 px-8 text-center">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                <AlertCircle className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="font-semibold">Nenhuma transação encontrada</p>
              <p className="text-sm text-muted-foreground max-w-sm">
                A IA não conseguiu identificar transações neste PDF. Verifique se é uma fatura de cartão com texto
                selecionável (não imagem escaneada).
              </p>
            </div>
          )}

          {/* Lista de transações */}
          {!isLoading && transactions.length > 0 && (
            <div className="p-4 space-y-3">
              {/* Resumo */}
              <div className="grid grid-cols-3 gap-3 mb-2">
                <div className="bg-muted/50 rounded-xl p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Selecionadas
                  </p>
                  <p className="text-xl font-black">{selectedIds.size}</p>
                  <p className="text-[10px] text-muted-foreground">de {transactions.length}</p>
                </div>
                <div className="bg-red-50 dark:bg-red-950/30 rounded-xl p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-red-600/70 mb-1">
                    Total Despesas
                  </p>
                  <p className="text-lg font-black text-red-600">
                    R$ {totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600/70 mb-1">
                    Total Créditos
                  </p>
                  <p className="text-lg font-black text-emerald-600">
                    R$ {totalCredits.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {/* Header da tabela */}
              <div className="flex items-center gap-3 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b">
                <button onClick={toggleAll} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                  {selectedIds.size === transactions.length ? (
                    <CheckSquare className="w-4 h-4" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
                <span className="w-24 shrink-0">Data</span>
                <span className="flex-1">Descrição</span>
                <span className="w-28 text-right shrink-0">Valor</span>
                <span className="w-12 shrink-0" />
              </div>

              {/* Linhas */}
              {transactions.map((tx) => {
                const isSelected = selectedIds.has(tx.id);
                let formattedDate = tx.date;
                try {
                  formattedDate = format(parseISO(tx.date), 'dd/MM/yy', { locale: ptBR });
                } catch {
                  // mantém original se der erro
                }
                return (
                  <div
                    key={tx.id}
                    onClick={() => toggleOne(tx.id)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all select-none ${
                      isSelected
                        ? 'bg-background border-border hover:border-violet-300 dark:hover:border-violet-700'
                        : 'bg-muted/30 border-transparent opacity-50 hover:opacity-70'
                    }`}
                  >
                    <div className="shrink-0 text-muted-foreground">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-violet-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </div>
                    <span className="w-24 shrink-0 text-xs text-muted-foreground font-mono">{formattedDate}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block">{tx.description}</span>
                      {tx.installmentInfo && (
                        <Badge variant="secondary" className="text-[9px] h-4 px-1 mt-0.5">
                          parcela {tx.installmentInfo}
                        </Badge>
                      )}
                    </div>
                    <div className="w-28 text-right shrink-0">
                      <span
                        className={`text-sm font-mono font-bold ${
                          tx.type === 'receita' ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {tx.type === 'receita' ? '+' : '-'}R${' '}
                        {tx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="w-12 flex justify-center shrink-0">
                      {tx.type === 'receita' ? (
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {!isLoading && transactions.length > 0 && (
          <DialogFooter className="p-4 border-t shrink-0 bg-muted/20">
            <div className="flex items-center justify-between w-full gap-3">
              <p className="text-xs text-muted-foreground">
                {selectedIds.size === 0
                  ? 'Selecione ao menos uma transação'
                  : `${selectedIds.size} transação(ões) serão importadas para a fatura`}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isConfirming}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={selectedIds.size === 0 || isConfirming}
                  className="bg-violet-600 hover:bg-violet-700 text-white gap-2"
                >
                  {isConfirming ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Importando...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" /> Confirmar Import ({selectedIds.size})
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
