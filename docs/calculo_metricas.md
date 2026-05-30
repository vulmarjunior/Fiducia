# Relatório Técnico: Cálculo de Indicadores e Métricas no Fiducia

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
