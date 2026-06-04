# Dev Log — Fiducia

> Documentação viva de descobertas técnicas. Atualizada automaticamente durante o desenvolvimento.
> **Stack**: Firebase, Firestore, TypeScript, React 19, Tailwind CSS 4, Shadcn/UI
> **Última atualização**: 2026-06-02

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

### Quick Confirm — Confirmação Rápida de Pendências
- **Status**: ✅ Confirmado
- **Data**: 2026-05-28
- **Contexto**: Usuário precisava confirmar pagamentos pendentes sem abrir formulário de edição.
- **Solução**: Botão verde `CheckCircle` na coluna de ações do Transactions, visível apenas para status `pendente`/`pending`. Usa `runTransaction` para atualizar status + debitar saldo atomicamente. Suporta expense, income e transferencia.

### Dashboard — Card Contas com Busca e Card Cartões
- **Status**: ✅ Confirmado
- **Data**: 2026-05-28
- **Contexto**: Card "Lançamentos Recentes" era inútil (ordem aleatória, sem filtro). Card lateral "Contas e Cartões" duplicava informação.
- **Solução**: Substituído por dois cards na coluna esquerda: "Minhas Contas" (lista com saldo, clique → `/transactions` filtrado por conta+mês) e "Meus Cartões" (fatura prévia + limite disponível + barra de uso, clique → `/cards` com modal de fatura aberto). Card lateral removido.

### CategorySelect — Componente Compartilhado de Categoria
- **Status**: ✅ Confirmado
- **Data**: 2026-05-28
- **Contexto**: Modal de lançamento do cartão de crédito usava shadcn Select simples sem ícones, busca ou hierarquia. Modal de lançamentos usava react-select com busca, ícones e hierarquia — comportamento e visual divergentes.
- **Solução**: Extraído `CategorySelect` (`src/components/CategorySelect.tsx`) com react-select, busca textual, ícones por categoria e suporte a hierarquia pai/filho. Usado tanto no modal de lançamentos quanto nos modais do cartão (novo e edição). Funções duplicadas `renderCategoryOptions` e `getCategoryOptions` removidas do Transactions.

### Navegação com preset de filtro
- **Status**: ✅ Confirmado
- **Data**: 2026-05-28
- **Contexto**: Dashboard navegava para `/transactions` sem filtro — usuário precisava reaplicar filtro manualmente.
- **Solução**: `navigate('/transactions', { state: { presetAccountId, presetMonth } })`. Transactions lê `location.state.presetAccountId`/`presetMonth` no mount e aplica os filtros automaticamente. Mesmo padrão do `editId`.

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

### Dashboard: Linhas clicáveis → navegação para edição
- **Status**: ✅ Confirmado
- **Data**: 2026-05-26
- **Contexto**: Lançamentos Recentes e contas a pagar/receber não permitiam edição rápida
- **Solução**: onClick em cada row navega para `/transactions` com `state: { editId }`. Transactions.tsx detecta o state via `useLocation` e abre o dialog de edição automaticamente. Invoices (fatura) são ignoradas (não são transações reais).

### Dashboard: Sessões extras colapsáveis no mobile
- **Status**: ✅ Confirmado
- **Data**: 2026-05-26
- **Contexto**: Metas e Orçamentos ocupavam muito espaço vertical no mobile
- **Solução**: Botão "Metas e Orçamentos" no mobile expande/colapsa as duas seções. Em desktop (lg+) ficam sempre visíveis.

### Card Disponível Seguro no Dashboard
- **Status**: ✅ Implementado (atualizado 2026-06-04)
- **Data**: 2026-05-27
- **Contexto**: Nova métrica de fluxo de caixa operacional. Substituiu o card "Balanço do Mês" no grid de KPIs.
- **Fórmula**: `disponivelSeguro = saldoCirculante + receitasPendentes − gastosCartao − contasPendentes`
- **Componentes**: 
  - Saldo Circulante (contas sem `excludeFromCashFlow`)
  - Receitas a Receber (receitas `pendente` do mês corrente, exceto cartão e transferências)
  - Gastos de Cartão (**faturas `aberta` + `fechada`** da coleção `invoices`)
  - Contas Pendentes (despesas pendentes vencidas, excluindo cartão)
