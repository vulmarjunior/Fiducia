import { Account, Category, CreditCard, Invoice, Transaction } from '../types';
import {
  SimulatedItem,
  SimulationComparison,
  SimulationChartPoint,
  SimulationHorizon,
  SimulationMonthPoint,
  SimulationSummary,
} from '../types/simulator';
import { calculateInvoicePeriod, parseLocalDate } from './utils';
import { buildCashCoverageProjection, calculateCashMargin } from './cashCoverage';
import { buildAccountFlowReport } from './reports/accountFlow';
import { normalizeTransactions, fromCents } from './reports/normalize';
import { ReportFilters } from '../types/reports';

export function getHorizonDates(
  horizon: SimulationHorizon,
  referenceDate: Date = new Date()
): { startDate: string; endDate: string } {
  const y = referenceDate.getFullYear();
  const m = referenceDate.getMonth();

  if (horizon === 'current_month') {
    const endDay = new Date(y, m + 1, 0).getDate();
    return {
      startDate: `${y}-${String(m + 1).padStart(2, '0')}-01`,
      endDate: `${y}-${String(m + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`,
    };
  }

  if (horizon === '3_months') {
    const endMonth = m + 2;
    const targetDate = new Date(y, endMonth + 1, 0);
    const endY = targetDate.getFullYear();
    const endM = targetDate.getMonth() + 1;
    const endD = targetDate.getDate();
    return {
      startDate: `${y}-${String(m + 1).padStart(2, '0')}-01`,
      endDate: `${endY}-${String(endM).padStart(2, '0')}-${String(endD).padStart(2, '0')}`,
    };
  }

  if (horizon === '6_months') {
    const endMonth = m + 5;
    const targetDate = new Date(y, endMonth + 1, 0);
    const endY = targetDate.getFullYear();
    const endM = targetDate.getMonth() + 1;
    const endD = targetDate.getDate();
    return {
      startDate: `${y}-${String(m + 1).padStart(2, '0')}-01`,
      endDate: `${endY}-${String(endM).padStart(2, '0')}-${String(endD).padStart(2, '0')}`,
    };
  }

  // current_year
  return {
    startDate: `${y}-01-01`,
    endDate: `${y}-12-31`,
  };
}

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
    const [, m, d] = simDay.date.split('-');
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

export interface MonthlySimulationResult {
  horizon: SimulationHorizon;
  intervalType: import('../types/simulator').SimulationIntervalType;
  startDate: string;
  endDate: string;
  summary: SimulationSummary;
  monthPoints: SimulationMonthPoint[];
  baseReport: import('../types/reports').AccountFlowReportResult;
  simulatedReport: import('../types/reports').AccountFlowReportResult;
  simulatedTransactions: Transaction[];
}

/**
 * Motor canônico de simulação baseado no relatório de Entradas × Saídas (Fluxo de Caixa).
 * Compara o Cenário Base (dados reais) com o Cenário Simulado (dados reais + hipóteses ativas)
 * com granularidade diária ou mensal, sem distorções temporais ou déficits artificiais.
 */
