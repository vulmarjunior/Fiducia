# Fiducia — Plano Mestre

> Fonte única de verdade estratégica.
> **LLM:** deepseek-v4-pro | **Agente:** opencode

---

## 1. Identidade

| Campo | Valor |
|-------|-------|
| **Nome** | Fiducia |
| **Descrição** | Gestão financeira pessoal — contas, cartões, orçamentos, conciliação e relatórios |
| **Versão atual** | `0.5.1` |
| **Modelo de versionamento** | SemVer |
| **Última alteração em código** | 2026-07-07 (ajustes responsivos em modais financeiros) |
| **Último deploy** | Não registrado formalmente |
| **App publicado** | https://fiducianew.vercel.app/ |
| **Repositório** | https://github.com/vulmarjunior/Fiducia |



---

## 2. Stack e Comandos

| Camada | Tecnologia |
|--------|-----------|
| Runtime | Node.js, Vite 6 |
| Linguagem | TypeScript 5.8 |
| UI | React 19, Tailwind CSS 4, Shadcn/UI (Base UI) |
| Backend | Firebase (Firestore + Auth) |
| IA | Groq API (`llama-3.3-70b-versatile`) |
| Gráficos | Recharts |
| Build | `npm run dev` (dev), `npm run build` (prod) |
| Testes | Vitest |
| Lint | `tsc --noEmit` |

### Comandos de validação

```bash
npm run lint       # tsc --noEmit
npm run test       # vitest run
npm run build      # vite build
```

---

## 3. Estado do Projeto

**Status geral:** Em desenvolvimento ativo, pré-release.

| Área | Estado | Observação |
|------|--------|------------|
| Dashboard | ✅ Funcional | KPIs, fluxo de caixa, insight IA, Cobertura de Caixa via motor único |
| Transações | ✅ Funcional | CRUD com runTransaction, parcelamento, recorrência, quick confirm |
| Contas | ✅ Funcional | Diagnóstico de saldo, ajuste por reconciliação, reset |
| Cartões de Crédito | ✅ Funcional | Faturas, grupos visuais, parcelamento, comprometimento futuro, PDF import |
| Conciliação | ✅ Funcional | OFX/CSV, auto-match, AI match, AI análise de divergências |
| Relatórios | ✅ Funcional | Regime duplo, projeção de caixa com cobertura diária e composição de obrigações, análise de faturas de cartão |
| Auditoria | ✅ Funcional | Diagnóstico, correção de saldo, reabertura de períodos |
| Orçamentos | ✅ Funcional | Metas por categoria, tabela Orçado x Realizado |
| Metas | ✅ Funcional | Metas financeiras com progresso |
| Categorias / Tags | ✅ Funcional | CRUD com hierarquia de categorias |
| Activity Log | ✅ Funcional | Histórico de operações |
| Autenticação | ✅ Funcional | Google Auth + modo convidado anônimo |
| PWA | ✅ Instalável | iOS meta tags, update com toast |
| Dark Mode | ✅ Funcional | next-themes com Tokens Shadcn |
| Testes | ⚠️ Parcial | Unitários para cartão e cobertura de caixa; sem testes de integração |

---

## 4. Objetivo Vigente

**Foco atual:** v0.5.1 entregue com ajustes responsivos nos modais de fatura, conferência/importação de fatura e lançamento.

**Próximo passo sugerido:** Testar em celular real os fluxos de Cartões → Fatura → Conferir Fatura/Importar PDF e o modal de Novo Lançamento, validando com dados reais.

---

## 5. Entregas Concluídas (visão macro)

Abaixo, as entregas significativas identificadas no código e Git. Detalhes completos no `CHANGELOG.md` e `dev-log.md`.

