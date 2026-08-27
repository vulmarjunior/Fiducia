# Changelog — Fiducia

> Histórico permanente de releases, organizado por versão e data.
> **LLM:** deepseek-v4-pro | **Agente:** opencode

---

## [0.15.3] — 2026-08-27 — Migração do Modelo Groq

**Resultado:** Os recursos de IA sob demanda voltam a usar um modelo disponível no plano gratuito/desenvolvedor da Groq após o desligamento do Llama 3.3 70B.

**Correção e causa-raiz:**
- A Function `/api/groq` passou a ser executada corretamente na v0.15.2, mas a Groq respondia `404` porque `llama-3.3-70b-versatile` foi descontinuado em 16/08/2026 nesses planos.
- O modelo padrão e permitido foi substituído por `openai/gpt-oss-120b`, recomendação oficial da Groq para essa migração.
- Chamadores de fatura passaram a usar o modelo padrão centralizado em `groqService.ts`, evitando novas divergências locais.
- A função não utilizada `isPositive()` foi removida de `firestore.rules`, eliminando avisos de compilação.

**Validações:** aguardando repetição de lint, testes, build, deploy e chamada autenticada em produção.

> **LLM:** deepseek-v4-pro | **Agente:** opencode

---

## [0.15.2] — 2026-08-27 — Estabilização de IA, Importação e Acesso Pessoal

**Resultado:** O Dashboard deixa de consumir IA automaticamente, as integrações Groq sob demanda passam a ter proxy e limites compatíveis com importações extensas, transferências da Central de Importação atualizam as duas contas e backup/reset cobrem as coleções atuais.

**Alterações técnicas:**
- `api/groq.ts`, `src/services/groqService.ts` e `vercel.json` — rota server-side explícita, acesso restrito ao proprietário, validação de mensagens, timeout, erros legíveis e limite de saída de até 6.000 tokens.
- `src/pages/Dashboard.tsx` — remoção completa da dica financeira automática e de seus estados, prompt, toast e apresentação.
- `src/components/Logo.tsx` — selo visual alinhado à versão oficial do aplicativo.
- `src/services/importCandidateService.ts` e `src/pages/ImportCenter.tsx` — conta de destino obrigatória, confirmação manual de transferências e atualização atômica dos saldos de origem e destino.
- `src/pages/Settings.tsx` — backup versionado com perfil, preferências, parcelamentos e candidatos de importação; reset inclui as coleções atuais e zera `balance`/`initialBalance` somente após exclusões sem erro.
- `firestore.rules` e `src/integration/firestoreRules.emulator.test.ts` — política simplificada de proprietário único, sem dependência de `role`, mantendo isolamento por `userId`.
- `src/lib/invoiceAnalysis.test.ts` — referência temporal fixa, eliminando flutuação conforme a data de execução.
- `package.json`, `package-lock.json` e `APP_VERSION` — versão `0.15.2`.

**Validações:**
- `npm run lint` — sem erros.
- `npm run test -- --maxWorkers=1` — 90 testes aprovados; 3 cenários de emulador ignorados nessa execução.
- `npm run build` — build de produção concluído.
- `npm run test:emulator` — não executado localmente porque o ambiente possui Java 8 e o Firebase CLI exige Java 21; o workflow de CI provisiona Java 21.

**Impacto operacional:** publicada em 27/08/2026. O roteamento e as regras entraram em produção, mas a validação identificou o modelo Groq descontinuado; correção preparada na v0.15.3.

> **LLM:** deepseek-v4-pro | **Agente:** opencode

---

## [0.15.1] — 2026-08-06 — Projeção Futura com Escalas Separadas

**Resultado:** A Projeção Futura deixa de misturar compromissos mensais positivos e saldo projetado negativo no mesmo eixo. Entradas e saídas passam a ocupar um gráfico de barras iniciado em zero, enquanto a evolução do saldo aparece separadamente e parte do saldo atual.

**Alterações técnicas:**
- `src/pages/Reports.tsx` — separação do gráfico composto em “Compromissos por mês” e “Evolução do saldo projetado”.
- O gráfico de saldo inclui o ponto inicial “Hoje”, linha de referência em zero e explicação de que valores negativos representam falta de cobertura projetada, não despesa mensal.
- Layout responsivo em uma coluna nas telas menores e duas colunas em telas largas.
- `package.json`, `package-lock.json` e `APP_VERSION` — versão `0.15.1`.

**Segurança operacional:**
- Mudança exclusivamente de leitura e apresentação; nenhum documento do Firestore foi alterado.

**Validações:**
- `npm run lint` — sem erros.
- Testes e build aguardam repetição em ambiente que permita iniciar o processo do Vite; a sandbox local bloqueou `spawn` com `EPERM`.

> **LLM:** deepseek-v4-pro | **Agente:** opencode

---

## [0.15.0] — 2026-08-05 — Fluxo e Faturas sem Alarmismo

**Resultado:** Fluxo de Caixa deixa claro que seu resultado acumulado não é saldo bancário e passa a exibir cards coerentes com o horizonte escolhido. Faturas separa obrigações atuais, consumo em andamento, próximos 90 dias e histórico pago.

**Alterações técnicas:**
- `src/pages/Reports.tsx` — cards mensais de entradas, saídas, resultado e dia mais pesado; em 3/6/12 meses, médias mensais e resultado do último mês.
- Colunas de entradas/saídas começam em zero e o resultado acumulado passa a um gráfico separado, com linha de referência e aviso explícito de que não representa saldo de conta.
- Faturas usa valores líquidos de créditos/estornos por padrão e remove filtros que não atualizavam toda a tela.
- KPIs de Faturas reorganizados em A pagar agora, Em andamento, Próximos 90 dias e Média histórica paga; pagamentos passados e recordes deixam de aparecer como alertas.
- `src/lib/invoiceAnalysis.ts` — média somente de faturas pagas, futuro limitado a 90 dias, próximo vencimento e comparação mês a mês com o período imediatamente anterior.
- Gráficos de Faturas separam histórico até o mês atual e parcelas futuras dos próximos 90 dias.
- `src/lib/pdfTemplates.ts` — PDFs acompanham a nova semântica decisória.
- `src/lib/invoiceAnalysis.test.ts` — regressões para valores líquidos, média paga e limite futuro.
- `package.json`, `package-lock.json` e `APP_VERSION` — versão `0.15.0`.

**Segurança operacional:**
- Mudanças exclusivamente de leitura e apresentação; nenhum documento do Firestore foi alterado.

**Validações:**
- `npm run lint` — sem erros.
- `npx vitest run --maxWorkers=1` — 90 testes aprovados; 2 cenários de emulador ignorados sem host local.
- `npm run build` — build de produção concluído.

> **LLM:** deepseek-v4-pro | **Agente:** opencode

---

## [0.14.0] — 2026-08-05 — Margem de Caixa Decisória

**Resultado:** Cobertura de Caixa passa a ser Margem de Caixa e responde quanto pode ser assumido em novos compromissos sem consumir a reserva protegida. A Projeção Futura deixa de exigir a escolha entre cenários e usa uma única composição auditável.

**Alterações técnicas:**
- `src/lib/cashCoverage.ts` — compromissos registrados, faturas abertas/fechadas e parcelas futuras entram na projeção padrão; recorrências ainda não geradas ficam opcionais.
- Recorrências passam a compor de forma consistente saldo diário, totais e projeção mensal; recorrências de cartão afetam o caixa no vencimento da fatura.
- Receitas vencidas ainda não recebidas deixam de aumentar silenciosamente a cobertura e são informadas separadamente.
- `src/pages/Dashboard.tsx` — card Margem de Caixa em 90 dias, reserva protegida, menor saldo/data e navegação direta para a aba Futuro.
- `src/pages/Reports.tsx` — horizontes de 30/60/90/180/365 dias ou data final; opções explícitas para recorrências e reservas; remoção dos cenários e filtros que não recalculavam os KPIs.
- `src/lib/cashCoverage.test.ts` — regressões de margem, receitas vencidas, recorrências, vencimento do cartão e igualdade entre totais e saldo final.
- `package.json`, `package-lock.json` e `APP_VERSION` — versão `0.14.0`.

**Segurança operacional:**
- Nenhuma escrita ou migração no Firestore; a reserva protegida é uma preferência local do navegador.

**Validações:**
- `npm run lint` — sem erros.
- `npx vitest run --maxWorkers=1` — 88 testes aprovados; 2 cenários de emulador ignorados sem host local.
- `npm run build` — build de produção concluído.

