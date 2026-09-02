# Auditoria da execução — Relatórios v0.16.0

> **LLM:** deepseek-v4-pro | **Agente:** opencode

**Data:** 2026-09-02. **Base auditada:** commit `46bf0f3`, versão `0.16.0`.

**Pedido:** analisar a execução de `docs/plano-relatorios-essenciais.md` porque os relatórios apresentam resultados impossíveis.

**Conclusão:** a organização visual e parte dos cálculos foram implementadas, mas os critérios financeiros de aceite não foram cumpridos. Há erros determinísticos de isolamento por conta, composição de faturas e pendências, reconciliação, evolução mensal e detalhamento. A declaração anterior de conclusão funcional não deve ser usada como evidência de confiabilidade.

Esta sessão é uma auditoria: nenhum arquivo de produção foi corrigido, nenhuma escrita financeira foi feita, nenhuma versão foi incrementada e nenhum deploy foi executado. Não foi inspecionado o conjunto real de lançamentos do usuário nem a versão servida no navegador. Os exemplos abaixo são sintéticos; demonstram defeitos do commit local, sem atribuir uma diferença específica dos dados reais a uma causa não observada.

## 1. Evidência executada

- `npm run test -- --maxWorkers=1 src/lib/reports`: **13 testes existentes passaram**, em 3 arquivos.
- Reprodutor independente: **21 verificações**, sendo **18 divergências e 3 controles aprovados**. As 18 verificações cobrem manifestações de causas comuns; não significam 18 bugs independentes.
- Fonte: `2026-09-02-auditoria-relatorios.repro.ts` nesta pasta. Resultado estruturado: `2026-09-02-auditoria-relatorios.resultados.json`.
- Controles positivos: fluxo de uma conta com movimentos próprios, neutralização de transferência interna e crédito de cartão reduzindo consumo funcionaram.
- A execução direta com `tsx` falhou antes de rodar o reprodutor por `uv_os_get_passwd / ENOMEM` no sandbox. O mesmo fonte foi empacotado com o esbuild já instalado e executado com Node; nenhuma dependência foi instalada.
- Não foi necessário repetir build/lint ou a suíte completa para comprovar os erros: esta auditoria não altera produção. A evidência é dos cálculos realmente importados do aplicativo.

Reprodução alternativa na raiz do projeto:

```powershell
node -e "require('esbuild').buildSync({entryPoints:['docs/archive/sessions/2026-09-02-auditoria-relatorios.repro.ts'],bundle:true,platform:'node',format:'cjs',outfile:'artifacts/reports-audit-v0160.cjs'})"
node artifacts/reports-audit-v0160.cjs
```

O reprodutor retorna código 1 enquanto houver divergências. Não faz parte da suíte normal e não altera expectativas existentes para acomodar resultados incorretos. O bundle gerado é descartável; o fonte e o JSON preservam a evidência.

## 2. Achados financeiros prioritários

### F1 — P1: receitas/despesas são aplicadas a todas as contas

**Local:** `src/lib/reports/accountFlow.ts`, funções `calculateStartingBalanceCents` e `buildAccountFlowReport`, chamadas de `getTransactionEffect` nas linhas 30 e 113 da base auditada.

O loop recebe todos os lançamentos, mas não verifica se uma receita/despesa pertence à conta sendo calculada. A função canônica retorna o valor de receita/despesa pelo tipo; ela verifica perspectiva de origem/destino apenas para transferências. Portanto, usá-la não dispensa filtrar a conta previamente. Essa precondição estava expressa na seção 5.1, item 5, do plano.

| Exemplo sintético | Correto | Implementação |
|---|---:|---:|
| Conta A: inicial R$ 1.000 + receita própria R$ 500 | R$ 1.500 | R$ 1.400, pois recebe também a despesa de B |
| Conta B: inicial R$ 2.000 - despesa própria R$ 100 | R$ 1.900 | R$ 2.400, pois recebe também a receita de A |
| Total final | R$ 3.400 | R$ 3.800 |

