# Changelog — Fiducia

> Histórico permanente de releases, organizado por versão e data.
> **LLM:** deepseek-v4-pro | **Agente:** opencode

---

## [0.4.1] — 2026-07-07 — Ordenação Alternável + Busca Aprimorada em Lançamentos

**Resultado:** Tela de lançamentos agora permite alternar a ordem cronológica (mais recentes primeiro ou mais antigos primeiro). Barra de busca aceita valores monetários no formato brasileiro (vírgula decimal, ponto de milhar).

**Alterações técnicas:**
- `src/pages/Transactions.tsx` — **+25 linhas.** Estado `sortOrder` (`'desc'` | `'asc'`) com toggle via botão `ArrowUpDown` na barra de filtros; 3 pontos de sort (AI search, processedTransactions, groupKeys) respeitam a direção; função `amountMatchesSearch()` com 4 representações textuais (toString, toFixed(2), Intl.NumberFormat pt-BR com e sem agrupamento) + parse reverso do termo para comparação numérica com tolerância; coluna de ordenação (`sortOrder`) adicionada às dependências do `processedTransactions` memo

**Correções e causa-raiz:**
- **Busca por "15,00" ou "3.416" falhava**: `amount.toString()` nunca produz vírgula nem separador de milhar. Solução: gerar múltiplas representações textuais do valor e também tentar interpretar o termo como número (removendo pontos de milhar, convertendo vírgula para ponto decimal).

**Validações:**
- `npm run lint` — Sem erros
- `npm run test` — 31/34 passando (3 falhas pré-existentes em `financialInsight.test.ts`)
- `npm run build` — Build OK

## [0.4.0] — 2026-07-06 — Evolução da Previsão de Caixa + Correções Documentais

**Resultado:** Motor de projeção de caixa estendido com regras de recorrência (`recurrenceRules`), três cenários de projeção (conservador/realista/projetado), métrica de dias em risco (`daysAtRisk`), visão diária expandível e seção de dias críticos. Documentação corrigida (Gemini→Groq, status de docs desatualizados).

**Alterações técnicas:**
- `src/lib/cashCoverage.ts` — **+80 linhas.** Adicionado parâmetro `recurrenceRules?: any[]` ao `buildCashCoverageProjection()`; geração de eventos futuros a partir de regras ativas (`status: 'active'`) com controle de não-duplicação (match por `parentId`); tipo `CashCoverageScenario` (`'conservative' | 'realistic' | 'projected'`); opção `scenario` em `CashCoverageOptions` (default `'realistic'`); filtro de eventos por `certainty` antes da simulação diária; métrica `daysAtRisk: number` no retorno
- `src/lib/cashCoverage.test.ts` — 5/5 testes passando (compatível com novas opções)
- `src/lib/utils.ts` — `projectDailyBalance()` atualizado: aceita `recurrenceRules`, usa `scenario: 'conservative'` para Dashboard (segurança)
- `src/lib/financialInsight.ts` — `FinancialInsightParams` aceita `recurrenceRules`; repassado ao `buildCashCoverageProjection()`
- `src/pages/Reports.tsx` — **+120 linhas.** Snapshot `recurrenceRules` via Firestore `onSnapshot`; estado `projScenario` com seletor de cenário (Conservador/Realista/Projetado); seletor renderizado na aba Projeção Futura; métrica `daysAtRisk` no KPI de risco; toggle "Visão Diária" com tabela colorida (vermelho/âmbar/verde por faixa de saldo); seção "Dias Críticos" com top 5 piores dias; PDF botão movido para linha de cenários
- `src/pages/Dashboard.tsx` — Snapshot `recurrenceRules`; `projectDailyBalance()` agora recebe `recurrenceRules` e usa cenário conservador; alerta "X dias com saldo negativo nos próximos 90 dias" no KPI de Cobertura
- `docs/LOGICA_DO_SISTEMA.md` — 4 correções: "Gemini API" → "Groq API" (linhas 7, 50, 75, 76)
- `docs/ia-conciliacao-inteligente.md` — Adicionado header `STATUS: IMPLEMENTADO em v0.3.x`
- `docs/plano-de-melhorias.md` — Adicionado header `STATUS: Parcialmente resolvido` com data de revisão
- `docs/plano-evolucao-previsao-caixa.md` — **Criado.** Especificação técnica completa da evolução
- `package.json`, `src/lib/utils.ts` — Versão `0.4.0`

