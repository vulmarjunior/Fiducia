import type { Request, Response } from 'express';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const FIREBASE_API_KEY = 'AIzaSyAnSqlHqSaU__YtRo64zbsNZjM1iDYYxl4';
const OWNER_EMAIL = process.env.FIDUCIA_OWNER_EMAIL || 'vulmarjunior@gmail.com';
const ALLOWED_MODELS = new Set(['llama-3.3-70b-versatile']);
const MAX_BODY_BYTES = 80_000;
const MAX_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 30_000;
const MAX_OUTPUT_TOKENS = 6_000;
const UPSTREAM_TIMEOUT_MS = 50_000;

interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

function isValidMessages(messages: unknown): messages is GroqMessage[] {
  return Array.isArray(messages) &&
    messages.length > 0 &&
    messages.length <= MAX_MESSAGES &&
    messages.every(message => {
      if (!message || typeof message !== 'object') return false;
      const candidate = message as Partial<GroqMessage>;
      return ['system', 'user', 'assistant'].includes(candidate.role || '') &&
        typeof candidate.content === 'string' &&
        candidate.content.length > 0 &&
        candidate.content.length <= MAX_MESSAGE_CHARS;
    });
}

async function verifyFirebaseToken(idToken: string): Promise<boolean> {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }),
  });
  if (!response.ok) return false;
  const data = await response.json() as { users?: Array<{ localId?: string; email?: string; emailVerified?: boolean }> };
  const user = data.users?.[0];
  return Boolean(user?.localId && user.emailVerified && user.email?.toLowerCase() === OWNER_EMAIL.toLowerCase());
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token || !(await verifyFirebaseToken(token))) return res.status(403).json({ error: 'Acesso não autorizado.' });
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Serviço de IA não configurado.' });
  const bodyText = JSON.stringify(req.body || {});
  if (Buffer.byteLength(bodyText, 'utf8') > MAX_BODY_BYTES) return res.status(413).json({ error: 'Solicitação de IA muito grande.' });
  const { messages, model = 'llama-3.3-70b-versatile', max_tokens = 500, temperature = 0.7 } = req.body || {};
  if (!isValidMessages(messages) || !ALLOWED_MODELS.has(model)) return res.status(400).json({ error: 'Solicitação de IA inválida.' });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const upstream = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: Math.min(Math.max(Number(max_tokens) || 500, 1), MAX_OUTPUT_TOKENS),
        temperature: Math.min(Math.max(Number(temperature) || 0, 0), 1),
      }),
      signal: controller.signal,
    });
    const data = await upstream.json().catch(() => ({ error: 'Resposta inválida da Groq.' }));
    if (!upstream.ok) return res.status(upstream.status).json(data);
    return res.status(200).json(data);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return res.status(504).json({ error: 'A Groq excedeu o tempo limite da operação.' });
    }
    return res.status(502).json({ error: 'Não foi possível conectar ao serviço de IA.' });
  } finally {
    clearTimeout(timeout);
  }
}
