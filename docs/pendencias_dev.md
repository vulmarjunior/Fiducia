# Pendências de Desenvolvimento — Próxima Pauta

> **LLM:** deepseek-v4-pro | **Agente:** opencode

**Versão de base:** 0.20.8.

## Pauta ativa

- **Crédito/estorno e saldo credor na fatura** — em execução; plano em [planos/PLANO_CREDITO_ESTORNO_SALDO_CREDOR.md](planos/PLANO_CREDITO_ESTORNO_SALDO_CREDOR.md). E1 e E2 implementados em branch; faltam homologação e E3.
- **Importação de fatura de cartão** — plano proposto em [planos/PLANO_IMPORTACAO_FATURA_CARTAO.md](planos/PLANO_IMPORTACAO_FATURA_CARTAO.md).

- **v0.20.8 publicada em produção** na Vercel; `APP_VERSION` 0.20.8 confirmada no bundle publicado.
- **Validação do responsável concluída:** exclusão do lançamento preso, quitação após pagamento parcial e relatórios conferidos.
- Sessão de 12/10 encerrada e preservada em [correção de exclusão de lançamento em fatura movida](archive/sessions/2026-10-12-correcao-exclusao-fatura-movida.md).

## Riscos e registros herdados

Não são pauta ativa; verificar pertinência antes de reabrir.

- **Revisão final (herdada):** créditos canônicos no pagamento e reavaliação do fallback documental da v0.20.7, que pode reintroduzir obrigações inválidas. O achado anterior sobre aumentar uso de limite foi retificado após esclarecimento do usuário. Ver [revisão](archive/sessions/2026-09-08-revisao-final-v0207.md).
- **Recalcular Faturas Antigas:** `CreditCards.tsx` reescreve `invoicePeriod` pela regra da data e pode desfazer movimentos manuais de fatura — decidir tratamento em sessão futura (ver MASTER_PLAN — Riscos).
- **Frente Android pausada:** congelada; referência: [handoff](archive/sessions/2026-09-02-android-pausado-handoff.md).
