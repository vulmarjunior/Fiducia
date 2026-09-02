import type { Account, CreditCard, Invoice } from '../../types';
import type {
  AccountFlowItem,
  AccountFlowReportResult,
  CashFlowPoint,
  CashFlowReportResult,
  NormalizedTransaction,
  ReportFilters,
} from '../../types/reports';
import { fromCents, toCents } from './normalize';
import { generateBuckets, getMonthBounds } from './periods';
import { buildInvoiceObligations } from './invoiceEvents';
import { getTransactionEffect } from '../utils';

export function calculateStartingBalanceCents(
  account: Account,
  transactions: NormalizedTransaction[],
  startDate: string
): number {
  const initialCents = toCents(account.initialBalance || 0);

  // Considera transações realizadas anteriores à data de início
  let sumCents = 0;
  for (const tx of transactions) {
    if (tx.status !== 'paid') continue;
    if (tx.date >= startDate) continue;
    if (tx.isCard) continue;

    // Efeito bancário usando getTransactionEffect canônico
    const effect = getTransactionEffect(
      {
        type: tx.type,
        amount: tx.amountCents / 100,
        accountId: tx.accountId,
        destinationAccountId: tx.destinationAccountId,
      },
      account.id || ''
    );

    sumCents += toCents(effect);
  }

  return initialCents + sumCents;
}

