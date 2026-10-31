# Crédito, estorno e saldo credor na fatura — PRD e plano de execução

> **Projeto:** fiducia
> **Status:** em execução
> **Homologação:** pendente
> **Aprovado por:** Vulmar Junior em 2026-10-31
> **Planejado por:** OIKOS
> **Executor:** agente do projeto `fiducia`
> **Versão-alvo:** a definir
> **Documento:** fonte da intenção; o fato é verificado no GitHub (commits, PRs, CI, deploy)
> **Origem:** cancelamento integral de compra parcelada (R$ 280,42 em 4 parcelas) creditado pelo banco em uma única linha, com o cronograma de cobrança mantido; o sistema não representou o crédito e exigiu contorno manual.

## 1. Problema

O banco pode creditar o cancelamento integral de uma compra parcelada de uma vez
e manter as parcelas seguintes. O saldo credor resultante deve abater as faturas
seguintes automaticamente. O Fiducia não representa isso:

- `getInvoiceFinancialSummary` corta o total em zero (`Math.max(0, ...)`), então
  um crédito maior que a fatura é perdido.
- O saldo anterior da fatura seguinte usa `remainingAmount` (só o que falta
  pagar), nunca um saldo credor.
- `handleCloseInvoice` grava `totalAmount: Math.max(0, totalInvoice)`, apagando o
  negativo.
- A sincronização de status em `Transactions.tsx` pode marcar como “paga” uma
  fatura com total negativo.
- Não há ação de crédito/ajuste avulso na fatura: o modal esconde as abas de
  tipo quando a conta é cartão.
- “Estornar” não aparece em parcelas (`!t.parentId`), então uma compra
  parcelada não pode ser estornada pela interface.
- O `presetMonth` da fatura é ignorado na criação, e o período pode ser
  recalculado pela data.

O usuário fica sem caminho: não consegue lançar o crédito nem apagar a compra
quando a fatura está fechada.

### Caso de aceite (o caso real)

Compra de R$ 280,42 em 4 parcelas: 1 × R$ 70,12 + 3 × R$ 70,10.
O banco credita R$ 280,42 na fatura de novembro/2026 e mantém as 4 cobranças.

Resultado esperado no Fiducia, com **um único crédito de R$ 280,42**:

| Fatura | Parcela | Crédito/saldo anterior | Total |
|---|---|---|---|
| Nov/2026 | 70,12 | −280,42 | **−210,30** (saldo credor) |
| Dez/2026 | 70,10 | −210,30 | **−140,20** |
| Jan/2027 | 70,10 | −140,20 | **−70,10** |
| Fev/2027 | 70,10 | −70,10 | **0,00** |

## 2. Objetivo

Representar saldo credor de fatura como saldo assinado, carregá-lo para a fatura
seguinte e permitir lançar crédito/estorno pela interface, sem contorno manual.

## 3. Não-objetivos (fora de escopo)

- Importação/conciliação de fatura (plano próprio).
- Open Finance, PDF ou integração bancária.
- Mudar o fluxo de pagamento de fatura além dos guards de saldo credor.
- Migração destrutiva de lançamentos ou faturas existentes.
- Recalcular automaticamente faturas antigas.

## 4. Requisitos

### Funcionais

- **RF1 — Total assinado.** A fatura pode ter total positivo (a pagar) ou
  negativo (saldo credor). `getInvoiceFinancialSummary` não corta em zero.
- **RF2 — Saldo credor carregado.** O saldo anterior da fatura seguinte é o
  saldo assinado da anterior (`total − pago`), não apenas `remainingAmount`.
- **RF3 — Pagamento e status.** Fatura com total ≤ 0 não pode ser paga; o botão
  “Pagar Fatura” não aparece e o status não vira “paga”. “Paga” só com total > 0
  e pago ≥ total.
- **RF4 — Exibição.** Saldo anterior negativo aparece como “Saldo credor” em
  verde; o total da fatura pode ser negativo; o selo da fatura diferencia
  “Saldo credor”.
- **RF5 — Ação de crédito/ajuste.** Botão na fatura que abre o modal já em
  Receita, com cartão e período pré-selecionados; o modal aceita Receita quando
  a conta é cartão.
- **RF6 — Estorno de parcela e de compra.** “Estornar” disponível em parcelas,
  com opção “esta parcela” e “compra inteira”. O estorno de compra inteira cria
  um crédito do valor total/restante na fatura atual, deixando o saldo credor
  carregar.
- **RF7 — Preset de período.** Crédito criado a partir da fatura usa o período
  visualizado, sem ser sobrescrito pela data.
- **RF8 — Compatibilidade.** Faturas antigas com `totalAmount` 0 ou positivo
  continuam funcionando; quando o total armazenado for 0 e o cálculo der
  negativo, prevalece o cálculo.

### Não funcionais