O gráfico consolidado usa outro loop que verifica pertinência e termina em R$ 3.400. O indicador soma os saldos individuais contaminados e mostra R$ 3.800. A identidade `saldo inicial + entradas - saídas = saldo final` falha na mesma tela.

O defeito também contamina saldos iniciais dos meses seguintes e pendências por conta. Uma única conta selecionada ainda recebe movimentos das contas não selecionadas. Quanto mais contas houver, maior pode ser a distorção.

**Correção exigida:** filtrar pertinência antes da função canônica, tanto no histórico quanto no período; construir consolidado e individuais a partir de efeitos comuns; testar múltiplas contas com receitas/despesas distintas e identidade do saldo. Não alterar genericamente `getTransactionEffect` sem revisar seus outros consumidores.

### F2 — P1: faturas desaparecem ou pagamentos são descontados duas vezes

**Local:** `src/lib/reports/invoiceEvents.ts:34` e `:43`.

O detector de agendamento aceita qualquer transação pendente com `creditCardId` ou `invoicePeriod`. Isso inclui compras comuns do cartão. Uma compra pendente de R$ 1.000 abate os R$ 1.000 de uma fatura aberta como se já houvesse pagamento agendado: obrigação exibida igual a zero.

No sentido oposto, um pagamento pendente vinculado pelos IDs oficiais da fatura, mas sem `creditCardId` na transação bancária, é agrupado sob cartão vazio. Não reduz o residual da fatura correta. Para fatura de R$ 1.000, R$ 400 pagos e R$ 200 agendados, o residual correto é R$ 400; o código retorna R$ 600, somando o agendamento de R$ 200 de novo na previsão.

Além disso, o motor itera somente documentos de `invoices` e chama `getInvoiceFinancialSummary` sem total calculado pelas compras. Compras em fatura ainda não materializada em documento desaparecem da previsão; os demais motores do sistema já trabalham também a partir dos períodos das compras.

**Correção exigida:** mapear IDs oficiais para cartão/período e classificar pagamentos bancários separadamente das compras/créditos. Reaproveitar total líquido canônico e enumerar períodos existentes nas transações. Testar residual e saldo previsto completo, não apenas um campo isolado.

**Lacuna no teste atual:** o cenário de pagamento pendente em `accountFlow.test.ts` usa `creditCardId`, sendo normalizado como compra de cartão e excluído do fluxo bancário. O teste verifica somente residual de R$ 400, sem conferir que os R$ 200 agendados realmente entram no saldo da conta; por isso passa apesar da inconsistência.

### F3 — P1: incluir pendentes não atualiza os valores exibidos de Entradas × saídas

**Local:** `src/lib/reports/accountFlow.ts:150`, construção dos pontos/totais; `src/components/reports/CashFlowChart.tsx:24`; `src/components/reports/AccountFlowView.tsx:31`.

O motor acumula campos de pendência, mas `CashFlowChart` usa apenas `inflow`, `outflow`, `result` e `endingBalance` realizados. A propriedade `showPending` é recebida e não é usada. Com uma despesa pendente de R$ 100 e a opção ligada, o indicador de saídas continua em R$ 0. As curvas por conta também são somente realizadas.

Com opção desligada e status padrão `all`, os lançamentos pendentes ainda entram em `entries`, apesar de não comporem o valor. O usuário abre uma linha de R$ 0 e encontra a despesa de R$ 100.

O seletor de status independente pode ainda eliminar os realizados necessários à base do saldo ou excluir pendentes antes de considerar `includePending`.

**Correção exigida:** definir uma seleção única e coerente do cenário exibido, manter base realizada separada, atualizar KPIs/pontos/legendas/exportação e passar aos detalhes exatamente os componentes do valor acionado. Curvas previstas devem refletir compromissos datados e não apenas um total final separado.

### F4 — P1: reconciliação e abertura de conta não foram implementadas

