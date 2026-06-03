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
  suggestedCategoryId?: string;
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

export interface CategoryHint {
  id: string;
  name: string;
  type: 'despesa' | 'receita' | 'expense' | 'income';
}

/**
 * Envia o texto bruto de uma fatura para a Groq e retorna
 * as transações estruturadas em JSON, com sugestão de categoria.
 */
export async function parseInvoiceWithGroq(
  rawText: string,
  cardName: string,
  categories: CategoryHint[] = []
): Promise<PdfTransaction[]> {
  // Trunca o texto para ~12.000 caracteres para não explodir o contexto da Groq
  const truncated = rawText.length > 12000
    ? rawText.substring(0, 12000) + '\n[... texto truncado ...]'
    : rawText;

  // Monta lista de categorias de despesa para o prompt (máximo 40 para não poluir)
  const expenseCategories = categories
    .filter(c => c.type === 'despesa' || c.type === 'expense')
    .slice(0, 40)
    .map(c => `{"id":"${c.id}","name":"${c.name}"}`)
    .join(', ');

  const incomeCategories = categories
    .filter(c => c.type === 'receita' || c.type === 'income')
    .slice(0, 20)
    .map(c => `{"id":"${c.id}","name":"${c.name}"}`)
    .join(', ');

  const categorySection = categories.length > 0
    ? `\nCategorias de despesa disponíveis: [${expenseCategories}]\nCategorias de receita disponíveis: [${incomeCategories}]\n\nPara cada transação, escolha o id da categoria mais adequada em "suggestedCategoryId". Se nenhuma se encaixar, use null.`
    : '';

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = String(today.getMonth() + 1).padStart(2, '0');

  const systemPrompt = `Você é um extrator especializado em faturas de cartão de crédito brasileiras.
Sua tarefa é analisar o texto bruto de uma fatura e retornar APENAS um array JSON válido com as transações encontradas.
Data de referência: ${currentYear}-${currentMonth}.

Regras obrigatórias:
- Retorne SOMENTE o array JSON, sem markdown, sem explicações, sem blocos de código
- Cada item deve ter: date (YYYY-MM-DD), description (string), amount (número positivo), type ("despesa" ou "receita"), installmentInfo (string "X/Y" se parcelado, ou null), suggestedCategoryId (string ou null)
- Ignore linhas de cabeçalho, rodapé, totais, saldo anterior, encargos genéricos sem valor individual
- Créditos, estornos e pagamentos = "receita". Compras e débitos = "despesa"
- Datas no formato DD/MM/AAAA devem ser convertidas para YYYY-MM-DD. PRESERVE o ano original — o ano da fatura é ${currentYear}
- Preencha meses e dias com dois dígitos (ex: 2026-01-05, não 2026-1-5)
- Se não encontrar nenhuma transação, retorne []
- Valores monetários: ignore "R$", vírgula decimal → ponto decimal (ex: "1.234,56" → 1234.56)
- **IMPORTANTE para compras parceladas**: o "amount" deve ser o VALOR INDIVIDUAL DA PARCELA exibido na linha da fatura, NÃO o valor total da compra. Ex: se a fatura mostra "COMPRA X (2/6) ... R$ 175,00", amount deve ser 175.00, e installmentInfo = "2/6"
${categorySection}

Formato de saída (exemplo):
[{"date":"${currentYear}-05-10","description":"UBER TRIP","amount":28.90,"type":"despesa","installmentInfo":null,"suggestedCategoryId":"cat-transporte-id"},{"date":"${currentYear}-05-12","description":"COMPRA LOJA (2/6)","amount":175.00,"type":"despesa","installmentInfo":"2/6","suggestedCategoryId":"cat-compras-id"},{"date":"${currentYear}-05-12","description":"ESTORNO IFOOD","amount":45.00,"type":"receita","installmentInfo":null,"suggestedCategoryId":null}]`;

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

  const now = new Date();
  const minYear = now.getFullYear() - 1;
  const maxYear = now.getFullYear() + 1;

  return raw
    .filter((item) => item.date && item.description && typeof item.amount === 'number')
    .map((item, index) => {
      let dateStr = String(item.date).trim();

      // Normaliza formato: garante que meses e dias tenham 2 dígitos
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const y = parts[0];
        const m = parts[1].padStart(2, '0');
        const d = parts[2].padStart(2, '0');
        dateStr = `${y}-${m}-${d}`;

        // Valida ano — se estiver fora do intervalo aceitável, usa o ano corrente
        const year = parseInt(y);
        if (isNaN(year) || year < minYear || year > maxYear) {
          dateStr = `${now.getFullYear()}-${m}-${d}`;
        }
      }

      return {
        id: `pdf-${Date.now()}-${index}`,
        date: dateStr,
        description: String(item.description).trim(),
        amount: Math.abs(item.amount),
        type: item.type === 'receita' ? 'receita' : 'despesa',
        installmentInfo: item.installmentInfo ?? undefined,
        suggestedCategoryId: item.suggestedCategoryId ?? undefined,
      };
    });
}
