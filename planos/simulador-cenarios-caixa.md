# Plano de Implementação — Simulador de Cenários Financeiros (Sandbox de Caixa)

> **LLM:** deepseek-v4-pro | **Agente:** opencode

Implementação de um ambiente interativo de simulação de decisões financeiras ("E se...?"), projetado sobre os dados reais já cadastrados (contas, lançamentos e faturas) sem alterar o banco de dados Firestore, permitindo testar o impacto imediato em **Folga Livre (Margem de Caixa)**, **Pior Saldo Previsto** e **Dias de Risco** em horizontes de 30 a 180 dias.

---

## 1. Contexto e Motivação

Atualmente, o usuário tem dificuldade de prever como uma nova despesa avulsa, uma receita incerta ou uma compra parcelada no cartão impactará seu saldo futuro e sua **Folga Livre de 90 dias**. Além disso, há insegurança em criar lançamentos de teste na tela oficial por receio de poluir os saldos e relatórios reais.

O **Simulador de Cenários** resolve esse problema criando uma camada de testes em memória (*sandbox*) que:
1. Clona os saldos reais e agendamentos oficiais.
2. Permite adicionar hipóteses de gastos/ganhos temporários.
3. Compara o cenário **Real** vs. **Simulado** em tempo real no mesmo motor canônico de projeção diária (`buildCashCoverageProjection`).
4. Permite ligar/desligar hipóteses individuais para testar combinações.
5. Permite descartar tudo ou efetivar a simulação no banco com 1 clique.

---

## 2. Arquitetura da Solução

```mermaid
flowchart TD
    subgraph Dados Reais (Firestore)
        ACC[Contas Líquidas]
        TX[Transações Pendentes]
        CC[Cartões e Faturas]
        REC[Recorrências Ativas]
    end

    subgraph Sandbox em Memória (React State)
        HIP["Lista de Hipóteses Simuladas\n• Despesa à vista\n• Receita avulsa\n• Compra parcelada cartão\n• Despesa recorrente"]
        EXP[Gerador de Lançamentos Sintéticos]
        HIP --> EXP
    end

    subgraph Motor Canônico (src/lib/cashCoverage.ts)
        M_REAL["buildCashCoverageProjection(Reais)"]
        M_SIM["buildCashCoverageProjection(Reais + Sintéticos)"]
    end

    ACC & TX & CC & REC --> M_REAL
    ACC & TX & CC & REC & EXP --> M_SIM

    M_REAL --> COMP[Comparador de Impacto]
    M_SIM --> COMP

    subgraph Interface do Simulador (/simulator)
        COMP --> KPIS["Cards Comparativos Antes vs Depois\n(Folga Livre, Menor Saldo, Saldo Final, Dias em Risco)"]
        COMP --> CHART["Gráfico Duplo de Trajetória Diária\n(Linha Real vs Linha Simulada com Zero-Line)"]
        COMP --> CAL["Calendário / Linha do Tempo de Alertas"]
        ACT["Ações: Limpar, Salvar Cenário ou Efetivar no Firestore"]
    end
```

---

## 3. Alterações Planejadas e Executadas

### 3.1. Tipos e Utilitários do Simulador

#### [NEW] [src/types/simulator.ts](file:///e:/Fiducia/src/types/simulator.ts)
Definição dos tipos do simulador:
- `SimulatedItem`:
  - `id`: string
  - `name`: string (ex: "MacBook Pro", "IPTU", "Bônus final de ano")
  - `type`: `'expense' | 'income' | 'card_expense'`
  - `amount`: number (valor total ou valor da parcela)
  - `date`: string (data de início ou vencimento)
  - `enabled`: boolean (toggle ativo/inativo para teste A/B)
  - `installments`?: number (ex: 1 a 24 parcelas)
  - `cardId`?: string (quando for compra no cartão)
  - `accountId`?: string (quando for débito em conta específica)
  - `recurrence`?: `'none' | 'monthly' | 'yearly'`
  - `notes`?: string
- `SimulationComparison`:
  - `realMargin`: number
  - `simulatedMargin`: number
  - `marginDelta`: number
  - `realMinBalance`: number
  - `simulatedMinBalance`: number
  - `realMinBalanceDate`: string
  - `simulatedMinBalanceDate`: string
  - `realDaysAtRisk`: number
  - `simulatedDaysAtRisk`: number
  - `simulatedEndingBalance`: number
  - `realEndingBalance`: number

#### [NEW] [src/lib/simulatorEngine.ts](file:///e:/Fiducia/src/lib/simulatorEngine.ts)
Funções puras e testáveis:
- `generateSimulatedTransactions(items: SimulatedItem[], creditCards: CreditCard[]): Transaction[]`:
  - Transforma compras parceladas em $N$ transações sintéticas com seus respectivos `invoicePeriod` calculados a partir dos dias de fechamento/vencimento do cartão.
  - Transforma despesas/receitas recorrentes simuladas em eventos até o fim do horizonte escolhido (ex: 90 ou 180 dias).
- `runSimulationComparison(baseData: { accounts, transactions, creditCards, invoices, recurrenceRules }, simulatedItems: SimulatedItem[], options: { days, includeSavings }): SimulationComparison & { chartData, dailyAlerts }`:
  - Roda a projeção de base (sem hipóteses) e a projeção com as hipóteses habilitadas.
  - Prepara os pontos para o gráfico composto (data, saldoReal, saldoSimulado, diferenca).
  - Identifica o "pior dia" e novos dias de risco que a simulação gerou.

