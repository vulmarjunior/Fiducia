import { OfxTransaction } from './ofxService';
import { readSpreadsheet } from './spreadsheetReader';

export interface ImportTransaction extends OfxTransaction {}

export const parseCsvOrExcel = async (file: File): Promise<ImportTransaction[]> => {
  const { rows } = await readSpreadsheet(file);
  if (rows.length < 2) return [];
  const headers = rows[0].map(value => String(value ?? '').toLowerCase().trim());
  const dataRows = rows.slice(1);
  const dateIdx = headers.findIndex(header => header.includes('data') || header.includes('date'));
  const descIdx = headers.findIndex(header => header.includes('desc') || header.includes('nome') || header.includes('name'));
  const amountIdx = headers.findIndex(header => header.includes('valor') || header.includes('amount') || header.includes('quant'));
  const typeIdx = headers.findIndex(header => header.includes('tipo') || header.includes('type'));

  return dataRows.map((row, index) => {
    const rawDate = dateIdx !== -1 ? row[dateIdx] : new Date();
    const description = descIdx !== -1 ? String(row[descIdx] ?? '') : 'Sem descrição';
    const rawAmount = amountIdx !== -1 ? row[amountIdx] : 0;
    const rawType = typeIdx !== -1 ? String(row[typeIdx] ?? '').toLowerCase() : '';
    let amount = typeof rawAmount === 'number' ? rawAmount : Number(String(rawAmount ?? 0).replace(',', '.'));
    if (!Number.isFinite(amount)) amount = 0;
    let type: 'receita' | 'despesa' = amount > 0 ? 'receita' : 'despesa';
    if (rawType.includes('rec') || rawType.includes('inc') || rawType.includes('ganho')) type = 'receita';
    else if (rawType.includes('desp') || rawType.includes('exp') || rawType.includes('gasto')) type = 'despesa';
    const parsedDate = rawDate instanceof Date ? rawDate : new Date(String(rawDate));
    return {
      id: `import-${Date.now()}-${index}`,
      type,
      amount: Math.abs(amount),
      date: Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString(),
      description: description.trim(),
    };
  });
};