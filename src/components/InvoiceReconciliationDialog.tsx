import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { CategorySelect } from './CategorySelect';
import { AlertTriangle, CheckCircle2, FileSearch, Loader2, PlusCircle, RefreshCcw, Sparkles, Upload, Wand2, X } from 'lucide-react';
import { toast } from 'sonner';
import { ImportedInvoiceLine, InvoiceLineAction, InvoiceLineMatch, Transaction } from '../types';
import { parseInvoiceFile } from '../services/invoiceImportService';
import { matchInvoiceLinesWithGroq } from '../services/invoiceAiService';
import {
  buildDeterministicInvoiceMatches,
  calculateInvoiceReconciliationTotals,
  getUnmatchedSystemTransactions,
  mergeAiAndDeterministicMatches,
} from '../lib/invoiceReconciliation';
import { applyInvoiceReconciliation } from '../services/invoiceReconciliationApplyService';

interface InvoiceReconciliationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  card: any;
  invoicePeriod: string;
  categories: any[];
  systemTransactions: Transaction[];
  onApplied?: () => void;
}

const actionLabels: Record<InvoiceLineAction, string> = {
  confirm_match: 'Confirmar',
  create_transaction: 'Criar',
  update_transaction: 'Corrigir',
  ignore: 'Ignorar',
  manual_review: 'Revisar',
};

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function dateLabel(value: string) {
  const [year, month, day] = value.split('T')[0].split('-');
  return `${day}/${month}/${year}`;
}

function actionVariant(action: InvoiceLineAction) {
  if (action === 'confirm_match') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300';
  if (action === 'create_transaction') return 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300';
  if (action === 'update_transaction') return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
  if (action === 'ignore') return 'bg-muted text-muted-foreground';
  return 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300';
}