- **UI**: Card com decomposição em linhas (Saldo Circulante, Receitas a Receber, Fatura Aberta, Fatura Fechada, Total Cartão, Contas Pendentes), tooltip explicativo, estado positivo (roxo/`ShieldCheck`) ou negativo (vermelho/`ShieldAlert`), subtexto informando contas excluídas do fluxo.
- **Tokens**: Adicionados `--fiducia-purple` e `--fiducia-purple-bg` no light mode (`#8b5cf6`/`#ede9fe`) e dark mode (`#a78bfa`/rgba).
- **Correção**: `gastosCartao` mudou de `transactions` individuais para `invoices.totalAmount`. Dashboard agora escuta a coleção `invoices` via `onSnapshot`.
- **Fluxo de Caixa (gráfico)**: Não precisou de alteração. Já agrupa compras de cartão por `invoicePeriod` e ignora transferências — mostra tendência de consumo sem dupla contagem com o card Disponível Seguro, que mostra posição atual.

### PageHelp — Componente de ajuda contextual
- **Status**: ✅ Implementado
- **Data**: 2026-05-27
- **Contexto**: Usuários com dificuldade em entender a diferença entre Conciliação e Auditoria, e o propósito de cada tela do sistema.
- **Solução**: Criado componente `PageHelp` (`src/components/PageHelp.tsx`) com botão `?` ao lado do título de cada página. Abre um Dialog Shadcn com descrição, dicas em cards e páginas relacionadas. Adicionado em todas as 12 páginas privadas + Dashboard. Conteúdo estático (offline-first), sem dependência de IA.

### Importador de Fatura PDF — Cartões de Crédito
- **Status**: ✅ Implementado
- **Data**: 2026-05-30
- **Contexto**: Usuário precisava importar faturas de cartão diretamente do PDF, sem precisar de OFX ou CSV. Além disso, precisava categorizar as transações e lidar com compras parceladas ("1/5").
- **Solução**: `pdfjs-dist` extrai texto do PDF no browser (zero servidor). O texto bruto + lista de categorias do usuário são enviados à Groq (`llama-3.3-70b-versatile`). Retorna JSON com `[{date, description, amount, type, installmentInfo, suggestedCategoryId}]`. 
- **Categorização Automática**: O dialog exibe um `Select` por transação, pré-preenchido com a sugestão da IA.
- **Série Parcelada**: Transações com badge (ex: "2/6") habilitam um botão "Expandir série". Se ativado, o sistema calcula os meses restantes e cria transações `pendente` nas faturas futuras apropriadas, interligadas por `parentId`.
- **Arquivos criados/modificados**: `src/services/pdfInvoiceService.ts`, `src/components/PdfImportReviewDialog.tsx`, `src/pages/CreditCards.tsx`.
- **Limitação conhecida**: PDFs escaneados (imagem) não têm texto extraível — toast de erro informativo é exibido.

### TransactionDialog — Modal Unificado de Transações
- **Status**: ✅ Implementado
- **Data**: 2026-05-29
- **Contexto**: Sistema tinha dois modais de transação (Transactions.tsx e CreditCards.tsx) com capacidades diferentes. Edição de parcelas não propagava alterações. Invoice period não era editável no modal padrão.
- **Solução**: Criado `TransactionDialog` (`src/components/TransactionDialog.tsx`) + `TransactionDialogContext` (`src/contexts/TransactionDialogContext.tsx`). Modal único para criação e edição em todo o sistema. Invoice period sempre visível e editável para cartão. Propagação de descrição/categoria/tags/obs em séries parceladas. Preservação de metadados na edição. Submit unificado via `runTransaction`.
- **Removido**: ~1200 linhas de dialog inline do Transactions.tsx, ~500 linhas de dialogs do CreditCards.tsx.

### CalcPopover — Calculadora Rápida Inline
- **Status**: ✅ Implementado
- **Data**: 2026-06-02
- **Contexto**: Usuário precisava fazer cálculos básicos sem sair do modal de lançamento.
- **Solução**: Criado `CalcPopover` (`src/components/CalcPopover.tsx`) — popover com input de expressão aritmética. Parser recursivo seguro (sem `eval()`/`new Function()`). Preview ao vivo formatado em R$. Enter = aplicar, Escape = fechar.
- **Integração**: Adicionado botão de calculadora (ícone `Calculator`) no `MoneyInput` via prop `showCalc` (default `true`). Botão oculto quando `disabled=true`. Todos os campos monetários do sistema ganharam o atalho automaticamente — sem alterar nenhuma página.

