# Especificação Conceitual de Arquitetura: Módulo de Cartão de Crédito e Parcelamentos

> **Versão:** 2.0  
> **Escopo:** Diretrizes conceituais de negócio para o motor de cartões de crédito, despesas e parcelamentos em um sistema de gestão financeira pessoal. Este documento não prescreve tecnologia, banco de dados ou estrutura de código — apenas define o comportamento esperado do sistema e suas regras de negócio.

---

## Sumário

1. [Conceitos Fundamentais e Glossário](#1-conceitos-fundamentais-e-glossário)
2. [O Paradigma da Conta Negativa](#2-o-paradigma-da-conta-negativa)
3. [Temporalidade dos Lançamentos](#3-temporalidade-dos-lançamentos)
4. [Arquitetura de Visão do Usuário](#4-arquitetura-de-visão-do-usuário)
5. [Engenharia Conceitual de Parcelamento](#5-engenharia-conceitual-de-parcelamento)
6. [Tratamento de Estornos e Cancelamentos](#6-tratamento-de-estornos-e-cancelamentos)
7. [Configurações e Preferências do Usuário](#7-configurações-e-preferências-do-usuário)
8. [Roteiro de Comportamentos do Sistema](#8-roteiro-de-comportamentos-do-sistema)

---

## 1. Conceitos Fundamentais e Glossário

Para garantir que todos os envolvidos no desenvolvimento compartilhem a mesma linguagem, os termos abaixo têm significado preciso e fixo dentro deste sistema.

| Termo | Definição |
| :--- | :--- |
| **Conta Cartão** | Entidade que representa um cartão de crédito. Funciona como uma conta com saldo devedor acumulado, nunca como uma categoria de despesa. |
| **Fatura** | Consolidação de todas as obrigações financeiras de um ciclo (mês) específico de um cartão. Pode estar nos estados: Aberta, Fechada ou Paga. |
| **Ciclo de Fatura** | Período entre a data de fechamento de uma fatura e a data de fechamento da fatura seguinte, definido para cada cartão individualmente. |
| **Fato Gerador** | O evento único e indivisível que origina uma obrigação financeira — a compra em si. Carrega: estabelecimento, categoria, valor total, data, número de parcelas e método de pagamento. |
| **Parcela** | Fragmento financeiro de um Fato Gerador, vinculado a um ciclo de fatura específico. Uma compra à vista produz uma única parcela; uma compra parcelada produz N parcelas distribuídas em N ciclos consecutivos. |
| **Limite Total** | Valor máximo de crédito concedido pela instituição financeira para aquele cartão. |
| **Limite Comprometido** | Somatório de todas as parcelas ainda não pagas (presentes e futuras) de todos os Fatos Geradores do cartão. |
| **Limite Disponível** | `Limite Total − Limite Comprometido`. É o único valor que deve ser exibido ao usuário como "limite livre para uso". |
| **Transferência de Liquidação de Passivo** | O pagamento da fatura. Não é uma despesa nova — é a quitação de uma obrigação já registrada, que reduz simultaneamente o saldo da conta bancária e o saldo devedor do cartão. |
| **Saldo Devedor do Cartão** | Somatório de todas as obrigações ainda não pagas associadas àquele cartão (faturas fechadas não pagas + fatura aberta + parcelas futuras). |
| **Patrimônio Líquido** | Indicador consolidado calculado como: `Soma dos saldos bancários ativos − Saldo Devedor total de todos os cartões`. |
| **Saldo Livre Real** | Indicador operacional calculado como: `Saldo em contas bancárias − valor total das faturas abertas e fechadas não pagas`. Representa o dinheiro genuinamente disponível para decisões imediatas. |

---

## 2. O Paradigma da Conta Negativa

### 2.1 Natureza da Conta Cartão

O sistema deve tratar a Conta Cartão exclusivamente como um repositório de saldo devedor acumulado. Ela nunca deve ser modelada como uma categoria de despesa.

O limite concedido pela instituição financeira não representa patrimônio do usuário. É uma margem de crédito de terceiros, disponibilizada temporariamente.

### 2.2 Cálculo de Patrimônio Líquido

O sistema deve calcular o Patrimônio Líquido consolidando apenas:

- **Entradas:** saldos reais e positivos de todas as contas bancárias ativas do usuário.
- **Saídas:** o Saldo Devedor total de todos os cartões de crédito ativos.

$$\text{Patrimônio Líquido} = \sum \text{Saldos Bancários Ativos} - \sum \text{Saldo Devedor de Todos os Cartões}$$

O Saldo Devedor de cada cartão inclui obrigatoriamente: a fatura aberta do mês corrente, todas as faturas fechadas ainda não pagas e todas as parcelas futuras de compras já realizadas.

### 2.3 Natureza do Pagamento da Fatura

O ato de pagar a fatura é classificado como uma **Transferência de Liquidação de Passivo**. Seu efeito é duplo e simultâneo:

1. O saldo da conta bancária de origem diminui pelo valor pago.
2. O saldo devedor da Conta Cartão diminui pelo mesmo valor.

Esse evento não gera nenhuma nova despesa no sistema e não deve impactar nenhum orçamento de categoria.

---

## 3. Temporalidade dos Lançamentos

O sistema opera em regime dual de datas, aplicando paradigmas diferentes conforme o contexto do relatório. Cada parcela carrega duas datas obrigatoriamente:

| Data | Nome | Significado |
| :--- | :--- | :--- |
| **Data de Competência** | Data da compra | Quando a decisão de consumo foi tomada pelo usuário. |
| **Data de Caixa** | Data de vencimento da fatura | Quando o impacto financeiro ocorre de fato na liquidez do usuário. |

### 3.1 Aplicação por Contexto

| Contexto / Relatório | Paradigma Adotado | Comportamento |
| :--- | :--- | :--- |
| **Orçamentos por Categoria** | Competência *(Data da Compra)* | O limite de gastos de uma categoria é consumido na data em que o usuário realizou a compra. |
| **Fluxo de Caixa e Projeções** | Caixa *(Data de Vencimento)* | O impacto na liquidez global é contabilizado no dia do vencimento da fatura que contém aquela parcela. |
| **Histórico de Transações** | Ambos disponíveis | O usuário pode filtrar por data de compra ou por data de vencimento. |

---

## 4. Arquitetura de Visão do Usuário

### 4.1 Princípio Anticonfusão

A tela principal deve proteger o usuário contra a falsa sensação de riqueza — ter dinheiro na conta corrente que já está comprometido com o cartão. A interface deve educar o usuário a tomar decisões baseando-se no **Saldo Livre Real**, não no saldo bruto das contas bancárias.

### 4.2 Indicadores Obrigatórios no Painel Principal

O painel principal deve exibir, de forma clara e hierárquica:

| Indicador | Cálculo | Descrição para o Usuário |
| :--- | :--- | :--- |
| **Saldo em Contas** | Soma dos saldos bancários ativos | Dinheiro real disponível nos bancos hoje. |
| **Comprometido com Cartões** | Soma dos saldos devedores de todos os cartões | Total de dívidas já contraídas aguardando pagamento. |
| **Saldo Livre Real** | Saldo em Contas − Comprometido com Cartões | Valor genuinamente disponível para decisões. Este é o número que importa. |
| **Patrimônio Líquido** | Calculado conforme seção 2.2 | Visão de riqueza de longo prazo (inclui investimentos, se houver). |

### 4.3 Visão por Cartão

Cada Conta Cartão deve expor individualmente:

- Limite Total concedido pela instituição.
- Limite Comprometido (parcelas presentes e futuras não pagas).
- Limite Disponível (único indicador que o usuário pode usar como referência de compra).
- Fatura atual aberta (acumulado até o momento).
- Próxima data de fechamento da fatura.
- Próxima data de vencimento.

---

## 5. Engenharia Conceitual de Parcelamento

### 5.1 Dissociação entre Fato Gerador e Parcelas

O Fato Gerador e suas Parcelas são entidades conceitualmente distintas, embora vinculadas:

**O Fato Gerador:**
- É um evento único e imutável após o registro.
- Armazena o contexto histórico completo: estabelecimento, categoria, valor total, número de parcelas, data da compra.
- Dispara imediatamente o comprometimento do Limite Disponível pelo valor total da compra.
- Não pode ser editado individualmente — alterações devem seguir o fluxo de estorno/cancelamento (ver seção 6).

**As Parcelas:**
- São fragmentos gerados automaticamente a partir do Fato Gerador.
- Cada parcela pertence a exatamente um ciclo de fatura.
- Cada parcela herda a categoria do Fato Gerador que a originou.
- As parcelas existem para fins de projeção de caixa e composição de faturas — não representam novas compras.

### 5.2 O Princípio do Limite Sombra

No momento em que um Fato Gerador é registrado, o Limite Disponível do cartão deve ser reduzido pelo **valor total da compra**, independentemente do número de parcelas.

A restituição do limite ocorre gradualmente: cada vez que uma fatura é marcada como **Paga**, o valor das parcelas contidas naquela fatura é devolvido ao Limite Disponível.

**Exemplo prático:**
> Compra de R$ 1.200 em 3 parcelas de R$ 400.
> - No momento da compra: Limite Disponível reduz R$ 1.200.
> - Após pagamento da fatura do mês 1 (contém a parcela 1): Limite Disponível recupera R$ 400.
> - Após pagamento da fatura do mês 2 (contém a parcela 2): Limite Disponível recupera mais R$ 400.
> - Após pagamento da fatura do mês 3 (contém a parcela 3): Limite Disponível recupera os R$ 400 finais.

### 5.3 Composição das Faturas

Cada fatura é uma consolidação dinâmica composta por:

- Compras à vista realizadas dentro daquele ciclo específico.
- Parcelas remanescentes de Fatos Geradores ocorridos em ciclos anteriores.
- Encargos, juros ou créditos lançados manualmente (ajustes).

A fatura não tem "conteúdo fixo" até o momento do fechamento. Enquanto estiver **Aberta**, sua composição reflete o estado atual de todos os lançamentos do ciclo.

### 5.4 Estados de uma Fatura

| Estado | Descrição | Permite Edição? |
| :--- | :--- | :--- |
| **Aberta** | Ciclo em andamento. Novos lançamentos são aceitos. | Sim |
| **Fechada** | Ciclo encerrado. Aguardando pagamento. Novos lançamentos vão para a próxima fatura. | Não (apenas ajustes manuais com justificativa) |
| **Paga** | Pagamento registrado. Libera o limite proporcional. | Não |

### 5.5 Paradigmas de Orçamento para Parcelamentos

O sistema deve suportar dois comportamentos configuráveis pelo usuário (ver seção 7):

**Abordagem por Caixa — Impacto Fracionado (padrão recomendado):**
Cada parcela consome a fração correspondente do orçamento da categoria no mês em que aquela parcela vence.

> Compra de R$ 1.200 em 12x: consome R$ 100 do orçamento de "Eletrônicos" em cada um dos 12 meses subsequentes.

**Abordagem por Competência — Impacto Integral:**
O valor total da compra consome o orçamento da categoria no mês em que a compra foi realizada. Os meses seguintes não registram consumo de orçamento para aquele item (apenas o compromisso financeiro na fatura permanece).

> Compra de R$ 1.200 em 12x: consome R$ 1.200 do orçamento de "Eletrônicos" no mês da compra. Os 11 meses seguintes têm a parcela na fatura, mas sem impacto no orçamento da categoria.

---

## 6. Tratamento de Estornos e Cancelamentos

Esta seção define o comportamento esperado do sistema nos casos de reversão total ou parcial de uma compra.

### 6.1 Princípios Gerais

- Um Fato Gerador **nunca é excluído** do sistema após o registro. O histórico é imutável.
- A reversão de uma compra é sempre registrada como um **Fato Gerador de Estorno**, que é um evento novo e independente, vinculado ao Fato Gerador original.
- O Fato Gerador de Estorno produz o efeito inverso: libera limite e reduz o saldo devedor.

### 6.2 Estorno Total

Quando uma compra é completamente estornada:

- Um Fato Gerador de Estorno é criado com o valor total da compra original, vinculado ao Fato Gerador de origem.
- O Limite Comprometido é reduzido pelo valor total da compra original.
- As parcelas futuras ainda não pagas são canceladas: removidas das faturas abertas e futuras.
- Se alguma parcela já estava em uma **fatura paga**, ela permanece no histórico e o estorno é creditado na fatura mais próxima ainda não fechada.
- Se alguma parcela estava em uma **fatura fechada mas não paga**, o valor é abatido diretamente do total daquela fatura.

### 6.3 Estorno Parcial

Quando apenas parte do valor é estornada (ex.: devolução de um item de um pedido maior):

- Um Fato Gerador de Estorno é criado com o valor parcial estornado.
- O sistema deve distribuir o estorno nas parcelas futuras de forma proporcional, ou aplicá-lo integralmente na parcela mais próxima ainda não paga — comportamento configurável pelo usuário.
- O Limite Comprometido é reduzido pelo valor efetivamente estornado.

### 6.4 Cancelamento de Compra Parcelada em Andamento

Quando o usuário cancela uma compra cujas parcelas estão distribuídas em múltiplos meses futuros:

- As parcelas em faturas **ainda abertas ou futuras** são canceladas e o limite é liberado proporcionalmente.
- As parcelas em faturas **fechadas não pagas** têm seu valor abatido do total daquela fatura.
- As parcelas em faturas **já pagas** geram um crédito (Fato Gerador de Estorno positivo) aplicado na próxima fatura aberta.

---

## 7. Configurações e Preferências do Usuário

O sistema deve permitir que o usuário configure os seguintes comportamentos, por cartão ou globalmente:

| Configuração | Opções | Padrão |
| :--- | :--- | :--- |
| **Paradigma de orçamento para parcelamentos** | Impacto Fracionado (Caixa) / Impacto Integral (Competência) | Impacto Fracionado |
| **Data de referência para relatórios** | Data da compra / Data de vencimento | Data da compra |
| **Distribuição de estorno parcial** | Proporcional entre parcelas restantes / Integral na próxima parcela | Proporcional |
| **Alerta de limite disponível** | Percentual de uso do limite que dispara notificação | 80% |
| **Dia de fechamento da fatura** | Configurado por cartão | — |
| **Dia de vencimento da fatura** | Configurado por cartão | — |

A alteração do paradigma de orçamento **não afeta retroativamente** transações de meses já fechados. A mudança vale apenas para lançamentos a partir da data de aplicação da configuração.

---

## 8. Roteiro de Comportamentos do Sistema

Esta seção descreve, em linguagem de negócio, o que o sistema deve fazer em cada situação relevante.

### 8.1 Registro de uma Compra no Cartão

1. Identificar a qual Conta Cartão pertence a compra.
2. Determinar o ciclo de fatura correspondente à data da compra (com base nas datas de fechamento configuradas para aquele cartão).
3. Registrar o Fato Gerador com todos os seus atributos.
4. Reduzir imediatamente o Limite Disponível pelo valor total da compra.
5. Se a compra for à vista: gerar uma única Parcela vinculada ao ciclo atual.
6. Se a compra for parcelada: gerar N Parcelas, distribuídas nos N ciclos consecutivos a partir do ciclo atual, todas herdando a categoria do Fato Gerador.
7. Adicionar cada Parcela à fatura correspondente ao seu ciclo.
8. Impactar o orçamento de categoria conforme o paradigma configurado pelo usuário (seção 5.5).

### 8.2 Cálculo do Saldo Devedor de um Cartão

O saldo devedor de um cartão em qualquer momento é a soma de:

- Todas as parcelas contidas em faturas **fechadas não pagas**.
- Todas as parcelas contidas na **fatura aberta** do ciclo atual.
- Todas as parcelas de **faturas futuras** (ciclos ainda não iniciados).

Este valor é a fonte de verdade para o cálculo do Limite Comprometido, do Saldo Livre Real e do Patrimônio Líquido. Todas as exibições derivadas devem ler desta mesma fonte.

### 8.3 Cálculo do Limite Disponível

```
Limite Disponível = Limite Total − Saldo Devedor total do cartão
```

O Limite Disponível nunca pode ser exibido como valor negativo para o usuário — se o Saldo Devedor superar o Limite Total (por ajustes manuais ou encargos), o sistema deve exibir o limite como zero e alertar o usuário.

### 8.4 Pagamento de uma Fatura

1. Registrar o valor pago como uma Transferência de Liquidação de Passivo (não como despesa).
2. Reduzir o saldo da conta bancária de origem pelo valor pago.
3. Marcar a fatura como **Paga** (total ou parcialmente, conforme o valor informado).
4. Liberar o Limite Comprometido pelo valor das parcelas contidas naquela fatura que foram liquidadas.
5. Atualizar imediatamente o Limite Disponível, o Saldo Livre Real e o Patrimônio Líquido.

> **Pagamento parcial:** Se o usuário pagar menos que o total da fatura, o sistema deve registrar o valor pago, manter a fatura no estado **Fechada** (não **Paga**), e calcular o saldo remanescente. O limite é liberado apenas proporcionalmente ao valor pago.

### 8.5 Geração de Relatórios

O sistema deve manter dois fluxos analíticos separados, alimentados pela mesma fonte de dados mas lidos por datas diferentes:

**Relatórios de Categoria (Orçamento):**
- Leem a Data de Competência (data da compra) de cada parcela, ou o valor integral do Fato Gerador, conforme o paradigma configurado.
- Respondem à pergunta: "Quanto gastei / orçamento consumi neste período?"

**Relatórios de Fluxo de Caixa:**
- Leem exclusivamente a Data de Caixa (data de vencimento) de cada fatura.
- Trabalham com o valor total consolidado de cada fatura, não com parcelas individuais.
- Respondem à pergunta: "Quanto dinheiro vai sair da minha conta e quando?"

Esses dois fluxos nunca devem ser misturados em um mesmo gráfico sem sinalização clara ao usuário.

### 8.6 Importação de Fatura via PDF

O sistema oferece uma rotina inteligente de leitura de faturas em formato PDF.
1. O PDF é processado localmente e o texto extraído é submetido à IA (Groq).
2. A IA identifica e estrutura os Fatos Geradores, categorizando-os automaticamente com base na lista de categorias do usuário.
3. Se detectadas compras parceladas (ex: `2/6`), o sistema propõe a expansão da série, que gerará todas as parcelas futuras necessárias e as vinculará usando a entidade `parentId`.
4. Os lançamentos importados respeitam o cálculo de `invoicePeriod` automaticamente, deduzindo a data da transação em relação às datas de fechamento e vencimento do cartão.

---

*Fim do documento. Versão 2.0.*
