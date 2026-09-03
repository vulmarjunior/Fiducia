# Plano de execução — Relatórios essenciais

> **LLM:** deepseek-v4-pro | **Agente:** opencode
>
> Data: 2026-09-02. Base verificada: web `0.15.5`.
> Estado: planejamento concluído; implementação não iniciada.
> Este documento orienta a futura tarefa de codificação. O pedido desta sessão autoriza elaborar o plano, sem executar código, publicar ou alterar dados financeiros.

> **Status atual (2026-09-03):** Implementação **concluída e fechada** na v0.16.0. A execução está registrada em `docs/archive/sessions/2026-09-03-fechamento-plano-relatorios.md` (fechamento integral), `2026-09-02-relatorios-essenciais-entrega.md` (entrega), `2026-09-02-correcao-auditoria-relatorios.md` e `2026-09-02-segunda-auditoria-resolucao.md` (auditorias). Permanecem pendentes apenas a validação visual final e a autorização explícita de deploy.

## 1. Resultado esperado

O usuário deve conseguir responder, sem interpretar uma metodologia extensa:

1. Em quais categorias gastei neste mês?
2. De quais categorias vieram minhas receitas?
3. Quanto entrou, saiu e restou no período?
4. Como o saldo de cada conta evoluiu e como fica incluindo pendências?

Entregar os quatro relatórios como um único escopo funcional. As etapas abaixo são incrementos de implementação, não justificativa para encerrar a tarefa após os primeiros dois relatórios.

As seis imagens fornecidas são exemplificativas. Incorporar navegação mensal central, filtros agrupados, lista de categorias com valores e percentuais, gráfico de distribuição, evolução temporal e tabela conferível. Preservar identidade visual, tema, componentes e idioma do Fiducia. Os dados, marcas e cores dos exemplos não são requisitos nem dados de teste. A implementação não depende dos arquivos temporários das imagens.

## 2. Escopo e limites

### Entregar

- Navegação principal: **Despesas | Receitas | Entradas × saídas | Fluxo por conta**.
- **Mais relatórios**: acesso a Extrato, Orçamento, Futuro, Faturas e IA existentes.
- Mês compartilhado, setas anterior/seguinte, seletor e botão Mês atual.
- Filtros múltiplos e combináveis, resumo visível, detalhes dos lançamentos e exportação CSV/PDF coerente com a seleção.
- Distribuição e evolução de despesas/receitas por categoria.
- Agrupamento diário/semanal/mensal e opção independente de acumulado.
- Situação de pagamento explícita e composição realizado/pendente quando aplicável.
- Fluxo individual e consolidado de contas, incluindo transferências corretamente.
- Testes dos cálculos e verificação visual/funcional em desktop e celular.

### Fora desta implementação

- Android, captura de notificações, migração de banco, regras de acesso, nova integração ou chamada automática de IA.
- Correções silenciosas, criação automática de lançamentos ou regravação dos saldos.
- Migração para data efetiva de pagamento, rateio de pagamento parcial entre compras e cadastro de conta pagadora de fatura. São extensões de modelo, não pré-requisitos: usar os comportamentos explícitos definidos neste plano.
- Redesenho geral do Dashboard ou remoção de análises avançadas.
- Novas bibliotecas de gráficos ou de estado sem necessidade demonstrada.

## 3. Diagnóstico e pontos a reaproveitar

