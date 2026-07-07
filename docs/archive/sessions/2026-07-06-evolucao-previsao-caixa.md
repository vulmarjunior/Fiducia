# Sessão: Evolução da Previsão de Caixa + Correções Documentais (v0.4.0)

> **LLM:** deepseek-v4-pro | **Agente:** opencode
> **Data:** 2026-07-06

---

## Objetivo

1. Incluir `recurrenceRules` no motor de cobertura para gerar compromissos futuros ainda não materializados
2. Criar cenários conservador / realista / projetado
3. Refinar a aba Projeção Futura com visão diária expandível e alertas por data crítica
4. Corrigir inconsistências documentais pendentes: Gemini→Groq, status de IA conciliação e plano de melhorias

## Resultado

Motor `cashCoverage.ts` estendido com ~80 linhas: geração de eventos a partir de `recurrenceRules` ativas, filtro por cenário (`conservative`/`realistic`/`projected`), métrica `daysAtRisk`. Aba Projeção Futura ganhou seletor de cenário, toggle de visão diária com tabela colorida, seção "Dias Críticos" e alerta de dias em risco. Dashboard usa cenário conservador por padrão (segurança). Documentação corrigida: 4 Gemini→Groq em `LOGICA_DO_SISTEMA.md`, status IMPLEMENTADO em `ia-conciliacao-inteligente.md`, inventário revisado em `plano-de-melhorias.md`.

## Arquivos tocados

| Arquivo | Ação | Pontos |
|---------|------|--------|
| `src/lib/cashCoverage.ts` | Editado — +80 linhas: recurrenceRules, cenários, daysAtRisk | Core |
| `src/lib/cashCoverage.test.ts` | Mantido — 5/5 passando | — |
| `src/lib/utils.ts` | Editado — projectDailyBalance recebe recurrenceRules + conservative | — |
| `src/lib/financialInsight.ts` | Editado — params com recurrenceRules | — |
| `src/pages/Reports.tsx` | Editado — +120 linhas: snapshot, seletor cenário, visão diária, dias críticos | UI |
| `src/pages/Dashboard.tsx` | Editado — snapshot recurrenceRules, daysAtRisk no KPI | UI |
| `docs/LOGICA_DO_SISTEMA.md` | Editado — 4 correções Gemini→Groq | Doc |
| `docs/ia-conciliacao-inteligente.md` | Editado — status IMPLEMENTADO | Doc |
| `docs/plano-de-melhorias.md` | Editado — header de status e data de revisão | Doc |
| `docs/plano-evolucao-previsao-caixa.md` | **Criado** | Doc |
| `package.json` | Editado — v0.4.0 | — |
| `src/lib/utils.ts` | Editado — `APP_VERSION = '0.4.0'` | — |
| `CHANGELOG.md` | Editado — entrada v0.4.0 | — |
| `docs/MASTER_PLAN.md` | Editado — versão, §9 e §10 atualizados | — |

## Decisões arquiteturais

> **Regras de recorrência no motor**: Para cada `RecurrenceRule` com `status: 'active'`, o motor gera eventos futuros com `source: 'recurrence'` e `certainty: 'projected'` a partir de `startDate` até `endDate` (ou fim da janela). Não duplica transações já materializadas (match por `parentId` + data). Regras com `endDate` definido param na data. Para regras de cartão, `invoicePeriod` é calculado via `closingDay`/`dueDay`.

> **Cenários de projeção**: Filtro aplicado sobre `events[]` ANTES da simulação diária. Conservative = só `confirmed` (transações pendentes reais + faturas fechadas). Realistic = `confirmed` + `expected` (default). Projected = todos incluindo `projected` (recorrências futuras).

> **Visão diária**: `dailyProjection[]` já era calculado pelo motor desde v0.3.0 mas nunca exposto. Agora renderizado como tabela colorida com faixas: verde (saldo >= 0), âmbar (saldo < 20% das obrigações mensais), vermelho (saldo < 0).

## Validações

- `npm run lint` — ✅ Sem erros
- `npm run test` — ✅ 31/34 passando (3 falhas pré-existentes em financialInsight.test.ts)
- `npm run build` — ✅ Build OK (8.13s)
