import { auth } from '../firebase';

const GROQ_PROXY_URL = '/api/groq';
export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';

interface GroqMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface GroqOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

function getErrorMessage(payload: unknown): string {
  if (typeof payload === 'string') return payload;
  if (!payload || typeof payload !== 'object') return 'Resposta de erro inválida.';
  const error = (payload as { error?: unknown }).error;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  return 'Erro não detalhado pelo serviço de IA.';
}

export async function callGroq(
  messages: GroqMessage[],
  options: GroqOptions = {}
): Promise<string> {
  const {
    model = DEFAULT_GROQ_MODEL,
    maxTokens = 500,
    temperature = 0.7,
    timeoutMs = maxTokens > 1500 ? 55000 : 45000,
  } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(Math.max(timeoutMs, 10000), 55000));

  let response: Response;
  try {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) throw new Error('Faça login novamente para usar os recursos de IA.');

    response = await fetch(GROQ_PROXY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') throw new Error('O serviço de IA excedeu o tempo limite. Tente novamente.');
    throw err;
  }
  clearTimeout(timeout);

  if (!response.ok) {
    const errorText = await response.text();
    let message = errorText;
    try { message = getErrorMessage(JSON.parse(errorText)); } catch { /* resposta textual */ }
    throw new Error(`Serviço de IA (${response.status}): ${message}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}
