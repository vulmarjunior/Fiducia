# Sessão — Projeção Futura com Escalas Separadas v0.15.1

> **LLM:** deepseek-v4-pro | **Agente:** opencode

## Objetivo

Corrigir a apresentação da Projeção Mensal, que combinava entradas e saídas positivas com o saldo projetado negativo no mesmo eixo e tornava a leitura visual alarmista.

## Resultado

- Compromissos mensais agora usam barras com origem em zero.
- Saldo projetado ganhou gráfico próprio, iniciando no saldo atual (“Hoje”).
- O eixo de saldo marca explicitamente o zero.
- Texto explica que saldo negativo é falta de cobertura futura e não uma despesa mensal.
- Layout permanece responsivo e não altera cálculos nem dados persistidos.

## Arquivos

- `src/pages/Reports.tsx`
- `src/lib/utils.ts`
- `package.json`
- `package-lock.json`
- `CHANGELOG.md`
- `docs/MASTER_PLAN.md`

## Validação

- `npm run lint` aprovado.
- `git diff --check` aprovado.
- Testes e build foram bloqueados pela sandbox ao iniciar o Vite (`spawn EPERM`) e devem ser repetidos antes da publicação.

## Pendências

- Executar testes e build em ambiente com permissão de processo.
- Commit, push e deploy somente após validação completa e autorização do usuário.