**Local:** `src/lib/reports/accountFlow.ts:20` e `:228`.

`initialBalance` ausente é tratado como zero; `openingDate` e a conferência com `account.balance` não são usadas. Todo resultado recebe `isReconciled: true` sem qualquer comparação.

Reproduções: saldo persistido de R$ 9.000 versus inicial de R$ 1.000 e nenhum lançamento ainda resulta em conciliado; conta sem saldo inicial também; conta aberta em setembro injeta R$ 1.000 no saldo de agosto.

**Correção exigida:** implementar disponibilidade da base, conferência de horizonte, capital de abertura e diagnóstico previsto no plano. Não corrigir automaticamente dados reais nem esconder divergência com zero. O indicador interno de conciliação hoje é constante; a UI também não apresenta o diagnóstico exigido.

### F5 — P1: total do detalhamento soma estorno como gasto

**Local:** `src/components/reports/ReportDetailsDialog.tsx:28`.

Constatação por leitura direta do componente: o total trata `isCredit` como redução apenas dentro de `type === 'expense'`. Entretanto, a normalização define crédito de cartão como `type === 'income'`. Logo, compra de R$ 300 e estorno de R$ 50 mostram R$ 250 na categoria, mas R$ 350 no total do diálogo.

Para caixa, o mesmo somatório junta receitas e despesas como positivos; transferências não têm perspectiva da conta e são exibidas com sinal positivo. O diálogo não recebe o significado financeiro do grupo que está explicando.

**Correção exigida:** passar entradas com efeito assinado e contexto (consumo, receita, caixa e conta), ou o total canônico junto de sua composição. Não recalcular outra regra financeira dentro do componente de apresentação. Este achado é estático e não faz parte das 21 verificações do reprodutor.

### F6 — P2: seleção vazia amplia para todas as contas

**Local:** `src/lib/reports/accountFlow.ts:60`.

`originIds: []` cai no mesmo ramo de `undefined`; limpar a seleção de contas mostra todas. O tipo e o plano definem explicitamente `undefined = todas; [] = nenhuma`. A implementação de categorias respeita a distinção; o fluxo não.

**Correção exigida:** tratar estados separadamente e testar a aplicação da seleção na tela, no detalhamento e nas exportações.

### F7 — P2: obrigações ignoram os controles de período/seleção

**Local:** `src/lib/reports/accountFlow.ts:366`.

Faturas residuais são sempre calculadas e descontadas do saldo previsto, mesmo com `includePending: false`. O motor recebe apenas `selectedMonth`, ignorando o intervalo personalizado e sua data final. Fatura vencendo em 27/08 entra em consulta de 01/08 a 05/08. Também desconta obrigações sem conta da projeção de uma seleção parcial de contas, apesar de não haver atribuição conhecida.

**Correção exigida:** filtrar eventos pela data de vencimento dentro do intervalo, respeitar cenário e seleção. Obrigações não alocadas devem ter ponte explícita na visão geral, sem atribuição indireta à seleção parcial. A UI atual não oferece intervalo personalizado; o defeito de intervalo foi reproduzido na API de cálculo, cuja opção já existe.

### F8 — P2: evolução mensal perde compras do mês da fatura

**Local:** `src/lib/reports/categoryReport.ts:251`.

Elegibilidade usa `invoicePeriod`, mas os buckets continuam procurando `date`/`postingDate`. Compra de R$ 100 em julho, na fatura de agosto: distribuição de agosto R$ 100; evolução mensal R$ 0. No modo mensal nem o grupo de itens sem dia é preenchido.

**Correção exigida:** agregar mensalmente pelo período de fatura; diariamente/semanalmente preservar o grupo sem dia conforme plano. Testar soma da matriz, total da categoria e créditos fora do mês civil.

## 3. Execução do plano versus entrega registrada

