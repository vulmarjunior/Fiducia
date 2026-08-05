import type { Account, Category, CreditCard } from '../types';
import type { MonthlyStatement, MonthlyStatementEntry } from './monthlyStatement';

const escapeCell = (value: string | number) => {
  const text = String(value);
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const kindLabel = (entry: MonthlyStatementEntry) => {
  if (entry.kind === 'income') return 'Receita recebida';
  if (entry.kind === 'invoice_payment') return 'Pagamento de fatura';
  return 'Despesa em conta';
};

export function buildMonthlyStatementCsv(
  statement: MonthlyStatement,
  accounts: Account[],
  categories: Category[],
  creditCards: CreditCard[],
) {
  const sourceNames = new Map([...accounts, ...creditCards].map(item => [item.id, item.name]));
  const categoryNames = new Map(categories.map(category => [category.id, category.name]));
  const entries = [...statement.incomeEntries, ...statement.expenseEntries]
    .sort((a, b) => b.transaction.date.localeCompare(a.transaction.date));
  const rows = entries.map(entry => {
    const { transaction } = entry;
    const sourceId = transaction.creditCardId || transaction.accountId || transaction.destinationAccountId;
    const amount = transaction.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
    return [
      transaction.date.split('T')[0],
      kindLabel(entry),
      transaction.description || 'Sem descrição',
      transaction.categoryId ? categoryNames.get(transaction.categoryId) || 'Sem categoria' : 'Sem categoria',
      sourceId ? sourceNames.get(sourceId) || 'Origem não encontrada' : 'Sem origem',
      amount,
      transaction.status,
    ].map(escapeCell).join(';');
  });

  return [
    ['Data', 'Tipo', 'Descrição', 'Categoria', 'Conta/Cartão', 'Valor (R$)', 'Status'].join(';'),
    ...rows,
  ].join('\r\n');
}