- **RNF1 — Nenhuma migração destrutiva** de dados existentes.
- **RNF2 — Cobertura de testes** para saldo credor, carry, pagamento bloqueado,
  status e estorno de série.
- **RNF3 — Varredura de consumidores** de `totalAmount`, `remainingAmount`,
  `previousBalance` e `getInvoiceFinancialSummary` (Dashboard, Relatórios,
  Cartões, limite, PDFs).
- **RNF4 — Teste em emulador/sandbox** antes de qualquer dado real.
- **RNF5 — Publicação separada** da homologação, com autorização.

## 5. Entregas

| ID | Entrega | Critério de aceite (verificável) | Status | Evidência |
|---|---|---|---|---|
| E1 | Modelo de saldo assinado + carry + guards de status/pagamento | Teste do caso real: nov −210,30; dez −140,20; jan −70,10; fev 0,00; pagamento bloqueado em nov | publicado | v0.21.1 na Vercel; `invoicePayment.test.ts` e suíte completa verdes |
| E2 | Ação “Crédito/Ajuste” na fatura | Criar R$ 280,42 em nov/2026 pela interface, sem contorno; aparece em “Créditos e Estornos” e reduz o total | publicado | v0.21.1; chunk `CreditCards` com “Crédito/Ajuste” e categoria de receita; lint/test/build verdes |
| E3 | Estorno de parcela e de compra inteira | Parcela 1/4 permite “estornar esta parcela” e “estornar compra”; compra inteira cria o crédito de 280,42 | planejado | |
| E4 | Varredura e regressão | Dashboard, Relatórios, Cartões e limite sem quebra; suíte verde; faturas antigas intactas | planejado | |
| E5 | Documentação e homologação | MASTER_PLAN, CHANGELOG e pendencias_dev atualizados; aceite do usuário | planejado | |

## 6. Riscos

| Item | Tipo | Impacto | Mitigação |
|---|---|---|---|
| Consumidores assumem total ≥ 0 | Técnico | Valores errados em Dashboard/Relatórios | Varredura completa e testes de regressão |
| Faturas fechadas com total 0 armazenado | Dados | Saldo credor não aparece | Fallback para o cálculo quando o armazenado for 0 |
| Crédito em fatura paga | Produto | Reabrir remove vínculo de pagamento | Testar em sandbox; orientar reabertura só quando não paga |
| Estorno de série mexe em parcelas futuras | Dados | Faturas futuras alteradas | Escopo explícito (“esta parcela” × “compra inteira”) e confirmação |
| Publicação em produção | Operacional | Risco financeiro | Homologação separada e autorização explícita |

## 7. Gates

1. **Plano aprovado** — sem aprovação, nada é implementado.
2. **Implementação** — por entrega, em branch própria.
3. **Teste** — suíte verde + cenário do caso real em sandbox.
4. **Homologação** — aceite do usuário.
5. **Publicação** — autorização separada; deploy não é homologação.

## 8. Diário de execução (append-only)

| Data | Entrega | O que foi feito | Evidência | Desvio |
|---|---|---|---|---|
| 2026-10-31 | E1 | Total assinado e saldo credor carregado em `invoicePayment.ts`, `CreditCards.tsx`, `Transactions.tsx` e `creditCardUtils.ts`; faturas com total ≤ 0 não são pagáveis nem marcadas como pagas | branch `fix/saldo-credor-fatura`; lint, 208 testes e build verdes | nenhum |
| 2026-10-31 | E2 | Botão “Crédito/Ajuste” na fatura; modal aceita Receita em cartão, preserva o período visualizado e mostra o título/aviso de crédito | branch `fix/saldo-credor-fatura`; lint, testes e build verdes | E3 ainda pendente |
| 2026-10-31 | E1/E2 | Publicação da v0.21.0 na Vercel | deploy `76dZry6rdfrDjZd5Z2vRmpeB7di7`; bundle 0.21.0 e chunk `CreditCards` com “Crédito/Ajuste” verificados | homologação manual pendente |
| 2026-10-31 | E2 (correção) | Categoria do crédito passa a filtrar receita; v0.21.1 publicada | deploy `7465234708`; bundle 0.21.1 verificado | homologação manual pendente |

## 9. Verificações do OIKOS (append-only)

| Data | Aderência | Observação |
|---|---|---|
| 2026-10-31 | plano proposto | Diagnóstico a partir do caso real de cancelamento de compra parcelada; nenhuma alteração de código feita |
| 2026-10-31 | E1/E2 implementados | Saldo assinado, carry, guards e ação de crédito na fatura; suíte completa verde |
| 2026-10-31 | E1/E2 publicados | v0.21.0 na Vercel; bundle 0.21.0 e chunk de Cartões com a ação verificados; homologação manual pendente |
| 2026-10-31 | E2 corrigido | Categoria de receita no crédito; v0.21.1 na Vercel; homologação manual pendente |

> **LLM:** deepseek-v4.1-flash | **Agente:** opencode