| Arquivo atual | Papel e cuidado |
|---|---|
| `src/pages/Reports.tsx` | Sete abas, filtros e cálculos misturados à apresentação. Extrair responsabilidades sem acumular mais lógica no componente. |
| `src/lib/consumptionAnalysis.ts` | Despesas diretas, compras/créditos de cartão, categoria desconhecida e exclusão de pagamentos de fatura. Preservar cobertura existente; não confundir consumo com caixa. |
| `src/lib/monthlyStatement.ts` | Composição mensal realizada, compartilhada com Dashboard. Preservar contrato e resultados. |
| `src/lib/cashFlowView.ts` | Série diária e acumulado a partir do extrato; pendentes são lançamentos, não todas as faturas futuras. |
| `src/lib/cashCoverage.ts` | Obrigações futuras e vencimentos. Reaproveitar regras pertinentes, sem transportar automaticamente políticas de cobertura para um extrato histórico. |
| `src/lib/invoicePayment.ts` | IDs oficiais de pagamentos e resumo financeiro; compatibilidade com fatura paga sem `paidAmount`. |
| `src/lib/utils.ts` | `isEffectivelyPaid`, `getTransactionEffect`, `resolveCategoryId`, datas locais e regras compartilhadas. |
| `src/contexts/ReportingPeriodContext.tsx` | Mês persistido e compartilhado. Não criar outro mês global concorrente. |
| `src/components/MonthlyStatementEntries.tsx` | Detalhamento de lançamentos; reaproveitar ou adaptar sem quebrar consumidores antigos. |
| `src/lib/monthlyStatementCsv.ts`, `src/lib/pdfTemplates.ts` | Exportações existentes; preservar consumidores e usar o resultado filtrado nos novos relatórios. |
| `src/pages/Dashboard.tsx` | Navega para `statement` e `projection`; manter destinos funcionando após reorganizar as abas. |

Problemas a tratar na nova experiência: receitas sem categoria omitidas; detalhamento indisponível para receitas; rótulos de pago/recebido mesmo incluindo pendências; ausência de filtros por origem/categoria; mistura de períodos de fatura e datas bancárias; falta de fluxo por conta; legenda da pizza limitada às primeiras categorias; estados de carregamento que não devem parecer total zero.

## 4. Contrato de experiência

### 4.1 Período e filtros

- Abertura padrão de `/reports`: Despesas, no mês de `ReportingPeriodContext`. Navegação recebida do Dashboard tem precedência sobre esse padrão.
- Categoria: um mês por página, preservando filtros ao navegar entre meses. Evolução mensal oferece uma janela explícita de 3/6/12 meses terminando no mês selecionado; padrão de distribuição continua sendo um mês.
- Entradas × saídas e Fluxo por conta: padrão mês selecionado, com alternativa de intervalo personalizado. O cabeçalho sempre exibe as datas efetivas quando houver intervalo.
- Semanas começam na segunda-feira e são recortadas nos limites do intervalo. Rótulo mostra os dias realmente incluídos. Nenhum dia pode entrar em dois grupos.
- Acumulado é uma opção separada do agrupamento; começa no primeiro dia do intervalo, não no início do cadastro.
- Painel de filtros com busca, seleção múltipla, Selecionar todas, Limpar filtros, Cancelar e Aplicar. Fechar/cancelar descarta alterações ainda não aplicadas.
- Dentro de cada dimensão usar OU; entre dimensões usar E. Exemplo: (Alimentação OU Transporte) E (Itaú OU C6) E situação escolhida.
- Diferenciar seleção de todas de seleção vazia: vazia mostra ausência de seleção, não amplia silenciosamente para todas. Limpar filtros restaura padrões documentados.
- Categorias principais incluem descendentes, com união de IDs e sem duplicação. Permitir selecionar apenas uma subcategoria.
- Despesas/Receitas: categorias do respectivo tipo; origens agrupadas em Contas e Cartões. Selecionar conta bancária não seleciona compras de cartão por inferência.
- Entradas × saídas/Fluxo por conta: seleção de contas bancárias/carteiras/reservas, sem filtro de categoria que faria o saldo parecer completo apesar de omissões. Não oferecer cartão como conta de caixa.
- Todas as contas cadastradas entram por padrão nestes relatórios; `excludeFromCashFlow` continua regendo o motor de cobertura existente. Se o usuário quiser excluir reservas, deve vê-las desmarcadas no filtro, nunca ocultas de forma implícita.
- Filtros de relatório ficam em estado local, separados por tipo, e persistem durante a navegação da página. Compartilhar apenas o mês existente; não usar uma seleção de despesas escondida para filtrar receitas.
- Resumo sempre visível: período, origens, categorias quando aplicável e situação. Disponibilizar expansão quando houver muitas seleções.

