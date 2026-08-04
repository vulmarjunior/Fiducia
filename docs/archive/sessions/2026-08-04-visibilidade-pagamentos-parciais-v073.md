# Sessão — Visibilidade de Pagamentos Parciais v0.7.3

> **LLM:** deepseek-v4-pro | **Agente:** opencode

## Objetivo

Corrigir a percepção de fatura não paga após pagamentos parciais e alinhar cartões, detalhe da fatura e relatórios ao saldo remanescente.

## Resultado

- Card inicial mostra o valor líquido em aberto e informa quanto já foi pago.
- Fatura exibe total original, pagamentos, progresso, histórico e saldo remanescente.
- Saldo e botão de pagamento permanecem visíveis e responsivos.
- Relatórios contabilizam pagamentos parciais e projetam somente o restante devido.
- Evitada dupla contagem quando a fatura atual já contém saldo anterior persistido.

## Arquivos

- `src/lib/invoicePayment.ts`
- `src/lib/invoicePayment.test.ts`
- `src/lib/invoiceAnalysis.ts`
- `src/pages/CreditCards.tsx`
- `src/pages/Reports.tsx`
- `src/lib/utils.ts`
- `package.json`
- `CHANGELOG.md`
- `docs/MASTER_PLAN.md`

## Validações

- `npm run lint` — aprovado.
- `npx vitest run --maxWorkers=1` — 63/63 testes aprovados.
- `npm run build` — aprovado.

## Pendências

- Validação visual autenticada com dados reais após publicação.