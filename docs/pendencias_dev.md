# Pendências de Desenvolvimento — Próxima Pauta

> **LLM:** deepseek-v4-pro | **Agente:** opencode

**Versão de base:** 0.20.8.

Sessão concluída: [correção de exclusão de lançamento em fatura movida](archive/sessions/2026-10-12-correcao-exclusao-fatura-movida.md). Resultados e validações preservados nesse registro.

## Revisão final (herdada)

Pendências: créditos canônicos no pagamento e reavaliação do fallback documental da v0.20.7, que pode reintroduzir obrigações inválidas. O achado anterior sobre aumentar uso de limite foi retificado após esclarecimento do usuário. Ver [revisão](archive/sessions/2026-09-08-revisao-final-v0207.md).

## Risco registrado

"Recalcular Faturas Antigas" (`CreditCards.tsx`) reescreve `invoicePeriod` pela regra da data e pode desfazer movimentos manuais de fatura — decidir tratamento em sessão futura (ver MASTER_PLAN — Riscos).

## Próximo passo

Validação do usuário: excluir o lançamento preso após a v0.20.8, quitação após pagamento parcial e relatórios. Publicação depende de autorização explícita.

## Frente Android pausada

Permanece congelada; referência: [handoff](archive/sessions/2026-09-02-android-pausado-handoff.md).
