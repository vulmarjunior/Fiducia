# Plano de Melhorias & Diagnóstico de Consistência — Sistema Fidúcia

> **STATUS: Parcialmente resolvido** — Última revisão: 2026-07-06 (v0.4.0).

Este documento consolida os diagnósticos realizados sobre o sistema, abordando os impactos das alterações de autenticação, as discrepâncias de cálculo entre telas e as inconsistências na categorização e edição de lançamentos originados da fatura de cartão de crédito.

---

## 1. Alinhamento sobre Fix de Conexão (Autenticação/Banco de Dados) e Produção

### Diagnóstico Técnico
O erro original `Firebase: Error (auth/unauthorized-domain)` ocorre porque o domínio de produção/homologação temporário fornecido pelo Cloud Run não está explicitamente listado nos "Domínios Autorizados" (Authorized Domains) no console administrativo do Firebase Auth.

### Resolução Implementada
Para solucionar este impedimento sem depender de alterações manuais imediatas de infraestrutura no console do Google Cloud/Firebase pelo usuário, foi adicionado um fluxo de **Acesso de Convidado (Modo Teste)** via `signInAnonymously`:
- **Isolamento de Impacto:** O novo método é totalmente compatível e seguro. Ele não altera as credenciais de produção existentes e as chaves de API declaradas continuam intactas.
- **Funcionamento em Produção:** Se o usuário final acessar a versão definitiva e usar o login tradicional do Google, as permissões e fluxos originais funcionarão perfeitamente (desde que o domínio final de produção esteja configurado no Firebase Console). O botão de convidado serve como uma redundância robusta para testes rápidos e demonstrações do sistema sem bloqueios de CORS/Domínio.

---

## 2. Divergência nos Cálculos de Despesas (Visão Geral vs. Lançamentos)

Foi identificada uma inconsistência de conceitos na apresentação dos indicadores financeiros entre as duas telas principais do ecossistema:

### A. Tela de Lançamentos (`Transactions.tsx`)
*   **Lógica de Cálculo:** O valor exibido no card de despesas é a soma de todos os lançamentos que correspondem aos **filtros ativos na tela no momento** (busca por texto, filtro de conta específica, tipo, ou intervalo selecionado).
*   **Problema de Consistência:** Por padrão, se nenhum filtro temporal forte estiver selecionado, a tela exibe valores acumulados históricos ou de um intervalo amplo. Ela não força a visualização do mês corrente para fins de caixa, a menos que o usuário execute essa ação de filtragem manualmente.

### B. Tela Inicial (`Dashboard.tsx` - Visão Geral)
*   **Lógica de Cálculo:** O card "Despesas do Mês" calcula estritamente as transações cuja data se inicia com a string do mês atual (ex: `2026-05`). Além disso, aplica a verificação `isEffectivelyPaid(t)`, considerando regras específicas de liquidação antes de somar o montante.
*   **Por que isso causa confusão ao usuário?**
    Se o usuário acessa a tela de Lançamentos imaginando ver apenas o mês corrente (por similaridade visual), ele visualiza somas diferentes das da tela inicial. Além disso, as regras de filtros acumulados confundem o planejamento de despesas efetivamente pagas ou provisionadas.

### Plano de Unificação Proposto
1.  **Padronização de Contexto Temporal:** Definir um filtro de data padrão na tela de Lançamentos (`Transactions.tsx`) para iniciar sempre apontando para o **Mês Corrente**, alinhando-se com a experiência da Visão Geral.
2.  **Transparência nas Fórmulas por Tooltips:** Adicionar pequenos ícones de informação (tooltips) explicando o critério de cálculo:
    *   *No Dashboard:* "Soma das despesas efetivas e liquidadas do mês corrente."
    *   *Nos Lançamentos:* "Soma do valor das despesas com base nos filtros da listagem abaixo."
3.  **Compartilhamento de Helpers de Status:** Substituir reduções manuais por uma função unificada de negócio para definir quando uma transação deve ser somada como despesa de caixa ou provisionamento.

---

## 3. Discrepância nas Categorias (Lançamentos Diretos via Fatura de Cartão)

Identificamos duas falhas distintas de sincronismo quando um lançamento é efetuado diretamente de dentro da fatura de um Cartão de Crédito (`CreditCards`):

### Diagnóstico Técnico

#### Problema 1: Lista e Apresentação de Categorias Divergente
*   **Causa:** O modal interno de lançamento rápido na fatura do cartão consome ou mapeia as categorias de forma estática (ou via uma lista local simplificada), enquanto o modal principal de Lançamentos consome diretamente o estado atualizado do banco de dados (Firestore) ou um dicionário dinâmico mantido em sincronia com o cadastro de categorias do usuário.
*   **Consequência:** A listagem rápida exibe nomes de categorias ou layouts que não condizem com as customizações efetuadas pelo usuário na guia "Categorias".

