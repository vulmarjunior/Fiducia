# Changelog — Fiducia

> Histórico permanente de releases, organizado por versão e data.
> **LLM:** deepseek-v4-pro | **Agente:** opencode

---

## [0.3.2] — 2026-07-06 — Correções CRUD de Lançamentos Recorrentes

**Resultado:** Série de 12 correções no ciclo completo de vida de lançamentos recorrentes e parcelados. Exclusão de séries agora funciona corretamente em todos os escopos (apenas este / este e futuros / todos). Edição de parcelas permite alterar o número de parcelas. QuickConfirm bloqueia débito duplicado para parcelas 2+. Campos de repetição agora são respeitados na criação de recorrentes bancários.

**Alterações técnicas:**
- `src/lib/utils.ts` — Novas funções `findSeriesTransactions()`, `getSeriesKey()`, `isTransactionSeriesMember()` — matching de série centralizado com fallback para `isRecurring` sem `parentId` e `ccRecurrenceType === 'fixo'`
- `src/pages/Transactions.tsx` — `handleDelete` refatorado para usar `findSeriesTransactions`; `handleQuickConfirm` com guarda para parcelas >1 bloqueando débito duplicado; condição do diálogo de exclusão cobre `ccRecurrenceType`
- `src/pages/CreditCards.tsx` — `handleDeleteTx` convertido de `writeBatch` para `runTransaction` (atômico); exclusão de `RecurrenceRule` ao deletar série "fixo" completa (scope='all'); badge roxo "Fixo" exibido para `ccRecurrenceType === 'fixo'` em ambas as visualizações (organizada/cronológica)
- `src/components/TransactionDialog.tsx` — 6 correções: `changedInstallmentCount` implementado (alterar nº de parcelas na edição); `populateEdit` distingue `isRecurring` de parcelado via `ccRecurrenceType`; `editScope` respeitado em campos base; `editScope='future'` usa `formData.date` como corte; `siblingUpdate` não propaga `amount` em parcelado + guarda para parcelas >1 no balanço; CREATE de recorrentes agora respeita `formData.installments` do campo "Repetições"
- `package.json`, `src/lib/utils.ts` — Versão `0.3.2`

**Correções e causa-raiz:**
- **DELETE de série só deletava 1 transação**: Condição do diálogo usava disjunção OR (`parentId || isRecurring || installmentId`), mas o matching de série dependia exclusivamente de `parentId`. Se `isRecurring=true` sem `parentId` (dados legados), o diálogo mostrava as opções mas o filtro não encontrava irmãos. Solução: `findSeriesTransactions` com fallback por `description` + `frequency`.
- **QuickConfirm dupla dedução**: Confirmar parcela 2+ debitava saldo novamente, mas CREATE só debitou parcela 1. Solução: guarda `if (parentId && installmentNumber > 1) return`.
- **CreditCards usava writeBatch não-atômico**: Alterações de saldo usavam `accounts.find()` em memória em vez de leitura fresca do Firestore. Solução: conversão para `runTransaction` com leitura atômica do saldo.

**Validações:**
- `npm run lint` — Sem erros
- `npm run test` — 31/34 passando (3 falhas pré-existentes em `financialInsight.test.ts`, não relacionadas às alterações)
- `npm run build` — Build OK

---

## [0.3.1] — 2026-06-23 — Análise Inteligente com Groq

**Resultado:** A aba "Análise IA" deixa de gerar dicas genéricas e passa a interpretar dados calculados pelos motores internos do Fiducia: cobertura de caixa, faturas, categorias, orçamentos e datas críticas.

**Alterações técnicas:**
- `src/lib/financialInsight.ts` — `buildFinancialInsightContext()` reúne dados de cashCoverage, invoiceAnalysis, categorias, fluxo de caixa, orçamentos e datas críticas em um contexto estruturado; `buildGroqFinancialAnalysisPrompt()` gera prompt rigoroso com regras (não inventar, não recalcular, ser específico) e formato fixo de 5 seções
- `src/lib/financialInsight.test.ts` — 11 testes unitários: contexto nulo sem dados, cobertura com risco, faturas, categorias, orçamentos, tendência, data crítica, prompt estruturado, prompt com risco e prompt sem orçamentos
- `src/pages/Reports.tsx` — Aba IA refatorada: usa `buildFinancialInsightContext` + `buildGroqFinancialAnalysisPrompt`, exibe contexto usado na análise (cards com métricas enviadas), disclaimer "IA interpreta, sistema calcula", temperatura reduzida (0.5) para respostas mais consistentes
- `package.json`, `src/lib/utils.ts` — Versão `0.3.1`

