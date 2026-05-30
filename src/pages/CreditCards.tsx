import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc, writeBatch, runTransaction } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { CreditCard, Plus, Trash2, Edit, Eye, Calendar, AlertCircle, ArrowUpRight, ChevronLeft, ChevronRight, List, MoreVertical, Search, Printer, FileText, PlusCircle, RefreshCcw, FileUp } from 'lucide-react';
import { toast } from 'sonner';
import { MoneyInput } from '../components/MoneyInput';
import { calculateInvoicePeriod, resolveAccountName, parseLocalDate } from '../lib/utils';
import { logActivity } from '../services/activityLogService';
import { PageHelp } from '../components/PageHelp';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { getCategoryIcon } from '../lib/categoryIcons';
import { getCardBrandDetails } from '../utils/cardBrandUtils';
import { useTransactionDialog } from '../contexts/TransactionDialogContext';
import { extractTextFromPdf, parseInvoiceWithGroq, PdfTransaction } from '../services/pdfInvoiceService';
import { PdfImportReviewDialog } from '../components/PdfImportReviewDialog';

export function CreditCards() {
  const { open: openTxDialog } = useTransactionDialog();
  const { user, isAuthReady } = useAuth();
  const [cards, setCards] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', limit: 0, closingDay: '1', dueDay: '10' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  const [selectedCardForInvoice, setSelectedCardForInvoice] = useState<any>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [selectedInvoiceMonth, setSelectedInvoiceMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [isPayInvoiceDialogOpen, setIsPayInvoiceDialogOpen] = useState(false);
  const [paymentData, setPaymentData] = useState({ accountId: '', amount: 0, date: new Date().toISOString().split('T')[0] });
  
  const [categories, setCategories] = useState<any[]>([]);
  const [closedPeriods, setClosedPeriods] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [txToDelete, setTxToDelete] = useState<any>(null);
  const [deleteScope, setDeleteScope] = useState('only');
  const [invoiceSearchTerm, setInvoiceSearchTerm] = useState('');

  // PDF Import state
  const [isPdfReviewOpen, setIsPdfReviewOpen] = useState(false);
  const [pdfTransactions, setPdfTransactions] = useState<PdfTransaction[]>([]);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [pdfLoadingStep, setPdfLoadingStep] = useState<'extracting' | 'analyzing' | null>(null);
  const pdfInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const q = query(collection(db, 'creditCards'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCards(data);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'creditCards'));

    const tq = query(
      collection(db, 'transactions'), 
      where('userId', '==', user.uid)
    );
    const unsubscribeT = onSnapshot(tq, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(data);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'transactions'));

    const aq = query(collection(db, 'accounts'), where('userId', '==', user.uid));
    const unsubscribeA = onSnapshot(aq, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAccounts(data);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'accounts'));

    const cq = query(collection(db, 'categories'), where('userId', '==', user.uid));
    const unsubscribeC = onSnapshot(cq, (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'categories'));

    const cpq = query(collection(db, 'closedPeriods'), where('userId', '==', user.uid));
    const unsubscribeCP = onSnapshot(cpq, (snapshot) => {
      setClosedPeriods(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'closedPeriods'));

    const invQ = query(collection(db, 'invoices'), where('userId', '==', user.uid));
    const unsubscribeInv = onSnapshot(invQ, (snapshot) => {
      setInvoices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'invoices'));

    return () => {
      unsubscribe();
      unsubscribeT();
      unsubscribeA();
      unsubscribeC();
      unsubscribeCP();
      unsubscribeInv();
    };
  }, [user, isAuthReady]);

  const location = useLocation();

  useEffect(() => {
    const presetCardId = (location.state as any)?.presetCardId;
    if (presetCardId && cards.length > 0) {
      const card = cards.find(c => c.id === presetCardId);
      if (card) {
        setSelectedCardForInvoice(card);
        const currentPeriod = calculateInvoicePeriod(new Date(), card.closingDay, card.dueDay);
        const [year, month] = currentPeriod.split('-').map(Number);
        setSelectedInvoiceMonth(new Date(year, month - 1, 1));
        setIsInvoiceModalOpen(true);
        window.history.replaceState({}, '');
      }
    }
  }, [location.state, cards]);

  const calculateInvoiceTotal = (cardId: string, closingDay: number, dueDay: number) => {
    const currentPeriod = calculateInvoicePeriod(new Date(), closingDay, dueDay);
    return transactions
      .filter(t => (t.accountId === cardId || t.destinationAccountId === cardId) && t.invoicePeriod === currentPeriod)
      .reduce((acc, t) => {
        if ((t.type === 'expense' || t.type === 'despesa') && t.accountId === cardId) {
          return acc + (t.amount || 0);
        }
        if ((t.type === 'income' || t.type === 'receita') && t.accountId === cardId) {
          return acc - (t.amount || 0);
        }
        if ((t.type === 'transfer' || t.type === 'transferencia') && t.destinationAccountId === cardId) {
          return acc - (t.amount || 0);
        }
        if ((t.type === 'transfer' || t.type === 'transferencia') && t.accountId === cardId) {
          return acc + (t.amount || 0);
        }
        return acc;
      }, 0);
  };

  const calculateTotalLimitUsage = (cardId: string) => {
    return transactions
      .filter(t => (t.accountId === cardId || t.destinationAccountId === cardId) && t.creditCardId === cardId)
      .reduce((acc, t) => {
        if ((t.type === 'expense' || t.type === 'despesa') && t.accountId === cardId) {
          return acc + (t.amount || 0);
        }
        if ((t.type === 'income' || t.type === 'receita') && t.accountId === cardId) {
          return acc - (t.amount || 0);
        }
        if ((t.type === 'transfer' || t.type === 'transferencia') && t.destinationAccountId === cardId) {
          return acc - (t.amount || 0);
        }
        if ((t.type === 'transfer' || t.type === 'transferencia') && t.accountId === cardId) {
          return acc + (t.amount || 0);
        }
        return acc;
      }, 0);
  };

  const getPreviousPeriod = (period: string) => {
    const [year, month] = period.split('-').map(Number);
    let prevMonth = month - 1;
    let prevYear = year;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear--;
    }
    return `${prevYear}-${prevMonth.toString().padStart(2, '0')}`;
  };

  const calculatePeriodBalance = (cardId: string, period: string) => {
    const periodTransactions = transactions.filter(t => 
      (t.accountId === cardId || t.destinationAccountId === cardId) && 
      t.invoicePeriod === period
    );
    
    const expenses = periodTransactions
      .filter(t => t.type === 'expense' || t.type === 'despesa')
      .reduce((acc, t) => acc + t.amount, 0);
      
    const payments = periodTransactions
      .filter(t => (t.type === 'transfer' || t.type === 'transferencia') && t.destinationAccountId === cardId)
      .reduce((acc, t) => acc + t.amount, 0);
      
    const incomes = periodTransactions
      .filter(t => (t.type === 'income' || t.type === 'receita') && t.accountId === cardId)
      .reduce((acc, t) => acc + t.amount, 0);

    return expenses - payments - incomes;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const limit = formData.limit;

      const cardData = {
        userId: user.uid,
        name: formData.name,
        limit: limit,
        closingDay: parseInt(formData.closingDay),
        dueDay: parseInt(formData.dueDay),
        createdAt: new Date().toISOString()
      };

      if (editingId) {
        await updateDoc(doc(db, 'creditCards', editingId), {
          name: cardData.name,
          limit: cardData.limit,
          closingDay: cardData.closingDay,
          dueDay: cardData.dueDay
        });
        logActivity({ userId: user.uid, action: 'update', entityType: 'creditCard', entityId: editingId, description: `Cartão editado: ${cardData.name}` }).catch(() => {});
        toast.success('Cartão de crédito atualizado com sucesso');
      } else {
        const cardRef = await addDoc(collection(db, 'creditCards'), cardData);
        logActivity({ userId: user.uid, action: 'create', entityType: 'creditCard', entityId: cardRef.id, description: `Cartão criado: ${cardData.name}` }).catch(() => {});
        toast.success('Cartão de crédito adicionado com sucesso');
      }
      
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'creditCards');
      toast.error('Falha ao salvar cartão de crédito');
    }
  };

  const isPeriodClosed = (date: string, accountId: string) => {
    const card = cards.find(c => c.id === accountId);
    if (card) {
      const periodToCheck = calculateInvoicePeriod(date, card.closingDay, card.dueDay);
      const invoice = invoices.find(i => i.cardId === accountId && i.period === periodToCheck);
      return invoice ? (invoice.status === 'fechada' || invoice.status === 'paga') : false;
    }
    const month = date.substring(0, 7);
    return closedPeriods.some(cp => cp.month === month && cp.accountId === accountId);
  };

  const handlePayInvoice = async () => {
    if (!selectedCardForInvoice || !paymentData.accountId || paymentData.amount <= 0) {
      toast.error('Preencha todos os campos corretamente');
      return;
    }

    if (!paymentData.accountId) return;

    let paymentTxRef: any;
    try {
      await runTransaction(db, async (transaction) => {
        // Read source account balance first (Firestore requires all reads before writes)
        const accRef = doc(db, 'accounts', paymentData.accountId);
        const accSnap = await transaction.get(accRef);
        if (!accSnap.exists()) throw new Error('Conta de origem não encontrada');
        const currentBalance = accSnap.data().balance || 0;

        // Create transfer transaction
        const tData = {
          userId: user.uid,
          type: 'transferencia',
          amount: paymentData.amount,
          date: paymentData.date,
          description: `Pagamento Fatura ${selectedCardForInvoice.name} - ${selectedInvoiceMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`,
          accountId: paymentData.accountId,
          destinationAccountId: selectedCardForInvoice.id,
          categoryId: 'Pagamento de Cartão',
          status: 'pago',
          invoicePeriod: calculateInvoicePeriod(selectedInvoiceMonth, selectedCardForInvoice.closingDay, selectedCardForInvoice.dueDay),
          createdAt: new Date().toISOString()
        };

        paymentTxRef = doc(collection(db, 'transactions'));
        transaction.set(paymentTxRef, tData);
        transaction.update(accRef, { balance: currentBalance - paymentData.amount });
      });

      logActivity({ userId: user.uid, action: 'create', entityType: 'transaction', entityId: paymentTxRef?.id, description: `Pagamento de fatura: ${selectedCardForInvoice.name}` }).catch(() => {});
      toast.success('Pagamento registrado com sucesso');
      setIsPayInvoiceDialogOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'transactions');
      toast.error('Erro ao registrar pagamento');
    }
  };

  const handleMoveInvoice = async (tx: any, direction: 'prev' | 'next') => {
    if (isPeriodClosed(tx.date, tx.accountId)) {
      toast.error('Não é possível editar um lançamento de um mês fechado.');
      return;
    }

    try {
      const [yearStr, monthStr] = tx.invoicePeriod.split('-');
      let year = parseInt(yearStr);
      let month = parseInt(monthStr);

      if (direction === 'next') {
        month++;
        if (month > 12) {
          month = 1;
          year++;
        }
      } else {
        month--;
        if (month < 1) {
          month = 12;
          year--;
        }
      }

      const newInvoicePeriod = `${year}-${month.toString().padStart(2, '0')}`;

      await updateDoc(doc(db, 'transactions', tx.id), {
        invoicePeriod: newInvoicePeriod,
        updatedAt: new Date().toISOString()
      });

      logActivity({ userId: user.uid, action: 'update', entityType: 'transaction', entityId: tx.id, description: `Lançamento movido para fatura ${newInvoicePeriod}: ${tx.description}` }).catch(() => {});
      toast.success(`Lançamento movido para a fatura de ${month.toString().padStart(2, '0')}/${year}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'transactions');
      toast.error('Erro ao mover lançamento');
    }
  };

  const handleDeleteTx = async () => {
    if (!txToDelete) return;
    const t = txToDelete;
    
    let transactionsToDelete = [t];
    if ((t.parentId || t.isRecurring || t.installmentId) && deleteScope !== 'only') {
      transactionsToDelete = transactions.filter(tx => {
        let isSameSeries = false;
        
        if (t.parentId) {
          isSameSeries = tx.id === t.parentId || tx.parentId === t.parentId;
        } else {
          isSameSeries = tx.id === t.id || tx.parentId === t.id;
        }
        
        if (!isSameSeries && t.installmentId && tx.installmentId === t.installmentId) {
          isSameSeries = true;
        }

        if (!isSameSeries) return false;
        
        if (deleteScope === 'future') {
          return new Date(tx.date).getTime() >= new Date(t.date).getTime();
        }
        return true;
      });
    }

    for (const tx of transactionsToDelete) {
      if (isPeriodClosed(tx.date, tx.accountId)) {
        toast.error(`Não é possível excluir um lançamento de um mês fechado.`);
        return;
      }
    }

    const batch = writeBatch(db);

    try {
      const accountBalanceChanges: Record<string, number> = {};

      for (const tx of transactionsToDelete) {
        if (tx.type === 'transferencia') {
          if (tx.accountId) {
            accountBalanceChanges[tx.accountId] = (accountBalanceChanges[tx.accountId] || 0) + tx.amount;
          }
          if (tx.destinationAccountId) {
            accountBalanceChanges[tx.destinationAccountId] = (accountBalanceChanges[tx.destinationAccountId] || 0) - tx.amount;
          }
        } else {
          // For credit card expenses, they don't affect a normal account balance directly
        }
        batch.delete(doc(db, 'transactions', tx.id));
      }

      for (const [accId, change] of Object.entries(accountBalanceChanges)) {
        const acc = accounts.find(a => a.id === accId);
        if (acc) {
          const accRef = doc(db, 'accounts', accId);
          batch.update(accRef, { balance: (acc.balance || 0) + change });
        }
      }

      await batch.commit();
      logActivity({ userId: user.uid, action: 'delete', entityType: 'transaction', entityId: t.id || t.parentId, description: `${transactionsToDelete.length} lançamento(s) excluído(s) da fatura: ${t.description}` }).catch(() => {});
      toast.success('Lançamento(s) excluído(s) com sucesso');
      setTxToDelete(null);
      setDeleteScope('only');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'transactions');
      toast.error('Erro ao excluir lançamento(s)');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      const deleted = cards.find(c => c.id === deleteConfirmId);
      await deleteDoc(doc(db, 'creditCards', deleteConfirmId));
      logActivity({ userId: user.uid, action: 'delete', entityType: 'creditCard', entityId: deleteConfirmId, description: `Cartão excluído: ${deleted?.name || deleteConfirmId}` }).catch(() => {});
      toast.success('Cartão de crédito excluído');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `creditCards/${deleteConfirmId}`);
      toast.error('Falha ao excluir cartão de crédito');
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleRecalculateInvoices = async () => {
    if (!user) return;
    const batch = writeBatch(db);
    let count = 0;

    try {
      for (const tx of transactions) {
        if (tx.type === 'expense' && tx.accountId) {
          const card = cards.find(c => c.id === tx.accountId);
          if (card) {
            const newPeriod = calculateInvoicePeriod(tx.date, card.closingDay, card.dueDay);
            if (tx.invoicePeriod !== newPeriod) {
              batch.update(doc(db, 'transactions', tx.id), { invoicePeriod: newPeriod });
              count++;
            }
          }
        }
      }

      if (count > 0) {
        await batch.commit();
        logActivity({ userId: user.uid, action: 'update', entityType: 'transaction', entityId: 'batch', description: `${count} lançamentos recalculados para novo padrão de faturas` }).catch(() => {});
        toast.success(`${count} lançamentos atualizados para o novo padrão de faturas.`);
      } else {
        toast.info('Nenhum lançamento precisava ser atualizado.');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'transactions');
      toast.error('Erro ao atualizar faturas');
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCardForInvoice) return;
    e.target.value = '';

    setIsPdfLoading(true);
    setPdfLoadingStep('extracting');
    setIsPdfReviewOpen(true);
    setPdfTransactions([]);

    try {
      const rawText = await extractTextFromPdf(file);
      if (!rawText.trim()) {
        toast.error('Não foi possível extrair texto deste PDF. Verifique se o arquivo não é uma imagem escaneada.');
        setIsPdfReviewOpen(false);
        return;
      }

      setPdfLoadingStep('analyzing');
      const parsed = await parseInvoiceWithGroq(rawText, selectedCardForInvoice.name);
      setPdfTransactions(parsed);

      if (parsed.length === 0) {
        toast.error('A IA não encontrou transações neste PDF.');
      } else {
        toast.success(`${parsed.length} transação(ões) encontrada(s). Revise e confirme.`);
      }
    } catch (err) {
      console.error('PDF import error:', err);
      toast.error('Erro ao processar o PDF. Tente novamente.');
      setIsPdfReviewOpen(false);
    } finally {
      setIsPdfLoading(false);
      setPdfLoadingStep(null);
    }
  };

  const handleConfirmPdfImport = async (selected: PdfTransaction[]) => {
    if (!user || !selectedCardForInvoice) return;

    try {
      const batch = writeBatch(db);

      for (const tx of selected) {
        const invoicePeriod = calculateInvoicePeriod(
          tx.date,
          selectedCardForInvoice.closingDay,
          selectedCardForInvoice.dueDay
        );

        const txRef = doc(collection(db, 'transactions'));
        batch.set(txRef, {
          userId: user.uid,
          type: tx.type === 'receita' ? 'receita' : 'despesa',
          amount: tx.amount,
          date: tx.date + 'T12:00:00.000Z',
          description: tx.description + (tx.installmentInfo ? ` (${tx.installmentInfo})` : ''),
          creditCardId: selectedCardForInvoice.id,
          accountId: selectedCardForInvoice.id,
          invoicePeriod,
          status: 'realizado',
          reconciliationStatus: 'conciliado',
          categoryId: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      await batch.commit();

      logActivity({
        userId: user.uid,
        action: 'create',
        entityType: 'transaction',
        entityId: selectedCardForInvoice.id,
        description: `${selected.length} lançamento(s) importado(s) de PDF para ${selectedCardForInvoice.name}`,
      }).catch(() => {});

      toast.success(`${selected.length} lançamento(s) importado(s) com sucesso!`);
    } catch (err) {
      console.error('Firestore PDF import error:', err);
      toast.error('Erro ao salvar os lançamentos. Tente novamente.');
      throw err;
    }
  };

  const resetForm = () => {
    setFormData({ name: '', limit: 0, closingDay: '1', dueDay: '10' });
    setEditingId(null);
  };

  const openEdit = (card: any) => {
    setFormData({ 
      name: card.name, 
      limit: card.limit, 
      closingDay: card.closingDay.toString(), 
      dueDay: card.dueDay.toString() 
    });
    setEditingId(card.id);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-3xl font-bold tracking-tight">Cartões de Crédito</h2>
          <PageHelp
            title="Cartões de Crédito"
            description="Cadastre seus cartões com limite, dia de fechamento e vencimento. Acompanhe faturas abertas e fechadas, e registre pagamentos diretamente aqui."
            items={[
              { label: "Fatura Aberta", desc: "Período atual acumulando compras. O valor finaliza no dia de fechamento." },
              { label: "Fatura Fechada", desc: "Ciclo encerrado com valor definido. O pagamento pode ser registrado manualmente." },
              { label: "Pagamento", desc: "Ao pagar, o sistema cria uma transferência da conta corrente para o cartão e marca a fatura como paga." },
            ]}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={handleRecalculateInvoices}>
            Recalcular Faturas Antigas
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger render={<Button />}>
              <Plus className="mr-2 h-4 w-4" /> Novo Cartão
            </DialogTrigger>
            <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Cartão de Crédito' : 'Adicionar Novo Cartão'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-5 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Nome do Cartão</Label>
                <Input 
                  id="name" 
                  value={formData.name} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})} 
                  placeholder="Ex: Nubank, Inter..."
                  className="bg-white shadow-sm border-secondary/30 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all h-11"
                  required 
                />
              </div>
              <MoneyInput
                id="limit"
                label="Limite de Crédito"
                value={formData.limit}
                onChange={(v) => setFormData({ ...formData, limit: v })}
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="closingDay" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Fechamento (Dia)</Label>
                  <Input 
                    id="closingDay" 
                    type="number" 
                    min="1" 
                    max="31" 
                    value={formData.closingDay} 
                    onChange={(e) => setFormData({...formData, closingDay: e.target.value})} 
                    className="bg-white shadow-sm border-secondary/30 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all h-11"
                    required 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dueDay" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Vencimento (Dia)</Label>
                  <Input 
                    id="dueDay" 
                    type="number" 
                    min="1" 
                    max="31" 
                    value={formData.dueDay} 
                    onChange={(e) => setFormData({...formData, dueDay: e.target.value})} 
                    className="bg-white shadow-sm border-secondary/30 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all h-11"
                    required 
                  />
                </div>
              </div>
              <Button type="submit" className="w-full h-12 mt-4 bg-fiducia-blue hover:bg-fiducia-blue/90 text-white font-bold uppercase tracking-widest shadow-lg transition-all active:scale-[0.98]">
                {editingId ? 'Atualizar Cartão' : 'Salvar Cartão'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const currentPeriod = calculateInvoicePeriod(new Date(), card.closingDay, card.dueDay);
          const previousPeriod = getPreviousPeriod(currentPeriod);
          
          const prevBalance = calculatePeriodBalance(card.id, previousPeriod);
          const currentBalance = calculatePeriodBalance(card.id, currentPeriod);
          
          let displayAmount = currentBalance;
          let displayLabel = "Fatura Atual (Aberta)";
          let displayPeriod = currentPeriod;
          let isOverdue = false;

          if (prevBalance > 0.01) {
            displayAmount = prevBalance;
            displayLabel = "Fatura Fechada (A pagar)";
            displayPeriod = previousPeriod;
            
            const [pYear, pMonth] = previousPeriod.split('-').map(Number);
            const dueDate = new Date(pYear, pMonth - 1, card.dueDay);
            if (dueDate < new Date()) {
              isOverdue = true;
              displayLabel = "Fatura Atrasada";
            }
          }

          const totalUsage = calculateTotalLimitUsage(card.id);
          const availableLimit = card.limit - totalUsage;
          const usagePercentage = (totalUsage / card.limit) * 100;

          const [dYear, dMonth] = displayPeriod.split('-').map(Number);
          const periodName = new Date(dYear, dMonth - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

          const brand = getCardBrandDetails(card.name);

          return (
            <Card key={card.id} className={`hover:shadow-md transition-shadow overflow-hidden border-l-4 ${isOverdue ? 'border-l-fiducia-red' : 'border-l-fiducia-blue'}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${brand.bgClass} ${brand.textClass}`}>
                    {brand.label}
                  </span>
                  {card.name}
                </CardTitle>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(card)} className="min-w-[44px] min-h-[44px] text-muted-foreground hover:text-fiducia-blue">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteConfirmId(card.id)} className="min-w-[44px] min-h-[44px] text-muted-foreground hover:text-fiducia-red">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="space-y-4">
                  <div>
                    <div className={`text-2xl font-bold font-mono ${isOverdue || displayAmount > 0 ? 'text-fiducia-red' : 'text-fiducia-green'}`}>
                      R$ {displayAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                      {displayLabel} • {periodName}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-muted-foreground">Limite Disponível</span>
                      <span className={availableLimit < 0 ? 'text-fiducia-red' : 'text-fiducia-green'}>
                        R$ {availableLimit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all ${usagePercentage > 90 ? 'bg-fiducia-red' : usagePercentage > 70 ? 'bg-amber-500' : brand.barClass}`}
                        style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Total: R$ {card.limit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      <span>{usagePercentage.toFixed(1)}%</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-dashed">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">Fechamento</span>
                      <span className="text-sm font-medium flex items-center gap-1"><Calendar className="w-3 h-3"/> Dia {card.closingDay}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">Vencimento</span>
                      <span className="text-sm font-medium flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Dia {card.dueDay}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-muted/30 p-2">
                <Button 
                  variant="ghost" 
                  className="w-full h-8 text-xs font-bold gap-2 hover:bg-fiducia-blue hover:text-white transition-all"
                  onClick={() => {
                    setSelectedCardForInvoice(card);
                    const currentPeriod = calculateInvoicePeriod(new Date(), card.closingDay, card.dueDay);
                    const [year, month] = currentPeriod.split('-').map(Number);
                    setSelectedInvoiceMonth(new Date(year, month - 1, 1));
                    setIsInvoiceModalOpen(true);
                  }}
                >
                  <Eye className="w-3.5 h-3.5" /> VER DETALHES DA FATURA
                </Button>
              </CardFooter>
            </Card>
          );
        })}
        {cards.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
            Nenhum cartão de crédito encontrado. Adicione um para começar!
          </div>
        )}
      </div>
      <Dialog open={isInvoiceModalOpen} onOpenChange={(open) => {
        setIsInvoiceModalOpen(open);
        if (!open) {
          const d = new Date();
          d.setDate(1);
          setSelectedInvoiceMonth(d);
        }
      }}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2 border-b">
            <div className="flex justify-between items-center">
              <div>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <CreditCard className="w-5 h-5 text-fiducia-blue" />
                  Fatura: {selectedCardForInvoice?.name}
                </DialogTitle>
                <DialogDescription className="text-xs font-medium uppercase tracking-wider mt-1">
                  Detalhamento de lançamentos e pagamentos
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-8 gap-2" onClick={() => {
                  const period = `${selectedInvoiceMonth.getFullYear()}-${(selectedInvoiceMonth.getMonth() + 1).toString().padStart(2, '0')}`;
                  openTxDialog({ presetAccountId: selectedCardForInvoice?.id, presetMonth: period });
                }}>
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Novo Lançamento</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-2 border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-400 dark:hover:bg-violet-950/40"
                  onClick={() => pdfInputRef.current?.click()}
                  disabled={isPdfLoading}
                >
                  <FileUp className="h-4 w-4" />
                  <span className="hidden sm:inline">Importar PDF</span>
                </Button>
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handlePdfUpload}
                />
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-3 bg-secondary/30 p-1.5 rounded-lg border">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 hover:bg-white hover:shadow-sm"
                  onClick={() => {
                    const newDate = new Date(selectedInvoiceMonth);
                    newDate.setDate(1);
                    newDate.setMonth(newDate.getMonth() - 1);
                    setSelectedInvoiceMonth(newDate);
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-sm font-bold min-w-[90px] sm:min-w-[120px] text-center capitalize">
                  {selectedInvoiceMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 hover:bg-white hover:shadow-sm"
                  onClick={() => {
                    const newDate = new Date(selectedInvoiceMonth);
                    newDate.setDate(1);
                    newDate.setMonth(newDate.getMonth() + 1);
                    setSelectedInvoiceMonth(newDate);
                  }}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {selectedCardForInvoice && (() => {
              const currentPeriod = `${selectedInvoiceMonth.getFullYear()}-${(selectedInvoiceMonth.getMonth() + 1).toString().padStart(2, '0')}`;
              const previousPeriod = getPreviousPeriod(currentPeriod);
              const previousBalance = calculatePeriodBalance(selectedCardForInvoice.id, previousPeriod);
              
              // Filter transactions by period and search term
              const filteredTransactions = transactions.filter(t => {
                const matchesCard = t.accountId === selectedCardForInvoice.id || t.destinationAccountId === selectedCardForInvoice.id;
                const matchesPeriod = t.invoicePeriod === currentPeriod;
                const matchesSearch = invoiceSearchTerm === '' || 
                  t.description.toLowerCase().includes(invoiceSearchTerm.toLowerCase()) ||
                  (categories.find(c => c.id === t.categoryId)?.name || '').toLowerCase().includes(invoiceSearchTerm.toLowerCase());
                
                return matchesCard && matchesPeriod && matchesSearch;
              });

              // All transactions for the period (ignoring search for totals)
              const periodTransactions = transactions.filter(t => 
                (t.accountId === selectedCardForInvoice.id || t.destinationAccountId === selectedCardForInvoice.id) && 
                t.invoicePeriod === currentPeriod
              );
              
              const periodExpenses = periodTransactions
                .filter(t => t.type === 'expense' || t.type === 'despesa')
                .reduce((acc, t) => acc + t.amount, 0);
                
              const periodPayments = periodTransactions
                .filter(t => (t.type === 'transfer' || t.type === 'transferencia') && t.destinationAccountId === selectedCardForInvoice.id)
                .reduce((acc, t) => acc + t.amount, 0);
                
              const periodIncomes = periodTransactions
                .filter(t => (t.type === 'income' || t.type === 'receita') && t.accountId === selectedCardForInvoice.id)
                .reduce((acc, t) => acc + t.amount, 0);

              const totalInvoice = previousBalance + periodExpenses - periodPayments - periodIncomes;
              
              const invoice = invoices.find(i => i.cardId === selectedCardForInvoice.id && i.period === currentPeriod);
              const isPaid = invoice ? invoice.status === 'paga' : (totalInvoice <= 0 && periodPayments > 0);
              const isClosed = invoice ? (invoice.status === 'fechada' || invoice.status === 'paga') : (new Date() > new Date(selectedInvoiceMonth.getFullYear(), selectedInvoiceMonth.getMonth(), selectedCardForInvoice.closingDay));

              const handleReopenInvoice = async () => {
                if (!invoice) return;
                try {
                  await updateDoc(doc(db, 'invoices', invoice.id), { status: 'aberta' });
                  logActivity({ userId: user.uid, action: 'update', entityType: 'transaction', entityId: invoice.id, description: `Fatura reaberta: ${selectedCardForInvoice.name} - ${invoice.period}` }).catch(() => {});
                  toast.success('Fatura reaberta com sucesso');
                } catch (error) {
                  handleFirestoreError(error, OperationType.UPDATE, `invoices/${invoice.id}`);
                  toast.error('Erro ao reabrir fatura');
                }
              };

              return (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="bg-white border p-4 rounded-xl shadow-sm">
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Saldo Anterior</p>
                      <p className={`text-lg font-black ${previousBalance > 0 ? 'text-fiducia-red' : 'text-fiducia-green'}`}>
                        R$ {Math.max(0, previousBalance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="bg-white border p-4 rounded-xl shadow-sm">
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Compras</p>
                      <p className="text-lg font-black text-fiducia-red">
                        R$ {periodExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="bg-white border p-4 rounded-xl shadow-sm">
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Pagamentos</p>
                      <p className="text-lg font-black text-fiducia-green">
                        R$ {periodPayments.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="bg-white border p-4 rounded-xl shadow-sm">
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Créditos</p>
                      <p className="text-lg font-black text-fiducia-blue">
                        R$ {periodIncomes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="bg-fiducia-blue/5 border border-fiducia-blue/20 p-4 rounded-xl shadow-sm">
                      <p className="text-[10px] font-black text-fiducia-blue/70 uppercase tracking-widest mb-1">Valor da Fatura</p>
                      <p className={`text-lg font-black ${totalInvoice > 0 ? 'text-fiducia-red' : 'text-fiducia-green'}`}>
                        R$ {Math.abs(totalInvoice).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                        <List className="w-3.5 h-3.5" /> Lançamentos
                      </h4>
                      {isPaid ? (
                        <Badge className="bg-fiducia-green/10 text-fiducia-green border-fiducia-green/20 hover:bg-fiducia-green/20">Fatura Paga</Badge>
                      ) : isClosed ? (
                        <Badge className="bg-fiducia-red/10 text-fiducia-red border-fiducia-red/20 hover:bg-fiducia-red/20">Fatura Fechada</Badge>
                      ) : (
                        <Badge className="bg-fiducia-blue/10 text-fiducia-blue border-fiducia-blue/20 hover:bg-fiducia-blue/20">Fatura Aberta</Badge>
                      )}
                      {invoice && (invoice.status === 'fechada' || invoice.status === 'paga') && (
                        <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={handleReopenInvoice}>
                          <RefreshCcw className="h-3 w-3" /> REABRIR FATURA
                        </Button>
                      )}
                    </div>
                    <div className="relative w-full md:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="Buscar lançamento..." 
                        className="pl-9 h-9 text-xs"
                        value={invoiceSearchTerm}
                        onChange={(e) => setInvoiceSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="border rounded-xl overflow-x-auto shadow-sm bg-white">
                    <table className="w-full text-sm">
                      <thead className="bg-secondary/30 border-b">
                        <tr>
                          <th className="p-3 text-left font-bold text-[10px] uppercase tracking-wider text-muted-foreground">Data</th>
                          <th className="p-3 text-left font-bold text-[10px] uppercase tracking-wider text-muted-foreground">Descrição</th>
                          <th className="p-3 text-right font-bold text-[10px] uppercase tracking-wider text-muted-foreground">Valor</th>
                          <th className="p-3 text-center font-bold text-[10px] uppercase tracking-wider text-muted-foreground">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredTransactions
                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                          .map((t) => {
                            const isPayment = (t.type === 'transfer' || t.type === 'transferencia') && t.destinationAccountId === selectedCardForInvoice.id;
                            const isIncome = (t.type === 'income' || t.type === 'receita') && t.accountId === selectedCardForInvoice.id;
                            const isNegative = isPayment || isIncome;

                            return (
                              <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                                <td className="p-3 whitespace-nowrap text-muted-foreground font-medium">
                                  {parseLocalDate(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                </td>
                                <td className="p-3">
                                  <div className="flex flex-col">
                                    <span className="font-bold text-secondary-foreground">{t.description}</span>
                                    <span className="text-[10px] text-muted-foreground uppercase font-medium">
                                      {isPayment ? 'Pagamento de Fatura' : (categories.find(c => c.id === t.categoryId)?.name || t.categoryId)}
                                    </span>
                                  </div>
                                </td>
                                <td className={`p-3 text-right font-mono font-black ${isNegative ? 'text-fiducia-green' : 'text-fiducia-red'}`}>
                                  {isNegative ? '-' : '+'} R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="p-3 text-center">
                                  <div className="flex items-center justify-center">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger className="h-8 w-8 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 text-muted-foreground">
                                        <MoreVertical className="w-4 h-4" />
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="w-48">
                                        <DropdownMenuItem onClick={() => handleMoveInvoice(t, 'prev')}>
                                          <ChevronLeft className="w-4 h-4 mr-2" />
                                          Mover p/ Anterior
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleMoveInvoice(t, 'next')}>
                                          <ChevronRight className="w-4 h-4 mr-2" />
                                          Mover p/ Seguinte
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => openTxDialog({ editId: t.id })}
                                        >
                                          <Edit className="w-4 h-4 mr-2" />
                                          Editar
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          className="text-fiducia-red focus:text-fiducia-red focus:bg-red-50"
                                          onClick={() => setTxToDelete(t)}
                                        >
                                          <Trash2 className="w-4 h-4 mr-2" />
                                          Excluir
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        {filteredTransactions.length === 0 && (
                          <tr>
                            <td colSpan={4} className="p-12 text-center text-muted-foreground italic bg-muted/10">
                              <div className="flex flex-col items-center gap-2">
                                <AlertCircle className="w-8 h-8 opacity-20" />
                                <p>Nenhum lançamento encontrado para este período.</p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="bg-secondary/20 p-4 rounded-xl border border-dashed flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="bg-white p-2 rounded-lg shadow-sm border">
                        <Calendar className="w-5 h-5 text-fiducia-blue" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Vencimento da Fatura</p>
                        <p className="text-sm font-bold">Dia {selectedCardForInvoice.dueDay} de {selectedInvoiceMonth.toLocaleDateString('pt-BR', { month: 'long' })}</p>
                      </div>
                    </div>
                    {totalInvoice > 0 && (
                      <Button 
                        className="bg-fiducia-green hover:bg-fiducia-green/90 text-white font-bold text-xs uppercase tracking-widest h-10 px-6 shadow-md"
                        onClick={() => {
                          setPaymentData({
                            accountId: '',
                            amount: totalInvoice,
                            date: new Date().toISOString().split('T')[0]
                          });
                          setIsPayInvoiceDialogOpen(true);
                        }}
                      >
                        Pagar Fatura
                      </Button>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPayInvoiceDialogOpen} onOpenChange={setIsPayInvoiceDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Pagar Fatura</DialogTitle>
            <DialogDescription>
              Selecione a conta de origem para o pagamento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Conta de Origem</Label>
              <select 
                className="flex h-11 w-full rounded-md border border-secondary/30 bg-white px-3 py-2 text-sm shadow-sm transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary/50"
                value={paymentData.accountId}
                onChange={(e) => setPaymentData({...paymentData, accountId: e.target.value})}
                required
              >
                <option value="">Selecione uma conta</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{resolveAccountName(acc.id, accounts, cards)} (R$ {acc.balance?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})</option>
                ))}
              </select>
            </div>
            <MoneyInput
              label="Valor do Pagamento"
              value={paymentData.amount}
              onChange={(v) => setPaymentData({ ...paymentData, amount: v })}
              required
            />
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Data do Pagamento</Label>
              <Input 
                type="date"
                value={paymentData.date}
                onChange={(e) => setPaymentData({...paymentData, date: e.target.value})}
                className="h-11"
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsPayInvoiceDialogOpen(false)}>Cancelar</Button>
            <Button className="bg-fiducia-green hover:bg-fiducia-green/90 text-white font-bold" onClick={handlePayInvoice}>Confirmar Pagamento</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm text-muted-foreground">
            Tem certeza que deseja excluir este cartão de crédito? Esta ação não pode ser desfeita.
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Transaction Confirmation */}
      <Dialog open={!!txToDelete} onOpenChange={(open) => !open && setTxToDelete(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-fiducia-red">
              <AlertCircle className="w-5 h-5" />
              Confirmar Exclusão
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-muted/50 p-4 rounded-lg border space-y-1">
              <p className="text-sm font-bold">{txToDelete?.description}</p>
              <p className="text-xs text-muted-foreground">
                {txToDelete?.date && parseLocalDate(txToDelete.date).toLocaleDateString('pt-BR')} - R$ {txToDelete?.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            
            {(txToDelete?.parentId || txToDelete?.isRecurring || txToDelete?.installmentId) && (
              <div className="space-y-2 py-4">
                <div className="flex items-center space-x-2">
                  <input type="radio" id="only" name="deleteScope" value="only" checked={deleteScope === 'only'} onChange={(e) => setDeleteScope(e.target.value)} />
                  <Label htmlFor="only">Apenas este lançamento</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input type="radio" id="future" name="deleteScope" value="future" checked={deleteScope === 'future'} onChange={(e) => setDeleteScope(e.target.value)} />
                  <Label htmlFor="future">Este e os futuros</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input type="radio" id="all" name="deleteScope" value="all" checked={deleteScope === 'all'} onChange={(e) => setDeleteScope(e.target.value)} />
                  <Label htmlFor="all">Todos os lançamentos (passados e futuros)</Label>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTxToDelete(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteTx}>
              Excluir Lançamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PdfImportReviewDialog
        open={isPdfReviewOpen}
        onOpenChange={(open) => {
          setIsPdfReviewOpen(open);
          if (!open) setPdfTransactions([]);
        }}
        transactions={pdfTransactions}
        isLoading={isPdfLoading}
        loadingStep={pdfLoadingStep}
        cardName={selectedCardForInvoice?.name ?? ''}
        onConfirm={handleConfirmPdfImport}
      />
    </div>
  );
}
