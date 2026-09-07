# Sessão: Correção do Valor Original e Saldo Remanescente da Fatura
> Data: 2026-09-07
> Versão: 0.20.3
> LLM: Gemini 3.1 Pro (High) | Agente: Antigravity

## Objetivo
Corrigir o cálculo do "Valor Original" nas faturas de cartão de crédito no momento de registrar pagamentos e limpar totais salvos indevidamente ao reabrir a fatura.

## Escopo
- Analisar a lógica de `handlePayInvoice` e `handleReopenInvoice` em `src/pages/CreditCards.tsx`.
- Analisar `getInvoiceFinancialSummary` em `src/lib/invoicePayment.ts`.

## Decisões
- O `handlePayInvoice` estava somando as compras do mês atual com as do mês anterior (inclusive faturas já pagas), pois o método que recupera o saldo anterior não checava se a fatura já havia sido paga e nem capturava corretamente os pagamentos gravados como despesas. A correção foi igualar o cálculo com a leitura de UI (através de `getInvoiceFinancialSummary`).
- Adicionada regra no `handleReopenInvoice` para zerar o `totalAmount` corrompido que ficava guardado no banco.
- Por fim, a proteção final de resiliência: se o `status` da fatura for 'aberta', a função `getInvoiceFinancialSummary` agora vai ignorar qualquer `totalAmount` previamente salvo e obrigará a reavaliação dinâmica (tempo real), corrigindo qualquer erro legado para os usuários.

## Arquivos Tocados
- `src/pages/CreditCards.tsx`
- `src/lib/invoicePayment.ts`
- `package.json` (bump v0.20.3)
- `CHANGELOG.md` (registro v0.20.3)
- `docs/MASTER_PLAN.md` (bump v0.20.3)

## Validações
- Teste prático do recálculo com totalAmount ignorado quando `status === 'aberta'`.
- Confirmação do descarte do bug visual para os saldos na UI.
