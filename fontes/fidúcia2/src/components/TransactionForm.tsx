import React, { useState, useEffect, useRef } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { Account, Category, CreditCard, Transaction, ClosedPeriod, Tag } from '../types';
import { 
  Plus, X, Tag as TagIcon, Check, Calendar, ChevronDown, Repeat, MessageSquare, Paperclip, Search, CreditCard as CardIcon, HelpCircle
} from 'lucide-react';
import { getInvoicePeriod } from '../utils/creditCardUtils';

interface TransactionFormProps {
  onClose: () => void;
  accounts: Account[];
  categories: Category[];
  creditCards: CreditCard[];
  closedPeriods?: ClosedPeriod[];
  tags: Tag[];
  onRefresh: () => void;
  editingTransaction?: Transaction | null;
  initialPrefill?: { accountId?: string; creditCardId?: string; invoicePeriod?: string; };
}

// Custom brand visual mapper for a premium feel
const getAccountVisuals = (name: string, type: string) => {
  const norm = name.toLowerCase();
  if (norm.includes('itau') || norm.includes('itaú')) {
    return { bg: 'bg-[#ec7000]/10 border-[#ec7000]/20', text: 'text-[#ec7000]', brandBg: 'bg-[#002f6c]', brandText: 'text-[#ec7000] font-black', letter: 'I' };
  }
  if (norm.includes('nubank') || norm.includes('nu ')) {
    return { bg: 'bg-[#820ad1]/10 border-[#820ad1]/20', text: 'text-[#820ad1]', brandBg: 'bg-[#820ad1]', brandText: 'text-white font-bold', letter: 'N' };
  }
  if (norm.includes('inter')) {
    return { bg: 'bg-[#ff7a00]/10 border-[#ff7a00]/20', text: 'text-[#ff7a00]', brandBg: 'bg-[#ff7a00]', brandText: 'text-white font-bold', letter: 'I' };
  }
  if (norm.includes('bradesco')) {
    return { bg: 'bg-[#cc092f]/10 border-[#cc092f]/20', text: 'text-[#cc092f]', brandBg: 'bg-[#cc092f]', brandText: 'text-white font-bold', letter: 'B' };
  }
  if (norm.includes('santander')) {
    return { bg: 'bg-[#ec0000]/10 border-[#ec0000]/20', text: 'text-[#ec0000]', brandBg: 'bg-[#ec0000]', brandText: 'text-white font-bold', letter: 'S' };
  }
  if (norm.includes('caixa')) {
    return { bg: 'bg-[#005c9e]/10 border-[#005c9e]/20', text: 'text-[#005c9e]', brandBg: 'bg-[#005c9e]', brandText: 'text-white font-bold', letter: 'C' };
  }
  if (norm.includes('c6')) {
    return { bg: 'bg-zinc-800/10 border-zinc-500/20', text: 'text-zinc-800 dark:text-zinc-200', brandBg: 'bg-[#111111]', brandText: 'text-white font-bold', letter: 'C' };
  }
  
  if (type === 'checking') {
    return { bg: 'bg-indigo-500/10 border-indigo-500/20', text: 'text-indigo-500', brandBg: 'bg-indigo-600', brandText: 'text-white font-bold', letter: 'C' };
  }
  if (type === 'savings') {
    return { bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-500', brandBg: 'bg-emerald-500', brandText: 'text-white font-bold', letter: 'P' };
  }
  if (type === 'wallet') {
    return { bg: 'bg-amber-500/10 border-amber-500/20', text: 'text-amber-500', brandBg: 'bg-amber-500', brandText: 'text-white font-bold', letter: 'D' };
  }
  return { bg: 'bg-slate-500/10 border-slate-500/20', text: 'text-slate-500', brandBg: 'bg-slate-600', brandText: 'text-white font-bold', letter: 'A' };
};

// Returns billing helper format like "Fatura de junho de 2026"
const getPortugueseInvoicePeriod = (dateStr: string, closingDay: number) => {
  if (!dateStr) return '';
  const txDate = new Date(dateStr + 'T12:00:00');
  if (isNaN(txDate.getTime())) return '';
  let year = txDate.getFullYear();
  let month = txDate.getMonth(); // 0-indexed
  
  if (txDate.getDate() > closingDay) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  const months = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  return `Fatura de ${months[month]} de ${year}`;
};

export const TransactionForm: React.FC<TransactionFormProps> = ({
  onClose,
  accounts,
  categories,
  creditCards,
  closedPeriods = [],
  tags = [],
  onRefresh,
  editingTransaction,
  initialPrefill
}) => {
  const { createTransaction, updateTransaction, createBulkTransactions, createCategory, createTag, authUser } = useFirebase();

  const [type, setType] = useState<'income' | 'expense' | 'transfer'>(
    editingTransaction 
      ? (editingTransaction.type === 'transfer' ? 'transfer' : (editingTransaction.type as any)) 
      : 'expense'
  );
  const [useCreditCard, setUseCreditCard] = useState<boolean>(!!editingTransaction?.creditCardId || !!initialPrefill?.creditCardId);
  
  const [amount, setAmount] = useState<string>(editingTransaction ? editingTransaction.amount.toString() : '');
  const [description, setDescription] = useState<string>(editingTransaction ? editingTransaction.description : '');
  const [categoryId, setCategoryId] = useState<string>(editingTransaction?.categoryId || '');
  const [accountId, setAccountId] = useState<string>(editingTransaction?.accountId || initialPrefill?.accountId || '');
  const [destinationAccountId, setDestinationAccountId] = useState<string>(editingTransaction?.destinationAccountId || '');
  const [creditCardId, setCreditCardId] = useState<string>(editingTransaction?.creditCardId || initialPrefill?.creditCardId || '');
  
  // If we have an invoice period prefill, we ideally determine a date that matches that invoice period...
  // But just defaulting to today is usually fine, or we could set it to something specifically inside that invoice
  const [date, setDate] = useState<string>(
    editingTransaction 
      ? (editingTransaction.date.includes('T') ? editingTransaction.date.substring(0, 10) : editingTransaction.date) 
      : new Date().toISOString().substring(0, 10)
  );
  const [status, setStatus] = useState<'paid' | 'pending'>(editingTransaction ? (editingTransaction.status as any) : 'paid');
  const [observation, setObservation] = useState<string>(editingTransaction?.observation || '');
  const [selectedTags, setSelectedTags] = useState<string[]>(editingTransaction?.tags || []);
  
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const TAG_COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#10b981', '#14b8a6', 
    '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e',
    '#64748b', '#71717a'
  ];
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);

  // Installments and recurring options
  const [isInstallment, setIsInstallment] = useState<boolean>(
    editingTransaction 
      ? (editingTransaction.ccRecurrenceType === 'parcelado' || (!!editingTransaction.totalInstallments && editingTransaction.totalInstallments > 1)) 
      : false
  );
  const [totalInstallments, setTotalInstallments] = useState<number>(editingTransaction?.totalInstallments || 2);

  // Bottom circular toggle sections states
  const [isRepeatOpen, setIsRepeatOpen] = useState<boolean>(
    editingTransaction 
      ? (editingTransaction.ccRecurrenceType === 'parcelado' || (!!editingTransaction.totalInstallments && editingTransaction.totalInstallments > 1)) 
      : false
  );
  const [isObsOpen, setIsObsOpen] = useState<boolean>(editingTransaction ? !!editingTransaction.observation : false);
  const [isAttachOpen, setIsAttachOpen] = useState<boolean>(false);
  const [isTagsOpen, setIsTagsOpen] = useState<boolean>(
    editingTransaction ? (!!editingTransaction.tags && editingTransaction.tags.length > 0) : false
  );

  // Quick Inline Category Creation Widget state
  const [showAddCategory, setShowAddCategory] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [newCategoryType, setNewCategoryType] = useState<'income' | 'expense'>('expense');

  // Selector dropdowns open states and refs
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState<boolean>(false);
  const [searchAccountQuery, setSearchAccountQuery] = useState<string>('');
  
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState<boolean>(false);
  const [searchCategoryQuery, setSearchCategoryQuery] = useState<string>('');

  const accountDropdownRef = useRef<HTMLDivElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(event.target as Node)) {
        setIsAccountDropdownOpen(false);
      }
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Set default account / category / card when registering a new transaction
  useEffect(() => {
    if (editingTransaction) return; // Do not override if editing
    if (accounts.length > 0 && !initialPrefill?.accountId) {
      setAccountId(prev => prev || accounts[0].id || '');
      if (accounts[1]) {
        setDestinationAccountId(prev => prev || accounts[1].id || '');
      }
    }
    const filteredCats = categories.filter(c => c.type === (type === 'transfer' ? 'expense' : type));
    if (filteredCats.length > 0) {
      setCategoryId(prev => prev || filteredCats[0].id || '');
    }
    if (creditCards.length > 0 && !initialPrefill?.creditCardId) {
      setCreditCardId(prev => prev || creditCards[0].id || '');
    }
  }, [accounts, categories, creditCards, type, editingTransaction, initialPrefill]);

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim() || !authUser) return;
    try {
      const catId = await createCategory({
        userId: authUser.uid,
        name: newCategoryName,
        type: newCategoryType,
        icon: newCategoryType === 'income' ? 'TrendingUp' : 'ShoppingBag',
        isDefault: false
      });
      setNewCategoryName('');
      setShowAddCategory(false);
      onRefresh();
      setCategoryId(catId);
    } catch (err) {
      console.error('Error creating inline category: ', err);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim() || !authUser) return;
    try {
      const tagId = await createTag({
        userId: authUser.uid,
        name: newTagName,
        color: newTagColor
      });
      setNewTagName('');
      setNewTagColor(TAG_COLORS[0]);
      setIsCreatingTag(false);
      onRefresh();
      setSelectedTags(prev => [...prev, tagId]);
    } catch (err) {
      console.error('Error creating inline tag:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0 || !description.trim()) {
      alert('Por favor, preencha o valor e a descrição.');
      return;
    }

    const txAmount = Number(amount);
    const uid = authUser?.uid || '';

    const finalDateStr = date.includes('T') ? new Date(date).toISOString() : new Date(date + 'T12:00:00').toISOString();

    // ─── CLOSED-PERIOD CONFLICT / LOCK SECURITY CHECK ───
    try {
      if (type === 'transfer') {
        const targetPeriod = date.substring(0, 7);
        if (closedPeriods.some(cp => cp.period === targetPeriod)) {
          alert(`Operação bloqueada! O período correspondente (${targetPeriod}) está fechado pela trava de segurança contábil.`);
          return;
        }
      } else if (useCreditCard && type === 'expense') {
        const card = creditCards.find(c => c.id === creditCardId);
        const cardClosingDay = card?.closingDay || 5;

        if (isInstallment && totalInstallments > 1) {
          for (let i = 1; i <= totalInstallments; i++) {
            const currentTxDate = new Date(finalDateStr);
            currentTxDate.setMonth(currentTxDate.getMonth() + i - 1);
            const invoicePeriod = getInvoicePeriod(currentTxDate, cardClosingDay);
            if (closedPeriods.some(cp => cp.period === invoicePeriod)) {
              alert(`Operação bloqueada! A parcela ${i}/${totalInstallments} cairá na fatura de (${invoicePeriod}), que está fechada na contabilidade.`);
              return;
            }
          }
        } else {
          const invoicePeriod = getInvoicePeriod(new Date(finalDateStr), cardClosingDay);
          if (closedPeriods.some(cp => cp.period === invoicePeriod)) {
            alert(`Operação bloqueada! Este lançamento de cartão cairá na fatura de (${invoicePeriod}), que já foi fechada/conciliada.`);
            return;
          }
        }
      } else {
        const targetPeriod = date.substring(0, 7);
        if (closedPeriods.some(cp => cp.period === targetPeriod)) {
          alert(`Operação bloqueada! Este período correspondente (${targetPeriod}) está fechado pela trava de segurança contábil.`);
          return;
        }
      }
    } catch (e) {
      console.error('Error validating period lock', e);
    }

    try {
      if (editingTransaction?.id) {
        const updateData: Partial<Transaction> = {
          type: type as 'income' | 'expense' | 'transfer',
          amount: txAmount,
          date: finalDateStr,
          description,
          status: useCreditCard ? 'pending' : status,
          observation: isObsOpen ? observation : '',
          tags: isTagsOpen ? selectedTags : [],
        };

        if (type === 'transfer') {
          updateData.accountId = accountId;
          updateData.destinationAccountId = destinationAccountId;
          updateData.creditCardId = null as any;
          updateData.invoicePeriod = null as any;
        } else if (useCreditCard && type === 'expense') {
          updateData.creditCardId = creditCardId;
          updateData.categoryId = categoryId;
          updateData.accountId = null as any;
          updateData.destinationAccountId = null as any;
          
          const card = creditCards.find(c => c.id === creditCardId);
          const closingDay = card?.closingDay || 5;
          
          updateData.invoicePeriod = getInvoicePeriod(new Date(finalDateStr), closingDay);
        } else {
          updateData.accountId = accountId;
          updateData.categoryId = categoryId;
          updateData.creditCardId = null as any;
          updateData.invoicePeriod = null as any;
          updateData.destinationAccountId = null as any;
        }

        await updateTransaction(editingTransaction.id, updateData);
        onRefresh();
        onClose();
        return;
      }

      if (type === 'transfer') {
        await createTransaction({
          userId: uid,
          type: 'transfer',
          amount: txAmount,
          date: finalDateStr,
          description: `Transferência: ${description}`,
          accountId,
          destinationAccountId,
          status: 'paid',
          tags: isTagsOpen ? selectedTags : [],
          observation: isObsOpen ? observation : ''
        });
      } else if (useCreditCard && type === 'expense') {
        const card = creditCards.find(c => c.id === creditCardId);
        const cardClosingDay = card?.closingDay || 5;

        if (isInstallment && totalInstallments > 1) {
          const transactionsToCreate: Omit<Transaction, 'id' | 'createdAt'>[] = [];
          const installmentId = `inst_${Date.now()}`;
          const installAmount = Number((txAmount / totalInstallments).toFixed(2));

          for (let i = 1; i <= totalInstallments; i++) {
            const currentTxDate = new Date(finalDateStr);
            currentTxDate.setMonth(currentTxDate.getMonth() + i - 1);
            
            const invoicePeriod = getInvoicePeriod(currentTxDate, cardClosingDay);

            transactionsToCreate.push({
              userId: uid,
              type: 'expense',
              amount: installAmount,
              date: currentTxDate.toISOString(),
              description: `${description} (${i}/${totalInstallments})`,
              categoryId,
              creditCardId,
              invoicePeriod,
              status: 'pending',
              installmentId,
              installmentNumber: i,
              totalInstallments,
              ccRecurrenceType: 'parcelado',
              observation: isObsOpen ? observation : '',
              tags: isTagsOpen ? selectedTags : []
            });
          }
          await createBulkTransactions(transactionsToCreate);
        } else {
          const invoicePeriod = getInvoicePeriod(new Date(finalDateStr), cardClosingDay);
          await createTransaction({
            userId: uid,
            type: 'expense',
            amount: txAmount,
            date: finalDateStr,
            description,
            categoryId,
            creditCardId,
            invoicePeriod,
            status: 'pending',
            ccRecurrenceType: 'avulso',
            observation: isObsOpen ? observation : '',
            tags: isTagsOpen ? selectedTags : []
          });
        }
      } else {
        await createTransaction({
          userId: uid,
          type: type as 'income' | 'expense',
          amount: txAmount,
          date: finalDateStr,
          description,
          categoryId,
          accountId,
          status,
          observation: isObsOpen ? observation : '',
          tags: isTagsOpen ? selectedTags : []
        });
      }

      onRefresh();
      onClose();
    } catch (err) {
      console.error('Error creating transaction: ', err);
    }
  };

  // Pre-fetching visual helpers
  const selectedCard = useCreditCard ? creditCards.find(c => c.id === creditCardId) : null;
  const selectedAccount = !useCreditCard ? accounts.find(a => a.id === accountId) : null;
  const activeSelectedDestination = useCreditCard ? selectedCard : selectedAccount;

  const selectedCategory = categories.find(c => c.id === categoryId);

  return (
    <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-card border border-border/80 w-full max-w-[480px] rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col pt-2 select-none animate-in zoom-in-95 duration-200">
        
        {/* Header containing name and minimalist cross close button */}
        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="text-xl font-bold text-foreground">
            {editingTransaction 
              ? (type === 'expense' ? 'Editar despesa' : type === 'income' ? 'Editar receita' : 'Editar transferência') 
              : (type === 'expense' ? 'Nova despesa' : type === 'income' ? 'Nova receita' : 'Nova transferência')
            }
          </h2>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1 rounded-full hover:bg-muted text-muted-foreground transition duration-150"
          >
            <X size={20} />
          </button>
        </div>

        {/* Minimal Type Switcher Bar */}
        <div className="px-6 pb-2">
          <div className="flex bg-muted/70 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => { setType('expense'); }}
              className={`flex-1 text-center py-2 text-xs font-semibold rounded-lg transition-all duration-150 ${
                type === 'expense'
                  ? 'bg-card text-foreground shadow-xs border border-border/10'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Despesa
            </button>
            <button
              type="button"
              onClick={() => { setType('income'); setUseCreditCard(false); }}
              className={`flex-1 text-center py-2 text-xs font-semibold rounded-lg transition-all duration-150 ${
                type === 'income'
                  ? 'bg-card text-foreground shadow-xs border border-border/10'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Receita
            </button>
            <button
              type="button"
              onClick={() => { setType('transfer'); setUseCreditCard(false); }}
              className={`flex-1 text-center py-2 text-xs font-semibold rounded-lg transition-all duration-150 ${
                type === 'transfer'
                  ? 'bg-card text-foreground shadow-xs border border-border/10'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Transferência
            </button>
          </div>
        </div>

        {/* Form Main Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          
          {/* Campo: Descrição */}
          <div>
            <label className="block text-xs font-bold text-muted-foreground/90 uppercase tracking-wider mb-1.5 label-desc">Descrição</label>
            <input
              type="text"
              placeholder="Ex: Aluguel, Supermercado, Salário, etc."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="w-full h-11 px-3.5 border border-border/80 bg-background text-foreground rounded-xl text-xs font-semibold transition focus:outline-none focus:ring-1 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>

          {/* Grid de 2 Colunas: Valor & Data */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-muted-foreground/90 uppercase tracking-wider mb-1.5 label-valor">Valor</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">R$</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="w-full h-11 pl-9 pr-3.5 border border-border/80 text-foreground font-bold bg-background rounded-xl text-xs transition focus:outline-none focus:ring-1 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-muted-foreground/90 uppercase tracking-wider mb-1.5 label-data">Data</label>
              <div className="relative">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full h-11 px-3.5 pr-9 border border-border/80 bg-background text-foreground rounded-xl text-xs font-semibold transition focus:outline-none focus:ring-1 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
                <Calendar size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Grid de 2 Colunas: Conta/Cartão & Categoria */}
          {type === 'transfer' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Transferência: Origem */}
              <div>
                <label className="block text-xs font-bold text-muted-foreground/90 uppercase tracking-wider mb-1.5">Origem</label>
                <select
                  value={`acc_${accountId}`}
                  onChange={(e) => {
                    const val = e.target.value.replace('acc_', '');
                    setAccountId(val);
                    setUseCreditCard(false);
                  }}
                  className="w-full h-11 px-3 border border-border/80 bg-background text-foreground rounded-xl text-xs font-semibold focus:outline-none"
                >
                  {accounts.map(acc => (
                    <option key={`orig_${acc.id}`} value={`acc_${acc.id}`}>{acc.name}</option>
                  ))}
                </select>
              </div>

              {/* Transferência: Destino */}
              <div>
                <label className="block text-xs font-bold text-muted-foreground/90 uppercase tracking-wider mb-1.5">Destino</label>
                <select
                  value={`acc_${destinationAccountId}`}
                  onChange={(e) => setDestinationAccountId(e.target.value.replace('acc_', ''))}
                  className="w-full h-11 px-3 border border-border/80 bg-background text-foreground rounded-xl text-xs font-semibold focus:outline-none"
                >
                  {accounts.filter(a => a.id !== accountId).map(acc => (
                    <option key={`dest_${acc.id}`} value={`acc_${acc.id}`}>{acc.name}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Campo: Conta/Cartão custom selector */}
              <div className="relative" ref={accountDropdownRef}>
                <label className="block text-xs font-bold text-muted-foreground/90 uppercase tracking-wider mb-1.5">Conta/Cartão</label>
                
                {/* Active Selected Card Chip exactly matching mockup style */}
                <div 
                  onClick={() => setIsAccountDropdownOpen(!isAccountDropdownOpen)}
                  className="flex items-center justify-between w-full h-11 bg-background hover:bg-muted/30 border border-border/80 px-3 py-1.5 rounded-xl text-xs cursor-pointer transition select-none"
                >
                  {activeSelectedDestination ? (() => {
                    const name = activeSelectedDestination.name;
                    const visual = getAccountVisuals(name, (activeSelectedDestination as any).type || 'checking');
                    return (
                      <div className="flex items-center gap-2 truncate">
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-[10px] shrink-0 shadow-xs ${visual.brandBg} ${visual.brandText}`}>
                          {visual.letter}
                        </div>
                        <span className="truncate font-semibold text-foreground/90">{name}</span>
                      </div>
                    );
                  })() : (
                    <span className="text-muted-foreground font-medium">Selecionar...</span>
                  )}
                  <ChevronDown size={14} className="text-muted-foreground scale-95 shrink-0" />
                </div>

                {isAccountDropdownOpen && (
                  <div className="absolute z-40 top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-xl max-h-56 overflow-y-auto animate-fadeIn duration-150">
                    <div className="p-1 px-2 border-b border-border/60 bg-muted/65">
                      <input
                        type="text"
                        placeholder="Buscar conta..."
                        value={searchAccountQuery}
                        onChange={(e) => setSearchAccountQuery(e.target.value)}
                        className="w-full px-2 py-1 bg-background border border-border/60 rounded-lg text-[10.5px] outline-none font-medium focus:border-emerald-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    
                    <div className="p-1 font-bold text-[9px] text-muted-foreground uppercase tracking-wider px-2 pt-2 pb-1">
                      Contas bancárias/carteiras
                    </div>
                    {accounts
                      .filter(acc => acc.name.toLowerCase().includes(searchAccountQuery.toLowerCase()))
                      .map(acc => {
                        const visual = getAccountVisuals(acc.name, acc.type);
                        return (
                          <div
                            key={acc.id}
                            onClick={() => {
                              setUseCreditCard(false);
                              setAccountId(acc.id || '');
                              setIsAccountDropdownOpen(false);
                            }}
                            className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted cursor-pointer transition font-medium text-foreground overflow-hidden"
                          >
                            <div className={`w-4 h-4 rounded-md flex items-center justify-center font-bold text-[8.5px] shrink-0 ${visual.brandBg} ${visual.brandText}`}>
                              {visual.letter}
                            </div>
                            <span className="truncate" title={acc.name}>{acc.name}</span>
                          </div>
                        );
                      })
                    }

                    <div className="p-1 font-bold text-[9px] text-muted-foreground uppercase tracking-wider px-2 pt-2 pb-1 border-t border-border/40">
                      Cartões de crédito
                    </div>
                    {creditCards
                      .filter(card => card.name.toLowerCase().includes(searchAccountQuery.toLowerCase()))
                      .map(card => {
                        const visual = getAccountVisuals(card.name, 'creditCard');
                        return (
                          <div
                            key={card.id}
                            onClick={() => {
                              setUseCreditCard(true);
                              setCreditCardId(card.id || '');
                              setIsAccountDropdownOpen(false);
                            }}
                            className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted cursor-pointer transition font-medium text-foreground overflow-hidden"
                          >
                            <div className={`w-4 h-4 rounded-md flex items-center justify-center font-bold text-[8.5px] shrink-0 ${visual.brandBg} ${visual.brandText}`}>
                              {visual.letter}
                            </div>
                            <span className="truncate" title={card.name}>{card.name}</span>
                          </div>
                        );
                      })
                    }
                  </div>
                )}
              </div>

              {/* Campo: Categoria custom autocomplete selector */}
              <div className="relative" ref={categoryDropdownRef}>
                <label className="block text-xs font-bold text-muted-foreground/90 uppercase tracking-wider mb-1.5">Categoria</label>
                
                <div 
                  onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                  className="flex items-center justify-between w-full h-11 bg-background hover:bg-muted/30 border border-border/80 px-3 py-1.5 rounded-xl text-xs cursor-pointer transition select-none"
                >
                  {selectedCategory ? (
                    <span className="truncate font-semibold text-foreground/95">{selectedCategory.name}</span>
                  ) : (
                    <span className="text-muted-foreground font-medium">Buscar a categoria..</span>
                  )}
                  <ChevronDown size={14} className="text-muted-foreground scale-95 shrink-0" />
                </div>

                {isCategoryDropdownOpen && (
                  <div className="absolute z-40 top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-xl max-h-56 flex flex-col overflow-hidden animate-fadeIn duration-150">
                    <div className="p-1 px-2 border-b border-border/60 bg-muted/65 flex items-center justify-between gap-1.5">
                      <input
                        type="text"
                        placeholder="Buscar categoria..."
                        value={searchCategoryQuery}
                        onChange={(e) => setSearchCategoryQuery(e.target.value)}
                        className="flex-1 px-2 py-1 bg-background border border-border/60 rounded-lg text-[10.5px] outline-none font-medium focus:border-emerald-500"
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowAddCategory(!showAddCategory);
                          setNewCategoryType(type === 'income' ? 'income' : 'expense');
                        }}
                        className="text-[10px] font-bold text-emerald-500 hover:text-emerald-600 transition tracking-tight"
                      >
                        + Criar
                      </button>
                    </div>

                    {showAddCategory && (
                      <div className="p-2 border-b border-border bg-muted/30 space-y-1.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          placeholder="Nome..."
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-border bg-background rounded-md text-foreground focus:outline-none"
                        />
                        <div className="flex justify-end gap-1 pt-0.5">
                          <button
                            type="button"
                            onClick={() => setShowAddCategory(false)}
                            className="px-1.5 py-0.5 text-[9px] hover:bg-muted rounded text-muted-foreground"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={handleCreateCategory}
                            className="px-1.5 py-0.5 text-[9px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded"
                          >
                            Adicionar
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="overflow-y-auto flex-1 h-[180px]">
                      {(() => {
                        const currentCategoryType: 'income' | 'expense' = type === 'income' ? 'income' : 'expense';
                        const typeCategories = categories.filter(c => c.type === currentCategoryType);
                        const searchQuery = searchCategoryQuery.toLowerCase().trim();
                        
                        const mainCats = typeCategories.filter(c => 
                          !c.parentId && (
                            c.name.toLowerCase().includes(searchQuery) ||
                            typeCategories.some(sub => sub.parentId === c.id && sub.name.toLowerCase().includes(searchQuery))
                          )
                        );
                        
                        const subCats = typeCategories.filter(c => 
                          c.parentId && (
                            c.name.toLowerCase().includes(searchQuery) ||
                            (typeCategories.find(p => p.id === c.parentId)?.name.toLowerCase().includes(searchQuery))
                          )
                        );

                        return (
                          <>
                            {mainCats.map(main => {
                              const children = subCats.filter(s => s.parentId === main.id);
                              return (
                                <React.Fragment key={main.id}>
                                  <div
                                    onClick={() => {
                                      setCategoryId(main.id || '');
                                      setIsCategoryDropdownOpen(false);
                                    }}
                                    className="px-3 py-1.5 text-xs hover:bg-muted font-bold text-foreground cursor-pointer transition border-b border-border/20 truncate"
                                    title={main.name}
                                  >
                                    {main.name}
                                  </div>
                                  {children.map(child => (
                                    <div
                                      key={child.id}
                                      onClick={() => {
                                        setCategoryId(child.id || '');
                                        setIsCategoryDropdownOpen(false);
                                      }}
                                      className="px-5 py-1.5 text-[11px] hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition font-medium truncate"
                                      title={child.name}
                                    >
                                      ↳ {child.name}
                                    </div>
                                  ))}
                                </React.Fragment>
                              );
                            })}
                            {mainCats.length === 0 && (
                              <p className="p-3 text-center text-muted-foreground italic text-[11px]">
                                Nenhuma categoria encontrada.
                              </p>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sub indicador de Fatura (Green caption below fields matching your visual exactly) */}
          {useCreditCard && type === 'expense' && (
            <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1 pl-0.5 animate-fadeIn duration-200">
              {getPortugueseInvoicePeriod(date, creditCards.find(c => c.id === creditCardId)?.closingDay || 5)}
            </div>
          )}

          {/* DYNAMIC TOGGLEABLE FIELDS (Toggled smoothly via the bottom buttons) */}
          <div className="space-y-3.5 pt-1">
            
            {/* Seção 🔁 Repetir */}
            {isRepeatOpen && (
              <div className="bg-muted/20 p-4 rounded-xl border border-border/80 space-y-3.5 animate-in slide-in-from-top duration-200">
                <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <span>🔁</span> Configuração de Recorrência
                </p>
                
                <div className="space-y-2.5">
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-muted-foreground hover:text-foreground select-none">
                    <input
                      type="radio"
                      name="repeatType"
                      checked={!isInstallment}
                      onChange={() => setIsInstallment(false)}
                      className="text-[#10b981] accent-[#10b981] focus:ring-[#10b981] w-4 h-4 cursor-pointer"
                    />
                    <span>é uma despesa fixa</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-muted-foreground hover:text-foreground select-none">
                    <input
                      type="radio"
                      name="repeatType"
                      checked={isInstallment}
                      onChange={() => setIsInstallment(true)}
                      className="text-[#10b981] accent-[#10b981] focus:ring-[#10b981] w-4 h-4 cursor-pointer"
                    />
                    <span>é um lançamento parcelado em</span>
                  </label>
                </div>

                {isInstallment && (
                  <div className="pt-2 space-y-2.5 animate-fadeIn">
                    <div className="flex items-center gap-2">
                      <select
                        value={totalInstallments}
                        onChange={(e) => setTotalInstallments(Math.max(2, parseInt(e.target.value, 10)))}
                        className="px-3 py-1.5 border border-border bg-background text-foreground rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
                      >
                        {[2,3,4,5,6,7,8,9,10,11,12,15,18,24,36,48,72].map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                      <span className="text-xs font-medium text-muted-foreground">Parcelas (Meses)</span>
                    </div>
                    
                    <div className="bg-emerald-500/5 border border-emerald-500/10 p-3.5 rounded-lg space-y-1">
                      <p className="text-xs font-bold text-[#10b981] dark:text-emerald-400">
                        Serão lançadas {totalInstallments} parcelas de R$ { (Number(amount || 0) / totalInstallments).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
                      </p>
                      <p className="text-[10px] text-muted-foreground leading-relaxed font-medium">
                        Em caso de divisão não exata, a sobra será somada à primeira parcela.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Seção 💬 Observação */}
            {isObsOpen && (
              <div className="space-y-1.5 animate-in slide-in-from-top duration-200">
                <label className="block text-xs font-bold text-muted-foreground/90 uppercase tracking-wider mb-1">Observações</label>
                <textarea
                  placeholder="Se necessário, adicione observações extras..."
                  value={observation}
                  onChange={(e) => setObservation(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-border/80 bg-background text-foreground rounded-xl text-xs font-semibold h-18 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 focus:border-emerald-500 resize-none"
                />
              </div>
            )}

            {/* Seção 📎 Anexo */}
            {isAttachOpen && (
              <div className="bg-muted/10 p-4 rounded-xl border border-dashed border-border/90 flex flex-col items-center justify-center py-6 text-center space-y-2 animate-in slide-in-from-top duration-200">
                <div className="p-2.5 bg-background rounded-full border border-border/60 text-muted-foreground shadow-xs shrink-0">
                  <Paperclip size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Anexar comprovante</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Clique ou arraste um comprovante aqui</p>
                </div>
                <button
                  type="button"
                  className="text-[10px] font-bold text-[#10b981] hover:underline cursor-pointer"
                  onClick={() => alert("Este é um protótipo visual de envio de arquivos para fins demonstrativos.")}
                >
                  Procurar arquivo...
                </button>
              </div>
            )}

            {/* Seção 🏷️ Tags */}
            {isTagsOpen && (
              <div className="bg-muted/10 p-4 border border-border/80 rounded-xl space-y-3 animate-in slide-in-from-top duration-200">
                <label className="block text-xs font-bold text-muted-foreground/90 uppercase tracking-wider">Selecionar Tags</label>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {tags.map(tag => {
                    const isSelected = selectedTags.includes(tag.id!);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedTags(selectedTags.filter(id => id !== tag.id));
                          } else {
                            setSelectedTags([...selectedTags, tag.id!]);
                          }
                        }}
                        className={`flex items-center gap-1.5 pl-2.5 pr-3 py-1 rounded-full text-xs font-bold border transition ${
                          isSelected ? 'shadow-xs border-transparent' : 'bg-background hover:bg-muted font-medium'
                        }`}
                        style={{ 
                          backgroundColor: isSelected ? `${tag.color}20` : undefined,
                          borderColor: isSelected ? 'transparent' : 'var(--border)',
                          color: isSelected ? tag.color : 'text-muted-foreground'
                        }}
                      >
                        <TagIcon size={9} fill={isSelected ? tag.color : "transparent"} className={isSelected ? 'opacity-90' : 'text-muted-foreground opacity-50'} />
                        <span className={isSelected ? '' : 'text-foreground'}>{tag.name}</span>
                      </button>
                    );
                  })}
                  
                  {/* Inline Creation of tag */}
                  {!isCreatingTag ? (
                    <button
                      type="button"
                      onClick={() => setIsCreatingTag(true)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border border-dashed border-border hover:bg-muted text-muted-foreground transition"
                    >
                      <Plus size={11} /> Tag
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 p-1 bg-muted/70 rounded-full border border-border">
                      <input
                        type="text"
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        placeholder="Tag..."
                        className="w-14 px-1.5 py-0.5 text-[10px] bg-background border border-border rounded-full outline-none font-semibold text-foreground"
                        autoFocus
                      />
                      <div className="flex items-center gap-0.5">
                        {TAG_COLORS.slice(0, 4).map(color => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setNewTagColor(color)}
                            className="w-3.5 h-3.5 rounded-full border border-white"
                            style={{ backgroundColor: color, borderColor: newTagColor === color ? 'var(--foreground)' : 'transparent' }}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={handleCreateTag}
                        disabled={!newTagName.trim()}
                        className="p-1 text-emerald-600 hover:bg-emerald-600/10 rounded-full disabled:opacity-50"
                      >
                        <Plus size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => { setIsCreatingTag(false); setNewTagName(''); }}
                        className="p-1 text-muted-foreground hover:bg-muted/1 w-4 h-4 rounded-full flex items-center justify-center text-[10px]"
                      >
                        x
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>

          {/* FOUR BOTTOM ROUNDED TOGGLE BUTTONS exactly matching the user inspiration picture */}
          <div className="flex items-center justify-around py-4 border-t border-border/70 mt-4 md:mt-2">
            <button
              type="button"
              onClick={() => setIsRepeatOpen(!isRepeatOpen)}
              className="flex flex-col items-center gap-1.5 focus:outline-none focus:ring-0 group cursor-pointer"
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-xs transition duration-200 ${
                isRepeatOpen 
                  ? 'bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600' 
                  : 'bg-background hover:bg-muted border-border text-muted-foreground group-hover:text-foreground'
              }`}>
                <Repeat size={18} />
              </div>
              <span className={`text-[10px] font-bold ${isRepeatOpen ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                Repetir
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsObsOpen(!isObsOpen)}
              className="flex flex-col items-center gap-1.5 focus:outline-none focus:ring-0 group cursor-pointer"
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-xs transition duration-200 ${
                isObsOpen 
                  ? 'bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600' 
                  : 'bg-background hover:bg-muted border-border text-muted-foreground group-hover:text-foreground'
              }`}>
                <MessageSquare size={18} />
              </div>
              <span className={`text-[10px] font-bold ${isObsOpen ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                Observação
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsAttachOpen(!isAttachOpen)}
              className="flex flex-col items-center gap-1.5 focus:outline-none focus:ring-0 group cursor-pointer"
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-xs transition duration-200 ${
                isAttachOpen 
                  ? 'bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600' 
                  : 'bg-background hover:bg-muted border-border text-muted-foreground group-hover:text-foreground'
              }`}>
                <Paperclip size={18} />
              </div>
              <span className={`text-[10px] font-bold ${isAttachOpen ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                Anexo
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsTagsOpen(!isTagsOpen)}
              className="flex flex-col items-center gap-1.5 focus:outline-none focus:ring-0 group cursor-pointer"
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-xs transition duration-200 ${
                isTagsOpen 
                  ? 'bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600' 
                  : 'bg-background hover:bg-muted border-border text-muted-foreground group-hover:text-foreground'
              }`}>
                <TagIcon size={18} />
              </div>
              <span className={`text-[10px] font-bold ${isTagsOpen ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                Tags
              </span>
            </button>
          </div>

          {/* LARGE GREEN CHECKMARK SUBMIT BUTTON looking exactly like mockup bottom center button */}
          <div className="flex justify-center pb-2 pt-1">
            <button
              type="submit"
              className="w-14 h-14 bg-[#10b981] text-white rounded-full flex items-center justify-center shadow-lg hover:bg-emerald-600 hover:scale-[1.03] active:scale-[0.97] transition-all focus:outline-none cursor-pointer"
              title="Salvar lançamento"
            >
              <Check size={28} strokeWidth={3} />
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
