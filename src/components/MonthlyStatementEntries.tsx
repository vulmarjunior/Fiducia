import { ArrowDownRight, ArrowUpRight, CreditCard, Landmark } from 'lucide-react';
import type { Account, Category } from '../types';
import type { MonthlyStatementEntry } from '../lib/monthlyStatement';
import { formatCurrency, parseLocalDate } from '../lib/utils';

interface MonthlyStatementEntriesProps {
  entries: MonthlyStatementEntry[];
  accounts: Account[];
  categories: Category[];
  emptyMessage: string;
  onOpenTransaction?: (id: string) => void;
}

export function MonthlyStatementEntries({ entries, accounts, categories, emptyMessage, onOpenTransaction }: MonthlyStatementEntriesProps) {
  const accountNames = new Map(accounts.map(account => [account.id, account.name]));
  const categoryNames = new Map(categories.map(category => [category.id, category.name]));

  if (entries.length === 0) {
    return <div className="py-12 text-center text-sm text-muted-foreground">{emptyMessage}</div>;
  }

  return (
    <div className="divide-y divide-border">
      {entries.map(({ transaction, kind }) => {
        const isIncome = kind === 'income';
        const isInvoice = kind === 'invoice_payment';
        const Icon = isIncome ? ArrowUpRight : isInvoice ? CreditCard : ArrowDownRight;
        const accountName = transaction.accountId ? accountNames.get(transaction.accountId) : undefined;
        const categoryName = transaction.categoryId ? categoryNames.get(transaction.categoryId) : undefined;
        const kindLabel = isIncome ? 'Receita recebida' : isInvoice ? 'Pagamento de fatura' : 'Despesa em conta';
        const content = (
          <>
            <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isIncome ? 'bg-fiducia-green/10 text-fiducia-green' : isInvoice ? 'bg-fiducia-amber/10 text-fiducia-amber' : 'bg-fiducia-red/10 text-fiducia-red'}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{transaction.description || 'Sem descrição'}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {parseLocalDate(transaction.date).toLocaleDateString('pt-BR')} · {kindLabel}
                  </p>
                </div>
                <span className={`shrink-0 font-mono text-sm font-bold ${isIncome ? 'text-fiducia-green' : 'text-fiducia-red'}`}>
                  {isIncome ? '+' : '−'} {formatCurrency(transaction.amount)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {accountName && <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground"><Landmark className="h-3 w-3" />{accountName}</span>}
                {categoryName && <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{categoryName}</span>}
              </div>
            </div>
          </>
        );

        return transaction.id && onOpenTransaction ? (
          <button key={transaction.id} type="button" onClick={() => onOpenTransaction(transaction.id!)} className="flex w-full gap-3 p-3 text-left transition-colors hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {content}
          </button>
        ) : (
          <div key={transaction.id || `${transaction.date}-${transaction.description}`} className="flex gap-3 p-3">{content}</div>
        );
      })}
    </div>
  );
}
