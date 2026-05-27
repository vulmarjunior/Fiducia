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
- **Solução**: Substituído `updateDoc` com leitura de estado React por `runTransaction` do Firestore, que lê o saldo atual atômico do banco antes de escrever. Aplicado em: edição, criação e importação de transações.
- **Observações**: Elimina duplicação/perda de saldo em operações concorrentes. DELETE também convertido para `runTransaction` com leitura fresca do Firestore.

### Suporte a Parcelamento em Contas Corrente
- **Status**: ✅ Confirmado
- **Data**: 2026-05-26
- **Contexto**: Usuário precisava lançar empréstimo de R$1000 em 10x de R$100 em conta bancária
- **Solução**: Botão "PARCELADO" adicionado para contas corrente (antes era só para cartão). Gera N transações com `installmentNumber`/`totalInstallments` e aplica saldo apenas na primeira.
- **Observações**: Para cartão de crédito, parcelas vão para faturas distintas. Para conta corrente, o saldo reflete o valor total do bem/serviço.

### Resumos Mensais — Filtro por Status
- **Status**: ✅ Confirmado (após correção de TDZ)
- **Data**: 2026-05-26
- **Contexto**: Dashboard e sumário de transações contavam parcelas futuras e pendentes como despesas quitadas
- **Solução**: Adicionado filtro `isEffectivelyPaid()` nos cálculos de `monthlyIncome`, `monthlyExpense`, `chartData` (Dashboard) e `summary` (Transactions) — considera apenas transações com status `pago` ou `realizado`.

### Fluxos de Saldo Atômicos
- **Status**: ✅ Confirmado
- **Data**: 2026-05-26
- **Contexto**: Operações CREATE, EDIT, DELETE e IMPORT tinham transações e balance update em operações separadas — risco de órfãos se o balance update falhasse.
- **Solução**: Todos os fluxos agora usam um ÚNICO `runTransaction` que cria/remove transações E atualiza saldos atomicamente.

### DELETE de Séries — Reversão Única
- **Status**: ✅ Confirmado
- **Data**: 2026-05-26
- **Contexto**: DELETE de série recorrente/parcelado revertia saldo N vezes (uma por transação), mas o CREATE só atualizou saldo 1 vez.
- **Solução**: DELETE agrupa transações por `parentId`, reverte saldo apenas 1× por série. Para parcelado, soma todas as parcelas (= total original). Para recorrente, usa o amount de qualquer uma.

---

## 🔄 Correções de Registro

### TDZ — `isEffectivelyPaid` depois do `useMemo` que o chama
- **Status**: 🔄 Corrigido
- **Data**: 2026-05-26
- **Contexto**: Após deploy, página de Lançamentos não carregava (crash runtime)
- **Causa Raiz**: `const isEffectivelyPaid` definida na linha 1392, mas chamada dentro de `React.useMemo` na linha 1238. `useMemo` executa o callback SÍNCRONO durante o primeiro render — a variável ainda está na **Zona Morta Temporal (TDZ)** do JavaScript, causando `ReferenceError`.
- **Solução**: Moveu `isEffectivelyPaid` para antes do `summary` memo.

### DELETE revertia saldo N× para séries recorrentes/parcelado
- **Status**: 🔄 Corrigido
- **Data**: 2026-05-26
- **Contexto**: Usuário deletou série de salário recorrente (12× R$5.000) e o saldo geral foi de R$440 para -R$47.419,97
- **Causa Raiz**: DELETE acumulava `balanceChange` para CADA transação da série (12×), mas o CREATE só atualizou o saldo 1 vez. Resultado: saldo sobre-revertido em 11× o valor.
- **Solução**: Agrupamento por `parentId` no DELETE; apenas 1 reversão por série.

### Catch blocks não mostravam toast de erro
- **Status**: 🔄 Corrigido
- **Data**: 2026-05-26
- **Contexto**: `handleFirestoreError` dá throw dentro dos catch blocks, impedindo `toast.error` de executar
- **Solução**: Trocada a ordem — `toast.error` antes de `handleFirestoreError`

### Edição de conta sobrescrevia saldo
- **Status**: 🔄 Corrigido
- **Data**: 2026-05-26
- **Contexto**: Account edit enviava `balance` no updateData, podendo sobrescrever saldo atual com valor do formulário
- **Solução**: Removido `balance` do `updateData` no edit (saldo só deve ser gerenciado por transações)

---

## 💡 Padrões Descobertos

*(Nenhuma entrada ainda)*

---

## 📋 Decisões de Arquitetura

- **Atomicidade total**: CREATE, EDIT, DELETE, IMPORT — todos os fluxos de saldo agora usam `runTransaction` como única operação atômica.
- **Saldo editável só na criação**: Ao criar conta, `balance` é definido. Nunca mais deve ser editado diretamente — apenas via transações.
- **Reversão de série**: Para séries recorrentes/parcelado, a reversão de saldo no DELETE deve ser contada 1× por `parentId`, não por transação individual.

---

## ⚠️ Armadilhas Conhecidas (Gotchas)

### TDZ com `useMemo` — `const` após `useMemo` quebra em runtime
- **Data**: 2026-05-26
- **Problema**: `const fn = React.useMemo(() => { chamaOutraFuncao(); }, []);` seguido de `const chamaOutraFuncao = () => {...}`. `useMemo` executa o callback sincronamente durante render, mas `chamaOutraFuncao` ainda não foi inicializada (TDZ). TypeScript não detecta porque a closure referencia a variável do escopo pai — não há erro de tipo.
- **Sintoma**: Página não carrega (crash silencioso em produção).
- **Prevenção**: Toda função chamada dentro de `useMemo`/`useCallback` deve ser declarada ANTES do memo.

### `handleFirestoreError` dá throw — impede toasts depois dela
- **Data**: 2026-05-26
- **Problema**: `handleFirestoreError` sempre dá `throw new Error(...)`. Se colocada antes de `toast.error()`, o toast nunca aparece.
- **Prevenção**: Sempre chamar `toast.error()` PRIMEIRO, depois `handleFirestoreError()` (que pode throw sem阻塞 o UX).
