import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { ImportedInvoiceLine, InvoiceImportSource } from '../types';
import { CategoryHint } from './pdfInvoiceService';
import { extractInvoiceLinesWithGroq, extractInvoiceTextFromPdf } from './invoiceAiService';
import { normalizeInvoiceText } from '../lib/invoiceReconciliation';

function parseMoney(value: any): number {
  if (typeof value === 'number') return value;
  const raw = String(value ?? '').trim();
  if (!raw) return 0;
  const cleaned = raw
    .replace(/R\$/gi, '')
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDate(value: any): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().split('T')[0];
  const raw = String(value ?? '').trim();
  if (!raw) return new Date().toISOString().split('T')[0];

  const br = raw.match(/(\d{1,2})[\-/](\d{1,2})(?:[\-/](\d{2,4}))?/);
  if (br) {
    const day = br[1].padStart(2, '0');
    const month = br[2].padStart(2, '0');
    const year = br[3]
      ? br[3].length === 2 ? `20${br[3]}` : br[3]
      : String(new Date().getFullYear());
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString().split('T')[0] : parsed.toISOString().split('T')[0];
}

function detectInstallment(text: string): { installmentNumber?: number; totalInstallments?: number } {
  const match = text.match(/(?:^|\D)(\d{1,2})\s*\/\s*(\d{1,2})(?:\D|$)/);
  if (!match) return {};
  return { installmentNumber: Number(match[1]), totalInstallments: Number(match[2]) };
}

function kindFromText(text: string, amount: number): ImportedInvoiceLine['kind'] {
  const normalized = normalizeInvoiceText(text);
  if (normalized.includes('estorno')) return 'refund';
  if (normalized.includes('credito') || amount < 0) return 'credit';
  if (normalized.includes('anuidade') || normalized.includes('tarifa') || normalized.includes('juros')) return 'fee';
  if (normalized.includes('pagamento')) return 'payment';
  if (detectInstallment(text).installmentNumber) return 'installment';
  return 'purchase';
}

function rowToLine(row: Record<string, any>, index: number, source: InvoiceImportSource): ImportedInvoiceLine | null {
  const keys = Object.keys(row);
  const get = (...names: string[]) => {
    const found = keys.find(key => names.some(name => key.toLowerCase().includes(name)));
    return found ? row[found] : undefined;
  };

  const rawDate = get('data', 'date', 'lançamento', 'lancamento');
  const rawAmount = get('valor', 'amount', 'preço', 'preco');
  const rawDesc = get('descr', 'hist', 'memo', 'estabelecimento', 'name', 'lançamento', 'lancamento');
  if (!rawAmount || !rawDesc) return null;

  const signedAmount = parseMoney(rawAmount);
  const description = String(rawDesc).trim();
  const installment = detectInstallment(description);
  const explicitType = String(get('tipo', 'type', 'sinal') ?? '').toLowerCase();
  const isCredit = signedAmount < 0 || explicitType.includes('cred') || explicitType.includes('rece') || normalizeInvoiceText(description).includes('estorno');

  return {
    id: `${source}-${Date.now()}-${index}`,
    source,
    rawText: JSON.stringify(row),
    date: parseDate(rawDate),
    description,
    normalizedDescription: normalizeInvoiceText(description),
    amount: Math.abs(signedAmount),
    type: isCredit ? 'receita' : 'despesa',
    kind: kindFromText(description, signedAmount),
    installmentNumber: installment.installmentNumber,
    totalInstallments: installment.totalInstallments,
    confidence: rawDate ? 0.85 : 0.65,
  };
}

function rowsToText(rows: Record<string, any>[]): string {
  return rows.map(row => Object.values(row).filter(Boolean).join(' | ')).join('\n');
}

async function parseCsv(file: File): Promise<Record<string, any>[]> {
  const text = await file.text();
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: result => resolve(result.data as Record<string, any>[]),
      error: err => reject(err),
    });
  });
}

async function parseWorkbook(file: File): Promise<Record<string, any>[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' }) as Record<string, any>[];
}

export async function parseInvoiceFile(params: {
  file: File;
  cardName: string;
  categories: CategoryHint[];
}): Promise<{
  source: InvoiceImportSource;
  lines: ImportedInvoiceLine[];
  declaredTotal?: number;
  rawText?: string;
}> {
  const lowerName = params.file.name.toLowerCase();
  const source: InvoiceImportSource = lowerName.endsWith('.pdf')
    ? 'pdf'
    : lowerName.endsWith('.xls') || lowerName.endsWith('.xlsx')
      ? 'xlsx'
      : 'csv';

  if (source === 'pdf') {
    const rawText = await extractInvoiceTextFromPdf(params.file);
    const lines = await extractInvoiceLinesWithGroq({
      rawText,
      cardName: params.cardName,
      categories: params.categories,
      source,
    });
    return { source, lines, rawText };
  }

  const rows = source === 'csv' ? await parseCsv(params.file) : await parseWorkbook(params.file);
  const parsedLines = rows
    .map((row, index) => rowToLine(row, index, source))
    .filter((line): line is ImportedInvoiceLine => Boolean(line));

  if (parsedLines.length > 0) {
    return { source, lines: parsedLines, rawText: rowsToText(rows) };
  }

  const rawText = rowsToText(rows);
  const lines = await extractInvoiceLinesWithGroq({
    rawText,
    cardName: params.cardName,
    categories: params.categories,
    source,
  });

  return { source, lines, rawText };
}