# Sessão — Correção da Auditoria dos Relatórios v0.16.0

> **LLM:** deepseek-v4-pro | **Agente:** opencode

**Data:** 2026-09-02. **Base:** commit `46bf0f3`, versão `0.16.0`.

**Objetivo:** Corrigir os achados F1 a F8 da auditoria (`docs/archive/sessions/2026-09-02-auditoria-relatorios.md`), garantindo a aprovação do reprodutor independente (`docs/archive/sessions/2026-09-02-auditoria-relatorios.repro.ts`) e transformando os cenários reproduzidos em testes permanentes no Vitest.

**Resultado:**
1. **Pertinência por conta (F1):** `calculateStartingBalanceCents` e `buildAccountFlowReport` corrigidos para verificar pertinência estrita de cada transação à conta. Total consolidado e indicadores sincronizados com o último ponto do gráfico e com a identidade contábil.
2. **Identificação de faturas e agendamentos (F2):** Compras de cartão isoladas de agendamentos de pagamento em `invoiceEvents.ts`; pagamentos bancários oficiais associados à fatura via `paymentTransactionIds`; e suporte a compras de faturas ainda não materializadas em documento.
3. **Inclusão de pendentes (F3):** Quando `includePending === true`, `inflowCents`, `outflowCents`, `resultCents` e saldos incorporam pendências em cards, gráficos, tabelas e exportações. Quando inativo, pendências são estritamente excluídas do detalhamento.
4. **Data de abertura e conciliação (F4):** Contas abertas no futuro retornam saldo zero; contas abertas no período fornecem capital inicial na data de abertura; ausência de `initialBalance` retorna `isReconciled: false`; conferência com `account.balance` realizada a partir do somatório de transações realizadas.
5. **Detalhamento e sinais (F5):** `ReportDetailsDialog` passa a receber a prop `context`. Estornos e créditos de cartão subtraem do total em despesas e exibem sinal negativo; transferências bancárias exibem perspectiva correta de débito ou crédito.
6. **Seleção vazia (F6):** `originIds: []` retorna 0 contas e totais zerados.
7. **Obrigações e intervalos (F7):** Faturas residuais só deduzem com pendências ativas, respeitam o filtro de vencimento em `customRange` e não são atribuídas a seleções parciais de contas.
8. **Evolução mensal por fatura (F8):** `intervalType === 'month'` agrupa compras e créditos de cartão diretamente pela chave do mês da fatura (`invoicePeriod`).

**Validações:**
- Reprodutor independente: **21 verificações aprovadas, 0 divergências (Exit Code: 0)**.
- `npm run lint`: **0 erros** (`tsc --noEmit`).
- `npm run test -- --maxWorkers=1`: **20 arquivos de teste e 131 testes aprovados** (100% verde).
- `npm run build`: **Produção compilada com sucesso** via Vite 6.
- Verificação funcional no navegador em desktop (1440x900) e mobile (390x844).

**Versão mantida em:** `0.16.0` (sem alteração de versão ou deploy nesta etapa).

> **LLM:** deepseek-v4-pro | **Agente:** opencode
