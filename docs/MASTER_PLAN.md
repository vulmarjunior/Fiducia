# Fiducia — Plano Mestre

> Fonte única de verdade estratégica.
> **LLM:** deepseek-v4-pro | **Agente:** opencode

---

## 1. Identidade

| Campo | Valor |
|-------|-------|
| **Nome** | Fiducia |
| **Descrição** | Gestão financeira pessoal — contas, cartões, orçamentos, conciliação e relatórios |
| **Versão atual** | `0.1.0` |
| **Modelo de versionamento** | SemVer |
| **Última alteração em código** | 2026-06-22 (melhorias fatura cartão) |
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
| Dashboard | ✅ Funcional | KPIs, fluxo de caixa, insight IA, Disponível Seguro |
| Transações | ✅ Funcional | CRUD com runTransaction, parcelamento, recorrência, quick confirm |
| Contas | ✅ Funcional | Diagnóstico de saldo, ajuste por reconciliação, reset |
| Cartões de Crédito | ✅ Funcional | Faturas, grupos visuais, parcelamento, comprometimento futuro, PDF import |
| Conciliação | ✅ Funcional | OFX/CSV, auto-match, AI match, AI análise de divergências |
| Relatórios | ✅ Funcional | Regime duplo (cash/accrual), projeção de caixa, seletor de período |
| Auditoria | ✅ Funcional | Diagnóstico, correção de saldo, reabertura de períodos |
| Orçamentos | ✅ Funcional | Metas por categoria, tabela Orçado x Realizado |
| Metas | ✅ Funcional | Metas financeiras com progresso |
| Categorias / Tags | ✅ Funcional | CRUD com hierarquia de categorias |
| Activity Log | ✅ Funcional | Histórico de operações |
| Autenticação | ✅ Funcional | Google Auth + modo convidado anônimo |
| PWA | ✅ Instalável | iOS meta tags, update com toast |
| Dark Mode | ✅ Funcional | next-themes com Tokens Shadcn |
| Testes | ⚠️ Parcial | Apenas `creditCardUtils.test.ts` (unitário); sem testes de integração |

---

## 4. Objetivo Vigente

**Foco atual:** Versionamento formal iniciado (v0.1.0). Protocolo de documentação em 4 camadas implantado.

**Próximo passo autorizado:** Corrigir inconsistências documentais pendentes (Gemini→Groq, status `ia-conciliacao-inteligente.md`, `plano-de-melhorias.md`).

---

## 5. Entregas Concluídas (visão macro)

Abaixo, as entregas significativas identificadas no código e Git. Detalhes completos no `CHANGELOG.md` e `dev-log.md`.

| Data | Entrega | Impacto |
|------|---------|---------|
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
| 9 | Testes automatizados (integração + unitários) | ⚠️ Pendente | Apenas `creditCardUtils.test.ts` |
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

---

## 9. Documentação do Projeto

| Arquivo | Função | Estado |
|---------|--------|--------|
| `docs/MASTER_PLAN.md` | Fonte única de verdade estratégica | ✅ Atual |
| `docs/pendencias_dev.md` | Pauta da sessão atual | ✅ Atual |
| `CHANGELOG.md` | Histórico permanente de releases | ✅ Atual |
| `AGENTS.md` | Orientações para agentes de IA | ✅ Atual |
| `dev-log.md` | Descobertas técnicas, armadilhas, decisões | ✅ Atual |
| `docs/LOGICA_DO_SISTEMA.md` | Arquitetura detalhada do sistema | ⚠️ Referencia Gemini (desatualizado); código usa Groq |
| `docs/calculo_metricas.md` | Regras de cálculo de indicadores | ✅ Atual |
| `docs/especificacao-cartao-credito.md` | Especificação conceitual de cartão | ✅ Atual (v2.0) |
| `docs/ia-conciliacao-inteligente.md` | Spec IA Conciliação | ⚠️ Já implementado; deveria ser movido para archive ou ter status atualizado |
| `docs/plano-de-melhorias.md` | Diagnóstico e plano de correções | ⚠️ Itens parcialmente resolvidos; revisar status |
| `docs/archive/sessions/` | Arquivo de sessões concluídas | ✅ Ativo |

---

## 10. Próximo Passo Autorizado

Concluir a implantação do protocolo de documentação (esta sessão). Em seguida:

1. Revisar `docs/plano-de-melhorias.md` e atualizar status de cada item verificando código real.
2. Mover `docs/ia-conciliacao-inteligente.md` para `docs/archive/` ou atualizar seu status para "Implementado — manter como referência".
3. Corrigir referência à Gemini em `docs/LOGICA_DO_SISTEMA.md` para Groq.
4. Definir primeira versão formal (ex: `0.1.0`) com base nas funcionalidades completas.
