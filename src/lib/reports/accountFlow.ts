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
  startDate: string,
  endDate: string
): number {
  const accountId = account.id || '';
  if (!accountId) return 0;

  // F4: Data de abertura da conta
  const openingDate = account.openingDate || (account.createdAt ? account.createdAt.slice(0, 10) : undefined);
  if (openingDate && openingDate > endDate) {
    // Conta aberta no futuro em relação ao período consultado: não fornece capital
    return 0;
  }

  let initialCents = toCents(account.initialBalance || 0);

  // Se a conta abriu DURANTE o período (startDate <= openingDate <= endDate),
  // o saldo antes de startDate é 0 (o capital entra na data de abertura)
  if (openingDate && openingDate >= startDate && openingDate <= endDate) {
    initialCents = 0;
  }

  // F1: Considera apenas transações realizadas anteriores a startDate que pertençam a ESTA conta
  let sumCents = 0;
  for (const tx of transactions) {
    if (tx.status !== 'paid') continue;
    if (tx.date >= startDate) continue;
    if (tx.isCard) continue;

    const isOrigin = tx.accountId === accountId;
    const isDest = tx.destinationAccountId === accountId;
    if (!isOrigin && !isDest) continue;

    const effect = getTransactionEffect(
      {
        type: tx.type,
        amount: tx.amountCents / 100,
        accountId: tx.accountId,
        destinationAccountId: tx.destinationAccountId,
      },
      accountId
    );

    sumCents += toCents(effect);
  }

  return initialCents + sumCents;
}