export function buildAccountFlowReport(
  accounts: Account[],
  creditCards: CreditCard[],
  invoices: Invoice[],
  transactions: NormalizedTransaction[],
  filters: ReportFilters
): {
  cashFlowResult: CashFlowReportResult;
  accountFlowResult: AccountFlowReportResult;
} {
  const { selectedMonth, customRange, originIds, status, intervalType, accumulated, includePending } = filters;
  const { startDate, endDate } = customRange || getMonthBounds(selectedMonth);

  // Filtragem de contas bancárias (cartões não entram como contas de caixa)
  const selectedAccountIds = originIds && originIds.length > 0
    ? new Set(originIds)
    : new Set(accounts.map(a => a.id).filter((id): id is string => Boolean(id)));

  const activeAccounts = accounts.filter(a => selectedAccountIds.has(a.id || ''));

  // Buckets para agregação temporal
  const buckets = generateBuckets(startDate, endDate, intervalType);

  // Processamento por conta individual
  const accountFlowItems: AccountFlowItem[] = [];

  let totalConsolidatedStartingCents = 0;
  let totalConsolidatedInflowCents = 0;
  let totalConsolidatedOutflowCents = 0;
  let totalConsolidatedResultCents = 0;
  let totalConsolidatedEndingCents = 0;
  let totalConsolidatedPendingNetCents = 0;

  for (const account of activeAccounts) {
    const accountId = account.id || '';
    const startingBalanceCents = calculateStartingBalanceCents(account, transactions, startDate);

    let inflowCents = 0;
    let outflowCents = 0;
    let pendingInflowCents = 0;
    let pendingOutflowCents = 0;
    const accountEntries: NormalizedTransaction[] = [];

    // Estrutura de pontos por bucket para a conta
    const accountPoints: CashFlowPoint[] = buckets.map(b => ({
      periodKey: b.key,
      label: b.label,
      startDate: b.startDate,
      endDate: b.endDate,
      inflowCents: 0,
      outflowCents: 0,
      resultCents: 0,
      inflow: 0,
      outflow: 0,
      result: 0,
      hasPending: false,
      pendingInflowCents: 0,
      pendingOutflowCents: 0,
      pendingResultCents: 0,
      entries: [],
    }));

    // Movimentações no período
    for (const tx of transactions) {
      if (tx.isCard) continue;
      if (tx.date < startDate || tx.date > endDate) continue;

      const effect = getTransactionEffect(
        {
          type: tx.type,
          amount: tx.amountCents / 100,
          accountId: tx.accountId,
          destinationAccountId: tx.destinationAccountId,
        },
        accountId
      );

      if (effect === 0) continue;

      const effectCents = toCents(effect);
      const isPaid = tx.status === 'paid';
      const isPending = tx.status === 'pending';

      // Filtro de status da tela
      if (status === 'paid' && !isPaid) continue;
      if (status === 'pending' && !isPending) continue;

      accountEntries.push(tx);

      // Bucket correspondente
      const bIdx = buckets.findIndex(b => tx.date >= b.startDate && tx.date <= b.endDate);

      if (isPaid) {
        if (effectCents > 0) {
          inflowCents += effectCents;
          if (bIdx !== -1) {
            accountPoints[bIdx].inflowCents += effectCents;
          }
        } else {
          outflowCents += Math.abs(effectCents);
          if (bIdx !== -1) {
            accountPoints[bIdx].outflowCents += Math.abs(effectCents);
          }
        }
      } else if (isPending && (includePending || status === 'pending')) {
        if (effectCents > 0) {
          pendingInflowCents += effectCents;
          if (bIdx !== -1) {
            accountPoints[bIdx].pendingInflowCents += effectCents;
            accountPoints[bIdx].hasPending = true;
          }
        } else {
          pendingOutflowCents += Math.abs(effectCents);
          if (bIdx !== -1) {
            accountPoints[bIdx].pendingOutflowCents += Math.abs(effectCents);
            accountPoints[bIdx].hasPending = true;
          }
        }
      }

      if (bIdx !== -1) {
        accountPoints[bIdx].entries.push(tx);
      }
    }

    const netResultCents = inflowCents - outflowCents;
    const endingBalanceCents = startingBalanceCents + netResultCents;
    const pendingNetCents = pendingInflowCents - pendingOutflowCents;
    const projectedEndingBalanceCents = endingBalanceCents + pendingNetCents;

    // Calcula saldos de cada bucket da conta
    let runningBalanceCents = startingBalanceCents;
    let runningAccumInflowCents = 0;
    let runningAccumOutflowCents = 0;
    let runningAccumResultCents = 0;

    for (const pt of accountPoints) {
      pt.resultCents = pt.inflowCents - pt.outflowCents;
      pt.pendingResultCents = pt.pendingInflowCents - pt.pendingOutflowCents;
      
      runningBalanceCents += pt.resultCents;
      pt.endingBalanceCents = runningBalanceCents;
      pt.endingBalance = fromCents(runningBalanceCents);

      if (accumulated) {
        runningAccumInflowCents += pt.inflowCents;
        runningAccumOutflowCents += pt.outflowCents;
        runningAccumResultCents += pt.resultCents;

        pt.inflow = fromCents(runningAccumInflowCents);
        pt.outflow = fromCents(runningAccumOutflowCents);
        pt.result = fromCents(runningAccumResultCents);
      } else {
        pt.inflow = fromCents(pt.inflowCents);
        pt.outflow = fromCents(pt.outflowCents);
        pt.result = fromCents(pt.resultCents);
      }
    }

    totalConsolidatedStartingCents += startingBalanceCents;
    totalConsolidatedEndingCents += endingBalanceCents;
    totalConsolidatedPendingNetCents += pendingNetCents;

    accountFlowItems.push({
      accountId,
      accountName: account.name,
      accountType: account.type,
      startingBalanceCents,
      inflowCents,
      outflowCents,
      netResultCents,
      endingBalanceCents,
      startingBalance: fromCents(startingBalanceCents),
      inflow: fromCents(inflowCents),
      outflow: fromCents(outflowCents),
      netResult: fromCents(netResultCents),
      endingBalance: fromCents(endingBalanceCents),
      pendingInflowCents,
      pendingOutflowCents,
      pendingNetCents,
      projectedEndingBalanceCents,
      projectedEndingBalance: fromCents(projectedEndingBalanceCents),
      isReconciled: true,
      points: accountPoints,
      entries: accountEntries,
    });
  }

  // Processamento Consolidado para Entradas × Saídas e Fluxo Geral
  // No consolidado, transferências entre duas contas da seleção devem ser neutralizadas!
  const consolidatedPoints: CashFlowPoint[] = buckets.map(b => ({
    periodKey: b.key,
    label: b.label,
    startDate: b.startDate,
    endDate: b.endDate,
    inflowCents: 0,
    outflowCents: 0,
    resultCents: 0,
    inflow: 0,
    outflow: 0,
    result: 0,
    hasPending: false,
    pendingInflowCents: 0,
    pendingOutflowCents: 0,
    pendingResultCents: 0,
    entries: [],
  }));

  const consolidatedEntries: NormalizedTransaction[] = [];

  for (const tx of transactions) {
    if (tx.isCard) continue;
    if (tx.date < startDate || tx.date > endDate) continue;

    const fromAccSelected = Boolean(tx.accountId && selectedAccountIds.has(tx.accountId));
    const toAccSelected = Boolean(tx.destinationAccountId && selectedAccountIds.has(tx.destinationAccountId));

    // Se nenhuma das contas envolvidas está selecionada, ignora
    if (!fromAccSelected && !toAccSelected) continue;

    const isPaid = tx.status === 'paid';
    const isPending = tx.status === 'pending';

    if (status === 'paid' && !isPaid) continue;
    if (status === 'pending' && !isPending) continue;

    const bIdx = buckets.findIndex(b => tx.date >= b.startDate && tx.date <= b.endDate);

    if (tx.type === 'transfer') {
      if (fromAccSelected && toAccSelected) {
        // Ambas selecionadas: transferência puramente interna -> neutralizada no total consolidado
        if (bIdx !== -1) {
          consolidatedPoints[bIdx].entries.push(tx);
        }
        consolidatedEntries.push(tx);
        continue;
      }

      if (fromAccSelected && !toAccSelected) {
        // Saindo da seleção para conta externa -> saída consolidada
        if (isPaid) {
          totalConsolidatedOutflowCents += tx.amountCents;
          if (bIdx !== -1) consolidatedPoints[bIdx].outflowCents += tx.amountCents;
        } else if (isPending && (includePending || status === 'pending')) {
          if (bIdx !== -1) {
            consolidatedPoints[bIdx].pendingOutflowCents += tx.amountCents;
            consolidatedPoints[bIdx].hasPending = true;
          }
        }
      } else if (!fromAccSelected && toAccSelected) {
        // Entrando na seleção vindo de conta externa -> entrada consolidada
        if (isPaid) {
          totalConsolidatedInflowCents += tx.amountCents;
          if (bIdx !== -1) consolidatedPoints[bIdx].inflowCents += tx.amountCents;
        } else if (isPending && (includePending || status === 'pending')) {
          if (bIdx !== -1) {
            consolidatedPoints[bIdx].pendingInflowCents += tx.amountCents;
            consolidatedPoints[bIdx].hasPending = true;
          }
        }
      }
    } else if (tx.type === 'income') {
      if (isPaid) {
        totalConsolidatedInflowCents += tx.amountCents;
        if (bIdx !== -1) consolidatedPoints[bIdx].inflowCents += tx.amountCents;
      } else if (isPending && (includePending || status === 'pending')) {
        if (bIdx !== -1) {
          consolidatedPoints[bIdx].pendingInflowCents += tx.amountCents;
          consolidatedPoints[bIdx].hasPending = true;
        }
      }
    } else if (tx.type === 'expense') {
      if (isPaid) {
        totalConsolidatedOutflowCents += tx.amountCents;
        if (bIdx !== -1) consolidatedPoints[bIdx].outflowCents += tx.amountCents;
      } else if (isPending && (includePending || status === 'pending')) {
        if (bIdx !== -1) {
          consolidatedPoints[bIdx].pendingOutflowCents += tx.amountCents;
          consolidatedPoints[bIdx].hasPending = true;
        }
      }
    }

    if (bIdx !== -1) {
      consolidatedPoints[bIdx].entries.push(tx);
    }
    consolidatedEntries.push(tx);
  }

  totalConsolidatedResultCents = totalConsolidatedInflowCents - totalConsolidatedOutflowCents;

  let runningConsolidatedBalance = totalConsolidatedStartingCents;
  let runningAccumConsolidatedInflow = 0;
  let runningAccumConsolidatedOutflow = 0;
  let runningAccumConsolidatedResult = 0;

  for (const pt of consolidatedPoints) {
    pt.resultCents = pt.inflowCents - pt.outflowCents;
    pt.pendingResultCents = pt.pendingInflowCents - pt.pendingOutflowCents;

    runningConsolidatedBalance += pt.resultCents;
    pt.endingBalanceCents = runningConsolidatedBalance;
    pt.endingBalance = fromCents(runningConsolidatedBalance);

    if (accumulated) {
      runningAccumConsolidatedInflow += pt.inflowCents;
      runningAccumConsolidatedOutflow += pt.outflowCents;
      runningAccumConsolidatedResult += pt.resultCents;

      pt.inflow = fromCents(runningAccumConsolidatedInflow);
      pt.outflow = fromCents(runningAccumConsolidatedOutflow);
      pt.result = fromCents(runningAccumConsolidatedResult);
    } else {
      pt.inflow = fromCents(pt.inflowCents);
      pt.outflow = fromCents(pt.outflowCents);
      pt.result = fromCents(pt.resultCents);
    }
  }

  // Obrigações residuais de faturas de cartão
  const invoiceObligations = buildInvoiceObligations(invoices, creditCards, transactions, selectedMonth);
  const unallocatedCents = invoiceObligations.totalResidualCents;

  const consolidatedProjectedEndingCents = totalConsolidatedEndingCents + totalConsolidatedPendingNetCents - unallocatedCents;

  const cashFlowResult: CashFlowReportResult = {
    totalInflowCents: totalConsolidatedInflowCents,
    totalOutflowCents: totalConsolidatedOutflowCents,
    netResultCents: totalConsolidatedResultCents,
    totalInflow: fromCents(totalConsolidatedInflowCents),
    totalOutflow: fromCents(totalConsolidatedOutflowCents),
    netResult: fromCents(totalConsolidatedResultCents),
    startingBalanceCents: totalConsolidatedStartingCents,
    endingBalanceCents: totalConsolidatedEndingCents,
    startingBalance: fromCents(totalConsolidatedStartingCents),
    endingBalance: fromCents(totalConsolidatedEndingCents),
    points: consolidatedPoints,
  };

  const accountFlowResult: AccountFlowReportResult = {
    consolidatedStartingBalanceCents: totalConsolidatedStartingCents,
    consolidatedInflowCents: totalConsolidatedInflowCents,
    consolidatedOutflowCents: totalConsolidatedOutflowCents,
    consolidatedNetResultCents: totalConsolidatedResultCents,
    consolidatedEndingBalanceCents: totalConsolidatedEndingCents,
    consolidatedStartingBalance: fromCents(totalConsolidatedStartingCents),
    consolidatedInflow: fromCents(totalConsolidatedInflowCents),
    consolidatedOutflow: fromCents(totalConsolidatedOutflowCents),
    consolidatedNetResult: fromCents(totalConsolidatedResultCents),
    consolidatedEndingBalance: fromCents(totalConsolidatedEndingCents),
    consolidatedProjectedEndingBalanceCents: consolidatedProjectedEndingCents,
    consolidatedProjectedEndingBalance: fromCents(consolidatedProjectedEndingCents),
    unallocatedInvoiceObligationsCents: unallocatedCents,
    unallocatedInvoiceObligations: fromCents(unallocatedCents),
    unallocatedInvoices: invoiceObligations.obligations,
    accounts: accountFlowItems,
    consolidatedPoints,
  };

  return {
    cashFlowResult,
    accountFlowResult,
  };
}