### 4.2 Despesas e Receitas

- Mesmo componente de apresentação parametrizado por tipo; evitar duas implementações de cálculos equivalentes.
- Distribuição: total identificado, lista `Categoria | Valor | % do total filtrado` e pizza/rosca ou barras horizontais, em ordem decrescente.
- Usar cores estáveis por ID de categoria, compartilhadas entre gráfico, legenda e tabela. Não trocar cores quando o ranking mudar.
- Exibir todas as categorias na tabela. Na pizza, agrupar cauda em Outros somente se necessário e permitir abrir sua composição; a legenda deve explicar todas as fatias.
- Evolução: linhas ou colunas por categoria e tabela Categoria × Período. Seleção explícita das séries visíveis quando houver muitas; seleção visual de séries não altera silenciosamente o total financeiro.
- Desktop: lista e distribuição lado a lado; evolução acima da tabela. Celular: empilhar, filtros em diálogo utilizável por toque; limitar rolagem horizontal à matriz, mantendo categoria identificável.
- Abrir categoria, fatia, barra ou célula temporal mostra exatamente seus lançamentos e o total correspondente. Receitas têm o mesmo detalhamento de despesas.
- Padrão proposto para ambos: Todas as situações, com títulos **Despesas registradas** e **Receitas registradas**. O total não pode ser chamado de pago/recebido. Ao selecionar realizadas, usar rótulo correspondente.
- A situação bancária segue o lançamento. A situação das compras de cartão segue a fatura: quitada, a quitar ou parcial. Em filtro binário, parcial pertence a A quitar e permanece identificada como Parcial nos detalhes.
- O filtro de situação da fatura seleciona compras inteiras; não converte seus valores em parcelas pagas. Informar: **Situação da fatura; valores representam compras, não saldo a pagar**. Não inventar rateio por categoria.

### 4.3 Entradas × saídas

- Três indicadores: Entradas, Saídas e Resultado; saldo inicial/final como informação de apoio quando reconstruível.
- Gráfico de colunas para entradas/saídas. Evolução de saldo em gráfico separado e alinhado no tempo, para não comprimir as colunas com uma escala muito maior.
- Tabela: Período, Entradas, Saídas, Resultado, Saldo final; indicação de transferências externas à seleção e composição realizado/pendente quando presentes.
- Padrão: somente realizados. Com **Incluir pendentes**, rotular totais combinados como previstos e permitir conferir suas parcelas realizadas e pendentes. Usar legenda e estilo, não apenas cor.
- Resultado = entradas menos saídas. Inclui movimentos de caixa da seleção; transferências para fora/dentro da seleção são identificadas como transferências, não como receita/despesa por categoria.
- Acumulado soma entradas/saídas/resultados até cada intervalo. Saldo é o último saldo do intervalo, nunca a soma dos saldos.

### 4.4 Fluxo por conta

- Seleção única, várias contas ou todas. Modos Consolidado e Por conta, com o mesmo intervalo/situação.
- Indicadores: saldo inicial, entradas, saídas e saldo final. Tabela por período e conta; detalhe mostra origem/destino das transferências.
- Gráfico de linha de saldo; limitar comparação simultânea quando prejudicar leitura, mantendo acesso às demais contas na tabela.
- Com pendências, distinguir curva realizada e prevista. Pendência nunca altera `account.balance`.
- Capital inicial de conta aberta no meio do intervalo aparece como **Saldo de abertura**, separado de receitas/entradas operacionais. Antes da abertura, saldo não disponível; no consolidado, incorporar o capital explicitamente nessa data.

## 5. Contrato dos cálculos

### 5.1 Base normalizada, filtragem e precisão

