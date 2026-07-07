import { ConfirmImportCandidateInput, ImportCandidateDuplicateCheck, ParsedImportResult, Transaction } from '../types';

function dateOnly(value?: string): string {
  return String(value || '').split('T')[0];
}

function parseDate(value?: string): number {
  const clean = dateOnly(value);
  const [year, month, day] = clean.split('-').map(Number);
  if (!year || !month || !day) return NaN;
  return new Date(year, month - 1, day).getTime();
}

function daysBetween(a?: string, b?: string): number {
  const left = parseDate(a);
  const right = parseDate(b);
  if (Number.isNaN(left) || Number.isNaN(right)) return 999;
  return Math.abs(Math.round((left - right) / 86400000));
}

function normalize(value?: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function similarity(a?: string, b?: string): number {
  const left = new Set(normalize(a).split(' ').filter(token => token.length > 2));
  const right = new Set(normalize(b).split(' ').filter(token => token.length > 2));
  if (left.size === 0 || right.size === 0) return 0;
  let hits = 0;
  left.forEach(token => {
    if (right.has(token)) hits++;
  });
  return hits / Math.max(left.size, right.size);
}

export function checkImportDuplicate(params: {
  parsed: ParsedImportResult | ConfirmImportCandidateInput;
  transactions: Transaction[];
  accountId?: string;
  creditCardId?: string;
}): ImportCandidateDuplicateCheck {
  const amount = params.parsed.amount || 0;
  const date = params.parsed.date;
  const description = 'merchant' in params.parsed
    ? params.parsed.merchant || params.parsed.description
    : params.parsed.description;

  const matches = params.transactions.filter(tx => {
    if (!tx.id || !amount || !date) return false;
    const sameAmount = Math.abs((tx.amount || 0) - amount) < 0.01;
    const closeDate = daysBetween(tx.date, date) <= 1;
    const sameDestination = params.creditCardId
      ? tx.creditCardId === params.creditCardId
      : params.accountId
        ? tx.accountId === params.accountId
        : true;
    const similarText = similarity(tx.description, description) >= 0.35;
    return sameAmount && closeDate && sameDestination && similarText;
  });

  return {
    isPossibleDuplicate: matches.length > 0,
    matchedTransactionIds: matches.map(tx => tx.id!).slice(0, 5),
    reason: matches.length > 0
      ? 'Mesmo valor, data proxima e descricao semelhante encontrados em lancamento existente'
      : undefined,
  };
}