# Dev Log — Fiducia

> Documentação viva de descobertas técnicas. Atualizada automaticamente durante o desenvolvimento.
> **Stack**: Firebase, Firestore, TypeScript, React 19, Tailwind CSS 4, Shadcn/UI
> **Última atualização**: 2026-05-27

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

### Dashboard: Filtro de pendências escopo 30 dias
- **Status**: ✅ Confirmado
- **Data**: 2026-05-26
- **Contexto**: Overdue e upcoming expenses/incomes mostravam TODAS as pendências (meses de atraso ou futuras distantes)
- **Solução**: Adicionado filtro `thirtyDaysAgo` e `thirtyDaysFromNow` — overdue vê apenas últimos 30 dias, upcoming vê apenas próximos 30 dias (limitado a 5).

### Dashboard: Badges de tendência dinâmicos
- **Status**: ✅ Confirmado
- **Data**: 2026-05-26
- **Contexto**: Badges "+12.5%" e "-4.2%" nos cartões de Receitas/Despesas eram hardcoded
- **Solução**: Computa automaticamente `incomeTrendPct` e `expenseTrendPct` comparando mês atual vs anterior. Badges agora mostram valor real ou "—" se não houver mês anterior.

### Dashboard: Seletor de período funcional
- **Status**: ✅ Confirmado
- **Data**: 2026-05-26
- **Contexto**: Botões "Sem. / Mês / Ano" não tinham binding de estado
- **Solução**: Adicionado `periodFilter` state (week/month/year). ChartData agora é dinâmico — exibe 8 semanas, 6 meses ou 12 meses conforme seleção.

### Dashboard: Linhas clicáveis → navegation para edição
- **Status**: ✅ Confirmado
- **Data**: 2026-05-26
- **Contexto**: Lançamentos Recentes e contas a pagar/receber não permitiam edição rápida
- **Solução**: onClick em cada row navega para `/transactions` com `state: { editId }`. Transactions.tsx detecta o state via `useLocation` e abre o dialog de edição automaticamente. Invoices (fatura) são ignoradas (não são transações reais).

### Dashboard: Sessões extras colapsáveis no mobile
- **Status**: ✅ Confirmado
- **Data**: 2026-05-26
- **Contexto**: Metas e Orçamentos ocupavam muito espaço vertical no mobile
- **Solução**: Botão "Metas e Orçamentos" no mobile expande/colapsa as duas seções. Em desktop (lg+) ficam sempre visíveis.

### Firestore Rules — `files[].name` é obrigatório na API REST
- **Status**: 🔄 Corrigido
- **Data**: 2026-05-27
- **Contexto**: POST `/v1/projects/{projectId}/rulesets` retornava `400 INVALID_ARGUMENT` sem detalhes
- **Causa Raiz**: O campo `name` dentro de `files[]` é **obrigatório**. Omitting causes 400 even with valid CEL.
- **Solução**: Incluir `"name": "firestore.rules"` no objeto do arquivo.

### Sintaxe CEL — `allow update: false;` inválido sem `if`
- **Status**: 🔄 Corrigido
- **Data**: 2026-05-27
- **Contexto**: `allow update: false;` nas regras de activityLogs causava `400 INVALID_ARGUMENT` na criação do ruleset (sem erro de sintaxe visível)
- **Causa Raiz**: CEL exige `if` antes da expressão booleana — `allow update: if false;` é a sintaxe correta. `allow update: false;` não é reconhecido pelo compilador de regras.
- **Solução**: Alterado `allow update: false;` → `allow update: if false;`

### Deploy de Release para Named Database — delete + recreate
- **Status**: ✅ Confirmado
- **Data**: 2026-05-27
- **Contexto**: Tentativas de `PATCH` com `updateMask=rulesetName` falham com `400 Unknown name "rulesetName"`
- **Solução**: `DELETE /v1/{releaseName}` seguido de `POST /v1/projects/{projectId}/releases` com body `{ name, rulesetName }` funciona.
- **Observações**: Projeto ID real é `gen-lang-client-0172941229` (não o database ID). O `firebase-tools.json` em `~/.config/configstore/` contém o token de acesso.

