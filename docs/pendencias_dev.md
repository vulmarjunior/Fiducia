# Pendências de Desenvolvimento — Sessão Atual

> Documento efêmero da pauta atual. Ao concluir, transferir para `docs/archive/sessions/` e limpar este arquivo.
> **LLM:** deepseek-v4-pro | **Agente:** opencode

---

## Sessão: Relatório de Análise de Faturas de Cartão (v0.3.0)

### Resultado

Nova aba "Faturas" em `/reports` que analisa o comportamento das faturas de cartão de crédito ao longo do tempo.

### Arquivos tocados

| Arquivo | Ação |
|---------|------|
| `src/lib/invoiceAnalysis.ts` | Criado — motor de análise com `buildInvoiceAnalysis()` |
| `src/lib/invoiceAnalysis.test.ts` | Criado — 13 testes unitários |
| `src/pages/Reports.tsx` | Editado — nova aba "Faturas" (6ª aba) |
| `package.json` | Editado — v0.3.0 |
| `src/lib/utils.ts` | Editado — APP_VERSION 0.3.0 |
| `CHANGELOG.md` | Editado — entrada v0.3.0 |
| `docs/MASTER_PLAN.md` | Editado — versão, entregas, foco |
| `docs/calculo_metricas.md` | Pendente — adicionar métricas de fatura |
| `docs/pendencias_dev.md` | Este arquivo |

### Validações

- `npm run lint` — ✅ Sem erros
- `npm run test` — ✅ 23/23 passando (13 novos)
- `npm run build` — ✅ Build OK

### Pendências

- Atualizar `docs/calculo_metricas.md` com as novas métricas de fatura
- Transferir esta sessão para `docs/archive/sessions/2026-06-23-analise-faturas-cartao.md`

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