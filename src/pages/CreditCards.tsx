import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc, writeBatch, runTransaction, setDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { CreditCard, Plus, Trash2, Edit, Eye, Calendar, AlertCircle, ArrowUpRight, ChevronLeft, ChevronRight, List, MoreVertical, Search, Printer, FileText, PlusCircle, RefreshCcw, FileUp, Lock, Layers, Clock, FileSearch } from 'lucide-react';
import { toast } from 'sonner';
import { MoneyInput } from '../components/MoneyInput';
import { calculateInvoicePeriod, getNextPeriod, resolveAccountName, parseLocalDate, dateToLocalISOString, getPreviousPeriod, isPeriodClosed, findSeriesTransactions, getSeriesKey, isEffectivelyPaid } from '../lib/utils';
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
import { InvoiceReconciliationDialog } from '../components/InvoiceReconciliationDialog';
import { generateCreditCardInvoicePDF } from '../lib/pdfTemplates';

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
  const [invoiceViewMode, setInvoiceViewMode] = useState<'organized' | 'chronological'>('organized');

  // PDF Import state
  const [isPdfReviewOpen, setIsPdfReviewOpen] = useState(false);
  const [pdfTransactions, setPdfTransactions] = useState<PdfTransaction[]>([]);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [pdfLoadingStep, setPdfLoadingStep] = useState<'extracting' | 'analyzing' | null>(null);
  const pdfInputRef = React.useRef<HTMLInputElement>(null);
  const [isInvoiceReconciliationOpen, setIsInvoiceReconciliationOpen] = useState(false);

  // PDF Export
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handleExportInvoicePDF = async () => {
    if (isExportingPdf || !selectedCardForInvoice) return;
    setIsExportingPdf(true);
    try {
      const currentPeriod = `${selectedInvoiceMonth.getFullYear()}-${(selectedInvoiceMonth.getMonth() + 1).toString().padStart(2, '0')}`;
      const periodTransactions = transactions.filter(t =>
        (t.accountId === selectedCardForInvoice.id || t.destinationAccountId === selectedCardForInvoice.id) &&
        t.invoicePeriod === currentPeriod
      );
      const invoice = invoices.find(i => i.cardId === selectedCardForInvoice.id && i.period === currentPeriod);
      await generateCreditCardInvoicePDF({
        card: selectedCardForInvoice,
        invoiceTxs: periodTransactions,
        categories,
        period: currentPeriod,
        invoiceStatus: invoice?.status || 'aberta',
      });
    } catch (err) {
      console.error('PDF export error:', err);
      toast.error('Erro ao gerar fatura PDF');
    } finally {
      setIsExportingPdf(false);
    }
  };

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
      toast.error('Falha ao salvar cartão de crédito');
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'creditCards');
    }
  };


  const handlePayInvoice = async () => {
    if (!selectedCardForInvoice || !paymentData.accountId || paymentData.amount <= 0) {
      toast.error('Preencha todos os campos corretamente');
      return;
    }

    // Período correto baseado no mês selecionado no modal
    const currentPeriod = `${selectedInvoiceMonth.getFullYear()}-${(selectedInvoiceMonth.getMonth() + 1).toString().padStart(2, '0')}`;
    const nextPeriod = getNextPeriod(currentPeriod);

    // Referências candidatas (podem estar obsoletas — a transaction confirma)
    const existingInvoice = invoices.find(i => i.cardId === selectedCardForInvoice.id && i.period === currentPeriod);
    const existingNextInvoice = invoices.find(i => i.cardId === selectedCardForInvoice.id && i.period === nextPeriod);

    let paymentTxRef: any;
    try {
      await runTransaction(db, async (transaction) => {
        // 1. TODAS AS LEITURAS primeiro
        const accRef = doc(db, 'accounts', paymentData.accountId);
        const accSnap = await transaction.get(accRef);
        if (!accSnap.exists()) throw new Error('Conta de origem não encontrada');
        const currentBalance = accSnap.data().balance || 0;

        let invSnap: any = null;
        let invDocRef: any = null;
        if (existingInvoice) {
          invDocRef = doc(db, 'invoices', existingInvoice.id);
          invSnap = await transaction.get(invDocRef);
        }

        let nextInvSnap: any = null;
        let nextInvDocRef: any = null;
        if (existingNextInvoice) {
          nextInvDocRef = doc(db, 'invoices', existingNextInvoice.id);
          nextInvSnap = await transaction.get(nextInvDocRef);
        }

        // 2. TODAS AS ESCRITAS depois
        paymentTxRef = doc(collection(db, 'transactions'));
        transaction.set(paymentTxRef, {
          userId: user.uid,
          type: 'transferencia',
          amount: paymentData.amount,
          date: paymentData.date,
          description: `Pagamento Fatura ${selectedCardForInvoice.name} - ${selectedInvoiceMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`,
          accountId: paymentData.accountId,
          destinationAccountId: selectedCardForInvoice.id,
          categoryId: 'Pagamento de Cartão',
          status: 'pago',
          invoicePeriod: currentPeriod,
          createdAt: new Date().toISOString()
        });

        transaction.update(accRef, { balance: currentBalance - paymentData.amount });

        // Atualiza/cria invoice atual como paga
        if (invSnap?.exists()) {
          transaction.update(invDocRef, {
            status: 'paga',
            totalAmount: paymentData.amount,
            paymentTransactionId: paymentTxRef.id,
            closedAt: new Date().toISOString(),
          });
        } else {
          const ref = doc(collection(db, 'invoices'));
          transaction.set(ref, {
            userId: user.uid,
            cardId: selectedCardForInvoice.id,
            period: currentPeriod,
            status: 'paga',
            totalAmount: paymentData.amount,
            paymentTransactionId: paymentTxRef.id,
            closedAt: new Date().toISOString(),
          });
        }

        // Cria invoice do próximo período se não existir
        if (!nextInvSnap?.exists()) {
          const ref = nextInvDocRef || doc(collection(db, 'invoices'));
          transaction.set(ref, {
            userId: user.uid,
            cardId: selectedCardForInvoice.id,
            period: nextPeriod,
            status: 'aberta',
            totalAmount: 0,
          });
        }
      });

      logActivity({ userId: user.uid, action: 'create', entityType: 'transaction', entityId: paymentTxRef?.id, description: `Pagamento de fatura: ${selectedCardForInvoice.name}` }).catch(() => {});
      toast.success('Pagamento registrado com sucesso');
      setIsPayInvoiceDialogOpen(false);
    } catch (error) {
      toast.error('Erro ao registrar pagamento');
      handleFirestoreError(error, OperationType.CREATE, 'transactions');
    }
  };

  const handleMoveInvoice = async (tx: any, direction: 'prev' | 'next') => {
    if (isPeriodClosed(tx.date, tx.accountId, cards, invoices, closedPeriods)) {
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
        ...(tx.installmentNumber && tx.installmentNumber >= 2 ? { postingDate: dateToLocalISOString(`${year}-${month.toString().padStart(2, '0')}-01`) } : {}),
        updatedAt: new Date().toISOString()
      });

      logActivity({ userId: user.uid, action: 'update', entityType: 'transaction', entityId: tx.id, description: `Lançamento movido para fatura ${newInvoicePeriod}: ${tx.description}` }).catch(() => {});
      toast.success(`Lançamento movido para a fatura de ${month.toString().padStart(2, '0')}/${year}`);
    } catch (error) {
      toast.error('Erro ao mover lançamento');
      handleFirestoreError(error, OperationType.UPDATE, 'transactions');
    }
  };

  const handleDeleteTx = async () => {
    if (!txToDelete) return;
    const t = txToDelete;

    const transactionsToDelete = findSeriesTransactions(t, transactions, deleteScope);

    for (const tx of transactionsToDelete) {
      if (isPeriodClosed(tx.date, tx.accountId, cards, invoices, closedPeriods)) {
        toast.error(`Não é possível excluir um lançamento de um mês fechado.`);
        return;
      }
    }

    try {
      const recurrenceRuleId = t.ccRecurrenceType === 'fixo' && t.parentId ? t.parentId : null;

      await runTransaction(db, async (transaction) => {
        const balanceSnapshots: Record<string, any> = {};
        const accountBalanceChanges: Record<string, number> = {};

        for (const tx of transactionsToDelete) {
          if (tx.type === 'transferencia' && isEffectivelyPaid(tx)) {
            if (tx.accountId) accountBalanceChanges[tx.accountId] = (accountBalanceChanges[tx.accountId] || 0) + tx.amount;
            if (tx.destinationAccountId) accountBalanceChanges[tx.destinationAccountId] = (accountBalanceChanges[tx.destinationAccountId] || 0) - tx.amount;
          }
        }

        for (const accId of Object.keys(accountBalanceChanges)) {
          if (accountBalanceChanges[accId] === 0) continue;
          balanceSnapshots[accId] = await transaction.get(doc(db, 'accounts', accId));
        }

        for (const tx of transactionsToDelete) {
          transaction.delete(doc(db, 'transactions', tx.id));
        }

        if (recurrenceRuleId && deleteScope === 'all') {
          transaction.delete(doc(db, 'recurrenceRules', recurrenceRuleId));
        }

        const affectedCardPeriods = new Set<string>();
        for (const tx of transactionsToDelete) {
          if (tx.invoicePeriod) {
            if (cards.some(c => c.id === tx.accountId)) affectedCardPeriods.add(`${tx.accountId}|${tx.invoicePeriod}`);
            if (cards.some(c => c.id === tx.destinationAccountId)) affectedCardPeriods.add(`${tx.destinationAccountId}|${tx.invoicePeriod}`);
          }
        }

        for (const key of affectedCardPeriods) {
          const sep = key.indexOf('|');
          const cardId = key.substring(0, sep);
          const period = key.substring(sep + 1);
          const deletedIds = new Set(transactionsToDelete.map(dt => dt.id));
          const hasRemaining = transactions.some(tx =>
            !deletedIds.has(tx.id) &&
            (tx.accountId === cardId || tx.destinationAccountId === cardId) &&
            tx.invoicePeriod === period
          );
          if (!hasRemaining) {
            const invoice = invoices.find(i =>
              i.cardId === cardId && i.period === period && i.status !== 'paga'
            );
            if (invoice) {
              transaction.update(doc(db, 'invoices', invoice.id), { totalAmount: 0 });
            }
          }
        }

        for (const [accId, change] of Object.entries(accountBalanceChanges)) {
          if (change === 0) continue;
          const snap = balanceSnapshots[accId];
          if (snap?.exists()) {
            transaction.update(doc(db, 'accounts', accId), { balance: (snap.data().balance || 0) + change });
          }
        }
      });

      logActivity({ userId: user.uid, action: 'delete', entityType: 'transaction', entityId: t.id || t.parentId, description: `${transactionsToDelete.length} lançamento(s) excluído(s) da fatura: ${t.description}` }).catch(() => {});
      toast.success('Lançamento(s) excluído(s) com sucesso');
      setTxToDelete(null);
      setDeleteScope('only');
    } catch (error) {
      toast.error('Erro ao excluir lançamento(s)');
      handleFirestoreError(error, OperationType.DELETE, 'transactions');
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
      toast.error('Falha ao excluir cartão de crédito');
      handleFirestoreError(error, OperationType.DELETE, `creditCards/${deleteConfirmId}`);
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
      toast.error('Erro ao atualizar faturas');
      handleFirestoreError(error, OperationType.UPDATE, 'transactions');
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
      const parsed = await parseInvoiceWithGroq(rawText, selectedCardForInvoice.name, categories);
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

  const handleConfirmPdfImport = async (
    selected: PdfTransaction[],
    categoryMap: Record<string, string>,
    expandedSeries: Array<{ txId: string; installmentNumber: number; totalInstallments: number }>
  ) => {
    if (!user || !selectedCardForInvoice) return;

    try {
      const batch = writeBatch(db);
      let totalCreated = 0;

      // Pré-processa quais transações expandir
      const expandMap = new Map<string, boolean>();
      for (const s of expandedSeries) {
        expandMap.set(s.txId, true);
      }

      for (const tx of selected) {
        const invoicePeriod = calculateInvoicePeriod(
          tx.date,
          selectedCardForInvoice.closingDay,
          selectedCardForInvoice.dueDay
        );

        const resolvedCategoryId = categoryMap[tx.id] && categoryMap[tx.id] !== 'none'
          ? categoryMap[tx.id]
          : '';

        const origDate = parseLocalDate(tx.date);
        const shouldExpand = expandMap.has(tx.id);

        // Extrai installmentInfo mesmo se não expandir — sempre salva metadados
        let mainInstallmentNumber: number | undefined;
        let mainTotalInstallments: number | undefined;

        if (tx.installmentInfo) {
          const match = tx.installmentInfo.match(/(\d+)\/(\d+)/);
          if (match) {
            mainInstallmentNumber = parseInt(match[1]);
            mainTotalInstallments = parseInt(match[2]);
          }
        }

        const parentId = mainInstallmentNumber !== undefined
          ? doc(collection(db, 'transactions')).id
          : undefined;

        // Transação principal (a que está na fatura atual)
        const txRef = doc(collection(db, 'transactions'));
        const origDateIso = dateToLocalISOString(tx.date);
        batch.set(txRef, {
          userId: user.uid,
          type: tx.type,
          amount: tx.amount,
          date: origDateIso,
          description: tx.description + (tx.installmentInfo ? ` (${tx.installmentInfo})` : ''),
          creditCardId: selectedCardForInvoice.id,
          accountId: selectedCardForInvoice.id,
          invoicePeriod,
          status: 'realizado',
          reconciliationStatus: 'conciliado',
          categoryId: resolvedCategoryId,
          ...(mainInstallmentNumber !== undefined && {
            parentId,
            installmentNumber: mainInstallmentNumber,
            totalInstallments: mainTotalInstallments,
            originalPurchaseDate: origDateIso,
            postingDate: origDateIso,
          }),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        totalCreated++;

        // Parcelas futuras — cria apenas se o usuário expandiu a série
        if (shouldExpand && mainInstallmentNumber !== undefined && mainTotalInstallments !== undefined) {
          const remaining = mainTotalInstallments - mainInstallmentNumber;

            for (let i = 1; i <= remaining; i++) {
              const futureDate = new Date(origDate);
              futureDate.setMonth(futureDate.getMonth() + i);
              const futureYear = futureDate.getFullYear();
              const futureMonth = String(futureDate.getMonth() + 1).padStart(2, '0');
              const futureDay = String(futureDate.getDate()).padStart(2, '0');
              const futureDateStr = `${futureYear}-${futureMonth}-${futureDay}`;
              const futurePeriod = calculateInvoicePeriod(
                futureDateStr,
                selectedCardForInvoice.closingDay,
                selectedCardForInvoice.dueDay
              );
              const futureInstallment = mainInstallmentNumber + i;
              const postingDateIso = dateToLocalISOString(futureDateStr);

              const futureRef = doc(collection(db, 'transactions'));
              batch.set(futureRef, {
                userId: user.uid,
                type: tx.type,
                amount: tx.amount,
                date: postingDateIso,
                description: `${tx.description} (${futureInstallment}/${mainTotalInstallments})`,
                creditCardId: selectedCardForInvoice.id,
                accountId: selectedCardForInvoice.id,
                invoicePeriod: futurePeriod,
                status: 'pendente',
                reconciliationStatus: 'nao_conciliado',
                categoryId: resolvedCategoryId,
                parentId,
                installmentNumber: futureInstallment,
                totalInstallments: mainTotalInstallments,
                originalPurchaseDate: origDateIso,
                postingDate: postingDateIso,
                isSystemGeneratedDate: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
              totalCreated++;
            }
          }
        }

      await batch.commit();

      const suspiciousInstallments = selected
        .filter(t => t.installmentInfo && t.amount > 5000)
        .map(t => `${t.description} (${t.installmentInfo}, R$ ${t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`);
      if (suspiciousInstallments.length > 0) {
        toast.warning(`Valores de parcela elevados detectados:\n${suspiciousInstallments.join('\n')}\n\nVerifique se os valores estão corretos — cada parcela deve ter o valor individual, não o total da compra.`, { duration: 8000 });
      }

      logActivity({
        userId: user.uid,
        action: 'create',
        entityType: 'transaction',
        entityId: selectedCardForInvoice.id,
        description: `${totalCreated} lançamento(s) importado(s) de PDF para ${selectedCardForInvoice.name}`,
      }).catch(() => {});

      const installmentCount = totalCreated - selected.length;
      const msg = installmentCount > 0
        ? `${selected.length} lançamento(s) importado(s) + ${installmentCount} parcela(s) futura(s) criada(s)!`
        : `${selected.length} lançamento(s) importado(s) com sucesso!`;
      toast.success(msg);
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

  const classifyInvoiceTransaction = (t: any, cardId: string, currentPeriod: string) => {
    if ((t.type === 'transfer' || t.type === 'transferencia') && t.destinationAccountId === cardId) return 'PAGAMENTOS_AJUSTES';
    if ((t.type === 'transfer' || t.type === 'transferencia') && t.accountId === cardId) return 'OUTROS_DEBITOS';
    if ((t.type === 'income' || t.type === 'receita') && t.accountId === cardId) return 'CREDITOS_ESTORNOS';
    if (t.installmentNumber && t.installmentNumber >= 2) return 'PARCELAMENTOS_ANTERIORES';
    return 'COMPRAS_DO_PERIODO';
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
                  className="shadow-sm border-secondary/30 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all h-11"
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
                    className="shadow-sm border-secondary/30 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all h-11"
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
                    className="shadow-sm border-secondary/30 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all h-11"
                    required 
                  />
                </div>
              </div>
              <Button type="submit" className="w-full h-12 mt-4 bg-fiducia-blue hover:bg-fiducia-blue/90 text-white dark:text-background font-bold uppercase tracking-widest shadow-lg transition-all active:scale-[0.98]">
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
          const netOutstanding = prevBalance + currentBalance;
          
          let displayAmount: number;
          let displayLabel: string;
          let displayPeriod: string;
          let isOverdue = false;

          if (prevBalance > 0.01) {
            // Soma saldos de períodos anteriores + atual para mostrar total devido
            displayAmount = Math.max(0, netOutstanding);
            displayLabel = "Saldo Devedor";
            displayPeriod = currentPeriod;
            
            const [pYear, pMonth] = previousPeriod.split('-').map(Number);
            const dueDate = new Date(pYear, pMonth - 1, card.dueDay);
            if (dueDate < new Date()) {
              isOverdue = true;
              displayLabel = "Fatura Atrasada";
            }
          } else {
            displayAmount = currentBalance;
            displayLabel = "Fatura Atual (Aberta)";
            displayPeriod = currentPeriod;
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
                  className="h-8 gap-2 border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-950/40"
                  onClick={() => setIsInvoiceReconciliationOpen(true)}
                >
                  <FileSearch className="h-4 w-4" />
                  <span className="hidden sm:inline">Conferir Fatura</span>
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
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleExportInvoicePDF} disabled={isExportingPdf}>
                  <Printer className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-3 bg-secondary/30 p-1.5 rounded-lg border">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 hover:bg-card dark:hover:bg-surface2 hover:shadow-sm"
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
                  className="h-8 w-8 hover:bg-card dark:hover:bg-surface2 hover:shadow-sm"
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
                  (categories.find(c => c.id === t.categoryId)?.name || '').toLowerCase().includes(invoiceSearchTerm.toLowerCase()) ||
                  t.amount?.toString().includes(invoiceSearchTerm) ||
                  (t.amount != null ? t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '').includes(invoiceSearchTerm);
                
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

              const handleCloseInvoice = async () => {
                if (!selectedCardForInvoice) return;
                try {
                  if (invoice) {
                    await updateDoc(doc(db, 'invoices', invoice.id), { status: 'fechada', closedAt: new Date().toISOString() });
                  } else {
                    await addDoc(collection(db, 'invoices'), {
                      userId: user.uid,
                      cardId: selectedCardForInvoice.id,
                      period: currentPeriod,
                      status: 'fechada',
                      totalAmount: Math.max(0, totalInvoice),
                      closedAt: new Date().toISOString(),
                    });
                  }
                  logActivity({ userId: user.uid, action: 'update', entityType: 'transaction', entityId: invoice?.id || 'new', description: `Fatura fechada: ${selectedCardForInvoice.name} - ${currentPeriod}` }).catch(() => {});
                  toast.success('Fatura fechada com sucesso');
                } catch (error) {
                  toast.error('Erro ao fechar fatura');
                  handleFirestoreError(error, OperationType.UPDATE, 'invoices');
                }
              };

              const handleReopenInvoice = async () => {
                if (!invoice) return;
                try {
                  await updateDoc(doc(db, 'invoices', invoice.id), { status: 'aberta' });
                  logActivity({ userId: user.uid, action: 'update', entityType: 'transaction', entityId: invoice.id, description: `Fatura reaberta: ${selectedCardForInvoice.name} - ${invoice.period}` }).catch(() => {});
                  toast.success('Fatura reaberta com sucesso');
                } catch (error) {
                  toast.error('Erro ao reabrir fatura');
                  handleFirestoreError(error, OperationType.UPDATE, `invoices/${invoice.id}`);
                }
              };

              return (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="bg-card border p-4 rounded-xl shadow-sm">
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Saldo Anterior</p>
                      <p className={`text-lg font-black ${previousBalance > 0 ? 'text-fiducia-red' : 'text-fiducia-green'}`}>
                        R$ {Math.max(0, previousBalance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="bg-card border p-4 rounded-xl shadow-sm">
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Compras</p>
                      <p className="text-lg font-black text-fiducia-red">
                        R$ {periodExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="bg-card border p-4 rounded-xl shadow-sm">
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Pagamentos</p>
                      <p className="text-lg font-black text-fiducia-green">
                        R$ {periodPayments.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="bg-card border p-4 rounded-xl shadow-sm">
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

                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap justify-between items-center gap-2">
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
                        {(!invoice || invoice.status === 'aberta') && totalInvoice > 0 && (
                          <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold gap-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50" onClick={handleCloseInvoice}>
                            <Lock className="h-3 w-3" /> FECHAR FATURA
                          </Button>
                        )}
                        {invoice && (invoice.status === 'fechada' || invoice.status === 'paga') && (
                          <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={handleReopenInvoice}>
                            <RefreshCcw className="h-3 w-3" /> REABRIR FATURA
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center bg-secondary/30 rounded-lg border p-0.5">
                        <Button
                          variant={invoiceViewMode === 'organized' ? 'default' : 'ghost'}
                          size="sm"
                          className={`h-7 text-[10px] font-bold gap-1 px-2 ${invoiceViewMode === 'organized' ? 'bg-card shadow-sm text-foreground hover:bg-card' : 'text-muted-foreground'}`}
                          onClick={() => setInvoiceViewMode('organized')}
                        >
                          <Layers className="w-3 h-3" /> Organizado
                        </Button>
                        <Button
                          variant={invoiceViewMode === 'chronological' ? 'default' : 'ghost'}
                          size="sm"
                          className={`h-7 text-[10px] font-bold gap-1 px-2 ${invoiceViewMode === 'chronological' ? 'bg-card shadow-sm text-foreground hover:bg-card' : 'text-muted-foreground'}`}
                          onClick={() => setInvoiceViewMode('chronological')}
                        >
                          <Clock className="w-3 h-3" /> Cronológico
                        </Button>
                      </div>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="Buscar lançamento..." 
                        className="pl-9 h-9 text-xs w-full"
                        value={invoiceSearchTerm}
                        onChange={(e) => setInvoiceSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>

                  {filteredTransactions.length === 0 ? (
                    <div className="border rounded-xl p-12 text-center text-muted-foreground italic bg-muted/10">
                      <div className="flex flex-col items-center gap-2">
                        <AlertCircle className="w-8 h-8 opacity-20" />
                        <p>Nenhum lançamento encontrado para este período.</p>
                      </div>
                    </div>
                  ) : invoiceViewMode === 'organized' ? (() => {
                    const groupOrder = [
                      { key: 'PARCELAMENTOS_ANTERIORES', label: 'Parcelamentos Anteriores', icon: '🔄', bgClass: 'bg-amber-50/30 dark:bg-amber-950/20', borderClass: 'border-amber-200 dark:border-amber-800' },
                      { key: 'COMPRAS_DO_PERIODO', label: 'Compras do Período', icon: '🛒', bgClass: 'bg-red-50/30 dark:bg-red-950/20', borderClass: 'border-red-200 dark:border-red-800' },
                      { key: 'OUTROS_DEBITOS', label: 'Outros Débitos', icon: '📋', bgClass: 'bg-slate-50/30 dark:bg-slate-800/20', borderClass: 'border-slate-200 dark:border-slate-700' },
                      { key: 'CREDITOS_ESTORNOS', label: 'Créditos e Estornos', icon: '✅', bgClass: 'bg-green-50/30 dark:bg-green-950/20', borderClass: 'border-green-200 dark:border-green-800' },
                      { key: 'PAGAMENTOS_AJUSTES', label: 'Pagamentos e Ajustes', icon: '💳', bgClass: 'bg-blue-50/30 dark:bg-blue-950/20', borderClass: 'border-blue-200 dark:border-blue-800' },
                    ];

                    const grouped: Record<string, any[]> = {};
                    for (const t of filteredTransactions) {
                      const grp = classifyInvoiceTransaction(t, selectedCardForInvoice.id, currentPeriod);
                      if (!grouped[grp]) grouped[grp] = [];
                      grouped[grp].push(t);
                    }

                    const sortGroup = (txs: any[], groupKey: string) => {
                      return [...txs].sort((a, b) => {
                        if (groupKey === 'PARCELAMENTOS_ANTERIORES') {
                          const pa = a.postingDate || a.date;
                          const pb = b.postingDate || b.date;
                          const d = parseLocalDate(pa).getTime() - parseLocalDate(pb).getTime();
                          if (d !== 0) return d;
                          const da = (a.description || '').localeCompare(b.description || '');
                          if (da !== 0) return da;
                          return (a.installmentNumber || 0) - (b.installmentNumber || 0);
                        }
                        if (groupKey === 'COMPRAS_DO_PERIODO') {
                          return parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime();
                        }
                        const pa = a.postingDate || a.date;
                        const pb = b.postingDate || b.date;
                        return parseLocalDate(pa).getTime() - parseLocalDate(pb).getTime();
                      });
                    };

                    return groupOrder.map(g => {
                      const txs = grouped[g.key];
                      if (!txs || txs.length === 0) return null;
                      const sorted = sortGroup(txs, g.key);
                      const subtotal = sorted.reduce((acc, t) => {
                        const isPayment = (t.type === 'transfer' || t.type === 'transferencia') && t.destinationAccountId === selectedCardForInvoice.id;
                        const isIncome = (t.type === 'income' || t.type === 'receita') && t.accountId === selectedCardForInvoice.id;
                        return isPayment || isIncome ? acc - t.amount : acc + t.amount;
                      }, 0);

                      return (
                        <div key={g.key} className={`border rounded-xl overflow-hidden shadow-sm bg-card ${g.borderClass}`}>
                          <div className={`${g.bgClass} px-4 py-2.5 border-b flex justify-between items-center`}>
                            <h5 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{g.icon} {g.label}</h5>
                            <span className={`text-xs font-mono font-bold ${subtotal > 0 ? 'text-fiducia-red' : subtotal < 0 ? 'text-fiducia-green' : 'text-muted-foreground'}`}>
                              {sorted.length} lançamento{sorted.length > 1 ? 's' : ''} · R$ {Math.abs(subtotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <table className="w-full text-sm">
                            <tbody className="divide-y">
                              {sorted.map((t: any) => {
                                const isPayment = (t.type === 'transfer' || t.type === 'transferencia') && t.destinationAccountId === selectedCardForInvoice.id;
                                const isIncome = (t.type === 'income' || t.type === 'receita') && t.accountId === selectedCardForInvoice.id;
                                const isNegative = isPayment || isIncome;
                                const hasOriginalDate = t.originalPurchaseDate && t.installmentNumber && t.installmentNumber >= 2;
                                const displayDate = (t.installmentNumber && t.installmentNumber >= 2) ? (t.postingDate || t.date) : t.date;
                                const categoryName = isPayment ? 'Pagamento de Fatura' : (categories.find(c => c.id === t.categoryId)?.name || t.categoryId || '');

                                return (
                                  <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                                    <td className="p-3 whitespace-nowrap text-muted-foreground font-medium w-[85px]">
                                      <div className="flex flex-col">
                                        <span className="text-xs">{parseLocalDate(displayDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                                        {hasOriginalDate && (
                                          <span className="text-[9px] text-muted-foreground/60 mt-0.5" title={`Compra original: ${parseLocalDate(t.originalPurchaseDate!).toLocaleDateString('pt-BR')}`}>
                                            compra {parseLocalDate(t.originalPurchaseDate!).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="p-3">
                                      <div className="flex flex-col">
                                        <span className="font-bold text-secondary-foreground">
                                          {t.installmentNumber && t.totalInstallments
                                            ? t.description.replace(/\s*\(\d+\/\d+\)\s*$/, '')
                                            : t.description}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground uppercase font-medium flex items-center gap-1.5 flex-wrap">
                                          {categoryName && <span>{categoryName}</span>}
                                          {t.installmentNumber && t.totalInstallments && (
                                            <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded text-[9px] font-bold">
                                              Parcela {t.installmentNumber}/{t.totalInstallments}
                                            </span>
                                          )}
                                          {t.ccRecurrenceType === 'fixo' && (
                                            <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 px-1.5 py-0.5 rounded text-[9px] font-bold">
                                              Fixo
                                            </span>
                                          )}
                                          {t.isSystemGeneratedDate && (
                                            <span className="text-[9px] text-muted-foreground/50" title="Data de lançamento gerada pelo sistema">(data estimada)</span>
                                          )}
                                        </span>
                                      </div>
                                    </td>
                                    <td className={`p-3 text-right font-mono font-black w-[130px] ${isNegative ? 'text-fiducia-green' : 'text-fiducia-red'}`}>
                                      {isNegative ? '-' : '+'} R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-3 text-center w-[60px]">
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
                            </tbody>
                          </table>
                        </div>
                      );
                    });
                  })() : (
                    <div className="border rounded-xl overflow-x-auto shadow-sm bg-card">
                      <table className="w-full text-sm">
                        <thead className="bg-secondary/30 border-b">
                          <tr>
                            <th className="p-3 text-left font-bold text-[10px] uppercase tracking-wider text-muted-foreground">Lançamento</th>
                            <th className="p-3 text-left font-bold text-[10px] uppercase tracking-wider text-muted-foreground">Descrição</th>
                            <th className="p-3 text-right font-bold text-[10px] uppercase tracking-wider text-muted-foreground">Valor</th>
                            <th className="p-3 text-center font-bold text-[10px] uppercase tracking-wider text-muted-foreground">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {filteredTransactions
                            .sort((a, b) => {
                              const da = a.postingDate || a.date;
                              const db = b.postingDate || b.date;
                              return parseLocalDate(da).getTime() - parseLocalDate(db).getTime();
                            })
                            .map((t) => {
                              const isPayment = (t.type === 'transfer' || t.type === 'transferencia') && t.destinationAccountId === selectedCardForInvoice.id;
                              const isIncome = (t.type === 'income' || t.type === 'receita') && t.accountId === selectedCardForInvoice.id;
                              const isNegative = isPayment || isIncome;
                              const displayDate = t.postingDate || t.date;
                              const hasOriginalDate = t.originalPurchaseDate && t.installmentNumber && t.installmentNumber >= 2;

                              return (
                                <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                                  <td className="p-3 whitespace-nowrap text-muted-foreground font-medium">
                                    <div className="flex flex-col">
                                      <span className="text-xs">{parseLocalDate(displayDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                                      {hasOriginalDate && (
                                        <span className="text-[9px] text-muted-foreground/60 mt-0.5">
                                          compra {parseLocalDate(t.originalPurchaseDate!).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-3">
                                    <div className="flex flex-col">
                                      <span className="font-bold text-secondary-foreground">
                                        {t.installmentNumber && t.totalInstallments
                                          ? t.description.replace(/\s*\(\d+\/\d+\)\s*$/, '')
                                          : t.description}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground uppercase font-medium flex items-center gap-1.5 flex-wrap">
                                        {isPayment ? 'Pagamento de Fatura' : (categories.find(c => c.id === t.categoryId)?.name || t.categoryId || '')}
                                        {t.installmentNumber && t.totalInstallments && (
                                          <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded text-[9px] font-bold">
                                            Parcela {t.installmentNumber}/{t.totalInstallments}
                                          </span>
                                        )}
                                        {t.ccRecurrenceType === 'fixo' && (
                                          <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 px-1.5 py-0.5 rounded text-[9px] font-bold">
                                            Fixo
                                          </span>
                                        )}
                                        {t.isSystemGeneratedDate && (
                                          <span className="text-[9px] text-muted-foreground/50">(data estimada)</span>
                                        )}
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
                        </tbody>
                      </table>
                    </div>
                  )}
                  
                  {(() => {
                    const futureTxs = transactions
                      .filter(t =>
                        t.accountId === selectedCardForInvoice.id &&
                        t.installmentNumber &&
                        t.totalInstallments &&
                        t.invoicePeriod > currentPeriod &&
                        (t.status === 'pendente' || t.status === 'pending')
                      )
                      .sort((a, b) => {
                        const pa = a.invoicePeriod.localeCompare(b.invoicePeriod);
                        if (pa !== 0) return pa;
                        const da = (a.postingDate || a.date).localeCompare(b.postingDate || b.date);
                        if (da !== 0) return da;
                        return (a.installmentNumber || 0) - (b.installmentNumber || 0);
                      });

                    if (futureTxs.length === 0) return null;

                    const groupedByPeriod: Record<string, any[]> = {};
                    for (const ft of futureTxs) {
                      if (!groupedByPeriod[ft.invoicePeriod]) groupedByPeriod[ft.invoicePeriod] = [];
                      groupedByPeriod[ft.invoicePeriod].push(ft);
                    }
                    const sortedPeriods = Object.keys(groupedByPeriod).sort();

                    const grandTotal = futureTxs.reduce((sum, ft) => sum + ft.amount, 0);

                    return (
                      <div className="bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800 overflow-hidden">
                        <div className="px-4 py-3 border-b border-amber-200/50 dark:border-amber-800/50 flex justify-between items-center">
                          <div>
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Comprometimento Futuro</p>
                            <p className="text-[9px] text-muted-foreground mt-0.5">
                              {futureTxs.length} parcela{futureTxs.length > 1 ? 's' : ''} em {sortedPeriods.length} fatura{sortedPeriods.length > 1 ? 's' : ''} futura{sortedPeriods.length > 1 ? 's' : ''} — aparecerão como Parcelamentos Anteriores
                            </p>
                          </div>
                          <span className="font-mono font-black text-sm text-fiducia-amber">R$ {grandTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="divide-y divide-amber-200/30 dark:divide-amber-800/30">
                          {sortedPeriods.map(period => {
                            const periodTxs = groupedByPeriod[period];
                            const [y, m] = period.split('-').map(Number);
                            const label = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                            const periodTotal = periodTxs.reduce((sum, ft) => sum + ft.amount, 0);

                            return (
                              <div key={period} className="px-4 py-2.5">
                                <div className="flex justify-between items-center mb-1.5">
                                  <span className="text-xs font-black text-muted-foreground capitalize">{label}</span>
                                  <span className="text-[10px] font-mono font-bold text-fiducia-amber">R$ {periodTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="space-y-1">
                                  {periodTxs.map(ft => (
                                    <div key={ft.id} className="flex items-center justify-between text-[11px] pl-3 border-l-2 border-amber-300/40 dark:border-amber-700/40">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="truncate text-secondary-foreground">
                                          {ft.description.replace(/\s*\(\d+\/\d+\)\s*$/, '')}
                                        </span>
                                        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-1 rounded shrink-0">
                                          {ft.installmentNumber}/{ft.totalInstallments}
                                        </span>
                                        {ft.postingDate && (
                                          <span className="text-[9px] text-muted-foreground/60 shrink-0 hidden sm:inline">
                                            {parseLocalDate(ft.postingDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                          </span>
                                        )}
                                      </div>
                                      <span className="font-mono font-bold text-muted-foreground shrink-0 ml-2">
                                        R$ {ft.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="bg-secondary/20 p-4 rounded-xl border border-dashed flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="bg-background p-2 rounded-lg shadow-sm border">
                        <Calendar className="w-5 h-5 text-fiducia-blue" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Vencimento da Fatura</p>
                        <p className="text-sm font-bold">Dia {selectedCardForInvoice.dueDay} de {selectedInvoiceMonth.toLocaleDateString('pt-BR', { month: 'long' })}</p>
                      </div>
                    </div>
                    {totalInvoice > 0 && (
                        <Button 
                          className="bg-fiducia-green hover:bg-fiducia-green/90 text-white dark:text-background font-bold text-xs uppercase tracking-widest h-10 px-6 shadow-md"
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
                className="flex h-11 w-full rounded-md border border-input bg-background dark:bg-input/30 px-3 py-2 text-sm shadow-sm transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary/50 text-foreground"
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
            <Button className="bg-fiducia-green hover:bg-fiducia-green/90 text-white dark:text-background font-bold" onClick={handlePayInvoice}>Confirmar Pagamento</Button>
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
            
            {(txToDelete?.parentId || txToDelete?.isRecurring || txToDelete?.installmentId || txToDelete?.ccRecurrenceType === 'fixo') && (
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

      {selectedCardForInvoice && user && (
        <InvoiceReconciliationDialog
          open={isInvoiceReconciliationOpen}
          onOpenChange={setIsInvoiceReconciliationOpen}
          userId={user.uid}
          card={selectedCardForInvoice}
          invoicePeriod={`${selectedInvoiceMonth.getFullYear()}-${(selectedInvoiceMonth.getMonth() + 1).toString().padStart(2, '0')}`}
          categories={categories}
          systemTransactions={transactions.filter(t =>
            (t.accountId === selectedCardForInvoice.id || t.destinationAccountId === selectedCardForInvoice.id) &&
            t.invoicePeriod === `${selectedInvoiceMonth.getFullYear()}-${(selectedInvoiceMonth.getMonth() + 1).toString().padStart(2, '0')}`
          )}
        />
      )}

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
        categories={categories}
        onConfirm={handleConfirmPdfImport}
      />
    </div>
  );
}
