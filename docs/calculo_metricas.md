# Relatório Técnico: Cálculo de Indicadores e Métricas no Fiducia

> **LLM:** deepseek-v4-pro | **Agente:** opencode

Este relatório descreve com precisão as regras de negócio e matemáticas aplicadas no sistema para obter cada um dos indicadores exibidos nos painéis de **Dashboard** e **Relatórios**.

O sistema opera em dois regimes paralelos: **Regime de Caixa** (baseado em pagamento efetivo e liquidez) no Dashboard, e **Regime de Competência** (baseado na data do compromisso) nos Relatórios.

---

## 1. Visão Geral (Dashboard)

A tela inicial prioriza o acompanhamento em **Regime de Caixa** e a saúde da sua liquidez de curto prazo.

### 💰 Saldo Geral
- **O que é**: O somatório bruto do dinheiro que você possui em todas as instituições.
- **Como é calculado**: É a soma direta do campo `balance` (saldo atual) de **todas as contas cadastradas**, incluindo conta corrente, poupança, carteira (dinheiro físico) e contas marcadas como investimento.

### 📈 Receitas do mês
- **O que é**: O dinheiro que *efetivamente* entrou no seu bolso durante o mês atual.
- **Como é calculado**: Soma de todas as transações do tipo "Receita" cuja data pertença ao mês corrente (ou fatura corrente) **E** que estejam marcadas com o status **"Pago"** ou **"Realizado"**. Receitas pendentes não entram neste cálculo para evitar a falsa sensação de dinheiro disponível.

### 📉 Despesas do mês
- **O que é**: O dinheiro que *efetivamente* saiu da sua conta neste mês.
- **Como é calculado**: Soma de todas as transações do tipo "Despesa" cuja data pertença ao mês corrente **E** que também estejam com status **"Pago"** ou **"Realizado"**. Assim como as receitas, faturas ou despesas apenas agendadas/pendentes não inflam este número.

### 🛡️ Disponível Seguro (Métrica Principal)
- **O que é**: A métrica exclusiva do Fiducia que protege você da falsa sensação de riqueza. Responde à pergunta: *"Quanto dinheiro me sobra agora se eu descontar todos os meus compromissos pendentes?"*
- **Como é calculado**: `Saldo Circulante` − `Faturas de Cartão` − `Contas Pendentes`
  1. **Saldo Circulante**: Soma do saldo apenas das contas que **não estão** marcadas como "Excluir do fluxo de caixa" (ignora suas reservas e investimentos).
  2. **Faturas de Cartão**: Soma do valor total das faturas de cartão de crédito nos status "Aberta" (compras deste mês) e "Fechada" (vencendo em breve). Faturas "Pagas" não são deduzidas, pois o dinheiro já foi abatido da sua conta corrente.
  3. **Contas Pendentes**: Soma das despesas no débito/dinheiro/pix (sem cartão de crédito) que estão "Pendentes" e cujo vencimento é até a data de hoje (atrasadas ou vencendo hoje).

### 📊 Gráfico Fluxo de Caixa (Dashboard)
- **O que é**: A visualização de tendência (em formato de "montanha" / gráfico de área) de como o dinheiro real transita.
- **Como é calculado**: Pode ser visto em intervalos semanais, mensais ou anuais. O gráfico consolida a soma das "Receitas do mês" e "Despesas do mês" (apenas status Pago/Realizado) para cada período do eixo X.

---

## 2. Análise Financeira (Relatórios)

A tela de Relatórios trabalha sob o **Regime de Competência**. Aqui o que importa não é quando você pagou, mas sim quando você *assumiu o compromisso* da compra ou da renda.

### 🏦 Patrimônio Líquido
- **O que é**: A representação da sua força financeira global registrada no sistema.
- **Como é calculado**: Atualmente, ele reflete a soma total do saldo de **todas as contas** ativas no banco de dados. 
> [!NOTE]
> Segundo a documentação de arquitetura, o cálculo conceitual ideal abate as dívidas de cartão de crédito. Atualmente o sistema usa a visão otimista (igual ao "Saldo Geral") como reflexo do dinheiro absoluto sob custódia.

### 💡 Economia do Mês
- **O que é**: O saldo do balanço de competência do mês corrente.
- **Como é calculado**: `Receitas Totais do Mês` − `Despesas Totais do Mês`. Diferente do Dashboard, aqui entram **todas** as transações do mês vigente, independentemente se já foram pagas ou se ainda estão pendentes. O foco é avaliar se o seu *orçamento* mensal foi superavitário ou deficitário.

