import type { Account, Category, CreditCard, Invoice, Transaction } from './index';

export type ReportTab = 'expenses' | 'income' | 'cashflow' | 'accounts';

export type PaymentStatusFilter = 'all' | 'paid' | 'pending';

export type ReportIntervalType = 'day' | 'week' | 'month';

export interface ReportCustomRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export interface ReportFilters {
  selectedMonth: string; // YYYY-MM
  customRange?: ReportCustomRange;
  categoryIds?: string[]; // IDs explicitamente selecionados; undefined = todas; [] = nenhuma
  originIds?: string[];   // IDs de contas ou cartões; undefined = todas; [] = nenhuma
  status: PaymentStatusFilter;
  intervalType: ReportIntervalType;
  accumulated: boolean;
  includePending: boolean;
}

export interface NormalizedTransaction {
  id: string;
  date: string; // YYYY-MM-DD
  month: string; // YYYY-MM
  invoicePeriod?: string;
  amountCents: number;
  description: string;
  type: 'income' | 'expense' | 'transfer';
  status: 'paid' | 'pending' | 'cancelled';
  categoryId: string;
  categoryName: string;
  isCard: boolean;
  cardId?: string;
  accountId?: string;
  destinationAccountId?: string;
  isInvoicePayment: boolean;
  isCredit: boolean; // estorno ou crédito no cartão
  isValid: boolean; // false quando data/valor não podem ser interpretados
  invalidReason?: string;
  raw: Transaction;
}

export interface ReportDiagnostics {
  invalidCount: number; // registros excluídos por data/valor inválidos
  excludedCount: number; // registros excluídos por status cancelado
}

export interface CategoryDistributionItem {
  categoryId: string;
  categoryName: string;
  icon?: string;
  color?: string;
  totalCents: number;
  total: number;
  percent: number;
  directCents: number;
  cardCents: number;
  entriesCount: number;
  entries: NormalizedTransaction[];
}

export interface CategoryEvolutionPoint {
  periodKey: string;
  label: string;
  values: Record<string, number>; // categoryId -> valor em reais (retrocompatível)
  total: number;
  entriesCount: number;
  valuesCents: Record<string, number>; // categoryId -> valor em centavos (fonte canônica)
  totalCents: number;
}

export interface CategoryReportResult {
  type: 'expenses' | 'income';
  totalCents: number;
  total: number;
  categories: CategoryDistributionItem[];
  evolution: CategoryEvolutionPoint[];
  hasNegativeCategories: boolean;
  itemsWithoutInvoiceDayTotal: number;
  itemsWithoutInvoiceDayEntries: NormalizedTransaction[];
  itemsWithoutInvoicePeriodTotal: number;
  itemsWithoutInvoicePeriodEntries: NormalizedTransaction[];
  diagnostics: ReportDiagnostics;
}

export interface CashFlowPoint {
  periodKey: string;
  label: string;
  startDate: string;
  endDate: string;
  inflowCents: number;
  outflowCents: number;
  resultCents: number;
  endingBalanceCents?: number;
  inflow: number;
  outflow: number;
  result: number;
  endingBalance?: number;
  hasPending: boolean;
  pendingInflowCents: number;
  pendingOutflowCents: number;
  pendingResultCents: number;
  openingCapitalCents: number; // capital inicial de conta aberta no período (não é receita)
  priorPendingCents: number; // pendências anteriores ao intervalo, sinalizadas fora do período
  projectedEndingBalanceCents?: number;
  entries: NormalizedTransaction[];
}

export interface CashFlowReportResult {
  totalInflowCents: number;
  totalOutflowCents: number;
  netResultCents: number;
  totalInflow: number;
  totalOutflow: number;
  netResult: number;
  startingBalanceCents?: number;
  endingBalanceCents?: number;
  startingBalance?: number;
  endingBalance?: number;
  openingCapitalCents: number;
  priorPendingCents: number;
  invoiceObligationsCents: number;
  invoiceObligationsIncludedInPoints: boolean;
  diagnostics: ReportDiagnostics;
  points: CashFlowPoint[];
}

export interface AccountFlowItem {
  accountId: string;
  accountName: string;
  accountType: string;
  startingBalanceCents: number;
  openingCapitalCents: number;
  priorPendingCents: number;
  inflowCents: number;
  outflowCents: number;
  netResultCents: number;
  endingBalanceCents: number;
  startingBalance: number;
  openingCapital: number;
  priorPending: number;
  inflow: number;
  outflow: number;
  netResult: number;
  endingBalance: number;
  pendingInflowCents: number;
  pendingOutflowCents: number;
  pendingNetCents: number;
  projectedEndingBalanceCents: number;
  projectedEndingBalance: number;
  isReconciled: boolean;
  isReconciledToday: boolean;
  divergenceMessage?: string;
  points: CashFlowPoint[];
  entries: NormalizedTransaction[];
}

export interface UnallocatedInvoiceObligation {
  cardId: string;
  cardName: string;
  period: string;
  dueDate?: string;
  totalAmountCents: number;
  paidAmountCents: number;
  remainingAmountCents: number;
  invoiceStatus: string;
  hasPendingPayment: boolean;
}

export interface AccountFlowReportResult {
  consolidatedStartingBalanceCents: number;
  consolidatedOpeningCapitalCents: number;
  consolidatedPriorPendingCents: number;
  consolidatedInflowCents: number;
  consolidatedOutflowCents: number;
  consolidatedNetResultCents: number;
  consolidatedEndingBalanceCents: number;
  consolidatedStartingBalance: number;
  consolidatedOpeningCapital: number;
  consolidatedPriorPending: number;
  consolidatedInflow: number;
  consolidatedOutflow: number;
  consolidatedNetResult: number;
  consolidatedEndingBalance: number;
  consolidatedProjectedEndingBalanceCents: number;
  consolidatedProjectedEndingBalance: number;
  unallocatedInvoiceObligationsCents: number;
  unallocatedInvoiceObligations: number;
  unallocatedInvoices: UnallocatedInvoiceObligation[];
  diagnostics: ReportDiagnostics;
  accounts: AccountFlowItem[];
  consolidatedPoints: CashFlowPoint[];
}