export function InvoiceReconciliationDialog({
  open,
  onOpenChange,
  userId,
  card,
  invoicePeriod,
  categories,
  systemTransactions,
  onApplied,
}: InvoiceReconciliationDialogProps) {
  const [step, setStep] = useState<'idle' | 'extracting' | 'matching' | 'review' | 'applying'>('idle');
  const [source, setSource] = useState<'pdf' | 'csv' | 'xlsx'>('pdf');
  const [lines, setLines] = useState<ImportedInvoiceLine[]>([]);
  const [matches, setMatches] = useState<InvoiceLineMatch[]>([]);
  const [selectedActions, setSelectedActions] = useState<Record<string, InvoiceLineAction>>({});
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, string>>({});
  const [expandInstallments, setExpandInstallments] = useState<Record<string, boolean>>({});
  const [showOk, setShowOk] = useState(false);

  const matchesByLine = useMemo(() => new Map(matches.map(match => [match.importedLineId, match])), [matches]);
  const txById = useMemo(() => new Map(systemTransactions.filter(tx => tx.id).map(tx => [tx.id!, tx])), [systemTransactions]);
  const totals = useMemo(() => calculateInvoiceReconciliationTotals({
    importedLines: lines,
    systemTransactions,
    matches,
  }), [lines, systemTransactions, matches]);
  const unmatchedSystem = useMemo(() => getUnmatchedSystemTransactions({ systemTransactions, matches }), [systemTransactions, matches]);

  const groupedLines = useMemo(() => {
    const ok: ImportedInvoiceLine[] = [];
    const review: ImportedInvoiceLine[] = [];
    const missing: ImportedInvoiceLine[] = [];
    const different: ImportedInvoiceLine[] = [];
    const credits: ImportedInvoiceLine[] = [];

    for (const line of lines) {
      const action = selectedActions[line.id] || matchesByLine.get(line.id)?.suggestedAction || 'manual_review';
      if (line.type === 'receita' || line.kind === 'refund' || line.kind === 'credit') credits.push(line);
      else if (action === 'confirm_match') ok.push(line);
      else if (action === 'create_transaction') missing.push(line);
      else if (action === 'update_transaction') different.push(line);
      else review.push(line);
    }

    return { ok, review, missing, different, credits };
  }, [lines, matchesByLine, selectedActions]);

  const reset = () => {
    setStep('idle');
    setLines([]);
    setMatches([]);
    setSelectedActions({});
    setCategoryOverrides({});
    setExpandInstallments({});
    setShowOk(false);
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !card) return;

    setStep('extracting');
    setLines([]);
    setMatches([]);

    try {
      const parsed = await parseInvoiceFile({ file, cardName: card.name, categories });
      setSource(parsed.source);
      if (parsed.lines.length === 0) {
        toast.error('Nenhuma linha de fatura foi identificada no arquivo.');
        setStep('idle');
        return;
      }

      setStep('matching');
      const deterministic = buildDeterministicInvoiceMatches({
        importedLines: parsed.lines,
        systemTransactions,
      });

      let finalMatches = deterministic;
      try {
        const ai = await matchInvoiceLinesWithGroq({
          importedLines: parsed.lines,
          systemTransactions,
          cardName: card.name,
          invoicePeriod,
        });
        finalMatches = mergeAiAndDeterministicMatches({ deterministic, ai });
      } catch (err) {
        console.warn('AI invoice reconciliation failed, using deterministic matches only:', err);
        toast.info('IA indisponível para matching. Usei a conciliação determinística.');
      }

      const initialActions: Record<string, InvoiceLineAction> = {};
      finalMatches.forEach(match => {
        initialActions[match.importedLineId] = match.suggestedAction;
      });

      const initialCategories: Record<string, string> = {};
      parsed.lines.forEach(line => {
        if (line.suggestedCategoryId) initialCategories[line.id] = line.suggestedCategoryId;
      });

      setLines(parsed.lines);
      setMatches(finalMatches);
      setSelectedActions(initialActions);
      setCategoryOverrides(initialCategories);
      setStep('review');
      toast.success(`${parsed.lines.length} linha(s) analisada(s) para conferência.`);
    } catch (err) {
      console.error('Invoice reconciliation import error:', err);
      toast.error('Erro ao analisar a fatura. Verifique o arquivo e tente novamente.');
      setStep('idle');
    }
  };

  const setAction = (lineId: string, action: InvoiceLineAction) => {
    setSelectedActions(prev => ({ ...prev, [lineId]: action }));
  };

  const setAll = (lineIds: string[], action: InvoiceLineAction) => {
    setSelectedActions(prev => {
      const next = { ...prev };
      lineIds.forEach(id => { next[id] = action; });
      return next;
    });
  };

  const handleApply = async () => {
    if (!card || lines.length === 0) return;
    const diffRequiresConfirmation = Math.abs(totals.difference) >= 0.01 || unmatchedSystem.length > 0;
    if (diffRequiresConfirmation) {
      const ok = window.confirm(`Ainda há diferença de ${formatMoney(totals.difference)} e ${unmatchedSystem.length} lançamento(s) sobrando no Fiducia. Finalizar mesmo assim?`);
      if (!ok) return;
    }

    setStep('applying');
    try {
      const result = await applyInvoiceReconciliation({
        userId,
        card,
        invoicePeriod,
        source,
        importedLines: lines,
        matches,
        selectedActions,
        categoryOverrides,
        systemTransactions,
        totals,
        expandInstallments,
      });
      toast.success(`Conferência aplicada: ${result.reconciled} confirmado(s), ${result.created} criado(s), ${result.updated} corrigido(s).`);
      onApplied?.();
      reset();
      onOpenChange(false);
    } catch (err) {
      console.error('Apply invoice reconciliation error:', err);
      toast.error('Erro ao aplicar a conferência da fatura.');
      setStep('review');
    }
  };

  const renderLine = (line: ImportedInvoiceLine) => {
    const match = matchesByLine.get(line.id);
    const action = selectedActions[line.id] || match?.suggestedAction || 'manual_review';
    const tx = match?.systemTransactionId ? txById.get(match.systemTransactionId) : undefined;
    const categoriesForType = categories.filter(c => c.type === line.type || c.type === (line.type === 'despesa' ? 'expense' : 'income'));

    return (
      <div key={line.id} className="rounded-lg border bg-card p-3 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm truncate">{line.description}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${actionVariant(action)}`}>{actionLabels[action]}</span>
              {line.installmentNumber && line.totalInstallments && (
                <Badge variant="secondary" className="text-[10px]">{line.installmentNumber}/{line.totalInstallments}</Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {dateLabel(line.date)} · {line.kind} · confiança {(line.confidence * 100).toFixed(0)}%
            </div>
            {tx && (
              <div className="text-xs text-muted-foreground mt-1">
                Fiducia: {tx.description} · {dateLabel(tx.date)} · {formatMoney(tx.amount || 0)}
              </div>
            )}
            {match?.reason && <div className="text-xs text-muted-foreground mt-1">{match.reason}</div>}
          </div>
          <div className={`font-mono font-bold text-sm ${line.type === 'receita' ? 'text-emerald-600' : 'text-red-600'}`}>
            {line.type === 'receita' ? '-' : ''}{formatMoney(line.amount)}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-center">
          <CategorySelect
            categories={categoriesForType}
            value={categoryOverrides[line.id] || ''}
            onChange={(value) => setCategoryOverrides(prev => ({ ...prev, [line.id]: value }))}
            placeholder="Categoria"
          />
          <div className="flex flex-wrap gap-1 justify-end">
            <Button size="sm" variant={action === 'confirm_match' ? 'default' : 'outline'} className="h-7 px-2" onClick={() => setAction(line.id, 'confirm_match')} disabled={!match?.systemTransactionId}>OK</Button>
            <Button size="sm" variant={action === 'create_transaction' ? 'default' : 'outline'} className="h-7 px-2" onClick={() => setAction(line.id, 'create_transaction')}>Criar</Button>
            <Button size="sm" variant={action === 'update_transaction' ? 'default' : 'outline'} className="h-7 px-2" onClick={() => setAction(line.id, 'update_transaction')} disabled={!match?.systemTransactionId}>Corrigir</Button>
            <Button size="sm" variant={action === 'ignore' ? 'default' : 'outline'} className="h-7 px-2" onClick={() => setAction(line.id, 'ignore')}>Ignorar</Button>
          </div>
        </div>

        {line.installmentNumber && line.totalInstallments && line.installmentNumber < line.totalInstallments && action === 'create_transaction' && (
          <button
            type="button"
            className={`text-xs rounded-lg border px-3 py-2 w-full text-left ${expandInstallments[line.id] ? 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300' : 'bg-muted/40 text-muted-foreground'}`}
            onClick={() => setExpandInstallments(prev => ({ ...prev, [line.id]: !prev[line.id] }))}
          >
            {expandInstallments[line.id] ? 'Criar também as parcelas futuras' : 'Não criar parcelas futuras automaticamente'}
          </button>
        )}
      </div>
    );
  };

  const section = (title: string, icon: React.ReactNode, items: ImportedInvoiceLine[], action?: InvoiceLineAction) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold flex items-center gap-2">{icon}{title} <span className="text-muted-foreground font-normal">({items.length})</span></h3>
          {action && <Button size="sm" variant="outline" className="h-7" onClick={() => setAll(items.map(item => item.id), action)}>Aplicar a todos</Button>}
        </div>
        <div className="space-y-2">{items.map(renderLine)}</div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) reset(); onOpenChange(value); }}>
      <DialogContent className="sm:max-w-[980px] max-h-[92vh] flex flex-col p-0 overflow-hidden gap-0">
        <DialogHeader className="p-6 pb-4 border-b shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <FileSearch className="w-5 h-5 text-fiducia-blue" /> Conferir Fatura
              </DialogTitle>
              <DialogDescription className="text-xs mt-1">
                {card?.name} · {invoicePeriod} · PDF, CSV ou Excel
              </DialogDescription>
            </div>
            {step !== 'idle' && step !== 'extracting' && step !== 'matching' && (
              <Button variant="outline" size="sm" className="gap-2" onClick={reset}>
                <RefreshCcw className="w-4 h-4" /> Novo arquivo
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {step === 'idle' && (
            <div className="border border-dashed rounded-2xl p-10 text-center bg-muted/20">
              <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <div className="font-semibold mb-1">Selecione a fatura fechada</div>
              <p className="text-sm text-muted-foreground mb-5">O Fiducia vai extrair, comparar com seus lançamentos e mostrar apenas o que precisa de decisão.</p>
              <Input type="file" accept=".pdf,.csv,.xls,.xlsx" onChange={handleFile} className="max-w-md mx-auto cursor-pointer" />
            </div>
          )}

          {(step === 'extracting' || step === 'matching' || step === 'applying') && (
            <div className="py-16 text-center space-y-3">
              <Loader2 className="w-9 h-9 mx-auto animate-spin text-fiducia-blue" />
              <div className="font-semibold">
                {step === 'extracting' ? 'Extraindo linhas da fatura...' : step === 'matching' ? 'Comparando com lançamentos existentes...' : 'Aplicando conferência...'}
              </div>
              <p className="text-sm text-muted-foreground">A IA sugere; o Fiducia calcula; você confirma.</p>
            </div>
          )}

          {step === 'review' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-lg border p-3 bg-card"><div className="text-[10px] uppercase font-bold text-muted-foreground">Importado</div><div className="font-mono font-bold">{formatMoney(totals.importedLinesTotal)}</div></div>
                <div className="rounded-lg border p-3 bg-card"><div className="text-[10px] uppercase font-bold text-muted-foreground">No Fiducia</div><div className="font-mono font-bold">{formatMoney(totals.systemPeriodTotal)}</div></div>
                <div className="rounded-lg border p-3 bg-card"><div className="text-[10px] uppercase font-bold text-muted-foreground">Conciliado</div><div className="font-mono font-bold">{formatMoney(totals.matchedTotal)}</div></div>
                <div className="rounded-lg border p-3 bg-card"><div className="text-[10px] uppercase font-bold text-muted-foreground">Diferença</div><div className={`font-mono font-bold ${Math.abs(totals.difference) < 0.01 ? 'text-emerald-600' : 'text-amber-600'}`}>{formatMoney(totals.difference)}</div></div>
              </div>

              {Math.abs(totals.difference) >= 0.01 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 p-3 text-sm text-amber-800 dark:text-amber-300 flex gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> Há diferença entre o que foi conciliado e a fatura importada. Revise faltantes, divergências e lançamentos sobrando antes de finalizar.
                </div>
              )}

              <div className="space-y-5">
                {section('Diferentes', <Wand2 className="w-4 h-4 text-amber-600" />, groupedLines.different, 'update_transaction')}
                {section('Faltando no Fiducia', <PlusCircle className="w-4 h-4 text-blue-600" />, groupedLines.missing, 'create_transaction')}
                {section('Revisar', <AlertTriangle className="w-4 h-4 text-red-600" />, groupedLines.review, 'manual_review')}
                {section('Créditos e estornos', <Sparkles className="w-4 h-4 text-emerald-600" />, groupedLines.credits)}

                {unmatchedSystem.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold flex items-center gap-2"><X className="w-4 h-4 text-muted-foreground" />Sobrando no Fiducia <span className="text-muted-foreground font-normal">({unmatchedSystem.length})</span></h3>
                    <div className="space-y-2">
                      {unmatchedSystem.map(tx => (
                        <div key={tx.id} className="rounded-lg border bg-muted/30 p-3 flex justify-between gap-3 text-sm">
                          <div><div className="font-medium">{tx.description}</div><div className="text-xs text-muted-foreground">{dateLabel(tx.date)} · ainda não apareceu na fatura importada</div></div>
                          <div className="font-mono font-bold">{formatMoney(tx.amount || 0)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {groupedLines.ok.length > 0 && (
                  <div className="space-y-2">
                    <Button variant="ghost" size="sm" className="h-8 gap-2" onClick={() => setShowOk(!showOk)}>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {showOk ? 'Ocultar' : 'Mostrar'} conciliados automaticamente ({groupedLines.ok.length})
                    </Button>
                    {showOk && <div className="space-y-2">{groupedLines.ok.map(renderLine)}</div>}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {step === 'review' && (
          <DialogFooter className="p-4 border-t shrink-0 bg-muted/20">
            <div className="flex items-center justify-between w-full gap-3">
              <div className="text-xs text-muted-foreground">{lines.length} linha(s) · {matches.filter(m => m.systemTransactionId).length} match(es)</div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button onClick={handleApply} className="gap-2 bg-fiducia-blue hover:bg-fiducia-blue/90">
                  <CheckCircle2 className="w-4 h-4" /> Aplicar Conferência
                </Button>
              </div>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}