> **LLM:** deepseek-v4-pro | **Agente:** opencode

---

## [0.13.0] — 2026-08-05 — Relatórios Organizados e Exportáveis

**Resultado:** Relatórios passa a ter abas legíveis no celular, nomes mais diretos e exportação CSV do Extrato Mensal. A visão Orçamento agora acompanha o mês selecionado, inclusive para consultas históricas.

**Alterações técnicas:**
- `src/lib/monthlyStatementCsv.ts` — exportador CSV em formato compatível com planilhas em português, com nomes de conta/cartão e categoria.
- `src/pages/Reports.tsx` — botão Exportar CSV, nomes visíveis nas abas móveis e remoção de selos antigos.
- Tendência/Orçamento passa a usar `selectedMonth` na curva, no realizado, no título e no PDF; meses anteriores mostram todos os dias do período.
- `src/lib/monthlyStatementCsv.test.ts` — regressões para conteúdo, formatação monetária e escape de separadores/aspas.
- `package.json`, `package-lock.json` e `APP_VERSION` — versão `0.13.0`.

**Segurança operacional:**
- Mudança exclusivamente de leitura e apresentação; nenhum documento do Firestore foi alterado ou migrado.

**Validações:**
- `npm run lint` — sem erros.
- `npx vitest run --maxWorkers=1` — 84 testes aprovados; 2 cenários de emulador ignorados sem host local.
- `npm run build` — build de produção concluído.

> **LLM:** deepseek-v4-pro | **Agente:** opencode

---

## [0.12.0] — 2026-08-05 — Consumo Investigável

**Resultado:** A antiga visão Categorias passa a ser Consumo e explica onde o dinheiro foi gasto, quanto ocorreu diretamente em conta ou no cartão e o que mudou em relação ao período anterior. Cada categoria abre os lançamentos que compõem o valor.

**Alterações técnicas:**
- `src/lib/consumptionAnalysis.ts` — motor de consumo por competência: despesas diretas pela data efetiva, cartão por `invoicePeriod`, exclusão de pagamentos de fatura e compensação de créditos/estornos.
- `src/pages/Reports.tsx` — KPIs de consumo, conta, cartão e variação; maiores aumentos/reduções; alerta de itens sem categoria; tabela e modal investigáveis.
- Períodos Mês/3M/6M/12M acompanham o mês global selecionado e são comparados com uma janela anterior equivalente.
- `src/components/MonthlyStatementEntries.tsx` — suporte visual a compras e créditos de cartão, incluindo identificação do cartão.
- `src/lib/consumptionAnalysis.test.ts` — regressões para dupla contagem, compras pendentes em fatura, estornos, variação e ausência de categoria.
- `package.json`, `package-lock.json` e `APP_VERSION` — versão `0.12.0`.

**Segurança operacional:**
- Mudança somente de leitura; nenhum documento do Firestore foi alterado ou migrado.

**Validações:**
- `npm run lint` — sem erros.
- `npx vitest run --maxWorkers=1` — 82 testes aprovados; 2 cenários de emulador ignorados sem host local.
- `npm run build` — build de produção concluído.

> **LLM:** deepseek-v4-pro | **Agente:** opencode

---

## [0.11.0] — 2026-08-05 — Fluxo de Caixa Mensal Investigável

**Resultado:** O Fluxo de Caixa passa a abrir no modo Mês, acompanha o período selecionado no Dashboard e permite investigar os lançamentos de cada dia. As visões de 3, 6 e 12 meses permanecem disponíveis como comparações históricas secundárias.

**Alterações técnicas:**
- `src/lib/cashFlowView.ts` — composição diária reconciliada ao Extrato Mensal, com pagamentos vinculados de fatura, pendências opcionais e acumulação monetária em centavos.
- `src/pages/Reports.tsx` — modo Mês padrão, seletor mensal compartilhado, gráfico diário de entradas/saídas/acumulado e lista de dias clicável com modal responsivo.
- Períodos históricos agora terminam no mês global selecionado, em vez de sempre usarem o mês civil atual.
- `src/lib/pdfTemplates.ts` — exportação reconhece corretamente o período Mês.
- `src/lib/cashFlowView.test.ts` — regressões para reconciliação diária, fatura vinculada, pendências, compras de cartão e precisão monetária.
- `package.json`, `package-lock.json` e `APP_VERSION` — versão `0.11.0`.

**Segurança operacional:**
- Mudança exclusivamente de leitura e navegação; nenhum documento do Firestore foi alterado ou migrado.

**Validações:**
- `npm run lint` — sem erros.
- `npx vitest run --maxWorkers=1` — 80 testes aprovados; 2 cenários de emulador ignorados sem host local.
- `npm run build` — build de produção concluído.

> **LLM:** deepseek-v4-pro | **Agente:** opencode

---

## [0.10.0] — 2026-08-05 — Extrato Mensal Investigável

**Resultado:** Os cards “Receitas do mês” e “Despesas do mês” agora abrem a composição completa em uma experiência responsiva. Relatórios ganha a aba “Extrato Mensal”, reconciliada com os mesmos totais do Dashboard e com separação entre despesas em conta e pagamentos de fatura.

**Alterações técnicas:**
- `src/lib/monthlyStatement.ts` — motor único de leitura para receitas recebidas, despesas bancárias e pagamentos de fatura atuais ou legados.
- `src/components/MonthlyStatementEntries.tsx` — lista vertical reutilizável, sem rolagem horizontal, com conta, categoria, origem e navegação para o lançamento.
- `src/pages/Dashboard.tsx` — cards clicáveis por mouse e teclado; detalhamento ocupa a largura útil no celular e mantém cabeçalho, resumo e ações organizados.
- `src/pages/Reports.tsx` — nova aba inicial “Extrato Mensal”, com seletor de mês, quatro indicadores reconciliados e filtros Tudo/Receitas/Despesas.
- `src/lib/monthlyStatement.test.ts` — regressões para o total R$ 2.368,99, pagamentos legados vinculados, pendências, transferências comuns e compras de cartão.
- `package.json`, `package-lock.json` e `APP_VERSION` — versão `0.10.0`.

**Segurança operacional:**
- Mudança exclusivamente de leitura e navegação; nenhum documento do Firestore foi criado, atualizado ou migrado.
- A identificação de pagamento de fatura continua restrita aos IDs oficialmente vinculados em `invoices`.

**Validações:**
- `npm run lint` — sem erros.
- `npx vitest run --maxWorkers=1` — 78 testes aprovados; 2 testes de emulador ignorados sem host local.
- `npm run build` — build de produção concluído.
- Aplicação local carregada sem tela em branco, overlay do Vite ou erros de console.
- Deploy de produção no Vercel concluído com estado `READY` para o commit `740bc8c` e alias `fiducianew.vercel.app`.

> **LLM:** deepseek-v4-pro | **Agente:** opencode

---

## [0.9.3] — 2026-08-05 — Faturas Quitadas em Contas a Pagar

**Resultado:** O card “Contas a Pagar” deixa de contabilizar faturas já quitadas e passa a exibir apenas o saldo oficial de faturas parcialmente pagas.

**Alterações técnicas:**
- `src/pages/Dashboard.tsx` — composição das faturas pendentes reutiliza `getInvoiceFinancialSummary()`, considerando `status`, `paidAmount` e compatibilidade legada.
- O cálculo por compras, transferências e créditos permanece como fallback quando ainda não existe documento em `invoices`.
- `src/lib/invoicePayment.test.ts` — regressões para fatura atual quitada por múltiplos pagamentos e saldo parcial oficial.
- `package.json`, `package-lock.json` e `APP_VERSION` — versão `0.9.3`.

**Segurança operacional:**
- Mudança somente de leitura no Dashboard; nenhum documento do Firestore foi alterado ou migrado.

**Validações:**
- `npm run lint` — sem erros.
- `npx vitest run src/lib/invoicePayment.test.ts --maxWorkers=1` — 15 testes aprovados.
- `npx vitest run --maxWorkers=1` — 76 testes aprovados; 2 testes de emulador ignorados sem host local.
- `npm run build` — build de produção concluído.

---

## [0.9.2] — 2026-08-05 — Comprometimento Futuro Recolhível

**Resultado:** O modal de fatura mantém visível o resumo do comprometimento futuro, mas inicia os detalhes mensais recolhidos para reduzir a rolagem e priorizar as informações da fatura selecionada.

