import { ParsedImportResult, ParsedTransactionType } from '../types';

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseMoney(rawText: string): number | undefined {
  const match = rawText.match(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*|\d+),\s*(\d{2})(?:\s*BRL)?/i);
  if (!match) return undefined;
  const integer = match[1].replace(/\./g, '');
  const parsed = Number(`${integer}.${match[2]}`);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseDate(rawText: string, referenceDate: Date): { date?: string; reason?: string; lowConfidence?: boolean } {
  const normalized = normalizeText(rawText);
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());

  if (/\bhoje\b/.test(normalized)) {
    return { date: toIsoDate(today.getFullYear(), today.getMonth() + 1, today.getDate()), reason: 'Data identificada como hoje' };
  }

  if (/\bontem\b/.test(normalized)) {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    return { date: toIsoDate(yesterday.getFullYear(), yesterday.getMonth() + 1, yesterday.getDate()), reason: 'Data identificada como ontem' };
  }

  const match = rawText.match(/(?:^|\D)(\d{1,2})\s*[\/-]\s*(\d{1,2})(?:\s*[\/-]\s*(\d{2,4}))?(?:\D|$)/);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const rawYear = match[3];
    const year = rawYear ? (rawYear.length === 2 ? Number(`20${rawYear}`) : Number(rawYear)) : referenceDate.getFullYear();
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return { date: toIsoDate(year, month, day), reason: rawYear ? 'Data completa identificada' : 'Data sem ano identificada; usado ano de referencia' };
    }
  }

  return {
    date: toIsoDate(today.getFullYear(), today.getMonth() + 1, today.getDate()),
    reason: 'Data nao encontrada; usada data atual como sugestao',
    lowConfidence: true,
  };
}

function parseCardLastDigits(rawText: string): string | undefined {
  const normalized = normalizeText(rawText);
  const match = normalized.match(/(?:cartao\s*)?(?:final|finais)\s*(\d{4})|\*{2,}\s*(\d{4})/);
  return match?.[1] || match?.[2];
}

function parseInstallments(rawText: string): ParsedImportResult['installments'] | undefined {
  const normalized = normalizeText(rawText);
  const explicit = normalized.match(/(?:parcela\s*)?(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})/);
  if (explicit) {
    return { current: Number(explicit[1]), total: Number(explicit[2]) };
  }
  const totalOnly = normalized.match(/(?:em\s*)?(\d{1,2})\s*x\b/);
  if (totalOnly) return { total: Number(totalOnly[1]) };
  return undefined;
}

function detectType(rawText: string): { type: ParsedTransactionType; reason: string } {
  const normalized = normalizeText(rawText);

  if (/\b(estorno|devolucao|cancelamento)\b/.test(normalized)) {
    return { type: 'refund', reason: 'Termo de estorno/devolucao identificado' };
  }
  if (/\b(pix recebido|transferencia recebida|deposito recebido|recebido de)\b/.test(normalized)) {
    return { type: 'income', reason: 'Entrada de dinheiro identificada' };
  }
  if (/\b(cartao de credito|credito|compra aprovada|cartao final|final \d{4})\b/.test(normalized)) {
    return { type: 'card_expense', reason: 'Compra no cartao identificada' };
  }
  if (/\b(debito|pix enviado|transferencia enviada|pagamento realizado|pagamento efetuado|enviado para)\b/.test(normalized)) {
    return { type: 'expense', reason: 'Saida de dinheiro identificada' };
  }
  if (/\btransferencia\b/.test(normalized)) {
    return { type: 'transfer', reason: 'Transferencia identificada sem direcao clara' };
  }

  return { type: 'unknown', reason: 'Tipo nao identificado com confianca' };
}

function extractMerchant(rawText: string): string | undefined {
  const cleaned = rawText.replace(/\s+/g, ' ').trim();
  const patterns = [
    /\bem\s+(.+?)\s+(?:no\s+)?valor\b/i,
    /\bem\s+(.+?)\s+(?:em\s+)?\d{1,2}[\/-]\d{1,2}/i,
    /\b(?:estabelecimento|loja)\s+(.+?)\s+(?:no\s+)?valor\b/i,
    /\bpara\s+(.+?)\s+(?:no\s+)?valor\b/i,
    /\bde\s+(.+?)\s+(?:no\s+)?valor\b/i,
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    const value = match?.[1]?.trim().replace(/[.,;:]+$/, '');
    if (value && !/^\d+x?$/i.test(value) && !/^r\$/i.test(value)) return value;
  }

  return undefined;
}

function detectBankHint(rawText: string): string | undefined {
  const banks = ['sicoob', 'itau', 'itaucard', 'nubank', 'c6', 'bradesco', 'santander', 'bb', 'banco do brasil', 'caixa', 'inter'];
  const normalized = normalizeText(rawText);
  return banks.find(bank => normalized.includes(bank));
}

export function parseBankAlert(rawText: string, referenceDate = new Date()): ParsedImportResult {
  const text = rawText.trim();
  const reasons: string[] = [];

  if (!text) {
    return { type: 'unknown', confidence: 0, reasons: ['Texto vazio'] };
  }

  const amount = parseMoney(text);
  if (amount !== undefined) reasons.push('Valor monetario identificado');
  else reasons.push('Valor monetario nao identificado');

  const dateResult = parseDate(text, referenceDate);
  if (dateResult.reason) reasons.push(dateResult.reason);

  const typeResult = detectType(text);
  reasons.push(typeResult.reason);

  const cardLastDigits = parseCardLastDigits(text);
  if (cardLastDigits) reasons.push('Final do cartao identificado');

  const installments = parseInstallments(text);
  if (installments?.current && installments?.total) reasons.push('Parcela atual e total identificados');
  else if (installments?.total) reasons.push('Total de parcelas identificado');

  const merchant = extractMerchant(text);
  if (merchant) reasons.push('Estabelecimento ou contraparte sugerido por heuristica');

  const bankHint = detectBankHint(text);
  if (bankHint) reasons.push('Banco sugerido pelo texto');

  let confidence = 0.15;
  if (amount !== undefined) confidence += 0.3;
  if (dateResult.date && !dateResult.lowConfidence) confidence += 0.15;
  if (typeResult.type !== 'unknown') confidence += 0.2;
  if (merchant) confidence += 0.1;
  if (cardLastDigits) confidence += 0.1;
  if (installments) confidence += 0.05;
  if (dateResult.lowConfidence) confidence -= 0.08;

  return {
    type: typeResult.type,
    amount,
    date: dateResult.date,
    description: merchant || text.slice(0, 120),
    merchant,
    bankHint,
    cardLastDigits,
    installments,
    confidence: Math.max(0, Math.min(0.99, Number(confidence.toFixed(2)))),
    reasons,
  };
}