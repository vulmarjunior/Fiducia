import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import * as xlsx from 'xlsx';
import { 
  Upload, 
  Check, 
  AlertCircle, 
  FileSpreadsheet, 
  FileCode, 
  Landmark, 
  Trash2, 
  Search, 
  SlidersHorizontal, 
  ArrowUpDown,
  ListFilter
} from 'lucide-react';
import { useFirebase } from '../context/FirebaseContext';
import { Account, Category, Transaction, ClosedPeriod, CreditCard } from '../types';
import { getInvoicePeriod } from '../utils/creditCardUtils';

interface OFXImporterProps {
  accounts: Account[];
  categories: Category[];
  creditCards?: CreditCard[];
  closedPeriods?: ClosedPeriod[];
  onRefresh: () => void;
}

interface ParsedStatementTx {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  categoryId?: string;
  imported?: boolean;
  installmentNumber?: number;
  totalInstallments?: number;
}

// Intelligent Guessing Heuristics for Portuguese/Brazilian bank accounts
const guessCategory = (description: string, type: 'income' | 'expense', categories: Category[]): string => {
  const descLower = description.toLowerCase();
  
  // Specific map of common tags/keywords to category search words
  const expenseKeywordMap: { [key: string]: string[] } = {
    'transporte': ['uber', '99app', 'cabify', 'metrô', 'combustivel', 'posto', 'gasolina', 'bradescar', 'shell', 'ipiranga', 'pedágio', 'carro', 'estacionamento', 'lupa', 'semparar', 'veloe'],
    'alimentação': ['ifood', 'mcdonalds', 'bk ', 'burger', 'habibs', 'outback', 'restaurante', 'padaria', 'confeitaria', 'supermercado', 'carrefour', 'pao de acucar', 'extra', 'hortifruti', 'mercearia', 'atacadão', 'assai', 'comida', 'bife', 'churrascaria', 'pizzaria', 'café', 'starbucks', 'panificadora', 'açougue', 'doceria', 'sorveteria'],
    'lazer': ['netflix', 'spotify', 'steam', 'cinemark', 'playstation', 'xbox', 'ingressos', 'disney', 'hbo', 'prime video', 'lazer', 'viagem', 'hotel', 'airbnb', 'show', 'cinema', 'cerveja', 'pub', 'bar '],
    'saúde': ['farmacia', 'drogaria', 'pague menos', 'raia', 'panvel', 'saude', 'hospital', 'clinica', 'medico', 'dentista', 'remédio', 'laboratório', 'exame', 'consulta', 'cardiologia', 'unimed', 'bradesco saude'],
    'utilidades': ['enel', 'light', 'sabesp', 'copasa', 'telemar', 'claro', 'vivo', 'tim', 'net ', 'gvt', 'energia', 'água', 'telefone', 'internet', 'celular', 'provedor', 'hospedagem', 'ituran'],
    'moradia': ['aluguel', 'condominio', 'iptu', 'reforma', 'material de construcao', 'leroy', 'mobília', 'tokstok', 'marceneiro', 'chaveiro'],
    'educação': ['escola', 'faculdade', 'curso', 'livraria', 'udemy', 'coursera', 'mensalidade', 'estudo', 'idiomas', 'ingles'],
    'vestuário': ['roupa', 'calçado', 'zara', 'renner', 'c&a', 'riachuelo', 'nike', 'adidas', 'sapato', 'loja', 'vestuario', 'acessorios', 'hering', 'decathlon'],
    'taxas': ['iof', 'tarifa', 'anuidade', 'mensalidade banco', 'juro', 'multa', 'imposto']
  };

  const incomeKeywordMap: { [key: string]: string[] } = {
    'salário': ['salario', 'provid', 'pagamento recebi', 'recebimento', 'vencimento', 'folha de pagamento', 'remuneração', 'contracheque', 'pro-labore', 'pro labore'],
    'investimentos': ['investimento', 'aplicação', 'resgate', 'rendimento', 'dividendos', 'jcp', 'fii', 'tesouro', 'ações'],
    'receita': ['pix recebido', 'transferência recebida', 'ted recebida', 'doc recebida', 'reembolso', 'venda', 'receita', 'ganho', 'faturamento', 'pago por', 'recompensa']
  };

  const keywordMap = type === 'income' ? incomeKeywordMap : expenseKeywordMap;

  // 1. Match high-level concept words through keywords dictionary
  for (const [concept, keywords] of Object.entries(keywordMap)) {
    if (keywords.some(k => descLower.includes(k))) {
      const found = categories.find(c => {
        if (c.type !== type) return false;
        const nameLower = c.name.toLowerCase();
        return nameLower.includes(concept) || concept.includes(nameLower);
      });
      if (found) return found.id || '';
    }
  }

  // 2. Fallback check: find any category whose name behaves as a substring inside description
  const matchingCategory = categories.find(c => {
    if (c.type !== type) return false;
    const nameLower = c.name.toLowerCase();
    return nameLower.length > 2 && descLower.includes(nameLower);
  });
  
  if (matchingCategory) return matchingCategory.id || '';

  // 3. Simple keyword splitting fallback
  const keywordFallback = categories.find(c => {
    if (c.type !== type) return false;
    const splitWords = c.name.toLowerCase().split(' ');
    return splitWords.some(w => w.length > 3 && descLower.includes(w));
  });

  return keywordFallback?.id || '';
};

// Helper to parse dates in DD/MM/YYYY, YYYY-MM-DD, or DD/MM/YY format
const parseBrazilianDate = (val: any): Date => {
  if (val === undefined || val === null) return new Date();
  if (val instanceof Date) return val;
  const str = String(val).trim();
  if (!str) return new Date();

  // Try pattern matching for DD/MM/YYYY or YYYY-MM-DD or DD/MM/YY first to avoid default JS American locale month-day swap
  const parts = str.split(/[\s/:\-.]/); // split by divider chars
  if (parts.length >= 3) {
    const part0 = parts[0].trim();
    const part1 = parts[1].trim();
    const part2 = parts[2].trim();

    const p0 = parseInt(part0, 10);
    const p1 = parseInt(part1, 10);
    let p2 = parseInt(part2, 10);

    if (!isNaN(p0) && !isNaN(p1) && !isNaN(p2)) {
      if (part0.length === 4) {
        // YYYY-MM-DD (like Itaú export format)
        return new Date(p0, p1 - 1, p2, 12, 0, 0);
      } else {
        // DD/MM/YYYY or DD/MM/YY (like C6 Bank format)
        if (p2 < 100) {
          p2 += p2 < 50 ? 2000 : 1900;
        }
        return new Date(p2, p1 - 1, p0, 12, 0, 0);
      }
    }
  }
  
  // Try direct parse as a fallback
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;
  
  return new Date();
};

const parseExcelDateValue = (val: any): Date => {
  if (typeof val === 'number') {
    // Excel stores dates as serial numbers (25569 is the offset for 1970-01-01)
    return new Date(Math.round((val - 25569) * 86400 * 1000));
  }
  return parseBrazilianDate(val);
};

