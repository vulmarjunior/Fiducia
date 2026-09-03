import type { Category, CreditCard, Invoice, Transaction } from '../../types';
import type { NormalizedTransaction, ReportDiagnostics } from '../../types/reports';
import { getInvoicePaymentTransactionIds } from '../invoicePayment';
import { calculateInvoicePeriod, resolveCategoryId } from '../utils';

export const toCents = (val: number): number => Math.round((Number.isFinite(val) ? val : 0) * 100);
export const fromCents = (cents: number): number => cents / 100;

export function normalizeStatus(status?: string): 'paid' | 'pending' | 'cancelled' {
  if (!status) return 'pending';
  const s = status.toLowerCase().trim();
  if (s === 'paid' || s === 'pago' || s === 'realizado') return 'paid';
  if (s === 'cancelled' || s === 'cancelado') return 'cancelled';
  return 'pending';
}

export function normalizeType(type?: string): 'income' | 'expense' | 'transfer' {
  if (!type) return 'expense';
  const t = type.toLowerCase().trim();
  if (t === 'income' || t === 'receita') return 'income';
  if (t === 'transfer' || t === 'transferencia') return 'transfer';
  return 'expense';
}

export function normalizeDate(dateStr?: string): { date: string; month: string } {
  if (!dateStr) {
    const today = new Date().toISOString().slice(0, 10);
    return { date: today, month: today.slice(0, 7) };
  }
  // Suporta YYYY-MM-DD ou ISO com T
  const clean = dateStr.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return { date: clean, month: clean.slice(0, 7) };
  }
  return { date: clean, month: clean.slice(0, 7) };
}

export function normalizeTransaction(
  tx: Transaction,
  categories: Category[],
  creditCards: CreditCard[],
  invoices: Invoice[] = [],
  paymentTxIds?: Set<string>
): NormalizedTransaction {
  const cardIds = new Set(creditCards.map(c => c.id).filter((id): id is string => Boolean(id)));
  const invoicePaymentIds = paymentTxIds || getInvoicePaymentTransactionIds(invoices);

  const isCardAccount = Boolean(tx.accountId && cardIds.has(tx.accountId));
  let isInvoicePayment = Boolean(tx.id && invoicePaymentIds.has(tx.id));
  if (!isInvoicePayment && tx.accountId && !cardIds.has(tx.accountId)) {
    if (tx.categoryId === 'Pagamento de Cartão' || /pagamento.*fatura/i.test(tx.description || '')) {
      isInvoicePayment = true;
    }
  }

  const isCard = (isCardAccount || Boolean(tx.creditCardId)) && !isInvoicePayment;
  const cardId = tx.creditCardId || (tx.accountId && cardIds.has(tx.accountId) ? tx.accountId : undefined);

  const type = normalizeType(tx.type);
  const status = normalizeStatus(tx.status);
  const { date, month } = normalizeDate(tx.date);

  let isValid = true;
  let invalidReason: string | undefined;

  const amountIsFinite = typeof tx.amount === 'number' && Number.isFinite(tx.amount);
  if (!amountIsFinite) {
    isValid = false;
    invalidReason = 'amount';
  }
  if (typeof tx.date === 'string' && tx.date && !/^\d{4}-\d{2}-\d{2}/.test(tx.date)) {
    isValid = false;
    invalidReason = invalidReason ? `${invalidReason},date` : 'date';
  }

  // Resolução da categoria
  let categoryId = tx.categoryId || '';
  if (categoryId) {
    categoryId = resolveCategoryId(categories, categoryId);
  }

  let categoryName = 'Sem categoria';
  if (!categoryId || categoryId === 'default') {
    categoryId = 'sem_categoria';
    categoryName = 'Sem categoria';
  } else {
    const cat = categories.find(c => c.id === categoryId);
    if (cat) {
      categoryName = cat.name;
    } else if (categoryId === 'Pagamento de Cartão') {
      categoryName = 'Pagamento de Cartão';
    } else {
      categoryName = 'Categoria desconhecida';
    }
  }

  const amount = amountIsFinite ? Math.abs(tx.amount as number) : 0;
  const amountCents = toCents(amount);

  // Crédito de cartão: transação em cartão que é receita (estorno/crédito)
  const isCredit = isCard && type === 'income';

  // Período da fatura: deriva pela regra canônica quando ausente e houver data e cartão suficientes
  let invoicePeriod = tx.invoicePeriod;
  if (isCard && !invoicePeriod) {
    const card = creditCards.find(c => c.id === cardId);
    if (card && typeof card.closingDay === 'number' && typeof card.dueDay === 'number' && typeof tx.date === 'string' && tx.date) {
      invoicePeriod = calculateInvoicePeriod(tx.date, card.closingDay, card.dueDay);
    }
  }

  return {
    id: tx.id || `temp-${Math.random().toString(36).slice(2, 9)}`,
    date,
    month,
    invoicePeriod,
    amountCents,
    description: tx.description || '',
    type,
    status,
    categoryId,
    categoryName,
    isCard,
    cardId,
    accountId: !isCard ? tx.accountId : undefined,
    destinationAccountId: tx.destinationAccountId,
    isInvoicePayment,
    isCredit,
    isValid,
    invalidReason,
    raw: tx,
  };
}

export function normalizeTransactions(
  transactions: Transaction[],
  categories: Category[],
  creditCards: CreditCard[],
  invoices: Invoice[] = []
): NormalizedTransaction[] {
  const paymentTxIds = getInvoicePaymentTransactionIds(invoices);
  // Cancelados permanecem na lista para diagnóstico; os relatórios os excluem explicitamente.
  return transactions.map(tx => normalizeTransaction(tx, categories, creditCards, invoices, paymentTxIds));
}

export function getReportDiagnostics(
  transactions: Transaction[],
  normalized: NormalizedTransaction[]
): ReportDiagnostics {
  const excludedCount = transactions.filter(tx => normalizeStatus(tx.status) === 'cancelled').length;
  const invalidCount = normalized.filter(tx => !tx.isValid).length;
  return { invalidCount, excludedCount };
}
