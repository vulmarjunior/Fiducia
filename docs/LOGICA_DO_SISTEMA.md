# Lógica de Funcionamento e Arquitetura do Sistema Fiducia

## 1. Visão Geral da Arquitetura
Este é um aplicativo Single Page Application (SPA) construído com **React**, **Vite** e **TypeScript**.
A estilização é feita com **Tailwind CSS** juntamente com a biblioteca de componentes **Shadcn/UI**.
O backend (banco de dados e autenticação) é inteiramente gerenciado usando o **Firebase** (Firestore Database e Firebase Authentication).
As análises inteligentes e dicas contextuais são feitas integrando o modelo LLM do Google, consumindo a **Gemini API**.

## 2. Banco de Dados (Estrutura do Firestore)
O sistema opera com o banco de dados em tempo real Firestore (NoSQL). O design de dados é centrado no usuário: todas as coleções possuem uma forte relação com o `userId` oriundo da autenticação para garantir total isolamento de dados (cada usuário interage apenas com seus próprios registros).

### Principais Coleções e Lógicas de Modelagem:
- **`users`**:
  - Armazena as configurações globais e flags básicas do perfil de cada usuário logado (gerado ou capturado logo após a autenticação bem-sucedida).
- **`accounts` (Contas Bancárias)**:
  - Guarda as Contas Correntes, Poupanças e Carteiras de Investimento digitais.
  - Campos core: `name`, `type`, `balance` (saldo atual), `userId`.
- **`creditCards` (Cartões de Crédito)**:
  - Modelação separada das contas correntes pois cartões operam na lógica de "ciclos de faturamento", com um limite de crédito e dias fixos para corte e pagamento.
  - Campos core: `name`, `limit`, `closingDay` (dia de fechamento da fatura), `dueDay` (dia de vencimento), `userId`.
- **`categories` (Categorias)**:
  - Tabela-chave para as categorizações de receitas e despesas (p. ex: Transporte, Alimentação, Salário).
  - Campos core: `name`, `type` (receitas/despesas), `color` (hexa para interface visual).
- **`tags` (Rótulos Livres)**:
  - Adiciona uma camada secundária de granularidade às transações, excelente para indexação de pequenas viagens, projetos paralelos ou campanhas.
- **`transactions` (Lançamentos / Movimentações)**:
  - A mais crítica das coleções. Modelação atômica de entrada, saída ou transferência.
  - Campos core: `amount` (moeda via Number), `date` (formatada em String 'YYYY-MM-DD' para otimizar pesquisas de prefixo), `description`, `type` ('receita', 'despesa', 'transferência'), referências estruturais para as contas (`accountId` ou `cardId`), e referenciadoras de classificação (`categoryId`, array de `tags`). Contém também marcadores explícitos booleanos de status de conciliação.
- **`invoices` (Faturas Geradas)**:
  - Entidade agregadora que salva o status no tempo das faturas de cartão de crédito.
  - Campos core: `cardId`, `period` (mês de referência "YYYY-MM"), `status` (aberta, fechada, paga), `paymentTransactionId` (ligação com a `transaction` gerada no dia efetivo do pagamento).
- **`closedPeriods` (Fechamento Fiscal/Contábil)**:
  - Documentos sentinelas. Se existir um documento de mês "2024-05" vinculado a uma Conta "X", a interface congela edições para aquele período referenciado, forçando a integridade pregressa do mês fechado.
- **`budgets` (Orçamento/Teto de Gastos)**:
  - Parametrizações de metas por categoria e mês, disparando alertas percentuais caso o limite pré-estabelecido seja ameaçado de ser rompido.

---

## 3. Lógica das Telas e Submódulos Visuais

### 3.1 Autenticação (`AuthContext`)
- **Lógica implementada**: O estado da autenticação (`onAuthStateChanged`) encapsula toda a aplicação em um Provider (`AuthContext`).
- As rotas da aplicação são divididas entre Públicas e Privadas (protegidas via Wrapper que força redirecionamentos de navegação caso não exista sessão).
- Ao logar pela primeira vez, o Firebase captura a identidade e, via listener explícito, um hook inicializa um documento base para esse UID no subconjunto `users`.

### 3.2 Painel Consolidado / Dashboard (`/src/pages/Dashboard.tsx`)
- **Objetivo**: Ser o raio-X diário das finanças e hub de operações rápidas.
- **Dinamismo Operacional**:
  - Resolve snapshots do Firestore globalmente para derivar saldos imediatos de contas; faz parse manual e filtragem para aglutinar gastos atômicos que casem com a referência do Mês atual e da visão global.
  - **Fiducia AI Insight**: Um side-effect (useEffect) envia o balanço consolidável bruto para a Gemini API, que devolve uma pílula (short-tip inteligente) com até 150 caracteres, gerando empatia instantânea com o usuário com insights reativos.

