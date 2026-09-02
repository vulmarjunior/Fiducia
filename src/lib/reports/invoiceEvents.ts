import type { CreditCard, Invoice, Transaction } from '../../types';
import type { NormalizedTransaction, UnallocatedInvoiceObligation } from '../../types/reports';
import { getInvoiceFinancialSummary, getInvoicePaymentTransactionIds } from '../invoicePayment';
import { fromCents, toCents } from './normalize';

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
  targetPeriod: string // YYYY-MM
): InvoiceResidualAnalysis {
  const cardMap = new Map(creditCards.map(c => [c.id || '', c]));
  const obligations: UnallocatedInvoiceObligation[] = [];
  let totalResidualCents = 0;

  // Identifica pagamentos pendentes já cadastrados no banco para evitar duplicação
  const pendingPaymentsByCardPeriod = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.status === 'pending' && (tx.isInvoicePayment || tx.raw.creditCardId || tx.raw.invoicePeriod)) {
      const cardId = tx.raw.creditCardId || tx.cardId || '';
      const period = tx.raw.invoicePeriod || tx.month;
      const key = `${cardId}_${period}`;
      const curr = pendingPaymentsByCardPeriod.get(key) || 0;
      pendingPaymentsByCardPeriod.set(key, curr + tx.amountCents);
    }
  }

  for (const inv of invoices) {
    if (inv.period !== targetPeriod) continue;

    const card = cardMap.get(inv.cardId);
    const cardName = card?.name || 'Cartão';
    const dueDay = card?.dueDay || 10;
    const dueDate = getInvoiceDueDate(inv.period, dueDay);

    const summary = getInvoiceFinancialSummary(inv);
    const totalCents = toCents(summary.totalAmount);
    const paidCents = toCents(summary.paidAmount);
    let remainingCents = toCents(summary.remainingAmount);

    if (summary.status === 'paga' || remainingCents <= 0) {
      continue;
    }

    // Deduz qualquer pagamento pendente já existente para esta mesma fatura
    const key = `${inv.cardId}_${inv.period}`;
    const pendingRegisteredCents = pendingPaymentsByCardPeriod.get(key) || 0;
    
    // O valor residual sintético a registrar é o restante menos o que já está agendado
    const netSyntheticRemainingCents = Math.max(0, remainingCents - pendingRegisteredCents);

    if (netSyntheticRemainingCents > 0) {
      obligations.push({
        cardId: inv.cardId,
        cardName,
        period: inv.period,
        dueDate,
        totalAmountCents: totalCents,
        paidAmountCents: paidCents,
        remainingAmountCents: netSyntheticRemainingCents,
        invoiceStatus: summary.status,
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