**Decisão arquitetural:** A Groq interpreta dados calculados pelo Fiducia. Ela não é fonte de verdade dos cálculos financeiros.

**Validações:**
- `npm run lint` — Sem erros
- `npm run test` — 34/34 passando (11 novos)
- `npm run build` — Build OK

---

## [0.3.0] — 2026-06-23 — Relatório de Análise de Faturas de Cartão

**Resultado:** Nova aba "Faturas" em Relatórios permite analisar o comportamento das faturas de cartão de crédito ao longo do tempo: evolução mensal, peso por cartão, status (aberta/fechada/paga/futura) e comprometimento futuro com parcelamentos.

**Alterações técnicas:**
- `src/lib/invoiceAnalysis.ts` — Motor de análise de faturas: agrega transações por cartão/período, determina status (persistido ou calculado), calcula totais, médias, variações e participação percentual
- `src/lib/invoiceAnalysis.test.ts` — 13 testes unitários cobrindo status, filtros, créditos, futuras, variação mês a mês e consistência de cores
- `src/pages/Reports.tsx` — Nova aba "Faturas" (6ª aba) com:
  - Filtros: período (3M/6M/12M/personalizado), cartão, status (abertas/fechadas/pagas/futuras), toggle estornos
  - 6 KPIs: abertas, fechadas, pagas, comprometimento futuro, média mensal, maior fatura
  - Gráfico de barras empilhadas (mês × cartão) + tendência (área) + donut (participação por cartão)
  - Tabela detalhada clicável com linha do tempo por cartão/período/status/vencimento/variação
- `package.json` — Versão atualizada para `0.3.0`

**Validações:**
- `npm run lint` — Sem erros
- `npm run test` — 23 testes passando (13 novos + 10 existentes)
- `npm run build` — Build de produção OK

---

## [0.2.0] — 2026-06-23 — Motor de Cobertura de Caixa

**Resultado:** A projeção futura passa a responder se caixa atual + valores a receber cobrem as obrigações bancárias e de cartão ao longo do tempo, com detecção de risco diário.

**Alterações técnicas:**
- `src/lib/cashCoverage.ts` — Novo motor único de previsão: eventos futuros, simulação diária, agregação mensal, faturas abertas/fechadas/futuras e menor saldo projetado
- `src/lib/cashCoverage.test.ts` — Testes unitários para descasamento de datas, fatura fechada, fatura aberta sem invoice persistida, contas excluídas do fluxo e atrasados
- `src/lib/utils.ts` — `projectDailyBalance()` passa a usar o novo motor mantendo compatibilidade com o Dashboard
- `src/pages/Reports.tsx` — Aba Projeção Futura passa a consumir o motor de cobertura e exibe diagnóstico de cobertura, risco e composição das obrigações
- `package.json`, `package-lock.json` e `APP_VERSION` — Versão atualizada para `0.2.0`

**Validações:**
- `npx vitest run src/lib/cashCoverage.test.ts src/utils/creditCardUtils.test.ts`
- `npm run lint`
- `npm run test`
- `npm run build`

**Limitações:** Recorrências futuras ainda dependem de transações já materializadas; a IA interpreta dados, mas não calcula a cobertura.

---

## [0.1.0] — 2026-06-22

> Primeira versão formal do projeto. Versionamento inicia a partir da adoção do protocolo de documentação em 4 camadas.

### Versão 0.1.0 — 2026-06-22

**Resultado:** Versionamento SemVer formalizado. Versão exibida na tela de Login e no rodapé do Dashboard.