export function runMonthlySimulationComparison({
  accounts,
  transactions,
  creditCards,
  invoices,
  categories = [],
  simulatedItems,
  horizon = '3_months',
  intervalType = 'month',
  includeSavings = false,
  referenceDate = new Date(),
}: {
  accounts: Account[];
  transactions: Transaction[];
  creditCards: CreditCard[];
  invoices: Invoice[];
  categories?: Category[];
  simulatedItems: SimulatedItem[];
  horizon?: SimulationHorizon;
  intervalType?: import('../types/simulator').SimulationIntervalType;
  includeSavings?: boolean;
  referenceDate?: Date;
}): MonthlySimulationResult {
  const { startDate, endDate } = getHorizonDates(horizon, referenceDate);

  // 1. Gera transações sintéticas para as hipóteses ativas (horizonte de 365 dias para cobrir as parcelas)
  const syntheticTxs = generateSimulatedTransactions(simulatedItems, creditCards, 365);

  // 2. Normaliza base real
  const normalizedBase = normalizeTransactions(transactions, categories, creditCards, invoices);

  // 3. Normaliza cenário simulado (base real + sintéticos)
  const allTxs = [...transactions, ...syntheticTxs];
  const normalizedSimulated = normalizeTransactions(allTxs, categories, creditCards, invoices);

  // 4. Configuração de filtros para o buildAccountFlowReport (diário ou mensal)
  const filters: ReportFilters = {
    selectedMonth: startDate.slice(0, 7),
    customRange: { startDate, endDate },
    intervalType,
    status: 'all',
    accumulated: false,
    includePending: true,
    includeSavings,
  };

  // 5. Executa ambos os fluxos canônicos
  const baseRes = buildAccountFlowReport(accounts, creditCards, invoices, normalizedBase, filters);
  const simRes = buildAccountFlowReport(accounts, creditCards, invoices, normalizedSimulated, filters);

  const basePoints = baseRes.cashFlowResult.points;
  const simPoints = simRes.cashFlowResult.points;

  // 6. Monta pontos comparativos mês a mês
  const monthPoints: SimulationMonthPoint[] = basePoints.map((basePt, idx) => {
    const simPt = simPoints[idx] || basePt;

    const realInflow = basePt.inflow;
    const simulatedInflow = simPt.inflow;
    const inflowDelta = Math.round((simulatedInflow - realInflow) * 100) / 100;

    const realOutflow = basePt.outflow;
    const simulatedOutflow = simPt.outflow;
    const outflowDelta = Math.round((simulatedOutflow - realOutflow) * 100) / 100;

    const realNetResult = basePt.result;
    const simulatedNetResult = simPt.result;
    const netResultDelta = Math.round((simulatedNetResult - realNetResult) * 100) / 100;

    const realEndingBalance = basePt.projectedEndingBalanceCents !== undefined
      ? fromCents(basePt.projectedEndingBalanceCents)
      : (basePt.endingBalance || 0);

    const simulatedEndingBalance = simPt.projectedEndingBalanceCents !== undefined
      ? fromCents(simPt.projectedEndingBalanceCents)
      : (simPt.endingBalance || 0);

    const endingBalanceDelta = Math.round((simulatedEndingBalance - realEndingBalance) * 100) / 100;

    return {
      monthKey: basePt.periodKey,
      monthLabel: basePt.label,
      realInflow,
      simulatedInflow,
      inflowDelta,
      realOutflow,
      simulatedOutflow,
      outflowDelta,
      realNetResult,
      simulatedNetResult,
      netResultDelta,
      realEndingBalance,
      simulatedEndingBalance,
      endingBalanceDelta,
      entries: simPt.entries || basePt.entries || [],
    };
  });

  // 7. Sumário consolidado do período selecionado
  const realTotalInflow = baseRes.cashFlowResult.totalInflow;
  const simulatedTotalInflow = simRes.cashFlowResult.totalInflow;
  const inflowDelta = Math.round((simulatedTotalInflow - realTotalInflow) * 100) / 100;

  const realTotalOutflow = baseRes.cashFlowResult.totalOutflow;
  const simulatedTotalOutflow = simRes.cashFlowResult.totalOutflow;
  const outflowDelta = Math.round((simulatedTotalOutflow - realTotalOutflow) * 100) / 100;

  const realFinalBalance = baseRes.accountFlowResult.consolidatedProjectedEndingBalance;
  const simulatedFinalBalance = simRes.accountFlowResult.consolidatedProjectedEndingBalance;
  const finalBalanceDelta = Math.round((simulatedFinalBalance - realFinalBalance) * 100) / 100;

  const summary: SimulationSummary = {
    initialBalance: baseRes.cashFlowResult.startingBalance,
    realTotalInflow,
    simulatedTotalInflow,
    inflowDelta,
    realTotalOutflow,
    simulatedTotalOutflow,
    outflowDelta,
    realFinalBalance,
    simulatedFinalBalance,
    finalBalanceDelta,
  };

  return {
    horizon,
    intervalType,
    startDate,
    endDate,
    summary,
    monthPoints,
    baseReport: baseRes.accountFlowResult,
    simulatedReport: simRes.accountFlowResult,
    simulatedTransactions: syntheticTxs,
  };
}