export function checkAccountReconciliation(
  account: Account,
  transactions: NormalizedTransaction[]
): boolean {
  // F4: Ausência de saldo inicial não pode resultar em conciliado
  if (account.initialBalance === undefined || account.initialBalance === null || isNaN(account.initialBalance)) {
    return false;
  }

  // Se o saldo persistido (account.balance) não estiver definido ou for nulo
  if (account.balance === undefined || account.balance === null || isNaN(account.balance)) {
    return false;
  }

  const accountId = account.id || '';
  if (!accountId) return false;

  // Reconciliação: initialBalance + sum(effect de todos os realizados desta conta) == account.balance
  let currentCalculatedCents = toCents(account.initialBalance);
  for (const tx of transactions) {
    if (tx.status !== 'paid') continue;
    if (tx.isCard) continue;

    const isOrigin = tx.accountId === accountId;
    const isDest = tx.destinationAccountId === accountId;
    if (!isOrigin && !isDest) continue;

    const effect = getTransactionEffect(
      {
        type: tx.type,
        amount: tx.amountCents / 100,
        accountId: tx.accountId,
        destinationAccountId: tx.destinationAccountId,
      },
      accountId
    );

    currentCalculatedCents += toCents(effect);
  }

  const persistedCents = toCents(account.balance);
  return Math.abs(currentCalculatedCents - persistedCents) <= 1; // tolerância de 1 centavo para arredondamento
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

  // F6: Seleção vazia não equivale a todas as contas. Se originIds for fornecido e vazio ([]), exibe 0 contas.
  if (originIds !== undefined && originIds.length === 0) {
    const emptyCashFlow: CashFlowReportResult = {
      totalInflowCents: 0,
      totalOutflowCents: 0,
      netResultCents: 0,
      totalInflow: 0,
      totalOutflow: 0,
      netResult: 0,
      startingBalanceCents: 0,
      endingBalanceCents: 0,
      startingBalance: 0,
      endingBalance: 0,
      points: [],
    };

    const emptyAccountFlow: AccountFlowReportResult = {
      consolidatedStartingBalanceCents: 0,
      consolidatedInflowCents: 0,
      consolidatedOutflowCents: 0,
      consolidatedNetResultCents: 0,
      consolidatedEndingBalanceCents: 0,
      consolidatedStartingBalance: 0,
      consolidatedInflow: 0,
      consolidatedOutflow: 0,
      consolidatedNetResult: 0,
      consolidatedEndingBalance: 0,
      consolidatedProjectedEndingBalanceCents: 0,
      consolidatedProjectedEndingBalance: 0,
      unallocatedInvoiceObligationsCents: 0,
      unallocatedInvoiceObligations: 0,
      unallocatedInvoices: [],
      accounts: [],
      consolidatedPoints: [],
    };

    return { cashFlowResult: emptyCashFlow, accountFlowResult: emptyAccountFlow };
  }

  const selectedAccountIds = originIds !== undefined
    ? new Set(originIds)
    : new Set(accounts.map(a => a.id).filter((id): id is string => Boolean(id)));

  const activeAccounts = accounts.filter(a => selectedAccountIds.has(a.id || ''));

  // Buckets para agregação temporal
  const buckets = generateBuckets(startDate, endDate, intervalType);

  // Processamento por conta individual
  const accountFlowItems: AccountFlowItem[] = [];

  for (const account of activeAccounts) {
    const accountId = account.id || '';
    const startingBalanceCents = calculateStartingBalanceCents(account, transactions, startDate, endDate);
    const isReconciled = checkAccountReconciliation(account, transactions);

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

    // F4: Capital de abertura durante o período
    const openingDate = account.openingDate || (account.createdAt ? account.createdAt.slice(0, 10) : undefined);
    if (openingDate && openingDate >= startDate && openingDate <= endDate && account.initialBalance) {
      const openCapitalCents = toCents(account.initialBalance);
      if (openCapitalCents > 0) {
        inflowCents += openCapitalCents;
        const bIdx = buckets.findIndex(b => openingDate >= b.startDate && openingDate <= b.endDate);
        if (bIdx !== -1) {
          accountPoints[bIdx].inflowCents += openCapitalCents;
        }
      }
    }

    // Movimentações no período
    for (const tx of transactions) {
      if (tx.isCard) continue;
      if (tx.date < startDate || tx.date > endDate) continue;

      // F1: Pertinência estrita a ESTA conta (origem ou destino)
      const isOrigin = tx.accountId === accountId;
      const isDest = tx.destinationAccountId === accountId;
      if (!isOrigin && !isDest) continue;

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

      // F3 / Caso 15: se somente realizados (includePending === false), exclui pendências do detalhamento
      if (!includePending && status !== 'pending' && isPending) {
        continue;
      }

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

    // F3: Se includePending === true, os totais de fluxo exibidos incorporam as pendências
    const displayedInflowCents = includePending ? inflowCents + pendingInflowCents : inflowCents;
    const displayedOutflowCents = includePending ? outflowCents + pendingOutflowCents : outflowCents;
    const displayedNetResultCents = displayedInflowCents - displayedOutflowCents;
    const realizedEndingBalanceCents = startingBalanceCents + (inflowCents - outflowCents);
    const endingBalanceCents = realizedEndingBalanceCents;

    const pendingNetCents = pendingInflowCents - pendingOutflowCents;
    const projectedEndingBalanceCents = realizedEndingBalanceCents + pendingNetCents;

    // Calcula saldos de cada bucket da conta
    let runningBalanceCents = startingBalanceCents;
    let runningAccumInflowCents = 0;
    let runningAccumOutflowCents = 0;
    let runningAccumResultCents = 0;

    for (const pt of accountPoints) {
      const ptInflow = includePending ? pt.inflowCents + pt.pendingInflowCents : pt.inflowCents;
      const ptOutflow = includePending ? pt.outflowCents + pt.pendingOutflowCents : pt.outflowCents;
      const ptResult = ptInflow - ptOutflow;

      pt.resultCents = ptResult;
      pt.pendingResultCents = pt.pendingInflowCents - pt.pendingOutflowCents;

      runningBalanceCents += ptResult;
      pt.endingBalanceCents = runningBalanceCents;
      pt.endingBalance = fromCents(runningBalanceCents);

      if (accumulated) {
        runningAccumInflowCents += ptInflow;
        runningAccumOutflowCents += ptOutflow;
        runningAccumResultCents += ptResult;

        pt.inflow = fromCents(runningAccumInflowCents);
        pt.outflow = fromCents(runningAccumOutflowCents);
        pt.result = fromCents(runningAccumResultCents);
      } else {
        pt.inflow = fromCents(ptInflow);
        pt.outflow = fromCents(ptOutflow);
        pt.result = fromCents(ptResult);
      }
    }

    accountFlowItems.push({
      accountId,
      accountName: account.name,
      accountType: account.type,
      startingBalanceCents,
      inflowCents: displayedInflowCents,
      outflowCents: displayedOutflowCents,
      netResultCents: displayedNetResultCents,
      endingBalanceCents,
      startingBalance: fromCents(startingBalanceCents),
      inflow: fromCents(displayedInflowCents),
      outflow: fromCents(displayedOutflowCents),
      netResult: fromCents(displayedNetResultCents),
      endingBalance: fromCents(endingBalanceCents),
      pendingInflowCents,
      pendingOutflowCents,
      pendingNetCents,
      projectedEndingBalanceCents,
      projectedEndingBalance: fromCents(projectedEndingBalanceCents),
      isReconciled,
      points: accountPoints,
      entries: accountEntries,
    });
  }

  // F1 & F3: Processamento Consolidado a partir das contas ativas e neutralização de transferências internas
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
  let totalConsolidatedStartingCents = 0;
  let totalConsolidatedInflowCents = 0;
  let totalConsolidatedOutflowCents = 0;
  let totalConsolidatedPendingNetCents = 0;

  for (const item of accountFlowItems) {
    totalConsolidatedStartingCents += item.startingBalanceCents;
    totalConsolidatedPendingNetCents += item.pendingNetCents;
  }

  for (const tx of transactions) {
    if (tx.isCard) continue;
    if (tx.date < startDate || tx.date > endDate) continue;

    const fromAccSelected = Boolean(tx.accountId && selectedAccountIds.has(tx.accountId));
    const toAccSelected = Boolean(tx.destinationAccountId && selectedAccountIds.has(tx.destinationAccountId));

    if (!fromAccSelected && !toAccSelected) continue;

    const isPaid = tx.status === 'paid';
    const isPending = tx.status === 'pending';

    if (status === 'paid' && !isPaid) continue;
    if (status === 'pending' && !isPending) continue;

    // F3 / Caso 15: se somente realizados, exclui pendências do detalhamento consolidado
    if (!includePending && status !== 'pending' && isPending) {
      continue;
    }

    const bIdx = buckets.findIndex(b => tx.date >= b.startDate && tx.date <= b.endDate);

    if (tx.type === 'transfer') {
      if (fromAccSelected && toAccSelected) {
        // Transferência interna entre contas selecionadas -> neutralizada no total
        if (bIdx !== -1) {
          consolidatedPoints[bIdx].entries.push(tx);
        }
        consolidatedEntries.push(tx);
        continue;
      }

      if (fromAccSelected && !toAccSelected) {
        // Saída para conta externa
        if (isPaid || (isPending && includePending)) {
          totalConsolidatedOutflowCents += tx.amountCents;
          if (bIdx !== -1) consolidatedPoints[bIdx].outflowCents += tx.amountCents;
        } else if (isPending) {
          if (bIdx !== -1) {
            consolidatedPoints[bIdx].pendingOutflowCents += tx.amountCents;
            consolidatedPoints[bIdx].hasPending = true;
          }
        }
      } else if (!fromAccSelected && toAccSelected) {
        // Entrada vinda de conta externa
        if (isPaid || (isPending && includePending)) {
          totalConsolidatedInflowCents += tx.amountCents;
          if (bIdx !== -1) consolidatedPoints[bIdx].inflowCents += tx.amountCents;
        } else if (isPending) {
          if (bIdx !== -1) {
            consolidatedPoints[bIdx].pendingInflowCents += tx.amountCents;
            consolidatedPoints[bIdx].hasPending = true;
          }
        }
      }
    } else if (tx.type === 'income') {
      if (isPaid || (isPending && includePending)) {
        totalConsolidatedInflowCents += tx.amountCents;
        if (bIdx !== -1) consolidatedPoints[bIdx].inflowCents += tx.amountCents;
      } else if (isPending) {
        if (bIdx !== -1) {
          consolidatedPoints[bIdx].pendingInflowCents += tx.amountCents;
          consolidatedPoints[bIdx].hasPending = true;
        }
      }
    } else if (tx.type === 'expense') {
      if (isPaid || (isPending && includePending)) {
        totalConsolidatedOutflowCents += tx.amountCents;
        if (bIdx !== -1) consolidatedPoints[bIdx].outflowCents += tx.amountCents;
      } else if (isPending) {
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

  // F4: Capital de abertura durante o período no consolidado
  for (const acc of activeAccounts) {
    const openingDate = acc.openingDate || (acc.createdAt ? acc.createdAt.slice(0, 10) : undefined);
    if (openingDate && openingDate >= startDate && openingDate <= endDate && acc.initialBalance) {
      const openCapitalCents = toCents(acc.initialBalance);
      if (openCapitalCents > 0) {
        totalConsolidatedInflowCents += openCapitalCents;
        const bIdx = buckets.findIndex(b => openingDate >= b.startDate && openingDate <= b.endDate);
        if (bIdx !== -1) {
          consolidatedPoints[bIdx].inflowCents += openCapitalCents;
        }
      }
    }
  }

  const totalConsolidatedResultCents = totalConsolidatedInflowCents - totalConsolidatedOutflowCents;
  const totalConsolidatedEndingCents = totalConsolidatedStartingCents + totalConsolidatedResultCents;

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

  // F7: Obrigações residuais de faturas de cartão com respeito a customRange
  const invoiceObligations = buildInvoiceObligations(invoices, creditCards, transactions, selectedMonth, customRange);

  // F7: Faturas residuais só deduzem do saldo previsto se includePending === true
  // E no Caso 11: Se seleção for parcial de contas (originIds definido com subconjunto),
  // faturas sem conta não devem ser atribuídas à conta parcial!
  const isPartialAccountSelection = originIds !== undefined && originIds.length < accounts.length;
  const unallocatedCents = (includePending && !isPartialAccountSelection)
    ? invoiceObligations.totalResidualCents
    : 0;

  const consolidatedProjectedEndingCents = includePending
    ? totalConsolidatedEndingCents - unallocatedCents
    : (totalConsolidatedStartingCents + (totalConsolidatedInflowCents - totalConsolidatedOutflowCents)) + totalConsolidatedPendingNetCents - unallocatedCents;

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
    unallocatedInvoiceObligationsCents: invoiceObligations.totalResidualCents,
    unallocatedInvoiceObligations: fromCents(invoiceObligations.totalResidualCents),
    unallocatedInvoices: invoiceObligations.obligations,
    accounts: accountFlowItems,
    consolidatedPoints,
  };

  return {
    cashFlowResult,
    accountFlowResult,
  };
}
