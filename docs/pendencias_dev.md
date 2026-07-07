# Pendências de Desenvolvimento — Sessão Atual

> Documento efêmero da pauta atual. Ao concluir, transferir para `docs/archive/sessions/` e limpar este arquivo.
> **LLM:** deepseek-v4-pro | **Agente:** opencode

---

## Resultado da Sessão (2026-07-07)

### Entregue: v0.4.1 — Ordenação Alternável + Busca Aprimorada em Lançamentos

**Arquivos modificados:**
- `src/pages/Transactions.tsx` — +25 linhas (sortOrder toggle, amountMatchesSearch)
- `CHANGELOG.md` — Entrada v0.4.1
- `docs/MASTER_PLAN.md` — Versão 0.4.1
- `package.json` — Versão 0.4.1

**Validações:**
- `npm run lint` — Sem erros
- `npm run test` — 31/34 passando (3 falhas pré-existentes)
- `npm run build` — Build OK

---

## Próxima Pauta (sugerida)

### Itens do backlog (MASTER_PLAN §6)

- Correção de categorias por string legível (migration)
- Alerta de limite disponível
- Estorno total/parcial
- Pagamento parcial de fatura
- Paradigmas de orçamento
- Testes de integração
