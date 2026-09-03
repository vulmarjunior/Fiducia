# Pendências de Desenvolvimento — Próxima Pauta

> Documento efêmero da execução atual. Sessões concluídas ficam em `docs/archive/sessions/`.
> **LLM:** deepseek-v4-pro | **Agente:** opencode

## Próxima pauta

**Estado:** v0.16.0 com refinamentos de UX aplicados em 2026-09-03 (seletor de evolução por dropdown, faturas de cartão no Entradas × Saídas, disponibilidade imediata de investimentos nos relatórios e Dashboard, proteção de lançamentos com conta obrigatória). Erro 403 de produção resolvido (10 transações com conta inexistente corrigidas; 0 referências quebradas). Lint, 163 testes e build aprovados. Falta a validação visual final antes do deploy.

**Versão de base:** `0.16.0`.

**Referências da última entrega:**
- `docs/archive/sessions/2026-09-03-fechamento-plano-relatorios.md` (fechamento do plano)
- `docs/archive/sessions/2026-09-03-refinamentos-ux-e-protecao-transacoes.md` (refinamentos e proteção)

### Próximo passo

1. Validação visual em desktop (1440px) e mobile (390px), temas claro/escuro, dos quatro relatórios essenciais e do Dashboard (Disponível × Investimentos).
2. Após aceite do usuário, autorização explícita para deploy em produção.

### Frente Android pausada

O diagnóstico e o handoff anteriores continuam preservados integralmente em `docs/archive/sessions/2026-09-02-android-pausado-handoff.md`. A frente permanece congelada para estudos futuros, sem alterações de código, parser, integração Firebase ou publicação do APK.

> **LLM:** deepseek-v4-pro | **Agente:** opencode