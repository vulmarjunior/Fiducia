# Sessão — Faturas Quitadas em Contas a Pagar v0.9.3

> **Data:** 2026-08-05
> **LLM:** deepseek-v4-pro | **Agente:** opencode

## Objetivo

Impedir que o Dashboard contabilize como conta a pagar uma fatura já quitada e garantir que pagamentos parciais exibam somente o saldo remanescente.

## Resultado

- `unpaidInvoices` passou a usar `getInvoiceFinancialSummary()` como fonte do valor em aberto.
- Faturas com status `paga` produzem saldo zero e deixam a lista.
- Faturas `parcial` exibem somente `totalAmount - paidAmount`.
- O cálculo por transações permanece como fallback para períodos sem documento em `invoices`.
- Nenhum documento ou regra do Firebase foi alterado.

## Arquivos

- `src/pages/Dashboard.tsx`
- `src/lib/invoicePayment.test.ts`
- `src/lib/utils.ts`
- `package.json`
- `package-lock.json`
- `CHANGELOG.md`
- `docs/MASTER_PLAN.md`

## Validações

- `npm run lint` — aprovado.
- `npx vitest run src/lib/invoicePayment.test.ts --maxWorkers=1` — 15 testes aprovados.
- `npx vitest run --maxWorkers=1` — 76 testes aprovados; 2 testes de emulador ignorados sem host local.
- `npm run build` — aprovado.

## Pendência operacional

- Revisar o total do card em produção após eventual commit, push e deploy.