1. Normalizar tipos/status em português e inglês e identificar cartão tanto por `creditCardId` como por `accountId` legado pertencente ao catálogo de cartões.
2. Resolver categorias legadas em memória, sem migração. Preservar Sem categoria, Categoria desconhecida e Origem desconhecida no total aplicável.
3. Usar centavos inteiros para somas, diferenças, deduplicação financeira e comparação. Formatar em reais somente na saída.
4. Cancelados nunca entram. Data ou valor inválido não vira zero silenciosamente: mostrar quantidade de registros não contabilizados e acesso ao diagnóstico.
5. Antes de aplicar `getTransactionEffect(tx, accountId)`, filtrar pertinência à conta de origem/destino, status e natureza bancária. A função não faz todas essas exclusões por conta própria.
6. Gráficos, KPIs, detalhes e exportação consomem o mesmo resultado calculado. Armazenar IDs e fontes dos itens para rastreabilidade.
7. Aplicar filtros antes de agregações/percentuais. Soma dos detalhes = linha; soma das linhas = total; tolerância de percentuais apenas pelo arredondamento visual.
8. Estados loading, erro e vazio são distintos; só apresentar total após as coleções necessárias estarem carregadas.

### 5.2 Datas e regimes

| Visão | Data/base |
|---|---|
| Categoria bancária | Data registrada do lançamento, normalizada como data civil local. |
| Categoria de cartão | Mês de `invoicePeriod`, com compras/parcelas e créditos desse período. |
| Caixa realizado | Data registrada do lançamento bancário, incluindo pagamentos de fatura identificados. |
| Caixa pendente | Data registrada do compromisso; fatura pelo vencimento correspondente. |

- Datas ISO com horário precisam ser normalizadas antes de comparar os limites inclusivos. Cobrir último dia do mês e timezone de Manaus.
- Não usar `updatedAt` como data do pagamento. A confirmação rápida atual mantém `date`; exibir **Pela data dos lançamentos**. Não prometer histórico bancário exato nem posição histórica do que era conhecido em certa data.
- No relatório de categoria de cartão, a composição mensal prevalece. Para evolução diária, usar `postingDate` e depois `date` apenas quando a data cair no mês de fatura. Caso contrário, exibir os itens em **Sem dia correspondente no mês da fatura**, com total acessível ao lado do gráfico e na tabela. Não atribuir um dia artificial nem perder valores para fazer o gráfico fechar.
- Falta de `invoicePeriod`: derivar em memória com a regra canônica somente se houver dados suficientes; caso contrário, expor itens sem período, sem somá-los a um mês inventado.
- Resultado acumulado tem base zero. Saldo tem base financeira; nunca intercambiar os nomes.

### 5.3 Cartões, créditos e faturas

- Categoria de despesas soma compras/parcelas e subtrai créditos/estornos de cartão. Pagamento de fatura é excluído dessa visão por IDs oficiais, inclusive pagamentos legados.
- Receitas excluem créditos/estornos internos do cartão; esses reduzem consumo. Manter tratamento atual de receitas bancárias e não inferir estorno bancário apenas pela descrição.
- Valores líquidos negativos por categoria continuam na tabela. Pizza não representa negativos: se houver qualquer categoria negativa ou total não positivo, apresentar barras com eixo zero e explicação curta; não usar valores absolutos para gerar percentuais fictícios.
- Caixa inclui pagamentos reais de fatura como saídas e exclui compras individuais, mesmo que a compra tenha status `pago`.
- Fatura paga sem `paidAmount` não gera obrigação remanescente. Fatura parcial gera apenas saldo restante, com valores canônicos compatíveis com `getInvoiceFinancialSummary` e cálculo líquido usado nos cartões.
- Não usar o motor de cobertura diretamente como histórico: ele pode reposicionar atrasados para hoje e excluir receitas vencidas. Nos novos relatórios preservar as datas registradas e identificar atrasos; não gerar recorrências ainda não materializadas.
- Antes de gerar obrigação sintética, contabilizar pagamentos realizados e agendamentos pendentes já vinculados à mesma fatura. Gerar apenas a parcela residual não representada; excesso/inconsistência vira diagnóstico, não soma adicional.
- Eventos sintéticos têm identidade estável por cartão/período/fonte e detalhe que abre a fatura; não simular ID de transação editável.
- O modelo atual de fatura não define conta pagadora futura. Somente atribuir obrigação a uma conta quando houver vínculo explícito de agendamento; não inferir pelo pagamento passado.
- No consolidado de todas as contas, exibir obrigações sem conta em **Faturas com conta a definir**, compondo previsão geral separada. Em seleção parcial/Por conta, mostrar o valor não alocado à parte, sem descontar de uma conta arbitrária.
- Explicitar a ponte: saldo previsto geral = soma dos saldos previstos das contas - obrigações sem conta. Sem pendências ou sem obrigações não alocadas, consolidado e soma por conta devem coincidir.
- Situação atual da fatura não prova quais compras foram quitadas por cada pagamento parcial. Não reconstruir essa informação nem apresentar fotografia histórica de status.