| Data | Entrega | Impacto |
|------|---------|---------|
| 2026-07-07 | v0.5.1 — Ajustes responsivos em modais financeiros | Cartões / Transações / UX Mobile |
| 2026-07-07 | v0.5.0 — Conferência inteligente de fatura de cartão (PDF/CSV/XLS/XLSX + Groq) | Cartões / IA / Conciliação |
| 2026-07-07 | v0.4.1 — Ordenação alternável + busca aprimorada (formato BR) | Transações |
| 2026-07-06 | v0.3.3 — Exportação PDF estruturada + correções no modal de cartão | Relatórios / Transações / Cartões |
| 2026-07-06 | v0.3.2 — Correções CRUD de lançamentos recorrentes (12 fixes) | Transações / Cartões |
| 2026-06-23 | v0.3.1 — Análise inteligente Groq — IA interpreta dados calculados | IA / Relatórios |
| 2026-06-23 | v0.3.0 — Relatório de análise de faturas de cartão | Relatórios |
| 2026-06-23 | v0.2.0 — Motor de cobertura de caixa + diagnóstico de obrigações | Relatórios / Dashboard |
| 2026-06-22 | v0.1.0 — Primeira versão formal + exibição no Login e Dashboard | Versionamento |
| 2026-06-22 | Classificação de faturas em 5 grupos + campos de data dupla | Cartões — UX da fatura |
| 2026-06-19 | Correção: edição de conta não trocava `accountId`/`destinationAccountId` | Transações — bug crítico |
| 2026-06-18 | Auditoria sistêmica de saldo — 5 bugs corrigidos | Contas — integridade |
| 2026-06-15 | Reconciliação contábil por partidas dobradas + remoção auto-healing | Contas — arquitetura |
| 2026-06-04 | Reports com projeção de caixa + seletor de período | Relatórios |
| 2026-06-04 | Conversão avulso → recorrente na edição | Transações |
| 2026-06-04 | Cartão — comprometimento futuro no modal de fatura | Cartões |
| 2026-06-02 | CalcPopover (calculadora inline) + remainderPosition + deduplicação utils | Transações / UX |
| 2026-05-30 | Importador de fatura PDF com Groq | Cartões |
| 2026-05-29 | TransactionDialog unificado | Transações / Cartões |
| 2026-05-28 | Quick Confirm + Categoria compartilhada + navegação com filtro | Transações / UX |
| 2026-05-26 | Correções atômicas de saldo (runTransaction) + DELETE de séries | Contas — integridade |

---

## 6. Backlog Ativo

As pendências abaixo foram extraídas de `docs/plano-de-melhorias.md` e do `dev-log.md`. Status verificado contra o código em 2026-06-22.

| # | Item | Status | Observação |
|---|------|--------|------------|
| 1 | Unificação de contexto temporal entre Dashboard e Transactions | 🔄 Parcial | Alguns guards já aplicados; filtro padrão "mês atual" pendente |
| 2 | Dropdown centralizado de categorias | ✅ Concluído | `CategorySelect` compartilhado |
| 3 | Correção de categorias por string legível (migration) | ⚠️ Pendente | IDs string antigos podem ainda existir em dados legados |
| 4 | Consistência de mutabilidade — transações de cartão editáveis | ⚠️ Pendente | Parcelas de cartão no modal unificado; verificar se todas são editáveis |
| 5 | Alerta de limite disponível (configurável) | ⚠️ Pendente | Especificado em `especificacao-cartao-credito.md` |
| 6 | Estorno total / parcial de compras | ⚠️ Pendente | Especificado, não implementado |
| 7 | Pagamento parcial de fatura | ⚠️ Pendente | Especificado, não implementado |
| 8 | Paradigmas de orçamento (impacto fracionado vs integral) | ⚠️ Pendente | Especificado, não implementado |
| 9 | Testes automatizados (integração + unitários) | 🔄 Parcial | Unitários para cartão e cobertura; integração pendente |
| 10 | Gestão de versão / releases | ✅ Concluído | v0.1.0 definida; exibida no Login e Dashboard |

---

## 7. Riscos e Bloqueios