#### Problema 2: Reset para "Categoria Padrão" no Formulário de Edição
*   **Causa:** Ao abrir o Lançamento gerado pelo Cartão para edição na tela principal (`Transactions.tsx`), o identificador da categoria (`categoryId`) gravado pelo fluxo do Cartão não encontra correspondência exata na lista de objetos de categorias carregada no dropdown de edição.
*   **Detalhe Técnico:** É muito provável que o fluxo da fatura do Cartão esteja armazenando o valor da categoria como string legível (ex: `"Alimentação"`) ou utilizando chaves de ID estáticas antigas (ex: `"alimentacao"`), enquanto o formulário de edição de transações requer um UUID gerado pelo banco Firestore (ex: `"cat_123456"`). Sem o match exato de IDs, o componente de seleção desaba para o fallback de segurança configurado: `"Categoria Padrão"`.

#### Problema 3: Lógica de Tratamento Divergente (Edição Bloqueada)
*   **Sintoma:** Os lançamentos criados através do modal interno de faturas de cartão de crédito não aparecem como editáveis de forma transparente na tela principal de Lançamentos (`Transactions.tsx`).
*   **Análise Técnica:** As transações originadas da tela de cartões podem estar sendo gravadas sem determinados sinalizadores ou campos de controle necessários para que o formulário da tela de Lançamentos habilite suas opções normais de reedição e exclusão, fragmentando a experiência do usuário.

### Plano de Alinhamento e Resolução
1.  **Refatoração do Schema de Gravação no Cartão:** Garantir que o modal de inserção de despesas na fatura use exatamente o mesmo hook ou serviço de cadastro de transações de `Transactions.tsx`, passando obrigatoricamente o `categoryId` associado ao documento de categorias do Firestore, em vez de textos puros.
2.  **Dropdown Centralizado de Categorias:** Extrair o componente de busca/seleção de categorias para um componente reutilizável (`/src/components/CategorySelect.tsx`), compartilhando a lista obtida dinamicamente do Firebase entre a tela de Lançamentos e o modal de Cartão.
3.  **Higienização de Dados Legados (Migration):** Implementar um parser no serviço de carregamento de lançamentos para auto-corrigir lançamentos cujos campos `categoryId` correspondam a strings legíveis antigas, remapeando-os para os IDs modernos correspondentes.
4.  **Consistência de Mutabilidade (Problema 3):** Unificar os métodos de remoção e atualização de dados de modo que qualquer lançamento (independentemente de sua origem ser a tela de cartões ou a de lançamentos gerais) exponha os mesmos botões de edição de forma consistente, preservando o período e ID da fatura de cartão vinculada.

---

## 4. Recurso de Confirmação Rápida de Contas Pendentes (Lançamentos Parcelados/Recorrentes)

### Contextualização e Regras de Negócio
Para otimizar o fluxo de caixa sem exigir que o usuário navegue por submenus repetitivos, propõe-se a adição de uma funcionalidade de liquidação ágil direto na listagem de pendências.

*   **O Recurso:** Na listagem de lançamentos, permitir que o usuário confirme com um único clique o pagamento/recebimento de lançamentos que estejam categorizados como pendentes.
*   **Diferenciação Estrita de Contas de Cartão de Crédito:**
    *   Este recurso de conciliação e pagamento rápido **fará sentido e será exibido apenas para contas cadastradas do tipo corrente, investimento, carteira, poupança, etc.**
    *   **Justificativa de Exclusão do Cartão:** Lançamentos parcelados ou recorrentes vinculados a uma conta de **Cartão de Crédito** são pagos de forma automática por meio do limite creditício no exato momento da compra (gerando uma despesa provisionada). No caso do cartão, essa parcela pendente representará o consumo mensal que irá compor o fechamento da fatura global. Portanto, o que fica genuinamente pendente de quitação financeira no mundo real é a **Fatura do Cartão** como um todo, e não a parcela pontual da compra individual.
    *   Assim, o botão de confirmação rápida **estará desabilitado ou oculto** para linhas de lançamentos com contas do tipo cartão de crédito, evitando dupla confirmação errônea por parte do usuário.

### Plano de Alinhamento e Resolução
1.  **Condicional de Visibilidade na UI:**
    Introduzir no componente de listagem de transações uma validação que renderiza a ação rápida apenas se:
    ```typescript
    const podeConfirmarRapido = (
      transaction.status === "pending" && 
      transaction.accountType !== "credit_card"
    );
    ```
2.  **Ação Atômica de Atualização (Firestore):**
    *   Ao acionar o botão de confirmação, alterar instantaneamente o status do lançamento de `'pending'` para `'paid'` (ou `'efetuado'`).
    *   Ajustar a data de liquidação para o dia corrente.
    *   Submeter a mutação no Firestore de forma assíncrona com feedback imediato via toast visual de sucesso, recalculando os indicadores e saldos consolidados nas telas afetadas do sistema.

---

Este plano foi desenvolvido de modo a manter a estabilidade do sistema Fidúcia, providenciando um guia definitivo de melhorias de usabilidade e arquitetura para as próximas iterações.
