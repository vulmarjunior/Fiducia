# Pendências de Desenvolvimento — Próxima Pauta

> **LLM:** deepseek-v4-pro | **Agente:** opencode

**Versão de base:** 0.21.2.

## Pauta ativa

- **Crédito/estorno e saldo credor na fatura** — em execução; plano em [planos/PLANO_CREDITO_ESTORNO_SALDO_CREDOR.md](planos/PLANO_CREDITO_ESTORNO_SALDO_CREDOR.md). E1 e E2 publicados na v0.21.2; falta homologar o crédito de R$ 280,42 e o carry entre faturas; E3 (estorno de parcela/compra) e E4 (projeções) pendentes.
- **Importação de fatura de cartão** — pendente; plano proposto em [planos/PLANO_IMPORTACAO_FATURA_CARTAO.md](planos/PLANO_IMPORTACAO_FATURA_CARTAO.md). Teste de 31/10 com o XLSX do Itaú: cabeçalho real na linha 14; sem limpeza retorna “Nenhuma linha”; após limpeza, 119 linhas lidas, mas o matching marca muitos lançamentos existentes como “Faltando” (janela de período/cartão) e não há âncora no total declarado (R$ 12.608,99). PDF segue frágil. Retomar pela E1–E5 do plano.
- **Sessão de 31/10 encerrada** e preservada em [crédito, saldo credor e ajustes da fatura](archive/sessions/2026-10-31-credito-saldo-credor-fatura.md).

- **v0.21.2 publicada em produção** na Vercel em 31/10/2026; `APP_VERSION` 0.21.2 confirmada no bundle publicado.
- **Validação do responsável concluída:** exclusão do lançamento preso, quitação após pagamento parcial e relatórios conferidos.
- Sessão de 12/10 encerrada e preservada em [correção de exclusão de lançamento em fatura movida](archive/sessions/2026-10-12-correcao-exclusao-fatura-movida.md).

## Riscos e registros herdados

Não são pauta ativa; verificar pertinência antes de reabrir.

- **Revisão final (herdada):** créditos canônicos no pagamento e reavaliação do fallback documental da v0.20.7, que pode reintroduzir obrigações inválidas. O achado anterior sobre aumentar uso de limite foi retificado após esclarecimento do usuário. Ver [revisão](archive/sessions/2026-09-08-revisao-final-v0207.md).
- **Recalcular Faturas Antigas:** `CreditCards.tsx` reescreve `invoicePeriod` pela regra da data e pode desfazer movimentos manuais de fatura — decidir tratamento em sessão futura (ver MASTER_PLAN — Riscos).
- **Frente Android pausada:** congelada; referência: [handoff](archive/sessions/2026-09-02-android-pausado-handoff.md).