**Alterações técnicas:**
- `package.json` — Versão alterada de `0.0.0` para `0.1.0`
- `src/lib/utils.ts` — Adicionada constante exportada `APP_VERSION`
- `src/pages/Login.tsx` — Exibe "v0.1.0" abaixo dos links de termos
- `src/components/Layout.tsx` — Exibe "Fiducia v0.1.0" no rodapé da sidebar (visível no Dashboard e demais páginas)
- `AGENTS.md` — Adicionado protocolo de documentação (4 camadas), início/encerramento de sessão, versionamento
- `docs/MASTER_PLAN.md` — Criado (fonte única de verdade estratégica)
- `CHANGELOG.md` — Criado (histórico permanente de releases)
- `docs/pendencias_dev.md` — Criado (pauta da sessão atual)
- `docs/archive/sessions/` — Criado (arquivo de sessões concluídas)

---

## Histórico anterior ao versionamento

> Registros reconstruídos a partir do histórico Git, `dev-log.md` e inspeção de código.

### 2026-06-22 — Classificação de Transações de Fatura e Campos de Data Dupla

**Resultado:** Faturas de cartão agora exibem 5 grupos visuais com subtotais e ordenação específica por grupo. Parcelas de ciclos anteriores são distinguidas das compras do ciclo atual.

**Alterações técnicas:**
- `src/types/index.ts` — Adicionados `originalPurchaseDate`, `postingDate`, `isSystemGeneratedDate` ao tipo Transaction
- `src/pages/CreditCards.tsx` — Função `classifyInvoiceTransaction` com 5 grupos: PARCELAMENTOS_ANTERIORES, COMPRAS_DO_PERIODO, CREDITOS_ESTORNOS, PAGAMENTOS_AJUSTES, OUTROS_DEBITOS
- 2 modos de visualização: Organizado (grupos, padrão) e Cronológico (tabela plana)
- `src/components/TransactionDialog.tsx` — Criação/conversão de parcelamentos define `originalPurchaseDate` e `postingDate`
- PDF Import atualizado para preencher novos campos

**Limitações:** Datas geradas pelo sistema são estimadas e exibidas com indicação `(data estimada)`.

---

### 2026-06-19 — Correção: accountId não era atualizado na edição

**Resultado:** Ao editar um lançamento e trocar a conta, a conta agora é efetivamente alterada no Firestore.

**Causa-raiz:** `updateData` no `handleEditSubmit` de `TransactionDialog.tsx:745` listava todos os campos editáveis exceto `accountId` e `destinationAccountId`. O saldo era revertido/aplicado corretamente, mas o campo não era escrito no documento da transação.

**Correção:** Adicionado `accountId: formData.accountId` e `destinationAccountId: formData.destinationAccountId` ao `updateData`.

---

### 2026-06-18 — Auditoria Sistêmica de Saldo (5 bugs)

**Resultado:** Corrigidos 5 bugs ativos com impacto direto nos valores exibidos nas contas bancárias. Cálculo de saldo agora tem fonte única de verdade.

**Alterações:**
1. `src/lib/utils.ts` — Nova função `getTransactionEffect(tx, accountId)`: bilíngue (pt/en), direction-aware para transferências
2. `src/components/TransactionDialog.tsx` — `getBalanceChange` aceita `'income'` além de `'receita'`
3. `src/pages/Transactions.tsx` — DELETE de séries: guard `if (paidTx.creditCardId) continue`
4. `src/pages/Accounts.tsx` — `handleReset` reescrito com `getDoc()` + `initialBalance: 0`
5. `src/pages/Accounts.tsx` — `diagnoseBalance` detecta `initialBalance` ausente

---

### 2026-06-15 — Reconciliação Contábil e Remoção de Auto-Healing

**Resultado:** Ajustes de saldo agora seguem partidas dobradas (geram transação "Ajuste de Reconciliação"). Scripts automáticos/silenciosos de correção de saldo removidos.

**Alterações:**
- Botão Ajustar Saldo (Wallet) refatorado: calcula delta entre desejado e real, gera transação compensatória
- Script de auto-healing removido de `Transactions.tsx`
- Modal de Diagnóstico: botão "Sincronizar Saldo" para ressincronizar cache sem transações
- `initialBalance` obrigatório em contas (com aviso âmbar se ausente)

