export interface User {
  id?: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface Account {
  id?: string;
  userId: string;
  name: string;
  type: 'checking' | 'savings' | 'wallet' | 'investment';
  balance: number;
  initialBalance?: number;
  agency?: string;
  accountNumber?: string;
  bankCode?: string;
  bankName?: string;
  bankLogo?: string;
  excludeFromCashFlow?: boolean;
  openingDate?: string;
  createdAt: string;
}

export interface CreditCard {
  id?: string;
  userId: string;
  name: string;
  limit: number;
  closingDay: number;
  dueDay: number;
  createdAt: string;
}

export interface Category {
  id?: string;
  userId: string;
  name: string;
  type: 'income' | 'expense';
  icon: string;
  isDefault: boolean;
  parentId?: string;
  createdAt: string;
}

export interface Tag {
  id?: string;
  userId: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface ActivityLog {
  id?: string;
  userId: string;
  action: 'create' | 'update' | 'delete';
  entityType: 'transaction' | 'budget' | 'goal' | 'account' | 'creditCard' | 'category' | 'tag';
  entityId: string;
  description: string;
  dataBefore?: any;
  dataAfter?: any;
  createdAt: string;
}

export interface Transaction {
  id?: string;
  userId: string;
  type: 'income' | 'expense' | 'transfer' | 'receita' | 'despesa' | 'transferencia';
  amount: number;
  date: string;
  description: string;
  categoryId?: string;
  accountId?: string;
  destinationAccountId?: string;
  creditCardId?: string;
  invoicePeriod?: string;
  status: 'paid' | 'pending' | 'cancelled' | 'pago' | 'pendente' | 'cancelado' | 'realizado';
  installmentId?: string;
  isRecurring?: boolean;
  frequency?: 'mensal' | 'semanal' | 'anual';
  installmentNumber?: number;
  totalInstallments?: number;
  parentId?: string;
  ccRecurrenceType?: 'avulso' | 'parcelado' | 'fixo';
  originalPurchaseDate?: string;
  postingDate?: string;
  isSystemGeneratedDate?: boolean;
  ofxId?: string;
  tags?: string[];
  observation?: string;
  reconciliationStatus?: 'conciliado' | 'nao_conciliado' | 'ignorado';
  createdAt: string;
  updatedAt?: string;
}

export interface RecurrenceRule {
  id?: string;
  userId: string;
  accountId: string;
  categoryId?: string;
  amount: number;
  description: string;
  frequency: 'mensal' | 'semanal' | 'anual';
  billingDay: number;
  status: 'active' | 'inactive';
  type: 'income' | 'expense' | 'receita' | 'despesa';
  tags?: string[];
  observation?: string;
  startDate: string;
  endDate?: string;
  createdAt: string;
}

export interface Installment {
  id?: string;
  userId: string;
  type: 'income' | 'expense';
  totalAmount: number;
  numberOfInstallments: number;
  startDate: string;
  description: string;
  categoryId?: string;
  accountId?: string;
  creditCardId?: string;
  createdAt: string;
}

export interface Invoice {
  id?: string;
  userId: string;
  cardId: string;
  period: string;
  status: 'aberta' | 'fechada' | 'paga';
  totalAmount: number;
  closedAt?: string;
  paymentTransactionId?: string;
}

export interface ReconciliationHistory {
  id?: string;
  userId: string;
  accountId?: string;
  cardId?: string;
  period: string;
  invoicePeriod?: string;
  reconciledAt: string;
  totalReconciled?: number;
  totalUnreconciled?: number;
  type: 'account' | 'credit_card' | 'credit_card_invoice';
  source?: InvoiceImportSource;
  totals?: {
    importedLinesTotal: number;
    systemPeriodTotal: number;
    matchedTotal: number;
    invoiceDeclaredTotal?: number;
    difference: number;
  };
  counts?: {
    imported: number;
    created: number;
    updated: number;
    reconciled: number;
    ignored: number;
    manualReview: number;
  };
  createdAt?: string;
}

export type InvoiceImportSource = 'pdf' | 'csv' | 'xlsx';

export type InvoiceLineKind =
  | 'purchase'
  | 'installment'
  | 'credit'
  | 'refund'
  | 'fee'
  | 'payment'
  | 'unknown';

export type InvoiceLineAction =
  | 'confirm_match'
  | 'create_transaction'
  | 'update_transaction'
  | 'ignore'
  | 'manual_review';

export interface ImportedInvoiceLine {
  id: string;
  source: InvoiceImportSource;
  rawText?: string;
  date: string;
  description: string;
  normalizedDescription?: string;
  amount: number;
  type: 'despesa' | 'receita';
  kind: InvoiceLineKind;
  installmentNumber?: number;
  totalInstallments?: number;
  suggestedCategoryId?: string;
  confidence: number;
}

export interface InvoiceLineMatch {
  importedLineId: string;
  systemTransactionId?: string;
  confidence: number;
  reason: string;
  differences: {
    amount?: { imported: number; system: number };
    date?: { imported: string; system: string };
    description?: { imported: string; system: string };
    categoryId?: { imported?: string; system?: string };
  };
  suggestedAction: InvoiceLineAction;
}

export interface InvoiceReconciliationDraft {
  cardId: string;
  invoicePeriod: string;
  source: InvoiceImportSource;
  importedLines: ImportedInvoiceLine[];
  matches: InvoiceLineMatch[];
  totals: {
    importedLinesTotal: number;
    systemPeriodTotal: number;
    matchedTotal: number;
    invoiceDeclaredTotal?: number;
    difference: number;
  };
}

export interface ClosedPeriod {
  id?: string;
  userId: string;
  accountId: string;
  period: string;
  closedAt: string;
}

export interface Budget {
  id?: string;
  userId: string;
  categoryId: string;
  amount: number;
  period: 'monthly';
  createdAt: string;
}

export interface Goal {
  id?: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  createdAt: string;
}
