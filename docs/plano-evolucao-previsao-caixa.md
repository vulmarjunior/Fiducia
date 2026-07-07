# Plano: Evolução da Previsão de Caixa (v0.4.0)

> Especificação técnica da próxima evolução do motor de projeção de caixa.
> **LLM:** deepseek-v4-pro | **Agente:** opencode

---

## 1. Incluir `recurrenceRules` no Motor de Cobertura

### Situação atual
- `cashCoverage.ts` define `CashCoverageSource = 'recurrence'` no tipo mas **nunca o utiliza**
- Regras de cartão `ccRecurrenceType === 'fixo'` são salvas em `recurrenceRules` com 12 transações pré-geradas → acabando esse horizonte, a projeção fica cega
- Recorrência bancária (`isRecurring`) não persiste regra na coleção — apenas agrupa por `parentId`

### Implementação
1. Adicionar `recurrenceRules?: RecurrenceRule[]` como parâmetro de `buildCashCoverageProjection()`
2. Para cada regra com `status === 'active'`:
   - Calcular próximas N ocorrências a partir de hoje dentro da janela `[startDate, endDate]`
   - Usar `frequency` + `billingDay` para calcular datas
   - Não duplicar transações já materializadas (match por `parentId` + data)
   - Respeitar `endDate` da regra (se definido)
3. Gerar `CashCoverageEvent` com `source: 'recurrence'`, `certainty: 'projected'`
4. Para recorrências de cartão: usar `calculateInvoicePeriod()` para atribuir `invoicePeriod`

---

## 2. Cenários Conservador / Realista / Projetado

### Situação atual
- `CashCoverageCertainty` existe (`confirmed`/`expected`/`projected`) mas não é usado para filtrar cenários
- Projeção é linear: soma tudo indistintamente

### Implementação
1. Adicionar `CashCoverageScenario = 'conservative' | 'realistic' | 'projected'`
2. Adicionar `scenario?: CashCoverageScenario` em `CashCoverageOptions` (default `'realistic'`)
3. Filtrar `events[]` antes da simulação diária:

| Cenário | Filtro |
|---------|--------|
| `conservative` | Só `confirmed` + `invoice_closed` (certeza absoluta) |
| `realistic` | `confirmed` + `expected` (transações pendentes + faturas abertas) |
| `projected` | Todos (`confirmed` + `expected` + `projected`) |

---

## 3. Visão Diária + Alertas por Data Crítica

### Situação atual
- `buildCashCoverageProjection()` já constrói `dailyProjection[]` mas não é exposto na UI
- Apenas `monthlyProjection` é renderizado
- KPI mostra `firstRiskDate` e `minimumBalance` mas não quantifica dias de risco

### Implementação
1. Adicionar `daysAtRisk: number` ao retorno de `CashCoverageProjection`
2. Na UI (Reports.tsx):
   - Toggle "Visão Diária" abaixo do gráfico mensal
   - Tabela diária com colunas: Data, Saldo Inicial, Entradas, Saídas, Saldo Final
   - Cores por faixa: verde (saldo >= 0), âmbar (saldo < 20% obrigações), vermelho (saldo < 0)
   - Seção "Dias Críticos" com os 5 piores dias
   - Métrica "X dias em risco no período"
3. No Dashboard:
   - KPI de Cobertura já mostra `isAtRisk` — adicionar "X dias de risco"

---

## 4. Correções Documentais

| Arquivo | Linhas | Ação |
|---------|--------|------|
| `docs/LOGICA_DO_SISTEMA.md` | 7, 50, 75, 76 | Substituir "Gemini" → "Groq" (4×) |
| `docs/ia-conciliacao-inteligente.md` | Topo | Adicionar `> STATUS: IMPLEMENTADO em v0.3.x` |
| `docs/plano-de-melhorias.md` | Várias | Revisar inventário, marcar itens concluídos |
| `docs/MASTER_PLAN.md` | §10 | Limpar backlog dos itens resolvidos nesta sessão |

---

## Resumo de Arquivos

| Arquivo | Ação | Complexidade |
|---------|------|-------------|
| `docs/plano-evolucao-previsao-caixa.md` | **Criar** | Baixa |
| `docs/LOGICA_DO_SISTEMA.md` | Editar (4× Gemini→Groq) | Trivial |
| `docs/ia-conciliacao-inteligente.md` | Editar (status) | Trivial |
| `docs/plano-de-melhorias.md` | Editar (inventário) | Baixa |
| `src/lib/cashCoverage.ts` | Editar (~+80 linhas) | Alta |
| `src/lib/cashCoverage.test.ts` | Editar (novos testes) | Média |
| `src/pages/Reports.tsx` | Editar (snapshot, seletor, toggle, dias críticos) | Média |
| `src/pages/Dashboard.tsx` | Editar (cenário, métrica) | Baixa |
| `src/lib/financialInsight.ts` | Editar (passar recurrenceRules) | Baixa |

**Versão proposta:** `0.4.0` (MINOR — funcionalidade nova retrocompatível)
