import { collection, doc, getDoc, runTransaction, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { calculateInvoicePeriod, getTransactionEffect, isEffectivelyPaid } from '../lib/utils';
import { ConfirmImportCandidateInput, ImportCandidate, ImportCandidateDuplicateCheck, ImportCandidateSource, ImportCandidateSuggestions, ParsedImportResult } from '../types';
import { cleanUndefinedFields } from '../utils/cleanUndefined';

export async function createImportCandidate(params: {
  userId: string;
  source: ImportCandidateSource;
  rawContent: string;
  rawTitle?: string;
  rawUrl?: string;
  parsed: ParsedImportResult;
  suggestions: ImportCandidateSuggestions;
  duplicateCheck?: ImportCandidateDuplicateCheck;
}): Promise<string> {
  const now = new Date().toISOString();
  const docRef = await addDoc(collection(db, 'importCandidates'), cleanUndefinedFields({
    userId: params.userId,
    source: params.source,
    status: 'pending',
    rawContent: params.rawContent,
    ...(params.rawTitle ? { rawTitle: params.rawTitle } : {}),
    ...(params.rawUrl ? { rawUrl: params.rawUrl } : {}),
    parsed: params.parsed,
    suggestions: params.suggestions,
    ...(params.duplicateCheck ? { duplicateCheck: params.duplicateCheck } : {}),
    createdAt: now,
    updatedAt: now,
  }));
  return docRef.id;
}

export async function ignoreImportCandidate(candidateId: string, userId: string): Promise<void> {
  const now = new Date().toISOString();
  const ref = doc(db, 'importCandidates', candidateId);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().userId !== userId) throw new Error('Candidato nao encontrado');
  await updateDoc(ref, { status: 'ignored', ignoredAt: now, updatedAt: now });
}

export async function markImportCandidateDuplicate(candidateId: string, userId: string): Promise<void> {
  const now = new Date().toISOString();
  const ref = doc(db, 'importCandidates', candidateId);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().userId !== userId) throw new Error('Candidato nao encontrado');
  await updateDoc(ref, { status: 'duplicate', ignoredAt: now, updatedAt: now });
}

export async function confirmImportCandidate(params: {
  candidateId: string;
  userId: string;
  input: ConfirmImportCandidateInput;
  card?: { id?: string; closingDay: number; dueDay: number };
}): Promise<string> {
  const now = new Date().toISOString();
  const candidateRef = doc(db, 'importCandidates', params.candidateId);
  const txRef = doc(collection(db, 'transactions'));
  const txId = txRef.id;

  await runTransaction(db, async transaction => {
    const candidateSnap = await transaction.get(candidateRef);
    if (!candidateSnap.exists()) throw new Error('Candidato nao encontrado');
    const candidate = { id: candidateSnap.id, ...candidateSnap.data() } as ImportCandidate;
    if (candidate.userId !== params.userId) throw new Error('Candidato pertence a outro usuario');
    if (candidate.status !== 'pending') throw new Error('Candidato ja processado');

    const isCard = Boolean(params.input.creditCardId);
    let accountSnap: any = null;
    if (!isCard && params.input.accountId && isEffectivelyPaid({ status: params.input.status })) {
      accountSnap = await transaction.get(doc(db, 'accounts', params.input.accountId));
    }

    const transactionData: any = {
      userId: params.userId,
      type: params.input.type,
      amount: params.input.amount,
      date: params.input.date,
      description: params.input.description,
      status: isCard ? 'realizado' : params.input.status,
      categoryId: params.input.categoryId || '',
      accountId: isCard ? params.input.creditCardId : params.input.accountId,
      ...(params.input.destinationAccountId ? { destinationAccountId: params.input.destinationAccountId } : {}),
      ...(params.input.creditCardId ? { creditCardId: params.input.creditCardId } : {}),
      ...(params.input.tags && params.input.tags.length > 0 ? { tags: params.input.tags } : {}),
      ...(params.input.observation ? { observation: params.input.observation } : {}),
      ...(params.input.installmentNumber ? { installmentNumber: params.input.installmentNumber } : {}),
      ...(params.input.totalInstallments ? { totalInstallments: params.input.totalInstallments } : {}),
      reconciliationStatus: 'nao_conciliado',
      createdAt: now,
      updatedAt: now,
    };

    if (isCard && params.card) {
      transactionData.invoicePeriod = calculateInvoicePeriod(params.input.date, params.card.closingDay, params.card.dueDay);
      if (params.input.totalInstallments) transactionData.ccRecurrenceType = 'parcelado';
    }

    transaction.set(txRef, cleanUndefinedFields(transactionData));

    if (!isCard && accountSnap?.exists() && params.input.accountId) {
      const delta = getTransactionEffect(transactionData, params.input.accountId);
      if (delta !== 0) {
        transaction.update(doc(db, 'accounts', params.input.accountId), {
          balance: (accountSnap.data().balance || 0) + delta,
        });
      }
    }

    transaction.update(candidateRef, {
      status: 'confirmed',
      confirmedTransactionId: txId,
      confirmedAt: now,
      updatedAt: now,
    });
  });

  return txId;
}
