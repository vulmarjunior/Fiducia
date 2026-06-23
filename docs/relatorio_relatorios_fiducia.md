# Relatório Completo: Sistema de Relatórios do Fiducia

> **LLM:** deepseek-v4-pro | **Agente:** opencode
> **Versão do código:** 0.1.0 | **Data:** 2026-06-23

---

## 1. Visão Arquitetural — Dois Regimes Paralelos

O Fiducia opera com **dois regimes contábeis simultâneos** (conforme `docs/calculo_metricas.md` e `MASTER_PLAN.md` §8 decisão #5):

| Regime | Tela | Princípio | Transações Consideradas |
|--------|------|-----------|------------------------|
| **Regime de Caixa (Cash Basis)** | Dashboard | "O que entrou/saiu **realmente**" | Apenas status **Pago/Realizado** |
| **Regime de Competência (Accrual)** | Relatórios | "O que **comprometi** (data da compra/vencimento)" | **Todas** (Pago + Pendente) |

> **Implicação prática**: Dashboard mostra sua liquidez real *agora*; Relatórios mostram se seu orçamento mensal *fechou no azul ou vermelho*.

---

## 2. Dashboard — Cards e Indicadores Principais

Fonte: `src/pages/Dashboard.tsx`

### 2.1 Cards KPI (Linha superior)

| Card | Fonte | Cálculo |
|------|-------|---------|
| **Saldo Geral** | `accounts.reduce(sum, balance)` | Soma de **todas** as contas (corrente, poupança, carteira, investimento) |
| **Receitas do mês** | Transações `type=receita/income` + `isEffectivelyPaid()` + mês atual + `!creditCardId` + `!transfer` | Só realizadas |
| **Despesas do mês** | Transações `type=despesa/expense` + `isEffectivelyPaid()` + mês atual + `!creditCardId` + `!transfer` | Só realizadas |
| **Cobertura de Caixa (90 dias)** | `projectDailyBalance()` — ver seção 3 deste relatório | Projeção diária com risco de descoberto |

**Badges de tendência**: Comparação com mês anterior via `getPreviousPeriod()`. Exibe `+X%` ou `-X%` ao lado de receitas/despesas.

### 2.2 Gráfico de Fluxo de Caixa (Dashboard) — `AreaChart` Recharts

**Local**: `Dashboard.tsx:575-621`
**Períodos**: Semana (8 semanas), Mês (6 meses), Ano (12 meses) — `getChartPeriods()`

**Filtros aplicados**:
- `isChartRelevant()`: `isEffectivelyPaid()` **OU** (`showPendingChart` E status pendente)
- Exclui: cartão de crédito (`creditCardId` ou `accountId` de cartão), transferências

**Séries**:
- **Receitas** (área verde, gradiente `#22c55e` com opacidade)
- **Despesas** (área vermelha, gradiente `#ef4444` com opacidade)
- **Inclui faturas de cartão** no modo "Mês" quando `showPendingChart=true`: soma `invoices[period].totalAmount` onde `status !== 'paga'`

**Correção de timezone**: Usa `parseLocalDate()` (`utils.ts:70`) para evitar bug de `new Date("YYYY-MM-DD")` interpretar como UTC.

### 2.3 Cards Secundários (Coluna Direita)

- **Contas a Pagar**: Despesas pendentes + atrasadas + faturas cartão não pagas. Ordenado por data. Inclui `unpaidInvoices` gerado a partir de `creditCards.flatMap`.
- **Contas a Receber**: Receitas pendentes + atrasadas. Sem cartão.
- **Metas Financeiras**: Top 3 metas com barra de progresso.
- **Orçamentos**: Top 4 orçamentos com % utilizado e indicador de estouro.

---

## 3. Cobertura de Caixa (Cash Coverage) — O Coração Preditivo

### 3.1 O que é
Métrica exclusiva do Fiducia que **simula o saldo diário pelos próximos 90 dias** aplicando receitas, despesas pendentes e vencimentos de faturas **na ordem cronológica**. Detecta risco de descoberto por **descasamento de datas** (ex: receita dia 10, despesa dia 5).

### 3.2 Implementação — `projectDailyBalance()` em `utils.ts:120-221`

```typescript
projectDailyBalance(accounts, transactions, creditCards, invoices, days=90)
```

**Retorno**:
```typescript
{
  startingBalance: number,        // saldo circulante hoje (contas !excludeFromCashFlow)
  minimumBalance: number,         // menor saldo projetado nos 90 dias
  minimumBalanceDate: string,     // data do menor saldo (YYYY-MM-DD)
  isAtRisk: boolean,              // true se minimumBalance < 0
  dailyProjection: [{ date, balance }]  // array de 90 dias
}
```

### 3.3 Algoritmo Passo a Passo

1. **Saldo Inicial** (`startingBalance`): Soma `balance` das contas onde `excludeFromCashFlow !== true`

2. **Constrói `dailyDeltas`** (mapa data → variação líquida):
   - **Transações pendentes conta corrente**:
     - Filtra: `status=pendente/pending` E `!creditCardId` E `!transfer`
     - Receita = `+amount`, Despesa = `-amount`
     - Se data < hoje → joga para **hoje** (evita saldo negativo retroativo)
   - **Faturas de cartão não pagas**:
     - Para cada cartão, identifica `invoicePeriod` únicos nas transações
     - Ignora faturas já `status=paga`
     - Calcula `balance = expenses - payments - incomes` do período
     - Lança `-balance` na **data de vencimento** (`dueDay` do cartão)

3. **Simulação diária** (loop 0..days-1):
   - `currentBalance += dailyDeltas[date] || 0`
   - Track `minBalance` e `minDate`

### 3.4 Exibição no Dashboard (`Dashboard.tsx:494-537`)

- **Valor principal**: `minimumBalance` (cor: roxo se OK, vermelho se risco)
- **Subtítulo**: Data do mínimo + mensagem contextual
- **Tooltip explicativo** (hover no ícone Info): explica a metodologia
- **Clique no card** → navega para `/reports` aba "Projeção Futura"

---

## 4. Tela de Relatórios (`/reports`) — 5 Abas

Fonte: `src/pages/Reports.tsx` (936 linhas)

### 4.1 Estrutura Geral
- **Dados**: 6 listeners Firestore em tempo real (transactions, categories, accounts, creditCards, budgets, invoices)
- **Estado**: Tudo em `useMemo` para performance
- **IA**: `callGroq()` com modelo `llama-3.3-70b-versatile`

---

### ABA 1 — FLUXO DE CAIXA (Regime de Competência)

**Local**: `Reports.tsx:91-118, 352-443`

**Controles**:
- Período: 3M / 6M / 12M / Ano
- Toggle: "Só Realizados" ↔ "Incluindo Pendentes"

**Cálculo (`cashFlowData`)**:
```typescript
// Para cada mês do período:
mTx = transactions.filter(
  t.date.startsWith(month) &&
  !isCreditCardTx(t) &&
  !isTransfer(t) &&
  (isEffectivelyPaid(t) || (showPending && isPending(t)))
)
Receitas = sum(mTx where isIncome)
Despesas = sum(mTx where isExpense)
Saldo = Receitas - Despesas
```

**Cards KPI** (4 cards):
| Card | Fórmula | Cor |
|------|---------|-----|
| Receitas no Período | `sum(Receitas de todos os meses)` | Verde |
| Despesas no Período | `sum(Despesas de todos os meses)` | Vermelho |
| Economia do Mês (último) | `cashFlowData[last].Saldo` | Azul / Vermelho |
| Taxa de Poupança | `(economia / receitas_ultimo_mes) * 100` | Âmbar |

**Gráfico**: `BarChart` agrupado (Receitas vs Despesas) — `Reports.tsx:400-408`
- Eixo X: meses
- Barras verdes = Receitas, vermelhas = Despesas
- Tooltip formatado em pt-BR

**Tabela Resumo**: Mês | Receitas | Despesas | Saldo do Mês

---

### ABA 2 — CATEGORIAS (Distribuição % + % Renda)

**Local**: `Reports.tsx:120-148, 449-537`

**Controles**:
- Período: Mês / 3M / 6M / 12M / Ano
- Tipo: Despesas / Receitas

**Cálculo (`categoryData`)**:
```typescript
periodTx = transactions.filter(
  !isTransfer && typeFilter && isEffectivelyPaid && date in [startStr, endStr]
)
total = sum(periodTx.amount)
incomeBase = sum(income transactions no período, sem cartão, sem transfer)

categories.filter(tipo correto).map(c => ({
  name: c.name,
  value: sum(periodTx where categoryId === c.id),
  pct: value / total * 100,
  pctIncome: value / incomeBase * 100   // % da renda total
}))
```

**Visualizações**:
- **Tabela** com 4 colunas: Categoria, Valor, % Total (com barra), % Renda
- **PieChart** (donut) com cores do array `COLORS` (10 cores fixas)
- **Legenda lateral** top 6 categorias com %

---

### ABA 3 — TENDÊNCIA & ORÇAMENTOS

**Local**: `Reports.tsx:151-172, 543-616`

#### 3.1 Tendência de Gastos (Evolução Diária Cumulativa)
**Gráfico**: `AreaChart` monótono (`Reports.tsx:555-568`)

```typescript
trendData = Array.from({length: diasDoMes}, (_, i) => {
  day = i + 1
  dateStr = `${currentMonthStr}-${day.padStart(2,'0')}`
  cumulative += sum(despesas do dia onde isEffectivelyPaid && !cartao && !transfer)
  return { day, amount: cumulative }
}).filter(d => d.day <= hoje)
```

- **Eixo X**: Dia 1..hoje
- **Eixo Y**: Acumulado de despesas pagas
- **Gradiente**: Azul translúcido (`#3b82f6` 20% → 0%)

#### 3.2 Orçado × Realizado
**Cálculo** (`budgetComparison`):
```typescript
budgets.filter(monthly).map(b => ({
  name: category.name,
  budget: b.amount,
  spent: sum(despesas mês atual, categoryId=b.id, isEffectivelyPaid),
  diff: budget - spent,
  pct: spent / budget * 100
}))
```
- **Barra de progresso**: Verde (<80%), Âmbar (80-100%), Vermelho (>100%)

---

### ABA 4 — PROJEÇÃO FUTURA (Cash Flow Projection)

**Local**: `Reports.tsx:174-264, 621-872` — A mais complexa do sistema

#### 4.1 Controles
| Controle | Opções |
|----------|--------|
| Período | 1M / 3M / 6M / 12M / Personalizado (date input) |
| Tipo | Todos / Receitas / Despesas |
| Categoria | Todas / Selecionar uma |
| Incluir Investimentos | Toggle (inclui contas `excludeFromCashFlow`) |

#### 4.2 Cálculo Base (`projectionData`)

```typescript
saldoBase = includeSavings
  ? sum(all accounts.balance)
  : sum(accounts where !excludeFromCashFlow).balance

// 1. Transações pendentes conta corrente (até data fim)
pendingTx = transactions.filter(
  isPending && !creditCardTx &&
  !accountId é cartão && !transfer &&
  date <= projEndDate
)

// 2. Faturas não pagas no período
pendingInvoices = invoices.filter(
  status !== 'paga' && period >= currentMonth && period <= projEndMonth
)

// 3. Gera array de meses do período
months = [currentMonth ... projEndMonth]

// 4. Para cada mês, acumula:
accum = saldoBase
months.map(m => {
  monthTx = pendingTx.filter(date.startsWith(m))
  monthInvoices = pendingInvoices.filter(period === m)

  incomeTotal = sum(monthTx where isIncome)
  expenseTotal = sum(monthTx where isExpense)
  invoiceTotal = sum(monthInvoices.totalAmount)
  net = incomeTotal - expenseTotal - invoiceTotal
  accum += net

  return { month, label, incomeTotal, expenseTotal, invoiceTotal, net, accum,
           incomeTxList, expenseTxList, invoiceList }
})
```

#### 4.3 KPIs Projetados (`projKPIs`)
- **Total a Receber**: `sum(incomeTotal de todos os meses)`
- **Total a Pagar**: `sum(expenseTotal + invoiceTotal de todos os meses)`
- **Total Faturas**: `sum(invoiceTotal de todos os meses)`
- **Saldo Projetado Final**: `accum` do último mês

#### 4.4 Gráfico Combinado (`ComposedChart`)
- **Barras**: "A Receber" (verde) + "A Pagar" (vermelho)
- **Linha**: "Acumulado" (azul, `monotone`, com dots)
- **Tooltip**: formato monetário pt-BR, `borderRadius: 12px`

#### 4.5 Lista Expansível por Mês
Cada mês expande mostrando:
- **↑ Receitas a Receber** (lista clicável → `openTxDialog`)
- **↓ Despesas a Pagar** (marca "Atrasada" se data < hoje)
- **◈ Faturas de Cartão** (status Aberta/Fechada, link → `/cards`)
- Totais parciais: A Receber, A Pagar, Saldo Mês, Acumulado

---

### ABA 5 — ANÁLISE IA

**Local**: `Reports.tsx:275-297, 879-932`

**Trigger**: Botão "Gerar Análise" (mínimo 5 transações)

**Prompt enviado ao Groq** (`callGroq`):
```
Como consultor financeiro especialista (Fiducia AI), analise:
1. Score de Saúde Financeira (0-100) + explicação
2. 3 dicas personalizadas e acionáveis
3. Previsão otimista e realista para próximo mês

Contexto:
- Saldo Total: R$ X
- Resumo 3 meses: {cashFlowData.slice(-3)}
- 50 transações recentes: [{date, desc, amount, type, category}]
```

**Saída**: Markdown renderizado via `dangerouslySetInnerHTML` (negrito `**`, bullets, quebras `<br/>`)

**Cards de contexto**: Últimos 3 meses do Fluxo de Caixa (receitas/despesas/saldo)

---

## 5. Gráfico de Tendências vs Gráfico de Projeção — Diferenças Chave

| Aspecto | **Tendência (Aba 3 / Reports)** | **Projeção Futura (Aba 4 / Reports)** |
|---------|---------------------------------|---------------------------------------|
| **Regime** | Caixa (só pago) | Competência (pendentes + faturas) |
| **Eixo Temporal** | Passado (dia 1 → hoje) | Futuro (hoje → +N meses) |
| **Granularidade** | Diária | Mensal |
| **Séries** | Uma linha: acumulado de despesas | Barras (receber/pagar) + Linha (acumulado) |
| **Dados** | `transactions` pagas | `transactions` pendentes + `invoices` não pagas |
| **Saldo inicial** | Zero (cumulativo do zero) | `saldoBase` (saldo real hoje) |
| **Objetivo** | Ver "queima" do orçamento no mês | Planejar liquidez futura, evitar descoberto |
| **Faturas cartão** | Ignoradas | Incluídas no mês de vencimento |

---

## 6. Resumo das Métricas-Chave por Tela

| Métrica | Dashboard | Relatórios (Fluxo de Caixa) | Relatórios (Projeção) |
|---------|-----------|----------------------------|----------------------|
| **Receitas** | Só pagas, mês atual, sem cartão | Pagas (+ pendentes opcional), período selecionado, sem cartão | Pendentes futuras, sem cartão |
| **Despesas** | Só pagas, mês atual, sem cartão | Pagas (+ pendentes opcional), período selecionado, sem cartão | Pendentes futuras + faturas cartão |
| **Saldo Base** | `sum(all accounts)` | N/A (visão mensal) | `sum(contas circulantes)` ou `sum(todas)` |
| **Cartão de Crédito** | Só no gráfico (opcional) e contas a pagar | **Excluído** | **Incluído** no mês de vencimento |
| **Transferências** | Sempre excluídas | Sempre excluídas | Sempre excluídas |

---

## 7. Pontos de Atenção / Limitações Conhecidas

1. **IA Client-side**: Chave Groq exposta no bundle (risco médio — `MASTER_PLAN.md` §7)
2. **Sem testes de integração**: Apenas `creditCardUtils.test.ts` (`MASTER_PLAN.md` §6 #9)
3. **Timezone**: `parseLocalDate()` resolve bug de `new Date("YYYY-MM-DD")` → UTC, mas requer manutenção
4. **Projeção não considera**: Recorrências futuras não lançadas, parcelamentos não faturados, metas de poupança
5. **Dois regimes** podem confundir usuário: Dashboard mostra "sobra R$ X", Relatórios mostram "déficit de R$ Y" no mesmo mês

---

## 8. Arquivos Principais Envolvidos

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/pages/Reports.tsx` | Toda a UI e lógica das 5 abas (936 linhas) |
| `src/pages/Dashboard.tsx` | KPIs, Cobertura de Caixa, Gráfico de área, listas pendentes |
| `src/lib/utils.ts` | `projectDailyBalance()`, `getTransactionEffect()`, `parseLocalDate()`, `calculateInvoicePeriod()` |
| `src/services/groqService.ts` | Wrapper `callGroq()` para IA |
| `docs/calculo_metricas.md` | Documentação oficial das fórmulas |
| `docs/especificacao-cartao-credito.md` | Regime dual de datas (compra vs vencimento) |
| `docs/MASTER_PLAN.md` | Decisões arquiteturais, riscos, backlog |
