# Sessão — Compatibilidade de Pagamentos no Dashboard v0.9.1

> **Data:** 2026-08-05
> **LLM:** deepseek-v4-pro | **Agente:** opencode

## Objetivo

Corrigir de forma conservadora o card “Despesas do mês”, que ignorava pagamentos de fatura legados registrados como transferência.

## Resultado

- Pagamentos vinculados por `paymentTransactionIds[]` ou `paymentTransactionId` entram no card pela data efetiva do lançamento.
- Compras individuais do cartão continuam excluídas para impedir dupla contagem.
- Faturas legadas com status `paga` e `paidAmount` ausente ou zerado são lidas como totalmente quitadas.
- O saldo de uma fatura paga não é mais transportado para o mês seguinte.
- A correção não usa descrição textual como heurística.
- Nenhum documento, saldo, fatura, limite, relatório ou orçamento foi alterado.

## Arquivos

- `src/lib/invoicePayment.ts`
- `src/lib/invoicePayment.test.ts`
- `src/pages/Dashboard.tsx`
- `src/lib/utils.ts`
- `package.json`
- `package-lock.json`
- `CHANGELOG.md`
- `docs/MASTER_PLAN.md`

## Validações

- `npm run lint` — aprovado.
- `npx vitest run src/lib/invoicePayment.test.ts --maxWorkers=1` — 13 testes aprovados.
- `npx vitest run --maxWorkers=1` — 74 testes aprovados; 2 testes de emulador ignorados sem host local.
- `npm run build` — aprovado.

## Publicação e validação em produção

- Commit `d423282` publicado na `main` e implantado no Vercel com estado `READY`.
- Dashboard de agosto de 2026 validado com despesas de R$ 16.071,31.
- C6 Carbon de setembro de 2026 validado em R$ 3.375,18, sem transportar os R$ 8.452,63 pagos em agosto.
- Versão `0.9.1` confirmada visualmente no ambiente publicado.
