import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { ParsedImportResult } from '../types';
import { extractTextFromPdf } from './pdfInvoiceService';
import { parseOfx } from './ofxService';

export interface ParsedBankStatementLine {
  id: string;
  rawText: string;
  parsed: ParsedImportResult;
}

export interface BankStatementColumnMapping {
  date?: string;
  description?: string;
  amount?: string;
  debit?: string;
  credit?: string;
  type?: string;
}

export interface BankStatementFilePreview {
  kind: 'ofx' | 'csv' | 'xlsx' | 'pdf';
  fileName: string;
  sheetNames: string[];
  selectedSheet?: string;
  headers: string[];
  rowsPreview: Record<string, any>[];
  defaultMapping: BankStatementColumnMapping;
  lineCount: number;
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function parseMoney(value: any): number {
  if (typeof value === 'number') return Math.abs(value);
  const raw = String(value ?? '').trim();
  if (!raw) return 0;
  const cleaned = raw
    .replace(/R\$/gi, '')
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? Math.abs(parsed) : 0;
}

function parseSignedMoney(value: any): number {
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

function dateToIso(value: any): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().split('T')[0];
  const raw = String(value ?? '').trim();
  if (!raw) return new Date().toISOString().split('T')[0];

  const br = raw.match(/(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?/);
  if (br) {
    const day = br[1].padStart(2, '0');
    const month = br[2].padStart(2, '0');
    const year = br[3] ? (br[3].length === 2 ? `20${br[3]}` : br[3]) : String(new Date().getFullYear());
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString().split('T')[0] : parsed.toISOString().split('T')[0];
}

function findHeader(headers: string[], aliases: string[]): string | undefined {
  return headers.find(header => aliases.some(alias => normalize(header).includes(normalize(alias))));
}

function buildDefaultMapping(headers: string[]): BankStatementColumnMapping {
  return {
    date: findHeader(headers, ['data', 'date', 'lancamento', 'movimento']),
    description: findHeader(headers, ['descricao', 'descr', 'historico', 'memo', 'nome', 'name', 'estabelecimento']),
    amount: findHeader(headers, ['valor', 'amount', 'quantia', 'total']),
    debit: findHeader(headers, ['debito', 'debit', 'saida']),
    credit: findHeader(headers, ['credito', 'credit', 'entrada']),
    type: findHeader(headers, ['tipo', 'type', 'sinal']),
  };
}

function valueFrom(row: Record<string, any>, key?: string): any {
  return key ? row[key] : undefined;
}

function rowToLine(row: Record<string, any>, index: number, source: string, mapping: BankStatementColumnMapping): ParsedBankStatementLine | null {
  const rawDate = valueFrom(row, mapping.date);
  const rawDescription = valueFrom(row, mapping.description);
  const rawAmount = valueFrom(row, mapping.amount);
  const rawDebit = valueFrom(row, mapping.debit);
  const rawCredit = valueFrom(row, mapping.credit);
  const rawType = normalize(String(valueFrom(row, mapping.type) ?? ''));
  const signedAmount = rawAmount !== undefined
    ? parseSignedMoney(rawAmount)
    : parseSignedMoney(rawCredit) - parseSignedMoney(rawDebit);
  const amount = parseMoney(rawAmount !== undefined ? rawAmount : signedAmount);
  const description = String(rawDescription || 'Lancamento importado').trim();

  if (!amount || !description) return null;

  const type = signedAmount > 0 || rawType.includes('rece') || rawType.includes('cred') || rawType.includes('entrada')
    ? 'income'
    : 'expense';
  const date = dateToIso(rawDate);
  const rawText = JSON.stringify(row);

  return {
    id: `${source}-${Date.now()}-${index}`,
    rawText,
    parsed: {
      type,
      amount,
      date,
      description,
      merchant: description,
      confidence: rawDate ? 0.78 : 0.62,
      reasons: [
        'Linha importada de arquivo bancario',
        rawDate ? 'Data identificada na coluna do arquivo' : 'Data ausente; usada data atual',
        rawAmount !== undefined || rawDebit !== undefined || rawCredit !== undefined ? 'Valor identificado na coluna do arquivo' : 'Valor inferido com baixa confianca',
      ],
    },
  };
}

async function parseCsvRows(file: File): Promise<Record<string, any>[]> {
  const text = await file.text();
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: result => resolve(result.data as Record<string, any>[]),
      error: error => reject(error),
    });
  });
}

async function readWorkbook(file: File): Promise<XLSX.WorkBook> {
  const buffer = await file.arrayBuffer();
  return XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true });
}

