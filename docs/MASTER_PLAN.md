# Fiducia — Plano Mestre

> Fonte única de verdade estratégica.
> **LLM:** deepseek-v4-pro | **Agente:** opencode

---

## 1. Identidade

| Campo | Valor |
|-------|-------|
| **Nome** | Fiducia |
| **Descrição** | Gestão financeira pessoal — contas, cartões, orçamentos, conciliação e relatórios |
| **Versão atual** | `0.9.2` |
| **Modelo de versionamento** | SemVer |
| **Última alteração em código** | 2026-08-05 (Comprometimento Futuro recolhível no modal de fatura v0.9.2) |
| **Último deploy** | 2026-08-05 — v0.9.1 no Vercel (produção validada) |
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
| Testes | ✅ Automatizados | 74 testes locais + 2 cenários com Firebase Emulator no CI |

---

## 4. Objetivo Vigente

**Foco atual:** Estabilização da versão 0.9.x, observabilidade e evolução das funcionalidades financeiras existentes.

**Próximo passo sugerido:** Monitorar a v0.9.1 em produção, ampliar testes de interface e otimizar o pacote compartilhado de ícones. A Fase 3 da Central de Importação permanece fora do escopo atual.

---

## 5. Entregas Concluídas (visão macro)

Abaixo, as entregas significativas identificadas no código e Git. Detalhes completos no `CHANGELOG.md` e `dev-log.md`.

| Data | Entrega | Impacto |
|------|---------|---------|
| 2026-08-05 | v0.9.2 — Comprometimento Futuro recolhível | Cartões / UX / Mobile |
| 2026-08-05 | v0.9.1 — Pagamentos legados no Dashboard e quitação sem saldo transportado | Dashboard / Cartões / Compatibilidade |
| 2026-08-04 | v0.9.0 — Estabilização, desempenho e experiência guiada | Segurança / UX / Performance |
| 2026-07-13 | v0.6.1 — Períodos civis na Projeção Futura | Relatórios / UX |
| 2026-07-13 | v0.6.0 — Central de Importação Assistida (Fases 1 e 2) | Importação / PWA / UX |
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

As pendências abaixo foram extraídas de `docs/plano-de-melhorias.md` e do `dev-log.md`. Status verificado contra o código em 2026-08-04.

| # | Item | Status | Observação |
|---|------|--------|------------|
| 1 | Unificação de contexto temporal entre Dashboard e Transactions | ✅ Concluído | v0.8.0 — contexto mensal persistente e compartilhado |
| 2 | Dropdown centralizado de categorias | ✅ Concluído | `CategorySelect` compartilhado |
| 3 | Correção de categorias por string legível (migration) | ✅ Concluído | v0.7.0 — `resolveCategoryId`, `categoryMigration.ts`, auto-heal no Dashboard |
| 4 | Consistência de mutabilidade — transações de cartão editáveis | ✅ Concluído | v0.8.0 — normalização de lançamentos legados/importados por `creditCardId` |
| 5 | Alerta de limite disponível (configurável) | ✅ Concluído | v0.7.0 — slider 50-95% em Configurações, badge no cartão, barra colorida no Dashboard |
| 6 | Estorno total / parcial de compras | ✅ Concluído | v0.7.0 — botão Undo no Transactions + dropdown Estornar no CreditCards, diálogo total/parcial |
| 7 | Pagamento parcial de fatura | ✅ Concluído | v0.7.0 — `paymentTransactionIds[]`, `paidAmount`, status `parcial`, múltiplos pagamentos |
| 8 | Paradigmas de orçamento (impacto fracionado vs integral) | ✅ Concluído | v0.7.0 — `getBudgetImpact()` em utils, seletor em Configurações |
| 9 | Testes automatizados (integração + unitários) | ✅ Concluído | 74 testes locais + regras e pagamentos atômicos no Firebase Emulator/CI |
| 10 | Gestão de versão / releases | ✅ Concluído | v0.7.0; exibida no Login e Dashboard |
| 11 | Central de Importacao Assistida - Fases 1 e 2 | ✅ Concluído | Entregues em v0.6.0 |
| 12 | Central de Importação Assistida — Fase 3 | ⏸️ Fora do escopo atual | Ideia preservada apenas para eventual reavaliação futura; sem previsão de implementação |
| 13 | CI/CD — GitHub Actions | ✅ Concluído | v0.7.0 — `.github/workflows/ci.yml`: lint + test + build |
| 14 | Chave Groq em proxy | ✅ Concluído | v0.8.0 — Vercel Function autenticada por Firebase ID token |

---

## 7. Riscos e Bloqueios

| Risco | Severidade | Descrição |
|-------|-----------|-----------|
| Testes dependentes de emulador | Baixa | Suíte configurada no CI com Java 21; execução local exige Java instalado |
| Dados legados com IDs string | Baixa | Migration auto-heal implementada em v0.7.0 — resolve runtime + scan no Dashboard |
| IA server-side | ✅ Resolvido | Chave Groq restrita à Vercel Function; bundle verificado sem segredo |
| Single developer | Alta | Todo conhecimento está em um único desenvolvedor (documentação atenua) |
| Sem CI/CD | ✅ Resolvido | GitHub Actions configurado em v0.7.0 |

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
| `docs/plano-migracao-firebase-supabase.md` | Plano de contingência para eventual migração do banco | 📋 Proposta não autorizada |
| `docs/archive/sessions/` | Arquivo de sessões concluídas | ✅ Ativo |

---

## 10. Próximo Passo Autorizado

Itens entregues em v0.7.0 a v0.8.0 (2026-08-04):
1. ✅ Pagamento parcial de fatura — `paymentTransactionIds[]`, `paidAmount`, status `parcial`
2. ✅ Correção de categorias por string legível — `resolveCategoryId`, migration auto-heal
3. ✅ CI/CD — GitHub Actions (lint + test + build)
4. ✅ Alerta de limite disponível — slider 50-95%, badge, barra colorida
5. ✅ Estorno total/parcial — botão Undo, diálogo total/parcial, `parentId`
6. ✅ Paradigmas de orçamento — `getBudgetImpact`, fracionado vs integral
7. ✅ Correção de permissão no Firestore para pagamento de fatura (v0.7.1).
8. ✅ Correção transacional de pagamentos totais/parciais (v0.7.2) — total canônico, cálculo em centavos, proteção contra duplicidade e fechamento protegido.
9. ✅ Experiência e consistência de pagamentos parciais (v0.7.3) — saldo líquido nos cards, progresso e histórico na fatura, saldo remanescente visível e relatórios pelo valor em aberto.
10. ✅ Backlog técnico 1–4 (v0.8.0) — proxy Groq autenticado, testes integrados, edição uniforme de cartão e período mensal compartilhado.
11. ✅ Compatibilidade de pagamentos e faturas legadas (v0.9.1) — IDs oficiais entram no regime de caixa e faturas com status `paga` não transportam saldo por ausência de `paidAmount`, sem migração do Firestore.

Pendências para sessão futura:
- Testes de interface em navegador e monitoramento da v0.9.1
- Redução adicional do chunk compartilhado de ícones

Fora do escopo atual:
- Central de Importação Fase 3 — e-mail, app Android, Open Finance e perfis avançados; sem previsão de retomada.