**Alterações técnicas:**
- `src/pages/CreditCards.tsx` — cabeçalho clicável com total, quantidade de parcelas e faturas, controle por `aria-expanded`/`aria-controls` e detalhes renderizados sob demanda.
- O estado volta a recolhido ao abrir outro cartão, trocar o período ou fechar o modal.
- `package.json`, `package-lock.json` e `APP_VERSION` — versão `0.9.2`.

**Segurança operacional:**
- Mudança exclusivamente visual; nenhum cálculo, documento do Firestore ou fluxo financeiro foi alterado.

**Validações:**
- `npm run lint` — sem erros.
- `npx vitest run --maxWorkers=1` — 74 testes aprovados; 2 testes de emulador ignorados sem host local.
- `npm run build` — build de produção concluído.

---

## [0.9.1] — 2026-08-05 — Compatibilidade de Pagamentos Legados no Dashboard

**Resultado:** O card “Despesas do mês” passa a considerar pagamentos de fatura vinculados oficialmente, inclusive registros legados salvos como transferência. Faturas legadas marcadas como pagas deixam de carregar um falso saldo remanescente para o mês seguinte. Nenhum documento do Firebase é alterado.

**Alterações técnicas:**
- `src/lib/invoicePayment.ts` — identificação canônica dos IDs presentes em `paymentTransactionIds[]` e no campo legado `paymentTransactionId`; status `paga` passa a ser a fonte de verdade para quitação total quando `paidAmount` está ausente ou zerado em dados legados.
- `src/pages/Dashboard.tsx` — cálculo mensal inclui pagamentos vinculados pela data efetiva do lançamento e mantém compras individuais de cartão excluídas.
- `src/lib/invoicePayment.test.ts` — testes para vínculos atuais, legado singular, rejeição de inferência por descrição e bloqueio do transporte indevido de saldo para o mês seguinte.
- `package.json`, `package-lock.json` e `APP_VERSION` — versão `0.9.1`.

**Segurança operacional:**
- Nenhum documento do Firestore foi alterado ou migrado.
- A compatibilidade de pagamentos ficou restrita ao card do Dashboard; a compatibilidade de quitação atua somente na leitura do resumo financeiro das faturas.

**Validações:**
- `npm run lint` — sem erros.
- `npx vitest run --maxWorkers=1` — 74 testes aprovados; 2 testes de emulador ignorados sem host local.
- `npm run build` — build de produção concluído.
- Deploy de produção no Vercel concluído com estado `READY` para o commit `d423282`.
- Validação visual autenticada: Dashboard de agosto em R$ 16.071,31 e C6 Carbon de setembro em R$ 3.375,18, sem saldo legado transportado.

---

## [0.9.0] — 2026-08-04 — Estabilização, Desempenho e Experiência Guiada

**Resultado:** O Fiducia ganhou uma base mais segura e rápida, navegação mobile dedicada, orientação para novos usuários, explicações transparentes dos indicadores e operações em lote para a rotina de lançamentos.

**Alterações técnicas:**
- Dependências de produção auditadas sem vulnerabilidades conhecidas; `xlsx` foi substituído por `read-excel-file`, e formatos XLS legados passaram a ser rejeitados com orientação para XLSX/CSV.
- Firebase Emulator integrado ao CI para validar isolamento entre usuários e o fluxo atômico de pagamento parcial e total de fatura.
- Navegação mobile inferior com ação central de novo lançamento, semântica de página ativa, Escape no menu, controles acessíveis e suporte a movimento reduzido.
- Lógica de filtro, ordenação, agrupamento e saldo progressivo extraída de `Transactions.tsx` para módulo puro com testes.
- Rotas e `TransactionDialog` carregados sob demanda; pacote inicial reduzido de aproximadamente 3,74 MB para 1,23 MB antes de gzip.
- Cache persistente multiaba do Firestore; histórico da Central de Importação limitado a 250 registros e apoiado por índice composto.
- Checklist de primeiros passos no Dashboard, explicação detalhada de Saldo Geral, Receitas e Despesas.
- Filtros de lançamentos persistidos no dispositivo e categorização em lote com proteção de período fechado, limite operacional e validação do tipo da categoria.
- `package.json`, `package-lock.json` e `APP_VERSION` atualizados para `0.9.0`.

**Validações:**
- `npm run lint` — sem erros.
- `npx vitest run --maxWorkers=1` — 70 testes aprovados; 2 testes de emulador condicionais ao ambiente.
- `npm run build` — build de produção concluído.
- `npm audit --omit=dev` — 0 vulnerabilidades em dependências de produção.
- CI da `main` e deploy Vercel aprovados; índice composto de `importCandidates` publicado no Firestore de produção.

---
## [0.8.1] — 2026-08-04 — Hotfix do Runtime do Proxy Groq

**Resultado:** A função serverless da Groq inicializa corretamente no Vercel e rejeita chamadas sem autenticação antes de acessar o provedor de IA.

**Alterações técnicas:**
- `api/groq.ts` — removida importação JSON incompatível com o runtime serverless; configuração pública do Firebase passa a ser constante server-side.
- `package.json`, `package-lock.json`, `src/lib/utils.ts` — versão `0.8.1`.

**Validações:**
- TypeScript, testes e build aprovados.
- Endpoint de produção sem token deve responder HTTP 401.

---
## [0.8.0] — 2026-08-04 — Segurança da IA e Consistência Operacional

**Resultado:** As quatro pendências técnicas prioritárias foram concluídas. A chave Groq deixou o navegador, pagamentos e saldos ganharam testes integrados, lançamentos de cartão importados podem ser editados corretamente e Dashboard/Lançamentos compartilham o mesmo mês de referência.

**Alterações técnicas:**
- `api/groq.ts` — proxy Vercel autenticado por Firebase ID token, validação de payload e limite de parâmetros.
- `src/services/groqService.ts`, `vite.config.ts` — cliente usa `/api/groq`; removida a injeção da chave no bundle.
- `src/lib/financialFlows.integration.test.ts` — fluxo integrado de pagamentos parciais, quitação, saldo e precisão em centavos.
- `src/lib/creditCardTransaction.ts`, `src/components/TransactionDialog.tsx` — normalização de lançamentos de cartão legados/importados.
- `src/contexts/ReportingPeriodContext.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Transactions.tsx` — mês persistente e compartilhado.
- `package.json`, `package-lock.json`, `src/lib/utils.ts` — versão `0.8.0`.

**Validações:**
- `npm run lint` — sem erros.
- `npx vitest run --maxWorkers=1` — 66/66 testes passando.
- `npm run build` — build de produção concluído.
- Bundle inspecionado — nenhum padrão de chave Groq presente.

---
## [0.7.3] — 2026-08-04 — Visibilidade e Consistência de Pagamentos Parciais

**Resultado:** O usuário passa a ver claramente quanto já pagou e quanto ainda falta pagar. O card do cartão, o detalhe da fatura e os relatórios usam o saldo remanescente, sem reapresentar a fatura anterior pelo valor integral.

**Alterações técnicas:**
- `src/lib/invoicePayment.ts` — resumo financeiro canônico com total, pago, restante, progresso e status.
- `src/lib/invoicePayment.test.ts` — cobertura do resumo parcial, fallback calculado e limite do valor pago.
- `src/pages/CreditCards.tsx` — card líquido, progresso do pagamento, histórico vinculado, saldo remanescente destacado e ação responsiva para pagar o restante.
- `src/lib/invoiceAnalysis.ts`, `src/pages/Reports.tsx` — obrigações e projeções usam o valor restante; pagamentos parciais entram no total pago.
- `package.json`, `src/lib/utils.ts` — versão `0.7.3`.

**Validações:**
- `npm run lint` — sem erros.
- `npx vitest run --maxWorkers=1` — 63/63 testes passando.
- `npm run build` — build de produção concluído.

---
## [0.7.2] — 2026-08-04 — Correção do Pagamento Total e Parcial de Faturas

**Resultado:** Pagamentos de fatura passam a preservar o total canônico da obrigação, acumular pagamentos parciais com precisão em centavos e concluir a fatura somente quando o saldo remanescente chega a zero. Cliques duplicados são bloqueados durante a gravação.

**Alterações técnicas:**
- `src/lib/invoicePayment.ts` — motor puro para validar e calcular pagamento, saldo remanescente e status `parcial`/`paga` em centavos.
- `src/lib/invoicePayment.test.ts` — 6 testes para pagamento total, parcial, acumulado, arredondamento, excedente e fatura já paga.
- `src/pages/CreditCards.tsx` — usa o total persistido ou calculado da fatura, valida novamente dentro da transação Firestore e impede submissão duplicada.
- `src/pages/Transactions.tsx` — status `parcial` passa a bloquear novo fechamento que sobrescreveria pagamentos existentes.
- `package.json`, `src/lib/utils.ts` — versão `0.7.2`.