### 🎯 Taxa de Poupança
- **O que é**: Qual a porcentagem de tudo que você ganhou neste mês que conseguiu ser salva/poupada.
- **Como é calculado**: `(Economia do Mês / Receitas Totais do Mês) * 100`. Se a "Economia do Mês" for negativa (gastou mais do que ganhou), a taxa será menor que zero ou zero.

### 💸 Gastos Totais (Mês)
- **O que é**: O impacto integral do consumo que você gerou neste mês.
- **Como é calculado**: Soma estrita de todas as transações do tipo "Despesa" que carregam a data de competência (data da compra/vencimento) dentro do mês e ano atuais. Novamente, engloba itens pendentes.

### 📊 Fluxo de Caixa Mensal (Gráfico de Barras)
- **O que é**: O comparativo histórico dos últimos 6 meses.
- **Como é calculado**: Para cada um dos 6 meses anteriores, agrupa-se todas as Receitas (barra verde) e todas as Despesas (barra vermelha) lançadas naquele período. Baseia-se integralmente no `invoicePeriod` ou prefixo da data para alocação de meses.

### 📉 Tendência de Gastos (Evolução Diária)
- **O que é**: Um gráfico que mostra a "queima" do seu orçamento ao longo dos dias do mês atual.
- **Como é calculado**: O sistema percorre o mês desde o dia `01` até o dia de `hoje`. Para cada dia, ele soma as despesas e as acumula com o valor do dia anterior (soma cumulativa). Resulta em uma linha ascendente que permite visualizar em quais dias do mês ocorreram os maiores saltos de gasto.

---

## 3. Cobertura de Caixa e Previsão de Obrigações (v0.2.0)

A partir da versão `0.2.0`, a previsão de caixa passa a usar um motor único em `src/lib/cashCoverage.ts`. O objetivo é responder se o caixa atual somado aos valores a receber cobre as obrigações assumidas e projetadas ao longo do tempo.

### Fontes consideradas

| Fonte | Tratamento | Data usada |
|-------|------------|------------|
| Saldo de contas | Caixa inicial | Data atual |
| Receitas pendentes bancárias | Entrada futura confirmada | Data da transação |
| Despesas pendentes bancárias | Saída futura confirmada | Data da transação |
| Fatura fechada | Obrigação confirmada de cartão | Vencimento da fatura |
| Fatura aberta | Obrigação esperada de cartão | Vencimento provável da fatura |
| Períodos futuros de cartão | Comprometimento projetado | Vencimento da fatura futura |

Contas marcadas com `excludeFromCashFlow` ficam fora do caixa inicial, salvo quando a opção de incluir investimentos/reservas estiver ativa.

### Simulação diária

O motor transforma cada compromisso em um evento financeiro datado e calcula:

```text
saldo_dia = saldo_dia_anterior + entradas_do_dia - saidas_do_dia
```

Itens atrasados são aplicados na data atual para evitar que o passado distorça a projeção, mas preservam a data original para exibição de alerta.

### Indicadores gerados

| Indicador | Significado |
|-----------|-------------|
| `startingBalance` | Caixa inicial considerado na projeção |
| `totalIncome` | Total de valores a receber no período |
| `totalObligations` | Total de despesas bancárias + faturas de cartão no período |
| `coverageBalance` | `startingBalance + totalIncome - totalObligations` |
| `minimumBalance` | Menor saldo diário projetado |
| `minimumBalanceDate` | Data em que ocorre o menor saldo |
| `firstRiskDate` | Primeira data em que o saldo fica negativo |
| `totalClosedInvoices` | Faturas fechadas ainda não pagas |
| `totalOpenInvoices` | Faturas abertas do período corrente |
| `totalFutureCard` | Compromissos de cartão em períodos futuros |

### Interpretação

Uma cobertura final positiva não elimina risco. Se `minimumBalance` ficar negativo em algum dia, o sistema deve alertar descasamento de datas: o usuário pode ter dinheiro suficiente no período, mas não no dia em que a obrigação vence.

---

## 6. Relatório de Análise de Faturas de Cartão (v0.3.0)

Nova aba "Faturas" em Relatórios, disponível em `src/pages/Reports.tsx` (aba 6) com motor em `src/lib/invoiceAnalysis.ts`.

### Fontes de dados

| Fonte | Coleção Firestore | Campos relevantes |
|-------|-------------------|-------------------|
| Transações | `transactions` | `type`, `amount`, `status`, `accountId`, `creditCardId`, `invoicePeriod` |
| Cartões | `creditCards` | `name`, `closingDay`, `dueDay` |
| Faturas | `invoices` | `cardId`, `period`, `status`, `totalAmount` |