// Robust parser specifically designed for Brazilian currency (comma as decimals, dot as thousands, currency symbols)
const parseBrazilianNumber = (val: any): number => {
  if (val === undefined || val === null) return NaN;
  if (typeof val === 'number') {
    // Sometimes excel values are stored with inverse logic or as pure numbers
    return val;
  }
  let str = String(val).trim();
  if (!str) return 0;
  
  // Remove currency symbols and space
  str = str.replace(/R\$\s*/gi, '');
  
  // If there is a trailing minus sign like 10,00-
  if (str.endsWith('-')) {
    str = '-' + str.slice(0, -1);
  }
  // Remove all literal whitespace
  str = str.replace(/\s/g, '');
  
  const commaIndex = str.indexOf(',');
  const dotIndex = str.indexOf('.');
  
  if (commaIndex !== -1) {
    // Brazilian formatting has a comma for decimals. Remove all thousands dots
    str = str.replace(/\./g, '');
    // Replace the decimal comma with a dot
    str = str.replace(',', '.');
  } else {
    // No comma. Check multiple dots
    const dotCount = (str.match(/\./g) || []).length;
    if (dotCount > 1) {
      str = str.replace(/\./g, '');
    } else if (dotCount === 1) {
      // If a single dot has exactly 3 digits after it, it is likely thousands rather than cents.
      // E.g. "1.250" -> 1250, because C6/Itaú usually export without cents or separate cents.
      const parts = str.split('.');
      if (parts.length === 2 && parts[1].length === 3) {
        str = str.replace(/\./g, '');
      }
    }
  }
  return Number(str);
};

// Extracts installment metadata from a description or string cell (e.g., "7/10" or "6 de 12")
const extractInstallmentFromDesc = (desc: string): { installmentNumber?: number; totalInstallments?: number; representation?: string } => {
  if (!desc) return {};
  const regex = /\b(\d+)\s*(?:\/|de)\s*(\d+)\b/i;
  const match = desc.match(regex);
  if (match) {
    const current = parseInt(match[1], 10);
    const total = parseInt(match[2], 10);
    if (!isNaN(current) && !isNaN(total) && current <= total && total > 1) {
      return {
        installmentNumber: current,
        totalInstallments: total,
        representation: `${current}/${total}`
      };
    }
  }
  return {};
};

const formatDescriptionWithInstallment = (desc: string, current: number, total: number): string => {
  if (!desc) return '';
  const regex = /\b(\d+)\s*(?:\/|de)\s*(\d+)\b/i;
  if (regex.test(desc)) {
    return desc.replace(regex, `${current}/${total}`);
  }
  return `${desc} (${current}/${total})`;
};

// Finds the table start row inside a 2D sheet (helps bypass metadata headers of Itaú and C6)
const findHeaderRowAndData = (grid: any[][]): { headers: string[], dataRows: any[][] } => {
  const dateKeywords = ['data', 'date', 'dt_'];
  const descKeywords = ['desc', 'memo', 'hist', 'esta', 'lança', 'lanca', 'transa', 'nome', 'local', 'título', 'titulo'];
  const amountKeywords = ['valor', 'val', 'amt', 'amou', 'quant', 'preç', 'prec', 'déb', 'deb', 'saldo'];

  let headerIndex = -1;
  const maxSearchRows = Math.min(grid.length, 25);
  
  for (let r = 0; r < maxSearchRows; r++) {
    const row = grid[r];
    if (!row || !Array.isArray(row)) return { headers: [], dataRows: [] };
    
    let hasDate = false;
    let hasDesc = false;
    let hasAmount = false;
    
    for (let c = 0; c < row.length; c++) {
      const cellVal = String(row[c] || '').toLowerCase().trim();
      if (!cellVal) continue;
      
      if (dateKeywords.some(k => cellVal.includes(k))) {
        hasDate = true;
      }
      if (descKeywords.some(k => cellVal.includes(k))) {
        hasDesc = true;
      }
      if (amountKeywords.some(k => cellVal.includes(k))) {
        hasAmount = true;
      }
    }
    
    // Header found if at least two key components are matched (specifically Date + (Amount or Description))
    if (hasDate && (hasAmount || hasDesc)) {
      headerIndex = r;
      break;
    }
  }

  // Fallback to first row containing elements
  if (headerIndex === -1) {
    for (let r = 0; r < grid.length; r++) {
      if (grid[r] && grid[r].some(v => v !== undefined && v !== null && String(v).trim() !== '')) {
        headerIndex = r;
        break;
      }
    }
  }

  if (headerIndex === -1) {
    return { headers: [], dataRows: [] };
  }

  const rawHeaders = grid[headerIndex] || [];
  const headers = rawHeaders.map((h, idx) => {
    const s = String(h || '').trim();
    return s ? s : `col_${idx}`;
  });

  const dataRows = grid.slice(headerIndex + 1).filter(row => {
    return row && row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== '');
  });

  return { headers, dataRows };
};

// Helper to resolve specific column index matches based on bank headers
const mapColumns = (headers: string[]) => {
  const datePool = ['data', 'date', 'dt_'];
  const descPool = ['desc', 'memo', 'hist', 'esta', 'lança', 'lanca', 'transa', 'nome', 'local', 'título', 'titulo'];
  const amountPool = ['valor', 'val', 'amt', 'amou', 'quant', 'preç', 'prec', 'déb', 'deb', 'saldo'];

  let dateIdx = -1;
  let descIdx = -1;
  let amountIdx = -1;

  // 1. Exact or direct lowercase check
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase();
    if (datePool.some(k => h === k)) dateIdx = i;
    if (descPool.some(k => h === k)) descIdx = i;
    if (amountPool.some(k => h === k)) amountIdx = i;
  }

  // 2. Substring matching fallback
  if (dateIdx === -1) {
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i].toLowerCase();
      if (datePool.some(k => h.includes(k))) { dateIdx = i; break; }
    }
  }
  if (descIdx === -1) {
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i].toLowerCase();
      if (descPool.some(k => h.includes(k))) { descIdx = i; break; }
    }
  }
  if (amountIdx === -1) {
    const matchedAmountIndices: number[] = [];
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i].toLowerCase();
      if (amountPool.some(k => h.includes(k))) {
        matchedAmountIndices.push(i);
      }
    }
    if (matchedAmountIndices.length > 0) {
      // Prioritize explicit BRL (R$) or Real/Reais headers
      const brIdx = matchedAmountIndices.find(idx => {
        const h = headers[idx].toLowerCase();
        return h.includes('r$') || h.includes('real') || h.includes('reais');
      });
      if (brIdx !== undefined) {
        amountIdx = brIdx;
      } else {
        // Exclude foreign or USD-based fields if multiple exist
        const cleanIdx = matchedAmountIndices.find(idx => {
          const h = headers[idx].toLowerCase();
          return !h.includes('us$') && !h.includes('dolar') && !h.includes('dólar') && !h.includes('usd');
        });
        if (cleanIdx !== undefined) {
          amountIdx = cleanIdx;
        } else {
          amountIdx = matchedAmountIndices[0];
        }
      }
    }
  }

  // 3. Absolute structural fallback
  if (dateIdx === -1) dateIdx = 0;
  if (descIdx === -1) descIdx = headers.length > 1 ? 1 : 0;
  if (amountIdx === -1) amountIdx = headers.length > 2 ? 2 : (headers.length > 1 ? 1 : 0);

  return { dateIdx, descIdx, amountIdx };
};

