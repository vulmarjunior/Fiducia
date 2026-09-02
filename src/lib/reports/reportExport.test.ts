import { describe, expect, it, vi } from 'vitest';
import type {
  AccountFlowReportResult,
  CashFlowReportResult,
  CategoryReportResult,
  ReportFilters,
} from '../../types/reports';

const saveMock = vi.fn();

vi.mock('jspdf', () => {
  return {
    default: class MockJsPdf {
      setFontSize = vi.fn();
      setTextColor = vi.fn();
      text = vi.fn();
      save = saveMock;
    },
  };
});

vi.mock('jspdf-autotable', () => ({
  default: vi.fn(),
}));

import {
  buildCategoryReportCsv,
  buildCashFlowReportCsv,
  buildAccountFlowReportCsv,
  exportCashFlowReportToPdf,
  exportAccountFlowReportToPdf,
} from './reportExport';

describe('reportExport', () => {
  const filters: ReportFilters = {
    selectedMonth: '2026-08',
    status: 'all',
    intervalType: 'day',
    accumulated: false,
    includePending: false,
  };

  it('exporta CSV de categorias com sanitização contra fórmula maliciosa', () => {
    const result: CategoryReportResult = {
      type: 'expenses',
      totalCents: 15000,
      total: 150,
      hasNegativeCategories: false,
      itemsWithoutInvoiceDayTotal: 0,
      itemsWithoutInvoiceDayEntries: [],
      categories: [
        {
          categoryId: 'cat-1',
          categoryName: '=SUM(A1:A10)', // Tentativa de injeção de fórmula
          totalCents: 15000,
          total: 150,
          percent: 100,
          directCents: 15000,
          cardCents: 0,
          entriesCount: 1,
          entries: [],
        },
      ],
      evolution: [],
    };

    const csv = buildCategoryReportCsv(result, filters);
    // Verifica se a célula perigosa foi neutralizada com apóstrofo e aspas
    expect(csv).toContain("\"'=SUM(A1:A10)\"");
    expect(csv).toContain('150,00');
  });

  it('exporta CSV de entradas x saídas com delimitador ponto e vírgula', () => {
    const result: CashFlowReportResult = {
      totalInflowCents: 50000,
      totalOutflowCents: 20000,
      netResultCents: 30000,
      totalInflow: 500,
      totalOutflow: 200,
      netResult: 300,
      points: [
        {
          periodKey: '2026-08-01',
          label: '01/08',
          startDate: '2026-08-01',
          endDate: '2026-08-01',
          inflowCents: 50000,
          outflowCents: 20000,
          resultCents: 30000,
          inflow: 500,
          outflow: 200,
          result: 300,
          hasPending: false,
          pendingInflowCents: 0,
          pendingOutflowCents: 0,
          pendingResultCents: 0,
          entries: [],
        },
      ],
    };

    const csv = buildCashFlowReportCsv(result, filters);
    expect(csv).toContain('# Entradas x Saidas');
    expect(csv).toContain('01/08;500,00;200,00;300,00');
  });

  it('exporta CSV de fluxo por conta incluindo faturas não alocadas', () => {
    const result: AccountFlowReportResult = {
      consolidatedStartingBalanceCents: 100000,
      consolidatedInflowCents: 50000,
      consolidatedOutflowCents: 20000,
      consolidatedNetResultCents: 30000,
      consolidatedEndingBalanceCents: 130000,
      consolidatedStartingBalance: 1000,
      consolidatedInflow: 500,
      consolidatedOutflow: 200,
      consolidatedNetResult: 300,
      consolidatedEndingBalance: 1300,
      consolidatedProjectedEndingBalanceCents: 125000,
      consolidatedProjectedEndingBalance: 1250,
      unallocatedInvoiceObligationsCents: 5000,
      unallocatedInvoiceObligations: 50,
      unallocatedInvoices: [
        {
          cardId: 'card-1',
          cardName: 'C6 Bank',
          period: '2026-08',
          dueDate: '2026-08-05',
          totalAmountCents: 10000,
          paidAmountCents: 5000,
          remainingAmountCents: 5000,
          invoiceStatus: 'parcial',
          hasPendingPayment: false,
        },
      ],
      accounts: [
        {
          accountId: 'acc-1',
          accountName: 'Itaú',
          accountType: 'checking',
          startingBalanceCents: 100000,
          inflowCents: 50000,
          outflowCents: 20000,
          netResultCents: 30000,
          endingBalanceCents: 130000,
          startingBalance: 1000,
          inflow: 500,
          outflow: 200,
          netResult: 300,
          endingBalance: 1300,
          pendingInflowCents: 0,
          pendingOutflowCents: 0,
          pendingNetCents: 0,
          projectedEndingBalanceCents: 130000,
          projectedEndingBalance: 1300,
          isReconciled: true,
          points: [],
          entries: [],
        },
      ],
      consolidatedPoints: [],
    };

    const csv = buildAccountFlowReportCsv(result, filters);
    expect(csv).toContain('Itaú;checking;1000,00;500,00;200,00;300,00;1300,00;1300,00');
    expect(csv).toContain('C6 Bank;2026-08;2026-08-05;100,00;50,00;50,00');
  });

  it('exporta PDF de entradas x saídas chamando doc.save com nome correto', () => {
    saveMock.mockClear();
    const cashResult: CashFlowReportResult = {
      totalInflowCents: 50000,
      totalOutflowCents: 20000,
      netResultCents: 30000,
      totalInflow: 500,
      totalOutflow: 200,
      netResult: 300,
      startingBalance: 1000,
      endingBalance: 1300,
      points: [
        {
          periodKey: '2026-08-01',
          label: '01/08',
          startDate: '2026-08-01',
          endDate: '2026-08-01',
          inflowCents: 50000,
          outflowCents: 20000,
          resultCents: 30000,
          inflow: 500,
          outflow: 200,
          result: 300,
          endingBalance: 1300,
          entries: [],
        },
      ],
    };

    exportCashFlowReportToPdf(cashResult, filters);
    expect(saveMock).toHaveBeenCalledWith('fiducia-entradas-saidas-2026-08.pdf');
  });

  it('exporta PDF de fluxo por conta chamando doc.save com nome correto', () => {
    saveMock.mockClear();
    const accResult: AccountFlowReportResult = {
      consolidatedStartingBalanceCents: 100000,
      consolidatedInflowCents: 50000,
      consolidatedOutflowCents: 20000,
      consolidatedNetResultCents: 30000,
      consolidatedEndingBalanceCents: 130000,
      consolidatedProjectedEndingBalanceCents: 130000,
      consolidatedStartingBalance: 1000,
      consolidatedInflow: 500,
      consolidatedOutflow: 200,
      consolidatedNetResult: 300,
      consolidatedEndingBalance: 1300,
      consolidatedProjectedEndingBalance: 1300,
      unallocatedInvoiceObligationsCents: 0,
      unallocatedInvoiceObligations: 0,
      unallocatedInvoices: [],
      accounts: [],
      consolidatedPoints: [],
    };

    exportAccountFlowReportToPdf(accResult, filters);
    expect(saveMock).toHaveBeenCalledWith('fiducia-fluxo-contas-2026-08.pdf');
  });
});
