<div align="center">
<img width="1200" height="475" alt="Fiducia Banner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Fiducia — Assistente de Finanças Pessoais

Aplicação web para gestão financeira pessoal com contas, cartões de crédito, transações, conciliação bancária, orçamentos, metas e relatórios com IA.

**Stack**: React 19 | TypeScript 5.8 | Tailwind CSS 4 | Shadcn/UI | Firebase (Firestore + Auth) | Vite 6

---

## Links

- **Site**: https://fiducianew.vercel.app/
- **Repositório**: https://github.com/vulmarjunior/Fiducia

## Desenvolvimento

```bash
npm install      # Instalar dependências
npm run dev      # Servidor local (porta 3000)
npm run build    # Build de produção
npm run lint     # TypeScript check (tsc --noEmit)
npm run test     # Vitest
```

## Estrutura de Dados

Banco de dados **Firestore** (NoSQL) com coleções isoladas por `userId`. A configuração do Firebase está em `firebase-applet-config.json` (não requer variáveis de ambiente).

Coleções principais: `accounts`, `creditCards`, `transactions`, `invoices`, `categories`, `tags`, `budgets`, `goals`.

## Ambiente

Copie `.env.example` para `.env.local` e preencha:

- `GROQ_API_KEY` — Groq API (relatórios analíticos)
- `APP_URL` — URL da aplicação (para callbacks OAuth)
