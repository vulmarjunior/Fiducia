export type CashCoverageSource =
  | 'bank_income'
  | 'bank_expense'
  | 'invoice_closed'
  | 'invoice_open'
  | 'card_future'
  | 'recurrence';

export type CashCoverageCertainty = 'confirmed' | 'expected' | 'projected';

export interface CashCoverageEvent {
  id: string;
  date: string;
  originalDate: string;
  month: string;
  amount: number;
  direction: 'in' | 'out';
  source: CashCoverageSource;
  certainty: CashCoverageCertainty;
  status: 'overdue' | 'due' | 'future';
  label: string;
  categoryId?: string;
  accountId?: string;
  cardId?: string;
  invoiceId?: string;
  invoicePeriod?: string;
  transactionId?: string;
  raw?: any;
}

export interface CashCoverageDay {
  date: string;
  startingBalance: number;
  income: number;
  expense: number;
  endingBalance: number;
  events: CashCoverageEvent[];
}

export interface CashCoverageMonth {
  month: string;
  label: string;
  shortLabel: string;
  incomeTotal: number;
  expenseTotal: number;
  invoiceTotal: number;
  net: number;
  accum: number;
  incomeEvents: CashCoverageEvent[];
  expenseEvents: CashCoverageEvent[];
  invoiceEvents: CashCoverageEvent[];
}

export interface CashCoverageProjection {
  startingBalance: number;
  endingBalance: number;
  minimumBalance: number;
  minimumBalanceDate: string;
  firstRiskDate: string | null;
  isAtRisk: boolean;
  totalIncome: number;
  totalObligations: number;
  totalBankExpenses: number;
  totalInvoices: number;
  totalClosedInvoices: number;
  totalOpenInvoices: number;
  totalFutureCard: number;
  coverageBalance: number;
  events: CashCoverageEvent[];
  dailyProjection: CashCoverageDay[];
  monthlyProjection: CashCoverageMonth[];
}

export interface CashCoverageOptions {
  startDate?: Date | string;
  endDate?: Date | string;
  days?: number;
  includeSavings?: boolean;
}

const isIncome = (t: any) => t.type === 'receita' || t.type === 'income';
const isExpense = (t: any) => t.type === 'despesa' || t.type === 'expense';
const isTransfer = (t: any) => t.type === 'transferencia' || t.type === 'transfer';
const isPending = (t: any) => t.status === 'pendente' || t.status === 'pending';

export const formatLocalDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const monthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

