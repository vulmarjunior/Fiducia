# Sessão Concluída — Correção Definitiva de Permissão no Pagamento de Fatura v0.7.1

> Sessão encerrada e arquivada em 2026-08-04.
> **LLM:** deepseek-v4-pro | **Agente:** opencode

---

### Objetivo

Corrigir o erro de permissão do Firestore (`permission-denied`, `Missing or insufficient permissions`) ao tentar registrar o pagamento de fatura do cartão de crédito (tanto pelo fluxo de fechar período em Transações quanto pelo fluxo de pagamento na tela de Cartões).

### Causa-raiz

As regras de validação do servidor de banco em produção exigiam que `destinationAccountId` (quando fornecido) apontasse obrigatoriamente para um documento existente na coleção `/accounts/`. Ao registrar um pagamento de fatura como uma `transferencia` direcionada ao cartão (`destinationAccountId: cardId`), a verificação de existência na coleção de contas bancárias retornava `FALSE` (pois o ID pertence à coleção `/creditCards/`), bloqueando a gravação com o erro `permission-denied` na coleção `transactions`.

### Resultado técnico

- Reestruturado o lançamento de pagamento da fatura para ser gravado como um débito na conta bancária de origem (`type: 'despesa'`, `destinationAccountId: null`).
- Mantido o vínculo atômico entre a transação e a fatura através dos campos `paymentTransactionIds[]` e `paidAmount` no documento `/invoices/`.
- Isso manteve a mecânica de pagamento parcial 100% funcional e eliminou qualquer conflito de regras de validação no Firestore.

### Arquivos tocados

- `src/pages/CreditCards.tsx` — Transação criada no `handlePayInvoice` reestruturada para `type: 'despesa'` com `destinationAccountId: null`.
- `src/pages/Transactions.tsx` — Transação criada ao fechar período reestruturada para `type: 'despesa'` com `destinationAccountId: null`.
- `CHANGELOG.md` — Atualização do changelog da versão 0.7.1.
- `docs/MASTER_PLAN.md` — Atualização do plano mestre.

### Validações

- `npm run lint` — Sem erros (tsc --noEmit OK)
- `npm run test` — 54/54 testes passando com sucesso
- `npm run build` — Build de produção OK (vite build sem erros)
