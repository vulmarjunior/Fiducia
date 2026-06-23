# Sessão — Motor de Cobertura de Caixa

> **LLM:** deepseek-v4-pro | **Agente:** opencode

## Objetivo

Implementar melhoria no sistema de relatórios para responder se caixa atual + valores a receber cobrem dívidas assumidas e projetadas em conta bancária e cartão de crédito, incluindo faturas fechadas, abertas e compromissos futuros.

## Resultado

Entregue na versão `0.2.0`.

- Criado motor único de cobertura de caixa em `src/lib/cashCoverage.ts`
- Integrada a aba Projeção Futura de `src/pages/Reports.tsx` ao novo motor
- `projectDailyBalance()` passou a usar o motor central, mantendo compatibilidade com o Dashboard
- Adicionados testes unitários para cenários críticos de previsão
- Atualizados versionamento e documentação oficial

## Arquivos tocados

- `src/lib/cashCoverage.ts`
- `src/lib/cashCoverage.test.ts`
- `src/lib/utils.ts`
- `src/pages/Reports.tsx`
- `src/lib/utils.ts`
- `package.json`
- `package-lock.json`
- `CHANGELOG.md`
- `docs/MASTER_PLAN.md`
- `docs/calculo_metricas.md`
- `docs/pendencias_dev.md`

## Validações

- `npx vitest run src/lib/cashCoverage.test.ts src/utils/creditCardUtils.test.ts` — OK
- `npm run lint` — OK
- `npm run test` — OK
- `npm run build` — OK

Observação: `npm run test` e `npm run build` precisaram de execução fora do sandbox porque o Vite/esbuild foi bloqueado com `spawn EPERM` no sandbox.

## Pendências

- Incluir recorrências futuras ainda não materializadas no motor
- Criar cenários conservador/realista/projetado
- Refinar a UI com visão diária expandível e alertas por data crítica
- Corrigir inconsistências documentais antigas ainda registradas no plano mestre