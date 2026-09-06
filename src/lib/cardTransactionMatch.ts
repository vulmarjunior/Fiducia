import type { Transaction } from '../types';

export function belongsToCreditCard(transaction: Transaction, cardId: string): boolean {
  if (!cardId) return false;
  return transaction.creditCardId === cardId
    || transaction.accountId === cardId
    || transaction.destinationAccountId === cardId;
}