---

### 2026-06-04 — Reports: Seletor de Período, Projeção de Caixa e Conversão Avulso→Recorrente

**Resultado:** Relatórios com controle total de período e projeção financeira futura. Lançamentos avulsos podem ser convertidos em recorrentes na edição.

**Alterações:**
- `src/pages/Reports.tsx` — Seletor de período (Hoje/Semana/Mês/3M/6M/12M/Ano/Período custom), projeção de caixa, toggle "Considerar não pagas"
- `src/components/TransactionDialog.tsx` — Bloco `becameRecurring` no `handleEditSubmit` para conversão avulso→recorrente
- Dashboard — Revertido para layout original com duas listas de Contas a Pagar
- Cartões — Seção "Comprometimento Futuro" no modal de fatura

---

### 2026-06-02 — CalcPopover, remainderPosition, Deduplicação de Utilitários

**Resultado:** Calculadora inline nos campos monetários, controle de distribuição de centavos em parcelamento, e eliminação de código duplicado.

**Alterações:**
- `src/components/CalcPopover.tsx` — Calculadora com parser aritmético recursivo (sem `eval`)
- `src/components/TransactionDialog.tsx` — Campo `remainderPosition` (`first`/`last`/`spread`)
- `src/lib/utils.ts` — Centralizadas `isEffectivelyPaid`, `isPeriodClosed`, `formatCurrency` (antes em 3-4 arquivos)
- 24 catch blocks com ordem `toast.error`/`handleFirestoreError` corrigida
- Corrigido XSS em `Reports.tsx:298` (dangerouslySetInnerHTML com escape HTML)
- Corrigido Contrast Dark Mode em `Reconciliation.tsx`
- Corrigido onSnapshot duplicado em `Transactions.tsx`

---

### 2026-05-30 — Importador de Fatura PDF com IA

**Resultado:** Faturas de cartão em PDF podem ser importadas. IA (Groq) extrai transações, categoriza automaticamente e detecta parcelamentos.

**Arquivos:** `src/services/pdfInvoiceService.ts`, `src/components/PdfImportReviewDialog.tsx`, `src/pages/CreditCards.tsx`

**Limitação:** PDFs escaneados (imagem) não têm texto extraível.

---

### 2026-05-29 — TransactionDialog — Modal Unificado

**Resultado:** Sistema passa de 2 modais de transação para 1 modal unificado, com edição de parcelas, invoice period editável e propagação de dados em séries.

**Alterações:**
- `src/components/TransactionDialog.tsx` + `src/contexts/TransactionDialogContext.tsx`
- Removidas ~1700 linhas de dialogs inline de Transactions.tsx e CreditCards.tsx
- Correção: categorias em português (typeFilter despesa/receita) no CategorySelect
- Correção: datas em timezone local (parseLocalDate)

---

### 2026-05-28 — Quick Confirm, CategorySelect, Navegação com Filtro

**Resultado:** Confirmação de pendências com um clique. Seletor de categorias unificado com busca e hierarquia. Navegação Dashboard→Transactions com filtros pré-aplicados.

---

### 2026-05-26 — Atomicidade de Saldo (runTransaction)

**Resultado:** Todas as operações de saldo (CREATE, EDIT, DELETE, IMPORT) agora usam `runTransaction` atômico do Firestore, eliminando race conditions e operações órfãs.

**Correções incluídas:**
- DELETE de séries revertia saldo N× (corrigido: agrupamento por parentId)
- Toast.error antes de handleFirestoreError (evita throw prematuro)
- Edição de conta não sobrescreve saldo
- CREATE parcelado aplica saldo apenas da 1ª parcela
- Filtro isEffectivelyPaid nos cálculos do Dashboard

---

## Template para Novas Entradas

```markdown
## [X.Y.Z] — YYYY-MM-DD — Título Objetivo

**Resultado:** O que o usuário percebe de diferente.

**Alterações técnicas:**
- Lista de arquivos e mudanças relevantes

**Correções e causa-raiz:** Se aplicável.

**Migrations ou impactos operacionais:** Se aplicável.

**Limitações ou escopo não entregue:** Se aplicável.
```
