import readXlsxFile, { readSheetNames } from 'read-excel-file';

export type SpreadsheetCell = string | number | boolean | Date | null;

export async function readSpreadsheet(file: File, sheetName?: string): Promise<{ sheetNames: string[]; rows: SpreadsheetCell[][] }> {
  if (file.name.toLowerCase().endsWith('.xls')) {
    throw new Error('O formato XLS antigo não é mais aceito por segurança. Salve o arquivo como XLSX ou CSV.');
  }
  const sheetNames = await readSheetNames(file);
  const selectedSheet = sheetName || sheetNames[0];
  const rows = selectedSheet ? await readXlsxFile(file, { sheet: selectedSheet }) : [];
  return { sheetNames, rows: rows as SpreadsheetCell[][] };
}

export function spreadsheetRowsToObjects(rows: SpreadsheetCell[][]): Record<string, any>[] {
  const headers = (rows[0] || []).map((value, index) => String(value ?? `Coluna ${index + 1}`).trim());
  return rows.slice(1).map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
}