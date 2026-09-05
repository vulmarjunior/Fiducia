import { CreditCard, Transaction } from '../types';
import { SimulatedItem, SimulationComparison, SimulationChartPoint } from '../types/simulator';
import { calculateInvoicePeriod, parseLocalDate } from './utils';
import { buildCashCoverageProjection, calculateCashMargin } from './cashCoverage';

/**
 * Gera transações sintéticas pendentes a partir das hipóteses simuladas ativas.
 */
export function generateSimulatedTransactions(
  items: SimulatedItem[],
  creditCards: CreditCard[],
  horizonDays: number = 180
): Transaction[] {
  const result: Transaction[] = [];
  const activeItems = items.filter(item => item.enabled && item.amount > 0);

  for (const item of activeItems) {
    if (item.type === 'card_expense') {
      const card = creditCards.find(c => c.id === item.cardId) || creditCards[0];
      if (!card) continue;

      const installments = Math.max(1, Math.min(24, item.installments || 1));
      const baseAmount = item.amount;
      const basePart = Math.floor((baseAmount / installments) * 100) / 100;
      const remainder = Math.round((baseAmount - basePart * installments) * 100) / 100;

      const baseDate = parseLocalDate(item.date);

      for (let i = 0; i < installments; i++) {
        const instDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, baseDate.getDate());
        const instDateStr = `${instDate.getFullYear()}-${String(instDate.getMonth() + 1).padStart(2, '0')}-${String(instDate.getDate()).padStart(2, '0')}`;
        const invoicePeriod = calculateInvoicePeriod(instDate, card.closingDay, card.dueDay);

        // A última parcela absorve eventuais arredondamentos de centavos
        const instAmount = i === installments - 1 ? basePart + remainder : basePart;

        result.push({
          id: `sim-${item.id}-inst-${i + 1}`,
          userId: 'simulation',
          type: 'despesa',
          amount: Math.max(0.01, instAmount),
          date: `${instDateStr}T12:00:00`,
          description: installments > 1 ? `${item.name} (${i + 1}/${installments})` : item.name,
          status: 'pendente',
          creditCardId: card.id,
          accountId: card.id,
          invoicePeriod,
          installmentNumber: i + 1,
          totalInstallments: installments,
          categoryId: item.categoryId,
          createdAt: new Date().toISOString(),
        });
      }
    } else {
      // Receita ou Despesa bancária direta
      const txType = item.type === 'income' ? 'receita' : 'despesa';
      const baseDate = parseLocalDate(item.date);

      if (item.recurrence === 'monthly') {
        const monthsCount = Math.min(24, Math.ceil(horizonDays / 30));
        for (let i = 0; i < monthsCount; i++) {
          const recDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, baseDate.getDate());
          const dateStr = `${recDate.getFullYear()}-${String(recDate.getMonth() + 1).padStart(2, '0')}-${String(recDate.getDate()).padStart(2, '0')}`;
          result.push({
            id: `sim-${item.id}-rec-${i + 1}`,
            userId: 'simulation',
            type: txType,
            amount: item.amount,
            date: `${dateStr}T12:00:00`,
            description: `${item.name} (mês ${i + 1})`,
            status: 'pendente',
            accountId: item.accountId,
            categoryId: item.categoryId,
            createdAt: new Date().toISOString(),
          });
        }
      } else {
        // Avulso
        result.push({
          id: `sim-${item.id}`,
          userId: 'simulation',
          type: txType,
          amount: item.amount,
          date: `${item.date}T12:00:00`,
          description: item.name,
          status: 'pendente',
          accountId: item.accountId,
          categoryId: item.categoryId,
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  return result;
}

export interface SimulationResult {
  comparison: SimulationComparison;
  chartData: SimulationChartPoint[];
  dailyAlerts: { date: string; simulatedBalance: number; realBalance: number; diff: number }[];
  realProjection: ReturnType<typeof buildCashCoverageProjection>;
  simulatedProjection: ReturnType<typeof buildCashCoverageProjection>;
}

/**
 * Executa o comparativo completo de projeção de caixa entre os dados Reais e Reais + Simulados.
 */
export function runSimulationComparison({
  accounts,
  transactions,
  creditCards,
  invoices,
  recurrenceRules = [],
  simulatedItems,
  safetyReserve = 0,
  days = 90,
  includeSavings = false,
}: {
  accounts: any[];
  transactions: any[];
  creditCards: any[];
  invoices: any[];
  recurrenceRules?: any[];
  simulatedItems: SimulatedItem[];
  safetyReserve?: number;
  days?: number;
  includeSavings?: boolean;
}): SimulationResult {
  const options = {
    days,
    includeSavings,
    includeRecurrences: true,
  };

  // 1. Projeção Base Real
  const realProjection = buildCashCoverageProjection({
    accounts,
    transactions,
    creditCards,
    invoices,
    recurrenceRules,
    options,
  });

  // 2. Geração de Lançamentos Sintéticos
  const simulatedTransactions = generateSimulatedTransactions(simulatedItems, creditCards, days);

  // 3. Projeção Simulada (Base Real + Sintéticos)
  const simulatedProjection = buildCashCoverageProjection({
    accounts,
    transactions: [...transactions, ...simulatedTransactions],
    creditCards,
    invoices,
    recurrenceRules,
    options,
  });

  // 4. Métricas Comparativas
  const realMargin = calculateCashMargin(realProjection.minimumBalance, safetyReserve);
  const simulatedMargin = calculateCashMargin(simulatedProjection.minimumBalance, safetyReserve);

  const comparison: SimulationComparison = {
    realMargin,
    simulatedMargin,
    marginDelta: simulatedMargin - realMargin,
    realMinBalance: realProjection.minimumBalance,
    simulatedMinBalance: simulatedProjection.minimumBalance,
    realMinBalanceDate: realProjection.minimumBalanceDate,
    simulatedMinBalanceDate: simulatedProjection.minimumBalanceDate,
    realDaysAtRisk: realProjection.daysAtRisk,
    simulatedDaysAtRisk: simulatedProjection.daysAtRisk,
    realEndingBalance: realProjection.endingBalance,
    simulatedEndingBalance: simulatedProjection.endingBalance,
    endingBalanceDelta: simulatedProjection.endingBalance - realProjection.endingBalance,
    realTotalIncome: realProjection.totalIncome,
    simulatedTotalIncome: simulatedProjection.totalIncome,
    realTotalObligations: realProjection.totalObligations,
    simulatedTotalObligations: simulatedProjection.totalObligations,
  };

  // 5. Pontos para Gráfico Unificado
  const realDaysMap = new Map<string, number>();
  realProjection.dailyProjection.forEach(d => realDaysMap.set(d.date, d.endingBalance));

  const chartData: SimulationChartPoint[] = simulatedProjection.dailyProjection.map(simDay => {
    const realBal = realDaysMap.get(simDay.date) ?? simDay.startingBalance;
    const simBal = simDay.endingBalance;
    const [y, m, d] = simDay.date.split('-');
    return {
      date: simDay.date,
      label: `${d}/${m}`,
      realBalance: realBal,
      simulatedBalance: simBal,
      diff: simBal - realBal,
    };
  });

  // 6. Alertas Diários (dias com déficit na simulação ou que entraram no vermelho)
  const dailyAlerts = simulatedProjection.dailyProjection
    .filter(d => d.endingBalance < 0)
    .map(d => {
      const realBal = realDaysMap.get(d.date) ?? d.startingBalance;
      return {
        date: d.date,
        simulatedBalance: d.endingBalance,
        realBalance: realBal,
        diff: d.endingBalance - realBal,
      };
    });

  return {
    comparison,
    chartData,
    dailyAlerts,
    realProjection,
    simulatedProjection,
  };
}
