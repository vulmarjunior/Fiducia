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
  accountId: string;
  period: string;
  reconciledAt: string;
  totalReconciled: number;
  totalUnreconciled: number;
  type: 'account' | 'credit_card';
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