---

### 3.2. Componentes Visuais

#### [NEW] [src/components/simulator/SimulationItemForm.tsx](file:///e:/Fiducia/src/components/simulator/SimulationItemForm.tsx)
Formulário dinâmico e enxuto para adicionar uma hipótese rápida:
- Tipo: Despesa em conta, Receita em conta, Compra no Cartão.
- Se cartão: seletor de cartão cadastrado + seletor de parcelas (1x a 24x) com cálculo instantâneo do valor da parcela.
- Campo de valor com `MoneyInput`.
- Data de início/compra.

#### [NEW] [src/components/simulator/SimulationCardComparison.tsx](file:///e:/Fiducia/src/components/simulator/SimulationCardComparison.tsx)
Cards visuais de impacto lado a lado com animação e cores contextuais:
1. **Folga Livre (Margem de Caixa):**
   - Ex: `R$ 4.500,00` $\rightarrow$ `R$ 1.200,00` ($\Delta$ -R$ 3.300,00). Badge verde ("Seguro"), amarelo ("Atenção") ou vermelho ("Consome Reserva").
2. **Pior Saldo Previsto:**
   - Ex: `R$ 850,00 (em 12/10)` $\rightarrow$ `-R$ 350,00 (em 15/10)`. Destaque em vermelho se cruzar para o negativo.
3. **Dias em Risco:**
   - Ex: `0 dias` $\rightarrow$ `4 dias com saldo negativo`.
4. **Saldo Final do Horizonte:**
   - Saldo projetado no último dia (30, 90 ou 180 dias).

#### [NEW] [src/components/simulator/SimulationChart.tsx](file:///e:/Fiducia/src/components/simulator/SimulationChart.tsx)
Gráfico de área/linha comparativa usando `Recharts`:
- Linha sólida cinza/azul (`Saldo Atual Confirmado`).
- Linha colorida (verde se positivo, âmbar se consumir reserva, vermelha se entrar em risco) (`Saldo com Hipóteses`).
- Faixa de área destacando a diferença entre as duas trajetórias.
- Linha de referência no R$ 0,00 e na Reserva de Segurança.

#### [NEW] [src/components/simulator/SimulationItemList.tsx](file:///e:/Fiducia/src/components/simulator/SimulationItemList.tsx)
Lista de hipóteses com:
- Toggle Liga/Desliga individual (Switch).
- Valor e detalhamento (ex: "10x de R$ 250,00 no Cartão Nubank a partir de Outubro").
- Botão de exclusão ou edição.
- Botão "Limpar todas".

---

### 3.3. Página do Simulador e Navegação

#### [NEW] [src/pages/Simulator.tsx](file:///e:/Fiducia/src/pages/Simulator.tsx)
Página completa com:
- Carregamento dos dados Firestore do usuário (contas, transações, cartões, faturas).
- Persistência das hipóteses em `localStorage` (`fiducia_simulated_items`).
- Seletor de horizonte: 30 dias, 60 dias, 90 dias (padrão) e 180 dias.
- Toggle "Incluir contas de investimento/reserva".
- Botão de ação: **"Efetivar Hipóteses como Lançamentos Reais"**:
  - Abre modal de confirmação discriminando os lançamentos que serão criados.
  - Grava no Firestore via `runTransaction` com status `pendente` e categorização adequada.

#### [MODIFY] [src/App.tsx](file:///e:/Fiducia/src/App.tsx)
- Adicionar rota `Route path="simulator" element={<Simulator />}`.

#### [MODIFY] [src/components/Layout.tsx](file:///e:/Fiducia/src/components/Layout.tsx)
- Adicionar item no menu lateral (`planningNavItems`):
  `{ name: 'Simulador', path: '/simulator', icon: Sparkles }`.

#### [MODIFY] [src/pages/Dashboard.tsx](file:///e:/Fiducia/src/pages/Dashboard.tsx)
- No card **Folga Livre (90 dias)**, adicionar link/botão rápido:
  `<Link to="/simulator" className="text-fiducia-blue hover:underline">Simular gasto ou receita →</Link>`.

---

## 4. Plano de Validação e Testes

### 4.1. Testes Automatizados Unitários
#### [NEW] [src/lib/simulatorEngine.test.ts](file:///e:/Fiducia/src/lib/simulatorEngine.test.ts)
- [x] Testar cálculo de despesa avulsa e receita avulsa: verificar se impacta o saldo a partir da data informada.
- [x] Testar compra parcelada no cartão: verificar se as $N$ parcelas são alocadas nos `invoicePeriod` corretos e no vencimento de cada fatura.
- [x] Testar toggle (habilitado/desabilitado): verificar se o item desabilitado é completamente excluído do cálculo sem ser apagado.
- [x] Testar cálculo da Folga Livre simulada vs. Folga Livre real.
- [x] Testar detecção de dias de risco (saldo < 0).

### 4.2. Testes de Build e Lint
- Executar `npm run lint` (`tsc --noEmit`): aprovado sem erros.
- Executar `npm run test` (`vitest run`): 170 testes aprovados.
- Executar `npm run build` (`vite build`): aprovado gerando chunk `Simulator-CjECqu4V.js` (32.90 kB).

---

> **LLM:** deepseek-v4-pro | **Agente:** opencode