### remainderPosition — Seletor de Posição da Diferença de Centavos
- **Status**: ✅ Implementado
- **Data**: 2026-06-02
- **Contexto**: Ao parcelar R$100 em 3x, a 1ª parcela sempre recebia os centavos extras (R$33,34 / R$33,33 / R$33,33). Mas isso depende do banco — o usuário precisava de liberdade para escolher.
- **Solução**: Novo campo `remainderPosition` (`'first'` | `'last'` | `'spread'`) no `formData` do TransactionDialog:
  - `first` (padrão): centavos extras na 1ª parcela
  - `last`: centavos extras na última parcela
  - `spread`: distribui 1 centavo por parcela da esquerda pra direita
- **UI**: Select "Diferença de Centavos" visível **somente quando `remainder > 0`** (divisão não-exata).
- **Atingido em**: `handleCreateSubmit` (cartão e conta), ambos os blocos de conversão avulso→parcelado.
- **Helpers**: `computeInstallmentParts(total, count)` e `getInstallmentAmount(i, position, count, base, remainder)` extraídos para reuso.

### Conversão Avulso → Parcelado na Edição
- **Status**: ✅ Implementado
- **Data**: 2026-06-02
- **Contexto**: Usuário tentava editar um lançamento de R$1.779,45 para mudar de avulso para parcelado em 3x. O sistema retornava "Lançamento atualizado" mas nada mudava.
- **Causa Raiz**: `handleEditSubmit` não tinha código para converter avulso→parcelado. O `updateData` não incluía `parentId`, `installmentNumber`, `totalInstallments`. Nenhuma parcela nova era criada. O Firestore atualizava o documento com os mesmos dados (sem mudança real), mas a transação não falhava → toast falso-positivo.
- **Solução**: Dois novos blocos de early return no `handleEditSubmit`, antes dos caminhos existentes:
  - **Cartão de crédito**: original → parcela 1 (`realizado`), cria N−1 parcelas (`pendente`) em faturas sequenciais com `getNextPeriod()`.
  - **Conta corrente**: lê saldo, calcula `delta = efeitoParcelado − efeitoAvulso`, ajusta saldo, cria N−1 pendentes.
- **Transferência**: Bloqueada com toast "Não é possível parcelar uma transferência".

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

### Saldo inicial visível na edição de conta — risco de confusão
- **Status**: 🔄 Corrigido
- **Data**: 2026-05-27
- **Contexto**: Dialog de edição de conta exibia o campo "Saldo Inicial" preenchido com o saldo atual, dando a falsa impressão de que o saldo podia ser editado.
- **Causa Raiz**: O `updateData` já não enviava `balance` (corrigido anteriormente), mas o campo continuava visível no formulário.
- **Solução**: Substituído `MoneyInput` por label informativa "Saldo Atual: R$ X (gerenciado por transações)" quando `editingId` está presente.

### CREATE parcelado debita total em vez da 1ª parcela
- **Antes**: "Suporte a Parcelamento em Contas Corrente — aplica saldo apenas na primeira." (registrado como ✅ em 2026-05-26)
- **Depois**: O código aplicava `amount` (total) como balance change, não o valor da 1ª parcela. Era INCONSISTENTE com o que o registro descrevia. Corrigido em 2026-05-28.
- **Motivo**: Bug não detectado no registro original. O CREATE parcelado usava `const balanceChange = formData.type === 'receita' ? amount : -amount` onde `amount` é o total (ex: R$1050) e não `installmentBase + remainder` (R$150).

### EDIT — sinal do delta de balance invertido
- **Antes**: Registrado como funcionando corretamente.
- **Depois**: A reversão do efeito antigo usava `- oldEffect` em vez de `+ oldEffect`. E a aplicação do novo efeito usava `formData.type === 'receita' ? -amount : amount` em vez do sinal do CREATE (`? amount : -amount`). Esses dois bugs se cancelavam PARCIALMENTE quando o valor não mudava, mas geravam saldo incorreto em qualquer alteração de valor.

### Política de saldo: pendente NÃO afeta saldo
- **Antes**: Todas as transações, independente do status, alteravam o saldo da conta. O card Disponível Seguro era o único responsável por contabilizar pendências.
- **Depois**: Transações pendentes/canceladas NÃO alteram o saldo. O saldo reflete apenas o valor real em posse do usuário. Para previsão, usar Disponível Seguro (Dashboard) ou relatórios.
- **Motivo**: Decisão do usuário após discussão — "transações pendentes não foram pagas, não podem afetar o saldo da conta."

