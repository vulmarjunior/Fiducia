import { ImportedInvoiceLine, InvoiceLineMatch, Transaction } from '../types';

const GENERIC_TOKENS = new Set([
  'pag', 'pagamento', 'compra', 'cartao', 'cartao credito', 'credito', 'debito',
  'parc', 'parcela', 'estab', 'loja', 'br', 'sa', 'ltda', 'me', 'eireli',
]);

export function normalizeInvoiceText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[*_#.,;:()\[\]{}+\-/\\|]/g, ' ')
    .replace(/\b\d{2,}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(token => token.length > 1 && !GENERIC_TOKENS.has(token))
    .join(' ');
}

function dateOnly(value?: string): string {
  if (!value) return '';
  return value.split('T')[0];
}

function parseDate(value?: string): number {
  const clean = dateOnly(value);
  if (!clean) return NaN;
  const [year, month, day] = clean.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1).getTime();
}

function daysBetween(a?: string, b?: string): number {
  const left = parseDate(a);
  const right = parseDate(b);
  if (Number.isNaN(left) || Number.isNaN(right)) return 999;
  return Math.abs(Math.round((left - right) / 86400000));
}

function textSimilarity(a: string, b: string): number {
  const left = new Set(normalizeInvoiceText(a).split(' ').filter(Boolean));
  const right = new Set(normalizeInvoiceText(b).split(' ').filter(Boolean));
  if (left.size === 0 || right.size === 0) return 0;

  let intersection = 0;
  left.forEach(token => {
    if (right.has(token)) intersection++;
  });

  return intersection / Math.max(left.size, right.size);
}

function isSameFinancialType(line: ImportedInvoiceLine, tx: Transaction): boolean {
  const txIsIncome = tx.type === 'income' || tx.type === 'receita';
  return txIsIncome === (line.type === 'receita');
}

function buildDifferences(line: ImportedInvoiceLine, tx: Transaction): InvoiceLineMatch['differences'] {
  const differences: InvoiceLineMatch['differences'] = {};
  if (Math.abs((tx.amount || 0) - line.amount) >= 0.01) {
    differences.amount = { imported: line.amount, system: tx.amount || 0 };
  }
  if (dateOnly(tx.date) !== dateOnly(line.date)) {
    differences.date = { imported: dateOnly(line.date), system: dateOnly(tx.date) };
  }
  if (normalizeInvoiceText(tx.description || '') !== normalizeInvoiceText(line.description || '')) {
    differences.description = { imported: line.description, system: tx.description || '' };
  }
  if (line.suggestedCategoryId && tx.categoryId && line.suggestedCategoryId !== tx.categoryId) {
    differences.categoryId = { imported: line.suggestedCategoryId, system: tx.categoryId };
  }
  return differences;
}

function scoreCandidate(line: ImportedInvoiceLine, tx: Transaction): { score: number; reason: string } {
  if (!isSameFinancialType(line, tx)) return { score: 0, reason: 'Tipo financeiro diferente' };

  const amountDiff = Math.abs((tx.amount || 0) - line.amount);
  const dateDiff = daysBetween(line.date, tx.date);
  const similarity = textSimilarity(line.description, tx.description || '');
  const sameInstallment = line.installmentNumber && tx.installmentNumber
    ? line.installmentNumber === tx.installmentNumber && line.totalInstallments === tx.totalInstallments
    : false;

  let score = 0;
  if (amountDiff < 0.01) score += 0.5;
  else if (amountDiff <= 1) score += 0.25;
  else if (similarity >= 0.7) score += 0.12;
  else return { score: 0, reason: 'Valor incompatível' };

  if (dateDiff <= 1) score += 0.25;
  else if (dateDiff <= 3) score += 0.18;
  else if (dateDiff <= 7) score += 0.08;

  if (similarity >= 0.75) score += 0.25;
  else if (similarity >= 0.45) score += 0.15;
  else if (similarity > 0) score += 0.05;

  if (sameInstallment) score += 0.1;

  const reason = [
    amountDiff < 0.01 ? 'mesmo valor' : `diferença de valor R$ ${amountDiff.toFixed(2)}`,
    dateDiff <= 7 ? `data a ${dateDiff} dia(s)` : 'data distante',
    similarity > 0 ? `descrição ${(similarity * 100).toFixed(0)}% similar` : 'descrição sem similaridade',
    sameInstallment ? 'mesma parcela' : '',
  ].filter(Boolean).join(', ');

  return { score: Math.min(score, 0.99), reason };
}

