import { collection, doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { CreditCard, ImportedInvoiceLine, InvoiceLineAction, InvoiceLineMatch, Transaction } from '../types';
import { calculateInvoicePeriod, dateToLocalISOString, getNextPeriod, parseLocalDate } from '../lib/utils';

function lineToTransactionData(params: {
  userId: string;
  card: CreditCard & { id: string };
  line: ImportedInvoiceLine;
  invoicePeriod: string;
  categoryId?: string;
}) {
  const lineDate = dateToLocalISOString(params.line.date);
  const period = calculateInvoicePeriod(params.line.date, params.card.closingDay, params.card.dueDay) || params.invoicePeriod;
  const parentId = params.line.installmentNumber ? doc(collection(db, 'transactions')).id : undefined;

  return {
    userId: params.userId,
    type: params.line.type,
    amount: params.line.amount,
    date: lineDate,
    description: params.line.description,
    creditCardId: params.card.id,
    accountId: params.card.id,
    invoicePeriod: period,
    status: 'realizado',
    reconciliationStatus: 'conciliado',
    categoryId: params.categoryId || params.line.suggestedCategoryId || '',
    ...(params.line.installmentNumber && params.line.totalInstallments ? {
      parentId,
      installmentNumber: params.line.installmentNumber,
      totalInstallments: params.line.totalInstallments,
      originalPurchaseDate: lineDate,
      postingDate: lineDate,
    } : {}),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as any;
}

export async function applyInvoiceReconciliation(params: {
  userId: string;
  card: CreditCard & { id: string };
  invoicePeriod: string;
  source: 'pdf' | 'csv' | 'xlsx';
  importedLines: ImportedInvoiceLine[];
  matches: InvoiceLineMatch[];
  selectedActions: Record<string, InvoiceLineAction>;
  categoryOverrides: Record<string, string>;
  systemTransactions: Transaction[];
  totals: {
    importedLinesTotal: number;
    systemPeriodTotal: number;
    matchedTotal: number;
    invoiceDeclaredTotal?: number;
    difference: number;
  };
  expandInstallments?: Record<string, boolean>;
}): Promise<{
  created: number;
  updated: number;
  reconciled: number;
  ignored: number;
}> {
  const batch = writeBatch(db);
  const matchesByLine = new Map(params.matches.map(match => [match.importedLineId, match]));
  const txById = new Map(params.systemTransactions.filter(tx => tx.id).map(tx => [tx.id!, tx]));
  const now = new Date().toISOString();
  let created = 0;
  let updated = 0;
  let reconciled = 0;
  let ignored = 0;
  let manualReview = 0;

  for (const line of params.importedLines) {
    const match = matchesByLine.get(line.id);
    const action = params.selectedActions[line.id] || match?.suggestedAction || 'manual_review';
    const categoryId = params.categoryOverrides[line.id] || line.suggestedCategoryId || '';

    if (action === 'ignore') {
      ignored++;
      continue;
    }

    if (action === 'manual_review') {
      manualReview++;
      continue;
    }

    if (action === 'create_transaction' || !match?.systemTransactionId) {
      const txRef = doc(collection(db, 'transactions'));
      const data = lineToTransactionData({
        userId: params.userId,
        card: params.card,
        line,
        invoicePeriod: params.invoicePeriod,
        categoryId,
      });
      batch.set(txRef, data);
      created++;

      if (params.expandInstallments?.[line.id] && line.installmentNumber && line.totalInstallments) {
        const originalDate = parseLocalDate(line.date);
        let period = data.invoicePeriod;
        for (let i = line.installmentNumber + 1; i <= line.totalInstallments; i++) {
          const futureDate = new Date(originalDate);
          futureDate.setMonth(originalDate.getMonth() + (i - line.installmentNumber));
          const dateStr = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}-${String(futureDate.getDate()).padStart(2, '0')}`;
          period = getNextPeriod(period);
          const futureRef = doc(collection(db, 'transactions'));
          batch.set(futureRef, {
            ...data,
            date: dateToLocalISOString(dateStr),
            description: `${line.description.replace(/\s*\(?\d{1,2}\s*\/\s*\d{1,2}\)?\s*/g, ' ').trim()} (${i}/${line.totalInstallments})`,
            invoicePeriod: period,
            status: 'pendente',
            reconciliationStatus: 'nao_conciliado',
            installmentNumber: i,
            totalInstallments: line.totalInstallments,
            postingDate: dateToLocalISOString(dateStr),
            isSystemGeneratedDate: true,
            createdAt: now,
            updatedAt: now,
          });
          created++;
        }
      }
      continue;
    }

    const tx = txById.get(match.systemTransactionId);
    if (!tx?.id) {
      manualReview++;
      continue;
    }

    const txRef = doc(db, 'transactions', tx.id);
    if (action === 'confirm_match') {
      batch.update(txRef, { reconciliationStatus: 'conciliado', updatedAt: now });
      reconciled++;
      continue;
    }

    if (action === 'update_transaction') {
      batch.update(txRef, {
        amount: line.amount,
        date: dateToLocalISOString(line.date),
        description: line.description,
        categoryId: categoryId || tx.categoryId || '',
        invoicePeriod: calculateInvoicePeriod(line.date, params.card.closingDay, params.card.dueDay) || params.invoicePeriod,
        reconciliationStatus: 'conciliado',
        ...(line.installmentNumber && line.totalInstallments ? {
          installmentNumber: line.installmentNumber,
          totalInstallments: line.totalInstallments,
          originalPurchaseDate: tx.originalPurchaseDate || dateToLocalISOString(line.date),
          postingDate: dateToLocalISOString(line.date),
        } : {}),
        updatedAt: now,
      });
      updated++;
    }
  }

  const historyRef = doc(collection(db, 'reconciliationHistory'));
  batch.set(historyRef, {
    userId: params.userId,
    type: 'credit_card_invoice',
    cardId: params.card.id,
    accountId: params.card.id,
    period: params.invoicePeriod,
    invoicePeriod: params.invoicePeriod,
    source: params.source,
    totals: params.totals,
    counts: {
      imported: params.importedLines.length,
      created,
      updated,
      reconciled,
      ignored,
      manualReview,
    },
    reconciledAt: now,
    createdAt: now,
  });

  await batch.commit();
  return { created, updated, reconciled, ignored };
}