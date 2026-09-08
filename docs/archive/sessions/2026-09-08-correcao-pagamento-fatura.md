# Correções de pagamento de fatura — 2026-09-08

> **LLM:** deepseek-v4-pro | **Agente:** opencode

## Resultado

Entrega local 0.20.7. Removida a comparação decimal antecipada que bloqueava a quitação de 6803,88 após pagamento de 6000 em uma fatura de 12803,88. A validação permanece em calculateInvoicePayment, dentro da transação Firestore, com leitura atualizada e cálculo em centavos. O cálculo de pagamento adota o vínculo canônico do cartão e o resumo usado pela tela.

Corrigida a perda de obrigações documentais nos relatórios: ausência de recálculo difere de total recalculado zero. Quando há compras em fatura aberta, o relatório calcula o total e desconta pagamentos registrados. Regras duradouras registradas em docs/LOGICA_DO_SISTEMA.md.

## Arquivos

- src/pages/CreditCards.tsx; src/lib/invoicePayment.ts; src/lib/reports/invoiceEvents.ts
- src/lib/invoicePayment.test.ts; src/lib/reports/invoiceEvents.test.ts
- scratch/fix-invoices.ts: remoção de três imports ociosos; script continua sem executar migração
- package.json; package-lock.json; src/lib/utils.ts: versão 0.20.7
- AGENTS.md; CHANGELOG.md; docs/MASTER_PLAN.md; docs/LOGICA_DO_SISTEMA.md; docs/pendencias_dev.md

## Validações

- npm run lint: aprovado.
- npm run test: 192 aprovados, 3 cenários do emulador ignorados.
- Após adicionar mais um cenário de relatório: npm run test -- src/lib/reports/invoiceEvents.test.ts, 4 aprovados (3 existentes e 1 adicional).
- npm run build: aprovado, incluindo PWA; aviso de chunk Firebase maior que 500 kB.
- Testes cobrem quitação exata, excesso de um centavo, total documental sem recálculo, recálculo explícito zero e fatura aberta com compras e pagamento prévio.

## Limites e próxima pauta

Sem validação visual autenticada ou execução do emulador nesta sessão. Nenhum pagamento real, migração, commit, push ou deploy executado. Usuário deve validar o cenário na aplicação atualizada antes de autorizar publicação. Android permanece pausado.

Consulta anterior confirmou main local e remoto em 4fdca5b; esta entrega acrescenta alterações locais ainda não publicadas.
