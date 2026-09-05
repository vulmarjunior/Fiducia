export type SimulationItemType = 'expense' | 'income' | 'card_expense';

export interface SimulatedItem {
  id: string;
  name: string;
  type: SimulationItemType;
  amount: number;
  date: string; // YYYY-MM-DD
  enabled: boolean;
  installments?: number; // Para compras no cartão (1 a 24)
  cardId?: string;       // Cartão de crédito selecionado
  accountId?: string;    // Conta bancária de débito/crédito
  categoryId?: string;   // Categoria opcional
  recurrence?: 'none' | 'monthly' | 'yearly';
  notes?: string;
  createdAt: string;
}

export interface SimulationComparison {
  realMargin: number;
  simulatedMargin: number;
  marginDelta: number;
  realMinBalance: number;
  simulatedMinBalance: number;
  realMinBalanceDate: string;
  simulatedMinBalanceDate: string;
  realDaysAtRisk: number;
  simulatedDaysAtRisk: number;
  realEndingBalance: number;
  simulatedEndingBalance: number;
  endingBalanceDelta: number;
  realTotalIncome: number;
  simulatedTotalIncome: number;
  realTotalObligations: number;
  simulatedTotalObligations: number;
}

export interface SimulationChartPoint {
  date: string;
  label: string;
  realBalance: number;
  simulatedBalance: number;
  diff: number;
}
