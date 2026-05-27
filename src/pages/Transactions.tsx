import { motion } from 'motion/react';
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, orderBy, writeBatch, runTransaction } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select as ShadcnSelect, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Switch } from '../components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger, PopoverClose } from '../components/ui/popover';
import { Plus, Trash2, Edit, ArrowUpRight, ArrowDownRight, ArrowRightLeft, Lock, FileUp, Check, X, AlertCircle, HelpCircle, CalendarIcon, Tag, Wallet, CheckCircle, AlignLeft, CreditCard, ChevronLeft, ChevronRight, Search, Repeat, MessageSquare, Paperclip, ThumbsUp, ThumbsDown, CheckCircle2, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { MoneyInput } from '../components/MoneyInput';
import { parseOfx, OfxTransaction } from '../services/ofxService';
import { parseCsvOrExcel } from '../services/importService';
import { callGroq } from '../services/groqService';
import Select, { MultiValue } from 'react-select';
import { getCategoryIcon, suggestIcon } from '../lib/categoryIcons';
import { calculateInvoicePeriod, resolveAccountName } from '../lib/utils';

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
                className="p-1 -mr-2 -mt-2 rounded-full hover:bg-white/10 transition-colors"
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
  const location = useLocation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isClosePeriodDialogOpen, setIsClosePeriodDialogOpen] = useState(false);
  const [isNewCategoryDialogOpen, setIsNewCategoryDialogOpen] = useState(false);
  const [isNewTagDialogOpen, setIsNewTagDialogOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryParentId, setNewCategoryParentId] = useState('none');
  
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

  const [formData, setFormData] = useState({ 
    type: 'despesa', 
    amount: 0, 
    date: currentDateStr, 
    description: '', 
    categoryId: '', 
    accountId: '',
    destinationAccountId: '',
    status: 'pago',
    recurrenceType: 'single',
    isRecurring: false,
    frequency: 'mensal',
    installments: 1,
    installmentsCount: '2',
    tags: [] as string[],
    tagIds: [] as string[],
    invoicePeriod: '',
    observation: '',
    ccRecurrenceType: 'avulso' as 'avulso' | 'parcelado' | 'fixo',
    billingDay: new Date().getDate().toString(),
    endDate: ''
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showRecurrence, setShowRecurrence] = useState(false);
  const [showObservation, setShowObservation] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [deleteConfirmTx, setDeleteConfirmTx] = useState<any | null>(null);
  const [deleteScope, setDeleteScope] = useState('only');
  const [closePeriodMonth, setClosePeriodMonth] = useState(currentMonthStr);
  const [closePeriodAccountId, setClosePeriodAccountId] = useState<string>('');
  const [closePeriodPaymentAccountId, setClosePeriodPaymentAccountId] = useState<string>('');

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

    // Logic to update invoice status when payment transaction status changes
    const unsubscribeStatusSync = onSnapshot(tQuery, (snapshot) => {
      const allTransactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Find invoices that might need status update
      const syncInvoices = async () => {
        for (const invoice of invoices) {
          if (invoice.paymentTransactionId) {
            const paymentTx = allTransactions.find(t => t.id === invoice.paymentTransactionId) as any;
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
    });

    return () => {
      unsubscribeT();
      unsubscribeA();
      unsubscribeC();
      unsubscribeCP();
      unsubscribeCC();
      unsubscribeTags();
      unsubscribeInv();
      unsubscribeStatusSync();
    };
  }, [user, isAuthReady]);

  useEffect(() => {
    const editId = (location.state as any)?.editId;
    if (editId && transactions.length > 0) {
      const tx = transactions.find(t => t.id === editId);
      if (tx) {
        openEdit(tx);
      }
      window.history.replaceState({}, '');
    }
  }, [location.state, transactions]);

  const isPeriodClosed = (dateString: string, accountId: string, invoicePeriod?: string) => {
    const card = creditCards.find(c => c.id === accountId);
    if (card) {
      const periodToCheck = invoicePeriod || calculateInvoicePeriod(dateString, card.closingDay, card.dueDay);
      const invoice = invoices.find(i => i.cardId === accountId && i.period === periodToCheck);
      return invoice ? (invoice.status === 'fechada' || invoice.status === 'paga') : false;
    }
    const period = dateString.substring(0, 7); // YYYY-MM
    return closedPeriods.some(cp => cp.period === period && cp.accountId === accountId);
  };

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

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newCategoryName.trim()) return;

    try {
      const categoryData: any = {
        userId: user.uid,
        name: newCategoryName.trim(),
        type: formData.type,
        icon: suggestIcon(newCategoryName.trim()),
        isDefault: false,
        createdAt: new Date().toISOString()
      };
      
      if (newCategoryParentId !== 'none') {
        categoryData.parentId = newCategoryParentId;
      }

      const docRef = await addDoc(collection(db, 'categories'), categoryData);
      
      setFormData({ ...formData, categoryId: docRef.id });
      setNewCategoryName('');
      setNewCategoryParentId('none');
      setIsNewCategoryDialogOpen(false);
      toast.success('Categoria criada com sucesso');
    } catch (error) {
      toast.error('Erro ao criar categoria');
      handleFirestoreError(error, OperationType.CREATE, 'categories');
    }
  };

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTagName.trim()) return;

    try {
      const tagData = {
        userId: user.uid,
        name: newTagName.trim(),
        color: newTagColor,
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'tags'), tagData);
      
      setFormData(prev => ({ ...prev, tags: [...prev.tags, docRef.id] }));
      setNewTagName('');
      setNewTagColor('#3b82f6');
      setIsNewTagDialogOpen(false);
      toast.success('Tag criada com sucesso');
    } catch (error) {
      toast.error('Erro ao criar tag');
      handleFirestoreError(error, OperationType.CREATE, 'tags');
    }
  };

  const renderCategoryOptions = (cats: any[], parentId: string | null = null, level: number = 0) => {
    const filtered = cats.filter(c => (c.parentId || null) === parentId);
    return filtered.map(cat => {
      const Icon = getCategoryIcon(cat.icon);
      return (
        <React.Fragment key={cat.id}>
          <SelectItem value={cat.id}>
            <div className="flex items-center gap-2">
              <span>{'\u00A0'.repeat(level * 4)}</span>
              <Icon className="h-3 w-3 opacity-70" />
              <span>{cat.name}</span>
            </div>
          </SelectItem>
          {renderCategoryOptions(cats, cat.id, level + 1)}
        </React.Fragment>
      );
    });
  };

  const getCategoryOptions = (cats: any[], parentId: string | null = null, level: number = 0): any[] => {
    const filtered = cats.filter(c => (c.parentId || null) === parentId);
    let options: any[] = [];
    filtered.forEach(cat => {
      options.push({
        value: cat.id,
        label: cat.name,
        icon: cat.icon,
        level: level
      });
      options = options.concat(getCategoryOptions(cats, cat.id, level + 1));
    });
    return options;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const amount = formData.amount;
      if (amount <= 0) {
        toast.error('O valor deve ser positivo');
        return;
      }

      if (isPeriodClosed(formData.date, formData.accountId, formData.invoicePeriod)) {
        toast.error('Este mês já está fechado para lançamentos nesta conta.');
        return;
      }

      if (formData.type === 'transferencia' && isPeriodClosed(formData.date, formData.destinationAccountId, formData.invoicePeriod)) {
        toast.error('Este mês já está fechado para lançamentos na conta de destino.');
        return;
      }

      if (formData.type !== 'transferencia' && !formData.categoryId) {
        toast.error('Selecione uma categoria');
        return;
      }

      const isCreditCard = creditCards.some(cc => cc.id === formData.accountId);
      const card = creditCards.find(cc => cc.id === formData.accountId);

      // Status logic: Credit Card is always 'realizado'
      const finalStatus = isCreditCard ? 'realizado' : formData.status;

      const baseTData: any = {
        userId: user.uid,
        type: formData.type,
        amount,
        description: formData.description,
        status: finalStatus,
        tags: formData.tagIds,
        observation: formData.observation
      };

      if (formData.type === 'transferencia') {
        if (formData.accountId === formData.destinationAccountId) {
          toast.error('As contas de origem e destino devem ser diferentes');
          return;
        }
        baseTData.accountId = formData.accountId;
        baseTData.destinationAccountId = formData.destinationAccountId;
      } else {
        baseTData.accountId = formData.accountId;
        baseTData.categoryId = formData.categoryId;
      }

      if (editingId) {
        await runTransaction(db, async (transaction) => {
          const txRef = doc(db, 'transactions', editingId);
          const txSnap = await transaction.get(txRef);
          if (!txSnap.exists()) throw new Error('Transaction not found');
          const oldT = txSnap.data() as any;

          // Compute net balance delta per account (old effect reversed + new effect applied)
          const accountDeltas: Record<string, number> = {};

          // Reverse old balance effect
          if (!creditCards.some(cc => cc.id === oldT.accountId)) {
            if (oldT.type === 'transferencia') {
              if (oldT.accountId) accountDeltas[oldT.accountId] = (accountDeltas[oldT.accountId] || 0) + oldT.amount;
              if (oldT.destinationAccountId) accountDeltas[oldT.destinationAccountId] = (accountDeltas[oldT.destinationAccountId] || 0) - oldT.amount;
            } else {
              const oldEffect = oldT.type === 'receita' ? -oldT.amount : oldT.amount;
              accountDeltas[oldT.accountId] = (accountDeltas[oldT.accountId] || 0) - oldEffect;
            }
          }

          // Apply new balance effect
          if (!isCreditCard) {
            if (formData.type === 'transferencia') {
              if (formData.accountId) accountDeltas[formData.accountId] = (accountDeltas[formData.accountId] || 0) - amount;
              if (formData.destinationAccountId) accountDeltas[formData.destinationAccountId] = (accountDeltas[formData.destinationAccountId] || 0) + amount;
            } else {
              const newEffect = formData.type === 'receita' ? -amount : amount;
              accountDeltas[formData.accountId] = (accountDeltas[formData.accountId] || 0) + newEffect;
            }
          }

          // Read all affected accounts ONCE, then apply all balance updates
          const accountSnaps: Record<string, any> = {};
          for (const accId of Object.keys(accountDeltas)) {
            if (accountDeltas[accId] === 0) continue;
            accountSnaps[accId] = await transaction.get(doc(db, 'accounts', accId));
          }
          for (const [accId, delta] of Object.entries(accountDeltas)) {
            if (delta === 0) continue;
            const snap = accountSnaps[accId];
            if (snap?.exists()) {
              transaction.update(doc(db, 'accounts', accId), { balance: (snap.data().balance || 0) + delta });
            }
          }

          const updateData: any = { 
            ...baseTData, 
            date: new Date(formData.date).toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          if (isCreditCard && card) {
            updateData.creditCardId = formData.accountId;
            updateData.invoicePeriod = formData.invoicePeriod || calculateInvoicePeriod(formData.date, card.closingDay, card.dueDay);
          }

          // Check if this transaction is a payment for an invoice
          const relatedInvoice = invoices.find(i => i.paymentTransactionId === editingId);
          if (relatedInvoice) {
            const invRef = doc(db, 'invoices', relatedInvoice.id);
            const invSnap = await transaction.get(invRef);
            if (invSnap.exists()) {
              if (formData.status === 'pago' && invSnap.data().status !== 'paga') {
                transaction.update(invRef, { status: 'paga' });
              } else if (formData.status !== 'pago' && invSnap.data().status === 'paga') {
                transaction.update(invRef, { status: 'fechada' });
              }
            }
          }

          transaction.update(txRef, updateData);
        });
        toast.success('Lançamento atualizado');
      } else {
        // Create logic
        const parentId = crypto.randomUUID();
        
        if (showRecurrence && formData.ccRecurrenceType === 'parcelado') {
          const numInstallments = parseInt(formData.installmentsCount) || 2;
          const installmentBase = Math.floor((amount / numInstallments) * 100) / 100;
          const remainder = Math.round((amount - (installmentBase * numInstallments)) * 100) / 100;

          await runTransaction(db, async (transaction) => {
            // Read balance first (Firestore requires all reads before writes)
            let accountSnap: any = null;
            if (!isCreditCard && formData.accountId) {
              accountSnap = await transaction.get(doc(db, 'accounts', formData.accountId));
            }

            for (let i = 0; i < numInstallments; i++) {
              const date = new Date(formData.date);
              date.setUTCMonth(date.getUTCMonth() + i);
              const dateStr = date.toISOString();
              
              const instAmount = i === 0 ? installmentBase + remainder : installmentBase;
              
              const tData: any = {
                ...baseTData,
                amount: instAmount,
                date: dateStr,
                createdAt: new Date().toISOString(),
                parentId,
                installmentNumber: i + 1,
                totalInstallments: numInstallments,
                description: `${formData.description} (${i + 1}/${numInstallments})`,
                ccRecurrenceType: 'parcelado',
                reconciliationStatus: 'nao_conciliado'
              };

              if (isCreditCard && card) {
                tData.creditCardId = formData.accountId;
                tData.invoicePeriod = calculateInvoicePeriod(dateStr, card.closingDay, card.dueDay);
              } else {
                tData.accountId = formData.accountId;
                tData.categoryId = formData.categoryId;
              }

              transaction.set(doc(collection(db, 'transactions')), tData);
            }

            if (accountSnap?.exists()) {
              const balanceChange = formData.type === 'receita' ? amount : -amount;
              transaction.update(doc(db, 'accounts', formData.accountId), { balance: (accountSnap.data().balance || 0) + balanceChange });
            }
          });

          toast.success(`${numInstallments} parcelas geradas com sucesso`);
        } else if (isCreditCard && card && showRecurrence && formData.ccRecurrenceType === 'fixo') {
          // FIXO LOGIC (credit card only)
          const ruleData = {
            userId: user.uid,
            accountId: formData.accountId,
            categoryId: formData.categoryId,
            amount,
            description: formData.description,
            frequency: formData.frequency,
            billingDay: parseInt(formData.billingDay),
            status: 'active',
            type: formData.type,
            tags: formData.tagIds,
            observation: formData.observation,
            createdAt: new Date().toISOString(),
            startDate: new Date(formData.date).toISOString()
          };
          const ruleRef = await addDoc(collection(db, 'recurrenceRules'), ruleData);

          const tData: any = {
            ...baseTData,
            date: new Date(formData.date).toISOString(),
            createdAt: new Date().toISOString(),
            parentId: ruleRef.id,
            creditCardId: formData.accountId,
            invoicePeriod: formData.invoicePeriod || calculateInvoicePeriod(formData.date, card.closingDay, card.dueDay),
            ccRecurrenceType: 'fixo',
            reconciliationStatus: 'nao_conciliado'
          };
          await addDoc(collection(db, 'transactions'), tData);
          toast.success('Lançamento fixo configurado');
        } else {
          // STANDARD OR RECURRING LOGIC
          const iterations = !isCreditCard && showRecurrence && formData.isRecurring 
            ? (formData.frequency === 'mensal' ? 12 : (formData.frequency === 'semanal' ? 52 : (formData.frequency === 'anual' ? 5 : 1))) 
            : 1;

          await runTransaction(db, async (transaction) => {
            // Read balances first (Firestore requires all reads before writes)
            let srcSnap: any = null;
            let destSnap: any = null;
            if (!isCreditCard && formData.accountId) {
              srcSnap = await transaction.get(doc(db, 'accounts', formData.accountId));
            }
            if (!isCreditCard && formData.type === 'transferencia' && formData.destinationAccountId) {
              destSnap = await transaction.get(doc(db, 'accounts', formData.destinationAccountId));
            }

            for (let i = 0; i < iterations; i++) {
              const date = new Date(formData.date);
              if (!isCreditCard && showRecurrence && formData.isRecurring) {
                if (formData.frequency === 'semanal') date.setUTCDate(date.getUTCDate() + (i * 7));
                else if (formData.frequency === 'mensal') date.setUTCMonth(date.getUTCMonth() + i);
                else if (formData.frequency === 'anual') date.setUTCFullYear(date.getUTCFullYear() + i);
              }
              const dateStr = date.toISOString();
              
              const tData: any = { 
                ...baseTData, 
                date: dateStr,
                createdAt: new Date().toISOString(),
                reconciliationStatus: 'nao_conciliado'
              };

              if (!isCreditCard && showRecurrence && formData.isRecurring) {
                tData.parentId = parentId;
                tData.isRecurring = true;
                tData.frequency = formData.frequency;
              }

              if (isCreditCard && card) {
                tData.creditCardId = formData.accountId;
                tData.invoicePeriod = i === 0 && formData.invoicePeriod 
                  ? formData.invoicePeriod 
                  : calculateInvoicePeriod(dateStr, card.closingDay, card.dueDay);
                tData.ccRecurrenceType = 'avulso';
              }

              transaction.set(doc(collection(db, 'transactions')), tData);
            }

            if (srcSnap?.exists()) {
              const balanceChange = formData.type === 'receita' ? amount : -amount;
              transaction.update(doc(db, 'accounts', formData.accountId), { balance: (srcSnap.data().balance || 0) + balanceChange });
            }
            if (destSnap?.exists()) {
              transaction.update(doc(db, 'accounts', formData.destinationAccountId), { balance: (destSnap.data().balance || 0) + amount });
            }
          });

          toast.success(iterations > 1 ? 'Lançamentos gerados com sucesso' : 'Lançamento adicionado');
        }
      }
      
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error('Erro ao salvar lançamento');
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'transactions');
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
      if (isPeriodClosed(tx.date, tx.accountId, tx.invoicePeriod)) {
        toast.error(`Não é possível excluir um lançamento de um mês fechado para a conta ${accounts.find(a => a.id === tx.accountId)?.name || 'desconhecida'}.`);
        return;
      }
      if (tx.type === 'transferencia' && isPeriodClosed(tx.date, tx.destinationAccountId, tx.invoicePeriod)) {
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

    // Standalone transactions: revert each individually
    for (const tx of standaloneTxs) {
      if (tx.type === 'transferencia') {
        applyChange(tx.accountId, tx.amount);
        applyChange(tx.destinationAccountId, -tx.amount);
      } else {
        applyChange(tx.accountId, tx.type === 'receita' ? -tx.amount : tx.amount);
      }
    }

    // Series: revert balance ONLY ONCE per group
    for (const [_, series] of seriesGroups) {
      const firstTx = series[0];
      const isParcelado = firstTx.installmentNumber != null && firstTx.totalInstallments != null;
      // For parcelado, reversal = sum of all installments (= original total)
      // For recurring, reversal = any single transaction's amount (all same)
      const reversalAmount = isParcelado
        ? series.reduce((sum, tx) => sum + tx.amount, 0)
        : firstTx.amount;

      if (firstTx.type === 'transferencia') {
        applyChange(firstTx.accountId, reversalAmount);
        applyChange(firstTx.destinationAccountId, -reversalAmount);
      } else {
        applyChange(firstTx.accountId, firstTx.type === 'receita' ? -reversalAmount : reversalAmount);
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

      toast.success('Lançamentos excluídos');
    } catch (error) {
      toast.error('Erro ao excluir lançamentos');
      handleFirestoreError(error, OperationType.DELETE, `transactions`);
    } finally {
      setDeleteConfirmTx(null);
      setDeleteScope('only');
    }
  };

  const resetForm = () => {
    setFormData({ 
      type: 'despesa', 
      amount: 0, 
      date: currentDateStr, 
      description: '', 
      categoryId: '', 
      accountId: '',
      destinationAccountId: '',
      status: 'pago',
      recurrenceType: 'single',
      isRecurring: false,
      frequency: 'mensal',
      installments: 1,
      installmentsCount: '2',
      tags: [],
      tagIds: [],
      invoicePeriod: '',
      observation: '',
      ccRecurrenceType: 'avulso',
      billingDay: new Date().getDate().toString(),
      endDate: ''
    });
    setEditingId(null);
    setShowRecurrence(false);
    setShowObservation(false);
    setShowTags(false);
  };

  const openEdit = (t: any) => {
    setFormData({ 
      type: t.type, 
      amount: t.amount, 
      date: t.date.split('T')[0], 
      description: t.description, 
      categoryId: t.categoryId || '', 
      accountId: t.accountId || '',
      destinationAccountId: t.destinationAccountId || '',
      status: t.status || 'pago',
      recurrenceType: t.parentId ? (t.totalInstallments ? 'installment' : 'recurring') : 'single',
      isRecurring: !!t.parentId,
      frequency: t.frequency || 'mensal',
      installments: t.totalInstallments || 1,
      installmentsCount: t.totalInstallments?.toString() || '2',
      tags: t.tags || [],
      tagIds: t.tags || [],
      invoicePeriod: t.invoicePeriod || '',
      observation: t.observation || '',
      ccRecurrenceType: t.ccRecurrenceType || (t.parentId ? (t.totalInstallments ? 'parcelado' : 'fixo') : 'avulso'),
      billingDay: t.billingDay || t.date.split('T')[0].split('-')[2],
      endDate: t.endDate || ''
    });
    setEditingId(t.id);
    setShowRecurrence(t.parentId ? true : false);
    setShowObservation(!!t.observation);
    setShowTags(t.tags && t.tags.length > 0);
    setIsDialogOpen(true);
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

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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

  const processedTransactions = React.useMemo(() => {
    let result = [...transactions];

    // 1. Calculate running balance if a specific account is selected
    if (selectedAccountFilter !== 'all') {
      const account = accounts.find(a => a.id === selectedAccountFilter) || creditCards.find(c => c.id === selectedAccountFilter);
      if (account) {
        // Sort ascending by date to calculate running balance correctly
        const accountTransactions = result
          .filter(t => t.accountId === selectedAccountFilter || t.destinationAccountId === selectedAccountFilter)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // We need to calculate backwards from the current balance
        // Wait, if we sort descending, we can start with current balance and work backwards.
        const descendingAccountTransactions = [...accountTransactions].reverse();
        let currentBalance = account.balance || 0;
        
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
      
      return matchesTags && matchesAccount && matchesDate && matchesSearch;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Final sort descending
  }, [transactions, selectedAccountFilter, selectedTagsFilter, filterType, selectedMonth, startDate, endDate, searchTerm, accounts, creditCards, aiSearchResultIds]);

  const isEffectivelyPaid = (t: any) => {
    return t.status === 'pago' || t.status === 'realizado' || t.status === 'paid';
  };

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

  const isCreditCard = creditCards.some(cc => cc.id === formData.accountId);

  const renderParceladoFields = () => (
    <>
      <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
        <div className="space-y-1.5">
          <Label htmlFor="installmentsCount" className="text-[10px] font-bold text-gray-400 uppercase">Nº de Parcelas</Label>
          <Input 
            id="installmentsCount" 
            type="number" 
            min="2" 
            value={formData.installmentsCount} 
            onChange={(e) => setFormData({...formData, installmentsCount: e.target.value})} 
            className="bg-white border-none h-10 rounded-xl"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold text-gray-400 uppercase">Valor da Parcela</Label>
          <div className="h-10 flex items-center px-3 bg-white rounded-xl text-sm font-medium text-gray-600">
            {(() => {
              const total = parseFloat(formData.amount.toString().replace(',', '.')) || 0;
              const count = parseInt(formData.installmentsCount) || 1;
              return (total / count).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            })()}
          </div>
        </div>
      </div>
      
      <div className="animate-in fade-in slide-in-from-top-2">
        {(() => {
          const total = parseFloat(formData.amount.toString().replace(',', '.')) || 0;
          const count = parseInt(formData.installmentsCount) || 2;
          if (total <= 0) return null;
          
          const installmentBase = Math.floor((total / count) * 100) / 100;
          const remainder = Math.round((total - (installmentBase * count)) * 100) / 100;
          const firstInstallment = installmentBase + remainder;
          
          return (
            <div className="p-3 bg-primary/5 rounded-xl border border-primary/10 space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-500">Parcela 1:</span>
                <span className="font-bold text-primary">{firstInstallment.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
              {count > 1 && (
                <div className="flex justify-between text-[11px]">
                  <span className="text-gray-500">Demais {count - 1} parcelas:</span>
                  <span className="font-medium text-gray-700">{installmentBase.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
              )}
              <div className="pt-1 mt-1 border-t border-primary/10 flex justify-between text-[11px] font-bold text-gray-800">
                <span>Total:</span>
                <span>{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} em {count} parcelas</span>
              </div>
            </div>
          );
        })()}
      </div>
    </>
  );

  const renderFixoFields = () => (
    <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
      <div className="space-y-1.5">
        <Label htmlFor="frequency" className="text-[10px] font-bold text-gray-400 uppercase">Frequência</Label>
        <ShadcnSelect value={formData.frequency} onValueChange={(v) => setFormData({...formData, frequency: v})}>
          <SelectTrigger className="bg-white border-none h-10 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mensal">Mensal</SelectItem>
            <SelectItem value="semanal">Semanal</SelectItem>
            <SelectItem value="anual">Anual</SelectItem>
          </SelectContent>
        </ShadcnSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="billingDay" className="text-[10px] font-bold text-gray-400 uppercase">Dia de Cobrança</Label>
        <Input 
          id="billingDay" 
          type="number" 
          min="1" 
          max="31"
          value={formData.billingDay} 
          onChange={(e) => setFormData({...formData, billingDay: e.target.value})} 
          className="bg-white border-none h-10 rounded-xl"
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h2 className="text-3xl font-bold tracking-tight">Lançamentos</h2>
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
          <Button 
            className="rounded-xl shadow-lg shadow-primary/20"
            onClick={() => {
              resetForm();
              setIsDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Novo Lançamento
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-md bg-card/50 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="space-y-2 md:col-span-3">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Conta</Label>
              <ShadcnSelect value={selectedAccountFilter} onValueChange={setSelectedAccountFilter}>
                <SelectTrigger className="h-11 bg-white shadow-sm border-secondary/30 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all rounded-xl">
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

            <div className="space-y-2 md:col-span-2">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Período</Label>
              <div className="flex p-1 bg-secondary/30 rounded-xl">
                <button 
                  onClick={() => setFilterType('month')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${filterType === 'month' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground'}`}
                >
                  Mês
                </button>
                <button 
                  onClick={() => setFilterType('range')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${filterType === 'range' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground'}`}
                >
                  Filtro
                </button>
                <button 
                  onClick={() => setFilterType('all')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${filterType === 'all' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground'}`}
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
                    className="h-11 bg-white shadow-sm border-secondary/30 rounded-xl"
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
                    className="h-11 bg-white shadow-sm border-secondary/30 rounded-xl"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Até</Label>
                  <Input 
                    type="date" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-11 bg-white shadow-sm border-secondary/30 rounded-xl"
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
                    className={`pl-9 h-11 bg-white shadow-sm border-secondary/30 rounded-xl ${aiSearchMode ? 'ring-2 ring-amber-400/50' : ''}`}
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
                      : 'bg-white border-secondary/30 text-muted-foreground hover:bg-accent'
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
        <Card className="border-none shadow-md bg-gradient-to-br from-white to-green-50/50">
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
        <Card className="border-none shadow-md bg-gradient-to-br from-white to-red-50/50">
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
        <Card className="border-none shadow-md bg-gradient-to-br from-white to-blue-50/50">
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
          <Card className="border-none shadow-md bg-gradient-to-br from-primary/5 to-primary/10">
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
                                {renderCategoryOptions(categories.filter(c => c.type === t.type))}
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

          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogContent className="w-[95vw] sm:max-w-[480px] p-0 overflow-hidden rounded-2xl border-none shadow-2xl bg-white max-h-[95vh] flex flex-col">
              <DialogHeader className="p-6 pb-0">
                <DialogTitle className="text-xl font-bold text-gray-800">
                  {editingId ? 'Editar ' : 'Nova '}
                  {formData.type === 'receita' ? 'receita' : formData.type === 'despesa' ? 'despesa' : 'transferência'}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Formulário para adicionar ou editar um lançamento financeiro.
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <Tabs value={formData.type} onValueChange={(v) => setFormData({...formData, type: v})} className="w-full">
                  <TabsList className="grid w-full grid-cols-3 bg-gray-100 p-1 rounded-xl h-11">
                    <TabsTrigger value="despesa" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-red-600 data-[state=active]:shadow-sm transition-all">Despesa</TabsTrigger>
                    <TabsTrigger value="receita" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-green-600 data-[state=active]:shadow-sm transition-all">Receita</TabsTrigger>
                    <TabsTrigger value="transferencia" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all">Transf.</TabsTrigger>
                  </TabsList>
                </Tabs>
                
                <form id="transaction-form" onSubmit={handleSubmit} className="space-y-6">
                  {/* Descrição */}
                  <div className="space-y-1.5">
                    <Label htmlFor="description" className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Descrição</Label>
                    <Input 
                      id="description" 
                      autoFocus
                      value={formData.description} 
                      onChange={(e) => setFormData({...formData, description: e.target.value})} 
                      placeholder="Ex: Supermercado, Salário..."
                      className="bg-gray-50 border-none focus:ring-2 focus:ring-primary/20 h-12 text-base rounded-xl transition-all"
                      required 
                    />
                  </div>

                  {/* Valor e Data */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <MoneyInput
                      id="amount"
                      label="Valor"
                      value={formData.amount}
                      onChange={(value) => setFormData({...formData, amount: value})}
                      required
                      className="sm:col-span-1"
                    />
                    <div className="space-y-1.5">
                      <Label htmlFor="date" className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Data</Label>
                      <Input 
                        id="date" 
                        type="date" 
                        value={formData.date} 
                        onChange={(e) => {
                          const newDate = e.target.value;
                          let newInvoicePeriod = formData.invoicePeriod;
                          const card = creditCards.find(cc => cc.id === formData.accountId);
                          let newStatus = formData.status;
                          
                          if (card) {
                            newInvoicePeriod = calculateInvoicePeriod(newDate, card.closingDay, card.dueDay);
                            newStatus = 'pago'; // Realizado
                          } else {
                            newStatus = newDate <= currentDateStr ? 'pago' : 'pendente';
                          }
                          
                          setFormData({...formData, date: newDate, invoicePeriod: newInvoicePeriod, status: newStatus});
                        }} 
                        className="bg-gray-50 border-none focus:ring-2 focus:ring-primary/20 h-12 text-base rounded-xl transition-all"
                        required 
                      />
                    </div>
                  </div>

                  {/* Conta e Categoria */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="account" className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                        {formData.type === 'transferencia' ? 'Origem' : 'Conta/Cartão'}
                      </Label>
                      <Select
                        options={[
                          ...accounts.map(a => ({ value: a.id, label: a.name, type: 'account' })),
                          ...(formData.type !== 'transferencia' ? creditCards.map(c => ({ value: c.id, label: c.name, type: 'card' })) : [])
                        ]}
                        value={[
                          ...accounts.map(a => ({ value: a.id, label: a.name, type: 'account' })),
                          ...creditCards.map(c => ({ value: c.id, label: c.name, type: 'card' }))
                        ].find(opt => opt.value === formData.accountId) || null}
                        onChange={(selected: any) => {
                          const newAccountId = selected?.value || '';
                          let newInvoicePeriod = formData.invoicePeriod;
                          let newStatus = formData.status;
                          const card = creditCards.find(cc => cc.id === newAccountId);
                          
                          if (card) {
                            newInvoicePeriod = calculateInvoicePeriod(formData.date, card.closingDay, card.dueDay);
                            newStatus = 'pago'; // Realizado
                          } else {
                            newInvoicePeriod = '';
                            newStatus = formData.date <= currentDateStr ? 'pago' : 'pendente';
                          }
                          setFormData({...formData, accountId: newAccountId, invoicePeriod: newInvoicePeriod, status: newStatus});
                        }}
                        placeholder="Selecione"
                        className="text-sm"
                        menuPosition="fixed"
                        menuPortalTarget={document.body}
                        styles={{
                          control: (base) => ({
                            ...base,
                            minHeight: '48px',
                            borderRadius: '0.75rem',
                            border: 'none',
                            backgroundColor: 'rgb(249 250 251)',
                            boxShadow: 'none',
                          }),
                          menuPortal: base => ({ ...base, zIndex: 9999 }),
                          menu: (base) => ({ ...base, zIndex: 9999, minWidth: '280px' }),
                          option: (base) => ({
                            ...base,
                            whiteSpace: 'normal',
                            wordBreak: 'break-word',
                            paddingTop: '8px',
                            paddingBottom: '8px',
                            lineHeight: '1.4'
                          })
                        }}
                      />
                      {creditCards.some(cc => cc.id === formData.accountId) && (
                        <div className="mt-2 space-y-1.5">
                          <Label htmlFor="invoicePeriod" className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Fatura</Label>
                          <Input 
                            id="invoicePeriod" 
                            type="month" 
                            value={formData.invoicePeriod} 
                            onChange={(e) => setFormData({...formData, invoicePeriod: e.target.value})} 
                            className="bg-gray-50 border-none focus:ring-2 focus:ring-primary/20 h-10 text-sm rounded-xl transition-all text-fiducia-blue font-bold"
                            required 
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      {formData.type === 'transferencia' ? (
                        <>
                          <Label htmlFor="destAccount" className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Destino</Label>
                          <Select
                            options={accounts.filter(a => a.id !== formData.accountId).map(a => ({ value: a.id, label: a.name }))}
                            value={accounts.map(a => ({ value: a.id, label: a.name })).find(opt => opt.value === formData.destinationAccountId) || null}
                            onChange={(selected: any) => setFormData({...formData, destinationAccountId: selected?.value || ''})}
                            placeholder="Destino"
                            className="text-sm"
                            menuPosition="fixed"
                            menuPortalTarget={document.body}
                            styles={{
                              control: (base) => ({
                                ...base,
                                minHeight: '48px',
                                borderRadius: '0.75rem',
                                border: 'none',
                                backgroundColor: 'rgb(249 250 251)',
                                boxShadow: 'none',
                              }),
                              menuPortal: base => ({ ...base, zIndex: 9999 }),
                              menu: (base) => ({ ...base, zIndex: 9999, minWidth: '280px' }),
                              option: (base) => ({
                                ...base,
                                whiteSpace: 'normal',
                                wordBreak: 'break-word',
                                paddingTop: '8px',
                                paddingBottom: '8px',
                                lineHeight: '1.4'
                              })
                            }}
                          />
                        </>
                      ) : (
                        <>
                          <Label htmlFor="category" className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Categoria</Label>
                          <div className="flex gap-1.5 items-center">
                            <div className="flex-1 min-w-0">
                              <Select
                                options={(() => {
                                  const opts = getCategoryOptions(categories.filter(c => c.type === formData.type));
                                  if (opts.length === 0) {
                                    opts.push({ value: 'default', label: 'Categoria Padrão', icon: 'HelpCircle', level: 0 });
                                  }
                                  return opts;
                                })()}
                                value={(() => {
                                  const opts = getCategoryOptions(categories.filter(c => c.type === formData.type));
                                  if (opts.length === 0) {
                                    opts.push({ value: 'default', label: 'Categoria Padrão', icon: 'HelpCircle', level: 0 });
                                  }
                                  return opts.find(c => c.value === formData.categoryId) || null;
                                })()}
                                onChange={(selected: any) => setFormData({...formData, categoryId: selected?.value || ''})}
                                placeholder="Buscar..."
                                isSearchable
                                menuPosition="fixed"
                                menuPortalTarget={document.body}
                                formatOptionLabel={(option: any) => {
                                  const Icon = getCategoryIcon(option.icon);
                                  return (
                                    <div className="flex items-center gap-2 overflow-hidden">
                                      <Icon className="h-3 w-3 opacity-70 shrink-0" />
                                      <span className="truncate">{option.label}</span>
                                    </div>
                                  );
                                }}
                                styles={{
                                  control: (base) => ({
                                    ...base,
                                    minHeight: '48px',
                                    borderRadius: '0.75rem',
                                    border: 'none',
                                    backgroundColor: 'rgb(249 250 251)',
                                    boxShadow: 'none',
                                  }),
                                  menuPortal: base => ({ ...base, zIndex: 9999 }),
                                  menu: (base) => ({ ...base, zIndex: 9999, minWidth: '280px' }),
                                  option: (base, { data }) => ({
                                    ...base,
                                    paddingLeft: `${(data.level * 16) + 12}px`,
                                    whiteSpace: 'normal',
                                    wordBreak: 'break-word',
                                    paddingTop: '8px',
                                    paddingBottom: '8px',
                                    lineHeight: '1.4'
                                  })
                                }}
                              />
                            </div>
                            <Button type="button" variant="outline" size="icon" onClick={() => setIsNewCategoryDialogOpen(true)} className="h-12 w-12 shrink-0 rounded-xl bg-gray-50 border-none hover:bg-gray-100 transition-all">
                              <Plus className="h-5 w-5 text-gray-400" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Barra de Ações (Ícones) */}
                  <div className="flex items-center justify-around py-4 border-y border-gray-50">
                    <button 
                      type="button" 
                      onClick={() => setShowRecurrence(!showRecurrence)}
                      className={`p-3 rounded-2xl transition-all ${showRecurrence ? 'bg-primary/10 text-primary shadow-inner' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                      title="Recorrência"
                    >
                      <Repeat className="h-6 w-6" />
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setShowObservation(!showObservation)}
                      className={`p-3 rounded-2xl transition-all ${showObservation ? 'bg-primary/10 text-primary shadow-inner' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                      title="Observação"
                    >
                      <MessageSquare className="h-6 w-6" />
                    </button>
                    <button 
                      type="button" 
                      className="p-3 rounded-2xl bg-gray-50 text-gray-200 cursor-not-allowed"
                      title="Anexo (Em breve)"
                      disabled
                    >
                      <Paperclip className="h-6 w-6" />
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setShowTags(!showTags)}
                      className={`p-3 rounded-2xl transition-all ${showTags ? 'bg-primary/10 text-primary shadow-inner' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                      title="Tags"
                    >
                      <Tag className="h-6 w-6" />
                    </button>
                  </div>

                  {/* Campos Expansíveis */}
                  <motion.div 
                    initial={false}
                    animate={{ height: showRecurrence ? 'auto' : 0, opacity: showRecurrence ? 1 : 0 }}
                    className="overflow-hidden space-y-4"
                  >
                    <div className="p-4 bg-gray-50 rounded-2xl space-y-4">
                      {isCreditCard ? (
                        <div className="space-y-4">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setFormData({...formData, ccRecurrenceType: 'parcelado'})}
                              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${formData.ccRecurrenceType === 'parcelado' ? 'bg-primary text-white shadow-lg' : 'bg-white text-gray-400 border border-gray-100'}`}
                            >
                              PARCELADO
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormData({...formData, ccRecurrenceType: 'fixo'})}
                              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${formData.ccRecurrenceType === 'fixo' ? 'bg-primary text-white shadow-lg' : 'bg-white text-gray-400 border border-gray-100'}`}
                            >
                              FIXO
                            </button>
                          </div>

                          {formData.ccRecurrenceType === 'parcelado' && renderParceladoFields()}
                          {formData.ccRecurrenceType === 'fixo' && renderFixoFields()}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setFormData({...formData, ccRecurrenceType: 'parcelado', isRecurring: false});
                              }}
                              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${formData.ccRecurrenceType === 'parcelado' ? 'bg-primary text-white shadow-lg' : 'bg-white text-gray-400 border border-gray-100'}`}
                            >
                              PARCELADO
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setFormData({...formData, ccRecurrenceType: 'avulso', isRecurring: !formData.isRecurring});
                              }}
                              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${formData.isRecurring ? 'bg-primary text-white shadow-lg' : 'bg-white text-gray-400 border border-gray-100'}`}
                            >
                              RECORRENTE
                            </button>
                          </div>

                          {formData.ccRecurrenceType === 'parcelado' && renderParceladoFields()}
                          {formData.isRecurring && (
                            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                              <div className="space-y-1.5">
                                <Label htmlFor="frequency" className="text-[10px] font-bold text-gray-400 uppercase">Frequência</Label>
                                <ShadcnSelect value={formData.frequency} onValueChange={(v) => setFormData({...formData, frequency: v})}>
                                  <SelectTrigger className="bg-white border-none h-10 rounded-xl">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="mensal">Mensal</SelectItem>
                                    <SelectItem value="semanal">Semanal</SelectItem>
                                    <SelectItem value="anual">Anual</SelectItem>
                                  </SelectContent>
                                </ShadcnSelect>
                              </div>
                              <div className="space-y-1.5">
                                <Label htmlFor="installments" className="text-[10px] font-bold text-gray-400 uppercase">Qtd. de Repetições</Label>
                                <Input 
                                  id="installments" 
                                  type="number" 
                                  min="1" 
                                  value={formData.installments} 
                                  onChange={(e) => setFormData({...formData, installments: parseInt(e.target.value)})} 
                                  className="bg-white border-none h-10 rounded-xl"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>

                  <motion.div 
                    initial={false}
                    animate={{ height: showObservation ? 'auto' : 0, opacity: showObservation ? 1 : 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 bg-gray-50 rounded-2xl space-y-1.5">
                      <div className="flex justify-between items-center">
                        <Label htmlFor="observation" className="text-[10px] font-bold text-gray-400 uppercase">Observações</Label>
                        <span className="text-[10px] text-muted-foreground">
                          {(formData.observation || '').length}/500
                        </span>
                      </div>
                      <textarea 
                        id="observation"
                        value={formData.observation || ''}
                        onChange={(e) => setFormData({...formData, observation: e.target.value})}
                        placeholder="Adicione detalhes sobre este lançamento..."
                        maxLength={500}
                        className="w-full bg-white border-none rounded-xl p-3 text-sm min-h-[80px] focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                      />
                    </div>
                  </motion.div>

                  <motion.div 
                    initial={false}
                    animate={{ height: showTags ? 'auto' : 0, opacity: showTags ? 1 : 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 bg-gray-50 rounded-2xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] font-bold text-gray-400 uppercase">Tags</Label>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setIsNewTagDialogOpen(true)} className="h-6 text-[10px] text-primary hover:text-primary/80">
                          + Nova Tag
                        </Button>
                      </div>
                      <Select
                        isMulti
                        options={tags.map(t => ({ value: t.id, label: t.name, color: t.color }))}
                        value={tags.filter(t => formData.tagIds.includes(t.id)).map(t => ({ value: t.id, label: t.name, color: t.color }))}
                        onChange={(selected: any) => setFormData({...formData, tagIds: selected ? selected.map((s: any) => s.value) : []})}
                        placeholder="Selecione as tags..."
                        className="text-sm"
                        menuPosition="fixed"
                        menuPortalTarget={document.body}
                        styles={{
                          control: (base) => ({
                            ...base,
                            minHeight: '40px',
                            borderRadius: '0.75rem',
                            border: 'none',
                            backgroundColor: 'white',
                            boxShadow: 'none',
                          }),
                          menuPortal: base => ({ ...base, zIndex: 9999 }),
                          menu: (base) => ({ ...base, zIndex: 9999, minWidth: '280px' }),
                          option: (base) => ({
                            ...base,
                            whiteSpace: 'normal',
                            wordBreak: 'break-word',
                            paddingTop: '8px',
                            paddingBottom: '8px',
                            lineHeight: '1.4'
                          })
                        }}
                      />
                    </div>
                  </motion.div>

                  {/* Status do Lançamento (Apenas para Caixa/Conta Corrente) */}
                  {!creditCards.some(cc => cc.id === formData.accountId) && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100/50">
                      <div className="flex flex-col">
                        <Label className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">Status</Label>
                        <span className="text-xs font-semibold text-gray-600">
                          {formData.status === 'pago' 
                            ? (formData.type === 'receita' ? 'Recebido' : 'Pago') 
                            : 'Pendente'}
                        </span>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setFormData({...formData, status: 'pago'})}
                          className={`p-2 rounded-lg transition-all ${
                            formData.status === 'pago' 
                              ? 'bg-green-100 text-green-600 shadow-sm' 
                              : 'bg-white text-gray-300 hover:text-gray-400 border border-gray-100'
                          }`}
                          title={formData.type === 'receita' ? 'Recebido' : 'Pago'}
                        >
                          <ThumbsUp className={`h-4 w-4 ${formData.status === 'pago' ? 'fill-current' : ''}`} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({...formData, status: 'pendente'})}
                          className={`p-2 rounded-lg transition-all ${
                            formData.status === 'pendente' 
                              ? 'bg-amber-100 text-amber-500 shadow-sm' 
                              : 'bg-white text-gray-300 hover:text-gray-400 border border-gray-100'
                          }`}
                          title="Pendente"
                        >
                          <ThumbsDown className={`h-4 w-4 ${formData.status === 'pendente' ? 'fill-current' : ''}`} />
                        </button>
                      </div>
                    </div>
                  )}
                </form>
              </div>

              <div className="p-6 pt-2 flex items-center justify-between gap-4 bg-white border-t border-gray-50">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => setIsDialogOpen(false)}
                  className="flex-1 h-14 rounded-2xl text-gray-400 font-semibold hover:bg-gray-50 transition-all"
                >
                  Cancelar
                </Button>
                <Button 
                  form="transaction-form"
                  type="submit" 
                  className={`flex-[2] h-14 rounded-2xl font-bold text-white shadow-xl transition-all active:scale-[0.98] ${
                    formData.type === 'despesa' ? 'bg-red-600 shadow-red-100' : 
                    formData.type === 'receita' ? 'bg-green-600 shadow-green-100' : 'bg-blue-600 shadow-blue-100'
                  }`}
                >
                  {editingId ? 'Atualizar' : 'Salvar'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

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
                    const isClosed = isPeriodClosed(t.date, t.accountId, t.invoicePeriod) || (t.type === 'transferencia' && t.destinationAccountId && isPeriodClosed(t.date, t.destinationAccountId, t.invoicePeriod));
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
                            <button onClick={() => openEdit(t)} disabled={isClosed} className={`p-2 rounded-lg bg-white shadow-sm border border-secondary/30 ${isClosed ? 'cursor-not-allowed opacity-50' : 'hover:text-fiducia-blue hover:border-fiducia-blue/30 transition-colors'}`}>
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
                              className={`p-2 rounded-lg bg-white shadow-sm border border-secondary/30 ${isClosed ? 'cursor-not-allowed opacity-50' : 'hover:text-fiducia-red hover:border-fiducia-red/30 transition-colors'}`}
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
                      <Button variant="outline" onClick={() => { resetForm(); setIsDialogOpen(true); }}>
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

      {/* Nova Categoria Dialog */}
      <Dialog open={isNewCategoryDialogOpen} onOpenChange={setIsNewCategoryDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Nova Categoria</DialogTitle>
            <DialogDescription>
              Crie uma nova categoria para organizar seus lançamentos.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateCategory} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newCategoryName">Nome da Categoria</Label>
              <Input 
                id="newCategoryName" 
                value={newCategoryName} 
                onChange={(e) => setNewCategoryName(e.target.value)} 
                placeholder="Ex: Alimentação, Transporte"
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newCategoryParent">Categoria Pai (Opcional)</Label>
              <ShadcnSelect value={newCategoryParentId} onValueChange={setNewCategoryParentId}>
                <SelectTrigger id="newCategoryParent">
                  <SelectValue placeholder="Selecione uma categoria pai" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {categories.filter(c => c.type === formData.type && !c.parentId).map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </ShadcnSelect>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsNewCategoryDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-fiducia-blue hover:bg-fiducia-blue/90">
                Criar Categoria
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Nova Tag Dialog */}
      <Dialog open={isNewTagDialogOpen} onOpenChange={setIsNewTagDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Nova Tag</DialogTitle>
            <DialogDescription>
              Crie uma nova tag para rotular seus lançamentos.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTag} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newTagName">Nome da Tag</Label>
              <Input 
                id="newTagName" 
                value={newTagName} 
                onChange={(e) => setNewTagName(e.target.value)} 
                placeholder="Ex: Urgente, Lazer"
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newTagColor">Cor da Tag</Label>
              <div className="flex gap-2">
                <Input 
                  id="newTagColor" 
                  type="color"
                  value={newTagColor} 
                  onChange={(e) => setNewTagColor(e.target.value)} 
                  className="w-12 h-10 p-1 rounded-md"
                />
                <Input 
                  value={newTagColor} 
                  onChange={(e) => setNewTagColor(e.target.value)} 
                  placeholder="#000000"
                  className="flex-1"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsNewTagDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-fiducia-blue hover:bg-fiducia-blue/90">
                Criar Tag
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