function rowsFromWorkbook(workbook: XLSX.WorkBook, sheetName?: string): Record<string, any>[] {
  const name = sheetName || workbook.SheetNames[0];
  if (!name) return [];
  return XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: '' }) as Record<string, any>[];
}

function headersFromRows(rows: Record<string, any>[]): string[] {
  return Object.keys(rows[0] || {});
}

function pdfLineToRow(line: string, index: number): Record<string, any> | null {
  const amountMatch = line.match(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*|\d+),\s*(\d{2})/);
  if (!amountMatch) return null;
  const dateMatch = line.match(/(\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?)/);
  const amountText = amountMatch[0];
  const description = line
    .replace(dateMatch?.[0] || '', '')
    .replace(amountText, '')
    .replace(/\s+/g, ' ')
    .trim() || `Linha PDF ${index + 1}`;

  return {
    Data: dateMatch?.[0] || '',
    Descricao: description,
    Valor: amountText,
    Linha: line,
  };
}

async function parsePdfRows(file: File): Promise<Record<string, any>[]> {
  const rawText = await extractTextFromPdf(file);
  return rawText
    .split(/\n|(?<=\d{2})\s+(?=\d{1,2}[\/-]\d{1,2})/)
    .map((line, index) => pdfLineToRow(line.trim(), index))
    .filter((row): row is Record<string, any> => Boolean(row));
}

function fileKind(file: File): BankStatementFilePreview['kind'] {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith('.ofx')) return 'ofx';
  if (lowerName.endsWith('.csv')) return 'csv';
  if (lowerName.endsWith('.xls') || lowerName.endsWith('.xlsx')) return 'xlsx';
  if (lowerName.endsWith('.pdf')) return 'pdf';
  throw new Error('Formato de arquivo nao suportado. Use OFX, CSV, XLS, XLSX ou PDF textual.');
}

export async function getBankStatementFilePreview(file: File, selectedSheet?: string): Promise<BankStatementFilePreview> {
  const kind = fileKind(file);

  if (kind === 'ofx') {
    const text = await file.text();
    const txs = parseOfx(text);
    return {
      kind,
      fileName: file.name,
      sheetNames: [],
      headers: [],
      rowsPreview: txs.slice(0, 5).map(tx => ({ data: tx.date, descricao: tx.description, valor: tx.amount, tipo: tx.type })),
      defaultMapping: {},
      lineCount: txs.length,
    };
  }

  if (kind === 'xlsx') {
    const workbook = await readWorkbook(file);
    const rows = rowsFromWorkbook(workbook, selectedSheet);
    const headers = headersFromRows(rows);
    return {
      kind,
      fileName: file.name,
      sheetNames: workbook.SheetNames,
      selectedSheet: selectedSheet || workbook.SheetNames[0],
      headers,
      rowsPreview: rows.slice(0, 5),
      defaultMapping: buildDefaultMapping(headers),
      lineCount: rows.length,
    };
  }

  const rows = kind === 'csv' ? await parseCsvRows(file) : await parsePdfRows(file);
  const headers = headersFromRows(rows);
  return {
    kind,
    fileName: file.name,
    sheetNames: [],
    headers,
    rowsPreview: rows.slice(0, 5),
    defaultMapping: buildDefaultMapping(headers),
    lineCount: rows.length,
  };
}

export async function parseBankStatementFile(file: File, options: {
  sheetName?: string;
  mapping?: BankStatementColumnMapping;
} = {}): Promise<ParsedBankStatementLine[]> {
  const kind = fileKind(file);

  if (kind === 'ofx') {
    const text = await file.text();
    return parseOfx(text).map((tx, index) => ({
      id: `ofx-${tx.id || index}`,
      rawText: JSON.stringify({ fileName: file.name, ...tx }),
      parsed: {
        type: tx.type === 'receita' ? 'income' : 'expense',
        amount: tx.amount,
        date: tx.date.split('T')[0],
        description: tx.description,
        merchant: tx.description,
        confidence: 0.9,
        reasons: ['Linha importada de arquivo OFX', 'Data, valor e descricao extraidos do OFX'],
      },
    }));
  }

  const rows = kind === 'csv'
    ? await parseCsvRows(file)
    : kind === 'pdf'
      ? await parsePdfRows(file)
      : rowsFromWorkbook(await readWorkbook(file), options.sheetName);

  const headers = headersFromRows(rows);
  const mapping = options.mapping || buildDefaultMapping(headers);
  return rows
    .map((row, index) => rowToLine(row, index, kind, mapping))
    .filter((line): line is ParsedBankStatementLine => Boolean(line));
}