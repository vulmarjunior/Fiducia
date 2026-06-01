import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Loader2, FileText, AlertCircle, CheckSquare, Square,
  TrendingDown, TrendingUp, Upload, ChevronDown, CreditCard
} from 'lucide-react';
import { PdfTransaction } from '../services/pdfInvoiceService';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CategorySelect } from './CategorySelect';
interface Category {
  id: string;
  name: string;
  type: string;
}

interface ExpandedSeries {
  txId: string;
  installmentNumber: number;
  totalInstallments: number;
}

interface PdfImportReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactions: PdfTransaction[];
  isLoading: boolean;
  loadingStep: 'extracting' | 'analyzing' | null;
  cardName: string;
  categories: Category[];
  onConfirm: (selected: PdfTransaction[], categoryMap: Record<string, string>, expandedSeries: ExpandedSeries[]) => Promise<void>;
}

export function PdfImportReviewDialog({
  open,
  onOpenChange,
  transactions,
  isLoading,
  loadingStep,
  cardName,
  categories,
  onConfirm,
}: PdfImportReviewDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});
  const [expandedSeries, setExpandedSeries] = useState<Set<string>>(new Set());
  const [isConfirming, setIsConfirming] = useState(false);

  // Inicializa seleção e categorias sugeridas quando transações chegam
  React.useEffect(() => {
    if (transactions.length > 0) {
      setSelectedIds(new Set(transactions.map((t) => t.id)));
      const initialCategories: Record<string, string> = {};
      transactions.forEach((t) => {
        if (t.suggestedCategoryId) {
          initialCategories[t.id] = t.suggestedCategoryId;
        }
      });
      setCategoryMap(initialCategories);

      // Auto-expand todas as transações parceladas
      setExpandedSeries(new Set(transactions.filter((t) => t.installmentInfo).map((t) => t.id)));
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
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpand = (id: string) => {
    setExpandedSeries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = async () => {
    const selected = transactions.filter((t) => selectedIds.has(t.id));
    if (selected.length === 0) return;

    const series: ExpandedSeries[] = [];
    for (const tx of selected) {
      if (expandedSeries.has(tx.id) && tx.installmentInfo) {
        const match = tx.installmentInfo.match(/(\d+)\/(\d+)/);
        if (match) {
          series.push({
            txId: tx.id,
            installmentNumber: parseInt(match[1]),
            totalInstallments: parseInt(match[2]),
          });
        }
      }
    }

    setIsConfirming(true);
    try {
      await onConfirm(selected, categoryMap, series);
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

  const expandableCount = transactions.filter(
    (t) => selectedIds.has(t.id) && t.installmentInfo
  ).length;

  const filteredCategories = (type: 'despesa' | 'receita') =>
    categories.filter((c) => c.type === type || c.type === (type === 'despesa' ? 'expense' : 'income'));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[820px] max-h-[90vh] flex flex-col p-0 overflow-hidden gap-0">
        <DialogHeader className="p-6 pb-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Importar Fatura PDF</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {cardName} — revise, categorize e selecione antes de confirmar
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Loading */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-600/20 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-violet-600 animate-spin" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground">
                  {loadingStep === 'extracting' ? 'Extraindo texto do PDF...' : 'Analisando com IA...'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {loadingStep === 'extracting'
                    ? 'Lendo as páginas do documento'
                    : 'Identificando transações e sugerindo categorias'}
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
                A IA não conseguiu identificar transações neste PDF. Verifique se é uma fatura com texto
                selecionável (não imagem escaneada).
              </p>
            </div>
          )}

          {/* Lista */}
          {!isLoading && transactions.length > 0 && (
            <div className="p-4 space-y-3">
              {/* Resumo */}
              <div className="grid grid-cols-3 gap-3 mb-2">
                <div className="bg-muted/50 rounded-xl p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Selecionadas</p>
                  <p className="text-xl font-black">{selectedIds.size}</p>
                  <p className="text-[10px] text-muted-foreground">de {transactions.length}</p>
                </div>
                <div className="bg-red-50 dark:bg-red-950/30 rounded-xl p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-red-600/70 mb-1">Total Despesas</p>
                  <p className="text-lg font-black text-red-600">
                    R$ {totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600/70 mb-1">Total Créditos</p>
                  <p className="text-lg font-black text-emerald-600">
                    R$ {totalCredits.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {/* Aviso de parceladas expandíveis */}
              {expandableCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400">
                  <CreditCard className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    <strong>{expandableCount}</strong> compra(s) parcelada(s) detectada(s). Use o botão{' '}
                    <strong>"Expandir série"</strong> para criar as parcelas futuras automaticamente.
                  </span>
                </div>
              )}

              {/* Header da tabela */}
              <div className="flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b">
                <button onClick={toggleAll} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                  {selectedIds.size === transactions.length ? (
                    <CheckSquare className="w-4 h-4" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
                <span className="w-20 shrink-0">Data</span>
                <span className="flex-1">Descrição</span>
                <span className="w-56 shrink-0">Categoria</span>
                <span className="w-24 text-right shrink-0">Valor</span>
              </div>

              {/* Linhas */}
              {transactions.map((tx) => {
                const isSelected = selectedIds.has(tx.id);
                const isExpanded = expandedSeries.has(tx.id);

                let formattedDate = tx.date;
                try {
                  formattedDate = format(parseISO(tx.date), 'dd/MM/yy', { locale: ptBR });
                } catch {
                  // mantém original
                }

                const txCategories = filteredCategories(tx.type);
                const currentCategory = categoryMap[tx.id] || '';

                return (
                  <div key={tx.id} className="space-y-1">
                    <div
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all select-none ${
                        isSelected
                          ? 'bg-background border-border'
                          : 'bg-muted/30 border-transparent opacity-50'
                      }`}
                    >
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleOne(tx.id)}
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-violet-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>

                      {/* Data */}
                      <span className="w-20 shrink-0 text-xs text-muted-foreground font-mono">{formattedDate}</span>

                      {/* Descrição + badges */}
                      <div className="flex-1 min-w-0 flex items-center gap-1.5">
                        <span className={`text-sm font-medium truncate ${!isSelected ? 'line-through' : ''}`}>
                          {tx.description}
                        </span>
                        {tx.installmentInfo && (
                          <Badge
                            variant="secondary"
                            className="text-[9px] h-4 px-1.5 shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 border-0"
                          >
                            {tx.installmentInfo}
                          </Badge>
                        )}
                      </div>

                      {/* Select de categoria */}
                      <div 
                        className={`w-56 shrink-0 ${!isSelected ? 'pointer-events-none opacity-50' : ''}`} 
                        onClick={(e) => e.stopPropagation()}
                      >
                        <CategorySelect
                          categories={txCategories}
                          value={currentCategory}
                          onChange={(val) => setCategoryMap((prev) => ({ ...prev, [tx.id]: val }))}
                          placeholder="Sem categoria"
                        />
                      </div>

                      {/* Valor */}
                      <div className="w-24 text-right shrink-0 flex items-center justify-end gap-1">
                        {tx.type === 'receita' ? (
                          <TrendingUp className="w-3 h-3 text-emerald-500 shrink-0" />
                        ) : (
                          <TrendingDown className="w-3 h-3 text-red-500 shrink-0" />
                        )}
                        <span
                          className={`text-sm font-mono font-bold ${
                            tx.type === 'receita' ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          R$ {tx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {/* Botão expandir série — só para parceladas selecionadas */}
                    {isSelected && tx.installmentInfo && (() => {
                      const match = tx.installmentInfo.match(/(\d+)\/(\d+)/);
                      if (!match) return null;
                      const current = parseInt(match[1]);
                      const total = parseInt(match[2]);
                      const remaining = total - current;
                      if (remaining <= 0) return null;

                      return (
                        <div
                          className={`ml-6 flex items-center gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer transition-all ${
                            isExpanded
                              ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                              : 'bg-muted/40 border border-dashed border-muted-foreground/20 text-muted-foreground hover:border-amber-300 hover:text-amber-700'
                          }`}
                          onClick={() => toggleExpand(tx.id)}
                        >
                          <CreditCard className="w-3.5 h-3.5 shrink-0" />
                          {isExpanded ? (
                            <>
                              <span>
                                Expandir série ativado — criará <strong>{remaining}</strong> parcela(s) futura(s) ({current + 1}/{total} até {total}/{total})
                              </span>
                              <ChevronDown className="w-3 h-3 ml-auto rotate-180" />
                            </>
                          ) : (
                            <>
                              <span>
                                Expandir série — criar as <strong>{remaining}</strong> parcela(s) restante(s) nas próximas faturas
                              </span>
                              <ChevronDown className="w-3 h-3 ml-auto" />
                            </>
                          )}
                        </div>
                      );
                    })()}
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
                  : `${selectedIds.size} transação(ões)${expandedSeries.size > 0 ? ` + ${[...expandedSeries].filter(id => selectedIds.has(id)).length} série(s) expandida(s)` : ''}`}
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
                    <><Loader2 className="w-4 h-4 animate-spin" /> Importando...</>
                  ) : (
                    <><Upload className="w-4 h-4" /> Confirmar Import ({selectedIds.size})</>
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
