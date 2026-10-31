export type InvoicePaymentStatus = 'parcial' | 'paga';

export interface InvoicePaymentState {
  totalAmount: number;
  priorPaidAmount: number;
  paymentAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: InvoicePaymentStatus;
}

export interface InvoiceFinancialSummary {
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  /** Saldo credor da fatura (quando o total é negativo). */
  creditAmount: number;
  /** Saldo assinado: positivo a pagar, negativo credor. */
  balanceAmount: number;
  paymentProgress: number;
  status: 'aberta' | 'fechada' | 'parcial' | 'paga';
}

const toCents = (value: number) => Math.round(value * 100);
const fromCents = (value: number) => value / 100;

export function getInvoicePaymentTransactionIds(invoices: any[]): Set<string> {
  const ids = new Set<string>();

  for (const invoice of invoices) {
    if (Array.isArray(invoice?.paymentTransactionIds)) {
      for (const id of invoice.paymentTransactionIds) {
        if (typeof id === 'string' && id) ids.add(id);
      }
    }
    if (typeof invoice?.paymentTransactionId === 'string' && invoice.paymentTransactionId) {
      ids.add(invoice.paymentTransactionId);
    }
  }

  return ids;
}

export function getInvoiceFinancialSummary(invoice: any, calculatedTotal?: number): InvoiceFinancialSummary {
  const isAberta = !invoice || invoice.status === 'aberta';
  const storedTotal = typeof invoice?.totalAmount === 'number' ? invoice.totalAmount : undefined;
  const useStored = storedTotal !== undefined && storedTotal !== 0 && (!isAberta || calculatedTotal === undefined);
  const totalCents = toCents(useStored ? storedTotal : (calculatedTotal ?? storedTotal ?? 0));

  let paidCents = Math.max(0, toCents(invoice?.paidAmount || 0));
  if (invoice?.status === 'paga' && totalCents > 0) paidCents = totalCents;
  if (totalCents > 0) paidCents = Math.min(totalCents, paidCents);
  else paidCents = 0;

  const balanceCents = totalCents - paidCents;
  const remainingCents = Math.max(0, balanceCents);
  const creditCents = Math.max(0, -balanceCents);
  const baseStatus = invoice?.status ?? 'aberta';
  const status = totalCents > 0
    ? (remainingCents === 0 ? 'paga' : paidCents > 0 ? 'parcial' : baseStatus)
    : (baseStatus === 'paga' || baseStatus === 'parcial' ? 'fechada' : baseStatus);

  return {
    totalAmount: fromCents(totalCents),
    paidAmount: fromCents(paidCents),
    remainingAmount: fromCents(remainingCents),
    creditAmount: fromCents(creditCents),
    balanceAmount: fromCents(balanceCents),
    paymentProgress: totalCents > 0 ? (paidCents / totalCents) * 100 : 0,
    status,
  };
}

export function calculateInvoicePayment(totalAmount: number, priorPaidAmount: number, paymentAmount: number): InvoicePaymentState {
  const totalCents = toCents(totalAmount);
  const priorPaidCents = toCents(priorPaidAmount);
  const paymentCents = toCents(paymentAmount);

  if (!Number.isFinite(totalAmount)) throw new Error('A fatura não possui um total válido para pagamento.');
  if (totalCents < 0) throw new Error('A fatura está com saldo credor; não há valor a pagar.');
  if (totalCents === 0) throw new Error('A fatura não possui um total válido para pagamento.');
  if (!Number.isFinite(priorPaidAmount) || priorPaidCents < 0) throw new Error('O valor já pago da fatura é inválido.');
  if (!Number.isFinite(paymentAmount) || paymentCents <= 0) throw new Error('Informe um valor de pagamento maior que zero.');

  const remainingBeforePayment = Math.max(0, totalCents - priorPaidCents);
  if (remainingBeforePayment === 0) throw new Error('Esta fatura já está totalmente paga.');
  if (paymentCents > remainingBeforePayment) {
    throw new Error(`O pagamento excede o saldo remanescente de R$ ${fromCents(remainingBeforePayment).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`);
  }

  const paidCents = priorPaidCents + paymentCents;
  const remainingCents = Math.max(0, totalCents - paidCents);
  return {
    totalAmount: fromCents(totalCents), priorPaidAmount: fromCents(priorPaidCents), paymentAmount: fromCents(paymentCents),
    paidAmount: fromCents(paidCents), remainingAmount: fromCents(remainingCents),
    status: remainingCents === 0 ? 'paga' : 'parcial',
  };
}