### Categorias não apareciam para cartão de crédito no TransactionDialog
- **Status**: 🔄 Corrigido
- **Data**: 2026-05-29
- **Causa Raiz**: Categorias são armazenadas no Firestore com `type` em português (`'despesa'`/`'receita'`), mas o `TransactionDialog` usava `typeFilter="expense"` (inglês) para o CategorySelect do cartão de crédito. O CategorySelect fazia `categories.filter(c => c.type === typeFilter)` com `===` estrito, resultando em zero resultados.
- **Solução**: `CategorySelect` agora normaliza ambos os idiomas no filtro. `TransactionDialog` passou a usar `typeFilter="despesa"` (português) para o cartão.

### Datas registradas um dia antes — timezone UTC vs BRT
- **Status**: 🔄 Corrigido
- **Data**: 2026-05-29
- **Causa Raiz**: `new Date("YYYY-MM-DD")` no JavaScript é interpretado como meia-noite UTC (ISO 8601 date-only). No Brasil (BRT, UTC-3), meia-noite UTC = 21h do dia anterior. Ao converter para ISO string com `.toISOString()`, a data ficava como `2026-05-29T00:00:00.000Z` em UTC, mas ao exibir com `.toLocaleDateString('pt-BR')` o JS convertia para BRT, mostrando `28/05/2026`.
- **Solução**: Criadas funções `parseLocalDate()` e `dateToLocalISOString()` em `src/lib/utils.ts` que constroem a data como meia-noite no fuso local usando `new Date(y, m-1, d)`. Substituídos todos os `new Date(formData.date)` nos fluxos do `TransactionDialog`. Corrigida exibição no `CreditCards.tsx`.

### Correção Prompt Groq — Valor Individual da Parcela
- **Status**: 🔄 Corrigido
- **Data**: 2026-06-02
- **Contexto**: Importador de fatura PDF lançava compras parceladas com valor total em vez do valor individual da parcela.
- **Causa Raiz**: Prompt da Groq não instruía explicitamente que `amount` deve ser o valor individual visível na linha da fatura, não o total da compra.
- **Solução**: Prompt atualizado com regra explícita e exemplo de transação parcelada (`amount: 175.00` para "COMPRA LOJA (2/6)").
- **Validação adicional**: `handleConfirmPdfImport` agora exibe `toast.warning` de 8s se alguma parcela > R$5.000, alertando para verificar valor individual vs total.

### 24 catch blocks com ordem toast/handleFirestoreError invertida
- **Status**: 🔄 Corrigido
- **Data**: 2026-06-02
- **Contexto**: Auditoria completa encontrou 24 blocos catch onde `handleFirestoreError()` (que dá throw) era chamada ANTES de `toast.error()`, impedindo o toast de executar.
- **Arquivos afetados**: `Categories.tsx` (6), `Budgets.tsx` (2), `Goals.tsx` (2), `Tags.tsx` (2), `Audit.tsx` (4), `Settings.tsx` (2), `CreditCards.tsx` (3 remanescentes).
- **Solução**: Ordem invertida em todos — `toast.error()` primeiro, `handleFirestoreError()` depois. Mesmo padrão já aplicado em Transactions, Dashboard e TransactionDialog.

### XSS — dangerouslySetInnerHTML com conteúdo de IA
- **Status**: 🔄 Corrigido
- **Data**: 2026-06-02
- **Contexto**: `Reports.tsx:298` inseria resposta da Groq diretamente no DOM com `dangerouslySetInnerHTML`, apenas convertendo `\n` → `<br/>`. Um ataque de prompt injection poderia injetar `<script>`.
- **Solução**: HTML escaping completo antes de inserir: `&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;`, `"` → `&quot;`. Depois converte `\n` → `<br/>`. Só `<br/>` chega ao DOM.

### CalcPopover — Substituição de new Function() por parser recursivo
- **Status**: 🔄 Corrigido
- **Data**: 2026-06-02
- **Contexto**: `CalcPopover.tsx:13` usava `new Function(\`"use strict"; return (${sanitized})\`)()` para avaliar expressões. Flagged por scanners de segurança.
- **Solução**: Parser aritmético recursivo (recursive descent) implementado — suporta +, −, *, /, parênteses, números negativos e decimais. Zero dependências, ~50 linhas.