export function buildDeterministicInvoiceMatches(params: {
  importedLines: ImportedInvoiceLine[];
  systemTransactions: Transaction[];
}): InvoiceLineMatch[] {
  const matches: InvoiceLineMatch[] = [];
  const usedSystemIds = new Set<string>();

  for (const line of params.importedLines) {
    const candidates = params.systemTransactions
      .filter(tx => tx.id && !usedSystemIds.has(tx.id))
      .map(tx => ({ tx, ...scoreCandidate(line, tx) }))
      .filter(candidate => candidate.score >= 0.55)
      .sort((a, b) => b.score - a.score);

    const best = candidates[0];
    if (!best?.tx.id) {
      matches.push({
        importedLineId: line.id,
        confidence: 0.8,
        reason: 'Linha da fatura sem lançamento correspondente no Fiducia',
        differences: {},
        suggestedAction: 'create_transaction',
      });
      continue;
    }

    usedSystemIds.add(best.tx.id);
    const differences = buildDifferences(line, best.tx);
    const hasRelevantDifference = Boolean(differences.amount || differences.date || differences.categoryId);

    matches.push({
      importedLineId: line.id,
      systemTransactionId: best.tx.id,
      confidence: Number(best.score.toFixed(2)),
      reason: best.reason,
      differences,
      suggestedAction: hasRelevantDifference ? 'update_transaction' : best.score >= 0.75 ? 'confirm_match' : 'manual_review',
    });
  }

  return matches;
}

export function mergeAiAndDeterministicMatches(params: {
  deterministic: InvoiceLineMatch[];
  ai: InvoiceLineMatch[];
}): InvoiceLineMatch[] {
  const byLine = new Map<string, InvoiceLineMatch>();
  params.deterministic.forEach(match => byLine.set(match.importedLineId, match));

  for (const aiMatch of params.ai) {
    const current = byLine.get(aiMatch.importedLineId);
    if (!current || aiMatch.confidence > current.confidence || current.suggestedAction === 'create_transaction') {
      byLine.set(aiMatch.importedLineId, {
        ...aiMatch,
        reason: aiMatch.reason || 'Sugestão semântica da IA',
      });
    }
  }

  const usedSystemIds = new Set<string>();
  return [...byLine.values()].map(match => {
    if (!match.systemTransactionId) return match;
    if (usedSystemIds.has(match.systemTransactionId)) {
      return {
        ...match,
        systemTransactionId: undefined,
        confidence: Math.min(match.confidence, 0.5),
        reason: `${match.reason}; possível duplicidade com outro match`,
        suggestedAction: 'manual_review',
      };
    }
    usedSystemIds.add(match.systemTransactionId);
    return match;
  });
}

export function calculateInvoiceReconciliationTotals(params: {
  importedLines: ImportedInvoiceLine[];
  systemTransactions: Transaction[];
  matches: InvoiceLineMatch[];
  declaredTotal?: number;
}) {
  const importedLinesTotal = params.importedLines.reduce((sum, line) => {
    return sum + (line.type === 'receita' ? -line.amount : line.amount);
  }, 0);

  const systemPeriodTotal = params.systemTransactions.reduce((sum, tx) => {
    const isIncome = tx.type === 'income' || tx.type === 'receita';
    return sum + (isIncome ? -(tx.amount || 0) : (tx.amount || 0));
  }, 0);

  const matchedSystemIds = new Set(params.matches.map(match => match.systemTransactionId).filter(Boolean));
  const matchedTotal = params.systemTransactions
    .filter(tx => tx.id && matchedSystemIds.has(tx.id))
    .reduce((sum, tx) => {
      const isIncome = tx.type === 'income' || tx.type === 'receita';
      return sum + (isIncome ? -(tx.amount || 0) : (tx.amount || 0));
    }, 0);

  const baseTotal = params.declaredTotal ?? importedLinesTotal;

  return {
    importedLinesTotal: Number(importedLinesTotal.toFixed(2)),
    systemPeriodTotal: Number(systemPeriodTotal.toFixed(2)),
    matchedTotal: Number(matchedTotal.toFixed(2)),
    invoiceDeclaredTotal: params.declaredTotal,
    difference: Number((baseTotal - matchedTotal).toFixed(2)),
  };
}

export function getUnmatchedSystemTransactions(params: {
  systemTransactions: Transaction[];
  matches: InvoiceLineMatch[];
}): Transaction[] {
  const matchedSystemIds = new Set(params.matches.map(match => match.systemTransactionId).filter(Boolean));
  return params.systemTransactions.filter(tx => tx.id && !matchedSystemIds.has(tx.id));
}