### 3.3 Gestor de Transações (`/src/pages/Transactions.tsx`)
- **Objetivo Central**: Um super-formulário CRUD dotado de lógicas transversais robustas das movimentações de caixa.
- **Lógicas cruciais embutidas:**
  1. **Transferências**: O formulário gera uma entrada dualógica invisível — debita atomicamente da 'Conta Origem' com tipo=despesa e credita na 'Conta Destino' com tipo=receita.
  2. **Travas Temporais**: Qualquer alteração rege-se contra o index de `closedPeriods`. Meses fiscalizados desabilitam botões de editar e apagar (`disabled={isPeriodClosed}`).
  3. **Rotina de Pagamento na Fonte**: Uma transação paga e vinculada a uma Origem de Cartão dispara sincronismos retroativos (fechando faturas, caso os montantes se encontrem).

### 3.4 Operação de Cartões de Crédito (`/src/pages/CreditCards.tsx`)
- **Engajamento Periódico de Fatura (Timeline de Corte)**:
  - O aplicativo recalcula ciclicamente o espectro de datas baseado nos campos nativos de `closingDay` e `dueDay` e projeta todos os gastos mapeando esse delta de dias específicos para injetar as Transações correspondentes via client-side.
  - **Fluxo de Quitação de Fatura (`Pagar Fatura`)**: Ao disparar o modal, o sistema amassa o sumário devido num número float, resgata a Conta Bancária que proverá a liquidez e escreve no Firebase uma nova Transação (`despesa`), ao mesmo passo, faz update na collection de `invoices` trocando status de `aberta`/`fechada` para `paga` acoplando as IDs.

### 3.5 Conciliador Bancário Automático (OFX) (`/src/pages/Reconciliation.tsx`)
- **Mecânica Central de Ingestão de Extratos**:
  - O navegador intercepta o `.ofx` e processa no frontend via APIs de Parsing RegExp/Xpath, focando nos blocos extratores XML `<STMTTRN>`.
- **Heurística de Machine-Match (Motor de Equivalência)**:
  - Cria vetores comparativos entre Transações já cadastradas na modelagem do Firebase x Arquivo.
  - Se `{ valor === valor && abs(data_firebase - data_ofx) <= 3 dias }` a probabilidade de colisão e equivalência é acatada e a UI lista isso como "Sugestão de Match". Confirmar o item só efetua um selo de verificação (`reconciliationStatus: verdadeiro`).
  - Lançamentos não mapeados exibem botões "+" (criação ultra-rápida, contornando a digitação demorada manual).

### 3.6 Central Analítica em Relatórios (`/src/pages/Reports.tsx`)
- **Recharts Data Binding**: 
  - Estrutura-se vetores derivativos do Firebase para arrays de Objetos simplificados (ex: `{ mes: 'Fev', Receita: x, Despesa: y }`) e preenche o motor de gráficos para plotagens imersivas.
- **Auditoria de Saúde Assistida por IA (Gemini Full Analysis)**:
  - Se acoplado pela UI, um gerador empacota as últimas 50 transições num Payload robusto JSON, acopla o Score Sintético base, formula um prompt restrito em back-language para o Gemini produzir Relatórios em Markdown avaliando a capacidade de poupar/excedentes. Processo contido em estado de loading seguro.

### 3.7 Auditoria Contábil e Engenharia Reversa (`/src/pages/Audit.tsx`)
- **Detecção de Fraude Histórica**: Re-somatórios lógicos (Transações ordenadas no tempo vs Valores Absolutos setados) para avisar diferenças anômalas aos saldos de conta registrados nas models matrizes.
- **Recuperação de Ciclos**: Trata-se da central onde ocorrem os "Undo/Desfazer", reabrindo Faturas de cartão dadas como mortas (`paga` -> `aberta`) deletando a Transação correspondente de quitação na Base, e permitindo deleção pura do registro em `closedPeriods`.

---

## 4. Recomendações Críticas de Engenharia à Outros Desenvolvedores (Checklist de Replicação)

Para replicar exatamente a funcionalidade orgânica produzida aqui acima, não corrompa os seguintes pilares:

1. **Atenção nas Dependências Reactivas em Cascatas (useEffect)**: Use com parcimônia, evitando disparos repetitivos e montagem demorada devido a event-listeners que não limpam seus Callbacks `return () => unsubscribe()`. 
2. **Utilizar UUIDs do Firestore**: Não substitua os IDs das referências. Quando relacionar dados (ex: Transações -> Categorias), não salve os textnames da categoria; salve o seu ID e faça JOIN relacional (client-side) usando utilitários simples (vide: `resolveAccountName(...)`).
3. **Escrita Dupla no Backend**:
  Ao criar transações geradas via Fatura, abrace lógicas Promises Paralelas:
  \`\`\`js
  // Ao Pagar Fatura
  await Promise.all([
    addDoc(transactionsRef, payloadPgto),
    setDoc(invoiceRef, { status: "paga", ... })
  ]);
  \`\`\`
  Garante integridade.
4. **Gerenciamento de Segredos de IA**:
  Garantir que os tokens de chaves API sensíveis fiquem alocadas em infra server-side (ou em `.env` locais para `npm run dev`) mas *Cuidado* extremo ao realizar transições severas p/ Prod em arquitetura Client-Side-Only (CSR).