const parseDate = (value?: Date | string) => {
  if (!value) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }
  if (value instanceof Date) {
    const d = new Date(value);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const datePart = value.split('T')[0];
  const [year, month, day] = datePart.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const addDays = (date: Date, days: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const invoiceDueDate = (period: string, dueDay: number) => {
  const [year, month] = period.split('-').map(Number);
  return new Date(year, month - 1, dueDay);
};


const currentInvoicePeriod = (date: Date, closingDay: number, dueDay: number) => {
  let month = date.getMonth();
  let year = date.getFullYear();
  if (date.getDate() > closingDay) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  if (dueDay <= closingDay) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return `${year}-${String(month + 1).padStart(2, '0')}`;
};
const invoiceClosingDate = (period: string, closingDay: number, dueDay: number) => {
  const [year, month] = period.split('-').map(Number);
  let closingMonth = month - 1;
  let closingYear = year;
  if (dueDay <= closingDay) {
    closingMonth -= 1;
    if (closingMonth < 0) {
      closingMonth = 11;
      closingYear -= 1;
    }
  }
  return new Date(closingYear, closingMonth, closingDay);
};

const clampEventDate = (dateStr: string, today: Date) => {
  const original = parseDate(dateStr);
  return original < today ? formatLocalDate(today) : formatLocalDate(original);
};

const getEventStatus = (originalDate: string, todayStr: string) => {
  if (originalDate < todayStr) return 'overdue';
  if (originalDate === todayStr) return 'due';
  return 'future';
};

const isCardTransaction = (t: any, creditCards: any[]) =>
  !!t.creditCardId || creditCards.some((card: any) =>
    card.id && (card.id === t.accountId || card.id === t.destinationAccountId)
  );

const calculateCardBalance = (transactions: any[], cardId: string, period: string) => {
  const periodTx = transactions.filter((t: any) =>
    (t.creditCardId === cardId || t.accountId === cardId || t.destinationAccountId === cardId) &&
    t.invoicePeriod === period
  );
  const expenses = periodTx
    .filter(isExpense)
    .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
  const payments = periodTx
    .filter((t: any) => isTransfer(t) && t.destinationAccountId === cardId)
    .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
  const credits = periodTx
    .filter((t: any) => isIncome(t) && (t.accountId === cardId || t.creditCardId === cardId))
    .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
  return Math.max(0, expenses - payments - credits);
};

export function buildCashCoverageProjection({
  accounts,
  transactions,
  creditCards,
  invoices,
  options = {},
}: {
  accounts: any[];
  transactions: any[];
  creditCards: any[];
  invoices: any[];
  options?: CashCoverageOptions;
}): CashCoverageProjection {
  const today = parseDate(options.startDate);
  const endDate = options.endDate
    ? parseDate(options.endDate)
    : addDays(today, Math.max(1, options.days || 90) - 1);
  const todayStr = formatLocalDate(today);
  const endStr = formatLocalDate(endDate);

  const startingBalance = accounts
    .filter((account: any) => options.includeSavings || !account.excludeFromCashFlow)
    .reduce((sum: number, account: any) => sum + (account.balance || 0), 0);

  const events: CashCoverageEvent[] = [];

  for (const tx of transactions) {
    if (!isPending(tx) || isTransfer(tx) || isCardTransaction(tx, creditCards)) continue;
    if (!isIncome(tx) && !isExpense(tx)) continue;

    const originalDate = (tx.date || '').split('T')[0];
    if (!originalDate || originalDate > endStr) continue;

    const date = clampEventDate(originalDate, today);
    const direction = isIncome(tx) ? 'in' : 'out';
    events.push({
      id: `tx-${tx.id || originalDate}-${direction}`,
      date,
      originalDate,
      month: date.substring(0, 7),
      amount: tx.amount || 0,
      direction,
      source: direction === 'in' ? 'bank_income' : 'bank_expense',
      certainty: 'confirmed',
      status: getEventStatus(originalDate, todayStr),
      label: tx.description || (direction === 'in' ? 'Receita a receber' : 'Despesa a pagar'),
      categoryId: tx.categoryId,
      accountId: tx.accountId,
      transactionId: tx.id,
      raw: tx,
    });
  }

  for (const card of creditCards) {
    if (!card.id) continue;

    const periods = new Set<string>();
    invoices
      .filter((invoice: any) => invoice.cardId === card.id)
      .forEach((invoice: any) => periods.add(invoice.period));
    transactions
      .filter((tx: any) =>
        (tx.creditCardId === card.id || tx.accountId === card.id || tx.destinationAccountId === card.id) &&
        tx.invoicePeriod
      )
      .forEach((tx: any) => periods.add(tx.invoicePeriod));

    for (const period of periods) {
      const invoice = invoices.find((item: any) => item.cardId === card.id && item.period === period);
      if (invoice?.status === 'paga') continue;

      const dueDate = invoiceDueDate(period, card.dueDay);
      const originalDate = formatLocalDate(dueDate);
      if (originalDate > endStr) continue;

      const computedBalance = calculateCardBalance(transactions, card.id, period);
      const invoiceAmount = typeof invoice?.totalAmount === 'number' ? invoice.totalAmount : 0;
      const amount = Math.max(invoiceAmount, computedBalance);
      if (amount <= 0.01) continue;

      const closingDate = invoiceClosingDate(period, card.closingDay, card.dueDay);
      const status = invoice?.status || (today >= closingDate ? 'fechada' : 'aberta');
      const currentPeriod = currentInvoicePeriod(today, card.closingDay, card.dueDay);
      const source: CashCoverageSource = status === 'fechada'
        ? 'invoice_closed'
        : period > currentPeriod
          ? 'card_future'
          : 'invoice_open';

      events.push({
        id: `invoice-${card.id}-${period}`,
        date: clampEventDate(originalDate, today),
        originalDate,
        month: clampEventDate(originalDate, today).substring(0, 7),
        amount,
        direction: 'out',
        source,
        certainty: status === 'fechada' ? 'confirmed' : source === 'card_future' ? 'projected' : 'expected',
        status: getEventStatus(originalDate, todayStr),
        label: `Fatura ${card.name || 'Cartão'} ${period}`,
        cardId: card.id,
        invoiceId: invoice?.id,
        invoicePeriod: period,
        raw: invoice || { cardId: card.id, period, status },
      });
    }
  }

  events.sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));

  const dailyProjection: CashCoverageDay[] = [];
  let currentBalance = startingBalance;
  let minimumBalance = startingBalance;
  let minimumBalanceDate = todayStr;
  let firstRiskDate: string | null = startingBalance < 0 ? todayStr : null;

  for (let day = new Date(today); day <= endDate; day = addDays(day, 1)) {
    const date = formatLocalDate(day);
    const dayEvents = events.filter(event => event.date === date);
    const income = dayEvents
      .filter(event => event.direction === 'in')
      .reduce((sum, event) => sum + event.amount, 0);
    const expense = dayEvents
      .filter(event => event.direction === 'out')
      .reduce((sum, event) => sum + event.amount, 0);
    const dayStart = currentBalance;
    currentBalance += income - expense;

    if (currentBalance < minimumBalance) {
      minimumBalance = currentBalance;
      minimumBalanceDate = date;
    }
    if (!firstRiskDate && currentBalance < 0) {
      firstRiskDate = date;
    }

    dailyProjection.push({
      date,
      startingBalance: dayStart,
      income,
      expense,
      endingBalance: currentBalance,
      events: dayEvents,
    });
  }

  const monthlyProjection: CashCoverageMonth[] = [];
  let monthlyAccum = startingBalance;
  for (let cursor = new Date(today.getFullYear(), today.getMonth(), 1); cursor <= endDate; cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)) {
    const month = monthKey(cursor);
    const monthEvents = events.filter(event => event.month === month);
    const incomeEvents = monthEvents.filter(event => event.direction === 'in');
    const expenseEvents = monthEvents.filter(event => event.direction === 'out' && event.source === 'bank_expense');
    const invoiceEvents = monthEvents.filter(event =>
      event.direction === 'out' &&
      ['invoice_closed', 'invoice_open', 'card_future'].includes(event.source)
    );
    const incomeTotal = incomeEvents.reduce((sum, event) => sum + event.amount, 0);
    const expenseTotal = expenseEvents.reduce((sum, event) => sum + event.amount, 0);
    const invoiceTotal = invoiceEvents.reduce((sum, event) => sum + event.amount, 0);
    const net = incomeTotal - expenseTotal - invoiceTotal;
    monthlyAccum += net;

    monthlyProjection.push({
      month,
      label: cursor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      shortLabel: cursor.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
      incomeTotal,
      expenseTotal,
      invoiceTotal,
      net,
      accum: monthlyAccum,
      incomeEvents,
      expenseEvents,
      invoiceEvents,
    });
  }

  const totalIncome = events
    .filter(event => event.direction === 'in')
    .reduce((sum, event) => sum + event.amount, 0);
  const totalBankExpenses = events
    .filter(event => event.source === 'bank_expense')
    .reduce((sum, event) => sum + event.amount, 0);
  const totalClosedInvoices = events
    .filter(event => event.source === 'invoice_closed')
    .reduce((sum, event) => sum + event.amount, 0);
  const totalOpenInvoices = events
    .filter(event => event.source === 'invoice_open')
    .reduce((sum, event) => sum + event.amount, 0);
  const totalFutureCard = events
    .filter(event => event.source === 'card_future')
    .reduce((sum, event) => sum + event.amount, 0);
  const totalInvoices = totalClosedInvoices + totalOpenInvoices + totalFutureCard;
  const totalObligations = totalBankExpenses + totalInvoices;

  return {
    startingBalance,
    endingBalance: currentBalance,
    minimumBalance,
    minimumBalanceDate,
    firstRiskDate,
    isAtRisk: minimumBalance < 0,
    totalIncome,
    totalObligations,
    totalBankExpenses,
    totalInvoices,
    totalClosedInvoices,
    totalOpenInvoices,
    totalFutureCard,
    coverageBalance: startingBalance + totalIncome - totalObligations,
    events,
    dailyProjection,
    monthlyProjection,
  };
}
