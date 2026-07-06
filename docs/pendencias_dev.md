# Pendências de Desenvolvimento — Sessão Atual

> Documento efêmero da pauta atual. Ao concluir, transferir para `docs/archive/sessions/` e limpar este arquivo.
> **LLM:** deepseek-v4-pro | **Agente:** opencode

---

## Sessão: Correções CRUD de Lançamentos Recorrentes (v0.3.2)

### Resultado

12 correções no ciclo completo de vida (CREATE, READ, UPDATE, DELETE) de lançamentos recorrentes e parcelados, para contas bancárias, caixa e cartão de crédito. Matching de série centralizado em função utilitária `findSeriesTransactions` com fallback para dados legados sem `parentId`. QuickConfirm seguro. Edição de nº de parcelas funcional. RecurrenceRule cleanup. Badge "Fixo" no cartão.

### Arquivos tocados

| Arquivo | Ação |
|---------|------|
| `src/lib/utils.ts` | +60 linhas — `findSeriesTransactions()`, `getSeriesKey()`, `isTransactionSeriesMember()` |
| `src/pages/Transactions.tsx` | Refatorado `handleDelete` + fix `handleQuickConfirm` + condição diálogo |
| `src/pages/CreditCards.tsx` | Refatorado `handleDeleteTx` (`writeBatch`→`runTransaction`) + exclusão `RecurrenceRule` + badge "Fixo" |
| `src/components/TransactionDialog.tsx` | 6 correções: `changedInstallmentCount`, `populateEdit`, `editScope` base fields, `editScope='future'` data, `siblingUpdate` parcelado, CREATE `formData.installments` |
| `package.json` | Editado — v0.3.2 |
| `CHANGELOG.md` | Editado — entrada v0.3.2 |
| `docs/MASTER_PLAN.md` | Editado — versão, entregas, foco |
| `docs/pendencias_dev.md` | Este arquivo |

### Decisão arquitetural

> Matching de série de transações é responsabilidade da função centralizada `findSeriesTransactions()` em `lib/utils.ts`. Tanto Transactions quanto CreditCards delegam a ela. Fallbacks cobrem `isRecurring` sem `parentId` (legado) e `ccRecurrenceType === 'fixo'`.

> Apenas a primeira parcela de um parcelado afeta saldo bancário. QuickConfirm e edição de série para parcelas 2+ são bloqueados no débito.

### Validações

- `npm run lint` — ✅ Sem erros
- `npm run test` — ✅ 31/34 passando (3 falhas pré-existentes em `financialInsight.test.ts`, não relacionadas)
- `npm run build` — ✅ Build OK

---

## Próxima Pauta (sugerida)

**Sessão:** Evolução da previsão de caixa pós-v0.2.0

### Objetivo

1. Incluir `recurrenceRules` no motor de cobertura para gerar compromissos futuros ainda não materializados
2. Criar cenários conservador / realista / projetado
3. Refinar a aba Projeção Futura com visão diária expandível e alertas por data crítica
4. Corrigir inconsistências documentais antigas: Gemini→Groq, IA conciliação e plano de melhorias

### Backlog (MASTER_PLAN §6)

Itens pendentes aguardando priorização:
- Correção de categorias por string legível (migration)
- Alerta de limite disponível
- Estorno total/parcial
- Pagamento parcial de fatura
- Paradigmas de orçamento
- Testes de integração