---

## 💡 Padrões Descobertos

### Navegação com state + edição automática
- **Data**: 2026-05-26
- **Padrão**: Dashboard navega para Transactions com `navigate('/transactions', { state: { editId } })`. Transactions detecta via `useLocation().state?.editId` e chama `openEdit(tx)` automaticamente.
- **Limpeza**: `window.history.replaceState({}, '')` no useEffect para evitar reabertura ao navegar de volta.
- **Cuidado**: Só executa quando `transactions.length > 0` (dados carregados) para evitar race condition com snapshot do Firestore.

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

### Ordem `runTransaction` — reads depois de writes em todos os fluxos
- **Status**: 🔄 Corrigido
- **Data**: 2026-05-27
- **Contexto**: Usuário recebia "Erro ao salvar lançamento" ao criar (antes) e ao atualizar (depois) transações. Console mostrava `Firestore transactions require all reads to be executed before all writes`.
- **Causa Raiz**: CREATE, EDIT, DELETE e IMPORT executavam `transaction.set()`/`transaction.delete()`/`transaction.update()` antes de completar todas as `transaction.get()`. No EDIT, o problema era fazer `get → update` (reverter) → `get` (aplicar novo) no mesmo documento — o segundo `get` após um `update` viola a regra.
- **Solução**: Todos os 5 fluxos agora coletam TODOS os `transaction.get()` de saldo primeiro, acumulam deltas líquidos por conta, e só então aplicam as escritas. No EDIT, o delta é calculado como (efeito novo − efeito velho) para cada conta, permitindo uma única leitura + escrita por conta.

### Saldo inicial visível na edição de conta — risco de confusão
- **Status**: 🔄 Corrigido
- **Data**: 2026-05-27
- **Contexto**: Dialog de edição de conta exibia o campo "Saldo Inicial" preenchido com o saldo atual, dando a falsa impressão de que o saldo podia ser editado.
- **Causa Raiz**: O `updateData` já não enviava `balance` (corrigido anteriormente), mas o campo continuava visível no formulário.
- **Solução**: Substituído `MoneyInput` por label informativa "Saldo Atual: R$ X (gerenciado por transações)" quando `editingId` está presente.

### onSnapshot sem error callback no Reconciliation
- **Status**: 🔄 Corrigido
- **Data**: 2026-05-27
- **Contexto**: `onSnapshot` de accounts e creditCards no Reconciliation.tsx não tinha callback de erro.
- **Solução**: Adicionados callbacks com `handleFirestoreError`.

### AI errors sem feedback visual
- **Status**: 🔄 Corrigido
- **Data**: 2026-05-27
- **Contexto**: Dashboard e Reports engoliam erros da Groq API silenciosamente (só console.error). Erro de fetchBanks em Accounts.tsx também sem toast.
- **Solução**: Adicionados `toast.error()` nos catch blocks de `fetchAiTip` (Dashboard), `generateAIAnalysis` (Reports) e `fetchBanks` (Accounts).

### forEach(async) anti-pattern no sync de faturas
- **Status**: 🔄 Corrigido
- **Data**: 2026-05-27
- **Contexto**: Transactions.tsx usava `invoices.forEach(async ...)` com `await updateDoc` — promises não eram aguardadas e erros não propagavam.
- **Solução**: Substituído por `for...of` dentro de `async function` nomeada.

### PWA — iOS meta tags ausentes e update forçado
- **Status**: 🔄 Corrigido
- **Data**: 2026-05-27
- **Contexto**: index.html faltava 4 meta tags essenciais para iOS PWA. Service worker forçava reload sem aviso.
- **Solução**: Adicionadas `apple-mobile-web-app-capable`, `mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`. `theme-color` agora é dinâmico por preferência de tema. `updateSW()` agora exibe toast com botão "Atualizar" em vez de reload forçado.

