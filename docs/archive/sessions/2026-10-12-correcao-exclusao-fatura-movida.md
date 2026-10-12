# Correção de exclusão de lançamento em fatura movida (v0.20.8)

> **LLM:** deepseek-v4-pro | **Agente:** opencode

## Contexto

Fatura de cartão com fechamento bancário antecipado em relação ao dia padrão configurado. Para contornar, lançamento foi movido manualmente para outra fatura ("Mover p/ Seguinte"). O lançamento precisou ser excluído, mas a exclusão foi recusada com a mensagem de mês fechado mesmo com o lançamento posicionado em fatura aberta.

## Causa raiz

Assimetria entre exibição e validação:

- A listagem da fatura filtra por `t.invoicePeriod === currentPeriod` (`CreditCards.tsx`), exibindo o lançamento na fatura de destino (aberta).
- O guarda de exclusão `handleDeleteTx` chamava `isPeriodClosed(tx.date, ...)` **sem** `tx.invoicePeriod`. `isPeriodClosed` derivava o período da data pela regra padrão do cartão (`calculateInvoicePeriod`) e encontrava a fatura que o banco fechou — bloqueando indevidamente.
- `handleMoveInvoice` (checagem da fatura atual) tinha a mesma omissão.
- O padrão correto já existia em `Transactions.tsx` e `TransactionDialog.tsx`, que passam `tx.invoicePeriod` aos guardas. Cartões é a única via de exclusão de lançamento de cartão (decisão #3), então não havia rota alternativa.

Reprodução determinística: cartão fecha dia 30, vence dia 10; compra em 2026-09-27 deriva para o período 2026-10 (fechada no Fiducia); lançamento movido para 2026-11 (aberta). Guarda antigo: bloqueia. Esperado: permitir.

## Alterações

- `src/lib/utils.ts` — novo `getClosedInvoiceBlock()`, que retorna `{ cardId, cardName, period }` do bloqueio (cartão ou conta comum); `isPeriodClosed()` passou a delegar para ele, mantendo a semântica e eliminando duplicação.
- `src/pages/CreditCards.tsx` — `handleDeleteTx` e `handleMoveInvoice` passam `tx.invoicePeriod` aos guardas (fallback automático para a data quando vazio/legado); mensagens de bloqueio detalhadas com cartão + período e ação de reabertura.
- `src/lib/utils.test.ts` — 9 testes de regressão: lançamento movido para fatura aberta com data em fatura fechada (liberado); `invoicePeriod` explícito fechada/paga/parcial (bloqueado); fallback legado sem `invoicePeriod` (bloqueado); contas comuns via `closedPeriods` inalteradas.

## Validações

`npm run lint`, `npm run test` (202 passaram, 3 do emulador ignorados) e `npm run build` aprovados. Versão sincronizada em `package.json` e `APP_VERSION` (0.20.8).

## Pendências e riscos

- Validação do usuário: excluir o lançamento preso em produção local e confirmar o fluxo de mover/excluir após fatura aberta.
- Risco registrado no MASTER_PLAN: "Recalcular Faturas Antigas" (`handleRecalculateInvoices`) reescreve `invoicePeriod` pela regra da data e pode desfazer movimentos manuais — mesma classe de defeito, tratamento não incluído neste escopo.
