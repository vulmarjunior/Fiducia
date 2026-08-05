# Sessão — Relatórios Organizados e Exportáveis v0.13.0

> **LLM:** deepseek-v4-pro | **Agente:** opencode

## Objetivo

Concluir a evolução dos relatórios com exportação do Extrato Mensal, navegação móvel clara e contexto mensal consistente na visão Orçamento.

## Resultado

- Extrato Mensal exportável em CSV UTF-8, separado por ponto e vírgula e adequado a planilhas em português.
- Abas mostram nomes curtos também no celular: Extrato, Fluxo, Consumo, Orçamento, Futuro, Faturas e IA.
- Orçamento, evolução de gastos e PDF usam o mês global selecionado; períodos históricos exibem o mês completo.
- Nenhuma escrita ou migração no Firestore.

## Arquivos principais

- `src/pages/Reports.tsx`
- `src/lib/monthlyStatementCsv.ts`
- `src/lib/monthlyStatementCsv.test.ts`

## Validações

- `npm run lint` — aprovado.
- `npx vitest run --maxWorkers=1` — 84 aprovados e 2 ignorados sem emulador.
- `npm run build` — aprovado.

> **LLM:** deepseek-v4-pro | **Agente:** opencode
