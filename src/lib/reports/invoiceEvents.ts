import type { CreditCard, Invoice } from '../../types';
import type { NormalizedTransaction, UnallocatedInvoiceObligation } from '../../types/reports';
import { getInvoiceFinancialSummary, getInvoicePaymentTransactionIds } from '../invoicePayment';
import { fromCents, toCents } from './normalize';
import { getMonthsInRange } from './periods';

export interface InvoiceResidualAnalysis {
  obligations: UnallocatedInvoiceObligation[];
  totalResidualCents: number;
}

export function getInvoiceDueDate(period: string, dueDay: number): string {
  // period é YYYY-MM
  const [yearStr, monthStr] = period.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const lastDay = new Date(year, month, 0).getDate();
  const day = Math.min(Math.max(1, dueDay || 10), lastDay);
  return `${yearStr}-${monthStr.padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function buildInvoiceObligations(
  invoices: Invoice[],
  creditCards: CreditCard[],
  transactions: NormalizedTransaction[],
  targetPeriod: string, // YYYY-MM
  customRange?: { startDate: string; endDate: string }
): InvoiceResidualAnalysis {
  const cardMap = new Map(creditCards.map(c => [c.id || '', c]));
  const obligations: UnallocatedInvoiceObligation[] = [];
  let totalResidualCents = 0;

  // Mapa de IDs oficiais de pagamento para o cartão e período da fatura
  const paymentTxToInvoiceMap = new Map<string, { cardId: string; period: string }>();
  for (const inv of invoices) {
    if (inv.paymentTransactionIds && Array.isArray(inv.paymentTransactionIds)) {
      for (const id of inv.paymentTransactionIds) {
        if (typeof id === 'string' && id) {
          paymentTxToInvoiceMap.set(id, { cardId: inv.cardId, period: inv.period });
        }
      }
    }
    if (typeof (inv as any).paymentTransactionId === 'string' && (inv as any).paymentTransactionId) {
      paymentTxToInvoiceMap.set((inv as any).paymentTransactionId, { cardId: inv.cardId, period: inv.period });
    }
  }

  // Identifica pagamentos bancários pendentes agendados (F2: COMPRAS NÃO SÃO AGENDAMENTOS!)
  const pendingPaymentsByCardPeriod = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.status !== 'pending') continue;

    // Se for compra comum de cartão, NÃO é pagamento de fatura
    if (tx.isCard && !tx.isInvoicePayment) continue;

    let cardId = '';
    let period = '';

    if (paymentTxToInvoiceMap.has(tx.id)) {
      const mapped = paymentTxToInvoiceMap.get(tx.id)!;
      cardId = mapped.cardId;
      period = mapped.period;
    } else if (tx.isInvoicePayment || tx.raw.creditCardId) {
      cardId = tx.raw.creditCardId || tx.cardId || '';
      period = tx.raw.invoicePeriod || tx.month;
    }

    if (cardId && period) {
      const key = `${cardId}_${period}`;
      const curr = pendingPaymentsByCardPeriod.get(key) || 0;
      pendingPaymentsByCardPeriod.set(key, curr + tx.amountCents);
    }
  }

  // Faturas multi-mês: se houver customRange, considera todos os meses que o intervalo intercepta
  const allowedPeriods = new Set<string>();
  if (customRange) {
    const months = getMonthsInRange(customRange.startDate, customRange.endDate);
    for (const m of months) allowedPeriods.add(m);
  } else {
    allowedPeriods.add(targetPeriod);
  }

  // Coletar todos os pares (cardId, period) existentes em invoices ou em compras de cartão
  const cardPeriods = new Map<string, { cardId: string; period: string; inv?: Invoice }>();

  for (const inv of invoices) {
    if (allowedPeriods.has(inv.period)) {
      cardPeriods.set(`${inv.cardId}_${inv.period}`, { cardId: inv.cardId, period: inv.period, inv });
    }
  }

  for (const tx of transactions) {
    if (tx.isCard && !tx.isInvoicePayment) {
      if (tx.status === 'cancelled') continue;
      const period = tx.invoicePeriod || tx.month;
      if (period && allowedPeriods.has(period)) {
        const cardId = tx.cardId || tx.raw.creditCardId || '';
        if (cardId) {
          const key = `${cardId}_${period}`;
          if (!cardPeriods.has(key)) {
            cardPeriods.set(key, { cardId, period });
          }
        }
      }
    }
  }

  for (const { cardId, period, inv } of cardPeriods.values()) {
    const card = cardMap.get(cardId);
    const cardName = card?.name || 'Cartão';
    const dueDay = card?.dueDay || 10;
    const dueDate = getInvoiceDueDate(period, dueDay);

    // F7: Se houver customRange, o dueDate deve estar estritamente dentro do intervalo
    if (customRange) {
      if (dueDate < customRange.startDate || dueDate > customRange.endDate) {
        continue;
      }
    }

    let totalCents = 0;
    let paidCents = 0;
    let remainingCents = 0;
    let invoiceStatus = 'aberta';

    if (inv) {
      const summary = getInvoiceFinancialSummary(inv);
      totalCents = toCents(summary.totalAmount);
      paidCents = toCents(summary.paidAmount);
      remainingCents = toCents(summary.remainingAmount);
      invoiceStatus = summary.status;

      // Se o total da fatura for 0 ou indefinido, calcula pelas compras do período
      if (totalCents === 0) {
        let purchasesCents = 0;
        for (const tx of transactions) {
          if (tx.status === 'cancelled') continue;
          if (tx.isCard && !tx.isInvoicePayment && (tx.cardId === cardId || tx.raw.creditCardId === cardId)) {
            const txPeriod = tx.invoicePeriod || tx.month;
            if (txPeriod === period) {
              purchasesCents += tx.isCredit ? -tx.amountCents : tx.amountCents;
            }
          }
        }
        totalCents = Math.max(0, purchasesCents);
        remainingCents = Math.max(0, totalCents - paidCents);
      }
    } else {
      // F2/Caso 09: Sem documento de fatura criado, calcula pelas compras de cartão
      let purchasesCents = 0;
      for (const tx of transactions) {
        if (tx.status === 'cancelled') continue;
        if (tx.isCard && !tx.isInvoicePayment && (tx.cardId === cardId || tx.raw.creditCardId === cardId)) {
          const txPeriod = tx.invoicePeriod || tx.month;
          if (txPeriod === period) {
            purchasesCents += tx.isCredit ? -tx.amountCents : tx.amountCents;
          }
        }
      }
      totalCents = Math.max(0, purchasesCents);
      paidCents = 0;
      remainingCents = totalCents;
      invoiceStatus = 'aberta';
    }

    if (invoiceStatus === 'paga' || remainingCents <= 0) {
      continue;
    }

    // Deduz qualquer pagamento pendente já cadastrado no banco para esta mesma fatura
    const key = `${cardId}_${period}`;
    const pendingRegisteredCents = pendingPaymentsByCardPeriod.get(key) || 0;

    // F2: O residual a exibir é o restante da fatura menos o que já está agendado
    const netSyntheticRemainingCents = Math.max(0, remainingCents - pendingRegisteredCents);

    if (netSyntheticRemainingCents > 0) {
      obligations.push({
        cardId,
        cardName,
        period,
        dueDate,
        totalAmountCents: totalCents,
        paidAmountCents: paidCents,
        remainingAmountCents: netSyntheticRemainingCents,
        invoiceStatus,
        hasPendingPayment: pendingRegisteredCents > 0,
      });

      totalResidualCents += netSyntheticRemainingCents;
    }
  }

  return {
    obligations,
    totalResidualCents,
  };
}