| Risco | Severidade | Descrição |
|-------|-----------|-----------|
| — | — | — |
| Sem testes de integração | Alta | Regressões podem passar despercebidas em refatorações |
| Dados legados com IDs string | Média | Categorias com IDs não-UUID podem quebrar dropdowns (plano-de-melhorias §3) |
| IA client-side | Média | Chave Groq exposta no bundle (client-side only); sem proxy server |
| Single developer | Alta | Todo conhecimento está em um único desenvolvedor (documentação atenua) |
| Sem CI/CD | Baixa | Build e lint não são executados automaticamente em push/PR |

---

## 8. Decisões Arquiteturais Relevantes

Estas decisões estão detalhadas em `dev-log.md` (seção "Decisões de Arquitetura"). Resumo:

1. **Atomicidade total**: CREATE, EDIT, DELETE, IMPORT — todos usam `runTransaction` do Firestore.
2. **Saldo reflete apenas transações pagas**: Pendentes/canceladas não afetam `balance`.
3. **Transactions = extrato bancário**: Cartão de crédito não aparece na tela Lançamentos.
4. **Reconciliação por partidas dobradas**: Ajuste de saldo gera transação "Ajuste de Reconciliação".
5. **Fontes de verdade separadas**: Dashboard (regime de caixa), Reports (regime de competência).
6. **Campos `originalPurchaseDate` e `postingDate`**: Separação entre data da compra e data de lançamento na fatura.
7. **Proibição de auto-healing**: Scripts silenciosos de correção de saldo removidos.
8. **Motor único de cobertura de caixa**: Projeção futura transforma contas pendentes e faturas de cartão em eventos datados, simula saldo diário e agrega por mês para Dashboard/Reports.

---

## 9. Documentação do Projeto

| Arquivo | Função | Estado |
|---------|--------|--------|
| `docs/MASTER_PLAN.md` | Fonte única de verdade estratégica | ✅ Atual |
| `docs/pendencias_dev.md` | Pauta da sessão atual | ✅ Atual |
| `CHANGELOG.md` | Histórico permanente de releases | ✅ Atual |
| `AGENTS.md` | Orientações para agentes de IA | ✅ Atual |
| `dev-log.md` | Descobertas técnicas, armadilhas, decisões | ✅ Atual |
| `docs/LOGICA_DO_SISTEMA.md` | Arquitetura detalhada do sistema | ✅ Atual (Gemini→Groq corrigido em v0.4.0) |
| `docs/calculo_metricas.md` | Regras de cálculo de indicadores | ✅ Atual |
| `docs/especificacao-cartao-credito.md` | Especificação conceitual de cartão | ✅ Atual (v2.0) |
| `docs/ia-conciliacao-inteligente.md` | Spec IA Conciliação | ✅ Status "IMPLEMENTADO" adicionado em v0.4.0 |
| `docs/plano-de-melhorias.md` | Diagnóstico e plano de correções | ⚠️ Parcialmente resolvido; inventário revisado em v0.4.0 |
| `docs/plano-evolucao-previsao-caixa.md` | Spec evolução previsão de caixa | ✅ Criado em v0.4.0 |
| `docs/archive/sessions/` | Arquivo de sessões concluídas | ✅ Ativo |

---

## 10. Próximo Passo Autorizado

Após v0.4.0, evoluiu-se a previsão de caixa conforme planejado. Próximos itens do backlog:

1. ~~Incluir recorrências futuras ainda não materializadas no motor de cobertura.~~ ✅ v0.4.0
2. ~~Criar cenários conservador/realista/projetado.~~ ✅ v0.4.0
3. ~~Refinar a UI da aba Projeção com visão diária expandível e alertas por data crítica.~~ ✅ v0.4.0
4. ~~Corrigir inconsistências documentais pendentes: Gemini→Groq, status de IA conciliação e plano de melhorias.~~ ✅ v0.4.0

Próximos itens (MASTER_PLAN §6):
- Correção de categorias por string legível (migration)
- Alerta de limite disponível
- Estorno total/parcial
- Pagamento parcial de fatura
- Paradigmas de orçamento
- Testes de integração
