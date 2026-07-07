import { Account, Category, CreditCard, ImportCandidateSuggestions, ParsedImportResult, Tag } from '../types';

function normalize(value?: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function categoryMatches(category: Category, terms: string[]): boolean {
  const name = normalize(category.name);
  return terms.some(term => name.includes(normalize(term)) || normalize(term).includes(name));
}

function suggestCategory(parsed: ParsedImportResult, categories: Category[]): { categoryId?: string; reason?: string } {
  const haystack = normalize(`${parsed.merchant || ''} ${parsed.description || ''} ${parsed.categoryHint || ''}`);
  const expenseCategories = categories.filter(category => String(category.type) === 'expense' || String(category.type) === 'despesa');
  const incomeCategories = categories.filter(category => String(category.type) === 'income' || String(category.type) === 'receita');

  if (parsed.type === 'income') {
    const income = incomeCategories[0];
    return income?.id ? { categoryId: income.id, reason: 'Categoria de receita sugerida pelo tipo da operacao' } : {};
  }

  const rules: { terms: string[]; label: string }[] = [
    { terms: ['mercado', 'supermercado', 'atacadao', 'assai', 'carrefour', 'alimentacao'], label: 'alimentacao/mercado' },
    { terms: ['posto', 'combustivel', 'shell', 'ipiranga', 'petrobras', 'transporte'], label: 'transporte/combustivel' },
    { terms: ['farmacia', 'drogaria', 'pague menos', 'drogasil', 'saude'], label: 'saude/farmacia' },
    { terms: ['amazon', 'mercado livre', 'shopee', 'compras'], label: 'compras' },
    { terms: ['netflix', 'spotify', 'prime video', 'entretenimento', 'assinatura'], label: 'assinaturas/entretenimento' },
  ];

  for (const rule of rules) {
    if (!rule.terms.some(term => haystack.includes(normalize(term)))) continue;
    const category = expenseCategories.find(item => categoryMatches(item, rule.terms));
    if (category?.id) return { categoryId: category.id, reason: `Categoria sugerida por regra de ${rule.label}` };
  }

  return {};
}

function suggestTags(parsed: ParsedImportResult, tags: Tag[]): { tagIds: string[]; reasons: string[] } {
  const haystack = normalize(`${parsed.merchant || ''} ${parsed.description || ''}`);
  const desired = new Set<string>();
  if (haystack.includes('pix') || parsed.description?.toLowerCase().includes('pix')) desired.add('pix');
  if (['amazon', 'mercado livre', 'shopee', 'ifood'].some(term => haystack.includes(term))) desired.add('online');
  if (['netflix', 'spotify', 'academia', 'prime video'].some(term => haystack.includes(term))) desired.add('recorrente');

  const tagIds: string[] = [];
  const reasons: string[] = [];
  tags.forEach(tag => {
    if (tag.id && desired.has(normalize(tag.name))) {
      tagIds.push(tag.id);
      reasons.push(`Tag ${tag.name} sugerida pelo texto`);
    }
  });

  return { tagIds, reasons };
}

export function buildImportSuggestions(params: {
  parsed: ParsedImportResult;
  accounts: Account[];
  creditCards: CreditCard[];
  categories: Category[];
  tags: Tag[];
}): ImportCandidateSuggestions {
  const reasons: string[] = [];
  let accountId: string | undefined;
  let creditCardId: string | undefined;
  let confidence = 0;

  if (params.parsed.cardLastDigits) {
    const matches = params.creditCards.filter(card => card.lastFourDigits === params.parsed.cardLastDigits);
    if (matches.length === 1) {
      creditCardId = matches[0].id;
      confidence += 0.35;
      reasons.push('Cartao sugerido pelo final identificado');
    } else if (matches.length > 1) {
      reasons.push('Mais de um cartao possui o mesmo final; escolha manual necessaria');
    } else {
      reasons.push('Final de cartao identificado, mas nenhum cartao cadastrado possui esse final');
    }
  }

  if (!creditCardId && params.parsed.bankHint) {
    const bankHint = normalize(params.parsed.bankHint);
    const account = params.accounts.find(item => normalize(`${item.name} ${item.bankName || ''} ${item.bankCode || ''}`).includes(bankHint));
    if (account?.id) {
      accountId = account.id;
      confidence += 0.25;
      reasons.push('Conta sugerida pelo banco identificado no texto');
    }
  }

  const category = suggestCategory(params.parsed, params.categories);
  if (category.categoryId) {
    confidence += 0.15;
    reasons.push(category.reason || 'Categoria sugerida');
  }

  const tags = suggestTags(params.parsed, params.tags);
  if (tags.tagIds.length > 0) {
    confidence += 0.1;
    reasons.push(...tags.reasons);
  }

  return {
    accountId,
    creditCardId,
    categoryId: category.categoryId,
    tagIds: tags.tagIds,
    confidence: Math.min(0.95, Number(confidence.toFixed(2))),
    reasons,
  };
}