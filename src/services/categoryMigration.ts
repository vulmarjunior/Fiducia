import { db } from '../firebase';
import { collection, query, where, getDocs, doc, writeBatch } from 'firebase/firestore';
import { resolveCategoryId } from '../lib/utils';

const FIRESTORE_ID_RE = /^[a-zA-Z0-9]{20}$/;

export interface MigrationResult {
  fixedTransactions: number;
  fixedBudgets: number;
  skippedUnmatched: string[];
}

export async function migrateCategoryIds(
  userId: string,
  categories: any[],
): Promise<MigrationResult> {
  const result: MigrationResult = { fixedTransactions: 0, fixedBudgets: 0, skippedUnmatched: [] };

  if (!userId || categories.length === 0) return result;

  try {
    const txQuery = query(
      collection(db, 'transactions'),
      where('userId', '==', userId),
    );
    const txSnap = await getDocs(txQuery);
    const batch = writeBatch(db);
    let batchOps = 0;

    for (const txDoc of txSnap.docs) {
      const data = txDoc.data();
      const rawId = data.categoryId;
      if (!rawId || FIRESTORE_ID_RE.test(rawId) || rawId === 'default' || rawId === 'Pagamento de Cartão') continue;

      const resolved = resolveCategoryId(categories, rawId);
      if (FIRESTORE_ID_RE.test(resolved) && resolved !== rawId) {
        batch.update(doc(db, 'transactions', txDoc.id), { categoryId: resolved });
        batchOps++;
        result.fixedTransactions++;
      } else if (resolved === rawId) {
        if (!result.skippedUnmatched.includes(rawId)) {
          result.skippedUnmatched.push(rawId);
        }
      }
    }

    const budgetQuery = query(
      collection(db, 'budgets'),
      where('userId', '==', userId),
    );
    const budgetSnap = await getDocs(budgetQuery);

    for (const bDoc of budgetSnap.docs) {
      const data = bDoc.data();
      const rawId = data.categoryId;
      if (!rawId || FIRESTORE_ID_RE.test(rawId)) continue;

      const resolved = resolveCategoryId(categories, rawId);
      if (FIRESTORE_ID_RE.test(resolved) && resolved !== rawId) {
        batch.update(doc(db, 'budgets', bDoc.id), { categoryId: resolved });
        batchOps++;
        result.fixedBudgets++;
      }
    }

    if (batchOps > 0) {
      await batch.commit();
    }
  } catch (err) {
    console.error('Category migration (non-blocking):', err);
  }

  return result;
}
