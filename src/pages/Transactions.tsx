import { motion } from 'motion/react';
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, writeBatch, runTransaction, getDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Select as ShadcnSelect, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '../components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger, PopoverClose } from '../components/ui/popover';
import { Plus, Trash2, Edit, ArrowUpRight, ArrowDownRight, ArrowRightLeft, Lock, FileUp, Check, X, AlertCircle, HelpCircle, Tag, Wallet, CheckCircle, AlignLeft, CreditCard, ChevronLeft, ChevronRight, Search, Repeat, MessageSquare, Paperclip, ThumbsUp, ThumbsDown, CheckCircle2, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { parseOfx, OfxTransaction } from '../services/ofxService';
import { parseCsvOrExcel } from '../services/importService';
import { callGroq } from '../services/groqService';
import { logActivity } from '../services/activityLogService';
import Select, { MultiValue } from 'react-select';
import { getCategoryIcon } from '../lib/categoryIcons';
import { calculateInvoicePeriod, resolveAccountName, isEffectivelyPaid, isPeriodClosed, formatCurrency } from '../lib/utils';
import { PageHelp } from '../components/PageHelp';
import { useTransactionDialog } from '../contexts/TransactionDialogContext';

const TransactionObservation = ({ observation }: { observation: string }) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.matchMedia('(max-width: 768px)').matches);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const trimmedObservation = observation?.trim();
  if (!trimmedObservation) return null;

  const content = (
    <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
      {trimmedObservation}
    </div>
  );

  if (isMobile) {
    return (
      <Popover>
        <PopoverTrigger render={(props) => (
          <button 
            {...props}
            className="p-1 rounded-full hover:bg-secondary/50 transition-colors text-muted-foreground hover:text-primary"
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </button>
        )} />
        <PopoverContent className="w-[280px] p-4 rounded-xl shadow-xl border-none bg-slate-900 text-slate-50">
          <div className="flex justify-between items-start mb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider opacity-50">Observação</h4>
            <PopoverClose render={(props) => (
              <button 
                {...props}
                className="p-1 -mr-2 -mt-2 rounded-full hover:bg-background/10 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            )} />
          </div>
          {content}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger render={(props) => (
        <button 
          {...props}
          className="p-1 rounded-full hover:bg-secondary/50 transition-colors text-muted-foreground hover:text-primary"
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </button>
      )} />
      <TooltipContent 
        side="top" 
        className="max-w-[280px] p-3 rounded-lg shadow-lg border-none bg-slate-900 text-slate-50"
      >
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-50">Observação</p>
          {content}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

export function Transactions() {
  const { user, isAuthReady } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [creditCards, setCreditCards] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [closedPeriods, setClosedPeriods] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const { open: openTxDialog } = useTransactionDialog();
  const location = useLocation();
  const [isClosePeriodDialogOpen, setIsClosePeriodDialogOpen] = useState(false);
  
  const [selectedTagsFilter, setSelectedTagsFilter] = useState<string[]>([]);
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string>('all');
  
  const [filterType, setFilterType] = useState<'month' | 'range' | 'all'>('month');
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  const currentDateStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
  
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [startDate, setStartDate] = useState(`${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-01`);
  const [endDate, setEndDate] = useState(new Date(now.getFullYear(), now.getMonth() + 1, 0).toLocaleDateString('en-CA'));
  const [searchTerm, setSearchTerm] = useState('');
  const [aiSearchMode, setAiSearchMode] = useState(false);
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiSearchResultIds, setAiSearchResultIds] = useState<Set<string> | null>(null);

  const [deleteConfirmTx, setDeleteConfirmTx] = useState<any | null>(null);
  const [deleteScope, setDeleteScope] = useState('only');
  const [closePeriodMonth, setClosePeriodMonth] = useState(currentMonthStr);
  const [closePeriodAccountId, setClosePeriodAccountId] = useState<string>('');
  const [closePeriodPaymentAccountId, setClosePeriodPaymentAccountId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // OFX Import State
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importedTransactions, setImportedTransactions] = useState<(OfxTransaction & { selected: boolean; categoryId: string })[]>([]);
  const [importAccountId, setImportAccountId] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const tQuery = query(collection(db, 'transactions'), where('userId', '==', user.uid));
    const unsubscribeT = onSnapshot(tQuery, (snapshot) => {
      console.log('Transactions snapshot received, docs count:', snapshot.docs.length);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTransactions(data);
      setIsLoading(false);

      if (invoices.length > 0) {
        const syncInvoices = async () => {
          for (const invoice of invoices) {
            if (invoice.paymentTransactionId) {
              const paymentTx = data.find(t => t.id === invoice.paymentTransactionId) as any;
              if (paymentTx) {
                let newStatus = invoice.status;
                if (paymentTx.status === 'pago' && invoice.status !== 'paga') {
                  newStatus = 'paga';
                } else if (paymentTx.status !== 'pago' && invoice.status === 'paga') {
                  newStatus = 'fechada';
                }

                if (newStatus !== invoice.status) {
                  try {
                    await updateDoc(doc(db, 'invoices', invoice.id), { status: newStatus });
                  } catch (err) {
                    console.error('Error syncing invoice status:', err);
                  }
                }
              }
            }
          }
        };
        syncInvoices();
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'transactions'));

    const aQuery = query(collection(db, 'accounts'), where('userId', '==', user.uid));
    const unsubscribeA = onSnapshot(aQuery, (snapshot) => {
      setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'accounts'));

    const cQuery = query(collection(db, 'categories'), where('userId', '==', user.uid));
    const unsubscribeC = onSnapshot(cQuery, (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'categories'));

    const cpQuery = query(collection(db, 'closedPeriods'), where('userId', '==', user.uid));
    const unsubscribeCP = onSnapshot(cpQuery, (snapshot) => {
      setClosedPeriods(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'closedPeriods'));

    const ccQuery = query(collection(db, 'creditCards'), where('userId', '==', user.uid));
    const unsubscribeCC = onSnapshot(ccQuery, (snapshot) => {
      setCreditCards(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'creditCards'));

    const tagsQuery = query(collection(db, 'tags'), where('userId', '==', user.uid));
    const unsubscribeTags = onSnapshot(tagsQuery, (snapshot) => {
      setTags(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'tags'));

    const invQuery = query(collection(db, 'invoices'), where('userId', '==', user.uid));
    const unsubscribeInv = onSnapshot(invQuery, (snapshot) => {
      setInvoices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'invoices'));

    return () => {
      unsubscribeT();
      unsubscribeA();
      unsubscribeC();
      unsubscribeCP();
      unsubscribeCC();
      unsubscribeTags();
      unsubscribeInv();
    };
  }, [user, isAuthReady]);

  useEffect(() => {
    const editId = (location.state as any)?.editId;
    if (editId) {
      openTxDialog({ editId });
      window.history.replaceState({}, '');
    }
  }, [location.state, openTxDialog]);

  useEffect(() => {
    const presetAccountId = (location.state as any)?.presetAccountId;
    const presetMonth = (location.state as any)?.presetMonth;
    if (presetAccountId && transactions.length >= 0) {
      setSelectedAccountFilter(presetAccountId);
      if (presetMonth) setSelectedMonth(presetMonth);
      window.history.replaceState({}, '');
    }
  }, [location.state, transactions]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
        e.preventDefault();
        openTxDialog();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openTxDialog]);


  const handleClosePeriod = async () => {
    if (!user || !closePeriodAccountId) {
      toast.error('Selecione uma conta para fechar o período.');
      return;
    }

    const isCreditCard = creditCards.some(cc => cc.id === closePeriodAccountId);

    if (isCreditCard) {
      if (!closePeriodPaymentAccountId) {
        toast.error('Selecione a conta corrente para o pagamento da fatura.');
        return;
      }

      const existingInvoice = invoices.find(i => i.cardId === closePeriodAccountId && i.period === closePeriodMonth);
      if (existingInvoice && (existingInvoice.status === 'fechada' || existingInvoice.status === 'paga')) {
        toast.error('Esta fatura já está fechada ou paga.');
        return;
      }

      const card = creditCards.find(cc => cc.id === closePeriodAccountId);
      if (!card) return;

      // Calculate total amount of the invoice
      const invoiceTransactions = transactions.filter(t => 
        (t.accountId === closePeriodAccountId || t.destinationAccountId === closePeriodAccountId) && 
        t.invoicePeriod === closePeriodMonth
      );

      let totalAmount = 0;
      invoiceTransactions.forEach(t => {
        if (t.type === 'despesa') totalAmount += t.amount;
        else if (t.type === 'receita') totalAmount -= t.amount;
        else if (t.type === 'transferencia') {
          if (t.accountId === closePeriodAccountId) totalAmount -= t.amount; // Outflow from card (e.g. cash advance)
          if (t.destinationAccountId === closePeriodAccountId) totalAmount -= t.amount; // Inflow to card (e.g. payment)
        }
      });

      if (totalAmount <= 0) {
        toast.error('O valor total da fatura não pode ser zero ou negativo.');
        return;
      }

      // Calculate payment date (due date)
      const [yearStr, monthStr] = closePeriodMonth.split('-');
      let year = parseInt(yearStr);
      let month = parseInt(monthStr) - 1; // 0-indexed
      const paymentDate = new Date(year, month, card.dueDay);
      const paymentDateStr = `${paymentDate.getFullYear()}-${(paymentDate.getMonth() + 1).toString().padStart(2, '0')}-${paymentDate.getDate().toString().padStart(2, '0')}`;

      const batch = writeBatch(db);

      try {
        // 1. Create payment transaction
        const paymentTxRef = doc(collection(db, 'transactions'));
        const paymentTxData = {
          userId: user.uid,
          type: 'transferencia',
          amount: totalAmount,
          date: paymentDateStr,
          description: `Pagamento Fatura ${card.name} - ${closePeriodMonth}`,
          accountId: closePeriodPaymentAccountId,
          destinationAccountId: closePeriodAccountId,
          categoryId: 'Pagamento de Cartão',
          status: 'pendente',
          invoicePeriod: closePeriodMonth,
          createdAt: new Date().toISOString()
        };
        batch.set(paymentTxRef, paymentTxData);

        // 2. Create or update invoice document
        if (existingInvoice) {
          const invoiceRef = doc(db, 'invoices', existingInvoice.id);
          batch.update(invoiceRef, {
            status: 'fechada',
            totalAmount: totalAmount,
            closedAt: new Date().toISOString(),
            paymentTransactionId: paymentTxRef.id
          });
        } else {
          const invoiceRef = doc(collection(db, 'invoices'));
          batch.set(invoiceRef, {
            userId: user.uid,
            cardId: closePeriodAccountId,
            period: closePeriodMonth,
            status: 'fechada',
            totalAmount: totalAmount,
            closedAt: new Date().toISOString(),
            paymentTransactionId: paymentTxRef.id
          });
        }

        // 3. Open next month's invoice
        let nextMonth = month + 1;
        let nextYear = year;
        if (nextMonth > 11) {
          nextMonth = 0;
          nextYear += 1;
        }
        const nextPeriodStr = `${nextYear}-${(nextMonth + 1).toString().padStart(2, '0')}`;
        const nextInvoiceExists = invoices.some(i => i.cardId === closePeriodAccountId && i.period === nextPeriodStr);
        
        if (!nextInvoiceExists) {
          const nextInvoiceRef = doc(collection(db, 'invoices'));
          batch.set(nextInvoiceRef, {
            userId: user.uid,
            cardId: closePeriodAccountId,
            period: nextPeriodStr,
            status: 'aberta',
            totalAmount: 0,
            createdAt: new Date().toISOString()
          });
        }

        await batch.commit();
        toast.success('Fatura fechada com sucesso.');
        setIsClosePeriodDialogOpen(false);
        setClosePeriodAccountId('');
        setClosePeriodPaymentAccountId('');
      } catch (error) {
        toast.error('Erro ao fechar a fatura.');
        handleFirestoreError(error, OperationType.CREATE, 'invoices/transactions');
      }
    } else {
      // Logic for checking accounts
      if (closedPeriods.some(cp => cp.period === closePeriodMonth && cp.accountId === closePeriodAccountId)) {
        toast.error('Este mês já está fechado para esta conta.');
        return;
      }
      try {
        await addDoc(collection(db, 'closedPeriods'), {
          userId: user.uid,
          accountId: closePeriodAccountId,
          period: closePeriodMonth,
          closedAt: new Date().toISOString()
        });
        toast.success('Mês fechado com sucesso para a conta selecionada.');
        setIsClosePeriodDialogOpen(false);
        setClosePeriodAccountId('');
      } catch (error) {
        toast.error('Erro ao fechar o mês.');
        handleFirestoreError(error, OperationType.CREATE, 'closedPeriods');
      }
    }
  };



  const handleDelete = async () => {
    if (!deleteConfirmTx) return;
    const t = deleteConfirmTx;
    
    let transactionsToDelete = [t];
    if ((t.parentId || t.isRecurring || t.installmentId) && deleteScope !== 'only') {
      transactionsToDelete = transactions.filter(tx => {
        let isSameSeries = false;
        
        if (t.parentId) {
          // t is a child. Series includes the parent and all children of the same parent.
          isSameSeries = tx.id === t.parentId || tx.parentId === t.parentId;
        } else {
          // t might be the parent itself. Series includes t and all its children.
          isSameSeries = tx.id === t.id || tx.parentId === t.id;
        }
        
        // Fallback for older data using installmentId
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

    // Check for closed periods
    for (const tx of transactionsToDelete) {
      if (isPeriodClosed(tx.date, tx.accountId, creditCards, invoices, closedPeriods, tx.invoicePeriod)) {
        toast.error(`Não é possível excluir um lançamento de um mês fechado para a conta ${accounts.find(a => a.id === tx.accountId)?.name || 'desconhecida'}.`);
        return;
      }
      if (tx.type === 'transferencia' && isPeriodClosed(tx.date, tx.destinationAccountId, creditCards, invoices, closedPeriods, tx.invoicePeriod)) {
        toast.error(`Não é possível excluir um lançamento de um mês fechado para a conta de destino ${accounts.find(a => a.id === tx.destinationAccountId)?.name || 'desconhecida'}.`);
        return;
      }
    }

    // Group transactions by series to avoid over-reverting balance
    const seriesGroups = new Map<string, any[]>();
    const standaloneTxs: any[] = [];

    for (const tx of transactionsToDelete) {
      const seriesKey = tx.parentId || tx.installmentId || null;
      if (seriesKey) {
        if (!seriesGroups.has(seriesKey)) seriesGroups.set(seriesKey, []);
        seriesGroups.get(seriesKey)!.push(tx);
      } else {
        standaloneTxs.push(tx);
      }
    }

    // Calculate balance changes per account (series-aware)
    const accountBalanceChanges: Record<string, number> = {};

    const applyChange = (accId: string | undefined, change: number) => {
      if (!accId) return;
      accountBalanceChanges[accId] = (accountBalanceChanges[accId] || 0) + change;
    };

    // Standalone transactions: revert each individually (only if was paid)
    for (const tx of standaloneTxs) {
      if (!isEffectivelyPaid(tx)) continue;
      if (tx.type === 'transferencia') {
        applyChange(tx.accountId, tx.amount);
        applyChange(tx.destinationAccountId, -tx.amount);
      } else {
        applyChange(tx.accountId, tx.type === 'receita' ? -tx.amount : tx.amount);
      }
    }

    // Series: revert balance ONLY ONCE per group (only if was paid)
    for (const [_, series] of seriesGroups) {
      const paidTx = series.find(tx => isEffectivelyPaid(tx));
      if (!paidTx) continue;

      const isParcelado = paidTx.installmentNumber != null && paidTx.totalInstallments != null;
      // Parcelado: only installment 1 ever affected balance
      // Non-parcelado (recurring): only the first occurrence affected balance
      const reversalAmount = isParcelado
        ? (series.find(tx => tx.installmentNumber === 1)?.amount || paidTx.amount)
        : paidTx.amount;

      if (paidTx.type === 'transferencia') {
        applyChange(paidTx.accountId, reversalAmount);
        applyChange(paidTx.destinationAccountId, -reversalAmount);
      } else {
        applyChange(paidTx.accountId, paidTx.type === 'receita' ? -reversalAmount : reversalAmount);
      }
    }

    // Execute atomic delete + balance update with fresh reads from Firestore
    try {
      await runTransaction(db, async (transaction) => {
        // Read all account balances first (Firestore requires all reads before writes)
        const balanceSnapshots: Record<string, any> = {};
        for (const [accId, change] of Object.entries(accountBalanceChanges)) {
          if (change === 0) continue;
          balanceSnapshots[accId] = await transaction.get(doc(db, 'accounts', accId));
        }

        for (const tx of transactionsToDelete) {
          transaction.delete(doc(db, 'transactions', tx.id));
        }

        for (const [accId, change] of Object.entries(accountBalanceChanges)) {
          if (change === 0) continue;
          const snap = balanceSnapshots[accId];
          if (snap?.exists()) {
            transaction.update(doc(db, 'accounts', accId), { balance: (snap.data().balance || 0) + change });
          }
        }
      });

      logActivity({ userId: user.uid, action: 'delete', entityType: 'transaction', entityId: t.id || t.parentId, description: `${transactionsToDelete.length} lançamento(s) excluído(s): ${t.description}` }).catch(() => {});
      toast.success('Lançamentos excluídos');
    } catch (error) {
      toast.error('Erro ao excluir lançamentos');
      handleFirestoreError(error, OperationType.DELETE, `transactions`);
    } finally {
      setDeleteConfirmTx(null);
      setDeleteScope('only');
    }
  };

  const handleQuickConfirm = async (t: any) => {
    if (isPeriodClosed(t.date, t.accountId, creditCards, invoices, closedPeriods, t.invoicePeriod)) {
      toast.error('Não é possível confirmar um lançamento de um mês fechado.');
      return;
    }
    try {
      await runTransaction(db, async (transaction) => {
        const txRef = doc(db, 'transactions', t.id);
        const accountDeltas: Record<string, number> = {};

        if (t.type === 'transferencia') {
          if (t.accountId) accountDeltas[t.accountId] = (accountDeltas[t.accountId] || 0) - t.amount;
          if (t.destinationAccountId) accountDeltas[t.destinationAccountId] = (accountDeltas[t.destinationAccountId] || 0) + t.amount;
        } else if (t.accountId) {
          const change = t.type === 'receita' ? t.amount : -t.amount;
          accountDeltas[t.accountId] = (accountDeltas[t.accountId] || 0) + change;
        }

        for (const [accId, delta] of Object.entries(accountDeltas)) {
          if (delta === 0) continue;
          const accRef = doc(db, 'accounts', accId);
          const accSnap = await transaction.get(accRef);
          if (accSnap.exists()) {
            transaction.update(accRef, { balance: (accSnap.data().balance || 0) + delta });
          }
        }

        transaction.update(txRef, { status: 'pago', updatedAt: new Date().toISOString() });
      });
      logActivity({ userId: user.uid, action: 'update', entityType: 'transaction', entityId: t.id, description: `Confirmação rápida: ${t.description}` }).catch(() => {});
      toast.success('Lançamento confirmado como pago');
    } catch (error) {
      toast.error('Erro ao confirmar lançamento');
      handleFirestoreError(error, OperationType.UPDATE, `transactions/${t.id}`);
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const isOfx = fileName.endsWith('.ofx');
    const isCsvOrExcel = fileName.endsWith('.csv') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

    if (!isOfx && !isCsvOrExcel) {
      toast.error('Formato de arquivo não suportado. Use .ofx, .csv ou .xlsx');
      return;
    }

    try {
      let parsed: OfxTransaction[] = [];
      
      if (isOfx) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          try {
            parsed = parseOfx(content);
            processParsedTransactions(parsed);
          } catch (error) {
            console.error('Error parsing OFX:', error);
            toast.error('Erro ao processar o arquivo OFX.');
          }
        };
        reader.readAsText(file);
      } else {
        parsed = await parseCsvOrExcel(file);
        processParsedTransactions(parsed);
      }
    } catch (error) {
      console.error('Error during file import:', error);
      toast.error('Erro ao processar o arquivo.');
    } finally {
      // Reset input
      e.target.value = '';
    }
  };

  const processParsedTransactions = (parsed: OfxTransaction[]) => {
    if (parsed.length === 0) {
      toast.error('Nenhuma transação encontrada no arquivo.');
      return;
    }

    // Check for duplicates based on ofxId
    const existingOfxIds = new Set(transactions.map(t => t.ofxId).filter(Boolean));
    
    const enriched = parsed.map(t => ({
      ...t,
      selected: !existingOfxIds.has(t.id),
      categoryId: ''
    }));

    setImportedTransactions(enriched);
    setIsImportDialogOpen(true);
  };

  const handleImportSubmit = async () => {
    if (!user || !importAccountId) {
      toast.error('Selecione uma conta ou cartão para importação.');
      return;
    }

    const selectedTransactions = importedTransactions.filter(t => t.selected);
    if (selectedTransactions.length === 0) {
      toast.error('Nenhuma transação selecionada.');
      return;
    }

    setIsImporting(true);

    try {
      const isCreditCard = creditCards.some(cc => cc.id === importAccountId);
      const card = creditCards.find(cc => cc.id === importAccountId);

      // Compute all transaction data + total delta before the atomic transaction
      const tDataList: any[] = [];
      let totalDelta = 0;

      for (const t of selectedTransactions) {
        const tData: any = {
          userId: user.uid,
          type: t.type,
          amount: t.amount,
          date: t.date,
          description: t.description,
          status: isCreditCard ? 'realizado' : 'pago',
          accountId: importAccountId,
          categoryId: t.categoryId || 'default',
          ofxId: t.id,
          createdAt: new Date().toISOString()
        };

        if (isCreditCard && card) {
          tData.creditCardId = importAccountId;
          tData.invoicePeriod = calculateInvoicePeriod(t.date, card.closingDay, card.dueDay);
        }

        tDataList.push(tData);
        totalDelta += t.type === 'despesa' ? -t.amount : t.amount;
      }

      // Atomic: create all transactions + update balance in a single runTransaction
      await runTransaction(db, async (transaction) => {
        // Read balance first (Firestore requires all reads before writes)
        let accSnap: any = null;
        if (!isCreditCard && totalDelta !== 0 && importAccountId) {
          accSnap = await transaction.get(doc(db, 'accounts', importAccountId));
        }

        for (const tData of tDataList) {
          transaction.set(doc(collection(db, 'transactions')), tData);
        }

        if (accSnap?.exists()) {
          transaction.update(doc(db, 'accounts', importAccountId), { balance: (accSnap.data().balance || 0) + totalDelta });
        }
      });

      toast.success(`${tDataList.length} transações importadas com sucesso.`);
      setIsImportDialogOpen(false);
      setImportedTransactions([]);
      setImportAccountId('');
    } catch (error) {
      console.error('Error during batch import:', error);
      toast.error('Erro ao finalizar a importação. Nenhuma transação foi salva.');
    } finally {
      setIsImporting(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'receita':
      case 'income': return <ArrowUpRight className="h-5 w-5 text-fiducia-green" />;
      case 'despesa':
      case 'expense': return <ArrowDownRight className="h-5 w-5 text-fiducia-red" />;
      case 'transferencia':
      case 'transfer': return <ArrowRightLeft className="h-5 w-5 text-fiducia-blue" />;
      default: return null;
    }
  };


  const handleAiSearch = async () => {
    if (!searchTerm.trim() || isAiSearching) return;
    setIsAiSearching(true);
    try {
      const sample = transactions
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 200);

      const prompt = `Você é um assistente de busca financeira. O usuário quer encontrar transações com esta descrição natural:

"${searchTerm}"

Abaixo está uma lista de transações recentes no formato "ID | data | descrição | valor | tipo | categoria". 
Analise a intenção da busca e retorne APENAS os IDs das transações que correspondem, separados por vírgula.
Se nenhuma corresponder, retorne apenas "NENHUMA".

Transações:
${sample.map(t =>
  `${t.id} | ${t.date?.split('T')[0] || t.date} | ${t.description} | R$ ${t.amount.toFixed(2)} | ${t.type} | ${categories.find(c => c.id === t.categoryId)?.name || ''}`
).join('\n')}`;

      const result = await callGroq(
        [{ role: "user", content: prompt }],
        { maxTokens: 500, temperature: 0.1 }
      );

      if (result.trim() === "NENHUMA" || !result.trim()) {
        setAiSearchResultIds(new Set());
        toast.info('Nenhuma transação encontrada para esta busca.');
      } else {
        const ids = result.split(',').map(id => id.trim()).filter(Boolean);
        setAiSearchResultIds(new Set(ids));
      }
    } catch (error) {
      console.error("AI Search error:", error);
      toast.error('Erro na busca inteligente. Tente o modo texto.');
      setAiSearchResultIds(null);
    } finally {
      setIsAiSearching(false);
    }
  };

  const [selectedAccountBalance, setSelectedAccountBalance] = useState(0);

  useEffect(() => {
    if (selectedAccountFilter === 'all' || !user) {
      setSelectedAccountBalance(0);
      return;
    }
    getDoc(doc(db, 'accounts', selectedAccountFilter)).then(snap => {
      if (snap.exists()) {
        setSelectedAccountBalance(snap.data().balance || 0);
      }
    }).catch(() => setSelectedAccountBalance(0));
  }, [selectedAccountFilter, user]);

  const processedTransactions = React.useMemo(() => {
    let result = [...transactions];

    // 1. Calculate running balance if a specific account is selected
    if (selectedAccountFilter !== 'all') {
        // Sort ascending by date to calculate running balance correctly
        const accountTransactions = result
          .filter(t => (t.accountId === selectedAccountFilter || t.destinationAccountId === selectedAccountFilter) && isEffectivelyPaid(t))
          .sort((a, b) => {
            const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
            if (dateDiff !== 0) return dateDiff;
            return new Date(a.createdAt || a.date).getTime() - new Date(b.createdAt || b.date).getTime();
          });

        // We need to calculate backwards from the current balance
        // Wait, if we sort descending, we can start with current balance and work backwards.
        const descendingAccountTransactions = [...accountTransactions].reverse();
        let currentBalance = selectedAccountBalance;
        
        const transactionsWithBalance = descendingAccountTransactions.map(t => {
          const tWithBalance = { ...t, runningBalance: currentBalance };
          
          if (t.accountId === selectedAccountFilter) {
            if (t.type === 'receita') {
              currentBalance -= t.amount;
            } else if (t.type === 'despesa') {
              currentBalance += t.amount;
            } else if (t.type === 'transferencia') {
              currentBalance += t.amount; // It was a transfer OUT, so we add it back
            }
          } else if (t.destinationAccountId === selectedAccountFilter) {
            if (t.type === 'transferencia') {
              currentBalance -= t.amount; // It was a transfer IN, so we subtract it
            }
          }
          
          return tWithBalance;
        });
        
        // Replace the original transactions with the ones containing runningBalance
        result = result.map(t => {
          const withBalance = transactionsWithBalance.find(twb => twb.id === t.id);
          return withBalance ? withBalance : t;
        });
    }

    // 2. Apply Filters
    return result.filter(t => {
      // Tags filter
      let matchesTags = true;
      if (selectedTagsFilter.length > 0) {
        matchesTags = !!t.tags && t.tags.length > 0 && selectedTagsFilter.some(tagId => t.tags.includes(tagId));
      }
      
      // Account filter
      let matchesAccount = true;
      if (selectedAccountFilter !== 'all') {
        matchesAccount = t.accountId === selectedAccountFilter || t.destinationAccountId === selectedAccountFilter;
      }

      // Date filter
      let matchesDate = true;
      const tDatePart = t.date.split('T')[0];
      if (filterType === 'month') {
        matchesDate = tDatePart.startsWith(selectedMonth);
      } else if (filterType === 'range') {
        matchesDate = tDatePart >= startDate && tDatePart <= endDate;
      }

      // Search filter
      let matchesSearch = true;
      if (aiSearchResultIds) {
        matchesSearch = aiSearchResultIds.has(t.id);
      } else if (searchTerm) {
        const term = searchTerm.toLowerCase();
        matchesSearch = 
          (t.description && t.description.toLowerCase().includes(term)) ||
          (t.amount && t.amount.toString().includes(term));
      }
      
      return !t.creditCardId && matchesTags && matchesAccount && matchesDate && matchesSearch;
    }).sort((a, b) => {
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime();
    });
  }, [transactions, selectedAccountFilter, selectedTagsFilter, filterType, selectedMonth, startDate, endDate, searchTerm, selectedAccountBalance, accounts, creditCards, aiSearchResultIds]);


  const summary = React.useMemo(() => {
    return processedTransactions.reduce((acc, t) => {
      if (!isEffectivelyPaid(t)) return acc;
      if (t.type === 'receita') acc.income += t.amount;
      if (t.type === 'despesa') acc.expense += t.amount;
      // For transfers, if 'all' accounts, it's neutral. 
      // If specific account, it depends if it's source or destination
      if (t.type === 'transferencia' && selectedAccountFilter !== 'all') {
        if (t.accountId === selectedAccountFilter) acc.expense += t.amount;
        if (t.destinationAccountId === selectedAccountFilter) acc.income += t.amount;
      }
      return acc;
    }, { income: 0, expense: 0 });
  }, [processedTransactions, selectedAccountFilter]);

  const groupedTransactions = React.useMemo(() => {
    const groups: { [key: string]: any[] } = {};
    processedTransactions.forEach(t => {
      const dateKey = t.date.split('T')[0];
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(t);
    });
    return groups;
  }, [processedTransactions]);

  const handlePrevMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    let newMonth = month - 1;
    let newYear = year;
    if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }
    setSelectedMonth(`${newYear}-${newMonth.toString().padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    let newMonth = month + 1;
    let newYear = year;
    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    }
    setSelectedMonth(`${newYear}-${newMonth.toString().padStart(2, '0')}`);
  };

  const formatMonthYear = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase());
  };

  const formatDateHeader = (dateStr: string) => {
    const datePart = dateStr.split('T')[0];
    const [year, month, day] = datePart.split('-');
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase());
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-3xl font-bold tracking-tight">Lançamentos</h2>
          <PageHelp
            title="Lançamentos"
            description="Registre receitas, despesas e transferências entre contas. Crie lançamentos avulsos, parcelados (em contas corrente) ou recorrentes."
            items={[
              { label: "Tipos", desc: "Receita (dinheiro que entra), Despesa (dinheiro que sai), Transferência (movimentação entre contas)." },
              { label: "Parcelamento", desc: "Divide o valor total em N parcelas mensais. O saldo da conta é atualizado apenas na primeira." },
              { label: "Importar Arquivo", desc: "Envie extratos OFX, CSV ou Excel. O sistema identifica automaticamente as colunas e sugere o match." },
              { label: "IA", desc: "Use o campo de busca inteligente para perguntar em linguagem natural sobre seus gastos." },
            ]}
          />
        </div>
        <div className="flex space-x-2">
          <div className="relative">
            <input
              type="file"
              accept=".ofx,.csv,.xlsx,.xls"
              onChange={handleFileImport}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              title="Importar arquivo (OFX, CSV, Excel)"
            />
            <Button variant="outline" className="rounded-xl shadow-sm">
              <FileUp className="mr-2 h-4 w-4" /> Importar Arquivo
            </Button>
          </div>
          <Tooltip>
            <TooltipTrigger render={(props) => (
              <Button 
                {...props}
                className="rounded-xl shadow-lg shadow-primary/20"
                onClick={() => openTxDialog()}
              >
                <Plus className="mr-2 h-4 w-4" /> Novo Lançamento
              </Button>
            )} />
            <TooltipContent side="bottom">
              <span className="text-xs">Ctrl+N (Cmd+N no Mac)</span>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <Card className="border-none shadow-md bg-card/50 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="space-y-2 md:col-span-3">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Conta</Label>
              <ShadcnSelect value={selectedAccountFilter} onValueChange={setSelectedAccountFilter}>
                <SelectTrigger className="h-11 bg-background shadow-sm border-secondary/30 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all rounded-xl">
                  <SelectValue placeholder="Todas as contas">
                    {selectedAccountFilter === 'all' ? 'Todas as contas' : resolveAccountName(selectedAccountFilter, accounts, creditCards)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as contas</SelectItem>
                  <SelectGroup>
                    <SelectLabel>Contas</SelectLabel>
                    {accounts.map(a => (
                      <SelectItem key={a.id} value={a.id}>{resolveAccountName(a.id, accounts, creditCards)}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </ShadcnSelect>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Período</Label>
              <div className="flex p-1 bg-secondary/30 rounded-xl">
                <button 
                  onClick={() => setFilterType('month')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${filterType === 'month' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}
                >
                  Mês
                </button>
                <button 
                  onClick={() => setFilterType('range')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${filterType === 'range' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}
                >
                  Filtro
                </button>
                <button 
                  onClick={() => setFilterType('all')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${filterType === 'all' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}
                >
                  Tudo
                </button>
              </div>
            </div>

            {filterType === 'month' ? (
              <div className="space-y-2 md:col-span-3">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Mês de Referência</Label>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={handlePrevMonth} className="h-11 w-11 rounded-xl shrink-0">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Input 
                    type="month" 
                    value={selectedMonth} 
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="h-11 bg-background shadow-sm border-secondary/30 rounded-xl"
                  />
                  <Button variant="outline" size="icon" onClick={handleNextMonth} className="h-11 w-11 rounded-xl shrink-0">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : filterType === 'range' ? (
              <>
                <div className="space-y-2 md:col-span-1">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">De</Label>
                  <Input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-11 bg-background shadow-sm border-secondary/30 rounded-xl"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Até</Label>
                  <Input 
                    type="date" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-11 bg-background shadow-sm border-secondary/30 rounded-xl"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2 md:col-span-3">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider opacity-0">Tudo</Label>
                <div className="h-11 flex items-center px-4 bg-secondary/20 text-muted-foreground text-sm rounded-xl">
                  Exibindo todo o histórico
                </div>
              </div>
            )}

            <div className="space-y-2 md:col-span-4">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Busca & Tags</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  {aiSearchMode ? (
                    <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500" />
                  ) : (
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  )}
                  <Input 
                    placeholder={aiSearchMode ? "Descreva o que procura..." : "Buscar..."}
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      if (aiSearchResultIds) setAiSearchResultIds(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && aiSearchMode) {
                        e.preventDefault();
                        handleAiSearch();
                      }
                    }}
                    className={`pl-9 h-11 bg-background shadow-sm border-secondary/30 rounded-xl ${aiSearchMode ? 'ring-2 ring-amber-400/50' : ''}`}
                  />
                  {aiSearchMode && searchTerm && (
                    <button
                      type="button"
                      onClick={handleAiSearch}
                      disabled={isAiSearching}
                      className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[32px] min-h-[32px] flex items-center justify-center text-amber-600 hover:text-amber-700 disabled:opacity-50"
                    >
                      {isAiSearching ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <span className="text-xs font-bold">IR</span>
                      )}
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAiSearchMode(!aiSearchMode);
                    setAiSearchResultIds(null);
                    setSearchTerm('');
                  }}
                  className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl border transition-colors ${
                    aiSearchMode
                      ? 'bg-amber-50 border-amber-300 text-amber-600 dark:bg-amber-950 dark:border-amber-700 dark:text-amber-400'
                      : 'bg-background border-secondary/30 text-muted-foreground hover:bg-accent'
                  }`}
                  title={aiSearchMode ? 'Modo texto' : 'Busca inteligente'}
                >
                  {aiSearchMode ? <Search className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                </button>
                <div className="w-full md:w-[150px]">
                  <Select
                    isMulti
                    options={tags.map(t => ({ value: t.id, label: t.name, color: t.color }))}
                    value={tags.filter(t => selectedTagsFilter.includes(t.id)).map(t => ({ value: t.id, label: t.name, color: t.color }))}
                    onChange={(selected: MultiValue<{value: string, label: string, color: string}>) => {
                      setSelectedTagsFilter(selected.map(s => s.value));
                    }}
                    placeholder="Tags..."
                    className="text-sm"
                    menuPosition="fixed"
                    menuPortalTarget={document.body}
                    styles={{
                      control: (base) => ({
                        ...base,
                        minHeight: '44px',
                        borderRadius: '0.75rem',
                        borderColor: 'hsl(var(--secondary) / 0.3)',
                        boxShadow: 'none',
                        '&:hover': {
                          borderColor: 'hsl(var(--primary) / 0.5)'
                        }
                      }),
                      menuPortal: base => ({ ...base, zIndex: 9999 }),
                      multiValue: (base, state) => ({
                        ...base,
                        backgroundColor: state.data.color + '20',
                        borderRadius: '4px',
                      }),
                      multiValueLabel: (base, state) => ({
                        ...base,
                        color: state.data.color,
                        fontWeight: 600,
                      }),
                      multiValueRemove: (base, state) => ({
                        ...base,
                        color: state.data.color,
                        ':hover': {
                          backgroundColor: state.data.color + '40',
                          color: state.data.color,
                        },
                      }),
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-none shadow-md bg-gradient-to-br from-white to-green-50/50 dark:bg-none dark:bg-surface">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <ArrowUpRight className="h-3 w-3 text-fiducia-green" /> Receitas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-fiducia-green">
              {formatCurrency(summary.income)}
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md bg-gradient-to-br from-white to-red-50/50 dark:bg-none dark:bg-surface">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <ArrowDownRight className="h-3 w-3 text-fiducia-red" /> Despesas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-fiducia-red">
              {formatCurrency(summary.expense)}
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md bg-gradient-to-br from-white to-blue-50/50 dark:bg-none dark:bg-surface">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <ArrowRightLeft className="h-3 w-3 text-fiducia-blue" /> Saldo do Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.income - summary.expense >= 0 ? 'text-fiducia-blue' : 'text-fiducia-red'}`}>
              {formatCurrency(summary.income - summary.expense)}
            </div>
          </CardContent>
        </Card>
        {selectedAccountFilter !== 'all' && (
          <Card className="border-none shadow-md bg-gradient-to-br from-primary/5 to-primary/10 dark:bg-none dark:bg-surface">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Wallet className="h-3 w-3 text-primary" /> Saldo Atual da Conta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency((accounts.find(a => a.id === selectedAccountFilter) || creditCards.find(c => c.id === selectedAccountFilter))?.balance || 0)}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Conciliação de Lançamentos</DialogTitle>
                <DialogDescription>
                  Revise os lançamentos do arquivo antes de confirmar a importação.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4 flex-1 overflow-y-auto pr-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Conta ou Cartão de Destino</Label>
                    <ShadcnSelect value={importAccountId} onValueChange={setImportAccountId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o destino">
                          {importAccountId ? resolveAccountName(importAccountId, accounts, creditCards) : 'Selecione o destino'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Contas</SelectLabel>
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
                </div>

                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/50">
                      <tr>
                        <th className="p-2 text-left w-10"></th>
                        <th className="p-2 text-left">Data</th>
                        <th className="p-2 text-left">Descrição</th>
                        <th className="p-2 text-right">Valor</th>
                        <th className="p-2 text-left">Tipo</th>
                        <th className="p-2 text-left">Categoria</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {importedTransactions.map((t, index) => (
                        <tr key={index} className={t.selected ? '' : 'opacity-50'}>
                          <td className="p-2">
                            <input 
                              type="checkbox" 
                              checked={t.selected} 
                              onChange={(e) => {
                                const newImported = [...importedTransactions];
                                newImported[index].selected = e.target.checked;
                                setImportedTransactions(newImported);
                              }}
                            />
                          </td>
                          <td className="p-2 whitespace-nowrap">{t.date.split('T')[0].split('-').reverse().join('/')}</td>
                          <td className="p-2">
                            <div className="font-medium truncate max-w-[200px]" title={t.description}>{t.description}</div>
                            {t.memo && <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">{t.memo}</div>}
                          </td>
                          <td className={`p-2 text-right font-mono font-bold ${t.type === 'receita' ? 'text-fiducia-green' : 'text-fiducia-red'}`}>
                            {t.type === 'receita' ? '+' : '-'} {formatCurrency(t.amount)}
                          </td>
                          <td className="p-2">
                            <ShadcnSelect 
                              value={t.type} 
                              onValueChange={(val) => {
                                const newImported = [...importedTransactions];
                                newImported[index].type = val as 'receita' | 'despesa';
                                newImported[index].categoryId = '';
                                setImportedTransactions(newImported);
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="receita">Receita</SelectItem>
                                <SelectItem value="despesa">Despesa</SelectItem>
                              </SelectContent>
                            </ShadcnSelect>
                          </td>
                          <td className="p-2">
                            <ShadcnSelect 
                              value={t.categoryId} 
                              onValueChange={(val) => {
                                const newImported = [...importedTransactions];
                                newImported[index].categoryId = val;
                                setImportedTransactions(newImported);
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Categoria">
                                  {t.categoryId ? categories.find(c => c.id === t.categoryId)?.name || 'Categoria Desconhecida' : 'Categoria'}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {categories.filter(c => (!t.type || c.type === t.type)).map(cat => (
                                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </ShadcnSelect>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleImportSubmit} disabled={isImporting}>
                  {isImporting ? 'Importando...' : `Importar ${importedTransactions.filter(t => t.selected).length} lançamentos`}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isClosePeriodDialogOpen} onOpenChange={setIsClosePeriodDialogOpen}>
            <DialogTrigger render={<Button variant="outline" />}>
              <Lock className="mr-2 h-4 w-4" /> Fechar Mês
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Fechar Mês</DialogTitle>
                <DialogDescription>
                  Ao fechar um mês para uma conta, você não poderá mais adicionar, editar ou excluir lançamentos nesse período para essa conta específica.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Conta ou Cartão</Label>
                  <ShadcnSelect value={closePeriodAccountId} onValueChange={setClosePeriodAccountId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a conta">
                        {closePeriodAccountId ? resolveAccountName(closePeriodAccountId, accounts, creditCards) : 'Selecione a conta'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Contas</SelectLabel>
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
                <div className="space-y-2">
                  <Label htmlFor="closeMonth">Mês/Ano</Label>
                  <Input 
                    id="closeMonth" 
                    type="month" 
                    value={closePeriodMonth} 
                    onChange={(e) => setClosePeriodMonth(e.target.value)} 
                  />
                </div>
                {creditCards.some(cc => cc.id === closePeriodAccountId) && (
                  <div className="space-y-2">
                    <Label>Conta para Pagamento da Fatura</Label>
                    <ShadcnSelect value={closePeriodPaymentAccountId} onValueChange={setClosePeriodPaymentAccountId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a conta corrente">
                          {closePeriodPaymentAccountId ? resolveAccountName(closePeriodPaymentAccountId, accounts, creditCards) : 'Selecione a conta corrente'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Contas Correntes</SelectLabel>
                          {accounts.map(a => (
                            <SelectItem key={a.id} value={a.id}>{resolveAccountName(a.id, accounts, creditCards)}</SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </ShadcnSelect>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsClosePeriodDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleClosePeriod}>Confirmar Fechamento</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

      {isLoading ? (
        <Card className="border-none shadow-md overflow-hidden">
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground text-sm">Carregando...</p>
          </div>
        </Card>
      ) : (
      <Card className="border-none shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-secondary/30">
              <tr>
                <th className="px-3 md:px-6 py-3 md:py-4 rounded-tl-xl">Descrição</th>
                <th className="px-3 md:px-6 py-3 md:py-4">Categoria</th>
                {selectedAccountFilter === 'all' && <th className="px-3 md:px-6 py-3 md:py-4">Conta</th>}
                <th className="px-3 md:px-6 py-3 md:py-4 text-right">Valor</th>
                {selectedAccountFilter !== 'all' && <th className="px-3 md:px-6 py-3 md:py-4 text-right">Saldo</th>}
                <th className="px-3 md:px-6 py-3 md:py-4 text-right rounded-tr-xl">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary/20">
              {Object.keys(groupedTransactions).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()).map(date => (
                <React.Fragment key={date}>
                  <tr className="bg-secondary/10">
                    <td colSpan={selectedAccountFilter === 'all' ? 5 : 5} className="px-6 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      {formatDateHeader(date)}
                    </td>
                  </tr>
                  {groupedTransactions[date].map((t: any) => {
                    const accountName = resolveAccountName(t.accountId, accounts, creditCards);
                    const isCreditCard = creditCards.some(c => c.id === t.accountId);
                    const destAccount = accounts.find(a => a.id === t.destinationAccountId);
                    const category = categories.find(c => c.id === t.categoryId);
                    const isClosed = isPeriodClosed(t.date, t.accountId, creditCards, invoices, closedPeriods, t.invoicePeriod) || (t.type === 'transferencia' && t.destinationAccountId && isPeriodClosed(t.date, t.destinationAccountId, creditCards, invoices, closedPeriods, t.invoicePeriod));
                    const CategoryIcon = category ? getCategoryIcon(category.icon) : HelpCircle;

                    return (
                      <tr key={t.id} className={`group transition-colors ${isClosed ? 'bg-secondary/20 opacity-75' : 'hover:bg-secondary/30'}`}>
                        <td className="px-3 md:px-6 py-3 md:py-4">
                          <div className="flex items-center space-x-3">
                            <div className={`p-2 rounded-xl shrink-0 ${t.type === 'receita' || t.type === 'income' ? 'bg-fiducia-green-bg' : t.type === 'despesa' || t.type === 'expense' ? 'bg-fiducia-red-bg' : 'bg-fiducia-blue-bg'}`}>
                              {getIcon(t.type)}
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <p className="font-medium text-foreground">{t.description}</p>
                                <TransactionObservation observation={t.observation} />
                                {t.installmentNumber && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
                                    {t.installmentNumber}/{t.totalInstallments}
                                  </span>
                                )}
                                {t.isRecurring && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">Fixo</span>
                                )}
                                {isClosed && <Lock className="h-3 w-3 text-muted-foreground" />}
                                {t.reconciliationStatus === 'conciliado' && (
                                  <Tooltip>
                                    <TooltipTrigger render={(props) => (
                                      <CheckCircle2 {...props} className="h-3.5 w-3.5 text-green-500" />
                                    )} />
                                    <TooltipContent>Conciliado</TooltipContent>
                                  </Tooltip>
                                )}
                                {(t.status === 'pendente' || t.status === 'pending') && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">Pendente</span>
                                )}
                              </div>
                              {t.tags && t.tags.length > 0 && (
                                <div className="flex items-center gap-1 flex-wrap mt-1">
                                  {t.tags.map((tagId: string) => {
                                    const tag = tags.find(tg => tg.id === tagId);
                                    if (!tag) return null;
                                    return (
                                      <span 
                                        key={tag.id} 
                                        className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                                        style={{ backgroundColor: tag.color + '20', color: tag.color }}
                                      >
                                        {tag.name}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 md:px-6 py-3 md:py-4">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <CategoryIcon className="h-4 w-4" />
                            <span>{category?.name || 'Sem Categoria'}</span>
                          </div>
                        </td>
                        {selectedAccountFilter === 'all' && (
                          <td className="px-3 md:px-6 py-3 md:py-4">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              {isCreditCard ? <CreditCard className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
                              <span>
                                {t.type === 'transferencia' || t.type === 'transfer' 
                                  ? `${accountName} → ${destAccount?.name || 'Desconhecida'}`
                                  : accountName}
                              </span>
                            </div>
                          </td>
                        )}
                        <td className="px-3 md:px-6 py-3 md:py-4 text-right">
                          <div className={`font-semibold font-mono ${t.type === 'receita' || t.type === 'income' ? 'text-fiducia-green' : t.type === 'despesa' || t.type === 'expense' ? 'text-fiducia-red' : 'text-foreground'}`}>
                            {t.type === 'receita' || t.type === 'income' ? '+' : t.type === 'despesa' || t.type === 'expense' ? '-' : ''}R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </td>
                        {selectedAccountFilter !== 'all' && (
                          <td className="px-3 md:px-6 py-3 md:py-4 text-right">
                            <div className={`font-mono text-xs ${t.runningBalance < 0 ? 'text-fiducia-red' : 'text-muted-foreground'}`}>
                              R$ {(t.runningBalance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </td>
                        )}
                        <td className="px-3 md:px-6 py-3 md:py-4 text-right">
                          <div className="flex justify-end space-x-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            {(t.status === 'pendente' || t.status === 'pending') && (
                              <button onClick={() => handleQuickConfirm(t)} disabled={isClosed} className={`p-2 rounded-lg bg-background shadow-sm border border-secondary/30 ${isClosed ? 'cursor-not-allowed opacity-50' : 'hover:text-fiducia-green hover:border-fiducia-green/30 transition-colors'}`} title="Confirmar pagamento">
                                <CheckCircle className="h-4 w-4" />
                              </button>
                            )}
                            <button onClick={() => openTxDialog({ editId: t.id })} disabled={isClosed} className={`p-2 rounded-lg bg-background shadow-sm border border-secondary/30 ${isClosed ? 'cursor-not-allowed opacity-50' : 'hover:text-fiducia-blue hover:border-fiducia-blue/30 transition-colors'}`}>
                              <Edit className="h-4 w-4" />
                            </button>
                            <button 
                              onClick={() => {
                                if (isClosed) {
                                  toast.error('Não é possível excluir um lançamento de um mês fechado.');
                                  return;
                                }
                                setDeleteConfirmTx(t);
                              }} 
                              disabled={isClosed} 
                              className={`p-2 rounded-lg bg-background shadow-sm border border-secondary/30 ${isClosed ? 'cursor-not-allowed opacity-50' : 'hover:text-fiducia-red hover:border-fiducia-red/30 transition-colors'}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
              {processedTransactions.length === 0 && (
                <tr>
                  <td colSpan={selectedAccountFilter === 'all' ? 6 : 5} className="px-6 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="p-4 rounded-full bg-secondary/30">
                        <AlignLeft className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                      <p>Nenhum lançamento encontrado neste período.</p>
                          <Button variant="outline" onClick={() => openTxDialog()}>
                        Adicionar Lançamento
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      )}
      <Dialog open={!!deleteConfirmTx} onOpenChange={(open) => !open && setDeleteConfirmTx(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm text-muted-foreground">
            Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.
          </div>

          {(deleteConfirmTx?.parentId || deleteConfirmTx?.isRecurring || deleteConfirmTx?.installmentId) && (
            <div className="space-y-2 py-2">
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

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmTx(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
