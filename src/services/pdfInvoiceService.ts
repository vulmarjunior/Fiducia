import * as pdfjsLib from 'pdfjs-dist';
import { callGroq } from './groqService';

// Configure o worker do pdf.js para funcionar com Vite/ESM
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export interface PdfTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'despesa' | 'receita';
  installmentInfo?: string;
}

/**
 * Extrai o texto bruto de um arquivo PDF, página a página.
 * Funciona 100% no browser — sem servidor necessário.
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const textParts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str)
      .join(' ');
    textParts.push(pageText);
  }

  return textParts.join('\n');
}

/**
 * Envia o texto bruto de uma fatura para a Groq e retorna
 * as transações estruturadas em JSON.
 */
export async function parseInvoiceWithGroq(
  rawText: string,
  cardName: string
): Promise<PdfTransaction[]> {
  // Trunca o texto para ~12.000 caracteres para não explodir o contexto da Groq
  const truncated = rawText.length > 12000 ? rawText.substring(0, 12000) + '\n[... texto truncado ...]' : rawText;

  const systemPrompt = `Você é um extrator especializado em faturas de cartão de crédito brasileiras.
Sua tarefa é analisar o texto bruto de uma fatura e retornar APENAS um array JSON válido com as transações encontradas.

Regras obrigatórias:
- Retorne SOMENTE o array JSON, sem markdown, sem explicações, sem blocos de código
- Cada item deve ter: date (YYYY-MM-DD), description (string), amount (número positivo), type ("despesa" ou "receita"), installmentInfo (string "X/Y" se parcelado, ou null)
- Ignore linhas de cabeçalho, rodapé, totais, saldo anterior, encargos genéricos sem valor individual
- Créditos, estornos e pagamentos = "receita". Compras e débitos = "despesa"
- Datas no formato DD/MM/AAAA devem ser convertidas para YYYY-MM-DD
- Se não encontrar nenhuma transação, retorne []
- Valores monetários: ignore "R$", vírgula decimal → ponto decimal (ex: "1.234,56" → 1234.56)

Formato de saída (exemplo):
[{"date":"2026-05-10","description":"UBER TRIP","amount":28.90,"type":"despesa","installmentInfo":null},{"date":"2026-05-12","description":"ESTORNO IFOOD","amount":45.00,"type":"receita","installmentInfo":null},{"date":"2026-05-15","description":"AMAZON PRIME 2/3","amount":99.00,"type":"despesa","installmentInfo":"2/3"}]`;

  const userPrompt = `Fatura do cartão: ${cardName}

Texto extraído do PDF:
${truncated}`;

  const result = await callGroq(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { model: 'llama-3.3-70b-versatile', maxTokens: 4000, temperature: 0.1 }
  );

  // Tenta extrair JSON mesmo que venha com algum lixo na resposta
  const jsonMatch = result.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.warn('Groq não retornou JSON válido. Resposta:', result.substring(0, 300));
    return [];
  }

  const raw: any[] = JSON.parse(jsonMatch[0]);

  return raw
    .filter((item) => item.date && item.description && typeof item.amount === 'number')
    .map((item, index) => ({
      id: `pdf-${Date.now()}-${index}`,
      date: item.date,
      description: String(item.description).trim(),
      amount: Math.abs(item.amount),
      type: item.type === 'receita' ? 'receita' : 'despesa',
      installmentInfo: item.installmentInfo ?? undefined,
    }));
}