**Correções e causa-raiz:**
- Sem documento persistido, o fluxo usava o valor do próprio pagamento como `totalAmount`; qualquer pagamento parcial era marcado como total.
- O fechamento de período ignorava o status `parcial` e podia substituir `paymentTransactionIds` e `paidAmount`.
- Cálculos diretos em ponto flutuante foram substituídos por cálculo em centavos.

**Validações:**
- `npm run lint` — sem erros.
- `npx vitest run --maxWorkers=1` — 60/60 testes passando.
- `npm run build` — build de produção concluído.
- `firebase deploy --only firestore:rules --project gen-lang-client-0172941229` — regras compiladas e publicadas.

---
## [0.7.1] — 2026-08-04 — Correção de Permissão no Pagamento de Fatura

**Resultado:** Correção do erro de permissão do Firestore (`permission-denied`) ao registrar o pagamento de fatura do cartão de crédito. A transação de transferência de pagamento de fatura agora omite o campo `categoryId` (em vez de passar a string `'Pagamento de Cartão'`) e inclui os campos de controle `tags: []` e `observation: ''`, deixando a estrutura idêntica à de transferências comuns criadas no app para compatibilidade total com as regras de validação estruturais de transações no banco remoto.

### Alterações técnicas:
- `src/pages/CreditCards.tsx` — `handlePayInvoice` omite `categoryId` e adiciona `tags`/`observation` para a transação de pagamento criada.
- `src/pages/Transactions.tsx` — Criação da transação de pagamento ao fechar período omite `categoryId` e adiciona `tags`/`observation`.

## [0.7.0] — 2026-08-04 — Pagamento Parcial, Migration Categorias e Melhorias

**Resultado:** Seis itens do backlog entregues. Faturas de cartão agora aceitam múltiplos pagamentos parciais com status `parcial`. Categorias com IDs legados (string legível) são auto-corrigidas em tempo real e migradas em batch. CI/CD via GitHub Actions. Alerta de limite de cartão configurável. Estorno total/parcial de despesas. Paradigma de orçamento fracionado vs integral.

### Pagamento Parcial de Fatura
- `src/types/index.ts` — `Invoice`: status `'parcial'`, campos `paymentTransactionIds: string[]` e `paidAmount: number`
- `src/pages/CreditCards.tsx` — `handlePayInvoice` acumula pagamentos, status `parcial` vs `paga`, validação de excedente, badge "Pagamento Parcial" (âmbar), botão "Pagar Remanescente"
- `src/pages/Transactions.tsx` — auto-sync recalcula `paidAmount` via loop em `paymentTransactionIds[]`
- `src/components/TransactionDialog.tsx` — 3 blocos de sync atualizados para somar/ajustar `paidAmount` conforme mudança de status
- `src/lib/cashCoverage.ts` — faturas `parcial` usam `totalAmount - paidAmount` como obrigação
- `src/lib/invoiceAnalysis.ts` — `parcial` tratado como `closed`
- `src/lib/pdfTemplates.ts` — status label "PARCIAL", cor âmbar
- `src/pages/Dashboard.tsx`, `src/pages/Reports.tsx` — filtros incluem `parcial`, saldo remanescente
- `src/lib/utils.ts` — funções `getInvoicePaymentIds()`, `isInvoiceClosed()`

### Correção de Categorias por String Legível (Migration)
- `src/lib/utils.ts` — `resolveCategoryId()` detecta ID não-UUID e faz match por nome exato/case-insensitive
- `src/components/CategorySelect.tsx` — usa `resolveCategoryId` no valor do Select
- `src/components/TransactionDialog.tsx` — `populateEdit` resolve `categoryId` ao abrir edição
- `src/services/categoryMigration.ts` — **novo** — scan em transactions/budgets, match por nome, `writeBatch` atômico
- `src/pages/Dashboard.tsx` — migration executa uma vez ao carregar

### CI/CD
- `.github/workflows/ci.yml` — **novo** — lint, test, build em push/PR no main

### Alerta de Limite de Cartão
- `src/pages/Settings.tsx` — slider 50-95% em Configurações > Preferências
- `src/pages/CreditCards.tsx` — badge "Limite Alerta" ou "⚠ Limite Crítico" no card
- `src/pages/Dashboard.tsx` — barra de progresso colorida (azul/âmbar/vermelho)

### Estorno Total/Parcial
- `src/pages/Transactions.tsx` — botão `Undo` nas ações, diálogo com Total/Parcial, cria receita vinculada via `parentId`
- `src/pages/CreditCards.tsx` — opção "Estornar" nos dropdowns de transação de cartão

### Paradigmas de Orçamento
- `src/lib/utils.ts` — `getBudgetImpact(tx, paradigm)`: Fracionado (cada parcela conta) / Integral (total na 1ª)
- `src/pages/Settings.tsx` — seletor em Configurações > Preferências
- `src/pages/Dashboard.tsx`, `src/pages/Budgets.tsx`, `src/pages/Reports.tsx` — usam `getBudgetImpact`

**Correções e causa-raiz:**
- Teste `invoiceAnalysis.test.ts` — 1 falha por data fixa (`'2026-08'` caiu no mês corrente em 04/08/2026), não relacionada às alterações

**Validações:**
- `npm run lint` — Sem erros
- `npm run test` — 53/54 passando (1 falha pré-existente)
- `npm run build` — Build OK

**Pendências para sessão futura:**
- Chave Groq em proxy — implementar Cloud Function / Vercel Edge
- Testes de integração — setup Firebase Emulator + cenários core
- Consistência de mutabilidade — transações de cartão editáveis
- Central de Importação Fase 3 — e-mail, app Android, Open Finance

---

## [0.6.1] — 2026-07-13 — Períodos Civis na Projeção Futura

**Resultado:** O seletor de período da Projeção Futura passa a usar meses civis (até o último dia do mês) em vez de meses rolantes a partir da data atual. Adicionado filtro "30 dias" para verificação de liquidez de curto prazo.

**Alterações técnicas:**
- `src/pages/Reports.tsx` — `projPeriod` ganhou opção `'30d'` e `'nextMonth'`; lógica do `projEndDate` refatorada: `'30d'` = today+30d, `'nextMonth'` = último dia do mês seguinte, `'3months'`/'`6months`'/'`12months`' = último dia do mês N posterior. Labels dos botões atualizados. PageHelp atualizado.
- `package.json`, `src/lib/utils.ts` — Versão `0.6.1`.

**Correções e causa-raiz:**
- O filtro "Próx. mês" usava `setMonth(+1)` (ex: 13/07 → 13/08), 30-31 dias rolantes, causando falsos positivos de "cobertura positiva" quando a janela era curta demais para enxergar eventos no fim do mês. Agora "Próx. mês" = até 31/08, "3 meses" = até 31/10, etc.

**Validações:**
- `npm run lint` — Sem erros
- `npm run test` — 54/54 passando

---

## [0.6.0] — 2026-07-13 — Central de Importação Assistida

**Resultado:** Nova tela `/importar` com entrada assistida de transações por texto livre, importação em lote de arquivos bancários (OFX/CSV/XLS/XLSX/PDF) e rota de compartilhamento PWA (`share_target`). Alertas SMS e notificações bancárias são interpretados automaticamente e geram candidatos revisáveis antes da confirmação.

**Alterações técnicas:**
- `src/pages/ImportCenter.tsx` — Tela principal com abas Texto e Arquivos, lista de candidatos pendentes com ações em lote (confirmar, ignorar, marcar duplicado), pré-visualização de importação de arquivos com mapeamento de colunas.
- `src/services/importAlertParser.ts` — Parser local de alertas bancários (SMS, notificações push) com extração de valor, tipo, estabelecimento e método de pagamento.
- `src/services/importAlertParser.test.ts` — 10 testes unitários cobrindo padrões de alerta.
- `src/services/importCandidateService.ts` — Serviço de confirmação de candidatos usando `runTransaction` atômico; atualiza saldo de conta apenas quando aplicável e cria lançamento em fatura para cartão sem afetar saldo.
- `src/services/importDuplicateService.ts` — Detecção de duplicidade por similaridade de valor, data e descrição.
- `src/services/importSuggestionService.ts` — Sugestão de categoria e conta baseada em histórico.
- `src/services/importFileCandidateService.ts` — Parser unificado de arquivos bancários reaproveitando OFX existente e extração local de texto para PDF.
- `src/services/importFileCandidateService.test.ts` — 4 testes unitários.
- `src/App.tsx` — Rotas `/importar`, `/importar/compartilhar` e `/importar/:id`.
- `src/components/Layout.tsx` — Item "Importar" no menu principal.
- `src/types/index.ts` — Tipos `ImportCandidate`, `ParsedImportResult`, `ConfirmImportCandidateInput` e relacionados.
- `firestore.rules` — Coleção `importCandidates` e permissão para `credit_card_invoice` em `reconciliationHistory`.
- `vite.config.ts` — Configurado `share_target` PWA para `/importar/compartilhar`.
- `package.json`, `src/lib/utils.ts` — Versão `0.6.0`.