### Deduplicação de Utilitários
- **Status**: 🔄 Corrigido
- **Data**: 2026-06-02
- **Contexto**: Funções idênticas definidas múltiplas vezes em arquivos diferentes:
  - `isEffectivelyPaid`: 4 definições (TransactionDialog, Dashboard, Transactions, Accounts)
  - `isPeriodClosed`: 3 definições (TransactionDialog, Transactions, CreditCards)
  - `formatCurrency`: 3 definições (Dashboard, Transactions, Reports)
  - `getPreviousPeriod`: 2 definições (utils.ts exportado, CreditCards.tsx duplicado)
- **Solução**: Todas extraídas para `src/lib/utils.ts` como funções exportadas. Consumidores importam de `@/lib/utils`. `isPeriodClosed` unificada com parâmetros explícitos para os arrays de lookup (elimina dependência de estado do componente).

### Dark Mode — Reconciliation.tsx
- **Status**: 🔄 Corrigido
- **Data**: 2026-06-02
- **Contexto**: Reconciliation.tsx usava 24 classes hardcoded (`bg-white`, `text-gray-500`, `border-gray-200`) sem variantes dark, tornando a página ilegível em dark mode.
- **Solução**: Substituídas por tokens Shadcn (`bg-card`, `text-muted-foreground`, `border-border`) + variantes `dark:` para cores de status.

### onSnapshot Duplicado — Transactions.tsx
- **Status**: 🔄 Corrigido
- **Data**: 2026-06-02
- **Contexto**: Transactions.tsx assinava a mesma query `transactions` duas vezes (linha 144 para dados, linha 182 para sync de fatura). Cada listener recebia o dataset completo do usuário.
- **Solução**: Listener duplicado removido. Lógica de sync de fatura movida para dentro do primeiro callback, guardada por `if (invoices.length > 0)`.
- **Bônus**: Adicionado `isLoading` state com spinner "Carregando..." no lugar do flash de tabela vazia.

### Vazamento de despesas de cartão no card "Contas a Pagar" do Dashboard
- **Status**: 🔄 Corrigido
- **Data**: 2026-06-02
- **Contexto**: Parcelas pendentes de cartão de crédito apareciam individualmente na lista "Contas a Pagar" e eram somadas duas vezes (individual + fatura sintética `unpaidInvoices`). O card deveria mostrar apenas despesas de conta corrente e faturas consolidadas.
- **Causa Raiz**: `overdueExpenses` (linha 232), `upcomingExpenses` (linha 237) e o filtro inline em `allPendingExpenses` (linha 313) não tinham guarda contra transações de cartão. Já `contasPendentes` (Disponível Seguro) tinha os guards corretos.
- **Solução**: Adicionado `!t.creditCardId && !creditCards.some(c => c.id === t.accountId)` nos 3 filtros. Variável não-utilizada `totalPendingPay` removida.

### Edição de série — controle de parcelamento removido
- **Status**: 🔄 Corrigido
- **Data**: 2026-06-02
- **Contexto**: Ao editar um lançamento já parcelado, o formulário mostrava controles de parcelamento como se a parcela fosse ser re-parcelada. `ccRecurrenceType` era setado como `'parcelado'` via `populateEdit`.
- **Solução**: `populateEdit` mantém `ccRecurrenceType = 'avulso'` quando `editingTx.parentId` existe. Badge "Parcela X/Y da série original" substitui os botões de tipo de recorrência em ambos os blocos (cartão e conta).

### Calculadora — separador decimal brasileiro
- **Status**: 🔄 Corrigido
- **Data**: 2026-06-02
- **Contexto**: `CalcPopover` removia vírgulas no sanitizador, tratando `1.250,50` como `125050`.
- **Solução**: Normalizador adicionado: se há vírgula → remove pontos (milhar), troca vírgula por ponto. Ex: `1.250,50` → `1250.50`. Se não há vírgula, mantém formato original (ponto como decimal).

### Recorrência — novas frequências + label consistente
- **Status**: 🔄 Corrigido
- **Data**: 2026-06-02
- **Contexto**: Select de frequência só tinha mensal/semanal/anual. Botão de cartão usava "FIXO" enquanto conta usava "RECORRENTE".
- **Solução**: Adicionadas `bimestral` (6×), `trimestral` (4×), `semestral` (2×). Botão "FIXO" → "RECORRENTE". Helper `getRecurrenceParams(frequency)` extraído para unificar cálculo de iterations + advanceDate nos 4 pontos de uso.

