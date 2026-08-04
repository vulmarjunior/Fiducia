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
  paymentProgress: number;
  status: 'aberta' | 'fechada' | 'parcial' | 'paga';
}

const toCents = (value: number) => Math.round(value * 100);
const fromCents = (value: number) => value / 100;

export function getInvoiceFinancialSummary(invoice: any, calculatedTotal = 0): InvoiceFinancialSummary {
  const totalCents = Math.max(0, toCents(
    typeof invoice?.totalAmount === 'number' && invoice.totalAmount > 0 ? invoice.totalAmount : calculatedTotal,
  ));
  const paidCents = Math.min(totalCents, Math.max(0, toCents(invoice?.paidAmount || 0)));
  const remainingCents = Math.max(0, totalCents - paidCents);
  const status = remainingCents === 0 && totalCents > 0
    ? 'paga'
    : paidCents > 0
      ? 'parcial'
      : (invoice?.status || 'aberta');

  return {
    totalAmount: fromCents(totalCents),
    paidAmount: fromCents(paidCents),
    remainingAmount: fromCents(remainingCents),
    paymentProgress: totalCents > 0 ? (paidCents / totalCents) * 100 : 0,
    status,
  };
}

export function calculateInvoicePayment(totalAmount: number, priorPaidAmount: number, paymentAmount: number): InvoicePaymentState {
  const totalCents = toCents(totalAmount);
  const priorPaidCents = toCents(priorPaidAmount);
  const paymentCents = toCents(paymentAmount);

  if (!Number.isFinite(totalAmount) || totalCents <= 0) throw new Error('A fatura não possui um total válido para pagamento.');
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
