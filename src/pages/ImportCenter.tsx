import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { AlertTriangle, CheckCircle2, ClipboardPaste, CreditCard, FileText, Inbox, Link as LinkIcon, Loader2, Search, ShieldCheck, Upload, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { formatCurrency } from '../lib/utils';
import { createImportCandidate, confirmImportCandidate, ignoreImportCandidate, markImportCandidateDuplicate } from '../services/importCandidateService';
import { checkImportDuplicate } from '../services/importDuplicateService';
import { parseBankAlert } from '../services/importAlertParser';
import { buildImportSuggestions } from '../services/importSuggestionService';
import { BankStatementColumnMapping, BankStatementFilePreview, getBankStatementFilePreview, parseBankStatementFile } from '../services/importFileCandidateService';
import { Account, Category, ConfirmImportCandidateInput, CreditCard as CreditCardType, ImportCandidate, ParsedImportResult, Tag, Transaction } from '../types';

function toDateInput(value?: string) {
  return (value || new Date().toISOString()).split('T')[0];
}

function parsedTypeToTxType(type: string): ConfirmImportCandidateInput['type'] {
  if (type === 'income' || type === 'refund') return 'receita';
  if (type === 'transfer') return 'transferencia';
  return 'despesa';
}

function statusLabel(status: ImportCandidate['status']) {
  const labels: Record<ImportCandidate['status'], string> = {
    pending: 'Pendente',
    confirmed: 'Confirmado',
    ignored: 'Ignorado',
    duplicate: 'Duplicado',
    error: 'Erro',
  };
  return labels[status];
}

function sourceLabel(source: ImportCandidate['source']) {
  const labels: Record<ImportCandidate['source'], string> = {
    pasted_text: 'Texto colado',
    shared_text: 'Compartilhado',
    file_bank_statement: 'Arquivo bancario',
    file_card_invoice: 'Fatura',
    email: 'E-mail',
    open_finance: 'Open Finance',
    companion_app: 'App companion',
  };
  return labels[source];
}

function confidenceLabel(value: number) {
  if (value >= 0.75) return 'Alta';
  if (value >= 0.45) return 'Media';
  return 'Baixa';
}

function buildInitialForm(candidate?: ImportCandidate): ConfirmImportCandidateInput {
  const parsed = candidate?.parsed;
  return {
    type: parsedTypeToTxType(parsed?.type || 'unknown'),
    amount: parsed?.amount || 0,
    date: toDateInput(parsed?.date),
    description: parsed?.merchant || parsed?.description || '',
    status: parsed?.type === 'card_expense' ? 'realizado' : 'pago',
    accountId: candidate?.suggestions.accountId || '',
    creditCardId: candidate?.suggestions.creditCardId || '',
    categoryId: candidate?.suggestions.categoryId || '',
    tags: candidate?.suggestions.tagIds || [],
    installmentNumber: parsed?.installments?.current,
    totalInstallments: parsed?.installments?.total,
    observation: '',
  };
}

export function ImportCenter() {
  const { user, isAuthReady } = useAuth();
  const { id: routeCandidateId } = useParams();
  const [searchParams] = useSearchParams();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCardType[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [candidates, setCandidates] = useState<ImportCandidate[]>([]);
  const [rawText, setRawText] = useState('');
  const [preview, setPreview] = useState<ParsedImportResult | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(routeCandidateId || null);
  const [form, setForm] = useState<ConfirmImportCandidateInput>(buildInitialForm());
  const [isSavingCandidate, setIsSavingCandidate] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [importAccountId, setImportAccountId] = useState('');
  const [isImportingFile, setIsImportingFile] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<BankStatementFilePreview | null>(null);
  const [fileMapping, setFileMapping] = useState<BankStatementColumnMapping>({});
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(new Set());
  const sharedLoadedRef = useRef(false);

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const unsubscribers = [
      onSnapshot(query(collection(db, 'accounts'), where('userId', '==', user.uid)), snapshot => {
        setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
      }, error => handleFirestoreError(error, OperationType.GET, 'accounts')),
      onSnapshot(query(collection(db, 'creditCards'), where('userId', '==', user.uid)), snapshot => {
        setCreditCards(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CreditCardType)));
      }, error => handleFirestoreError(error, OperationType.GET, 'creditCards')),
      onSnapshot(query(collection(db, 'categories'), where('userId', '==', user.uid)), snapshot => {
        setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
      }, error => handleFirestoreError(error, OperationType.GET, 'categories')),
      onSnapshot(query(collection(db, 'tags'), where('userId', '==', user.uid)), snapshot => {
        setTags(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tag)));
      }, error => handleFirestoreError(error, OperationType.GET, 'tags')),
      onSnapshot(query(collection(db, 'transactions'), where('userId', '==', user.uid)), snapshot => {
        setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
      }, error => handleFirestoreError(error, OperationType.GET, 'transactions')),
      onSnapshot(query(collection(db, 'importCandidates'), where('userId', '==', user.uid)), snapshot => {
        const rows = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ImportCandidate));
        rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
        setCandidates(rows);
      }, error => handleFirestoreError(error, OperationType.GET, 'importCandidates')),
    ];

    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }, [user, isAuthReady]);

  useEffect(() => {
    if (sharedLoadedRef.current) return;
    const sharedText = searchParams.get('text');
    const title = searchParams.get('title');
    const url = searchParams.get('url');
    const combined = [sharedText, title, url].filter(Boolean).join('\n');
    if (combined) {
      setRawText(combined);
      sharedLoadedRef.current = true;
    }
  }, [searchParams]);

  const selectedCandidate = useMemo(
    () => candidates.find(candidate => candidate.id === selectedCandidateId) || null,
    [candidates, selectedCandidateId]
  );

  useEffect(() => {
    if (!routeCandidateId || selectedCandidateId) return;
    setSelectedCandidateId(routeCandidateId);
  }, [routeCandidateId, selectedCandidateId]);

  useEffect(() => {
    if (!selectedCandidate) return;
    setForm(buildInitialForm(selectedCandidate));
  }, [selectedCandidate]);

  const pendingCandidates = candidates.filter(candidate => candidate.status === 'pending');
  const selectedPendingCandidates = pendingCandidates.filter(candidate => candidate.id && selectedCandidateIds.has(candidate.id));
  const recentHistory = candidates.filter(candidate => candidate.status !== 'pending').slice(0, 8);

  const currentSuggestions = useMemo(() => {
    if (!preview) return null;
    return buildImportSuggestions({ parsed: preview, accounts, creditCards, categories, tags });
  }, [accounts, categories, creditCards, preview, tags]);

  const currentDuplicate = useMemo(() => {
    if (!preview) return null;
    return checkImportDuplicate({
      parsed: preview,
      transactions,
      accountId: currentSuggestions?.accountId,
      creditCardId: currentSuggestions?.creditCardId,
    });
  }, [currentSuggestions, preview, transactions]);

  const handleAnalyze = () => {
    if (!rawText.trim()) {
      toast.error('Cole o texto de um alerta bancario para continuar.');
      return;
    }
    const parsed = parseBankAlert(rawText);
    setPreview(parsed);
    toast.success('Alerta analisado. Revise a previa antes de criar o candidato.');
  };

  const handleCreateCandidate = async () => {
    if (!user || !preview || !currentSuggestions) return;
    if (!preview.amount) {
      toast.error('Nao foi possivel identificar um valor monetario. Revise o texto ou preencha manualmente depois.');
    }

    setIsSavingCandidate(true);
    try {
      const id = await createImportCandidate({
        userId: user.uid,
        source: searchParams.get('text') ? 'shared_text' : 'pasted_text',
        rawContent: rawText,
        rawTitle: searchParams.get('title') || undefined,
        rawUrl: searchParams.get('url') || undefined,
        parsed: preview,
        suggestions: currentSuggestions,
        duplicateCheck: currentDuplicate || undefined,
      });
      setSelectedCandidateId(id);
      setRawText('');
      setPreview(null);
      toast.success('Candidato criado para revisao.');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao criar candidato de importacao.');
    } finally {
      setIsSavingCandidate(false);
    }
  };


  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setIsImportingFile(true);
    try {
      const previewData = await getBankStatementFilePreview(file);
      setPendingImportFile(file);
      setFilePreview(previewData);
      setFileMapping(previewData.defaultMapping);
      toast.success(`${previewData.lineCount} linha(s) detectada(s). Revise o mapeamento antes de criar candidatos.`);
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Erro ao ler arquivo.');
    } finally {
      setIsImportingFile(false);
    }
  };

  const handleChangeSheet = async (sheetName: string) => {
    if (!pendingImportFile) return;
    setIsImportingFile(true);
    try {
      const previewData = await getBankStatementFilePreview(pendingImportFile, sheetName);
      setFilePreview(previewData);
      setFileMapping(previewData.defaultMapping);
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Erro ao trocar aba.');
    } finally {
      setIsImportingFile(false);
    }
  };

  const handleCreateCandidatesFromFile = async () => {
    if (!pendingImportFile || !filePreview || !user) return;

    setIsImportingFile(true);
    try {
      const lines = await parseBankStatementFile(pendingImportFile, {
        sheetName: filePreview.selectedSheet,
        mapping: fileMapping,
      });
      if (lines.length === 0) {
        toast.error('Nenhum lancamento valido foi encontrado com o mapeamento atual.');
        return;
      }

      let created = 0;
      for (const line of lines) {
        const suggestions = buildImportSuggestions({ parsed: line.parsed, accounts, creditCards, categories, tags });
        const finalSuggestions = {
          ...suggestions,
          accountId: importAccountId || suggestions.accountId,
          creditCardId: undefined,
          confidence: importAccountId ? Math.max(suggestions.confidence, 0.4) : suggestions.confidence,
          reasons: importAccountId
            ? [...suggestions.reasons, 'Conta escolhida manualmente para o arquivo']
            : suggestions.reasons,
        };
        const duplicateCheck = checkImportDuplicate({
          parsed: line.parsed,
          transactions,
          accountId: finalSuggestions.accountId,
        });

        await createImportCandidate({
          userId: user.uid,
          source: 'file_bank_statement',
          rawContent: line.rawText,
          rawTitle: pendingImportFile.name,
          parsed: line.parsed,
          suggestions: finalSuggestions,
          duplicateCheck,
        });
        created++;
      }

      setPendingImportFile(null);
      setFilePreview(null);
      setFileMapping({});
      toast.success(`${created} candidato(s) criado(s) a partir do arquivo.`);
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Erro ao criar candidatos do arquivo.');
    } finally {
      setIsImportingFile(false);
    }
  };

  const toggleCandidateSelection = (candidateId: string) => {
    setSelectedCandidateIds(current => {
      const next = new Set(current);
      if (next.has(candidateId)) next.delete(candidateId);
      else next.add(candidateId);
      return next;
    });
  };

  const handleSelectAllPending = () => {
    setSelectedCandidateIds(current => {
      if (pendingCandidates.every(candidate => candidate.id && current.has(candidate.id))) return new Set();
      return new Set(pendingCandidates.map(candidate => candidate.id).filter(Boolean) as string[]);
    });
  };

  const handleBatchIgnore = async () => {
    if (!user || selectedPendingCandidates.length === 0) return;
    for (const candidate of selectedPendingCandidates) {
      if (candidate.id) await ignoreImportCandidate(candidate.id, user.uid);
    }
    setSelectedCandidateIds(new Set());
    toast.success(`${selectedPendingCandidates.length} candidato(s) ignorado(s).`);
  };

  const handleBatchDuplicate = async () => {
    if (!user || selectedPendingCandidates.length === 0) return;
    for (const candidate of selectedPendingCandidates) {
      if (candidate.id) await markImportCandidateDuplicate(candidate.id, user.uid);
    }
    setSelectedCandidateIds(new Set());
    toast.success(`${selectedPendingCandidates.length} candidato(s) marcado(s) como duplicado(s).`);
  };

  const handleBatchConfirm = async () => {
    if (!user || selectedPendingCandidates.length === 0) return;
    let confirmed = 0;
    let skipped = 0;

    for (const candidate of selectedPendingCandidates) {
      if (!candidate.id) continue;
      const input = buildInitialForm(candidate);
      if (!input.amount || !input.description || (!input.accountId && !input.creditCardId)) {
        skipped++;
        continue;
      }
      const card = creditCards.find(item => item.id === input.creditCardId);
      await confirmImportCandidate({ candidateId: candidate.id, userId: user.uid, input, card });
      confirmed++;
    }

    setSelectedCandidateIds(new Set());
    if (confirmed > 0) toast.success(`${confirmed} candidato(s) confirmado(s).`);
    if (skipped > 0) toast.error(`${skipped} candidato(s) precisam de revisao manual antes da confirmacao.`);
  };
  const handleSelectCandidate = (candidate: ImportCandidate) => {
    setSelectedCandidateId(candidate.id || null);
    setForm(buildInitialForm(candidate));
  };

  const handleConfirm = async () => {
    if (!user || !selectedCandidate?.id) return;
    if (!form.amount || form.amount <= 0) {
      toast.error('Informe um valor maior que zero.');
      return;
    }
    if (!form.description.trim()) {
      toast.error('Informe uma descricao.');
      return;
    }
    if (!form.creditCardId && !form.accountId) {
      toast.error('Selecione uma conta ou cartao.');
      return;
    }

    setIsConfirming(true);
    try {
      const card = creditCards.find(item => item.id === form.creditCardId);
      await confirmImportCandidate({
        candidateId: selectedCandidate.id,
        userId: user.uid,
        input: {
          ...form,
          accountId: form.creditCardId ? undefined : form.accountId,
          creditCardId: form.creditCardId || undefined,
          categoryId: form.categoryId || '',
          tags: form.tags || [],
        },
        card,
      });
      toast.success('Lancamento criado com sucesso.');
      setSelectedCandidateId(null);
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Erro ao confirmar candidato.');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleIgnore = async () => {
    if (!user || !selectedCandidate?.id) return;
    try {
      await ignoreImportCandidate(selectedCandidate.id, user.uid);
      toast.success('Candidato ignorado.');
      setSelectedCandidateId(null);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao ignorar candidato.');
    }
  };

  const handleDuplicate = async () => {
    if (!user || !selectedCandidate?.id) return;
    try {
      await markImportCandidateDuplicate(selectedCandidate.id, user.uid);
      toast.success('Candidato marcado como duplicado.');
      setSelectedCandidateId(null);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao marcar duplicidade.');
    }
  };

  const matchedTransactions = selectedCandidate?.duplicateCheck?.matchedTransactionIds
    ?.map(id => transactions.find(tx => tx.id === id))
    .filter(Boolean) as Transaction[] | undefined;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Importar</h1>
          <p className="text-sm text-muted-foreground mt-1">Capture alertas bancarios como candidatos e confirme so depois de revisar.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Button variant="outline" render={<Link to="/transactions" />}><FileText className="w-4 h-4" />Lancamentos</Button>
          <Button variant="outline" render={<Link to="/reconciliation" />}><ShieldCheck className="w-4 h-4" />Conciliacao</Button>
          <Button variant="outline" render={<Link to="/cards" />}><CreditCard className="w-4 h-4" />Cartoes</Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ClipboardPaste className="w-5 h-5 text-primary" />Colar alerta bancario</CardTitle>
              <CardDescription>Use textos de SMS, notificacoes, e-mail ou mensagens. A leitura e local e baseada em regras.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <textarea
                value={rawText}
                onChange={event => setRawText(event.target.value)}
                rows={7}
                className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                placeholder="Ex.: Compra aprovada no cartao final 1234 em MERCADO CENTRAL no valor de R$ 84,90 em 07/07."
              />
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={handleAnalyze} className="sm:w-fit"><Search className="w-4 h-4" />Analisar alerta</Button>
                <Button variant="outline" onClick={() => { setRawText(''); setPreview(null); }} className="sm:w-fit">Limpar</Button>
              </div>

              {preview && (
                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={preview.confidence >= 0.75 ? 'default' : preview.confidence >= 0.45 ? 'secondary' : 'destructive'}>
                      Confianca {confidenceLabel(preview.confidence)}
                    </Badge>
                    <Badge variant="outline">{preview.type}</Badge>
                    {currentDuplicate?.isPossibleDuplicate && <Badge variant="destructive">Possivel duplicidade</Badge>}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div><span className="text-xs text-muted-foreground">Valor</span><p className="font-semibold">{preview.amount ? formatCurrency(preview.amount) : 'Nao identificado'}</p></div>
                    <div><span className="text-xs text-muted-foreground">Data</span><p className="font-semibold">{preview.date || 'Nao identificada'}</p></div>
                    <div><span className="text-xs text-muted-foreground">Estabelecimento</span><p className="font-semibold">{preview.merchant || 'Nao identificado'}</p></div>
                    <div><span className="text-xs text-muted-foreground">Cartao</span><p className="font-semibold">{preview.cardLastDigits ? `final ${preview.cardLastDigits}` : 'Nao identificado'}</p></div>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    {preview.reasons.map(reason => <p key={reason}>- {reason}</p>)}
                    {currentSuggestions?.reasons.map(reason => <p key={reason}>- {reason}</p>)}
                  </div>
                  <Button onClick={handleCreateCandidate} disabled={isSavingCandidate}>
                    {isSavingCandidate ? <Loader2 className="w-4 h-4 animate-spin" /> : <Inbox className="w-4 h-4" />}
                    Criar candidato
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Inbox className="w-5 h-5 text-primary" />Pendentes</CardTitle>
                <CardDescription>{pendingCandidates.length} candidato(s) aguardando revisao.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Button variant="outline" size="sm" onClick={handleSelectAllPending} disabled={pendingCandidates.length === 0}>Selecionar todos</Button>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <Button variant="outline" size="sm" onClick={handleBatchConfirm} disabled={selectedPendingCandidates.length === 0}>Confirmar lote</Button>
                    <Button variant="outline" size="sm" onClick={handleBatchIgnore} disabled={selectedPendingCandidates.length === 0}>Ignorar lote</Button>
                    <Button variant="destructive" size="sm" onClick={handleBatchDuplicate} disabled={selectedPendingCandidates.length === 0}>Duplicar lote</Button>
                  </div>
                </div>
                {pendingCandidates.length === 0 && <p className="text-sm text-muted-foreground">Nenhum candidato pendente.</p>}
                {pendingCandidates.map(candidate => (
                  <div
                    key={candidate.id}
                    className={`w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 ${selectedCandidateId === candidate.id ? 'border-primary bg-primary/5' : 'border-border'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={Boolean(candidate.id && selectedCandidateIds.has(candidate.id))}
                          onChange={() => candidate.id && toggleCandidateSelection(candidate.id)}
                        />
                        <button type="button" className="min-w-0 text-left" onClick={() => handleSelectCandidate(candidate)}>
                          <p className="font-medium truncate">{candidate.parsed.merchant || candidate.parsed.description || 'Sem descricao'}</p>
                          <p className="text-xs text-muted-foreground">{sourceLabel(candidate.source)} - {candidate.parsed.date || 'sem data'}</p>
                        </button>
                      </div>
                      <span className="font-mono text-sm shrink-0">{candidate.parsed.amount ? formatCurrency(candidate.parsed.amount) : '-'}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant="outline">{statusLabel(candidate.status)}</Badge>
                      <Badge variant="secondary">{confidenceLabel(candidate.parsed.confidence)}</Badge>
                      {candidate.duplicateCheck?.isPossibleDuplicate && <Badge variant="destructive">Duplicidade</Badge>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-primary" />Historico recente</CardTitle>
                <CardDescription>Candidatos ja processados.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {recentHistory.length === 0 && <p className="text-sm text-muted-foreground">Sem historico recente.</p>}
                {recentHistory.map(candidate => (
                  <div key={candidate.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium truncate">{candidate.parsed.merchant || candidate.parsed.description || 'Sem descricao'}</p>
                      <Badge variant={candidate.status === 'confirmed' ? 'default' : 'outline'}>{statusLabel(candidate.status)}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{candidate.parsed.amount ? formatCurrency(candidate.parsed.amount) : '-'} - {candidate.parsed.date || 'sem data'}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="xl:sticky xl:top-6 xl:self-start">
          <CardHeader>
            <CardTitle>Revisao do candidato</CardTitle>
            <CardDescription>Edite os dados antes de criar o lancamento real.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedCandidate && <p className="text-sm text-muted-foreground">Selecione um candidato pendente para revisar.</p>}
            {selectedCandidate && (
              <>
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground max-h-32 overflow-auto whitespace-pre-wrap">
                  {selectedCandidate.rawContent}
                </div>

                {selectedCandidate.duplicateCheck?.isPossibleDuplicate && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    <div className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 mt-0.5" />{selectedCandidate.duplicateCheck.reason || 'Possivel duplicidade encontrada.'}</div>
                    {matchedTransactions && matchedTransactions.length > 0 && (
                      <div className="mt-2 space-y-1 text-xs">
                        {matchedTransactions.map(tx => <p key={tx.id}>{tx.date?.split('T')[0]} - {tx.description} - {formatCurrency(tx.amount)}</p>)}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Tipo</Label>
                    <select value={form.type} onChange={event => setForm({ ...form, type: event.target.value as ConfirmImportCandidateInput['type'] })} className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm dark:bg-input/30">
                      <option value="despesa">Despesa</option>
                      <option value="receita">Receita</option>
                      <option value="transferencia">Transferencia</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label>Status</Label>
                    <select value={form.status} onChange={event => setForm({ ...form, status: event.target.value as ConfirmImportCandidateInput['status'] })} className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm dark:bg-input/30" disabled={Boolean(form.creditCardId)}>
                      <option value="pago">Pago</option>
                      <option value="pendente">Pendente</option>
                      <option value="realizado">Realizado</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Valor</Label>
                    <Input type="number" step="0.01" min="0" value={form.amount || ''} onChange={event => setForm({ ...form, amount: Number(event.target.value) })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Data</Label>
                    <Input type="date" value={toDateInput(form.date)} onChange={event => setForm({ ...form, date: event.target.value })} />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Descricao</Label>
                  <Input value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} />
                </div>

                <div className="space-y-1">
                  <Label>Conta</Label>
                  <select value={form.accountId || ''} onChange={event => setForm({ ...form, accountId: event.target.value, creditCardId: '', status: 'pago' })} className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm dark:bg-input/30">
                    <option value="">Selecione uma conta</option>
                    {accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label>Cartao</Label>
                  <select value={form.creditCardId || ''} onChange={event => setForm({ ...form, creditCardId: event.target.value, accountId: '', status: 'realizado' })} className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm dark:bg-input/30">
                    <option value="">Selecione um cartao</option>
                    {creditCards.map(card => <option key={card.id} value={card.id}>{card.name}{card.lastFourDigits ? ` - final ${card.lastFourDigits}` : ''}</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label>Categoria</Label>
                  <select value={form.categoryId || ''} onChange={event => setForm({ ...form, categoryId: event.target.value })} className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm dark:bg-input/30">
                    <option value="">Sem categoria</option>
                    {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Parcela atual</Label>
                    <Input type="number" min="1" value={form.installmentNumber || ''} onChange={event => setForm({ ...form, installmentNumber: event.target.value ? Number(event.target.value) : undefined })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Total parcelas</Label>
                    <Input type="number" min="1" value={form.totalInstallments || ''} onChange={event => setForm({ ...form, totalInstallments: event.target.value ? Number(event.target.value) : undefined })} />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Tags</Label>
                  <div className="flex flex-wrap gap-2 rounded-lg border border-border p-2">
                    {tags.length === 0 && <span className="text-xs text-muted-foreground">Nenhuma tag cadastrada.</span>}
                    {tags.map(tag => {
                      const checked = form.tags?.includes(tag.id || '') || false;
                      return (
                        <label key={tag.id} className="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={event => {
                              const current = new Set(form.tags || []);
                              if (event.target.checked && tag.id) current.add(tag.id);
                              if (!event.target.checked && tag.id) current.delete(tag.id);
                              setForm({ ...form, tags: [...current] });
                            }}
                          />
                          {tag.name}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Observacao</Label>
                  <textarea value={form.observation || ''} onChange={event => setForm({ ...form, observation: event.target.value })} rows={3} className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30" />
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Button onClick={handleConfirm} disabled={isConfirming || selectedCandidate.status !== 'pending'}>
                    {isConfirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Confirmar
                  </Button>
                  <Button variant="outline" onClick={handleIgnore} disabled={selectedCandidate.status !== 'pending'}><XCircle className="w-4 h-4" />Ignorar</Button>
                  <Button variant="destructive" onClick={handleDuplicate} disabled={selectedCandidate.status !== 'pending'}><AlertTriangle className="w-4 h-4" />Duplicado</Button>
                  <Button variant="outline" onClick={() => setSelectedCandidateId(null)}><LinkIcon className="w-4 h-4" />Fechar</Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Upload className="w-5 h-5 text-primary" />Arquivos bancarios</CardTitle>
          <CardDescription>Importe OFX, CSV, XLS, XLSX ou PDF textual para criar candidatos em lote. Faturas de cartao continuam no fluxo especializado.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div className="space-y-1">
              <Label>Conta sugerida para o arquivo</Label>
              <select value={importAccountId} onChange={event => setImportAccountId(event.target.value)} className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm dark:bg-input/30">
                <option value="">Detectar pelo arquivo ou escolher depois</option>
                {accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
            </div>
            <div>
              <input id="bank-file-import" type="file" accept=".ofx,.csv,.xls,.xlsx,.pdf" className="hidden" onChange={handleFileImport} disabled={isImportingFile} />
              <Button render={<label htmlFor="bank-file-import" />} className="w-full md:w-auto" disabled={isImportingFile}>
                {isImportingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Importar arquivo
              </Button>
            </div>
          </div>
          {filePreview && (
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{filePreview.fileName}</p>
                  <p className="text-xs text-muted-foreground">{filePreview.lineCount} linha(s) detectada(s) - {filePreview.kind.toUpperCase()}</p>
                </div>
                <Button onClick={handleCreateCandidatesFromFile} disabled={isImportingFile}>
                  {isImportingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Inbox className="w-4 h-4" />}
                  Criar candidatos
                </Button>
              </div>

              {filePreview.sheetNames.length > 1 && (
                <div className="space-y-1">
                  <Label>Aba da planilha</Label>
                  <select value={filePreview.selectedSheet || ''} onChange={event => handleChangeSheet(event.target.value)} className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm dark:bg-input/30">
                    {filePreview.sheetNames.map(sheet => <option key={sheet} value={sheet}>{sheet}</option>)}
                  </select>
                </div>
              )}

              {filePreview.headers.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(['date', 'description', 'amount', 'debit', 'credit', 'type'] as const).map(field => (
                    <div key={field} className="space-y-1">
                      <Label>{field === 'date' ? 'Data' : field === 'description' ? 'Descricao' : field === 'amount' ? 'Valor unico' : field === 'debit' ? 'Debito' : field === 'credit' ? 'Credito' : 'Tipo'}</Label>
                      <select value={fileMapping[field] || ''} onChange={event => setFileMapping({ ...fileMapping, [field]: event.target.value || undefined })} className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm dark:bg-input/30">
                        <option value="">Nao usar</option>
                        {filePreview.headers.map(header => <option key={header} value={header}>{header}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}

              {filePreview.rowsPreview.length > 0 && (
                <div className="max-h-48 overflow-auto rounded-lg border border-border bg-background">
                  <table className="w-full min-w-[520px] text-xs">
                    <thead className="bg-muted/50">
                      <tr>{Object.keys(filePreview.rowsPreview[0]).slice(0, 6).map(header => <th key={header} className="px-2 py-1 text-left font-medium">{header}</th>)}</tr>
                    </thead>
                    <tbody>
                      {filePreview.rowsPreview.map((row, index) => (
                        <tr key={index} className="border-t border-border">
                          {Object.keys(filePreview.rowsPreview[0]).slice(0, 6).map(header => <td key={header} className="px-2 py-1 text-muted-foreground">{String(row[header] ?? '').slice(0, 80)}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="outline" render={<Link to="/reconciliation" />}>Conciliar extrato existente</Button>
            <Button variant="outline" render={<Link to="/cards" />}>Conferir fatura de cartao</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}