### 5.4 Transferências e saldos

- Categoria: excluir transferências internas. Fluxo: débito na origem, crédito no destino, via função canônica.
- Origem e destino selecionados: neutralizar a transferência nos totais consolidados e preservá-la no detalhe por conta. Apenas um lado selecionado: mostrar o efeito como transferência de entrada/saída.
- Separar pagamentos de fatura dessas transferências entre contas; o destino cartão não representa dinheiro disponível.
- Saldo inicial histórico: `initialBalance + soma dos efeitos realizados anteriores ao intervalo`, respeitando abertura e pertinência à conta. Nunca usar o saldo atual como saldo inicial de um mês passado.
- Conferir a integridade contra `account.balance` e todos os lançamentos realizados pertinentes, inclusive lançamentos futuros marcados pagos. Comparar a posição até hoje separadamente, para não fabricar divergência por diferença de horizonte.
- Se faltar base histórica confiável, houver movimentos anteriores à abertura incompatíveis ou divergência real, manter movimentações visíveis e marcar saldo **Não conciliado/Indisponível** com acesso ao diagnóstico. Não ajustar valores, não ocultar conta problemática da soma e não declarar saldo consolidado completo.
- Incluir pendentes simula apenas os compromissos do intervalo sobre a mesma base realizada. Pendências anteriores ficam sinalizadas fora do período; não incorporá-las silenciosamente nem chamar isso de projeção completa de liquidez.
- Históricos são recalculados com os registros atuais; alterações retroativas e mudança de status podem mudar o passado exibido. Não existe snapshot histórico garantido no modelo atual.

## 6. Arquitetura sugerida

Nomes abaixo são sugestões; adaptar ao padrão real do repositório mantendo responsabilidades.

| Camada | Arquivos sugeridos | Responsabilidade |
|---|---|---|
| Tipos | `src/types/reports.ts` | Filtros, eventos normalizados, buckets, linhas, diagnósticos e origem dos detalhes. |
| Normalização | `src/lib/reports/normalize.ts` | Tipos, datas locais, origem, categorias e pagamentos vinculados. |
| Categorias | `src/lib/reports/categoryReport.ts` | Elegibilidade, créditos, filtros, distribuição e séries. |
| Fluxo | `src/lib/reports/accountFlow.ts` | Efeito bancário por conta, transferências, base histórica e consolidado. |
| Pendências de cartão | `src/lib/reports/invoiceEvents.ts` | Adaptar regras canônicas, residual e não alocação; evitar segundo motor financeiro divergente. |
| Agregação | `src/lib/reports/periods.ts` | Dia/semana/mês, recorte de limites e acumulados sobre eventos já classificados. |
| Dados | `src/hooks/useReportData.ts` | Assinaturas Firestore necessárias, loading/erro e limpeza. |
| UI compartilhada | `src/components/reports/` | Navegação mensal, filtros, resumo, gráficos, tabela e detalhes. |
| Exportação | `src/lib/reports/export.ts` | CSV/PDF a partir do mesmo modelo visível. |
| Página | `src/pages/Reports.tsx` | Orquestração dos quatro relatórios e acesso aos avançados. |