### .env — chave GEMINI_API_KEY expirada/não utilizada
- **Status**: 🔄 Corrigido
- **Data**: 2026-05-27
- **Contexto**: `.env` continha `GEMINI_API_KEY` com uma chave hardcoded, mas o código ativo não a utiliza (só Groq). APP_URL estava com placeholder.
- **Solução**: Removida `GEMINI_API_KEY`. `APP_URL` atualizada para `https://fiducianew.vercel.app`.

### Contraste Dark Mode — classes hardcoded no Transactions.tsx
- **Status**: 🔄 Corrigido
- **Data**: 2026-05-27
- **Contexto**: Cards de resumo (Receitas/Despesas/Saldo), modal e formulário de lançamentos usavam classes Tailwind fixas (`bg-gray-50`, `text-gray-400`, `bg-white`, `border-gray-100`) que não se adaptam ao dark mode — texto ilegível sobre fundo cinza.
- **Solução**: Substituídas ~70 classes hardcoded por tokens Shadcn (`bg-muted`, `text-muted-foreground`, `text-foreground`, `bg-background`, `border-border/50`). Gradientes dos summary cards ganharam variante `dark:`. Token `--text-muted` no dark mode alterado de `#94a3b8` para `#cbd5e1` (contraste 5.5:1). Cores fiducia no dark mode suavizadas (verde `#34d399`, vermelho `#f87171`, azul `#60a5fa`).

### Transferência exibida como despesa no Dashboard
- **Status**: 🔄 Corrigido
- **Data**: 2026-05-27
- **Contexto**: Lançamentos Recentes no Dashboard exibia transferências com ícone vermelho de despesa (`ArrowDownRight`), sinal de menos e cor de texto padrão — o código só tratava receita/income como caso especial.
- **Solução**: Adicionado terceiro caminho para `transferencia`/`transfer` no bloco `transactions.slice(0,6).map()` — ícone `ArrowRightLeft`, círculo azul (`bg-fiducia-blue/10`), valor em azul, sem sinal de + ou -.

### Card Disponível Seguro no Dashboard
- **Status**: ✅ Implementado
- **Data**: 2026-05-27
- **Contexto**: Nova métrica de fluxo de caixa operacional. Substituiu o card "Balanço do Mês" no grid de KPIs.
- **Fórmula**: `disponivelSeguro = saldoCirculante − gastosCartao − contasPendentes`
- **Componentes**: Saldo Circulante (contas sem `excludeFromCashFlow`), Gastos de Cartão (**faturas `aberta` + `fechada`** da coleção `invoices`), Contas Pendentes (despesas pendentes do mês atual/anteriores, excluindo cartão)
- **UI**: Card com decomposição em linhas (Fatura Aberta, Fatura Fechada, Total Cartão, Contas Pendentes), tooltip explicativo, estado positivo (roxo/`ShieldCheck`) ou negativo (vermelho/`ShieldAlert`), subtexto informando contas excluídas do fluxo.
- **Tokens**: Adicionados `--fiducia-purple` e `--fiducia-purple-bg` no light mode (`#8b5cf6`/`#ede9fe`) e dark mode (`#a78bfa`/rgba).
- **Correção**: `gastosCartao` mudou de `transactions` individuais para `invoices.totalAmount`. Dashboard agora escuta a coleção `invoices` via `onSnapshot`.
- **Fluxo de Caixa (gráfico)**: Não precisou de alteração. Já agrupa compras de cartão por `invoicePeriod` e ignora transferências — mostra tendência de consumo sem dupla contagem com o card Disponível Seguro, que mostra posição atual.

### `allow update: false;` não é CEL válido — API retorna 400 sem mensagem útil
- **Data**: 2026-05-27
- **Problema**: `allow update: false;` em Firestore rules causa `400 INVALID_ARGUMENT` — a API não indica qual é o erro de sintaxe.
- **Sintoma**: POST `/rulesets` retorna 400 com mensagem genérica "Request contains an invalid argument." Mesmo logs detalhados do Google não mostram o erro real.
- **Prevenção**: Sempre usar `allow <op>: if <expressão>;`. O `if` é obrigatório mesmo para literais booleanos. Incrementar mudanças uma a uma via API para isolar o erro.