**Correções e causa-raiz:**
- Três testes em `financialInsight.test.ts` corrigidos: usavam datas fixas (`2026-06-*`) que ficaram no passado, causando clamp de datas no cash coverage, mismatch no filtro mensal de orçamentos e ausência de dados no último mês do cashflow. Solução: datas dinâmicas relativas a `new Date()`.

**Validações:**
- `npm run lint` — Sem erros
- `npm run test` — 54/54 passando
- `npm run build` — Build OK

**Importação de faturas de cartão** permanece direcionada ao fluxo especializado em Cartões > Conferir Fatura.

**Fase 3** (e-mail, app companion Android, Open Finance, perfis avançados) permanece no backlog para implementação futura.

---

## [0.5.1] — 2026-07-07 — Ajustes Responsivos em Modais Financeiros

**Resultado:** Modais de fatura, conferência/importação de fatura e lançamento ficaram mais bem acomodados em desktop estreito e mobile. A barra de ações da fatura deixou de comprimir os controles, e os fluxos densos passam a empilhar ações/campos em telas menores.

**Alterações técnicas:**
- `src/pages/CreditCards.tsx` — Modal de fatura ampliado no desktop (`sm:max-w-[920px]`), header quebrável, ações com largura total no mobile e navegação de mês com largura previsível.
- `src/components/InvoiceReconciliationDialog.tsx` — Header/footer responsivos, KPIs em uma coluna no mobile, cards de linha com valor abaixo da descrição em telas estreitas e ações em grid mobile.
- `src/components/PdfImportReviewDialog.tsx` — Importador PDF legado convertido para comportamento de cards no mobile, removendo a dependência visual de colunas fixas em telas pequenas.
- `src/components/TransactionDialog.tsx` — Rodapé e grids internos ajustados para empilhar no mobile, evitando compressão de botões e campos.
- `package.json`, `package-lock.json`, `src/lib/utils.ts` — Versão `0.5.1`.

**Validações:**
- `npm run lint` — Sem erros
- `npm run test` — 37/40 passando (3 falhas pré-existentes em `financialInsight.test.ts`)
- `npm run build` — Build OK

**Limitações:**
- Verificação visual autenticada não foi possível nesta sessão; o app abriu apenas na tela de login no navegador interno.
## [0.5.0] — 2026-07-07 — Conferência Inteligente de Fatura de Cartão

**Resultado:** Tela de Cartões ganhou o fluxo **Conferir Fatura**, que importa faturas PDF/CSV/XLS/XLSX, transforma o arquivo em linhas auditáveis, compara com lançamentos já existentes no Fiducia, usa Groq para sugerir matches semânticos, separa divergências por grupos e permite confirmar, criar, corrigir ou ignorar lançamentos antes de gravar.

**Alterações técnicas:**
- `src/components/InvoiceReconciliationDialog.tsx` — Novo diálogo de conferência com upload, estados de extração/matching/revisão/aplicação, KPIs de totais, grupos OK/Revisar/Faltantes/Diferentes/Créditos/Sobrando e ações por linha/em lote.
- `src/lib/invoiceReconciliation.ts` — Novo motor determinístico com normalização de descrições, scoring de candidatos, merge com sugestões da IA, cálculo de totais e detecção de lançamentos sobrando.
- `src/lib/invoiceReconciliation.test.ts` — 6 testes cobrindo normalização, match exato, divergência de valor, faltantes, sobras e créditos abatendo total.
- `src/services/invoiceImportService.ts` — Novo importador unificado para PDF/CSV/XLS/XLSX; PDF usa extração de texto + Groq, CSV/XLS usam parser estruturado.
- `src/services/invoiceAiService.ts` — Prompts dedicados para extração estruturada e match semântico da fatura via Groq.
- `src/services/invoiceReconciliationApplyService.ts` — Aplicação das decisões: confirmar matches, criar faltantes, corrigir divergentes, expandir parcelas futuras sob confirmação e registrar histórico em `reconciliationHistory`.
- `src/pages/CreditCards.tsx` — Botão **Conferir Fatura** no modal da fatura, mantendo o importador PDF legado como caminho rápido.
- `src/types/index.ts` — Tipos de importação/conciliação de fatura e histórico `credit_card_invoice`.
- `package.json`, `package-lock.json`, `src/lib/utils.ts` — Versão `0.5.0`.

**Correções e causa-raiz:**
- O fluxo antigo de importação PDF criava lançamentos diretamente, sem comparar antes com o que já existia. A nova conferência cria uma etapa intermediária auditável, reduzindo risco de duplicidade e permitindo corrigir diferenças de valor/data/categoria/descrição.

**Validações:**
- `npm run lint` — Sem erros
- `npm run test` — 37/40 passando (3 falhas pré-existentes em `financialInsight.test.ts`)
- `npm run build` — Build OK

**Limitações ou escopo não entregue:**
- Sem OCR para PDF escaneado.
- Sem aprendizado persistente por estabelecimento.
- Sem pagamento parcial de fatura ou estorno avançado total/parcial.
- A IA sugere; ações financeiras continuam exigindo confirmação do usuário.
## [0.4.1] — 2026-07-07 — Ordenação Alternável + Busca Aprimorada em Lançamentos

**Resultado:** Tela de lançamentos agora permite alternar a ordem cronológica (mais recentes primeiro ou mais antigos primeiro). Barra de busca aceita valores monetários no formato brasileiro (vírgula decimal, ponto de milhar).

**Alterações técnicas:**
- `src/pages/Transactions.tsx` — **+25 linhas.** Estado `sortOrder` (`'desc'` | `'asc'`) com toggle via botão `ArrowUpDown` na barra de filtros; 3 pontos de sort (AI search, processedTransactions, groupKeys) respeitam a direção; função `amountMatchesSearch()` com 4 representações textuais (toString, toFixed(2), Intl.NumberFormat pt-BR com e sem agrupamento) + parse reverso do termo para comparação numérica com tolerância; coluna de ordenação (`sortOrder`) adicionada às dependências do `processedTransactions` memo

**Correções e causa-raiz:**
- **Busca por "15,00" ou "3.416" falhava**: `amount.toString()` nunca produz vírgula nem separador de milhar. Solução: gerar múltiplas representações textuais do valor e também tentar interpretar o termo como número (removendo pontos de milhar, convertendo vírgula para ponto decimal).

**Validações:**
- `npm run lint` — Sem erros
- `npm run test` — 31/34 passando (3 falhas pré-existentes em `financialInsight.test.ts`)
- `npm run build` — Build OK

## [0.4.0] — 2026-07-06 — Evolução da Previsão de Caixa + Correções Documentais

**Resultado:** Motor de projeção de caixa estendido com regras de recorrência (`recurrenceRules`), três cenários de projeção (conservador/realista/projetado), métrica de dias em risco (`daysAtRisk`), visão diária expandível e seção de dias críticos. Documentação corrigida (Gemini→Groq, status de docs desatualizados).