- Manter `buildMonthlyStatement` e testes existentes para o Dashboard. O novo filtro por conta não pode alterar silenciosamente esse contrato.
- Extrair helpers de fatura somente com testes de equivalência nos consumidores atuais; não duplicar fórmulas apenas para terminar uma tela.
- Não abrir sete assinaturas por aba nova. Dados básicos compartilhados; análises avançadas podem carregar dados adicionais quando necessário.
- `useMemo` com dependências completas; helpers declarados antes do uso. Usar tipos reais e não espalhar `any` novo.
- Usar Recharts e componentes Base UI existentes. Visual e acessibilidade do Fiducia, sem copiar a implementação do produto ilustrado.

## 7. Etapas executáveis e critérios de saída

### Etapa 0 — Preparação e baseline

1. Ler `AGENTS.md`, `MASTER_PLAN.md`, `pendencias_dev.md` e este plano; conferir branch, diff, versão e últimos commits. Preservar alterações preexistentes.
2. Inspecionar módulos da seção 3, seus testes, tipos, confirmação de pagamento e cadastro/diagnóstico de contas.
3. Registrar em `pendencias_dev.md` o escopo de implementação recebido e o checkpoint da sessão. Android permanece pausado.
4. Executar baseline de lint, testes e build; registrar falhas preexistentes sem corrigi-las indiscriminadamente.

**Saída:** mapa de integrações e baseline registrados. Não confundir contagem histórica de testes da documentação com execução atual.

### Etapa 1 — Contrato financeiro e testes

1. Criar tipos e fixtures sintéticas com os cenários da seção 8.
2. Implementar funções puras de normalização, período, filtro, categorias e efeito por conta.
3. Implementar estado realizado/pendente, faturas residuais, não alocação e diagnósticos de base histórica.
4. Demonstrar reconciliação dos totais e compatibilidade dos consumidores existentes.

**Saída:** matriz financeira passando antes de conectar gráficos; regras de casos legados comprovadas.

### Etapa 2 — Estrutura e filtros

1. Criar navegação principal, Mais relatórios e seletor mensal compartilhado.
2. Implementar painel de filtros, estado aplicado/rascunho e resumo visível.
3. Preservar destinos `statement`/`projection` do Dashboard e acesso às demais análises. Se mapear `categories` para Despesas e `cashflow` para Entradas × saídas, fazer explicitamente.
4. Preparar estados de loading/erro/vazio e detalhes com foco/rolagem corretos.

**Saída:** navegação e filtros utilizáveis em desktop/celular, sem regressão nos atalhos antigos.

### Etapa 3 — Despesas e Receitas

1. Integrar distribuição, barras horizontais, lista e total filtrado.
2. Implementar evolução diária/semanal/mensal, seleção de séries e matriz.
3. Implementar detalhes para ambos os tipos, incluindo Sem categoria, créditos, Outros e itens sem dia de fatura.
4. Tratar valores negativos e situação parcial sem pizza enganosa nem rateio artificial.

**Saída:** dois relatórios completos e simétricos, cada valor rastreável. Não encerrar o escopo aqui.

### Etapa 4 — Entradas × saídas

1. Integrar período, agrupamento e acumulado independentes.
2. Criar indicadores, colunas comparativas, tabela e gráfico separado de saldo.
3. Mostrar realizado/pendente/previsto e obrigações de cartão sem duplicação.
4. Validar limites de semana, pagamentos de fatura e transferências da seleção.

**Saída:** totais invariantes ao mudar agrupamento; saldo e resultado corretamente identificados.

### Etapa 5 — Fluxo por conta

