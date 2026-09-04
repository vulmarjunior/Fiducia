export function getInvoicePeriod(
  purchaseDate: Date,
  closingDay: number
): string {
  const day = purchaseDate.getDate();
  const month = purchaseDate.getMonth();
  const year = purchaseDate.getFullYear();

  if (day <= closingDay) {
    const invoiceMonth = month + 1;
    return `${year}-${String(invoiceMonth).padStart(2, '0')}`;
  } else {
    let invoiceMonth = month + 2;
    let invoiceYear = year;
    if (invoiceMonth > 12) {
      invoiceMonth = 1;
      invoiceYear += 1;
    }
    return `${invoiceYear}-${String(invoiceMonth).padStart(2, '0')}`;
  }
}

export function getInvoiceStatus(
  invoicePeriod: string,
  closingDay: number,
  dueDay: number,
  today: Date
): 'aberta' | 'fechada' | 'paga' {
  const [year, month] = invoicePeriod.split('-').map(Number);

  const closingDate = new Date(year, month - 1, closingDay);

  let dueMonth = month;
  let dueYear = year;
  if (dueDay <= closingDay) {
    dueMonth += 1;
    if (dueMonth > 12) { dueMonth = 1; dueYear += 1; }
  }
  const dueDate = new Date(dueYear, dueMonth - 1, dueDay);

  if (today < closingDate) return 'aberta';
  if (today < dueDate) return 'fechada';
  return 'paga';
}

/** Calcula somente o crédito ainda comprometido, sem somar faturas totalmente pagas. */
export function calculateCreditLimitUsage(
  cardId: string,
  transactions: any[],
  invoices: any[],
): number {
  const cardTransactions = transactions.filter((tx: any) =>
    tx.creditCardId === cardId || tx.accountId === cardId || tx.destinationAccountId === cardId,
  );
  const periods = new Set<string>();

  for (const tx of cardTransactions) {
    if (typeof tx.invoicePeriod === 'string' && tx.invoicePeriod) periods.add(tx.invoicePeriod);
  }
  for (const invoice of invoices) {
    if (invoice.cardId === cardId && typeof invoice.period === 'string' && invoice.period) periods.add(invoice.period);
  }

  let usage = 0;
  for (const period of periods) {
    const periodTransactions = cardTransactions.filter((tx: any) => tx.invoicePeriod === period);
    const calculatedTotal = periodTransactions.reduce((total: number, tx: any) => {
      const amount = Number(tx.amount) || 0;
      if (tx.type === 'expense' || tx.type === 'despesa') return total + amount;
      if (tx.type === 'income' || tx.type === 'receita') return total - amount;
      if ((tx.type === 'transfer' || tx.type === 'transferencia') && tx.destinationAccountId === cardId) return total - amount;
      return total;
    }, 0);
    const invoice = invoices.find((item: any) => item.cardId === cardId && item.period === period);
    const remaining = invoice
      ? getInvoiceFinancialSummary(invoice, calculatedTotal).remainingAmount
      : Math.max(0, calculatedTotal);
    usage += Math.max(0, remaining);
  }

  return Math.max(0, Math.round(usage * 100) / 100);
}
import { getInvoiceFinancialSummary } from '../lib/invoicePayment';
