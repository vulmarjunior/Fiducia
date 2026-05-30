# Fiducia — Orientações para Agentes

> Documento de referência rápida sobre o projeto. Complementa o `dev-log.md` (descobertas técnicas) e o `docs/LOGICA_DO_SISTEMA.md` (arquitetura detalhada).
> **Importante**: Pastas `fontes/fiducia1/` e `fontes/fidúcia2/` são versões antigas descartadas. Ignorar para desenvolvimento.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Runtime | Node.js, Vite 6 |
| Linguagem | TypeScript 5.8 |
| UI | React 19, Tailwind CSS 4, Shadcn/UI (Base UI) |
| Backend | Firebase (Firestore + Auth) |
| IA | Gemini API (insights), Groq (relatórios, extração de fatura PDF) |
| Build | `npm run dev` (dev), `npm run build` (prod) |
| Testes | Vitest |
| Lint | `tsc --noEmit` |

## Estrutura `src/` (ativa)

```
src/
├── App.tsx              # Rotas (React Router v7)
├── main.tsx             # Entry point + PWA + next-themes
├── firebase.ts          # Init Firebase + handleFirestoreError
├── index.css            # Tailwind + tema (light/dark) + Fiducia custom colors
├── contexts/
│   └── AuthContext.tsx   # Google Auth + user profile sync
├── components/
│   ├── ui/              # Shadcn/UI primitives (button, dialog, input, etc.)
│   ├── Layout.tsx       # Sidebar + nav + Outlet
│   ├── Logo.tsx
│   ├── MoneyInput.tsx
│   └── ConfirmDialog.tsx
├── pages/
│   ├── Login.tsx
│   ├── Dashboard.tsx
│   ├── Accounts.tsx
│   ├── CreditCards.tsx
│   ├── Transactions.tsx
│   ├── Reconciliation.tsx
│   ├── Audit.tsx
│   ├── Reports.tsx
│   ├── Budgets.tsx
│   ├── Goals.tsx
│   ├── Categories.tsx
│   ├── Tags.tsx
│   ├── ActivityLog.tsx
│   └── Settings.tsx
├── services/
│   ├── importService.ts  # CSV/Excel parsing (xlsx)
│   ├── ofxService.ts
│   ├── pdfInvoiceService.ts # Extração de PDF e Groq parsing
│   ├── groqService.ts
├── lib/
│   ├── utils.ts          # cn(), calculateInvoicePeriod(), etc.
│   ├── ofxParser.ts
│   ├── defaultCategories.ts
│   └── categoryIcons.tsx
├── types/
│   └── index.ts          # All interfaces (Account, Transaction, etc.)
└── utils/
    ├── cleanUndefined.ts
    ├── creditCardUtils.ts
    └── creditCardUtils.test.ts
```

## Rotas

| Path | Página | Descrição |
|------|--------|-----------|
| `/login` | Login | Autenticação Google |
| `/` | Dashboard | Visão geral, saldos, gráficos, insights |
| `/transactions` | Transactions | CRUD de lançamentos |
| `/reconciliation` | Reconciliation | Conciliação bancária (OFX/CSV) |
| `/audit` | Audit | Auditoria contábil |
| `/accounts` | Accounts | Contas bancárias |
| `/cards` | CreditCards | Cartões de crédito |
| `/budgets` | Budgets | Orçamentos por categoria |
| `/reports` | Reports | Relatórios com gráficos + IA |
| `/goals` | Goals | Metas financeiras |
| `/categories` | Categories | Categorias |
| `/tags` | Tags | Rótulos |
| `/activity` | ActivityLog | Histórico de operações |
| `/settings` | Settings | Configurações |

## Firestore — Coleções

Cada coleção tem `userId` para isolamento por usuário.

| Coleção | Chave | Descrição |
|---------|-------|-----------|
| `users` | `users/{uid}` | Perfil do usuário |
| `accounts` | `accounts/{id}` | Contas (corrente, poupança, carteira, investimento) |
| `creditCards` | `creditCards/{id}` | Cartões (limit, closingDay, dueDay) |
| `transactions` | `transactions/{id}` | Lançamentos (receita, despesa, transferência) |
| `invoices` | `invoices/{id}` | Faturas de cartão (aberta/fechada/paga) |
| `categories` | `categories/{id}` | Categorias (income/expense) |
| `tags` | `tags/{id}` | Rótulos livres (name + color) |
| `budgets` | `budgets/{id}` | Orçamentos mensais por categoria |
| `goals` | `goals/{id}` | Metas financeiras |
| `closedPeriods` | `closedPeriods/{id}` | Períodos contábeis fechados |
| `recurrenceRules` | `recurrenceRules/{id}` | Regras de recorrência |
| `installments` | `installments/{id}` | Contratos de parcelamento |
| `activityLogs` | `activityLogs/{id}` | Log de operações |
| `reconciliationHistory` | `reconciliationHistory/{id}` | Histórico de conciliações |

## Convenções de Código

- **Idioma**: UI em português (labels, toasts, placeholders). Código/names em inglês.
- **Imports**: Sem comentários. Ordem: React/firebase → componentes/ui → lucide-react → sonner → locais.
- **Formatação**: Tailwind classes inline. `cn()` do `tailwind-merge` para classes condicionais.
- **Tipos**: `any` é tolerado (projeto legado), mas prefira tipos de `@/types`.
- **Transações de saldo**: Sempre usar `runTransaction` do Firestore para operações atômicas (CREATE, EDIT, DELETE, IMPORT).
- **Toast + erro**: `toast.error()` ANTES de `handleFirestoreError()` (que dá throw).
- **useMemo/useCallback**: Toda função chamada dentro deles deve ser declarada **antes** (risco de TDZ — ver `dev-log.md`).
- **Navegação com edição**: Dashboard → Transactions via `navigate(path, { state: { editId } })`. Limpar com `window.history.replaceState`.
- **Fontes**: Inter (sans), JetBrains Mono (mono).

## Padrões de UI

- **Diálogos**: `@radix-ui/react-dialog` via `components/ui/dialog.tsx`. Usar `DialogTrigger` com botão.
- **Select**: `@radix-ui/react-select` via `components/ui/select.tsx`. Usar `SelectTrigger` + `SelectContent`.
- **Money**: `MoneyInput` para campos monetários (formatação pt-BR).
- **Tema**: `next-themes` com `ThemeProvider` + classes `dark`.
- **Toasts**: `sonner` via `components/ui/sonner.tsx`.
- **Ícones**: `lucide-react`.
- **Gráficos**: `recharts`.

## Comandos

```bash
npm run dev        # Dev server (porta 3000)
npm run build      # Build produção
npm run lint       # tsc --noEmit
npm run test       # Vitest
```

## Links Importantes

- **Repositório**: https://github.com/vulmarjunior/Fiducia
- **App publicado**: https://fiducianew.vercel.app/
- **IA Insights**: Gemini API (dashboard), Groq API (relatórios analíticos)
- **Dados sensíveis**: `.env.local` contém `GEMINI_API_KEY` e `GROQ_API_KEY`
