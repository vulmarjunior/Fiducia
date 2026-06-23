# Pendências de Desenvolvimento — Sessão Atual

> Documento efêmero da pauta atual. Ao concluir, transferir para `docs/archive/sessions/` e limpar este arquivo.
> **LLM:** deepseek-v4-pro | **Agente:** opencode

---

## Sessão: Análise Inteligente com Groq (v0.3.1)

### Resultado

A IA Groq deixa de gerar dicas genéricas e passa a interpretar os dados calculados pelos motores internos do Fiducia (cashCoverage, invoiceAnalysis, categorias, fluxo de caixa, orçamentos). Novo prompt estruturado com 5 seções fixas (diagnóstico, datas críticas, causas, riscos, ações).

### Arquivos tocados

| Arquivo | Ação |
|---------|------|
| `src/lib/financialInsight.ts` | Criado — `buildFinancialInsightContext()` + `buildGroqFinancialAnalysisPrompt()` |
| `src/lib/financialInsight.test.ts` | Criado — 11 testes unitários |
| `src/pages/Reports.tsx` | Editado — aba IA refatorada com contexto + disclaimer |
| `package.json` | Editado — v0.3.1 |
| `src/lib/utils.ts` | Editado — APP_VERSION 0.3.1 |
| `CHANGELOG.md` | Editado — entrada v0.3.1 |
| `docs/MASTER_PLAN.md` | Editado — versão, entregas, foco |
| `docs/calculo_metricas.md` | Atualizado — seção 7 |
| `docs/pendencias_dev.md` | Este arquivo |

### Decisão arquitetural

> A Groq interpreta dados calculados pelo Fiducia. Ela não é fonte de verdade dos cálculos financeiros.

### Validações

- `npm run lint` — ✅ Sem erros
- `npm run test` — ✅ 34/34 passando (11 novos)
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