# Pendencias de Desenvolvimento - Sessao Atual

> Documento efemero da pauta atual. Ao concluir, transferir para `docs/archive/sessions/` e limpar este arquivo.
> **LLM:** deepseek-v4-pro | **Agente:** opencode

---

## Sessao em andamento — Pagamento Parcial + Correcao Categorias + Melhorias v0.7.0

### Objetivo

Implementar itens do backlog: pagamento parcial de fatura, correcao de categorias (migration), CI/CD, alerta de limite, estorno, paradigmas de orcamento.

### Resultado tecnico

- **Pagamento parcial de fatura**: `Invoice` ganhou `paymentTransactionIds: string[]`, `paidAmount: number`, status `'parcial'`. `handlePayInvoice` acumula pagamentos e determina `parcial` vs `paga`. UI mostra "Pagamento Parcial" (ambare) e botao "Pagar Remanescente". Auto-sync em Transactions.tsx recalcula `paidAmount` via loop nos IDs. Edit no TransactionDialog ajusta `paidAmount` conforme mudanca de status. Cash coverage usa saldo remanescente. Invoice analysis e pdfTemplates atualizados.
- **Correcao de categorias (migration)**: `resolveCategoryId()` em utils — detecta ID nao-UUID e faz match por nome exato/case-insensitive. `CategorySelect` usa o resolver. `TransactionDialog.populateEdit` resolve ao abrir. `categoryMigration.ts` scaneia transactions/budgets e corrige via writeBatch. Migration roda no Dashboard ao carregar.
- **CI/CD**: `.github/workflows/ci.yml` — lint, test, build em push/PR no main.
- **Alerta de limite**: localStorage `fiducia_limitAlertThreshold`. Slider 50-95% em Configuracoes > Preferencias. Badge no card (amber/red). Barra colorida no Dashboard.
- **Estorno**: Botao `Undo` em Transactions.tsx e dropdown "Estornar" em CreditCards.tsx. Dialogo com Total/Parcial. Cria receita vinculada via `parentId`.
- **Paradigmas de orcamento**: `getBudgetImpact()` em utils. Fracionado (parcela conta no mes) / Integral (total na 1a parcela). Seletor em Configuracoes. Aplicado em Dashboard, Budgets, Reports.

### Arquivos tocados

- `src/types/index.ts` — Invoice: `paymentTransactionIds[]`, `paidAmount`, status `'parcial'`
- `src/lib/utils.ts` — `getInvoicePaymentIds`, `isInvoiceClosed`, `resolveCategoryId`, `isLegacyCategoryId`, `getBudgetImpact`
- `src/pages/CreditCards.tsx` — `handlePayInvoice` (multiplos pagamentos), UI (badge parcial, pagar remanescente), `handleReopenInvoice`, estorno dropdown
- `src/pages/Transactions.tsx` — auto-sync (loop paymentTransactionIds), `handleClosePeriod` (array), `handleEstorno` + dialogo
- `src/components/TransactionDialog.tsx` — 3 sync blocks (paidAmount), `populateEdit` (resolveCategoryId)
- `src/lib/cashCoverage.ts` — `parcial` usa saldo remanescente
- `src/lib/invoiceAnalysis.ts` — `parcial` tratado como `closed`
- `src/lib/pdfTemplates.ts` — status label "PARCIAL", cor amber
- `src/pages/Dashboard.tsx` — filtros `parcial`, saldo remanescente, migration trigger, alerta limite, `getBudgetImpact`
- `src/pages/Reports.tsx` — badge "Pagamento Parcial", `getBudgetImpact`
- `src/pages/Budgets.tsx` — `getBudgetImpact`
- `src/pages/Settings.tsx` — slider limite, paradigma orcamento
- `src/components/CategorySelect.tsx` — `resolveCategoryId`
- `src/services/categoryMigration.ts` — **novo** — scan e correcao de `categoryId` legado
- `.github/workflows/ci.yml` — **novo** — CI/CD

### Validacoes

- `npm run lint` — Sem erros
- `npm run test` — 53/54 passando (1 falha pre-existente por data fixa em `invoiceAnalysis.test.ts`)
- `npm run build` — Build OK

### Pendencias para proxima sessao

- Chave Groq em proxy — implementar Cloud Function / Vercel Edge, deploy pendente
- Testes de integracao — setup Firebase Emulator + cenarios core
- Consistencia de mutabilidade — transacoes de cartao editaveis (MASTER_PLAN §6 item 4)
- Central de Importacao Fase 3 — e-mail, app Android, Open Finance (longo prazo)
