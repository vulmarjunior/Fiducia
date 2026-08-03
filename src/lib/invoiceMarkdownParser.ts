interface ParsedInvoiceRow {
  date: string;
  description: string;
  amount: number;
  isCredit: boolean;
  raw: string;
}

interface MarkdownParseResult {
  table: string;
  rows: ParsedInvoiceRow[];
  coverage: number;
}

const DATE_PATTERNS = [
  /\d{2}\/\d{2}\/\d{4}/g,
  /\d{2}\/\d{2}\/\d{2}/g,
  /\d{2}\/\d{2}/g,
  /\d{4}-\d{2}-\d{2}/g,
];

const AMOUNT_RE = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})/g;
const NEGATIVE_AMOUNT_RE = /(?:R\$\s*)?-\s*(\d{1,3}(?:\.\d{3})*,\d{2})/g;

function parseBrazilianAmount(raw: string): number {
  return Number(
    raw.replace(/R\$/gi, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  );
}

function extractDate(line: string): string | null {
  for (const pattern of DATE_PATTERNS) {
    const match = line.match(pattern);
    if (match) {
      const raw = match[0];
      if (raw.length === 5) {
        const [day, month] = raw.split('/');
        const year = new Date().getFullYear();
        return `${year}-${month}-${day}`;
      }
      if (raw.match(/^\d{2}\/\d{2}\/\d{2}$/)) {
        const [day, month, year] = raw.split('/');
        return `20${year}-${month}-${day}`;
      }
      if (raw.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        const [day, month, year] = raw.split('/');
        return `${year}-${month}-${day}`;
      }
      if (raw.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return raw;
      }
      return null;
    }
  }
  return null;
}

function extractAmount(raw: string): { amount: number; isCredit: boolean } | null {
  const negativeMatch = raw.match(NEGATIVE_AMOUNT_RE);
  if (negativeMatch) return { amount: parseBrazilianAmount(negativeMatch[0]), isCredit: true };

  const matches = [...raw.matchAll(AMOUNT_RE)];
  if (matches.length === 0) return null;

  const last = matches[matches.length - 1][0];
  return { amount: parseBrazilianAmount(last), isCredit: false };
}

function cleanDescription(line: string, dateStr: string, amountStr: string): string {
  let desc = line;

  const dateIdx = desc.indexOf(dateStr);
  if (dateIdx >= 0) {
    desc = desc.slice(dateIdx + dateStr.length);
  }

  const amtIdx = desc.lastIndexOf(amountStr.replace(/R\$\s*/, ''));
  if (amtIdx >= 0) {
    desc = desc.slice(0, amtIdx);
  }

  return desc
    .replace(/[•·]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseInvoiceTextToMarkdown(rawText: string): MarkdownParseResult {
  const lines = rawText.split(/\n/).map(l => l.trim()).filter(Boolean);
  const rows: ParsedInvoiceRow[] = [];

  for (const line of lines) {
    if (line.length < 10) continue;

    const dateStr = extractDate(line);
    if (!dateStr) continue;

    const amountResult = extractAmount(line);
    if (!amountResult) continue;

    const amtRaw = line.match(AMOUNT_RE)?.slice(-1)[0] ?? line.match(NEGATIVE_AMOUNT_RE)?.[0] ?? '';
    const desc = cleanDescription(line, line.match(DATE_PATTERNS[0])?.[0] ?? line.match(DATE_PATTERNS[1])?.[0] ?? line.match(DATE_PATTERNS[2])?.[0] ?? line.match(DATE_PATTERNS[3])?.[0] ?? '', amtRaw);
    if (desc.length < 2) continue;

    rows.push({
      date: dateStr,
      description: desc,
      amount: amountResult.amount,
      isCredit: amountResult.isCredit,
      raw: line,
    });
  }

  const coverage = rawText.trim().length > 0 ? rows.length / Math.max(1, lines.length) : 0;

  if (rows.length === 0) {
    return { table: '', rows: [], coverage: 0 };
  }

  const header = '| Data | Descrição | Valor |\n|------|-----------|-------|';
  const body = rows.map(r => {
    const prefix = r.isCredit ? '-' : '';
    const amountStr = `${prefix}${r.amount.toFixed(2).replace('.', ',')}`;
    return `| ${r.date} | ${r.description} | ${amountStr} |`;
  }).join('\n');

  return {
    table: `${header}\n${body}`,
    rows,
    coverage: Math.round(coverage * 100) / 100,
  };
}