**Alterações técnicas:**
- `src/lib/cashCoverage.ts` — **+80 linhas.** Adicionado parâmetro `recurrenceRules?: any[]` ao `buildCashCoverageProjection()`; geração de eventos futuros a partir de regras ativas (`status: 'active'`) com controle de não-duplicação (match por `parentId`); tipo `CashCoverageScenario` (`'conservative' | 'realistic' | 'projected'`); opção `scenario` em `CashCoverageOptions` (default `'realistic'`); filtro de eventos por `certainty` antes da simulação diária; métrica `daysAtRisk: number` no retorno
- `src/lib/cashCoverage.test.ts` — 5/5 testes passando (compatível com novas opções)
- `src/lib/utils.ts` — `projectDailyBalance()` atualizado: aceita `recurrenceRules`, usa `scenario: 'conservative'` para Dashboard (segurança)
- `src/lib/financialInsight.ts` — `FinancialInsightParams` aceita `recurrenceRules`; repassado ao `buildCashCoverageProjection()`
- `src/pages/Reports.tsx` — **+120 linhas.** Snapshot `recurrenceRules` via Firestore `onSnapshot`; estado `projScenario` com seletor de cenário (Conservador/Realista/Projetado); seletor renderizado na aba Projeção Futura; métrica `daysAtRisk` no KPI de risco; toggle "Visão Diária" com tabela colorida (vermelho/âmbar/verde por faixa de saldo); seção "Dias Críticos" com top 5 piores dias; PDF botão movido para linha de cenários
- `src/pages/Dashboard.tsx` — Snapshot `recurrenceRules`; `projectDailyBalance()` agora recebe `recurrenceRules` e usa cenário conservador; alerta "X dias com saldo negativo nos próximos 90 dias" no KPI de Cobertura
- `docs/LOGICA_DO_SISTEMA.md` — 4 correções: "Gemini API" → "Groq API" (linhas 7, 50, 75, 76)
- `docs/ia-conciliacao-inteligente.md` — Adicionado header `STATUS: IMPLEMENTADO em v0.3.x`
- `docs/plano-de-melhorias.md` — Adicionado header `STATUS: Parcialmente resolvido` com data de revisão
- `docs/plano-evolucao-previsao-caixa.md` — **Criado.** Especificação técnica completa da evolução
- `package.json`, `src/lib/utils.ts` — Versão `0.4.0`

**Regra de cenários:**

| Cenário | Filtro `certainty` | Uso |
|---------|-------------------|-----|
| Conservador | Só `confirmed` | Dashboard (segurança) |
| Realista | `confirmed` + `expected` | Reports (default) |
| Projetado | Todos | Reports (visão completa com recorrências) |

**Arquivos modificados:** 12 arquivos.

## [0.3.4] — 2026-07-06 — Reformulação Completa do Dark Mode

**Resultado:** Sistema agora possui dark mode unificado com paleta navy profundo (inspirada no degrade emerald/cyan/blue da logo). Bordas visíveis, contraste WCAG AA garantido em todos os textos, todas as telas corrigidas.

**Alterações técnicas:**
- `src/index.css` — Bloco `.dark` inteiramente refatorado: paleta navy profundo (`#0a101c` / `#131c2e` / `#1c2944`), `--border-color` ≠ `--surface2` (bordas agora visíveis), textos com contraste mínimo 4.5:1 sobre superfícies, ring/sidebar-primary usam `--fiducia-blue`
- `src/pages/CreditCards.tsx` — 18 correções: `bg-white` → `bg-card`/`bg-background` em formulários, cards de fatura, tabelas, toggles e ícones; `text-white` → `dark:text-background` em botões; `hover:bg-white` → `hover:bg-card dark:hover:bg-surface2`
- `src/pages/Reconciliation.tsx` — 3 correções: `hover:text-red-500`/`hover:text-blue-500` ganharam `dark:hover:text-red-400`/`dark:hover:text-blue-400`; ícone do gradiente AI ganhou `dark:text-[#0a101c]`
- `src/pages/Reports.tsx` — 5 correções: badges `text-white` → `dark:text-background` (3×); ícone AI `dark:text-[#0a101c]`; botão "Gerar Análise" `dark:text-background`
- `src/pages/Audit.tsx` — 2 correções: inputs `bg-white` → `bg-background dark:bg-input/30 text-foreground`
- `src/pages/Categories.tsx` — Seletor de ícone ativo: `dark:bg-fiducia-blue/20 dark:text-fiducia-blue`
- `src/pages/Accounts.tsx` — 2 botões `text-white` → `dark:text-background`
- `src/pages/Dashboard.tsx` — 2 ícones no gradiente AI: `dark:text-[#0a101c]`
- `src/pages/Login.tsx` — Gradiente de fundo `dark:from-gray-950` → `dark:from-[#0a101c] dark:via-[#0c1524] dark:to-[#0e1a2e]`
- `src/components/TransactionDialog.tsx` — **Atenção especial aos modais:** status toggles (pago/pendente) com `dark:bg-*-500/20 dark:text-*-400`; botões de submit com `text-white dark:text-background` e versões mais claras em dark (`dark:bg-red-500`/`dark:bg-green-500`/`dark:bg-blue-500`); borda `border-gray-50` → `border-border`
- `src/components/ConfirmDialog.tsx` — Botão destrutivo `dark:bg-red-600 dark:hover:bg-red-500`; botão não-destrutivo `dark:text-primary-foreground` (corrige texto branco sobre fundo claro)
- `src/components/PdfImportReviewDialog.tsx` — Ícone gradiente `dark:from-violet-400 dark:to-indigo-500 dark:text-violet-950`; botão importar `dark:text-background`
- `src/components/Layout.tsx` — 2 badges com `dark:bg-background/30 dark:text-foreground` em links ativos
- `src/components/ui/sonner.tsx` — `theme="light"` → `theme="system"` (notificações agora respeitam o tema)
- `package.json`, `src/lib/utils.ts` — Versão `0.3.4`

**Nova paleta dark mode:**

| Variável | Antes | Depois |
|----------|-------|--------|
| `--bg` | `#0f172a` (slate-900) | `#0a101c` (navy profundo) |
| `--surface` | `#1e293b` (slate-800) | `#131c2e` |
| `--surface2` | `#334155` (slate-700) | `#1c2944` |
| `--border-color` | `#334155` (= surface2) | `#2d3d5c` (visível) |
| `--text-primary` | `#f8fafc` | `#ecf0f5` |
| `--text-secondary` | `#cbd5e1` | `#9badc1` |
| `--text-muted` | `#cbd5e1` | `#6e829b` |
| `--ring` | `--text-primary` | `--fiducia-blue` |
| `--sidebar-primary` | `--text-primary` | `--fiducia-blue` |

**Arquivos modificados:** 14 arquivos, ~65 pontos de correção.

## [0.3.3] — 2026-07-06 — Exportação de PDF Estruturada + Correções no Modal de Cartão

**Resultado:** Sistema agora gera PDFs estruturados para relatórios (5 abas), extratos de conta e faturas de cartão de crédito, substituindo o `window.print()` anterior. Modal de cartão de crédito corrigido: campos Observação e Tags agora acessíveis, seletor de Diferença de Centavos adicionado ao parcelamento de cartão, e diálogo "Nova Categoria" permite selecionar categoria pai.

**Alterações técnicas:**
- `package.json` — Adicionados `jspdf` e `jspdf-autotable` (lazy-loaded via `import()`)
- `src/lib/pdfFormatUtils.ts` — **Novo.** Formatadores pt-BR (`fmtMoneyPDF`, `fmtDatePDF`, `fmtMonthYear`), gerador de nome de arquivo padronizado, constantes de margem
- `src/services/pdfExportService.ts` — **Novo.** Serviço base: `createPdf()` (jsPDF A4), `addTable()` (autotable com quebra de página), `savePdf()`, lazy-loading das bibliotecas
- `src/lib/pdfTemplates.ts` — **Novo.** 7 templates: fluxo de caixa, categorias, tendência/orçamento, projeção futura, análise de faturas, extrato de conta, fatura de cartão
- `src/pages/Reports.tsx` — 5 botões "Exportar PDF" (um por aba de dados); import `FileDown` + handlers lazy
- `src/pages/Transactions.tsx` — Botão "Exportar PDF" (extrato) respeitando filtros ativos (conta, período, categoria)
- `src/pages/CreditCards.tsx` — `window.print()` substituído por `generateCreditCardInvoicePDF()` com cabeçalho, grupos visuais e status da fatura
- `src/components/TransactionDialog.tsx` — 3 correções: barra de ícones não esconde Observação/Tags para cartão (`!isCreditCard` removido); `remainderPosition` no parcelamento de cartão; diálogo "Nova Categoria" com seletor de Categoria Pai + Tipo
- `package.json`, `src/lib/utils.ts` — Versão `0.3.3`

**Documentos contemplados na exportação PDF:**
| Documento | Cabeçalho | KPIs | Tabela | Totais | Paginação | Rodapé | Grupos Visuais |
|-----------|-----------|------|--------|--------|-----------|--------|----------------|
| Relatório Fluxo de Caixa | Sim | Sim | Sim | Sim | Sim | Sim | — |
| Relatório Categorias | Sim | Sim | Sim | — | Sim | Sim | — |
| Relatório Tendência/Orçamento | Sim | Sim | Sim | — | Sim | Sim | — |
| Relatório Projeção Futura | Sim | Sim | Sim | — | Sim | Sim | — |
| Relatório Faturas de Cartão | Sim | Sim | Sim | — | Sim | Sim | — |
| Extrato de Conta | Sim | Sim | Sim | Sim | Sim | Sim | — |
| Fatura de Cartão | Sim | Sim | Sim | Sim | Sim | Sim | Sim |