### Display de centavos — valor da parcela corrigido
- **Status**: 🔄 Corrigido
- **Data**: 2026-06-02
- **Contexto**: Dropdown "Diferença de Centavos" alterava a distribuição mas o display "Valor Parcela" ignorava `remainderPosition`, sempre mostrando o base.
- **Solução**: Display agora usa `getInstallmentAmount(0, formData.remainderPosition, ...)` em ambos os blocos (cartão e conta).

### Recálculo de saldo — funções quebradas removidas/corrigidas
- **Status**: 🔄 Corrigido
- **Data**: 2026-06-02
- **Contexto**: `Accounts.recalculateBalances` processava só transações NÃO-pagas com sinais invertidos; `Audit.handleRecalculateBalance` incluía pendentes e sobrescrevia saldo com zero; `Accounts.handleReset` não recriava batch após commit.
- **Solução**:
  - `recalculateBalances` removido junto com o botão "Recalcular Saldos"
  - `handleRecalculateBalance` agora filtra `isEffectivelyPaid` antes do cálculo
  - `handleReset` recria `writeBatch` após cada `commit()` e filtra só transferências pagas para reversão

### EDIT — sinal de reversão do oldEffect corrigido (+ → -)
- **Status**: 🔄 Corrigido
- **Data**: 2026-06-03
- **Contexto**: Saldos de contas corrente apresentavam valores irreais (R$-426k, R$-271k, R$-609k). Extrato mostrava lançamentos corretos mas saldo acumulado impossível.
- **Causa Raiz**: `handleEditSubmit:726` usava `+ getBalanceChange(oldT.type, oldT.amount)` para reverter o efeito antigo. `getBalanceChange` já retorna o valor com sinal (ex: `-6000` para despesa). Somar `-6000` debita novamente em vez de estornar. A cada edição de um lançamento, o saldo despencava no valor do lançamento.
- **Solução**: Trocado `+` por `-` na linha 726. Agora `-(-6000) = +6000` → estorna corretamente.
- **Recuperação**: Adicionado botão "Ajustar Saldo" (Wallet) em cada card de conta para conciliação manual. Script `fixBalances` removido posteriormente em favor do ajuste manual. Campo `initialBalance` adicionado ao schema Account para preservar saldo inicial em futuras correções automáticas.

### Conciliação manual de saldo — botão Wallet
- **Status**: ✅ Implementado
- **Data**: 2026-06-03
- **Contexto**: Saldos corrompidos pelo bug de sinal no EDIT precisavam ser corrigidos. Usuário sem conhecimento técnico para editar Firestore diretamente.
- **Solução**: Botão `Wallet` em cada card de conta na tela Contas. Abre dialog com MoneyInput pré-preenchido com saldo atual. Usuário informa saldo real do extrato bancário. `runTransaction` atualiza o balance atomicamente.
- **Observação**: Botão "Corrigir Saldos" (fixBalances automatizado) removido após constatação de que o script ignorava saldo inicial e requeria schema change.

### Coluna Saldo nos Lançamentos — 3 correções acumuladas
- **Status**: 🔄 Corrigido
- **Data**: 2026-06-03
- **Contexto**: Coluna de saldo corrente (running balance) na tela Lançamentos apresentava valores irreais mesmo após ajuste manual do saldo.
- **Correção 1 — Filtro isEffectivelyPaid**: O cálculo incluía transações `pendente` ao reverter o histórico. Como pendentes nunca afetam saldo, a reversão criava variação artificial. Adicionado `isEffectivelyPaid(t)` ao filtro `accountTransactions`.
- **Correção 2 — Ordenação determinística**: Transações na mesma data tinham ordem aleatória no cálculo e no display, produzindo valores diferentes a cada render. Adicionado `createdAt` como tiebreaker em ambos os sorts.
- **Correção 3 — onSnapshot individual**: O `useMemo` dependia de `accounts.find()` do snapshot da coleção, que não refletia atualizações do Wallet. Substituído por `onSnapshot(doc(db, 'accounts', id))` — listener individual e reativo do documento da conta.

### Cartões removidos do filtro na tela Lançamentos
- **Status**: 🔄 Corrigido
- **Data**: 2026-06-03
- **Contexto**: Tela Lançamentos listava cartões de crédito no dropdown de filtro e exibia compras de cartão na listagem, contrariando decisão de arquitetura (Transactions = extrato bancário).
- **Solução**: Removido grupo "Cartões de Crédito" do Select de filtro. Adicionado `!t.creditCardId` ao filtro principal da listagem. Pagamentos de fatura (transferências) continuam aparecendo.

