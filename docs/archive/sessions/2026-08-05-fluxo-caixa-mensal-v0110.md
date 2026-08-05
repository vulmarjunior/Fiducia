# Sessão — Fluxo de Caixa Mensal v0.11.0

> **LLM:** deepseek-v4-pro | **Agente:** opencode

## Objetivo

Transformar a visão mensal em padrão do Fluxo de Caixa e permitir investigação diária sem remover as comparações históricas.

## Resultado

- Mês tornou-se o período padrão e segue o contexto temporal global.
- O gráfico mensal mostra receitas, despesas e resultado acumulado por dia.
- Dias com movimento formam uma lista responsiva e clicável.
- O detalhamento abre os lançamentos originais em modal adaptado ao celular.
- 3/6/12 meses terminam no mês selecionado, não obrigatoriamente no mês atual.
- Pagamentos vinculados de fatura são reconhecidos sem duplicar compras do cartão.

## Arquivos

- `src/lib/cashFlowView.ts`
- `src/lib/cashFlowView.test.ts`
- `src/pages/Reports.tsx`
- `src/lib/pdfTemplates.ts`
- `package.json`, `package-lock.json`, `src/lib/utils.ts`
- `CHANGELOG.md`, `docs/MASTER_PLAN.md`

## Segurança

Somente leitura. Nenhum documento do Firebase foi escrito ou migrado.

## Validações

- TypeScript sem erros.
- 80 testes aprovados; 2 cenários de emulador ignorados sem host local.
- Build de produção concluído.
