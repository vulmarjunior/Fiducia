# Sessão — Margem de Caixa Decisória v0.14.0

> **LLM:** deepseek-v4-pro | **Agente:** opencode

## Objetivo

Transformar a cobertura de caixa em uma informação simples para decidir novos gastos, eliminando cenários confusos e corrigindo divergências da projeção.

## Resultado

- Uma única projeção padrão inclui compromissos registrados, faturas abertas/fechadas e parcelas futuras.
- Margem de Caixa = menor saldo previsto − reserva protegida.
- Dashboard mantém horizonte fixo de 90 dias; Relatórios oferece 30/60/90/180/365 dias e data final.
- Recorrências e reservas são opções explícitas.
- Receitas vencidas não recebidas não aumentam silenciosamente a cobertura.
- Totais, meses e saldo diário permanecem reconciliados, inclusive com recorrências.
- Nenhuma alteração no Firestore.

## Validações

- Revisão de boas práticas React: estado derivado, acessibilidade e memoização conferidos.
- `npm run lint` — aprovado.
- `npx vitest run --maxWorkers=1` — 88 aprovados e 2 ignorados sem emulador.
- `npm run build` — aprovado.

> **LLM:** deepseek-v4-pro | **Agente:** opencode