### Dropdowns react-select sem contraste no dark mode
- **Status**: 🔄 Corrigido
- **Data**: 2026-06-03
- **Contexto**: Selects de Conta/Cartão, Destino e Tags no TransactionDialog usavam cores fixas (`rgb(249 250 251)`, `white`, `#94a3b8`) que não se adaptavam ao dark mode.
- **Solução**: Substituídas por variáveis CSS do tema: `hsl(var(--muted))` para fundo, `hsl(var(--muted-foreground))` para texto.

### Gradiente dos cards de resumo no dark mode
- **Status**: 🔄 Corrigido
- **Data**: 2026-06-03
- **Contexto**: Cards de Receitas, Despesas e Saldo do Período tinham gradiente claro que vazava no dark mode, impedindo leitura.
- **Solução**: Em dark mode, gradiente substituído por fundo sólido (`dark:bg-none dark:bg-surface`). Cores fiducia nos textos mantêm contraste.

### Dashboard — KPIs de receitas, despesas e Disponível Seguro
- **Status**: 🔄 Corrigido
- **Data**: 2026-06-04
- **Contexto**: Cards Receitas do Mês e Despesas do Mês incluíam transações de cartão de crédito e transferências, distorcendo os valores. Disponível Seguro não considerava receitas a receber, subestimando a previsão de caixa.
- **Causa Raiz**: `monthlyIncome`/`monthlyExpense` filtravam apenas por tipo e `isEffectivelyPaid`, sem excluir cartão ou transferência. `disponivelSeguro` calculava apenas `saldo - gastosCartao - contasPendentes`.
- **Solução**:
  - `monthlyIncome`: adicionado `!t.creditCardId`, `!creditCards.some(c => c.id === t.accountId)`, `t.type !== 'transferencia'/'transfer'`
  - `monthlyExpense`: mesmos filtros
  - `disponivelSeguro`: nova fórmula `= saldoCirculante + receitasPendentes − gastosCartao − contasPendentes`
  - Breakdown UI: nova linha "Receitas a Receber" (+ verde)
  - Tooltip atualizado com fórmula completa
  - **Gráfico Fluxo de Caixa**: mesmos guards aplicados nas 4 entradas de income/expense (visões semanal e mensal/anual)

### Gráfico Fluxo de Caixa — toggle "Considerar movimentações não pagas"
- **Status**: ✅ Implementado
- **Data**: 2026-06-04
- **Contexto**: Usuário queria visualizar no gráfico tanto transações realizadas quanto pendentes a vencer/receber, para ter uma visão mais completa do fluxo de caixa futuro.
- **Solução**: Botão toggle no cabeçalho do card "Fluxo de Caixa". Quando ativado (`showPendingChart`), as 4 entradas do gráfico passam a incluir também transações com status `pendente`/`pending`, além das `pago`/`realizado`.

---

## 💡 Padrões Descobertos

### Navegação com state + edição automática
- **Data**: 2026-05-26
- **Padrão**: Dashboard navega para Transactions com `navigate('/transactions', { state: { editId } })`. Transactions detecta via `useLocation().state?.editId` e chama `openEdit(tx)` automaticamente.
- **Limpeza**: `window.history.replaceState({}, '')` no useEffect para evitar reabertura ao navegar de volta.
- **Cuidado**: Só executa quando `transactions.length > 0` (dados carregados) para evitar race condition com snapshot do Firestore.

### Funções utilitárias compartilhadas → lib/utils.ts
- **Data**: 2026-06-02
- **Padrão**: Toda função utilitária usada por 2+ arquivos deve ser exportada de `lib/utils.ts`. Exemplos: `isEffectivelyPaid`, `isPeriodClosed`, `formatCurrency`, `resolveAccountName`, `calculateInvoicePeriod`.
- **Assinatura de `isPeriodClosed`**: Recebe os arrays de lookup como parâmetros (`creditCards`, `invoices`, `closedPeriods`) em vez de acessar estado do componente. Isso permite uso em qualquer contexto.
- **Cuidado**: `CreditCards.tsx` usa `cards` (não `creditCards`) como nome de estado — mapear no call site.