1. Integrar base histórica, capital de abertura, seleção de contas e transferências.
2. Implementar Consolidado/Por conta, curvas realizadas/previstas e detalhamento.
3. Expor falta de base, divergências e faturas sem conta pagadora.
4. Conferir soma das contas e ponte das obrigações não alocadas.

**Saída:** saldos explicáveis e conciliáveis, ou limitação explicitamente indicada; nenhuma escrita financeira pelo relatório.

### Etapa 6 — Exportações e verificação final

1. Exportar CSV/PDF com nome do relatório, datas, filtros, situação, agrupamento, tabela e totais da tela. Incluir saldo/base e notas de não alocação quando aplicáveis.
2. Proteger CSV de interpretação de descrições como fórmulas; seguir escaping e padrões existentes. Usar dados sintéticos na verificação.
3. Executar matriz funcional, verificação visual e regressões das seções 8/9.
4. Corrigir documentação metodológica hoje imprecisa: nem todo relatório é exclusivamente por competência. Descrever cada relatório pelo contrato realmente entregue.
5. Encerrar documentação conforme protocolo do projeto; preencher evidências e pendências reais, sem declarar publicação que não ocorreu.

**Saída:** quatro relatórios concluídos, exportações conferidas, gates aprovados e limitações registradas.

## 8. Matriz mínima de testes financeiros

Testar comportamento e invariantes, não estrutura de componente ou implementação interna.

| Caso | Resultado esperado |
|---|---|
| Categorias A/B, contas X/Y, seleção A + X | Apenas interseção; OU dentro da dimensão e E entre dimensões. |
| Categoria pai e filha selecionadas | Cada transação entra uma vez. |
| Receita sem categoria/referência inválida | Aparece no grupo apropriado; total preservado. |
| ISO no último dia do mês, virada do ano e fevereiro bissexto | Limites locais inclusivos e dias corretos. |
| Semana atravessando mês | Somar só dias do intervalo; total semanal = diário = mensal. |
| Categoria de cartão sem dia dentro de `invoicePeriod` | Valor mensal preservado e grupo sem dia conferível. |
| Compra R$ 300 e estorno R$ 50 no cartão | Despesa líquida R$ 250; receitas bancárias não aumentam. |
| Categoria líquida negativa | Tabela/barras preservam sinal; pizza não usa valor absoluto. |
| Compra e pagamento da mesma fatura | Compra só no consumo; pagamento só no caixa. |
| Fatura R$ 1.000, pagamento realizado R$ 400, sem agendamento | Caixa realizado R$ 400 e obrigação residual R$ 600; situação parcial, sem rateio de compras. |
| Mesma fatura com pagamento pendente vinculado R$ 200 | Pendentes totais R$ 600: R$ 200 registrado + R$ 400 residual; não R$ 800. |
| Fatura paga legada sem `paidAmount` | Residual zero; não duplicar IDs de pagamento. |
| Fatura sem conta pagadora | Não descontar arbitrariamente de nenhuma conta; ponte explícita no total geral. |
| Transferência R$ 200 de A para B | A -200; B +200; A+B líquido zero e sem inflar entradas/saídas consolidadas. |
| Saldo inicial R$ 1.000, receita R$ 500, despesa R$ 200 | Resultado R$ 300; saldo final R$ 1.300. |
| Exemplo anterior + despesa pendente R$ 100 | Realizado R$ 1.300; previsto R$ 1.200; banco permanece inalterado. |
| Conta aberta no meio do período | Capital inicial aparece na abertura, sem virar receita. |
| Ausência de `initialBalance` ou base divergente | Movimentação preservada; saldo incompleto sinalizado, sem correção automática. |
| Pago com data futura e pendente atrasado fora do intervalo | Não criar divergência por horizontes diferentes nem mover datas silenciosamente. |
| Cancelado e cartão legado por `accountId` | Cancelado excluído; cartão não entra no saldo bancário. |
| Nenhum dado, seleção vazia, erro de assinatura | Estados distintos; nenhum zero que esconda erro/carregamento. |
| Tela, detalhe, CSV e PDF | Mesmo conjunto, filtros, valores e composição. |

