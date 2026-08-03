import { ImportedInvoiceLine, InvoiceLineMatch } from '../types';
import { CategoryHint, extractTextFromPdf } from './pdfInvoiceService';
import { callGroq } from './groqService';
import { normalizeInvoiceText } from '../lib/invoiceReconciliation';
import { parseInvoiceTextToMarkdown } from '../lib/invoiceMarkdownParser';

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
  const categoryMap = new Map<string, string>();
  const expenseNames: string[] = [];
  const incomeNames: string[] = [];

  for (const c of params.categories) {
    const name = c.name.toLowerCase().trim();
    if (!categoryMap.has(name)) categoryMap.set(name, c.id);
    if (c.type === 'despesa' || c.type === 'expense') {
      if (!expenseNames.includes(name) && expenseNames.length < 30) expenseNames.push(name);
    } else {
      if (!incomeNames.includes(name) && incomeNames.length < 10) incomeNames.push(name);
    }
  }

  const markdown = parseInvoiceTextToMarkdown(params.rawText);
  const useMarkdown = markdown.rows.length >= 3;

  const schemaOnly = `{
"date":"YYYY-MM-DD","description":"orig","amount":0,"type":"despesa|receita",
"kind":"purchase|installment|credit|refund|fee|payment|unknown",
"installmentNumber":null,"totalInstallments":null,
"suggestedCategoryName":"exata da lista ou null","confidence":0.8}
Despesas: [${expenseNames.join('|')}]
Receitas: [${incomeNames.join('|')}]`;

  const systemPrompt = useMarkdown
    ? `Extraia campos de cada linha da tabela de fatura. Retorne APENAS JSON array.
Cada linha da tabela = 1 item.
Regras: amount SEMPRE positivo. Parcelado: amount=valor da parcela. Não invente linhas.
${schemaOnly}`
    : `Você é um extrator de faturas de cartão de crédito brasileiras. Retorne APENAS JSON array.
${schemaOnly}
Regras extras para texto bruto:
- Ignore cabeçalhos, rodapés, limite, saldo anterior e totais.
- Datas DD/MM → YYYY-MM-DD (ano: ${new Date().getFullYear()}).
- Créditos/estornos = "receita". Compras/débitos = "despesa".`;

  const userContent = useMarkdown
    ? `Cartão: ${params.cardName}\n\nTabela da fatura:\n${markdown.table}`
    : `Cartão: ${params.cardName}\n\nTexto da fatura:\n${params.rawText.length > 6000 ? params.rawText.substring(0, 6000) + '\n[...]' : params.rawText}`;

  const result = await callGroq([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ], { model: 'llama-3.3-70b-versatile', maxTokens: 5000, temperature: 0.1 });

  return parseJsonArray<any>(result)
    .map((item, index) => {
      const raw = { ...item };
      if (raw.suggestedCategoryName && categoryMap.has(String(raw.suggestedCategoryName).toLowerCase().trim())) {
        raw.suggestedCategoryId = categoryMap.get(String(raw.suggestedCategoryName).toLowerCase().trim());
        delete raw.suggestedCategoryName;
      } else if (raw.suggestedCategoryName) {
        delete raw.suggestedCategoryName;
      }
      return normalizeLine(raw, index, params.source ?? 'pdf');
    })
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