**Regra de cenários:**

| Cenário | Filtro `certainty` | Uso |
|---------|-------------------|-----|
| Conservador | Só `confirmed` | Dashboard (segurança) |
| Realista | `confirmed` + `expected` | Reports (default) |
| Projetado | Todos | Reports (visão completa com recorrências) |

**Arquivos modificados:** 12 arquivos.

## [0.3.4] — 2026-07-06 — Reformulação Completa do Dark Mode

**Resultado:** Sistema agora possui dark mode unificado com paleta navy profundo (inspirada no degrade emerald/cyan/blue da logo). Bordas visíveis, contraste WCAG AA garantido em todos os textos, todas as telas corrigidas.

**Alterações técnicas:**
- `src/index.css` — Bloco `.dark` inteiramente refatorado: paleta navy profundo (`#0a101c` / `#131c2e` / `#1c2944`), `--border-color` ≠ `--surface2` (bordas agora visíveis), textos com contraste mínimo 4.5:1 sobre superfícies, ring/sidebar-primary usam `--fiducia-blue`
- `src/pages/CreditCards.tsx` — 18 correções: `bg-white` → `bg-card`/`bg-background` em formulários, cards de fatura, tabelas, toggles e ícones; `text-white` → `dark:text-background` em botões; `hover:bg-white` → `hover:bg-card dark:hover:bg-surface2`
- `src/pages/Reconciliation.tsx` — 3 correções: `hover:text-red-500`/`hover:text-blue-500` ganharam `dark:hover:text-red-400`/`dark:hover:text-blue-400`; ícone do gradiente AI ganhou `dark:text-[#0a101c]`
- `src/pages/Reports.tsx` — 5 correções: badges `text-white` → `dark:text-background` (3×); ícone AI `dark:text-[#0a101c]`; botão "Gerar Análise" `dark:text-background`
- `src/pages/Audit.tsx` — 2 correções: inputs `bg-white` → `bg-background dark:bg-input/30 text-foreground`
- `src/pages/Categories.tsx` — Seletor de ícone ativo: `dark:bg-fiducia-blue/20 dark:text-fiducia-blue`
- `src/pages/Accounts.tsx` — 2 botões `text-white` → `dark:text-background`
- `src/pages/Dashboard.tsx` — 2 ícones no gradiente AI: `dark:text-[#0a101c]`
- `src/pages/Login.tsx` — Gradiente de fundo `dark:from-gray-950` → `dark:from-[#0a101c] dark:via-[#0c1524] dark:to-[#0e1a2e]`
- `src/components/TransactionDialog.tsx` — **Atenção especial aos modais:** status toggles (pago/pendente) com `dark:bg-*-500/20 dark:text-*-400`; botões de submit com `text-white dark:text-background` e versões mais claras em dark (`dark:bg-red-500`/`dark:bg-green-500`/`dark:bg-blue-500`); borda `border-gray-50` → `border-border`
- `src/components/ConfirmDialog.tsx` — Botão destrutivo `dark:bg-red-600 dark:hover:bg-red-500`; botão não-destrutivo `dark:text-primary-foreground` (corrige texto branco sobre fundo claro)
- `src/components/PdfImportReviewDialog.tsx` — Ícone gradiente `dark:from-violet-400 dark:to-indigo-500 dark:text-violet-950`; botão importar `dark:text-background`
- `src/components/Layout.tsx` — 2 badges com `dark:bg-background/30 dark:text-foreground` em links ativos
- `src/components/ui/sonner.tsx` — `theme="light"` → `theme="system"` (notificações agora respeitam o tema)
- `package.json`, `src/lib/utils.ts` — Versão `0.3.4`

**Nova paleta dark mode:**

| Variável | Antes | Depois |
|----------|-------|--------|
| `--bg` | `#0f172a` (slate-900) | `#0a101c` (navy profundo) |
| `--surface` | `#1e293b` (slate-800) | `#131c2e` |
| `--surface2` | `#334155` (slate-700) | `#1c2944` |
| `--border-color` | `#334155` (= surface2) | `#2d3d5c` (visível) |
| `--text-primary` | `#f8fafc` | `#ecf0f5` |
| `--text-secondary` | `#cbd5e1` | `#9badc1` |
| `--text-muted` | `#cbd5e1` | `#6e829b` |
| `--ring` | `--text-primary` | `--fiducia-blue` |
| `--sidebar-primary` | `--text-primary` | `--fiducia-blue` |

