# Crédito, saldo credor e ajustes da fatura (v0.21.0–v0.21.2)

> **LLM:** deepseek-v4.1-flash | **Agente:** opencode
> Sessão de 31/10/2026. Pausada para retomada posterior.

## Contexto

Cancelamento integral de uma compra parcelada de R$ 280,42 (1 × 70,12 + 3 × 70,10). O banco creditou os R$ 280,42 em uma única linha na fatura de novembro/2026 e manteve o cronograma das quatro parcelas. O Fiducia não representava saldo credor: o total era cortado em zero, o crédito excedente era perdido e não havia ação de crédito avulso na fatura. O usuário estava sem caminho para lançar o estorno nem para apagar a compra.

## Entregue

### v0.21.0 — crédito e saldo credor

- `src/lib/invoicePayment.ts` — total assinado; `creditAmount` e `balanceAmount`; pagamento bloqueado para total ≤ 0.
- `src/pages/CreditCards.tsx` — saldo anterior assinado e carregado; total/selo “Saldo Credor”; ação **Crédito/Ajuste**; fechamento grava o total real; pagamento bloqueado.
- `src/pages/Transactions.tsx` — sincronização de status não marca fatura negativa como paga.
- `src/components/TransactionDialog.tsx` — aceita Receita em cartão, preserva o período da fatura e mostra título/aviso de crédito.
- `src/utils/creditCardUtils.ts` — limite comprometido considera o saldo credor carregado.
- Testes: 208 passaram, 3 ignorados; `tsc`, `vitest` e `build` verdes.

### v0.21.1 — categoria de receita

- `TransactionDialog.tsx` — o filtro de categoria do cartão acompanha o tipo: receita no crédito, despesa na despesa.

### v0.21.2 — layout do modal da fatura

- Cabeçalho com `shrink-0`, ações com quebra de linha e corpo com `min-h-0`/rolagem no modal da fatura; mesmo ajuste no modal de lançamento, revisão de PDF e conferência.
- O usuário confirmou o ajuste de layout (“deu certo”).

## Publicação

| Versão | Commit | Deploy | CI |
|---|---|---|---|
| 0.21.0 | `6046f9a` | `7465111393` | success |
| 0.21.1 | `e6e0a99` | `7465234708` | success |
| 0.21.2 | `16d99cf` | `7465393000` | success |

Docs: `d63c374`, `2ba9d89`, `dc2d793`. `APP_VERSION` 0.21.2 confirmada no bundle de produção.

## Homologação pendente

- Lançar o crédito de **R$ 280,42** na fatura de novembro/2026 e conferir:
  - nov **−210,30**; dez **−140,20**; jan **−70,10**; fev **0,00**;
  - crédito em “Créditos e Estornos”; “Pagar fatura” oculto;
  - cartão na lista com “Saldo credor”.
- As quatro parcelas originais precisam existir no Fiducia.

## Pendências

- **E3:** “Estornar” em parcelas (esta parcela / compra inteira).
- **E4:** projeções de Dashboard/Relatórios com saldo credor carregado.
- **Importador de fatura de cartão:** plano proposto em `docs/planos/PLANO_IMPORTACAO_FATURA_CARTAO.md`; retomar em sessão futura. Teste de 31/10/2026 com o XLSX do Itaú:
  - cabeçalho real na linha 14; sem limpeza, retorna “Nenhuma linha de fatura foi identificada”;
  - após limpeza manual, 119 linhas reconhecidas, mas o matching marca muitos lançamentos já existentes como “Faltando” (janela de período/cartão e política de matching);
  - total declarado R$ 12.608,99; dois Pagamento Pix −10.425,15; soma de todas as linhas R$ 2.183,84;
  - PDF continua frágil; a limpeza manual não é solução.
- **Homologação do crédito** e **E3/E4** ficam para a retomada.

## Riscos

- Reabrir fatura paga remove o vínculo do pagamento.
- Crédito em fatura fechada exige reabrir; a fatura de novembro estava aberta.
- “Importar PDF” cria lançamentos sem comparar; para conferência, usar sempre “Conferir Fatura”.

## Fontes

- Planos: `docs/planos/PLANO_CREDITO_ESTORNO_SALDO_CREDOR.md` e `docs/planos/PLANO_IMPORTACAO_FATURA_CARTAO.md`.
- Commits e deploys listados acima; `CHANGELOG.md` v0.21.0–v0.21.2.
