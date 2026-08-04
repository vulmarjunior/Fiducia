export function normalizeCreditCardTransaction<T extends Record<string, any>>(transaction: T): T & { accountId: string } {
  return { ...transaction, accountId: transaction.accountId || transaction.creditCardId || '' };
}

export function isCreditCardTransaction(transaction: Record<string, any>, cardIds: Iterable<string>): boolean {
  const ids = cardIds instanceof Set ? cardIds : new Set(cardIds);
  return !!transaction.creditCardId || ids.has(transaction.accountId) || ids.has(transaction.destinationAccountId);
}