# Plano de Contingência — Migração do Firebase para Supabase

> **Status:** Proposta para decisão futura — migração não autorizada
> **Data:** 2026-08-05
> **LLM:** deepseek-v4-pro | **Agente:** opencode

## 1. Objetivo

Disponibilizar um caminho executável e reversível para migrar o Fiducia de Firebase (Firestore + Auth) para Supabase (PostgreSQL + Auth + Realtime), caso as limitações de consulta e manutenção do banco atual deixem de ser aceitáveis.

Este documento não autoriza alterações no sistema, criação de infraestrutura, migração de dados ou desativação do Firebase.

## 2. Premissas

- O Fiducia é um sistema pessoal, utilizado por um único usuário.
- Nenhum lançamento, relacionamento ou histórico financeiro pode ser perdido.
- O frontend React, os componentes e as regras financeiras já testadas devem ser preservados.
- A camada de persistência será reescrita para PostgreSQL; não será feita substituição mecânica de chamadas Firebase por chamadas Supabase dentro das telas.
- O Firebase continuará intacto até a validação integral do Supabase e permanecerá disponível para rollback.
- A migração não deverá alterar resultados de saldos, faturas, Dashboard, relatórios, conciliação, parcelas ou recorrências.
- Valores monetários serão armazenados em centavos (`bigint`) ou `numeric` com escala fixa, nunca em ponto flutuante.

## 3. Diagnóstico do acoplamento atual

O levantamento inicial encontrou:

- 23 arquivos com dependência de Firebase;
- 58 assinaturas em tempo real com `onSnapshot`;
- 20 operações com `runTransaction`;
- 18 operações em lote;
- autenticação Google e perfil associado ao UID do Firebase;
- regras de segurança por `userId` no Firestore;
- validação de Firebase ID Token no proxy da Groq;
- cache persistente do Firestore em múltiplas abas.

Os maiores riscos não estão na cópia dos documentos, mas na equivalência das operações atômicas, dos vínculos legados e dos cálculos financeiros.

## 4. Estratégia recomendada

Adotar uma migração por substituição da camada de dados:

```text
Interface React e regras financeiras existentes
                    ↓
       Serviços e repositórios tipados
                    ↓
     RPCs transacionais + consultas/views
                    ↓
       PostgreSQL + RLS + Supabase Auth
```

As telas não deverão conhecer detalhes de Firebase ou Supabase. Uma interface de repositório permitirá executar testes de equivalência e, durante a homologação, alternar o provedor por configuração.

## 5. Escopo dos dados

Todas as coleções relevantes devem ser exportadas, mesmo que alguma não seja usada no dia do corte:

| Firestore | Destino proposto | Observação |
|---|---|---|
| `users` | `profiles` | Perfil ligado a `auth.users` |
| `accounts` | `accounts` | Saldo inicial e saldo materializado |
| `creditCards` | `credit_cards` | Limite, fechamento e vencimento |
| `transactions` | `transactions` | Histórico financeiro integral |
| `invoices` | `invoices` | Estado e período das faturas |
| vínculo em `paymentTransactionId(s)` | `invoice_payments` | Relação normalizada entre fatura e pagamento |
| `categories` | `categories` | Hierarquia por `parent_id` |
| `tags` | `tags` | Cadastro de tags |
| array `transactions.tags` | `transaction_tags` | Relação N:N normalizada |
| `budgets` | `budgets` | Orçamentos mensais |
| `goals` | `goals` | Metas financeiras |
| `closedPeriods` | `closed_periods` | Travas contábeis |
| `recurrenceRules` | `recurrence_rules` | Regras de recorrência |
| `installments` | `installments` | Contratos de parcelamento |
| `activityLogs` | `activity_logs` | Histórico imutável |
| `reconciliationHistory` | `reconciliation_history` | Histórico e totais da conciliação |
| `importCandidates` | `import_candidates` | Estado da Central de Importação |

Cada tabela migrada deverá possuir `legacy_firebase_id` único. Os IDs antigos serão preservados durante a importação para reconstruir referências e facilitar auditoria.

## 6. Modelo de segurança

1. Criar um usuário no Supabase Auth com o mesmo e-mail do usuário atual.
2. Registrar em `profiles` o UID antigo do Firebase e o UUID novo do Supabase.
3. Habilitar RLS em todas as tabelas acessíveis pelo cliente.
4. Criar políticas `select`, `insert`, `update` e `delete` baseadas em `auth.uid() = user_id`.
5. Impedir alteração de `user_id`, `created_at` e campos históricos protegidos.
6. Manter `activity_logs` sem permissão de atualização.
7. Migrar o login Google e exigir novo login após o corte.
8. Alterar o proxy da Groq para validar JWT do Supabase.
9. Manter chaves administrativas somente no servidor e fora do bundle do Vite.

