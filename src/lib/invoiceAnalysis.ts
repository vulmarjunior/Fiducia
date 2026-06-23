export interface InvoiceAnalysisParams {
  creditCards: any[];
  transactions: any[];
  invoices: any[];
  startDate: Date;
  endDate: Date;
  selectedCardId?: string;
  statusFilter?: 'all' | 'open' | 'closed' | 'paid' | 'future';
  includeCredits?: boolean;
}

export interface InvoiceDetail {
  cardId: string;
  cardName: string;
  period: string;
  status: 'open' | 'closed' | 'paid' | 'future';
  dueDate: string;
  amount: number;
  pctOfTotal: number;
  previousAmount: number;
  variation: number;
}

export interface InvoiceAnalysisResult {
  summary: {
    totalOpen: number;
    totalClosed: number;
    totalPaid: number;
    totalFuture: number;
    monthlyAverage: number;
    largestInvoice: number;
    cardsCount: number;
  };
  monthlyData: Array<{
    month: string;
    label: string;
    cards: Record<string, { name: string; amount: number; color: string }>;
    total: number;
  }>;
  cardBreakdown: Array<{
    cardId: string;
    name: string;
    total: number;
    color: string;
    pct: number;
  }>;
  detailList: InvoiceDetail[];
  trend: Array<{
    month: string;
    label: string;
    total: number;
  }>;
}

