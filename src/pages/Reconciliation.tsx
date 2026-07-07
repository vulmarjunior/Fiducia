import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select as ShadcnSelect, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { parseOFX, ImportedTransaction } from '../lib/ofxParser';
import Papa from 'papaparse';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, X, Link as LinkIcon, Plus, CheckCircle2, AlertCircle, LayoutDashboard, Download, FileText, Sparkles, Loader2 } from 'lucide-react';
import { calculateInvoicePeriod, resolveAccountName } from '../lib/utils';
import { PageHelp } from '../components/PageHelp';
import { callGroq } from '../services/groqService';

export function Reconciliation() {
  const { user, isAuthReady } = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [creditCards, setCreditCards] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [systemTransactions, setSystemTransactions] = useState<any[]>([]);
  const [importedTransactions, setImportedTransactions] = useState<ImportedTransaction[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isAiMatching, setIsAiMatching] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  
  const [selectedImportedId, setSelectedImportedId] = useState<string | null>(null);
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const accountsQuery = query(collection(db, 'accounts'), where('userId', '==', user.uid));
    const unsubscribeAccounts = onSnapshot(accountsQuery, (snapshot) => {
      setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'accounts'));

    const creditCardsQuery = query(collection(db, 'creditCards'), where('userId', '==', user.uid));
    const unsubscribeCreditCards = onSnapshot(creditCardsQuery, (snapshot) => {
      setCreditCards(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'creditCards'));

    return () => {
      unsubscribeAccounts();
      unsubscribeCreditCards();
    };
  }, [user, isAuthReady]);

  useEffect(() => {
    if (!isAuthReady || !user || !selectedAccountId) {
      setSystemTransactions([]);
      return;
    }

    const isCreditCard = creditCards.some(cc => cc.id === selectedAccountId);
    
    // Fetch pending transactions for the selected account
    const txQuery = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid),
      where(isCreditCard ? 'creditCardId' : 'accountId', '==', selectedAccountId),
      where('reconciliationStatus', 'in', ['nao_conciliado', null])
    );

    const unsubscribeTx = onSnapshot(txQuery, (snapshot) => {
      const account = accounts.find(a => a.id === selectedAccountId);
      const openingDate = account?.openingDate;

      const txs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((t: any) => !t.reconciliationStatus || t.reconciliationStatus === 'nao_conciliado')
        .filter((t: any) => {
          if (!openingDate) return true;
          return (t.date?.split('T')[0] || '') >= openingDate;
        });
      
      // Sort by date descending
      txs.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setSystemTransactions(txs);
    });

    return () => unsubscribeTx();
  }, [user, isAuthReady, selectedAccountId, creditCards, accounts]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      const content = e.target?.result as string;
      
      if (file.name.toLowerCase().endsWith('.ofx')) {
        const parsed = parseOFX(content);
        setImportedTransactions(parsed);
        toast.success(`${parsed.length} transações importadas do OFX.`);
      } else if (file.name.toLowerCase().endsWith('.csv')) {
        Papa.parse(content, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            // Simple CSV parser assuming Date, Amount, Description columns
            // You might need to adjust this based on the actual CSV format
            const parsed: ImportedTransaction[] = results.data.map((row: any, index) => {
              const dateStr = row.Date || row.Data || row.date || row.data;
              const amountStr = row.Amount || row.Valor || row.amount || row.valor;
              const descStr = row.Description || row.Descricao || row.description || row.descricao || row.Memo || row.memo;
              
              let amount = 0;
              if (amountStr) {
                amount = parseFloat(amountStr.replace(',', '.'));
              }
              
              let date = new Date().toISOString();
              if (dateStr) {
                // Try to parse DD/MM/YYYY
                const parts = dateStr.split('/');
                if (parts.length === 3) {
                  date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00Z`).toISOString();
                } else {
                  date = new Date(dateStr).toISOString();
                }
              }

              return {
                id: `csv-${index}-${Date.now()}`,
                date,
                amount: Math.abs(amount),
                description: descStr || 'Transação Importada',
                type: amount >= 0 ? 'receita' : 'despesa',
                status: 'pending'
              };
            });
            setImportedTransactions(parsed);
            toast.success(`${parsed.length} transações importadas do CSV.`);
          },
          error: (error) => {
            toast.error(`Erro ao ler CSV: ${error.message}`);
          }
        });
      } else {
        toast.error('Formato de arquivo não suportado. Use OFX ou CSV.');
      }
      setIsUploading(false);
      // Reset file input
      event.target.value = '';
    };

    reader.onerror = () => {
      toast.error('Erro ao ler o arquivo.');
      setIsUploading(false);
    };

    reader.readAsText(file);
  };

  const autoReconcile = () => {
    let matchCount = 0;
    const newImported = [...importedTransactions];
    const matchedSystemIds = new Set<string>();

    newImported.forEach(impTx => {
      if (impTx.status !== 'pending') return;

      // Find a matching system transaction
      const match = systemTransactions.find(sysTx => {
        if (matchedSystemIds.has(sysTx.id)) return false;
        
        // Match criteria: Same type, same amount, date within 3 days
        const isSameType = (sysTx.type === 'receita' || sysTx.type === 'income') === (impTx.type === 'receita');
        const isSameAmount = Math.abs(sysTx.amount - impTx.amount) < 0.01;
        
        const sysDate = parseISO(sysTx.date);
        const impDate = parseISO(impTx.date);
        const daysDiff = Math.abs(differenceInDays(sysDate, impDate));
        
        return isSameType && isSameAmount && daysDiff <= 3;
      });

      if (match) {
        impTx.status = 'matched';
        impTx.matchedWithSystemId = match.id;
        matchedSystemIds.add(match.id);
        matchCount++;
      }
    });

    setImportedTransactions(newImported);
    toast.success(`${matchCount} transações conciliadas automaticamente.`);
  };

  const handleAiAutoMatch = async () => {
    if (importedTransactions.length === 0 || systemTransactions.length === 0) return;
    setIsAiMatching(true);
    try {
      const pendingImported = importedTransactions.filter(t => t.status === 'pending');
      const matchedIds = new Set(importedTransactions.filter(t => t.matchedWithSystemId).map(t => t.matchedWithSystemId));
      const unmatchedSystem = systemTransactions.filter(t => !matchedIds.has(t.id));

      if (pendingImported.length === 0) {
        toast.info('Nenhuma transação pendente para conciliar.');
        return;
      }

      const prompt = `Você é um assistente de conciliação financeira. Faça o match entre as transações do banco (importadas) e as transações do sistema.

Regras:
- Mesmo valor é evidência forte, mas diferenças de centavos podem existir
- Similaridade de descrição é evidência forte (ex: "UBER TRIP" ≈ "Uber")
- Proximidade de data (até 5 dias) ajuda
- Cada transação só pode ter um match
- NÃO invente matches — se não houver correspondência, não inclua

Responda APENAS com um array JSON válido, sem formatação markdown:
[{"importedId": "id", "systemId": "id", "confidence": 0.95}]

Transações importadas (banco):
${JSON.stringify(pendingImported.map(t => ({ id: t.id, desc: t.description, amount: t.amount, date: t.date.split('T')[0], type: t.type })))}

Transações do sistema:
${JSON.stringify(unmatchedSystem.map(t => ({ id: t.id, desc: t.description, amount: t.amount, date: t.date.split('T')[0], type: t.type })))}`;

      const result = await callGroq([{ role: 'user', content: prompt }], { maxTokens: 1000, temperature: 0.1 });
      const matches = JSON.parse(result);
      let appliedCount = 0;
      const newImported = [...importedTransactions];
      const usedSystemIds = new Set<string>();

      for (const match of matches) {
        if (match.confidence >= 0.7 && !usedSystemIds.has(match.systemId)) {
          const idx = newImported.findIndex(t => t.id === match.importedId);
          if (idx !== -1 && newImported[idx].status === 'pending') {
            newImported[idx] = { ...newImported[idx], status: 'matched', matchedWithSystemId: match.systemId };
            usedSystemIds.add(match.systemId);
            appliedCount++;
          }
        }
      }

      setImportedTransactions(newImported);
      toast.success(`IA encontrou ${matches.length} match(es). ${appliedCount} aplicado(s) automaticamente.`);
      if (matches.length > appliedCount) {
        toast.info(`${matches.length - appliedCount} match(es) com confiança baixa — verifique manualmente.`);
      }
    } catch (error) {
      console.error('AI Auto-Match error:', error);
      toast.error('Erro no auto-match com IA. Tente o auto-match padrão.');
    } finally {
      setIsAiMatching(false);
    }
  };

  const handleAiAnalysis = async () => {
    if (importedTransactions.length === 0 && systemTransactions.length === 0) return;
    setIsAiAnalyzing(true);
    try {
      const unmatchedImported = importedTransactions.filter(t => t.status !== 'matched' && t.status !== 'added');
      const matchedIds = new Set(importedTransactions.filter(t => t.matchedWithSystemId).map(t => t.matchedWithSystemId));
      const unmatchedSystem = systemTransactions.filter(t => !matchedIds.has(t.id));

      const bankTotal = unmatchedImported.reduce((s, t) => s + t.amount, 0);
      const sysTotal = unmatchedSystem.reduce((s, t) => s + t.amount, 0);

      const prompt = `Você é um auditor financeiro. Analise as divergências abaixo após uma conciliação.

Transações no EXTRATO BANCÁRIO sem match no sistema:
${JSON.stringify(unmatchedImported.map(t => ({ desc: t.description, amount: t.amount, date: t.date.split('T')[0] })))}

Total no extrato sem match: R$ ${bankTotal.toFixed(2)}

Transações no SISTEMA sem match no extrato:
${JSON.stringify(unmatchedSystem.map(t => ({ desc: t.description, amount: t.amount, date: t.date.split('T')[0] })))}

Total no sistema sem match: R$ ${sysTotal.toFixed(2)}

Forneça:
1. Possíveis explicações para cada divergência
2. Comparação dos totais
3. Recomendação curta

Responda em Português, máximo 3 parágrafos curtos, tom profissional.`;

      const analysis = await callGroq([{ role: 'user', content: prompt }], { maxTokens: 500 });
      setAiAnalysis(analysis);
    } catch (error) {
      console.error('AI Analysis error:', error);
      toast.error('Erro ao gerar análise de divergências.');
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  const manualMatch = () => {
    if (!selectedImportedId || !selectedSystemId) {
      toast.error('Selecione uma transação importada e uma do sistema para conciliar.');
      return;
    }

    setImportedTransactions(prev => prev.map(tx => 
      tx.id === selectedImportedId 
        ? { ...tx, status: 'matched', matchedWithSystemId: selectedSystemId } 
        : tx
    ));
    
    setSelectedImportedId(null);
    setSelectedSystemId(null);
    toast.success('Transações conciliadas manualmente.');
  };

  const ignoreImported = (id: string) => {
    setImportedTransactions(prev => prev.map(tx => 
      tx.id === id ? { ...tx, status: 'ignored' } : tx
    ));
    if (selectedImportedId === id) setSelectedImportedId(null);
  };

  const unmatchImported = (id: string) => {
    setImportedTransactions(prev => prev.map(tx => 
      tx.id === id ? { ...tx, status: 'pending', matchedWithSystemId: undefined } : tx
    ));
    if (selectedImportedId === id) setSelectedImportedId(null);
  };

  const addAsNewTransaction = async (impTx: ImportedTransaction) => {
    if (!user || !selectedAccountId) return;

    const isCreditCard = creditCards.some(cc => cc.id === selectedAccountId);
    const card = creditCards.find(cc => cc.id === selectedAccountId);
    
    const newTx = {
      userId: user.uid,
      amount: impTx.amount,
      date: impTx.date,
      description: impTx.description,
      type: impTx.type,
      status: isCreditCard ? 'realizado' : 'pago',
      reconciliationStatus: 'conciliado',
      categoryId: 'default', // Default category for imported transactions
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any;

    if (isCreditCard && card) {
      newTx.creditCardId = selectedAccountId;
      newTx.invoicePeriod = calculateInvoicePeriod(impTx.date, card.closingDay, card.dueDay);
    } else {
      newTx.accountId = selectedAccountId;
    }

    try {
      const batch = writeBatch(db);
      const newTxRef = doc(collection(db, 'transactions'));
      batch.set(newTxRef, newTx);
      
      // Update account balance if it's a checking account and status is 'pago'
      if (!isCreditCard) {
        const acc = accounts.find(a => a.id === selectedAccountId);
        if (acc) {
          const balanceChange = impTx.type === 'receita' ? impTx.amount : -impTx.amount;
          batch.update(doc(db, 'accounts', acc.id), { balance: (acc.balance || 0) + balanceChange });
        }
      }

      await batch.commit();

      // Mark imported as added
      setImportedTransactions(prev => prev.map(tx => 
        tx.id === impTx.id ? { ...tx, status: 'added', matchedWithSystemId: newTxRef.id } : tx
      ));
      
      if (selectedImportedId === impTx.id) setSelectedImportedId(null);
      toast.success('Nova transação adicionada e conciliada.');
    } catch (error) {
      console.error("Error adding transaction:", error);
      toast.error('Erro ao adicionar transação.');
    }
  };

  const finalizeReconciliation = async () => {
    if (!user || !selectedAccountId) return;

    const matchedTransactions = importedTransactions.filter(tx => tx.status === 'matched' && tx.matchedWithSystemId);
    
    if (matchedTransactions.length === 0) {
      toast.error('Nenhuma transação conciliada para finalizar.');
      return;
    }

    try {
      const batch = writeBatch(db);
      
      // Update all matched system transactions
      matchedTransactions.forEach(impTx => {
        if (impTx.matchedWithSystemId) {
          batch.update(doc(db, 'transactions', impTx.matchedWithSystemId), {
            reconciliationStatus: 'conciliado',
            updatedAt: new Date().toISOString()
          });
        }
      });

      // Create reconciliation history record
      const historyRef = doc(collection(db, 'reconciliationHistory'));
      
      // Find date range
      const dates = importedTransactions.map(t => new Date(t.date).getTime());
      const minDate = new Date(Math.min(...dates)).toISOString();
      const maxDate = new Date(Math.max(...dates)).toISOString();

      batch.set(historyRef, {
        userId: user.uid,
        accountId: selectedAccountId,
        periodStart: minDate,
        periodEnd: maxDate,
        reconciledAt: new Date().toISOString()
      });

      await batch.commit();
      
      // Clear imported transactions
      setImportedTransactions([]);
      setSelectedImportedId(null);
      setSelectedSystemId(null);
      
      toast.success('Conciliação finalizada com sucesso!');
    } catch (error) {
      console.error("Error finalizing reconciliation:", error);
      toast.error('Erro ao finalizar conciliação.');
    }
  };

  const pendingImported = importedTransactions.filter(t => t.status === 'pending');
  const matchedImported = importedTransactions.filter(t => t.status === 'matched' || t.status === 'added');
  const ignoredImported = importedTransactions.filter(t => t.status === 'ignored');

  // Filter out system transactions that are already matched in the current session
  const matchedSystemIdsInSession = new Set(importedTransactions.filter(t => t.status === 'matched').map(t => t.matchedWithSystemId));
  const availableSystemTransactions = systemTransactions.filter(t => !matchedSystemIdsInSession.has(t.id));

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Conciliação</h1>
            <PageHelp
              title="Conciliação Bancária"
              description="Compare seus lançamentos do sistema com os extratos bancários (OFX ou CSV) para confirmar quais transações já foram processadas pelo banco."
              items={[
                { label: "Importar Extrato", desc: "Envie o arquivo fornecido pelo seu banco. O sistema extrai automaticamente as transações." },
                { label: "Match Automático", desc: "O sistema sugere correspondências quando valor e data batem (diferença de até 3 dias)." },
                { label: "Diferença da Auditoria", desc: "Conciliação é sobre conferir lançamentos existentes. Auditoria é para diagnosticar e corrigir saldos." },
              ]}
              relatedPages={["Auditoria"]}
            />
          </div>
          <p className="text-muted-foreground mt-1">Importe seu extrato e concilie com os lançamentos do sistema.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="w-64">
            <ShadcnSelect value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma conta">
                  {selectedAccountId ? resolveAccountName(selectedAccountId, accounts, creditCards) : 'Selecione uma conta'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Contas Correntes</SelectLabel>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>{resolveAccountName(a.id, accounts, creditCards)}</SelectItem>
                  ))}
                </SelectGroup>
                {creditCards.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Cartões de Crédito</SelectLabel>
                    {creditCards.map(c => (
                      <SelectItem key={c.id} value={c.id}>{resolveAccountName(c.id, accounts, creditCards)}</SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </ShadcnSelect>
          </div>
          
          <div>
            <Input 
              type="file" 
              accept=".ofx,.csv" 
              onChange={handleFileUpload} 
              disabled={!selectedAccountId || isUploading}
              className="cursor-pointer"
              id="file-upload"
            />
          </div>
        </div>
      </div>

      {importedTransactions.length > 0 && (
          <div className="flex items-center justify-between bg-card p-4 rounded-xl border shadow-sm">
          <div className="flex gap-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground font-medium">Total Importado</p>
              <p className="text-2xl font-bold">{importedTransactions.length}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground font-medium">Pendentes</p>
              <p className="text-2xl font-bold text-amber-500 dark:text-amber-400">{pendingImported.length}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground font-medium">Conciliados</p>
              <p className="text-2xl font-bold text-green-500 dark:text-green-400">{matchedImported.length}</p>
            </div>
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={autoReconcile} disabled={pendingImported.length === 0}>
              Conciliar Autom.
            </Button>
            <Button variant="outline" onClick={handleAiAutoMatch} disabled={isAiMatching || pendingImported.length === 0} className="gap-2">
              {isAiMatching ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Buscando...</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Auto-Conciliar com IA</>
              )}
            </Button>
            <Button onClick={finalizeReconciliation} disabled={matchedImported.length === 0} className="bg-fiducia-blue hover:bg-fiducia-blue/90">
              Finalizar Conciliação
            </Button>
          </div>
        </div>
      )}

      {importedTransactions.length > 0 ? (
        <><div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Imported Transactions */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Download className="h-5 w-5 text-muted-foreground" />
              Extrato Importado
            </h2>
            
            <div className="bg-card rounded-xl border shadow-sm overflow-hidden flex flex-col h-[600px]">
              <div className="overflow-y-auto flex-1 p-2 space-y-2">
                {importedTransactions.map(tx => (
                  <div 
                    key={tx.id}
                    onClick={() => tx.status === 'pending' && setSelectedImportedId(tx.id === selectedImportedId ? null : tx.id)}
                      className={`p-4 rounded-lg border transition-all ${
                        tx.status === 'matched' || tx.status === 'added' ? 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30 opacity-60' :
                        tx.status === 'ignored' ? 'bg-muted border-border opacity-50' :
                        selectedImportedId === tx.id ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-300 dark:border-blue-500/30 ring-2 ring-blue-200 dark:ring-blue-500/30 cursor-pointer' :
                        'bg-card border-border hover:border-blue-300 dark:hover:border-blue-500/50 cursor-pointer'
                      }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-medium text-foreground">{tx.description}</div>
                      <div className={`font-mono font-semibold ${tx.type === 'receita' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {tx.type === 'receita' ? '+' : '-'}R$ {tx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-sm text-muted-foreground">
                      <div>{format(parseISO(tx.date), "dd 'de' MMM, yyyy", { locale: ptBR })}</div>
                      
                      {tx.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground hover:text-red-600 dark:hover:text-red-400" onClick={(e) => { e.stopPropagation(); ignoreImported(tx.id); }}>
                            <X className="h-4 w-4 mr-1" /> Ignorar
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground hover:text-green-600 dark:hover:text-green-400" onClick={(e) => { e.stopPropagation(); addAsNewTransaction(tx); }}>
                            <Plus className="h-4 w-4 mr-1" /> Adicionar
                          </Button>
                        </div>
                      )}
                      
                      {(tx.status === 'matched' || tx.status === 'added') && (
                        <div className="flex items-center text-green-600 dark:text-green-400 font-medium gap-1">
                          <CheckCircle2 className="h-4 w-4" /> Conciliado
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 ml-2 text-muted-foreground hover:text-red-500 dark:hover:text-red-400" onClick={(e) => { e.stopPropagation(); unmatchImported(tx.id); }}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      
                      {tx.status === 'ignored' && (
                        <div className="flex items-center text-muted-foreground font-medium gap-1">
                          <AlertCircle className="h-4 w-4" /> Ignorado
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 ml-2 text-muted-foreground hover:text-blue-500 dark:hover:text-blue-400" onClick={(e) => { e.stopPropagation(); unmatchImported(tx.id); }}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: System Transactions */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <LayoutDashboard className="h-5 w-5 text-muted-foreground" />
                Lançamentos do Sistema
              </h2>
              
              {selectedImportedId && selectedSystemId && (
                <Button size="sm" onClick={manualMatch} className="bg-fiducia-blue hover:bg-fiducia-blue/90 animate-in fade-in zoom-in duration-200">
                  <LinkIcon className="h-4 w-4 mr-2" />
                  Vincular Selecionados
                </Button>
              )}
            </div>
            
            <div className="bg-card rounded-xl border shadow-sm overflow-hidden flex flex-col h-[600px]">
              <div className="overflow-y-auto flex-1 p-2 space-y-2">
                {availableSystemTransactions.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
                    <CheckCircle2 className="h-12 w-12 mb-4 text-muted-foreground" />
                    <p>Não há lançamentos pendentes de conciliação para esta conta no sistema.</p>
                  </div>
                ) : (
                  availableSystemTransactions.map(tx => (
                    <div 
                      key={tx.id}
                      onClick={() => setSelectedSystemId(tx.id === selectedSystemId ? null : tx.id)}
                      className={`p-4 rounded-lg border transition-all cursor-pointer ${
                        selectedSystemId === tx.id ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-300 dark:border-blue-500/30 ring-2 ring-blue-200 dark:ring-blue-500/30' :
                        'bg-card border-border hover:border-blue-300 dark:hover:border-blue-500/50'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-medium text-foreground">{tx.description}</div>
                        <div className={`font-mono font-semibold ${tx.type === 'receita' || tx.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {tx.type === 'receita' || tx.type === 'income' ? '+' : '-' }R$ {tx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-sm text-muted-foreground">
                        <div>{format(parseISO(tx.date), "dd 'de' MMM, yyyy", { locale: ptBR })}</div>
                        <div className="flex gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${
                            tx.status === 'pago' ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400' : 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400'
                          }`}>
                            {tx.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* AI Actions */}
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={handleAiAnalysis}
            disabled={isAiAnalyzing || matchedImported.length === 0}
            className="gap-2"
          >
            {isAiAnalyzing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Analisando...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Analisar Divergências com IA</>
            )}
          </Button>
        </div>

        {aiAnalysis && (
          <div className="bg-gradient-to-br from-fiducia-blue/5 via-transparent to-emerald-500/5 border border-border/60 rounded-2xl p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 via-cyan-400 to-blue-500 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-white dark:text-[#0a101c]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Análise de Divergências IA
                </div>
                <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {aiAnalysis}
                </div>
              </div>
            </div>
          </div>
        )}
        </>) : (
        <div className="bg-card rounded-2xl border border-dashed border-border p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
          <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center mb-6">
            <FileText className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">Nenhum extrato importado</h3>
          <p className="text-muted-foreground max-w-md mb-8">
            Selecione uma conta e faça o upload de um arquivo OFX ou CSV do seu banco para iniciar a conciliação.
          </p>
          <Button onClick={() => document.getElementById('file-upload')?.click()} disabled={!selectedAccountId} className="bg-fiducia-blue hover:bg-fiducia-blue/90">
            Selecionar Arquivo
          </Button>
        </div>
      )}
    </div>
  );
}