Mesmo sendo um sistema pessoal, RLS será obrigatória para impedir exposição acidental por chave pública ou erro de consulta.

## 7. Operações que devem virar RPCs transacionais

As seguintes rotinas não devem ser implementadas como várias chamadas independentes do navegador:

- criar, editar ou excluir transação com atualização de saldo;
- criar transferência entre duas contas;
- pagar fatura total ou parcialmente;
- estornar compra total ou parcialmente;
- criar ou excluir séries recorrentes e parceladas;
- importar lote de lançamentos;
- confirmar candidato da Central de Importação;
- aplicar conciliação e ajuste de saldo;
- recalcular ou reabrir fatura/período;
- excluir dados financeiros com restauração dos saldos afetados.

Cada RPC deverá executar em uma transação PostgreSQL, validar o proprietário, bloquear linhas financeiras relevantes (`FOR UPDATE`) e ser idempotente quando houver risco de repetição.

## 8. Fases de execução

### Fase 0 — Decisão e congelamento do escopo

- Confirmar formalmente a decisão de prosseguir.
- Definir uma branch exclusiva para a migração.
- Registrar métricas de referência do Firebase.
- Proibir mudanças concorrentes nas regras financeiras durante a implementação.
- Definir critérios de aceite e rollback antes de escrever no Supabase.

**Saída:** autorização explícita, baseline e escopo fechado.

### Fase 1 — Inventário e backup

- Exportar todas as coleções do Firestore em JSON bruto.
- Gerar CSV separado por coleção para conferência humana.
- Gerar manifesto com quantidade, tamanho e hash de cada arquivo.
- Capturar todos os IDs e referências entre documentos.
- Produzir relatório de inconsistências legadas antes da transformação.
- Armazenar o backup em dois locais protegidos.

**Saída:** backup reproduzível e inventário assinado por hashes.

### Fase 2 — Schema PostgreSQL

- Criar migrations SQL versionadas.
- Definir tabelas, tipos, chaves estrangeiras, índices e constraints.
- Criar `legacy_firebase_id` e tabela de mapeamento de identidade.
- Normalizar pagamentos de faturas e tags.
- Criar views para Dashboard, relatórios e resumo de faturas quando isso simplificar consultas.
- Criar RLS e testes automatizados de isolamento.

**Saída:** banco vazio, seguro e recriável por migrations.

### Fase 3 — Camada de aplicação

- Criar cliente Supabase e tipos gerados do banco.
- Definir interfaces de repositório independentes do provedor.
- Implementar repositórios Supabase para leitura e CRUD simples.
- Implementar RPCs para operações financeiras atômicas.
- Migrar AuthContext e validação do proxy Groq.
- Substituir `onSnapshot` por consultas carregadas sob demanda e Realtime apenas onde houver benefício real.
- Preservar um seletor de provedor somente em homologação.

**Saída:** aplicação executável contra Supabase sem remover a implementação Firebase.

### Fase 4 — Importador idempotente

- Ler o JSON bruto do Firestore.
- Transformar datas, enums, valores monetários, arrays e referências.
- Importar entidades na ordem de dependência.
- Registrar cada transformação e rejeição.
- Permitir reexecução sem duplicar registros.
- Exportar CSV de resultado e relatório de divergências.

Ordem sugerida:

1. perfil;
2. contas, cartões, categorias e tags;
3. recorrências e parcelamentos;
4. transações;
5. faturas e pagamentos;
6. períodos fechados, orçamentos e metas;
7. conciliações, candidatos de importação e logs.

**Saída:** cópia completa no ambiente de homologação.

### Fase 5 — Reconciliação automática

Executar comparações Firebase × Supabase:

- contagem por coleção/tabela;
- IDs importados, ausentes e duplicados;
- soma histórica de receitas, despesas e transferências;
- totais mensais por regime de caixa e competência;
- saldo inicial, efeito acumulado e saldo final por conta;
- compras, pagamentos, créditos e saldo remanescente por fatura;
- pagamentos totais e parciais vinculados;
- limites disponíveis de cartões;
- parcelas futuras e recorrências;
- estornos e seus lançamentos-pai;
- períodos fechados;
- orçamentos, metas e conciliações;
- cards do Dashboard e todos os relatórios.

Valores monetários devem apresentar diferença zero em centavos. Diferenças explicadas por normalização precisam ser documentadas individualmente; não poderão ser simplesmente ignoradas.

**Saída:** relatório de equivalência aprovado ou migração bloqueada.