const COLORS = ['#22c55e', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1'];

const isExpense = (t: any) => t.type === 'despesa' || t.type === 'expense';
const isIncome = (t: any) => t.type === 'receita' || t.type === 'income';
const isTransfer = (t: any) => t.type === 'transferencia' || t.type === 'transfer';
const isPending = (t: any) => t.status === 'pendente' || t.status === 'pending';

const isCardTx = (t: any, cardId: string) =>
  (t.creditCardId === cardId || t.accountId === cardId || t.destinationAccountId === cardId);

const monthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

const monthLabel = (period: string) => {
  const [year, month] = period.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};

const getPeriodsInRange = (startDate: Date, endDate: Date): string[] => {
  const periods: string[] = [];
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  while (cursor <= endDate) {
    periods.push(monthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return periods;
};

const getInvoiceStatusFromDates = (
  period: string,
  closingDay: number,
  dueDay: number,
  today: Date
): 'open' | 'closed' | 'paid' => {
  const [year, month] = period.split('-').map(Number);
  const closingDate = new Date(year, month - 1, closingDay);
  let dueMonth = month;
  let dueYear = year;
  if (dueDay <= closingDay) {
    dueMonth += 1;
    if (dueMonth > 12) { dueMonth = 1; dueYear += 1; }
  }
  const dueDate = new Date(dueYear, dueMonth - 1, dueDay);
  if (today < closingDate) return 'open';
  if (today < dueDate) return 'closed';
  return 'paid';
};

const getDueDate = (period: string, dueDay: number): string => {
  const [year, month] = period.split('-').map(Number);
  return `${year}-${String(month).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;
};

const isFuturePeriod = (period: string, todayStr: string): boolean => {
  return period > todayStr;
};

const computeInvoiceAmount = (
  transactions: any[],
  cardId: string,
  period: string,
  includeCredits: boolean
): number => {
  const periodTx = transactions.filter(
    (t: any) => isCardTx(t, cardId) && t.invoicePeriod === period
  );
  const expenses = periodTx
    .filter(isExpense)
    .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
  if (!includeCredits) return expenses;

  const payments = periodTx
    .filter((t: any) => isTransfer(t) && t.destinationAccountId === cardId)
    .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
  const credits = periodTx
    .filter((t: any) => isIncome(t) && (t.accountId === cardId || t.creditCardId === cardId))
    .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
  return Math.max(0, expenses - payments - credits);
};

export function buildInvoiceAnalysis(params: InvoiceAnalysisParams): InvoiceAnalysisResult {
  const {
    creditCards,
    transactions,
    invoices,
    startDate,
    endDate,
    selectedCardId = 'all',
    statusFilter = 'all',
    includeCredits = false,
  } = params;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = monthKey(today);

  const cards = selectedCardId === 'all'
    ? creditCards.filter((c: any) => c.id)
    : creditCards.filter((c: any) => c.id === selectedCardId);

  const cardColorMap: Record<string, string> = {};
  cards.forEach((card: any, index: number) => {
    cardColorMap[card.id] = COLORS[index % COLORS.length];
  });

  const rangeMonths = getPeriodsInRange(startDate, endDate);

  const allPeriods = new Set<string>();
  for (const card of cards) {
    for (const tx of transactions) {
      if (isCardTx(tx, card.id) && tx.invoicePeriod) {
        allPeriods.add(tx.invoicePeriod);
      }
    }
    for (const inv of invoices) {
      if (inv.cardId === card.id) {
        allPeriods.add(inv.period);
      }
    }
  }
  const sortedPeriods = Array.from(allPeriods).filter(p => {
    return p >= rangeMonths[0] && p <= rangeMonths[rangeMonths.length - 1];
  }).sort();

  const detailList: InvoiceDetail[] = [];
  let globalGrandTotal = 0;

  for (const card of cards) {
    for (const period of sortedPeriods) {
      const txInPeriod = transactions.filter(
        (t: any) => isCardTx(t, card.id) && t.invoicePeriod === period
      );

      if (txInPeriod.length === 0) {
        const inv = invoices.find((i: any) => i.cardId === card.id && i.period === period);
        if (!inv) continue;
      }

      const invoice = invoices.find((i: any) => i.cardId === card.id && i.period === period);
      const amount = computeInvoiceAmount(transactions, card.id, period, includeCredits);

      if (amount <= 0 && (!invoice || invoice.status === 'paga')) {
        if (invoice?.status === 'paga') {
          const paidAmount = invoice.totalAmount || amount;
          globalGrandTotal += paidAmount;
          detailList.push({
            cardId: card.id,
            cardName: card.name,
            period,
            status: 'paid',
            dueDate: getDueDate(period, card.dueDay),
            amount: paidAmount,
            pctOfTotal: 0,
            previousAmount: 0,
            variation: 0,
          });
        }
        continue;
      }

      let status: 'open' | 'closed' | 'paid' | 'future';
      if (invoice?.status === 'paga') {
        status = 'paid';
      } else if (invoice?.status === 'fechada') {
        status = 'closed';
      } else if (invoice?.status === 'aberta') {
        status = 'open';
      } else {
        status = getInvoiceStatusFromDates(period, card.closingDay, card.dueDay, today);
      }
      if (status === 'open' && period > todayStr) {
        const hasRealized = txInPeriod.some((t: any) =>
          t.status === 'realizado' || t.status === 'pago' || t.status === 'paid'
        );
        if (!hasRealized) {
          status = 'future';
        }
      }

      globalGrandTotal += amount;
      detailList.push({
        cardId: card.id,
        cardName: card.name,
        period,
        status,
        dueDate: getDueDate(period, card.dueDay),
        amount,
        pctOfTotal: 0,
        previousAmount: 0,
        variation: 0,
      });
    }
  }

  detailList.sort((a, b) => a.period.localeCompare(b.period) || a.cardName.localeCompare(b.cardName));

  for (const item of detailList) {
    item.pctOfTotal = globalGrandTotal > 0 ? (item.amount / globalGrandTotal) * 100 : 0;
    const prev = detailList.find(
      d => d.cardId === item.cardId
        && d.period < item.period
        && d.status !== 'future'
    );
    if (prev) {
      item.previousAmount = prev.amount;
      item.variation = prev.amount > 0 ? ((item.amount - prev.amount) / prev.amount) * 100 : 0;
    }
  }

  const filteredDetail = detailList.filter(d => {
    if (statusFilter === 'all') return true;
    return d.status === statusFilter;
  });

  const summary = {
    totalOpen: detailList.filter(d => d.status === 'open').reduce((s, d) => s + d.amount, 0),
    totalClosed: detailList.filter(d => d.status === 'closed').reduce((s, d) => s + d.amount, 0),
    totalPaid: detailList.filter(d => d.status === 'paid').reduce((s, d) => s + d.amount, 0),
    totalFuture: detailList.filter(d => d.status === 'future').reduce((s, d) => s + d.amount, 0),
    monthlyAverage: 0,
    largestInvoice: 0,
    cardsCount: cards.length,
  };

  const monthsWithData = new Set(detailList.filter(d => d.status !== 'future').map(d => d.period));
  summary.monthlyAverage = monthsWithData.size > 0
    ? (summary.totalOpen + summary.totalClosed + summary.totalPaid) / monthsWithData.size
    : 0;
  summary.largestInvoice = detailList.reduce((max, d) => Math.max(max, d.amount), 0);

  const monthlyData = rangeMonths.map(month => {
    const cardsData: Record<string, { name: string; amount: number; color: string }> = {};
    let total = 0;
    for (const card of cards) {
      const items = detailList.filter(d => d.cardId === card.id && d.period === month);
      const cardTotal = items.reduce((s, d) => s + d.amount, 0);
      if (cardTotal > 0) {
        cardsData[card.id] = {
          name: card.name,
          amount: cardTotal,
          color: cardColorMap[card.id],
        };
        total += cardTotal;
      }
    }
    return { month, label: monthLabel(month), cards: cardsData, total };
  });

  const cardBreakdown = cards.map(card => {
    const total = detailList
      .filter(d => d.cardId === card.id)
      .reduce((s, d) => s + d.amount, 0);
    return {
      cardId: card.id,
      name: card.name,
      total,
      color: cardColorMap[card.id],
      pct: globalGrandTotal > 0 ? (total / globalGrandTotal) * 100 : 0,
    };
  }).filter(c => c.total > 0);

  const trend = rangeMonths.map(month => {
    const total = detailList
      .filter(d => d.period === month)
      .reduce((s, d) => s + d.amount, 0);
    return { month, label: monthLabel(month), total };
  });

  return {
    summary,
    monthlyData,
    cardBreakdown,
    detailList: filteredDetail,
    trend,
  };
}
