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
- **Status**: ✅ Confirmado (após correção de TDZ)
- **Data**: 2026-05-26
- **Contexto**: Dashboard e sumário de transações contavam parcelas futuras e pendentes como despesas quitadas
- **Solução**: Adicionado filtro `isEffectivelyPaid()` nos cálculos de `monthlyIncome`, `monthlyExpense`, `chartData` (Dashboard) e `summary` (Transactions) — considera apenas transações com status `pago` ou `realizado`.

---

## ❌ O que Não Funciona

*(Nenhuma entrada ainda)*

---

## 🔄 Correções de Registro

### TDZ — `isEffectivelyPaid` depois do `useMemo` que o chama
- **Status**: 🔄 Corrigido
- **Data**: 2026-05-26
- **Contexto**: Após deploy, página de Lançamentos não carregava (crash runtime)
- **Causa Raiz**: `const isEffectivelyPaid` definida na linha 1392, mas chamada dentro de `React.useMemo` na linha 1238. `useMemo` executa o callback SÍNCRONO durante o primeiro render — a variável ainda está na **Zona Morta Temporal (TDZ)** do JavaScript, causando `ReferenceError`.
- **Solução**: Moveu `isEffectivelyPaid` para antes do `summary` memo.
- **Observações**: TypeScript/tsc não detecta acesso a `const` na TDZ via closures (`--noEmit` passa limpo). Vite também compila sem erros. O erro só aparece em runtime no navegador.

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

### TDZ com `useMemo` — `const` após `useMemo` quebra em runtime
- **Data**: 2026-05-26
- **Problema**: `const fn = React.useMemo(() => { chamaOutraFuncao(); }, []);` seguido de `const chamaOutraFuncao = () => {...}`. `useMemo` executa o callback sincronamente durante render, mas `chamaOutraFuncao` ainda não foi inicializada (TDZ). TypeScript não detecta porque a closure referencia a variável do escopo pai — não há erro de tipo.
- **Sintoma**: Página não carrega (crash silencioso em produção).
- **Prevenção**: Toda função chamada dentro de `useMemo`/`useCallback` deve ser declarada ANTES do memo. Colocar todas as funções auxiliares no topo do componente, antes dos primeiros `useMemo`.
- **Teste**: `npm run build` compila OK, mas runtime quebra. Único jeito de detectar é testar no navegador.
