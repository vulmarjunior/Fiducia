# Sessão — Fluxo e Faturas sem Alarmismo v0.15.0

> **LLM:** deepseek-v4-pro | **Agente:** opencode

## Objetivo

Evitar que resultado de caixa, pagamentos históricos e parcelas distribuídas no futuro sejam interpretados como saldo negativo ou dívida imediata.

## Resultado

- Fluxo separa movimentos diários do resultado acumulado, que passa a declarar que começa em zero e não é saldo bancário.
- Cards mensais e históricos usam horizontes coerentes.
- Faturas separa A pagar agora, Em andamento, Próximos 90 dias e Média histórica paga.
- Créditos e estornos entram por padrão; filtros parciais confusos foram removidos.
- Histórico e parcelas futuras ganharam gráficos distintos.
- PDFs acompanham a nova semântica.
- Nenhuma alteração no Firestore.

## Validações

- Revisão React: memoização, renderização e responsividade conferidas.
- `npm run lint` — aprovado.
- `npx vitest run --maxWorkers=1` — 90 aprovados e 2 ignorados sem emulador.
- `npm run build` — aprovado.

> **LLM:** deepseek-v4-pro | **Agente:** opencode