**Correções e causa-raiz:**
- **Sem Observação/Tags no cartão**: Barra de ícones condicionada a `!isCreditCard` ocultava todos os toggles. Solução: mover condição para cada botão individualmente; Recorrência permanece oculta no cartão (já expandida por padrão), Observação e Tags visíveis em ambos.
- **Sem `remainderPosition` no parcelado de cartão**: O bloco de "Diferença de Centavos" só existia no modal bancário. Solução: replicar o seletor no bloco `isCreditCard` do parcelamento.
- **Sem Categoria Pai na criação rápida**: Diálogo "Nova Categoria" do modal de lançamento tinha apenas campo Nome. Solução: adicionar `<Select>` de parentId com filtro por tipo + seletor de tipo (Despesa/Receita) no modal bancário.

**Validações:**
- `npm run lint` — Sem erros
- `npm run test` — 31/34 passando (3 falhas pré-existentes em `financialInsight.test.ts`)
- `npm run build` — Build OK (jsPDF + autotable code-split: ~420KB lazy-loaded, não afeta bundle inicial)

**Alterações técnicas:**
- `src/lib/utils.ts` — Novas funções `findSeriesTransactions()`, `getSeriesKey()`, `isTransactionSeriesMember()` — matching de série centralizado com fallback para `isRecurring` sem `parentId` e `ccRecurrenceType === 'fixo'`
- `src/pages/Transactions.tsx` — `handleDelete` refatorado para usar `findSeriesTransactions`; `handleQuickConfirm` com guarda para parcelas >1 bloqueando débito duplicado; condição do diálogo de exclusão cobre `ccRecurrenceType`
- `src/pages/CreditCards.tsx` — `handleDeleteTx` convertido de `writeBatch` para `runTransaction` (atômico); exclusão de `RecurrenceRule` ao deletar série "fixo" completa (scope='all'); badge roxo "Fixo" exibido para `ccRecurrenceType === 'fixo'` em ambas as visualizações (organizada/cronológica)
- `src/components/TransactionDialog.tsx` — 6 correções: `changedInstallmentCount` implementado (alterar nº de parcelas na edição); `populateEdit` distingue `isRecurring` de parcelado via `ccRecurrenceType`; `editScope` respeitado em campos base; `editScope='future'` usa `formData.date` como corte; `siblingUpdate` não propaga `amount` em parcelado + guarda para parcelas >1 no balanço; CREATE de recorrentes agora respeita `formData.installments` do campo "Repetições"
- `package.json`, `src/lib/utils.ts` — Versão `0.3.2`

**Correções e causa-raiz:**
- **DELETE de série só deletava 1 transação**: Condição do diálogo usava disjunção OR (`parentId || isRecurring || installmentId`), mas o matching de série dependia exclusivamente de `parentId`. Se `isRecurring=true` sem `parentId` (dados legados), o diálogo mostrava as opções mas o filtro não encontrava irmãos. Solução: `findSeriesTransactions` com fallback por `description` + `frequency`.
- **QuickConfirm dupla dedução**: Confirmar parcela 2+ debitava saldo novamente, mas CREATE só debitou parcela 1. Solução: guarda `if (parentId && installmentNumber > 1) return`.
- **CreditCards usava writeBatch não-atômico**: Alterações de saldo usavam `accounts.find()` em memória em vez de leitura fresca do Firestore. Solução: conversão para `runTransaction` com leitura atômica do saldo.

**Validações:**
- `npm run lint` — Sem erros
- `npm run test` — 31/34 passando (3 falhas pré-existentes em `financialInsight.test.ts`, não relacionadas às alterações)
- `npm run build` — Build OK

---

## [0.3.1] — 2026-06-23 — Análise Inteligente com Groq

**Resultado:** A aba "Análise IA" deixa de gerar dicas genéricas e passa a interpretar dados calculados pelos motores internos do Fiducia: cobertura de caixa, faturas, categorias, orçamentos e datas críticas.

**Alterações técnicas:**
- `src/lib/financialInsight.ts` — `buildFinancialInsightContext()` reúne dados de cashCoverage, invoiceAnalysis, categorias, fluxo de caixa, orçamentos e datas críticas em um contexto estruturado; `buildGroqFinancialAnalysisPrompt()` gera prompt rigoroso com regras (não inventar, não recalcular, ser específico) e formato fixo de 5 seções
- `src/lib/financialInsight.test.ts` — 11 testes unitários: contexto nulo sem dados, cobertura com risco, faturas, categorias, orçamentos, tendência, data crítica, prompt estruturado, prompt com risco e prompt sem orçamentos
- `src/pages/Reports.tsx` — Aba IA refatorada: usa `buildFinancialInsightContext` + `buildGroqFinancialAnalysisPrompt`, exibe contexto usado na análise (cards com métricas enviadas), disclaimer "IA interpreta, sistema calcula", temperatura reduzida (0.5) para respostas mais consistentes
- `package.json`, `src/lib/utils.ts` — Versão `0.3.1`

**Decisão arquitetural:** A Groq interpreta dados calculados pelo Fiducia. Ela não é fonte de verdade dos cálculos financeiros.

**Validações:**
- `npm run lint` — Sem erros
- `npm run test` — 34/34 passando (11 novos)
- `npm run build` — Build OK

---

## [0.3.0] — 2026-06-23 — Relatório de Análise de Faturas de Cartão

**Resultado:** Nova aba "Faturas" em Relatórios permite analisar o comportamento das faturas de cartão de crédito ao longo do tempo: evolução mensal, peso por cartão, status (aberta/fechada/paga/futura) e comprometimento futuro com parcelamentos.

**Alterações técnicas:**
- `src/lib/invoiceAnalysis.ts` — Motor de análise de faturas: agrega transações por cartão/período, determina status (persistido ou calculado), calcula totais, médias, variações e participação percentual
- `src/lib/invoiceAnalysis.test.ts` — 13 testes unitários cobrindo status, filtros, créditos, futuras, variação mês a mês e consistência de cores
- `src/pages/Reports.tsx` — Nova aba "Faturas" (6ª aba) com:
  - Filtros: período (3M/6M/12M/personalizado), cartão, status (abertas/fechadas/pagas/futuras), toggle estornos
  - 6 KPIs: abertas, fechadas, pagas, comprometimento futuro, média mensal, maior fatura
  - Gráfico de barras empilhadas (mês × cartão) + tendência (área) + donut (participação por cartão)
  - Tabela detalhada clicável com linha do tempo por cartão/período/status/vencimento/variação
- `package.json` — Versão atualizada para `0.3.0`

**Validações:**
- `npm run lint` — Sem erros
- `npm run test` — 23 testes passando (13 novos + 10 existentes)
- `npm run build` — Build de produção OK

---

## [0.2.0] — 2026-06-23 — Motor de Cobertura de Caixa

**Resultado:** A projeção futura passa a responder se caixa atual + valores a receber cobrem as obrigações bancárias e de cartão ao longo do tempo, com detecção de risco diário.

**Alterações técnicas:**
- `src/lib/cashCoverage.ts` — Novo motor único de previsão: eventos futuros, simulação diária, agregação mensal, faturas abertas/fechadas/futuras e menor saldo projetado
- `src/lib/cashCoverage.test.ts` — Testes unitários para descasamento de datas, fatura fechada, fatura aberta sem invoice persistida, contas excluídas do fluxo e atrasados
- `src/lib/utils.ts` — `projectDailyBalance()` passa a usar o novo motor mantendo compatibilidade com o Dashboard
- `src/pages/Reports.tsx` — Aba Projeção Futura passa a consumir o motor de cobertura e exibe diagnóstico de cobertura, risco e composição das obrigações
- `package.json`, `package-lock.json` e `APP_VERSION` — Versão atualizada para `0.2.0`

**Validações:**
- `npx vitest run src/lib/cashCoverage.test.ts src/utils/creditCardUtils.test.ts`
- `npm run lint`
- `npm run test`
- `npm run build`

**Limitações:** Recorrências futuras ainda dependem de transações já materializadas; a IA interpreta dados, mas não calcula a cobertura.

---

## [0.1.0] — 2026-06-22

> Primeira versão formal do projeto. Versionamento inicia a partir da adoção do protocolo de documentação em 4 camadas.

