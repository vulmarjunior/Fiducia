import { ImportedInvoiceLine, InvoiceLineMatch } from '../types';
import { CategoryHint, extractTextFromPdf } from './pdfInvoiceService';
import { callGroq } from './groqService';
import { normalizeInvoiceText } from '../lib/invoiceReconciliation';

function parseJsonArray<T>(value: string): T[] {
  const jsonMatch = value.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];
  return JSON.parse(jsonMatch[0]) as T[];
}

function normalizeLine(raw: any, index: number, source: 'pdf' | 'csv' | 'xlsx'): ImportedInvoiceLine | null {
  if (!raw?.date || !raw?.description || typeof raw?.amount !== 'number') return null;

  const date = String(raw.date).split('T')[0];
  const installmentNumber = Number(raw.installmentNumber || raw.installment_number || 0) || undefined;
  const totalInstallments = Number(raw.totalInstallments || raw.total_installments || 0) || undefined;
  const description = String(raw.description).trim();
  const kind = ['purchase', 'installment', 'credit', 'refund', 'fee', 'payment', 'unknown'].includes(raw.kind)
    ? raw.kind
    : installmentNumber && totalInstallments
      ? 'installment'
      : raw.type === 'receita'
        ? 'credit'
        : 'purchase';

  return {
    id: raw.id ? String(raw.id) : `${source}-${Date.now()}-${index}`,
    source,
    rawText: raw.rawText ? String(raw.rawText) : undefined,
    date,
    description,
    normalizedDescription: raw.normalizedDescription ? String(raw.normalizedDescription) : normalizeInvoiceText(description),
    amount: Math.abs(raw.amount),
    type: raw.type === 'receita' ? 'receita' : 'despesa',
    kind,
    installmentNumber,
    totalInstallments,
    suggestedCategoryId: raw.suggestedCategoryId || undefined,
    confidence: Math.max(0, Math.min(1, Number(raw.confidence ?? 0.7))),
  };
}

