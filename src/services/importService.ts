import * as XLSX from 'xlsx';
import { OfxTransaction } from './ofxService';

export interface ImportTransaction extends OfxTransaction {
  // We can add more fields if needed
}

export const parseCsvOrExcel = async (file: File): Promise<ImportTransaction[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON
        const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (json.length < 2) {
          resolve([]);
          return;
        }

        const headers = json[0].map((h: any) => String(h).toLowerCase().trim());
        const rows = json.slice(1);

        // Map columns (trying to find best match)
        const dateIdx = headers.findIndex((h: string) => h.includes('data') || h.includes('date'));
        const descIdx = headers.findIndex((h: string) => h.includes('desc') || h.includes('nome') || h.includes('name'));
        const amountIdx = headers.findIndex((h: string) => h.includes('valor') || h.includes('amount') || h.includes('quant'));
        const typeIdx = headers.findIndex((h: string) => h.includes('tipo') || h.includes('type'));

        const transactions: ImportTransaction[] = rows.map((row, index) => {
          const rawDate = dateIdx !== -1 ? row[dateIdx] : new Date();
          const description = descIdx !== -1 ? String(row[descIdx]) : 'Sem descrição';
          const rawAmount = amountIdx !== -1 ? row[amountIdx] : 0;
          const rawType = typeIdx !== -1 ? String(row[typeIdx]).toLowerCase() : '';

          let amount = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount).replace(',', '.'));
          if (isNaN(amount)) amount = 0;

          let type: 'receita' | 'despesa' = amount > 0 ? 'receita' : 'despesa';
          if (rawType.includes('rec') || rawType.includes('inc') || rawType.includes('ganho')) {
            type = 'receita';
          } else if (rawType.includes('desp') || rawType.includes('exp') || rawType.includes('gasto')) {
            type = 'despesa';
          }

          // Ensure amount is positive for the internal representation
          amount = Math.abs(amount);

          let date: string;
          if (rawDate instanceof Date) {
            date = rawDate.toISOString();
          } else {
            // Try parsing string date
            const d = new Date(String(rawDate));
            date = isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
          }

          return {
            id: `import-${Date.now()}-${index}`,
            type,
            amount,
            date,
            description: description.trim(),
          };
        });

        resolve(transactions);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};