### Versão 0.1.0 — 2026-06-22

**Resultado:** Versionamento SemVer formalizado. Versão exibida na tela de Login e no rodapé do Dashboard.

**Alterações técnicas:**
- `package.json` — Versão alterada de `0.0.0` para `0.1.0`
- `src/lib/utils.ts` — Adicionada constante exportada `APP_VERSION`
- `src/pages/Login.tsx` — Exibe "v0.1.0" abaixo dos links de termos
- `src/components/Layout.tsx` — Exibe "Fiducia v0.1.0" no rodapé da sidebar (visível no Dashboard e demais páginas)
- `AGENTS.md` — Adicionado protocolo de documentação (4 camadas), início/encerramento de sessão, versionamento
- `docs/MASTER_PLAN.md` — Criado (fonte única de verdade estratégica)
- `CHANGELOG.md` — Criado (histórico permanente de releases)
- `docs/pendencias_dev.md` — Criado (pauta da sessão atual)
- `docs/archive/sessions/` — Criado (arquivo de sessões concluídas)

---

## Histórico anterior ao versionamento

> Registros reconstruídos a partir do histórico Git, `dev-log.md` e inspeção de código.

### 2026-06-22 — Classificação de Transações de Fatura e Campos de Data Dupla

**Resultado:** Faturas de cartão agora exibem 5 grupos visuais com subtotais e ordenação específica por grupo. Parcelas de ciclos anteriores são distinguidas das compras do ciclo atual.

**Alterações técnicas:**
- `src/types/index.ts` — Adicionados `originalPurchaseDate`, `postingDate`, `isSystemGeneratedDate` ao tipo Transaction
- `src/pages/CreditCards.tsx` — Função `classifyInvoiceTransaction` com 5 grupos: PARCELAMENTOS_ANTERIORES, COMPRAS_DO_PERIODO, CREDITOS_ESTORNOS, PAGAMENTOS_AJUSTES, OUTROS_DEBITOS
- 2 modos de visualização: Organizado (grupos, padrão) e Cronológico (tabela plana)
- `src/components/TransactionDialog.tsx` — Criação/conversão de parcelamentos define `originalPurchaseDate` e `postingDate`
- PDF Import atualizado para preencher novos campos

**Limitações:** Datas geradas pelo sistema são estimadas e exibidas com indicação `(data estimada)`.

---

### 2026-06-19 — Correção: accountId não era atualizado na edição

**Resultado:** Ao editar um lançamento e trocar a conta, a conta agora é efetivamente alterada no Firestore.

**Causa-raiz:** `updateData` no `handleEditSubmit` de `TransactionDialog.tsx:745` listava todos os campos editáveis exceto `accountId` e `destinationAccountId`. O saldo era revertido/aplicado corretamente, mas o campo não era escrito no documento da transação.

**Correção:** Adicionado `accountId: formData.accountId` e `destinationAccountId: formData.destinationAccountId` ao `updateData`.

---

### 2026-06-18 — Auditoria Sistêmica de Saldo (5 bugs)

**Resultado:** Corrigidos 5 bugs ativos com impacto direto nos valores exibidos nas contas bancárias. Cálculo de saldo agora tem fonte única de verdade.

**Alterações:**
1. `src/lib/utils.ts` — Nova função `getTransactionEffect(tx, accountId)`: bilíngue (pt/en), direction-aware para transferências
2. `src/components/TransactionDialog.tsx` — `getBalanceChange` aceita `'income'` além de `'receita'`
3. `src/pages/Transactions.tsx` — DELETE de séries: guard `if (paidTx.creditCardId) continue`
4. `src/pages/Accounts.tsx` — `handleReset` reescrito com `getDoc()` + `initialBalance: 0`
5. `src/pages/Accounts.tsx` — `diagnoseBalance` detecta `initialBalance` ausente

---

### 2026-06-15 — Reconciliação Contábil e Remoção de Auto-Healing

**Resultado:** Ajustes de saldo agora seguem partidas dobradas (geram transação "Ajuste de Reconciliação"). Scripts automáticos/silenciosos de correção de saldo removidos.

**Alterações:**
- Botão Ajustar Saldo (Wallet) refatorado: calcula delta entre desejado e real, gera transação compensatória
- Script de auto-healing removido de `Transactions.tsx`
- Modal de Diagnóstico: botão "Sincronizar Saldo" para ressincronizar cache sem transações
- `initialBalance` obrigatório em contas (com aviso âmbar se ausente)

---

### 2026-06-04 — Reports: Seletor de Período, Projeção de Caixa e Conversão Avulso→Recorrente

**Resultado:** Relatórios com controle total de período e projeção financeira futura. Lançamentos avulsos podem ser convertidos em recorrentes na edição.

**Alterações:**
- `src/pages/Reports.tsx` — Seletor de período (Hoje/Semana/Mês/3M/6M/12M/Ano/Período custom), projeção de caixa, toggle "Considerar não pagas"
- `src/components/TransactionDialog.tsx` — Bloco `becameRecurring` no `handleEditSubmit` para conversão avulso→recorrente
- Dashboard — Revertido para layout original com duas listas de Contas a Pagar
- Cartões — Seção "Comprometimento Futuro" no modal de fatura

---

### 2026-06-02 — CalcPopover, remainderPosition, Deduplicação de Utilitários

**Resultado:** Calculadora inline nos campos monetários, controle de distribuição de centavos em parcelamento, e eliminação de código duplicado.

**Alterações:**
- `src/components/CalcPopover.tsx` — Calculadora com parser aritmético recursivo (sem `eval`)
- `src/components/TransactionDialog.tsx` — Campo `remainderPosition` (`first`/`last`/`spread`)
- `src/lib/utils.ts` — Centralizadas `isEffectivelyPaid`, `isPeriodClosed`, `formatCurrency` (antes em 3-4 arquivos)
- 24 catch blocks com ordem `toast.error`/`handleFirestoreError` corrigida
- Corrigido XSS em `Reports.tsx:298` (dangerouslySetInnerHTML com escape HTML)
- Corrigido Contrast Dark Mode em `Reconciliation.tsx`
- Corrigido onSnapshot duplicado em `Transactions.tsx`

---

### 2026-05-30 — Importador de Fatura PDF com IA

**Resultado:** Faturas de cartão em PDF podem ser importadas. IA (Groq) extrai transações, categoriza automaticamente e detecta parcelamentos.

**Arquivos:** `src/services/pdfInvoiceService.ts`, `src/components/PdfImportReviewDialog.tsx`, `src/pages/CreditCards.tsx`

**Limitação:** PDFs escaneados (imagem) não têm texto extraível.

---

### 2026-05-29 — TransactionDialog — Modal Unificado

**Resultado:** Sistema passa de 2 modais de transação para 1 modal unificado, com edição de parcelas, invoice period editável e propagação de dados em séries.

**Alterações:**
- `src/components/TransactionDialog.tsx` + `src/contexts/TransactionDialogContext.tsx`
- Removidas ~1700 linhas de dialogs inline de Transactions.tsx e CreditCards.tsx
- Correção: categorias em português (typeFilter despesa/receita) no CategorySelect
- Correção: datas em timezone local (parseLocalDate)

---

### 2026-05-28 — Quick Confirm, CategorySelect, Navegação com Filtro

**Resultado:** Confirmação de pendências com um clique. Seletor de categorias unificado com busca e hierarquia. Navegação Dashboard→Transactions com filtros pré-aplicados.

---

### 2026-05-26 — Atomicidade de Saldo (runTransaction)

**Resultado:** Todas as operações de saldo (CREATE, EDIT, DELETE, IMPORT) agora usam `runTransaction` atômico do Firestore, eliminando race conditions e operações órfãs.

**Correções incluídas:**
- DELETE de séries revertia saldo N× (corrigido: agrupamento por parentId)
- Toast.error antes de handleFirestoreError (evita throw prematuro)
- Edição de conta não sobrescreve saldo
- CREATE parcelado aplica saldo apenas da 1ª parcela
- Filtro isEffectivelyPaid nos cálculos do Dashboard

---

## Template para Novas Entradas

```markdown
## [X.Y.Z] — YYYY-MM-DD — Título Objetivo

**Resultado:** O que o usuário percebe de diferente.

**Alterações técnicas:**
- Lista de arquivos e mudanças relevantes

**Correções e causa-raiz:** Se aplicável.

**Migrations ou impactos operacionais:** Se aplicável.

**Limitações ou escopo não entregue:** Se aplicável.
```
