# Plano — Relatório de Análise de Faturas de Cartão

> **LLM:** deepseek-v4-pro | **Agente:** opencode

---

## Objetivo

Criar uma nova aba em `/reports` para analisar o comportamento das faturas de cartão de crédito ao longo do tempo: evolução mensal, peso por cartão, faturas abertas/fechadas/pagas e comprometimento futuro já assumido.

---

## Fase 1 — Diagnóstico dos Dados

**Esperado:**

- Mapear como `transactions`, `creditCards` e `invoices` representam faturas.
- Confirmar regra de vencimento por `closingDay` e `dueDay`.
- Separar claramente:
  - fatura aberta;
  - fatura fechada;
  - fatura paga;
  - parcelas futuras ainda não pagas;
  - pagamentos, estornos e ajustes.

**Entrega:**

- Lista das fontes de dados e fórmulas oficiais do relatório.

---

## Fase 2 — Motor de Análise

**Esperado:**

- Criar função central, por exemplo `buildInvoiceAnalysis()`.
- Entrada:
  - cartões;
  - transações;
  - invoices;
  - período selecionado.
- Saída:
  - totais por status;
  - totais por cartão;
  - totais por mês;
  - maior fatura;
  - média mensal;
  - variação mês a mês;
  - lista detalhada de faturas.

**Entrega:**

- Arquivo novo em `src/lib/invoiceAnalysis.ts`.
- Testes unitários em `src/lib/invoiceAnalysis.test.ts`.

---

## Fase 3 — KPIs da Aba

**Esperado:**

- Exibir cards principais:
  - Faturas abertas;
  - Faturas fechadas;
  - Faturas pagas no período;
  - Comprometimento futuro;
  - Média mensal;
  - Maior fatura.

**Entrega:**

- KPIs integrados em nova aba de relatórios.
- Valores conferidos contra dados reais de cartão.

---

## Fase 4 — Gráficos

**Esperado:**

- Gráfico de barras empilhadas por mês e cartão.
- Linha de tendência do total mensal.
- Donut de participação por cartão.
- Cores consistentes por cartão.

**Entrega:**

- Visualização clara de crescimento, concentração e sazonalidade das faturas.

---

## Fase 5 — Tabela Detalhada

**Esperado:**

- Tabela com:
  - cartão;
  - período;
  - status;
  - vencimento;
  - valor;
  - participação no total;
  - diferença contra mês anterior.
- Clique na linha leva para `/cards` com o cartão selecionado, se possível.

**Entrega:**

- Lista auditável para validar os gráficos.

---

## Fase 6 — Filtros

**Esperado:**

- Período: 3M / 6M / 12M / personalizado.
- Cartão: todos ou um cartão específico.
- Status: aberta / fechada / paga / futura / todos.
- Toggle para incluir ou excluir estornos/créditos.

**Entrega:**

- Relatório útil tanto para visão geral quanto para investigação de um cartão específico.

---

## Fase 7 — Documentação e Validação

**Esperado:**

- Atualizar `docs/calculo_metricas.md`.
- Atualizar `CHANGELOG.md`, `MASTER_PLAN.md` e `pendencias_dev.md` se houver entrega.
- Rodar:
  - `npm run lint`;
  - `npm run test`;
  - `npm run build`.

**Entrega:**

- Relatório documentado, testado e pronto para uso.

---

## Resultado Esperado

Ao final, o Fiducia deve responder:

> Minhas faturas estão crescendo ou caindo?
> Qual cartão está concentrando mais gasto?
> Quanto já está fechado, quanto ainda pode crescer e quanto do futuro já está comprometido?