### Conversão avulso→parcelado — early return no handleEditSubmit
- **Data**: 2026-06-02
- **Padrão**: Detecção de mudança de tipo de recorrência ANTES dos caminhos existentes, com `return` após executar. Evita que o código de update normal processe a conversão incorretamente.
- **Cuidado**: Sempre chamar `close()` e `resetForm()` antes do `return`. Usar `toast.success()` com mensagem específica ("Convertido para N parcelas") para distinguir de update normal.

---

## 📋 Decisões de Arquitetura

- **Atomicidade total**: CREATE, EDIT, DELETE, IMPORT — todos os fluxos de saldo agora usam `runTransaction` como única operação atômica.
- **Saldo editável só na criação**: Ao criar conta, `balance` é definido. Nunca mais deve ser editado diretamente — apenas via transações.
- **Reversão de série**: Para séries recorrentes/parcelado, a reversão de saldo no DELETE deve ser contada 1× por `parentId`, não por transação individual.

### Saldo da conta reflete apenas transações pagas
- **Escolha**: Transações com status `pendente` ou `cancelado` não alteram o saldo da conta. Apenas `pago`/`realizado`/`paid` afetam o saldo.
- **Alternativas rejeitadas**: (1) Debitar pendências e usar Disponível Seguro para contabilizar — rejeitado porque polui o saldo real. (2) Debitar tudo e estornar ao cancelar — rejeitado por complexidade.
- **Data**: 2026-05-28
- **Impacto**: CREATE, EDIT, DELETE, Quick Confirm — todos os 4 fluxos de balanço foram alterados.

### Transactions page = extrato bancário; Cartão fica na tela Cartões
- **Escolha**: A tela Lançamentos mostra apenas transações de contas corrente (não-cartão). Compras de cartão são visíveis apenas na tela Cartões de Crédito e no Dashboard (consolidado).
- **Alternativas rejeitadas**: (1) Mostrar tudo com filtro toggle — rejeitado porque o usuário quer o extrato limpo. (2) Separar por abas — rejeitado por simplicidade.
- **Data**: 2026-05-28
- **Observação**: Pagamento de fatura continua aparecendo no Transactions (é uma saída da conta corrente). O ícone deve ser de pagamento, não de transferência genérica.

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
- **Prevenção**: Sempre chamar `toast.error()` PRIMEIRO, depois `handleFirestoreError()`.

### Ordem `runTransaction` — reads depois de writes
- **Data**: 2026-05-27 (confirmado 2026-05-28)
- **Problema**: Firestore exige que TODOS os `transaction.get()` sejam executados antes de qualquer `transaction.set()`/`transaction.update()`/`transaction.delete()`. Violação causa erro silencioso.
- **Prevenção**: Sempre coletar todos os snapshots primeiro em um loop, depois aplicar as escritas em um segundo loop.

### EDIT — sinal do delta de balance é contra-intuitivo
- **Data**: 2026-05-28
- **Problema**: No EDIT, o "reverse old" deve somar o efeito antigo (`+ oldEffect`), não subtrair (`- oldEffect`). E o "apply new" deve usar o mesmo sinal do CREATE (`type === 'receita' ? amount : -amount`), e não o inverso.
- **Sintoma**: Editar valor de uma transação produzia saldo incorreto (especialmente ao mudar de expense para income ou vice-versa).
- **Prevenção**: Sempre verificar a convenção de sinal do CREATE antes de escrever reversões. Usar a helper `getBalanceChange()` unificada.

### Parcelado: CREATE aplica balance no total da série, DELETE precisa saber disso
- **Data**: 2026-05-28
- **Problema**: CREATE parcelado aplica o balance UMA VEZ com o total da série. DELETE precisa reverter apenas esse total (antes: soma de todos os installment amounts). Se um único installment for deletado (não a série toda), o DELETE não deve alterar balance.
- **Prevenção**: Tratar séries parceladas como grupos atômicos para fins de balance — só a 1ª parcela afeta o saldo.

### `allow update: false;` não é CEL válido — API retorna 400 sem mensagem útil
- **Data**: 2026-05-27
- **Problema**: `allow update: false;` em Firestore rules causa `400 INVALID_ARGUMENT` — a API não indica qual é o erro de sintaxe.
- **Sintoma**: POST `/rulesets` retorna 400 com mensagem genérica "Request contains an invalid argument." Mesmo logs detalhados do Google não mostram o erro real.
- **Prevenção**: Sempre usar `allow <op>: if <expressão>;`. O `if` é obrigatório mesmo para literais booleanos. Incrementar mudanças uma a uma via API para isolar o erro.