### Fase 6 — Homologação funcional

Executar no Supabase, sem afetar a produção:

- login e logout;
- criação, edição e exclusão de receitas e despesas;
- transferências;
- lançamentos de cartão;
- pagamento total e parcial de fatura;
- estornos;
- parcelamentos e recorrências;
- importação OFX/CSV/XLSX/PDF;
- conciliação;
- fechamento e reabertura de período;
- Dashboard, relatórios, auditoria e projeção de caixa;
- uso em múltiplas abas e atualização PWA.

**Saída:** checklist funcional e testes automatizados aprovados.

### Fase 7 — Ensaio de migração

- Restaurar um Supabase de homologação vazio.
- Executar todo o processo a partir dos backups.
- Medir duração, registrar comandos e eliminar etapas manuais frágeis.
- Simular falha em pontos intermediários e confirmar idempotência.
- Simular rollback para Firebase.

**Saída:** runbook final com tempo previsto de indisponibilidade.

### Fase 8 — Corte de produção

1. Colocar o Fiducia em modo de manutenção/somente leitura.
2. Registrar horário e último ID gravado no Firebase.
3. Criar backup final JSON e CSV.
4. Executar importação final em um Supabase limpo ou reconciliar o delta.
5. Rodar todas as validações automáticas.
6. Fazer conferência manual dos meses e faturas críticos.
7. Publicar a configuração Supabase.
8. Fazer novo login Google.
9. Executar smoke tests em produção.
10. Liberar gravações somente após aprovação.

Se qualquer validação crítica falhar, o corte deve ser cancelado antes da liberação das gravações.

### Fase 9 — Estabilização e encerramento

- Monitorar erros, queries, RPCs e divergências por no mínimo 14 dias.
- Realizar backups periódicos do PostgreSQL.
- Manter Firebase sem novas gravações e sem exclusão durante o período de rollback.
- Remover dependências Firebase somente após a estabilização.
- Arquivar relatórios, hashes, scripts e resultado final da migração.

**Saída:** Supabase como fonte oficial e Firebase preservado como arquivo pelo prazo definido.

## 9. Critérios obrigatórios de aceite

A migração só poderá ser aprovada quando:

- 100% dos documentos relevantes tiverem destino ou justificativa formal;
- não houver transação ausente ou duplicada;
- todas as referências críticas forem resolvidas;
- saldos das contas coincidirem em centavos;
- faturas e pagamentos coincidirem em centavos;
- Dashboard e relatórios coincidirem nos períodos de referência;
- operações atômicas tiverem testes de sucesso, falha e repetição;
- RLS impedir acesso sem autenticação e por usuário diferente;
- o proxy Groq rejeitar tokens inválidos;
- o rollback tiver sido ensaiado;
- Firebase permanecer recuperável.

## 10. Plano de rollback

O rollback será simples enquanto não houver gravações novas exclusivamente no Supabase:

1. ativar modo de manutenção;
2. restaurar no deploy as variáveis/configuração Firebase;
3. publicar a última versão Firebase conhecida como estável;
4. conferir login, saldos, faturas e Dashboard;
5. liberar gravações no Firebase;
6. preservar o Supabase para diagnóstico.

Após a abertura do Supabase para novas gravações, qualquer rollback exigirá exportar o delta do Supabase e convertê-lo para Firebase. Por isso, as primeiras horas de produção devem ter observação ativa e mudanças mínimas.

## 11. Estimativa

| Bloco | Estimativa |
|---|---:|
| Inventário, backup e baseline | 1–2 dias úteis |
| Schema, migrations, RLS e views | 2–4 dias úteis |
| Repositórios, Auth e Realtime | 3–5 dias úteis |
| RPCs financeiras | 3–5 dias úteis |
| Importador e reconciliação | 2–4 dias úteis |
| Testes, ensaio e correções | 3–5 dias úteis |
| Corte e validação | 1 dia útil |
| **Total estimado** | **15–26 dias úteis** |

A faixa poderá cair se o inventário confirmar baixo volume e poucos dados legados, mas não se recomenda reduzir as etapas de backup, equivalência, RLS, atomicidade ou rollback.

## 12. Decisão futura

Antes de iniciar, responder formalmente:

- As dificuldades atuais justificam o custo e o risco da migração?
- O objetivo é apenas melhorar consultas ou também reorganizar a arquitetura?
- Existe uma janela aceitável de manutenção?
- Por quanto tempo o Firebase será mantido para rollback?
- Quais meses, contas e faturas serão usados como amostra de conferência manual?

Até essa decisão, o plano deve permanecer apenas como contingência documental e o Fiducia continua oficialmente em Firebase.
