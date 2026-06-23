import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const APP_VERSION = '0.1.0';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function calculateInvoicePeriod(dateInput: string | Date, closingDay: number, dueDay: number) {
  // Parse date safely, assuming local timezone if YYYY-MM-DD
  let d: Date;
  if (typeof dateInput === 'string') {
    const datePart = dateInput.split('T')[0];
    d = new Date(datePart + 'T12:00:00');
  } else {
    d = dateInput;
  }
  const day = d.getDate();
  let month = d.getMonth();
  let year = d.getFullYear();

  // If purchase is strictly AFTER closing day, it goes to the NEXT closing cycle
  if (day > closingDay) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  // Now we have the closing month/year.
  // Does the due date fall in the same month as the closing date, or the next month?
  // Usually, if dueDay <= closingDay, the due date is in the NEXT month.
  // Example: Closes 25, Due 05 -> Due is next month.
  // Example: Closes 10, Due 20 -> Due is same month.
  if (dueDay <= closingDay) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  return `${year}-${(month + 1).toString().padStart(2, '0')}`;
}

export function getPreviousPeriod(period: string) {
  const [year, month] = period.split('-').map(Number);
  let prevMonth = month - 1;
  let prevYear = year;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear--;
  }
  return `${prevYear}-${prevMonth.toString().padStart(2, '0')}`;
}

export function getNextPeriod(period: string) {
  const [year, month] = period.split('-').map(Number);
  let nextMonth = month + 1;
  let nextYear = year;
  if (nextMonth === 13) {
    nextMonth = 1;
    nextYear++;
  }
  return `${nextYear}-${nextMonth.toString().padStart(2, '0')}`;
}

export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function dateToLocalISOString(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toISOString();
}

export function resolveAccountName(accountId: string | undefined, accounts: any[], creditCards: any[]) {
  if (!accountId) return 'Desconhecida';
  const account = accounts.find(a => a.id === accountId);
  if (account) return account.name;
  const card = creditCards.find(c => c.id === accountId);
  if (card) return card.name;
  return 'Desconhecida';
}

export function isEffectivelyPaid(t: any): boolean {
  return t.status === 'pago' || t.status === 'realizado' || t.status === 'paid';
}

export function isPeriodClosed(
  dateString: string,
  accountId: string,
  creditCards: any[],
  invoices: any[],
  closedPeriods: any[],
  invoicePeriod?: string
): boolean {
  const card = creditCards.find((c: any) => c.id === accountId);
  if (card) {
    const periodToCheck = invoicePeriod || calculateInvoicePeriod(dateString, card.closingDay, card.dueDay);
    const invoice = invoices.find((i: any) => i.cardId === accountId && i.period === periodToCheck);
    return invoice ? (invoice.status === 'fechada' || invoice.status === 'paga') : false;
  }
  const period = dateString.substring(0, 7);
  return closedPeriods.some((cp: any) => (cp.period === period || cp.month === period) && cp.accountId === accountId);
}

export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Calcula o efeito líquido de uma transação no saldo de uma conta específica.
 * Suporta tipos em português ('receita','despesa','transferencia') e inglês ('income','expense','transfer').
 * Retorna valor positivo para crédito, negativo para débito, 0 para irrelevante.
 */
export function projectDailyBalance(
  accounts: any[],
  transactions: any[],
  creditCards: any[],
  invoices: any[],
  days: number = 90
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const fmtDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const startingBalance = accounts
    .filter((a: any) => !a.excludeFromCashFlow)
    .reduce((sum: number, a: any) => sum + (a.balance || 0), 0);

  const dailyDeltas: Record<string, number> = {};

  const addDelta = (dateStr: string, delta: number) => {
    if (!dateStr) return;
    const d = parseLocalDate(dateStr);
    const key = d < today ? fmtDate(today) : dateStr;
    dailyDeltas[key] = (dailyDeltas[key] || 0) + delta;
  };

  const isPending = (t: any) => t.status === 'pendente' || t.status === 'pending';
  const isCardTx = (t: any) =>
    t.creditCardId || creditCards.some((c: any) => c.id === t.accountId);

  for (const tx of transactions) {
    if (!isPending(tx) || isCardTx(tx)) continue;
    if (tx.type === 'transferencia' || tx.type === 'transfer') continue;
    const dateStr = tx.date?.split('T')[0];
    if (!dateStr) continue;
    const delta = (tx.type === 'receita' || tx.type === 'income') ? tx.amount : -tx.amount;
    addDelta(dateStr, delta);
  }

  for (const card of creditCards) {
    const cardPeriods = new Set<string>();
    for (const tx of transactions) {
      if ((tx.accountId === card.id || tx.destinationAccountId === card.id) && tx.invoicePeriod) {
        cardPeriods.add(tx.invoicePeriod);
      }
    }

    for (const period of cardPeriods) {
      const paidInv = invoices.find(
        (i: any) => i.cardId === card.id && i.period === period && i.status === 'paga'
      );
      if (paidInv) continue;

      const periodTx = transactions.filter(
        (t: any) =>
          (t.accountId === card.id || t.destinationAccountId === card.id) &&
          t.invoicePeriod === period
      );
      const expenses = periodTx
        .filter((t: any) => t.type === 'expense' || t.type === 'despesa')
        .reduce((s: number, t: any) => s + t.amount, 0);
      const payments = periodTx
        .filter((t: any) => (t.type === 'transfer' || t.type === 'transferencia') && t.destinationAccountId === card.id)
        .reduce((s: number, t: any) => s + t.amount, 0);
      const incomes = periodTx
        .filter((t: any) => (t.type === 'income' || t.type === 'receita') && t.accountId === card.id)
        .reduce((s: number, t: any) => s + t.amount, 0);
      const balance = expenses - payments - incomes;

      if (balance <= 0.01) continue;

      const [pYear, pMonth] = period.split('-').map(Number);
      const dueDate = new Date(pYear, pMonth - 1, card.dueDay);
      addDelta(fmtDate(dueDate), -balance);
    }
  }

  let currentBalance = startingBalance;
  let minBalance = currentBalance;
  let minDate = fmtDate(today);
  const projection: Array<{ date: string; balance: number }> = [];

  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dateStr = fmtDate(d);
    currentBalance += (dailyDeltas[dateStr] || 0);
    if (currentBalance < minBalance) {
      minBalance = currentBalance;
      minDate = dateStr;
    }
    projection.push({ date: dateStr, balance: currentBalance });
  }

  return {
    startingBalance,
    minimumBalance: minBalance,
    minimumBalanceDate: minDate,
    isAtRisk: minBalance < 0,
    dailyProjection: projection,
  };
}

export function getTransactionEffect(
  tx: { type: string; amount: number; accountId?: string; destinationAccountId?: string },
  perspectiveAccountId: string
): number {
  const t = tx.type;
  if (t === 'receita' || t === 'income') return tx.amount;
  if (t === 'despesa' || t === 'expense') return -tx.amount;
  if (t === 'transferencia' || t === 'transfer') {
    if (tx.accountId === perspectiveAccountId) return -tx.amount;   // saindo
    if (tx.destinationAccountId === perspectiveAccountId) return tx.amount; // entrando
  }
  return 0;
}