**Arquivos modificados:** 14 arquivos, ~65 pontos de correção.

## [0.3.3] — 2026-07-06 — Exportação de PDF Estruturada + Correções no Modal de Cartão

**Resultado:** Sistema agora gera PDFs estruturados para relatórios (5 abas), extratos de conta e faturas de cartão de crédito, substituindo o `window.print()` anterior. Modal de cartão de crédito corrigido: campos Observação e Tags agora acessíveis, seletor de Diferença de Centavos adicionado ao parcelamento de cartão, e diálogo "Nova Categoria" permite selecionar categoria pai.

**Alterações técnicas:**
- `package.json` — Adicionados `jspdf` e `jspdf-autotable` (lazy-loaded via `import()`)
- `src/lib/pdfFormatUtils.ts` — **Novo.** Formatadores pt-BR (`fmtMoneyPDF`, `fmtDatePDF`, `fmtMonthYear`), gerador de nome de arquivo padronizado, constantes de margem
- `src/services/pdfExportService.ts` — **Novo.** Serviço base: `createPdf()` (jsPDF A4), `addTable()` (autotable com quebra de página), `savePdf()`, lazy-loading das bibliotecas
- `src/lib/pdfTemplates.ts` — **Novo.** 7 templates: fluxo de caixa, categorias, tendência/orçamento, projeção futura, análise de faturas, extrato de conta, fatura de cartão
- `src/pages/Reports.tsx` — 5 botões "Exportar PDF" (um por aba de dados); import `FileDown` + handlers lazy
- `src/pages/Transactions.tsx` — Botão "Exportar PDF" (extrato) respeitando filtros ativos (conta, período, categoria)
- `src/pages/CreditCards.tsx` — `window.print()` substituído por `generateCreditCardInvoicePDF()` com cabeçalho, grupos visuais e status da fatura
- `src/components/TransactionDialog.tsx` — 3 correções: barra de ícones não esconde Observação/Tags para cartão (`!isCreditCard` removido); `remainderPosition` no parcelamento de cartão; diálogo "Nova Categoria" com seletor de Categoria Pai + Tipo
- `package.json`, `src/lib/utils.ts` — Versão `0.3.3`

**Documentos contemplados na exportação PDF:**
| Documento | Cabeçalho | KPIs | Tabela | Totais | Paginação | Rodapé | Grupos Visuais |
|-----------|-----------|------|--------|--------|-----------|--------|----------------|
| Relatório Fluxo de Caixa | Sim | Sim | Sim | Sim | Sim | Sim | — |
| Relatório Categorias | Sim | Sim | Sim | — | Sim | Sim | — |
| Relatório Tendência/Orçamento | Sim | Sim | Sim | — | Sim | Sim | — |
| Relatório Projeção Futura | Sim | Sim | Sim | — | Sim | Sim | — |
| Relatório Faturas de Cartão | Sim | Sim | Sim | — | Sim | Sim | — |
| Extrato de Conta | Sim | Sim | Sim | Sim | Sim | Sim | — |
| Fatura de Cartão | Sim | Sim | Sim | Sim | Sim | Sim | Sim |

**Correções e causa-raiz:**
- **Sem Observação/Tags no cartão**: Barra de ícones condicionada a `!isCreditCard` ocultava todos os toggles. Solução: mover condição para cada botão individualmente; Recorrência permanece oculta no cartão (já expandida por padrão), Observação e Tags visíveis em ambos.
- **Sem `remainderPosition` no parcelado de cartão**: O bloco de "Diferença de Centavos" só existia no modal bancário. Solução: replicar o seletor no bloco `isCreditCard` do parcelamento.
- **Sem Categoria Pai na criação rápida**: Diálogo "Nova Categoria" do modal de lançamento tinha apenas campo Nome. Solução: adicionar `<Select>` de parentId com filtro por tipo + seletor de tipo (Despesa/Receita) no modal bancário.

**Validações:**
- `npm run lint` — Sem erros
- `npm run test` — 31/34 passando (3 falhas pré-existentes em `financialInsight.test.ts`)
- `npm run build` — Build OK (jsPDF + autotable code-split: ~420KB lazy-loaded, não afeta bundle inicial)

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