export const OFXImporter: React.FC<OFXImporterProps> = ({ accounts, categories, creditCards = [], closedPeriods = [], onRefresh }) => {
  const { createBulkTransactions, currentUser, authUser } = useFirebase();
  const [selectedDestination, setSelectedDestination] = useState<string>('');
  const [importedTxs, setImportedTxs] = useState<ParsedStatementTx[]>([]);
  const [fileInfo, setFileInfo] = useState<{ name: string; size: string } | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [status, setStatus] = useState<{ type: 'success' | 'err'; msg: string } | null>(null);

  // States for installment projections & invoice period override
  const [projectFutureInstallments, setProjectFutureInstallments] = useState<boolean>(true);
  const [overrideInvoicePeriod, setOverrideInvoicePeriod] = useState<boolean>(true); // Enabled by default to make May 2026 statements import painless
  const [overrideInvoiceMonth, setOverrideInvoiceMonth] = useState<string>('2026-05'); // Defaults to May 2026 (matching the user's data month)

  const getPeriodOptions = () => {
    const list = [];
    const now = new Date();
    // Generate list from -6 months to +6 months
    for (let i = -6; i <= 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const periodStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const tempDisplay = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      const displayStr = tempDisplay.charAt(0).toUpperCase() + tempDisplay.slice(1);
      list.push({ value: periodStr, display: displayStr });
    }
    return list;
  };
  
  // Custom Filters & Interactive features
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'uncategorized' | 'income' | 'expense'>('all');
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
  const [bulkCategoryId, setBulkCategoryId] = useState<string>('');

  // States for resilient visual file columns mapping
  const [rawFileGrid, setRawFileGrid] = useState<any[][]>([]);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [headerRowIdxSelected, setHeaderRowIdxSelected] = useState<number>(0);
  const [mappedDateIdx, setMappedDateIdx] = useState<number>(-1);
  const [mappedDescIdx, setMappedDescIdx] = useState<number>(-1);
  const [mappedAmountIdx, setMappedAmountIdx] = useState<number>(-1);
  const [invertSigns, setInvertSigns] = useState<boolean>(false);
  const [isAdjustingMapping, setIsAdjustingMapping] = useState<boolean>(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize first destination if available
  React.useEffect(() => {
    if (accounts.length > 0) {
      setSelectedDestination(`acc_${accounts[0].id || ''}`);
    } else if (creditCards.length > 0) {
      setSelectedDestination(`card_${creditCards[0].id || ''}`);
    }
  }, [accounts, creditCards]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = async (file: File) => {
    setFileInfo({
      name: file.name,
      size: (file.size / 1024).toFixed(1) + ' KB'
    });
    setStatus(null);
    setSelectedTxIds([]);

    const reader = new FileReader();

    if (file.name.toLowerCase().endsWith('.ofx')) {
      reader.onload = (e) => {
        const text = e.target?.result as string;
        parseOFX(text);
      };
      reader.readAsText(file);
    } else if (file.name.toLowerCase().endsWith('.csv')) {
      reader.onload = (e) => {
        const text = e.target?.result as string;
        parseCSV(text);
      };
      reader.readAsText(file);
    } else if (file.name.toLowerCase().endsWith('.xls') || file.name.toLowerCase().endsWith('.xlsx')) {
      try {
        const data = await file.arrayBuffer();
        parseExcel(data);
      } catch (err) {
        setStatus({ type: 'err', msg: 'Erro ao interpretar o arquivo Excel.' });
      }
    } else {
      setStatus({
        type: 'err',
        msg: 'Apenas arquivos .OFX, .CSV, .XLS ou .XLSX são aceitos.'
      });
    }
  };

  // Ultra compatible OFX regex parser tags
  const parseOFX = (text: string) => {
    try {
      const txs: ParsedStatementTx[] = [];
      const stmttrns: string[] = (text.match(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/g) as string[]) || [];

      stmttrns.forEach((trn: string, index) => {
        const amtMatch = trn.match(/<TRNAMT>(.*)/);
        const dateMatch = trn.match(/<DTPOSTED>(.*)/);
        const fitidMatch = trn.match(/<FITID>(.*)/);
        const memoMatch = trn.match(/<MEMO>(.*)/) || trn.match(/<NAME>(.*)/);

        if (amtMatch && dateMatch && memoMatch) {
          const amtStr = amtMatch[1].trim();
          const amount = Number(amtStr);
          const rawDate = dateMatch[1].trim(); // YYYYMMDDHHMMSS
          
          let parsedDate = new Date();
          if (rawDate.length >= 8) {
            const y = parseInt(rawDate.substring(0, 4));
            const m = parseInt(rawDate.substring(4, 6)) - 1;
            const d = parseInt(rawDate.substring(6, 8));
            parsedDate = new Date(y, m, d);
          }

          const description = memoMatch[1].trim();
          const trnType = amount >= 0 ? 'income' : 'expense';
          const fitid = fitidMatch ? fitidMatch[1].trim() : `ofx_${Date.now()}_${index}`;
          const guessedId = guessCategory(description, trnType, categories);

          txs.push({
            id: fitid,
            date: parsedDate.toISOString(),
            description,
            amount: Math.abs(amount),
            type: trnType,
            categoryId: guessedId
          });
        }
      });

      if (txs.length === 0) {
        setStatus({ type: 'err', msg: 'Nenhuma transação encontrada no arquivo OFX.' });
      } else {
        setImportedTxs(txs);
        setStatus({ type: 'success', msg: `${txs.length} transações carregadas com sucesso! Atribuímos automaticamente as categorias sugeridas.` });
      }
    } catch (err) {
      console.error(err);
      setStatus({ type: 'err', msg: 'Erro ao interpretar o arquivo OFX.' });
    }
  };

  const processGridToTxs = (
    headers: string[],
    dataRows: any[][],
    dateIdxSelected: number,
    descIdxSelected: number,
    amountIdxSelected: number,
    invert: boolean
  ) => {
    const txs: ParsedStatementTx[] = [];
    const isCard = selectedDestination.startsWith('card_');

    // Find if there is an installment column in the metadata headers
    const installmentPool = ['parcela', 'parcelas', 'installment', 'parc_'];
    const installmentIdxSelected = headers.findIndex(h => installmentPool.some(k => h.toLowerCase().includes(k)));

    dataRows.forEach((row, index) => {
      if (!row || row.length <= Math.max(dateIdxSelected, descIdxSelected, amountIdxSelected)) return;

      const dateVal = row[dateIdxSelected];
      const descVal = row[descIdxSelected];
      const amtVal = row[amountIdxSelected];

      if (dateVal === undefined || dateVal === null || descVal === undefined || descVal === null || amtVal === undefined || amtVal === null) {
        return;
      }

      let rawAmount = parseBrazilianNumber(amtVal);
      if (isNaN(rawAmount) || rawAmount === 0) return;

      if (invert) {
        rawAmount = -rawAmount;
      }

      const parsedDate = parseExcelDateValue(dateVal);
      const description = String(descVal).trim();
      if (!description) return;

      let trnType: 'income' | 'expense' = 'expense';
      if (isCard) {
        const dLower = description.toLowerCase();
        const looksLikeRefundOrPayment = dLower.includes('pagamento') || 
                                        dLower.includes('pgto') || 
                                        dLower.includes('estorno') || 
                                        dLower.includes('crédito') || 
                                        dLower.includes('credito') || 
                                        dLower.includes('reembolso');
        if (rawAmount < 0 || looksLikeRefundOrPayment) {
          trnType = 'income';
        } else {
          trnType = 'expense';
        }
      } else {
        trnType = rawAmount >= 0 ? 'income' : 'expense';
      }

      // Try to parse installment information first from description, then from installment column if present
      let installmentNumber: number | undefined = undefined;
      let totalInstallments: number | undefined = undefined;

      const representationInfo = extractInstallmentFromDesc(description);
      if (representationInfo.installmentNumber && representationInfo.totalInstallments) {
        installmentNumber = representationInfo.installmentNumber;
        totalInstallments = representationInfo.totalInstallments;
      } else if (installmentIdxSelected !== -1 && row[installmentIdxSelected] !== undefined && row[installmentIdxSelected] !== null) {
        const pVal = String(row[installmentIdxSelected]).trim();
        const pInfo = extractInstallmentFromDesc(pVal);
        if (pInfo.installmentNumber && pInfo.totalInstallments) {
          installmentNumber = pInfo.installmentNumber;
          totalInstallments = pInfo.totalInstallments;
        } else if (pVal.toLowerCase() === 'única' || pVal.toLowerCase() === 'unica') {
          installmentNumber = 1;
          totalInstallments = 1;
        } else {
          // If the column contains just a direct single integer, e.g. "4"
          const digitMatch = pVal.match(/^(\d+)$/);
          if (digitMatch) {
            const digit = parseInt(digitMatch[1], 10);
            if (digit > 1) {
              installmentNumber = digit;
              totalInstallments = digit; // default
            }
          }
        }
      }

      const id = `${Date.now()}_ref_${index}`;
      const guessedId = guessCategory(description, trnType, categories);

      txs.push({
        id,
        date: isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString(),
        description,
        amount: Math.abs(rawAmount),
        type: trnType,
        categoryId: guessedId,
        installmentNumber,
        totalInstallments
      });
    });

    return txs;
  };

  // Trigger automatic reprocessing of CSV/Excel when configuration toggles change!
  React.useEffect(() => {
    if (rawFileGrid.length > 0 && fileInfo && !fileInfo.name.toLowerCase().endsWith('.ofx')) {
      const headerIndex = headerRowIdxSelected >= 0 ? headerRowIdxSelected : 0;
      const rawHeadersAtIdx = rawFileGrid[headerIndex] || [];
      const headers = rawHeadersAtIdx.map((h, idx) => {
        const s = String(h || '').trim();
        return s ? s : `col_${idx}`;
      });

      const dataRows = rawFileGrid.slice(headerIndex + 1).filter(row => {
        return row && row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== '');
      });

      if (mappedDateIdx !== -1 && mappedDescIdx !== -1 && mappedAmountIdx !== -1) {
        const txs = processGridToTxs(headers, dataRows, mappedDateIdx, mappedDescIdx, mappedAmountIdx, invertSigns);
        setImportedTxs(txs);
      }
    }
  }, [selectedDestination, invertSigns, headerRowIdxSelected, mappedDateIdx, mappedDescIdx, mappedAmountIdx]);

  const handleReprocessGrid = () => {
    if (rawFileGrid.length === 0) return;

    const headerIndex = headerRowIdxSelected >= 0 ? headerRowIdxSelected : 0;
    const rawHeadersAtIdx = rawFileGrid[headerIndex] || [];
    const headers = rawHeadersAtIdx.map((h, idx) => {
      const s = String(h || '').trim();
      return s ? s : `col_${idx}`;
    });

    const dataRows = rawFileGrid.slice(headerIndex + 1).filter(row => {
      return row && row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== '');
    });

    const txs = processGridToTxs(headers, dataRows, mappedDateIdx, mappedDescIdx, mappedAmountIdx, invertSigns);
    setImportedTxs(txs);
    setSelectedTxIds([]);

    if (txs.length === 0) {
      setStatus({
        type: 'err',
        msg: 'Nenhum lançamento válido pôde ser extraído com a configuração atual. Verifique se as colunas selecionadas contêm datas e valores válidos.'
      });
    } else {
      setStatus({
        type: 'success',
        msg: `Re-processado com sucesso: ${txs.length} transações carregadas com correspondências de categoria!`
      });
      setIsAdjustingMapping(false);
    }
  };

  const parseCSV = (text: string) => {
    try {
      const firstLine = text.split('\n')[0] || '';
      const numSemicolons = (firstLine.match(/;/g) || []).length;
      const numCommas = (firstLine.match(/,/g) || []).length;
      const delimiter = numSemicolons > numCommas ? ';' : ',';

      Papa.parse(text, {
        header: false,
        skipEmptyLines: true,
        delimiter: delimiter,
        complete: (results) => {
          const rawRows = results.data as any[][];
          if (!rawRows || rawRows.length === 0) {
            setStatus({ type: 'err', msg: 'O arquivo CSV está vazio.' });
            return;
          }

          setRawFileGrid(rawRows);

          const { headers, dataRows } = findHeaderRowAndData(rawRows);
          if (headers.length === 0) {
            setStatus({ type: 'err', msg: 'Não foi possível detectar cabeçalhos de tabela válidos no CSV.' });
            return;
          }

          setRawHeaders(headers);

          const { dateIdx, descIdx, amountIdx } = mapColumns(headers);
          setMappedDateIdx(dateIdx);
          setMappedDescIdx(descIdx);
          setMappedAmountIdx(amountIdx);

          const txs = processGridToTxs(headers, dataRows, dateIdx, descIdx, amountIdx, false);
          setImportedTxs(txs);

          if (txs.length === 0) {
            setIsAdjustingMapping(true);
            setStatus({ 
              type: 'err', 
              msg: 'Nenhum lançamento válido pôde ser extraído do CSV automaticamente. Use o Assistente de Mapeamento ao lado para selecionar as colunas.' 
            });
          } else {
            setIsAdjustingMapping(false);
            setStatus({ 
              type: 'success', 
              msg: `Identificamos os cabeçalhos do CSV ("${headers[dateIdx]}", "${headers[descIdx]}", "${headers[amountIdx]}"). ${txs.length} transações carregadas!` 
            });
          }
        }
      });
    } catch (err) {
      console.error(err);
      setStatus({ type: 'err', msg: 'Erro ao interpretar o extrato CSV.' });
    }
  };

  const parseExcel = (data: ArrayBuffer) => {
    try {
      const workbook = xlsx.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows = xlsx.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      if (!rawRows || rawRows.length === 0) {
        setStatus({ type: 'err', msg: 'A planilha Excel está vazia.' });
        return;
      }

      setRawFileGrid(rawRows);

      const { headers, dataRows } = findHeaderRowAndData(rawRows);
      if (headers.length === 0) {
        setStatus({ type: 'err', msg: 'Não foi possível encontrar uma linha de cabeçalhos na planilha automaticamente.' });
        return;
      }

      setRawHeaders(headers);

      const { dateIdx, descIdx, amountIdx } = mapColumns(headers);
      setMappedDateIdx(dateIdx);
      setMappedDescIdx(descIdx);
      setMappedAmountIdx(amountIdx);

      const txs = processGridToTxs(headers, dataRows, dateIdx, descIdx, amountIdx, false);
      setImportedTxs(txs);

      if (txs.length === 0) {
        setIsAdjustingMapping(true);
        setStatus({ 
          type: 'err', 
          msg: 'Não conseguimos extrair transações da planilha utilizando detecção padrão. Ajuste as colunas manualmente.' 
        });
      } else {
        setIsAdjustingMapping(false);
        setStatus({ 
          type: 'success', 
          msg: `Linha de cabeçalho detectada! Identificamos as colunas ("${headers[dateIdx]}", "${headers[descIdx]}", "${headers[amountIdx]}"). ${txs.length} transações prontas!` 
        });
      }
    } catch (err) {
      console.error(err);
      setStatus({ type: 'err', msg: 'Erro fatal ao interpretar a planilha Excel.' });
    }
  };

  const handleImportSelected = async () => {
    // Generate adjusted records prior to validation to resolve closed-period restrictions for historical files
    const mappedImportedTxs = importedTxs.map(item => {
      if (!selectedDestination.startsWith('card_') || !overrideInvoicePeriod || !overrideInvoiceMonth) {
        return item;
      }
      
      // Override year and month of the item's date to match the targeted billing cycle
      const originalDate = new Date(item.date);
      const [yStr, mStr] = overrideInvoiceMonth.split('-');
      const targetYear = parseInt(yStr, 10);
      const targetMonth = parseInt(mStr, 10) - 1;
      const targetDay = Math.min(originalDate.getDate(), new Date(targetYear, targetMonth + 1, 0).getDate());
      const adjustedDate = new Date(targetYear, targetMonth, targetDay, 12, 0, 0);

      return {
        ...item,
        date: adjustedDate.toISOString()
      };
    });

    // Only import those that actually have a category assigned and are not yet imported
    const recordsToImport = mappedImportedTxs.filter(item => !item.imported && item.categoryId);
    if (recordsToImport.length === 0) {
      alert('Selecione / Defina uma categoria para os lançamentos que deseja importar.');
      return;
    }

    try {
      if (!currentUser) return;

      const lockedRecords = recordsToImport.filter(item => {
        const period = item.date.substring(0, 7);
        return (closedPeriods || []).some(cp => cp.period === period);
      });

      if (lockedRecords.length > 0) {
        alert(`Atenção: ${lockedRecords.length} lançamentos pertencem a períodos contábeis fechados (${lockedRecords.map(r => r.date.substring(0, 7)).join(', ')}). Eles serão ignorados para conformidade contábil.`);
      }

      const recordsToActuallyImport = recordsToImport.filter(item => {
        const period = item.date.substring(0, 7);
        return !(closedPeriods || []).some(cp => cp.period === period);
      });

      if (recordsToActuallyImport.length === 0) {
        alert('Todos os lançamentos prontos pertencem a períodos contábeis bloqueados.');
        return;
      }

      const isCard = selectedDestination.startsWith('card_');
      const destinationId = selectedDestination.split('_')[1];

      const transactionsPayloads: Omit<Transaction, 'id' | 'createdAt'>[] = [];

      recordsToActuallyImport.forEach(item => {
        const payload: Omit<Transaction, 'id' | 'createdAt'> = {
          userId: authUser?.uid || '',
          type: item.type === 'income' ? 'income' : 'expense',
          amount: item.amount,
          date: item.date,
          description: item.description,
          categoryId: item.categoryId,
          status: 'paid',
          observation: 'Importado via Conciliação Bancária rápida'
        };

        if (isCard) {
          payload.creditCardId = destinationId;
          payload.status = 'pending';

          const card = creditCards.find(c => c.id === destinationId);
          const cardClosingDay = card?.closingDay || 5;
          const txDate = new Date(item.date);
          
          payload.invoicePeriod = getInvoicePeriod(txDate, cardClosingDay);

          if (item.installmentNumber && item.totalInstallments && item.totalInstallments > 1) {
            payload.ccRecurrenceType = 'parcelado';
            payload.installmentNumber = item.installmentNumber;
            payload.totalInstallments = item.totalInstallments;
            payload.description = formatDescriptionWithInstallment(item.description, item.installmentNumber, item.totalInstallments);

            // Project subsequent installments into future months
            if (projectFutureInstallments && item.installmentNumber < item.totalInstallments) {
              const currentInst = item.installmentNumber;
              const totalInst = item.totalInstallments;
              for (let i = currentInst + 1; i <= totalInst; i++) {
                const futDate = new Date(item.date);
                futDate.setMonth(futDate.getMonth() + (i - currentInst));
                
                const futInvoicePeriod = getInvoicePeriod(futDate, cardClosingDay);

                transactionsPayloads.push({
                  userId: authUser?.uid || '',
                  type: 'expense',
                  amount: item.amount,
                  date: futDate.toISOString(),
                  description: formatDescriptionWithInstallment(item.description, i, totalInst),
                  categoryId: item.categoryId,
                  status: 'pending',
                  creditCardId: destinationId,
                  invoicePeriod: futInvoicePeriod,
                  ccRecurrenceType: 'parcelado',
                  installmentNumber: i,
                  totalInstallments: totalInst,
                  observation: `Projeção automática de parcela (${i}/${totalInst}) baseada em compra importada`
                });
              }
            }
          }
        } else {
          payload.accountId = destinationId;
        }

        transactionsPayloads.push(payload);
      });

      // Commit to DB
      await createBulkTransactions(transactionsPayloads);

      // Reflect into local state which items are imported
      const updatedTxs = importedTxs.map(item => {
        const adjustedItem = mappedImportedTxs.find(r => r.id === item.id) || item;
        const isLocked = (closedPeriods || []).some(cp => cp.period === adjustedItem.date.substring(0, 7));
        const matched = recordsToActuallyImport.some(r => r.id === item.id);
        if (matched) {
          return { ...item, imported: !isLocked };
        }
        return item;
      });
      setImportedTxs(updatedTxs);
      setSelectedTxIds([]);
      
      setStatus({
        type: 'success',
        msg: `${recordsToActuallyImport.length} lançamentos salvos com sucesso no destino: ${isCard ? 'Fatura do Cartão' : 'Conta Bancária'}!`
      });
      onRefresh();
    } catch (err) {
      console.error(err);
      setStatus({ type: 'err', msg: 'Erro imprevisto durante o salvamento.' });
    }
  };

  const updateIndividualCategory = (id: string, catId: string) => {
    setImportedTxs(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, categoryId: catId };
      }
      return item;
    }));
  };

  const discardSingleTx = (id: string) => {
    setImportedTxs(prev => prev.filter(item => item.id !== id));
    setSelectedTxIds(prev => prev.filter(x => x !== id));
  };

  // Bulk Actions
  const toggleSelectTx = (id: string) => {
    setSelectedTxIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const getFilteredTxs = () => {
    return importedTxs.filter(item => {
      const matchSearch = item.description.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchSearch) return false;
      
      if (filterType === 'uncategorized') {
        return !item.categoryId && !item.imported;
      }
      if (filterType === 'income') return item.type === 'income';
      if (filterType === 'expense') return item.type === 'expense';
      return true;
    });
  };

  const visibleTxs = getFilteredTxs();
  const selectableVisibleTxs = visibleTxs.filter(item => !item.imported);

  const isAllVisibleSelected = selectableVisibleTxs.length > 0 && 
    selectableVisibleTxs.every(item => selectedTxIds.includes(item.id));

  const handleSelectAllVisible = () => {
    if (isAllVisibleSelected) {
      // Unselect all currently visible selectable items
      const visibleIds = selectableVisibleTxs.map(t => t.id);
      setSelectedTxIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      // Select all currently visible selectable items
      const visibleIds = selectableVisibleTxs.map(t => t.id);
      setSelectedTxIds(prev => {
        const uniqueSet = new Set([...prev, ...visibleIds]);
        return Array.from(uniqueSet);
      });
    }
  };

  const handleApplyBulkCategory = () => {
    if (!bulkCategoryId) return;
    setImportedTxs(prev => prev.map(item => {
      if (selectedTxIds.includes(item.id) && !item.imported) {
        return { ...item, categoryId: bulkCategoryId };
      }
      return item;
    }));
    // Clean states after applying
    setSelectedTxIds([]);
    setBulkCategoryId('');
    setStatus({
      type: 'success',
      msg: `Categoria em lote atualizada com sucesso para os lançamentos marcados!`
    });
  };

  const handleDiscardSelected = () => {
    if (window.confirm(`Deseja realmente ignorar os ${selectedTxIds.length} lançamentos selecionados desta lista?`)) {
      setImportedTxs(prev => prev.filter(item => !selectedTxIds.includes(item.id)));
      setSelectedTxIds([]);
    }
  };

  // Helper counters
  const totalCount = importedTxs.length;
  const uncategorizedCount = importedTxs.filter(t => !t.categoryId && !t.imported).length;
  const readyToImportCount = importedTxs.filter(t => t.categoryId && !t.imported).length;

  return (
    <div className="bg-card border border-border p-6 rounded-2xl shadow-md transition-all duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 border-b border-border pb-4">
        <div>
          <h2 className="text-lg font-bold text-foreground mb-1 flex items-center gap-2">
            <Landmark size={22} className="text-primary" /> Conciliação e Ajustes Rápidos
          </h2>
          <p className="text-xs text-muted-foreground">
            Envie faturas de cartão de crédito ou extratos de conta e categorize em lote de forma otimizada.
          </p>
        </div>
        
        {totalCount > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex flex-col text-right">
              <span className="text-xs font-bold text-foreground flex items-center gap-1 justify-end">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                {readyToImportCount} prontos para salvar
              </span>
              <span className="text-[10px] text-muted-foreground">
                {uncategorizedCount} ainda pendentes de categoria
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Selector & Import dropzone (lg:col-span-4) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-muted/30 p-4 rounded-xl border border-border/80">
            <label className="block text-xs font-bold text-foreground mb-2">
              Passo 1: Destino dos Lançamentos
            </label>
            <select
              value={selectedDestination}
              onChange={(e) => setSelectedDestination(e.target.value)}
              className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-xl text-sm focus:ring-1 focus:ring-primary focus:outline-none"
            >
              <option value="">Selecione uma conta ou cartão...</option>
              {accounts.length > 0 && (
                <optgroup label="Contas Bancárias (Lançamentos Prontos)">
                  {accounts.map(acc => (
                    <option key={acc.id} value={`acc_${acc.id}`}>
                      🏦 {acc.name} (R$ {acc.balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })})
                    </option>
                  ))}
                </optgroup>
              )}
              {creditCards && creditCards.length > 0 && (
                <optgroup label="Cartões de Crédito (Gera despesa na fatura)">
                  {creditCards.map(card => (
                    <option key={card.id} value={`card_${card.id}`}>
                      💳 {card.name} (Limite: R$ {card.limit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <p className="text-[10px] text-muted-foreground mt-2">
              Se selecionar um Cartão de Crédito, as faturas futuras serão automaticamente calculadas conforme o dia de fechamento!
            </p>
          </div>

          {selectedDestination.startsWith('card_') && (
            <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 space-y-3">
              <label className="block text-xs font-bold text-primary flex items-center gap-1.5">
                ⚙️ Configurações da Fatura
              </label>
              
              <div className="space-y-2">
                <label className="flex items-start gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={projectFutureInstallments}
                    onChange={(e) => setProjectFutureInstallments(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-foreground">
                      Projetar parcelas futuras
                    </span>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Detecta compras parceladas (ex: 7/10) e agendas parcelas futuras nos próximos meses de fatura automaticamente!
                    </p>
                  </div>
                </label>
              </div>

              <div className="pt-2.5 border-t border-primary/10 space-y-2">
                <label className="flex items-start gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={overrideInvoicePeriod}
                    onChange={(e) => setOverrideInvoicePeriod(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-foreground">
                      Forçar período específico
                    </span>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Ajusta as datas de todos os lançamentos originais desta importação para caírem no vencimento de uma fatura escolhida.
                    </p>
                  </div>
                </label>
                
                {overrideInvoicePeriod && (
                  <div className="pl-6 pt-1 animate-fadeIn duration-200">
                    <select
                      value={overrideInvoiceMonth}
                      onChange={(e) => setOverrideInvoiceMonth(e.target.value)}
                      className="w-full px-2 py-1.5 border border-border bg-background text-foreground rounded-lg text-xs font-medium focus:ring-1 focus:ring-primary focus:outline-none"
                    >
                      <option value="">Selecione o período...</option>
                      {getPeriodOptions().map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.display} ({opt.value})
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-amber-600 font-medium mt-1 leading-relaxed">
                      ⚠️ Muito útil para faturas de Maio já vencidas e pagas, evitando conflito de períodos contábeis passados.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-muted/30 p-4 rounded-xl border border-border/80 space-y-3">
            <label className="block text-xs font-bold text-foreground">
              Passo 2: Arquivo de Extrato
            </label>
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-2 ${
                dragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground duration-200 bg-background/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".ofx,.csv,.xls,.xlsx"
                onChange={handleFileChange}
                className="hidden"
              />
              <Upload size={28} className="text-muted-foreground/80" />
              <p className="text-xs text-foreground font-semibold">Escolher extrato bancário</p>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Arraste ou clique. Suporta arquivos <span className="font-mono text-primary font-bold">OFX</span>, planilhas <span className="font-mono text-primary font-bold">Excel</span> (.xlsx) ou listas <span className="font-mono text-primary font-bold">CSV</span>.
              </p>
            </div>
          </div>

          {fileInfo && (
            <div className="flex items-center justify-between p-3 bg-muted rounded-xl text-xs border border-border/60">
              <div className="flex items-center gap-2 min-w-0">
                {fileInfo.name.endsWith('.csv') ? (
                  <FileSpreadsheet size={16} className="text-emerald-500 shrink-0" />
                ) : (
                  <FileCode size={16} className="text-primary shrink-0" />
                )}
                <span className="font-medium text-foreground truncate">{fileInfo.name}</span>
                <span className="text-muted-foreground shrink-0">({fileInfo.size})</span>
              </div>
              <button 
                onClick={() => { 
                  setFileInfo(null); 
                  setImportedTxs([]); 
                  setStatus(null); 
                  setSelectedTxIds([]); 
                  setRawFileGrid([]); 
                  setRawHeaders([]); 
                  setIsAdjustingMapping(false);
                }} 
                className="text-[10px] font-bold text-red-500 hover:text-red-600 transition"
              >
                Limpar
              </button>
            </div>
          )}

          {rawFileGrid.length > 0 && !fileInfo?.name.toLowerCase().endsWith('.ofx') && (
            <div className="bg-muted/40 p-4 rounded-xl border border-border space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-foreground flex items-center gap-1.5">
                  <SlidersHorizontal size={13} className="text-primary" /> Mapeamento de Colunas
                </label>
                <button
                  type="button"
                  onClick={() => setIsAdjustingMapping(!isAdjustingMapping)}
                  className="text-[10px] font-bold text-primary hover:underline"
                >
                  {isAdjustingMapping ? "Recolher" : "Ajustar Mapeamento"}
                </button>
              </div>

              {(isAdjustingMapping || importedTxs.length === 0) && (
                <div className="space-y-3 pt-1 animate-fadeIn duration-200">
                  <div className="space-y-2">
                    {/* Date select */}
                    <div>
                      <span className="text-[10px] text-muted-foreground block mb-0.5 font-medium">Coluna de Data:</span>
                      <select
                        value={mappedDateIdx}
                        onChange={(e) => setMappedDateIdx(Number(e.target.value))}
                        className="w-full px-2 py-1.5 border border-border bg-card text-foreground rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                      >
                        <option value="-1">Selecione...</option>
                        {rawHeaders.map((h, idx) => (
                          <option key={idx} value={idx}>{h} (Col {idx + 1})</option>
                        ))}
                      </select>
                    </div>

                    {/* Description select */}
                    <div>
                      <span className="text-[10px] text-muted-foreground block mb-0.5 font-medium">Coluna de Descrição:</span>
                      <select
                        value={mappedDescIdx}
                        onChange={(e) => setMappedDescIdx(Number(e.target.value))}
                        className="w-full px-2 py-1.5 border border-border bg-card text-foreground rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                      >
                        <option value="-1">Selecione...</option>
                        {rawHeaders.map((h, idx) => (
                          <option key={idx} value={idx}>{h} (Col {idx + 1})</option>
                        ))}
                      </select>
                    </div>

                    {/* Amount select */}
                    <div>
                      <span className="text-[10px] text-muted-foreground block mb-0.5 font-medium">Coluna de Valor:</span>
                      <select
                        value={mappedAmountIdx}
                        onChange={(e) => setMappedAmountIdx(Number(e.target.value))}
                        className="w-full px-2 py-1.5 border border-border bg-card text-foreground rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                      >
                        <option value="-1">Selecione...</option>
                        {rawHeaders.map((h, idx) => (
                          <option key={idx} value={idx}>{h} (Col {idx + 1})</option>
                        ))}
                      </select>
                    </div>

                    {/* Header Row Index Select */}
                    <div>
                      <span className="text-[10px] text-muted-foreground block mb-0.5 font-medium">Linha do Cabeçalho:</span>
                      <select
                        value={headerRowIdxSelected}
                        onChange={(e) => {
                          const idx = Number(e.target.value);
                          setHeaderRowIdxSelected(idx);
                          const row = rawFileGrid[idx] || [];
                          setRawHeaders(row.map((val, i) => String(val || '').trim() || `col_${i}`));
                        }}
                        className="w-full px-2 py-1.5 border border-border bg-card text-foreground rounded-lg text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                      >
                        {rawFileGrid.slice(0, 10).map((row, idx) => (
                          <option key={idx} value={idx}>
                            Linha {idx + 1}: {row.slice(0, 3).map(c => String(c || '').substring(0, 12)).join(' | ')}...
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Quick Profile presets */}
                  <div className="pt-2 border-t border-border space-y-1.5">
                    <span className="text-[10px] font-bold text-foreground">
                      💡 Perfis Prontos para Ajuste:
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const dataIdx = rawHeaders.findIndex(h => h.toLowerCase().includes('data') || h.toLowerCase().includes('date') || h.toLowerCase().includes('dt_'));
                          const descIdx = rawHeaders.findIndex(h => h.toLowerCase().includes('lanç') || h.toLowerCase().includes('lanc') || h.toLowerCase().includes('estab') || h.toLowerCase().includes('desc') || h.toLowerCase().includes('hist'));
                          const amtIdx = rawHeaders.findIndex(h => h.toLowerCase().includes('val') || h.toLowerCase().includes('amt') || h.toLowerCase().includes('real'));
                          if (dataIdx !== -1) setMappedDateIdx(dataIdx);
                          if (descIdx !== -1) setMappedDescIdx(descIdx);
                          if (amtIdx !== -1) setMappedAmountIdx(amtIdx);
                          setInvertSigns(false);
                        }}
                        className="p-1 px-1.5 text-[10px] border border-border bg-card text-muted-foreground hover:text-foreground rounded-lg hover:border-primary/50 text-center transition font-semibold"
                      >
                        Auto-detectar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          // Itaú credit card parser profile defaults
                          setMappedDateIdx(0);
                          setMappedDescIdx(1);
                          setMappedAmountIdx(2);
                          setInvertSigns(true);
                        }}
                        className="p-1 px-1.5 text-[10px] border border-border bg-card text-muted-foreground hover:text-foreground rounded-lg hover:border-primary/50 text-center transition font-semibold"
                      >
                        Fatura Itaú
                      </button>
                    </div>
                  </div>

                  {/* Options */}
                  <div className="pt-1.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={invertSigns}
                        onChange={(e) => setInvertSigns(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                      />
                      <span className="text-[11px] font-medium text-foreground">
                        Inverter sinais (+/-)
                      </span>
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={handleReprocessGrid}
                    className="w-full bg-primary hover:opacity-95 text-primary-foreground font-bold text-xs py-2 rounded-xl transition shadow-xs"
                  >
                    Reprocessar Extrato
                  </button>
                </div>
              )}
            </div>
          )}

          {status && (
            <div className={`p-3.5 rounded-xl text-xs flex items-start gap-2 border ${
              status.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' : 'bg-red-500/10 border-red-500/20 text-red-600'
            }`}>
              {status.type === 'success' ? (
                <Check size={16} className="shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{status.msg}</span>
            </div>
          )}
        </div>

        {/* Right Column: Intelligent reconciliation list with filter & bulk panel (lg:col-span-8) */}
        <div className="lg:col-span-8 space-y-4">
          {totalCount === 0 ? (
            <div className="border border-dashed border-border p-12 text-center text-xs text-muted-foreground rounded-2xl flex flex-col items-center justify-center space-y-3 bg-muted/10">
              <div className="p-3 bg-background rounded-full shadow-xs">
                <Landmark size={32} className="text-muted-foreground/40" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-foreground">Aguardando arquivo de extrato</p>
                <p className="text-muted-foreground max-w-xs mx-auto">
                  Importe seu extrato bancário no painel ao lado para abrir os recursos de edição rápida e cruzamento.
                </p>
              </div>
            </div>
          ) : (
            <div className="border border-border rounded-2xl overflow-hidden bg-background shadow-xs flex flex-col">
              {/* Filter controls and search */}
              <div className="p-4 bg-muted/40 border-b border-border space-y-3">
                <div className="flex flex-col sm:flex-row gap-2 justify-between">
                  {/* Search input with clean icon */}
                  <div className="relative flex-1">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                      <Search size={14} />
                    </span>
                    <input
                      type="text"
                      placeholder="Pesquisar descrição do extrato..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 border border-border bg-card text-foreground rounded-xl text-xs focus:ring-1 focus:ring-primary focus:outline-none placeholder:text-muted-foreground/60"
                    />
                  </div>

                  {/* Filter tabs */}
                  <div className="flex flex-wrap items-center gap-1 shrink-0 pb-1 sm:pb-0">
                    <button
                      onClick={() => setFilterType('all')}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                        filterType === 'all' 
                          ? 'bg-primary text-primary-foreground font-bold' 
                          : 'bg-card text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                    >
                      Todos ({totalCount})
                    </button>
                    <button
                      onClick={() => setFilterType('uncategorized')}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                        filterType === 'uncategorized' 
                          ? 'bg-amber-500 text-white font-bold' 
                          : 'bg-card text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                    >
                      <ListFilter size={11} />
                      Sem Categoria ({uncategorizedCount})
                    </button>
                    <button
                      onClick={() => setFilterType('expense')}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                        filterType === 'expense' 
                          ? 'bg-primary text-primary-foreground font-bold' 
                          : 'bg-card text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                    >
                      Despesas
                    </button>
                    <button
                      onClick={() => setFilterType('income')}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                        filterType === 'income' 
                          ? 'bg-primary text-primary-foreground font-bold' 
                          : 'bg-card text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                    >
                      Receitas
                    </button>
                  </div>
                </div>

                {/* Bulk Actions Panel */}
                {selectedTxIds.length > 0 && (
                  <div className="indigo-panel bg-primary/5 border border-primary/20 p-3 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fadeIn duration-200">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/25 text-primary text-[10px] font-bold flex items-center justify-center">
                        {selectedTxIds.length}
                      </span>
                      <span className="text-xs font-medium text-foreground">
                        lançamentos selecionados. Alterar em massa:
                      </span>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-auto">
                      <select
                        value={bulkCategoryId}
                        onChange={(e) => setBulkCategoryId(e.target.value)}
                        className="p-1 px-2 text-[11px] border border-primary/20 bg-background text-foreground rounded-lg focus:outline-none"
                      >
                        <option value="">Selecione a categoria para aplicar...</option>
                        <optgroup label="Despesas">
                          {categories.filter(c => c.type === 'expense').map(cat => (
                            <option key={cat.id} value={cat.id}>🔺 {cat.name}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Receitas">
                          {categories.filter(c => c.type === 'income').map(cat => (
                            <option key={cat.id} value={cat.id}>🔹 {cat.name}</option>
                          ))}
                        </optgroup>
                      </select>
                      
                      <button
                        onClick={handleApplyBulkCategory}
                        disabled={!bulkCategoryId}
                        className="bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground font-bold text-[10px] px-3 py-1.5 rounded-lg uppercase tracking-wider transition"
                      >
                        Aplicar
                      </button>

                      <button
                        onClick={handleDiscardSelected}
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold p-1.5 rounded-lg transition"
                        title="Descartar selecionados da lista"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Transactions list panel */}
              <div className="overflow-y-auto max-h-[460px] divide-y divide-border">
                {visibleTxs.length === 0 ? (
                  <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center justify-center space-y-1">
                    <Landmark size={24} className="text-muted-foreground/40 mb-1" />
                    <span>Nenhum lançamento corresponde ao filtro atual.</span>
                    <button 
                      onClick={() => { setSearchTerm(''); setFilterType('all'); }} 
                      className="text-primary hover:underline font-bold mt-1"
                    >
                      Limpar Filtros
                    </button>
                  </div>
                ) : (
                  visibleTxs.map((item) => (
                    <div 
                      key={item.id} 
                      className={`p-3.5 flex items-center gap-3 justify-between text-xs transition-colors duration-200 ${
                        item.imported 
                          ? 'bg-muted/30 opacity-60' 
                          : selectedTxIds.includes(item.id)
                            ? 'bg-primary/5' 
                            : 'hover:bg-muted/20'
                      }`}
                    >
                      {/* Checkbox column */}
                      {!item.imported && (
                        <div className="flex items-center shrink-0">
                          <input
                            type="checkbox"
                            checked={selectedTxIds.includes(item.id)}
                            onChange={() => toggleSelectTx(item.id)}
                            className="rounded-md border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                          />
                        </div>
                      )}

                      {/* Info block */}
                      <div className="space-y-1 max-w-[45%] min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="font-semibold text-foreground truncate block" title={item.description}>
                            {item.description}
                          </p>
                        </div>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium">
                            {new Date(item.date).toLocaleDateString('pt-BR')}
                          </span>
                          {item.installmentNumber && item.totalInstallments && item.totalInstallments > 1 && (
                            <>
                              <span>&bull;</span>
                              <span className="bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider">
                                Parcela {item.installmentNumber}/{item.totalInstallments}
                              </span>
                            </>
                          )}
                          <span>&bull;</span>
                          <span className={`font-semibold ${item.type === 'income' ? 'text-emerald-500' : 'text-amber-500'}`}>
                            {item.type === 'income' ? 'Receita' : 'Despesa'}
                          </span>
                        </p>
                      </div>

                      {/* Actions and inputs block */}
                      <div className="flex items-center gap-3 shrink-0">
                        {/* Styled Amount badge */}
                        <span className={`font-mono font-bold text-[13px] ${item.type === 'income' ? 'text-emerald-500' : 'text-foreground'}`}>
                          {item.type === 'income' ? '+' : '-'} R$ {item.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        
                        {item.imported ? (
                          <span className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-bold px-2 py-1 rounded-lg shrink-0">
                            ✓ Conciliado
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            {/* Visual Category Match */}
                            <select
                              value={item.categoryId || ''}
                              onChange={(e) => updateIndividualCategory(item.id, e.target.value)}
                              className={`p-1 px-1.5 text-[11px] border rounded-lg bg-card text-foreground focus:outline-none max-w-[140px] ${
                                item.categoryId 
                                  ? 'border-emerald-500/40 focus:ring-1 focus:ring-emerald-500 text-foreground font-medium' 
                                  : 'border-border focus:ring-1 focus:ring-amber-500 text-muted-foreground'
                              }`}
                            >
                              <option value="">Atribuir cat...</option>
                              {categories
                                .filter(c => c.type === item.type)
                                .map(cat => (
                                  <option key={cat.id} value={cat.id}>
                                    {cat.name}
                                  </option>
                                ))
                              }
                            </select>

                            {/* Discard single entry line button */}
                            <button
                              onClick={() => discardSingleTx(item.id)}
                              className="text-muted-foreground hover:text-red-500 p-1.5 rounded-lg hover:bg-red-500/5 transition shrink-0"
                              title="Descartar da importação"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Table footer with controls */}
              <div className="p-3 bg-muted/40 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                {/* Checkbox status indicator / trigger */}
                {selectableVisibleTxs.length > 0 ? (
                  <button 
                    onClick={handleSelectAllVisible}
                    className="text-primary hover:underline font-bold text-[11px] flex items-center gap-1"
                  >
                    <SlidersHorizontal size={11} />
                    {isAllVisibleSelected ? "Desmarcar Todos do Filtro" : "Selecionar Todos do Filtro"}
                  </button>
                ) : (
                  <span className="text-muted-foreground text-[10px]">
                    Nenhum lançamento para selecionar nesta visualização
                  </span>
                )}

                {/* Confirm import of items */}
                {readyToImportCount > 0 && (
                  <button
                    onClick={handleImportSelected}
                    className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:opacity-90 shadow-sm transition flex items-center justify-center gap-1.5"
                  >
                    <Check size={14} />
                    Confirmar e Importar ({readyToImportCount} Prontos)
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
