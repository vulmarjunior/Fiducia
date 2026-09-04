# Relatórios: navegação e períodos — 2026-09-04

> **LLM:** deepseek-v4-pro | **Agente:** opencode

## Resultado

Entrega local v0.17.0. Navegação visível em Movimentação e Planejamento e análise. Componente compartilhado de períodos para relatórios, mantendo estados separados entre abas. Preservada a alteração local anterior de barras paralelas no histórico de cartões.

## Decisões

- Atalhos históricos incluem hoje; últimos N meses começam no primeiro dia do mês inicial e incluem o mês atual. Seleção mensal pelas setas continua representando mês civil completo.
- Projeção inicia hoje; 30/60/90 dias contam hoje como primeiro dia. Seis/doze meses usam calendário, com ajuste no último dia de meses curtos. Data final anterior à inicial não é aplicável.
- Extrato usa intervalo inclusivo sem mudar chamadas mensais existentes do Dashboard. CSV usa os mesmos dados.
- Orçamento e faturas arredondam seleções para meses completos de competência, com aviso visível. Orçamento multiplica o limite mensal vigente pelo número de meses; não há reconstrução histórica de limites.
- IA não recebe filtro artificial: indica análise da situação atual. PDFs de orçamento/faturas identificam o intervalo efetivo.
- Revisão React: componente reutilizável, campos rotulados, navegação com estado ativo e agrupamento separado do período; evolução de gastos indexa totais por data antes de gerar pontos.

## Arquivos

`ReportHeader.tsx`, novo `ReportPeriodSelector.tsx`, `Reports.tsx`, novo `periodPresets.ts` e testes, `monthlyStatement.ts` e testes, `pdfTemplates.ts`, versões e documentação.

## Validação

88 testes aprovados em 9 arquivos (relatórios, extrato, CSV e análise de faturas). `npm run lint` e `npm run build` aprovados. Build mantém aviso de chunks acima de 500 kB. Testes/build precisaram de execução elevada devido a `spawn EPERM` do esbuild no sandbox. Sem validação visual autenticada ou publicação nesta sessão.

## Próximo passo

Conferir layout desktop/mobile e exportações com dados reais, especialmente intervalos longos. Commit/push não realizados nesta sessão.
