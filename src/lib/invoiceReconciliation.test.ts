import { describe, expect, it } from 'vitest';
import {
  buildDeterministicInvoiceMatches,
  calculateInvoiceReconciliationTotals,
  getUnmatchedSystemTransactions,
  normalizeInvoiceText,
} from './invoiceReconciliation';
import { ImportedInvoiceLine, Transaction } from '../types';

const line = (overrides: Partial<ImportedInvoiceLine> = {}): ImportedInvoiceLine => ({
  id: 'line-1',
  source: 'pdf',
  date: '2026-07-05',
  description: 'PAG*UBER TRIP 1234',
  amount: 28.9,
  type: 'despesa',
  kind: 'purchase',
  confidence: 0.95,
  ...overrides,
});

const tx = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'tx-1',
  userId: 'u1',
  type: 'despesa',
  amount: 28.9,
  date: '2026-07-05T12:00:00.000Z',
  description: 'Uber',
  creditCardId: 'card-1',
  accountId: 'card-1',
  invoicePeriod: '2026-07',
  status: 'realizado',
  reconciliationStatus: 'nao_conciliado',
  createdAt: '2026-07-01T00:00:00.000Z',
  ...overrides,
});

describe('invoiceReconciliation', () => {
  it('normalizes noisy card statement descriptions', () => {
    expect(normalizeInvoiceText('PAG*UBER TRIP 1234')).toBe('uber trip');
    expect(normalizeInvoiceText('Mercado Pago*Loja São João')).toBe('mercado pago sao joao');
  });

  it('matches exact amount, close date, and similar description', () => {
    const matches = buildDeterministicInvoiceMatches({
      importedLines: [line()],
      systemTransactions: [tx()],
    });

    expect(matches[0]).toMatchObject({
      importedLineId: 'line-1',
      systemTransactionId: 'tx-1',
      suggestedAction: 'confirm_match',
    });
    expect(matches[0].confidence).toBeGreaterThanOrEqual(0.75);
  });

  it('suggests update when amount diverges but description is strong', () => {
    const matches = buildDeterministicInvoiceMatches({
      importedLines: [line({ description: 'UBER TRIP', amount: 30 })],
      systemTransactions: [tx({ description: 'Uber Trip', amount: 28.9 })],
    });

    expect(matches[0].suggestedAction).toBe('update_transaction');
    expect(matches[0].differences.amount).toEqual({ imported: 30, system: 28.9 });
  });

  it('marks invoice line as missing when there is no candidate', () => {
    const matches = buildDeterministicInvoiceMatches({
      importedLines: [line({ description: 'Farmacia Central', amount: 91.2 })],
      systemTransactions: [tx({ description: 'Uber', amount: 28.9 })],
    });

    expect(matches[0].systemTransactionId).toBeUndefined();
    expect(matches[0].suggestedAction).toBe('create_transaction');
  });

  it('detects unmatched system transactions', () => {
    const systemTransactions = [tx(), tx({ id: 'tx-2', description: 'Padaria', amount: 12 })];
    const matches = buildDeterministicInvoiceMatches({ importedLines: [line()], systemTransactions });

    expect(getUnmatchedSystemTransactions({ systemTransactions, matches }).map(t => t.id)).toEqual(['tx-2']);
  });

  it('calculates totals with credits reducing the invoice total', () => {
    const totals = calculateInvoiceReconciliationTotals({
      importedLines: [line({ amount: 100 }), line({ id: 'line-2', amount: 20, type: 'receita', kind: 'refund' })],
      systemTransactions: [tx({ amount: 100 }), tx({ id: 'tx-2', amount: 20, type: 'receita' })],
      matches: [
        { importedLineId: 'line-1', systemTransactionId: 'tx-1', confidence: 0.9, reason: '', differences: {}, suggestedAction: 'confirm_match' },
        { importedLineId: 'line-2', systemTransactionId: 'tx-2', confidence: 0.9, reason: '', differences: {}, suggestedAction: 'confirm_match' },
      ],
    });

    expect(totals.importedLinesTotal).toBe(80);
    expect(totals.systemPeriodTotal).toBe(80);
    expect(totals.difference).toBe(0);
  });
});