Manter testes de `monthlyStatement`, `cashFlowView`, `consumptionAnalysis`, `cashCoverage` e `invoicePayment` passando. Se um contrato antigo precisar mudar, demonstrar motivo e impacto antes de atualizar expectativas.

## 9. Verificação de interface e aceite

Verificar em aproximadamente 390 px e 1440 px, temas claro/escuro:

- Trocar mês por setas, seletor e Mês atual; filtros não desaparecem e mês recebido do Dashboard é respeitado.
- Aplicar categoria e conta juntas, selecionar várias, cancelar edição e limpar filtros.
- Alternar Despesas/Receitas sem filtros incompatíveis ocultos.
- Alternar distribuição/evolução e diário/semanal/mensal/acumulado sem mudar totais indevidamente.
- Abrir detalhes de categoria, célula temporal, transferência e fatura prevista; valores correspondem ao elemento acionado.
- Conferir pagos/pendentes, parcial e créditos; rótulos/legendas representam a seleção.
- Fluxo individual e consolidado explicam transferências e faturas não alocadas.
- Gráficos têm alternativa em tabela, controles com nomes acessíveis, foco visível e operação por teclado. Não depender de hover ou apenas da cor.
- Sem estouro horizontal da página; matriz pode rolar dentro do componente. Diálogos têm fechamento e ações acessíveis no celular.
- Sem erros de console, consultas repetidas por cada aba ou chamada automática de IA.
- Mais relatórios, atalhos do Dashboard, exportações antigas e edição existente de lançamento permanecem funcionais. Testar mutações somente em ambiente/fixtures apropriados, sem editar dados reais para validar interface.

Gates finais:

```bash
npm run lint
npm run test -- --maxWorkers=1
npm run build
```

Executar testes de emulador se alguma integração/regras for afetada ou se o gate do CI exigir. Registrar testes ignorados por ambiente; não declará-los aprovados. Usar a skill de navegador disponível antes de operar o navegador; ao editar múltiplos TSX, aplicar o checklist React pertinente disponível no ambiente.

## 10. Versionamento, entrega e continuidade

- Este planejamento mantém `0.15.5`. Não criar release/changelog de funcionalidade inexistente.
- Para a entrega completa e retrocompatível, alvo sugerido `0.16.0`, desde que a base não tenha avançado. Revalidar SemVer no momento da implementação.
- Sincronizar pontos oficiais de versão existentes (`package.json`, lockfile, `APP_VERSION` e referências oficiais aplicáveis) somente ao concluir a entrega.
- Atualizar `MASTER_PLAN.md` com estado real; `CHANGELOG.md` com benefício e validações da release; documentação arquitetural/metodológica com regras duradouras; `pendencias_dev.md` com execução atual, depois arquivar a sessão.
- Preservar a assinatura documental exigida em `AGENTS.md`.
- Relatar arquivos, evidências, limitações e estado de publicação. Deploy/push/merge seguem a autorização da tarefa de implementação; este documento não é autorização de publicação.
- Se houver interrupção, registrar etapa concluída, arquivos alterados, testes executados e próximo passo verificável. Não duplicar este plano inteiro no registro da sessão.

## 11. Instrução de partida para o agente

Quando receber a tarefa de implementação, ler a inicialização obrigatória e executar este plano em ordem. Começar pelos contratos e testes financeiros, continuar pelos quatro relatórios e finalizar com exportações, verificação e documentação. Usar os critérios de saída para demonstrar progresso. Resolver escolhas rotineiras de componentes dentro dos padrões do projeto; não introduzir modelos de dados, rateios, migrações ou interpretações financeiras diferentes para contornar casos legados.

> **LLM:** deepseek-v4-pro | **Agente:** opencode