### Métricas calculadas

| Indicador | Fórmula |
|-----------|---------|
| **Faturas Abertas** | Soma dos valores de faturas com status `open` no período selecionado |
| **Faturas Fechadas** | Soma dos valores de faturas com status `closed` no período |
| **Pagas no Período** | Soma das faturas com status `paid` no período |
| **Comprometimento Futuro** | Soma das parcelas pendentes com `invoicePeriod` futuro ao mês corrente |
| **Média Mensal** | `(totalOpen + totalClosed + totalPaid) / mesesComDados` |
| **Maior Fatura** | `max(amount)` entre todas as faturas do período |

### Determinação de status

1. Se há documento `Invoice` persistido com `status` explícito → usa o status do documento
2. Senão, calcula por data:
   - `today < closingDate` → **aberta**
   - `today >= closingDate && today < dueDate` → **fechada**
   - `today >= dueDate` → **paga**
3. Se o período é futuro ao mês corrente **E** não há transações realizadas/pagas no período → **futura** (projeção de parcelamento)

### Cálculo do valor da fatura

- **Sem estornos** (`includeCredits = false`): `sum(despesas do período)`
- **Com estornos** (`includeCredits = true`): `max(0, despesas - pagamentos - créditos)`

### Variação mês a mês

Para cada fatura no período `N`, compara-se com a fatura do mesmo cartão no período `N-1`:
```
variação = (amount_N - amount_{N-1}) / amount_{N-1} * 100
```

### Gráficos

- **Barras empilhadas** (mês × cartão): `monthlyData.cards[cardId]` agrupado por `stackId`
- **Donut**: `cardBreakdown` — participação percentual de cada cartão no total do período
- **Tendência (área)**: `trend` — total mensal ao longo do período selecionado

### Filtros disponíveis

| Filtro | Opções | Estado |
|--------|--------|--------|
| Período | 3M / 6M / 12M / Personalizado | `invPeriod` |
| Cartão | Todos / cartão específico | `invSelectedCard` |
| Status | Todas / Abertas / Fechadas / Pagas / Futuras | `invStatusFilter` |
| Estornos | Incluir / Excluir | `invIncludeCredits` |

---

## 7. Análise Inteligente com Groq (v0.3.1)

A aba "Análise IA" em Relatórios foi refatorada para enviar dados calculados pelos motores internos do Fiducia em vez de enviar transações brutas.

### Decisão arquitetural

> A Groq interpreta dados calculados pelo Fiducia. Ela não é fonte de verdade dos cálculos financeiros.

### Motores acionados

| Motor | Arquivo | Dados fornecidos |
|-------|---------|------------------|
| Cobertura de Caixa | `src/lib/cashCoverage.ts` | Saldo inicial, total a receber, obrigações, saldo projetado mínimo, primeira data de risco |
| Análise de Faturas | `src/lib/invoiceAnalysis.ts` | Faturas abertas/fechadas/pagas/futuras, média mensal, maior fatura, breakdown por cartão |
| Categorias | Cálculo inline | Top 5 despesas e receitas do ano com peso percentual |
| Fluxo de Caixa | Cálculo inline | Últimos 3 meses com receitas, despesas e saldo |
| Orçamentos | Cálculo inline | Itens estourados no mês corrente |

### Funções principais

| Função | Arquivo | Descrição |
|--------|---------|-----------|
| `buildFinancialInsightContext()` | `src/lib/financialInsight.ts` | Reúne dados de todos os motores em um contexto estruturado com seções: `health`, `cashCoverage`, `invoices`, `categories`, `cashflow`, `budgets`, `criticalDates` |
| `buildGroqFinancialAnalysisPrompt()` | `src/lib/financialInsight.ts` | Gera prompt com regras rigorosas (não inventar, não recalcular, ser específico) e formato fixo de 5 seções na resposta |

### Formato da resposta da IA

1. **Diagnóstico Principal** — resumo da situação financeira
2. **Datas Críticas** — dias de atenção e por quê
3. **Principais Causas** — o que está pressionando ou aliviando
4. **Riscos se Nada Mudar** — cenário projetado
5. **Ações Recomendadas** — por ordem de impacto, com valores e datas

### Parâmetros da chamada Groq

- **Modelo:** `llama-3.3-70b-versatile`
- **Temperatura:** 0.5 (reduzida de 0.7 para respostas mais consistentes)
- **Max tokens:** 1200 (aumentado de 1000 para comportar as 5 seções)