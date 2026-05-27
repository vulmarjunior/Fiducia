# Dev Log — Fiducia

> Documentação viva de descobertas técnicas. Atualizada automaticamente durante o desenvolvimento.
> **Stack**: Firebase, Firestore, TypeScript, React 19, Tailwind CSS 4, Shadcn/UI
> **Última atualização**: 2026-05-26

---

## ✅ O que Funciona

### Contas Bancárias — Saldos e Transações
- **Status**: ✅ Confirmado
- **Data**: 2026-05-26
- **Contexto**: Correção de race condition nos balance updates
- **Solução**: Substituído `updateDoc` com leitura de estado React por `runTransaction` do Firestore, que lê o saldo atual atômico do banco antes de escrever. Aplicado em: edição, criação, exclusão e importação de transações.
- **Observações**: Elimina duplicação/perda de saldo em operações concorrentes.

### Suporte a Parcelamento em Contas Corrente
- **Status**: ✅ Confirmado
- **Data**: 2026-05-26
- **Contexto**: Usuário precisava lançar empréstimo de R$1000 em 10x de R$100 em conta bancária
- **Solução**: Botão "PARCELADO" adicionado para contas corrente (antes era só para cartão). Gera N transações com `installmentNumber`/`totalInstallments` e aplica saldo apenas na primeira.
- **Observações**: Para cartão de crédito, parcelas vão para faturas distintas. Para conta corrente, o saldo reflete o valor total do bem/serviço.

### Resumos Mensais — Filtro por Status
- **Status**: ✅ Confirmado
- **Data**: 2026-05-26
- **Contexto**: Dashboard e sumário de transações contavam parcelas futuras e pendentes como despesas quitadas
- **Solução**: Adicionado filtro `isEffectivelyPaid()` nos cálculos de `monthlyIncome`, `monthlyExpense`, `chartData` (Dashboard) e `summary` (Transactions) — considera apenas transações com status `pago` ou `realizado`.

---

## ❌ O que Não Funciona

*(Nenhuma entrada ainda)*

---

## 🔄 Correções de Registro

*(Nenhuma entrada ainda)*

---

## 💡 Padrões Descobertos

*(Nenhuma entrada ainda)*

---

## 📋 Decisões de Arquitetura

*(Nenhuma entrada ainda)*

---

## ⚠️ Armadilhas Conhecidas (Gotchas)

*(Nenhuma entrada ainda)*
