# Sessão — Correção do limite disponível dos cartões

**Data:** 2026-09-04  
**Versão:** 0.16.4  
**LLM:** deepseek-v4-pro | **Agente:** opencode

## Resultado

O uso do limite passou a representar somente o crédito comprometido em faturas não quitadas. Compras de faturas pagas não permanecem acumuladas e pagamentos parciais reduzem o saldo pendente.

## Arquivos alterados

- `src/utils/creditCardUtils.ts`
- `src/utils/creditCardUtils.test.ts`
- `src/pages/CreditCards.tsx`
- `package.json`
- `package-lock.json`
- `CHANGELOG.md`
- `docs/MASTER_PLAN.md`
- `docs/pendencias_dev.md`

## Validações

- `npm run lint` — aprovado
- `npm run test -- src/utils/creditCardUtils.test.ts --maxWorkers=1` — 7 testes aprovados
