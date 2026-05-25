import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, Account, CreditCard, Category } from '../types';
import { ArrowDownLeft, ArrowUpRight, Search, FileText, Calendar, Plus, Edit2, Trash2, CreditCard as CardIcon, Building } from 'lucide-react';
import { getInvoicePeriod, getInvoiceStatus } from '../utils/creditCardUtils';

interface StatementPageProps {
  accounts: Account[];
  creditCards: CreditCard[];
  transactions: Transaction[];
  categories: Category[];
  typeFilter?: 'account' | 'creditCard';
  onNewTransaction: (prefill: { accountId?: string; creditCardId?: string; invoicePeriod?: string }) => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
}

export function StatementPage({ 
  accounts, 
  creditCards, 
  transactions, 
  categories,
  typeFilter,
  onNewTransaction,
  onEditTransaction,
  onDeleteTransaction
}: StatementPageProps) {
  const [searchTerm, setSearchTerm] = useState('');
  
  const [targetId, setTargetId] = useState<string>('');
  const [targetType, setTargetType] = useState<'account' | 'creditCard'>('account');
  const [selectedInvoicePeriod, setSelectedInvoicePeriod] = useState<string>('');
  const [targetMonth, setTargetMonth] = useState<string>(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });

  const isCreditCard = targetType === 'creditCard';
  const account = targetType === 'account' ? accounts.find(a => a.id === targetId) : null;
  const creditCard = targetType === 'creditCard' ? creditCards.find(c => c.id === targetId) : null;
  const today = new Date();

  // Enforce type from props or URL
  useEffect(() => {
    if (typeFilter) {
      setTargetType(typeFilter);
    }
    
    const params = new URLSearchParams(window.location.search);
    const acc = params.get('account');
    const cc = params.get('card');
    const month = params.get('month');
    const invoice = params.get('invoice');

    if (typeFilter === 'account' || (!typeFilter && acc)) {
       if (acc && accounts.some(a => a.id === acc)) {
          setTargetId(acc);
       } else if (accounts.length > 0) {
          setTargetId(accounts[0].id!);
       }
       if (month) setTargetMonth(month);
    } else if (typeFilter === 'creditCard' || (!typeFilter && cc)) {
       if (cc && creditCards.some(c => c.id === cc)) {
          setTargetId(cc);
       } else if (creditCards.length > 0) {
          setTargetId(creditCards[0].id!);
       }
       if (invoice) setSelectedInvoicePeriod(invoice);
    } else {
       if (accounts.length > 0) {
          setTargetType('account');
          setTargetId(accounts[0].id!);
       } else if (creditCards.length > 0) {
          setTargetType('creditCard');
          setTargetId(creditCards[0].id!);
       }
    }
  }, [accounts, creditCards, typeFilter]); // Depends on data load and filter

  // Sync URL when state changes
  useEffect(() => {
    if (!targetId) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('account');
    url.searchParams.delete('card');
    url.searchParams.delete('month');
    url.searchParams.delete('invoice');
    
    if (targetType === 'account') {
       url.searchParams.set('account', targetId);
       if (targetMonth) url.searchParams.set('month', targetMonth);
    } else {
       url.searchParams.set('card', targetId);
       if (selectedInvoicePeriod) url.searchParams.set('invoice', selectedInvoicePeriod);
    }
    window.history.replaceState({}, '', url);
  }, [targetType, targetId, targetMonth, selectedInvoicePeriod]);


  // ----- CREDIT CARD LOGIC -----
  const ccInvoices = useMemo(() => {
    if (!isCreditCard || !creditCard) return [];
    
    const currentPeriod = getInvoicePeriod(today, creditCard.closingDay);
    const periods = new Set<string>();
    periods.add(currentPeriod);

    transactions.forEach(tx => {
      if (tx.creditCardId === creditCard.id && tx.invoicePeriod) {
        periods.add(tx.invoicePeriod);
      }
    });

    const sortedPeriods = Array.from(periods).sort((a, b) => b.localeCompare(a));
    
    return sortedPeriods.map(period => {
      const status = getInvoiceStatus(period, creditCard.closingDay, creditCard.dueDay, today);
      let total = 0;
      transactions.forEach(tx => {
        if (tx.creditCardId === creditCard.id && tx.invoicePeriod === period && tx.status !== 'cancelled') {
          if (tx.type === 'expense') total += tx.amount;
          else if (tx.type === 'income') total -= tx.amount;
        }
      });
      return { period, status, total };
    });
  }, [transactions, isCreditCard, creditCard, today]);

  useEffect(() => {
    if (isCreditCard && ccInvoices.length > 0) {
      if (!selectedInvoicePeriod || !ccInvoices.some(i => i.period === selectedInvoicePeriod)) {
         setSelectedInvoicePeriod(ccInvoices[0].period);
      }
    }
  }, [isCreditCard, ccInvoices, selectedInvoicePeriod]);

  const selectedInvoice = ccInvoices.find(inv => inv.period === selectedInvoicePeriod);

  // ----- ACCOUNT LOGIC -----
  const availableAccountMonths = useMemo(() => {
    if (isCreditCard || !account) return [];
    const months = new Set<string>();
    const current = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    months.add(current);
    
    transactions.forEach(tx => {
      if (tx.accountId === account.id || tx.destinationAccountId === account.id) {
         months.add(tx.date.substring(0, 7));
      }
    });
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [transactions, isCreditCard, account, today]);

  const accountStats = useMemo(() => {
    if (isCreditCard || !account) return null;
    
    const allTxs = transactions.filter(tx => tx.accountId === account.id || tx.destinationAccountId === account.id);
    const sortedTxs = allTxs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    let currentIterativeBalance = account.balance || 0;
    const mappedTxs = [];
    
    for (let i = sortedTxs.length - 1; i >= 0; i--) {
      const tx = sortedTxs[i];
      let type: 'in' | 'out' = 'out';
      if (tx.type === 'income') type = 'in';
      else if (tx.type === 'expense') type = 'out';
      else if (tx.type === 'transfer') {
        if (tx.destinationAccountId === account.id) type = 'in';
        else type = 'out';
      }
      
      const rowBalance = currentIterativeBalance;
      
      if (tx.status === 'paid' || tx.status === 'pago' || tx.status === 'realizado') {
        if (type === 'in') {
          currentIterativeBalance -= tx.amount;
        } else {
          currentIterativeBalance += tx.amount;
        }
      }
      mappedTxs.push({ ...tx, displayType: type, rowBalance });
    }
    
    const chronologicalMapped = mappedTxs.reverse();
    const currentMonthTxs = chronologicalMapped.filter(tx => tx.date.startsWith(targetMonth));
    
    let totalIn = 0;
    let totalOut = 0;
    currentMonthTxs.forEach(tx => {
       if (tx.status !== 'cancelled') {
         if (tx.displayType === 'in') totalIn += tx.amount;
         if (tx.displayType === 'out') totalOut += tx.amount;
       }
    });

    let initialBalance = 0;
    let finalBalance = 0;
    if (currentMonthTxs.length > 0) {
       const firstTx = currentMonthTxs[0];
       if (firstTx.status === 'paid' || firstTx.status === 'pago' || firstTx.status === 'realizado') {
           initialBalance = firstTx.displayType === 'in' 
               ? firstTx.rowBalance - firstTx.amount 
               : firstTx.rowBalance + firstTx.amount;
       } else {
           initialBalance = firstTx.rowBalance;
       }
       finalBalance = currentMonthTxs[currentMonthTxs.length - 1].rowBalance;
    } else {
       const priorTxs = chronologicalMapped.filter(tx => tx.date < targetMonth);
       if (priorTxs.length > 0) {
           initialBalance = priorTxs[priorTxs.length - 1].rowBalance;
       } else {
           initialBalance = currentIterativeBalance;
       }
       finalBalance = initialBalance;
    }
    
    currentMonthTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return { initialBalance, totalIn, totalOut, finalBalance, txs: currentMonthTxs };
  }, [transactions, account, isCreditCard, targetMonth]);


  // Output Transactions List
  const displayedTransactions = useMemo(() => {
    let list: any[] = [];
    if (isCreditCard) {
      list = transactions
        .filter(tx => tx.creditCardId === creditCard?.id && tx.invoicePeriod === selectedInvoicePeriod)
        .map(tx => {
           let type: 'in' | 'out' = tx.type === 'expense' ? 'out' : 'in';
           return { ...tx, displayType: type, rowBalance: 0 };
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } else {
      list = accountStats?.txs || [];
    }
    
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(tx => tx.description.toLowerCase().includes(q) || tx.amount.toString().includes(q));
    }
    return list;
  }, [transactions, isCreditCard, creditCard, selectedInvoicePeriod, accountStats, searchTerm]);

  // Helpers
  const formatInvoiceDates = () => {
     if (!selectedInvoicePeriod || !creditCard) return { closed: '', due: '' };
     const [year, month] = selectedInvoicePeriod.split('-').map(Number);
     const closingDate = new Date(year, month - 1, creditCard.closingDay);
     
     let dueMonth = month;
     let dueYear = year;
     if (creditCard.dueDay <= creditCard.closingDay) {
       dueMonth += 1;
       if (dueMonth > 12) { dueMonth = 1; dueYear += 1; }
     }
     const dueDate = new Date(dueYear, dueMonth - 1, creditCard.dueDay);
     
     return {
       closed: closingDate.toLocaleDateString('pt-BR'),
       due: dueDate.toLocaleDateString('pt-BR')
     };
  };

  const currentStatusBadge = (status: 'aberta'|'fechada'|'paga'|undefined) => {
    if (status === 'aberta') return <span className="bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">Aberta</span>;
    if (status === 'fechada') return <span className="bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">Fechada</span>;
    if (status === 'paga') return <span className="bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">Paga</span>;
    return null;
  };

  const formatPeriodLabel = (period: string) => {
     if(!period) return '';
     const [y, m] = period.split('-');
     const d = new Date(Number(y), Number(m) - 1, 1);
     const monthStr = d.toLocaleDateString('pt-BR', { month: 'long' });
     return `${monthStr.charAt(0).toUpperCase() + monthStr.slice(1)} ${y}`;
  };

  const invoiceDates = formatInvoiceDates();

  const handleCreateNew = () => {
    if (isCreditCard) {
      onNewTransaction({ creditCardId: creditCard?.id, invoicePeriod: selectedInvoicePeriod });
    } else {
      onNewTransaction({ accountId: account?.id });
    }
  };

  return (
    <div className="bg-card w-full rounded-2xl shadow-card flex flex-col border border-border min-h-[70vh] animate-fade-in">
      
      {/* Top Selector Bar */}
      <div className="p-4 border-b border-border bg-muted/10 flex flex-col md:flex-row items-center justify-between gap-4">
         <div className="flex items-center gap-2 w-full md:w-auto relative">
            <select
              value={`${targetType}-${targetId}`}
              onChange={(e) => {
                const parts = e.target.value.split('-');
                if (parts.length >= 2) {
                  const type = parts[0] as 'account' | 'creditCard';
                  const id = parts.slice(1).join('-');
                  setTargetType(type);
                  setTargetId(id);
                }
              }}
              className="w-full md:w-[280px] appearance-none bg-background border border-border text-foreground font-bold text-sm rounded-xl px-4 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary shadow-sm transition-shadow cursor-pointer"
            >
              {(!typeFilter || typeFilter === 'account') && accounts.length > 0 && (
                <optgroup label="Minhas Contas">
                  {accounts.map(acc => (
                    <option key={`account-${acc.id}`} value={`account-${acc.id}`}>
                      {acc.name.replace(/^\[.*?\]\s*/, '')}
                    </option>
                  ))}
                </optgroup>
              )}
              {(!typeFilter || typeFilter === 'creditCard') && creditCards.length > 0 && (
                <optgroup label="Meus Cartões">
                  {creditCards.map(cc => (
                    <option key={`creditCard-${cc.id}`} value={`creditCard-${cc.id}`}>
                      {cc.name.replace(/^\[.*?\]\s*/, '')}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
              <ArrowDownLeft size={16} className="rotate-45" />
            </div>
         </div>
         
         <button 
           onClick={handleCreateNew}
           className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-xl text-sm font-bold transition-all w-full md:w-auto justify-center shadow-sm"
         >
           <Plus size={16} />
           Novo Lançamento
         </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50 dark:bg-[#0A0A0A]">
        
        {/* Type Specific Info Bar */}
        {isCreditCard && selectedInvoice && (
           <div className="bg-background flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 border-b border-border">
              <div className="flex items-center gap-4 w-full md:w-auto">
                <select 
                   value={selectedInvoicePeriod} 
                   onChange={e => setSelectedInvoicePeriod(e.target.value)}
                   className="bg-muted/50 border border-border/80 rounded-xl px-3 h-10 text-sm font-bold text-foreground focus:ring-2 focus:ring-primary/20 w-full md:w-auto"
                >
                   {ccInvoices.map(inv => (
                      <option key={inv.period} value={inv.period}>
                         Fatura {formatPeriodLabel(inv.period)} ({inv.status.toUpperCase()})
                      </option>
                   ))}
                </select>
                {currentStatusBadge(selectedInvoice.status)}
              </div>
              
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm w-full md:w-auto">
                 <div>
                    <p className="text-muted-foreground font-medium text-xs">Fecha em</p>
                    <p className="font-bold">{invoiceDates.closed}</p>
                 </div>
                 <div>
                    <p className="text-muted-foreground font-medium text-xs">Vence em</p>
                    <p className="font-bold">{invoiceDates.due}</p>
                 </div>
                 <div className="md:ml-4 flex-1 md:flex-none flex flex-col md:items-end">
                    <p className="text-muted-foreground font-medium text-xs">Total da fatura</p>
                    <p className="text-lg font-extrabold text-rose-500">R$ {selectedInvoice.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                 </div>
              </div>
           </div>
        )}

        {!isCreditCard && accountStats && (
           <div className="bg-background flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 p-4 border-b border-border">
              <select 
                   value={targetMonth} 
                   onChange={e => setTargetMonth(e.target.value)}
                   className="bg-muted/50 border border-border/80 rounded-xl px-3 h-10 text-sm font-bold text-foreground focus:ring-2 focus:ring-primary/20 min-w-[200px] w-full xl:w-auto"
              >
                   {availableAccountMonths.map(m => (
                      <option key={m} value={m}>{formatPeriodLabel(m)}</option>
                   ))}
                   {!availableAccountMonths.includes(targetMonth) && (
                      <option value={targetMonth}>{formatPeriodLabel(targetMonth)}</option>
                   )}
              </select>
              
              <div className="flex flex-wrap items-center gap-4 xl:gap-8 w-full xl:w-auto justify-between xl:justify-end">
                 <div>
                    <p className="text-muted-foreground font-medium text-xs">Saldo Inicial do Mês</p>
                    <p className="font-bold text-sm">R$ {accountStats.initialBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                 </div>
                 <div>
                    <p className="text-emerald-600/70 dark:text-emerald-400/70 font-medium text-xs">Entradas (+)</p>
                    <p className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">R$ {accountStats.totalIn.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                 </div>
                 <div className="xl:border-r border-border pr-0 xl:pr-8">
                    <p className="text-rose-600/70 dark:text-rose-400/70 font-medium text-xs">Saídas (-)</p>
                    <p className="font-bold text-rose-600 dark:text-rose-400 text-sm">R$ {accountStats.totalOut.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                 </div>
                 <div className="w-full xl:w-auto text-right xl:text-left mt-2 xl:mt-0">
                    <p className="text-muted-foreground font-medium text-xs uppercase tracking-wider">Saldo Final do Mês</p>
                    <p className="text-lg font-extrabold text-foreground">R$ {accountStats.finalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                 </div>
              </div>
           </div>
        )}

        {/* Search */}
        <div className="p-3 border-b border-border bg-background/50">
           <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input
                type="text"
                placeholder="Filtrar lançamentos..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-background border border-border/80 h-9 rounded-lg pl-9 pr-4 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition shadow-sm"
              />
           </div>
        </div>

        {/* Transactions List */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24">
          {displayedTransactions.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
                <div className="w-16 h-16 bg-muted/50 flex items-center justify-center rounded-2xl mb-4">
                  <FileText size={32} className="opacity-40" />
                </div>
                <p className="text-sm font-medium">Nenhum lançamento encontrado neste período.</p>
                <button onClick={handleCreateNew} className="text-xs text-primary font-bold mt-2 hover:underline">Registrar novo lançamento</button>
             </div>
          ) : (
             <div className="space-y-3 max-w-5xl mx-auto">
               {displayedTransactions.map(tx => {
                  const cat = categories.find(c => c.id === tx.categoryId);
                  const isIncome = tx.displayType === 'in';
                  const amountStr = tx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                  
                  return (
                    <div key={tx.id} className={`group bg-card/90 backdrop-blur border p-4 rounded-xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:shadow-md ${
                       isIncome ? 'border-emerald-500/20 hover:border-emerald-500/40' : 'border-rose-500/20 hover:border-rose-500/40'
                    }`}>
                      <div className="flex items-start md:items-center gap-4 flex-1">
                        <div className={`p-2.5 rounded-xl shrink-0 ${isIncome ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                          {isIncome ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-foreground">
                             {tx.description}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-muted-foreground font-medium">
                             <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(tx.date).toLocaleDateString('pt-BR')}</span>
                             {cat && <span>• {cat.name}</span>}
                             {tx.accountDestinationId && <span className="text-blue-500/80">• Transferência</span>}
                             {tx.status === 'pending' || tx.status === 'pendente' ? 
                               <span className="text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded uppercase text-[9px] font-bold">Pendente</span> 
                               : null}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-none border-border pt-3 md:pt-0">
                        {/* Actions */}
                        <div className="flex items-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => onEditTransaction(tx)} className="p-1.5 text-muted-foreground hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors" title="Editar">
                              <Edit2 size={16} />
                           </button>
                           <button onClick={() => onDeleteTransaction(tx.id)} className="p-1.5 text-muted-foreground hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-md transition-colors" title="Excluir">
                              <Trash2 size={16} />
                           </button>
                        </div>
                        
                        {/* Values */}
                        <div className="flex flex-col items-end gap-1 min-w-[100px]">
                          <div className={`text-base font-extrabold ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                             {isIncome ? '+' : '-'} R$ {amountStr}
                          </div>
                          {!isCreditCard && tx.status !== 'cancelled' && (
                             <div className="text-[10px] text-muted-foreground/70 font-mono tracking-tight font-medium" title="Saldo na conta após este lançamento">
                                = R$ {tx.rowBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                             </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
               })}
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