export async function extractInvoiceLinesWithGroq(params: {
  rawText: string;
  cardName: string;
  categories: CategoryHint[];
  source?: 'pdf' | 'csv' | 'xlsx';
}): Promise<ImportedInvoiceLine[]> {
  const truncated = params.rawText.length > 18000
    ? `${params.rawText.substring(0, 18000)}\n[... texto truncado ...]`
    : params.rawText;

  const expenseCategories = params.categories
    .filter(c => c.type === 'despesa' || c.type === 'expense')
    .slice(0, 50)
    .map(c => ({ id: c.id, name: c.name }));

  const incomeCategories = params.categories
    .filter(c => c.type === 'receita' || c.type === 'income')
    .slice(0, 20)
    .map(c => ({ id: c.id, name: c.name }));

  const currentYear = new Date().getFullYear();

  const systemPrompt = `Você é um extrator de faturas de cartão de crédito brasileiras. Retorne APENAS um array JSON válido.

Schema obrigatório por item:
{"date":"YYYY-MM-DD","description":"texto","normalizedDescription":"texto limpo","amount":123.45,"type":"despesa|receita","kind":"purchase|installment|credit|refund|fee|payment|unknown","installmentNumber":1|null,"totalInstallments":10|null,"suggestedCategoryId":"id|null","confidence":0.0,"rawText":"linha original"}

Regras:
- Não invente linhas. Se não tiver certeza, use confidence baixa e kind "unknown".
- Compras/débitos são "despesa". Créditos, estornos e abatimentos são "receita".
- O amount deve ser sempre positivo.
- Compra parcelada deve usar o valor individual da parcela exibida, nunca o valor total da compra.
- Preserve parcela atual/total quando existir texto como 03/10, 3 de 10 ou PARC 03.
- Ignore cabeçalhos, rodapés, limite, saldo anterior, vencimento e totais sem linha individual.
- Converta datas DD/MM para YYYY-MM-DD usando o ano mais provável da fatura; se o ano não aparecer, use ${currentYear}.
- Categorias de despesa disponíveis: ${JSON.stringify(expenseCategories)}
- Categorias de receita disponíveis: ${JSON.stringify(incomeCategories)}
- suggestedCategoryId deve ser null se nenhuma categoria encaixar.`;

  const result = await callGroq([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Cartão: ${params.cardName}\n\nTexto/linhas da fatura:\n${truncated}` },
  ], { model: 'llama-3.3-70b-versatile', maxTokens: 5000, temperature: 0.1 });

  return parseJsonArray<any>(result)
    .map((item, index) => normalizeLine(item, index, params.source ?? 'pdf'))
    .filter((item): item is ImportedInvoiceLine => Boolean(item));
}

export async function extractInvoiceTextFromPdf(file: File): Promise<string> {
  return extractTextFromPdf(file);
}

export async function matchInvoiceLinesWithGroq(params: {
  importedLines: ImportedInvoiceLine[];
  systemTransactions: any[];
  cardName: string;
  invoicePeriod: string;
}): Promise<InvoiceLineMatch[]> {
  const relevantLines = params.importedLines.slice(0, 120).map(line => ({
    id: line.id,
    date: line.date,
    desc: line.description,
    normalized: line.normalizedDescription || normalizeInvoiceText(line.description),
    amount: line.amount,
    type: line.type,
    installment: line.installmentNumber && line.totalInstallments ? `${line.installmentNumber}/${line.totalInstallments}` : null,
  }));

  const relevantTransactions = params.systemTransactions.slice(0, 160).map(tx => ({
    id: tx.id,
    date: String(tx.date || '').split('T')[0],
    desc: tx.description,
    normalized: normalizeInvoiceText(tx.description || ''),
    amount: tx.amount,
    type: tx.type,
    installment: tx.installmentNumber && tx.totalInstallments ? `${tx.installmentNumber}/${tx.totalInstallments}` : null,
    categoryId: tx.categoryId || null,
  }));

  const prompt = `Faça a conciliação semântica entre linhas de uma fatura fechada e lançamentos já existentes no Fiducia.

Cartão: ${params.cardName}
Período: ${params.invoicePeriod}

Regras:
- Cada linha importada pode casar com no máximo um lançamento do sistema.
- Cada lançamento do sistema pode ser usado uma única vez.
- Não invente matches. Se não houver correspondência, use systemTransactionId null.
- Mesmo valor e descrição parecida são evidências fortes.
- Diferença de data até 7 dias pode ser aceitável.
- Se valor/data/categoria divergirem, sugira update_transaction.
- Responda APENAS JSON válido no formato:
[{"importedLineId":"id","systemTransactionId":"id-ou-null","confidence":0.91,"reason":"motivo curto","differences":{},"suggestedAction":"confirm_match|create_transaction|update_transaction|ignore|manual_review"}]

Linhas da fatura:
${JSON.stringify(relevantLines)}

Lançamentos do Fiducia:
${JSON.stringify(relevantTransactions)}`;

  const result = await callGroq([{ role: 'user', content: prompt }], {
    model: 'llama-3.3-70b-versatile',
    maxTokens: 4000,
    temperature: 0.1,
  });

  return parseJsonArray<any>(result)
    .filter(item => item?.importedLineId)
    .map(item => ({
      importedLineId: String(item.importedLineId),
      systemTransactionId: item.systemTransactionId ? String(item.systemTransactionId) : undefined,
      confidence: Math.max(0, Math.min(1, Number(item.confidence ?? 0.5))),
      reason: String(item.reason || 'Sugestão da IA'),
      differences: item.differences && typeof item.differences === 'object' ? item.differences : {},
      suggestedAction: ['confirm_match', 'create_transaction', 'update_transaction', 'ignore', 'manual_review'].includes(item.suggestedAction)
        ? item.suggestedAction
        : 'manual_review',
    }));
}