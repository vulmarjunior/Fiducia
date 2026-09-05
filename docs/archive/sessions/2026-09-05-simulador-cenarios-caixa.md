# Sessão 2026-09-05 — Simulador de Decisões de Caixa e Sandbox Financeiro (v0.17.0)

> **LLM:** deepseek-v4-pro | **Agente:** opencode

---

## 1. Objetivo da Sessão

Atender à solicitação do usuário com duas frentes:
1. **Esclarecimento do Card Folga Livre (90 dias):** Explicar de forma didática e transparente todas as variáveis que compõem o card, por que a conta intuitiva não bate (cálculo dinâmico diário baseado no menor saldo previsto / pior ponto da curva, e não no saldo final acumulado) e quais regras de prudência são aplicadas (exclusão de receitas atrasadas, antecipação de despesas vencidas para hoje, faturas e parcelas futuras de cartão de crédito).
2. **Implementação do Simulador de Cenários:** Criar um ambiente de simulação financeira em memória (*sandbox*), seguro e interativo, permitindo simular compras parceladas no cartão de crédito, despesas extras avulsas e receitas futuras sobre a base de dados reais lançados, sem poluir o banco de dados Firestore.

---

## 2. O que foi implementado

1. **Tipos e Contratos do Simulador (`src/types/simulator.ts`):**
   - Tipagem de `SimulatedItem`, `SimulationComparison`, `SimulationChartPoint` e `SimulationItemType`.
2. **Motor Canônico de Simulação (`src/lib/simulatorEngine.ts`):**
   - Função `generateSimulatedTransactions`: transforma compras no cartão em $N$ parcelas sintéticas (com cálculo exato de centavos na última parcela) e alocação precisa de `invoicePeriod` pelo ciclo de fechamento/vencimento do cartão; expansão de despesas/receitas recorrentes mensais.
   - Função `runSimulationComparison`: executa `buildCashCoverageProjection` na base real e na base composta (reais + simulados), calculando os deltas de Folga Livre (Margem de Caixa), Menor Saldo Previsto, Dias em Risco de Déficit e Saldo Final.
3. **Testes Unitários Automatizados (`src/lib/simulatorEngine.test.ts`):**
   - 4 testes cobrindo geração de parcelas, exclusão de itens desabilitados, cálculo de deltas de margem e detecção de déficits projetados. Todos aprovados.
4. **Interface do Simulador (`src/components/simulator/`):**
   - `SimulationItemForm.tsx`: formulário ágil com suporte a `MoneyInput`, seletor de cartão de crédito e parcelas (1x a 24x) com preview em tempo real do impacto por fatura.
   - `SimulationCardComparison.tsx`: 4 cards de KPIs antes vs. depois com badges contextuais de risco (`Seguro`, `Consome Reserva`, `Déficit`).
   - `SimulationChart.tsx`: gráfico ComposedChart (`Recharts`) com curva confirmada tracejada, curva simulada em destaque, gradiente de área e linhas de corte de déficit (R$ 0,00) e Reserva Protegida.
   - `SimulationItemList.tsx`: lista de hipóteses com switches liga/desliga individuais, rótulos claros e botão de exclusão/limpeza.
5. **Página Dedicada (`src/pages/Simulator.tsx`):**
   - Rota `/simulator` com carregamento lazy, persistência de rascunhos no `localStorage`, seleção de horizonte (30, 60, 90, 180 dias) e diálogo de confirmação para efetivar as hipóteses ativas como lançamentos pendentes no Firestore com 1 clique.
6. **Integração e Navegação:**
   - Adicionado atalho "Simulador" no menu lateral (`src/components/Layout.tsx`).
   - Adicionado atalho direto "Simular gasto ou receita →" no rodapé do card Folga Livre no Dashboard (`src/pages/Dashboard.tsx`).

---

## 3. Arquivos Tocados

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/types/simulator.ts` | Criado | Interfaces e tipos do simulador |
| `src/lib/simulatorEngine.ts` | Criado | Motor canônico de projeção comparativa e transações sintéticas |
| `src/lib/simulatorEngine.test.ts` | Criado | Testes unitários do motor do simulador |
| `src/components/simulator/SimulationItemForm.tsx` | Criado | Formulário de novas hipóteses de gastos/ganhos |
| `src/components/simulator/SimulationCardComparison.tsx` | Criado | Cards de KPIs comparativos antes vs. depois |
| `src/components/simulator/SimulationChart.tsx` | Criado | Gráfico duplo de trajetória de saldo |
| `src/components/simulator/SimulationItemList.tsx` | Criado | Lista de hipóteses ativas com switches liga/desliga |
| `src/pages/Simulator.tsx` | Criado | Página do Simulador de Caixa |
| `src/App.tsx` | Modificado | Registro da rota `/simulator` com lazy loading |
| `src/components/Layout.tsx` | Modificado | Inclusão do item "Simulador" no menu lateral principal |
| `src/pages/Dashboard.tsx` | Modificado | Link rápido no card de Folga Livre (90 dias) |
| `src/lib/utils.ts` | Modificado | Atualização de `APP_VERSION` para `0.17.0` |
| `package.json` | Modificado | Atualização de versão para `0.17.0` |
| `CHANGELOG.md` | Modificado | Registro da release v0.17.0 |
| `docs/MASTER_PLAN.md` | Modificado | Atualização de versão e entregas concluídas |

---

## 4. Validações Realizadas

- `npm run lint` (`tsc --noEmit`): 0 erros de compilação ou tipagem.
- `npm run test` (`vitest run`): **170 testes aprovados** (100% da suíte passando).
- `npm run build` (`vite build`): Build de produção concluído com sucesso em 11.99s, gerando chunk isolado `Simulator-CjECqu4V.js` (32.90 kB).

---

> **LLM:** deepseek-v4-pro | **Agente:** opencode