| Área/etapa | Estado observado |
|---|---|
| Navegação principal e componentes | Implementada em parte; quatro abas existem e análises antigas permanecem acessíveis. |
| Contratos financeiros/testes (etapa 1) | Reprovados pelos casos desta auditoria. A matriz mínima não foi coberta. |
| Filtros e estados (etapa 2) | Parcial: um `reportFilters` compartilhado entre abas; seleção de despesa pode ocultar receitas; sem resumo nominal completo, intervalo personalizado ou seletor direto de mês. |
| Despesas/Receitas (etapa 3) | Distribuição básica funciona, incluindo controle de estorno; evolução e detalhamento não reconciliam todos os casos. |
| Entradas × saídas (etapa 4) | Gráficos e tabela presentes; saldo do indicador pode contrariar gráfico e pendências não aparecem nos totais. |
| Fluxo por conta (etapa 5) | Estrutura presente, mas isolamento, abertura, diagnóstico e previsão diária não atendem ao contrato. Não há a tabela temporal por conta prevista. |
| Exportação/verificação (etapa 6) | CSV parcial; PDF novo apenas em categorias; ausência de evidência de verificação visual no registro de entrega. |

Outras lacunas verificadas por leitura:

- `ReportDetailsDialog` mostra status bruto da compra mesmo quando o filtro usou situação da fatura, sem explicação de parcial.
- `CategoryEvolutionChart` define um handler de detalhe de bucket, mas não o liga às células. A condição compara a data com a chave inteira (`date >= key && date <= key`), inadequada para semanas e meses.
- Cores dependem do índice, contrariando estabilidade por ID; série inicial depende dos dados no momento de montagem e não acompanha automaticamente carregamento/troca de tipo.
- `normalizeDate` cria data de hoje quando ausente e `toCents` converte inválido em zero, sem diagnóstico.
- Não há estado conjunto de carregamento/erro das coleções: arrays vazios iniciais podem parecer valores financeiros reais.
- Exportações não carregam toda a seleção de contas/categorias e não exportam fielmente a matriz temporal; Fluxo por conta exporta resumo por conta.
- Plano mestre tinha título duplicado e afirmava conclusão no objetivo enquanto backlog ainda dizia implementação não iniciada. Nesta sessão, o estado foi ajustado para revisão com referência à auditoria; a declaração histórica de release foi preservada.

## 4. Ordem recomendada de correção

1. **F1 e F4:** pertinência por conta, base histórica, abertura e integridade. Exigir invariantes entre saldo, resultado, gráfico e contas.
2. **F2 e F7:** identificação de pagamentos oficiais, compras, residual, vencimentos, filtro e não alocação. Testar previsão completa para não aceitar campo isolado correto.
3. **F3 e F5:** composição assinada única para cenário realizado/previsto, detalhes, KPIs, gráficos e exportação.
4. **F6 e F8:** seleção vazia, filtros independentes, buckets mensais e soma da evolução.
5. Completar lacunas de UI/exportação do plano; só então executar matriz financeira completa, lint/test/build e verificação visual 390/1440 px.

Não resolver F1 somando novamente os saldos incorretos ou ajustando o indicador ao gráfico por apresentação: corrigir a pertinência dos movimentos na origem. Não resolver inconsistências alterando os registros do usuário.

## 5. Encerramento desta auditoria

- **Resultado:** causas comprovadas e reproduzíveis; correção de produção pendente.
- **Versão:** `0.16.0`, sem incremento por análise.
- **Arquivos de auditoria:** este relatório, fonte do reprodutor e JSON; referências em `MASTER_PLAN.md` e `pendencias_dev.md`.
- **Próxima pauta:** corrigir os achados na ordem acima, reaproveitando o reprodutor como referência e convertendo contratos em testes permanentes adequados.
- **Limitação:** sem captura/seleção específica do usuário, não foi correlacionado um valor de produção com seus lançamentos reais. Os defeitos matemáticos locais independem desse acesso.

> **LLM:** deepseek-v4-pro | **Agente:** opencode
