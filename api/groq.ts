import type { Request, Response } from 'express';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const FIREBASE_API_KEY = 'AIzaSyAnSqlHqSaU__YtRo64zbsNZjM1iDYYxl4';
const ALLOWED_MODELS = new Set(['llama-3.3-70b-versatile']);
const MAX_BODY_BYTES = 80_000;

async function verifyFirebaseToken(idToken: string): Promise<string | null> {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }),
  });
  if (!response.ok) return null;
  const data = await response.json() as { users?: Array<{ localId?: string }> };
  return data.users?.[0]?.localId || null;
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token || !(await verifyFirebaseToken(token))) return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Serviço de IA não configurado.' });
  const bodyText = JSON.stringify(req.body || {});
  if (Buffer.byteLength(bodyText, 'utf8') > MAX_BODY_BYTES) return res.status(413).json({ error: 'Solicitação de IA muito grande.' });
  const { messages, model = 'llama-3.3-70b-versatile', max_tokens = 500, temperature = 0.7 } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0 || !ALLOWED_MODELS.has(model)) return res.status(400).json({ error: 'Solicitação de IA inválida.' });
  const upstream = await fetch(GROQ_URL, {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, max_tokens: Math.min(Math.max(Number(max_tokens) || 500, 1), 1500), temperature: Math.min(Math.max(Number(temperature) || 0, 0), 1) }),
  });
  const data = await upstream.json().catch(() => ({ error: 'Resposta inválida da Groq.' }));
  if (!upstream.ok) return res.status(upstream.status).json(data);
  return res.status(200).json(data);
}