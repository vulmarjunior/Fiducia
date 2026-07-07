# Plano de Implementacao - Central de Importacao Assistida do Fiducia

> **LLM:** deepseek-v4-pro | **Agente:** opencode

## 1. Objetivo

Criar uma **Central de Importacao Assistida** para receber textos de alertas bancarios, textos compartilhados para a PWA e, futuramente, arquivos/extratos, transformando esses dados em **candidatos de lancamento** revisaveis.

A Central deve reduzir digitacao manual, principalmente no uso mobile, sem comprometer a integridade financeira do Fiducia.

Regra principal:

> Capturar primeiro, revisar depois, lancar somente apos confirmacao do usuario.

Nenhuma transacao real deve ser criada automaticamente.

---

## 2. Principios da Solucao

A Central de Importacao deve:

- funcionar como uma caixa de entrada de possiveis lancamentos;
- exigir revisao antes de criar transacoes definitivas;
- preservar os fluxos existentes de lancamento manual, conciliacao e conferencia de fatura;
- evitar duplicacao dos importadores ja existentes;
- manter parser local baseado em regras na primeira fase;
- nao enviar alertas bancarios para IA externa sem decisao futura explicita;
- respeitar a regra arquitetural de atomicidade com `runTransaction` quando houver impacto em saldo.

---

## 3. Estado Atual do Projeto

O Fiducia ja possui:

- PWA configurada com `vite-plugin-pwa`;
- importacao OFX/CSV/XLS/XLSX em Lancamentos;
- conciliacao bancaria em tela propria;
- conferencia inteligente de fatura de cartao com PDF/CSV/XLS/XLSX;
- importador de fatura em `invoiceImportService.ts`;
- motor de match de fatura em `invoiceReconciliation.ts`;
- criacao/edicao de transacoes com regras proprias para conta, cartao, parcelamento e recorrencia;
- Firestore Rules com validacoes por colecao;
- regra arquitetural: operacoes que afetam saldo devem usar `runTransaction`.

Portanto, a nova Central nao deve recriar tudo do zero. Ela deve comecar como um fluxo novo e pequeno para alertas bancarios, depois integrar gradualmente os importadores existentes.

---

## 4. Escopo da Fase 1

A Fase 1 deve implementar apenas a entrada assistida por texto:

1. Criar colecao `importCandidates`.
2. Criar tipos TypeScript para candidatos de importacao.
3. Criar parser local para alertas bancarios.
4. Criar servico de sugestao de conta, cartao, categoria e tags.
5. Criar servico de deteccao basica de duplicidade.
6. Criar servico de confirmacao do candidato.
7. Criar tela `Importar`.
8. Permitir colar texto de alerta bancario.
9. Criar rota `/importar/compartilhar`.
10. Configurar `share_target` no manifesto PWA.
11. Listar candidatos pendentes.
12. Permitir revisar, editar, confirmar, ignorar ou marcar como duplicado.
13. Criar testes unitarios do parser.
14. Atualizar `firestore.rules`.

---

## 5. Fora do Escopo da Fase 1

Nao implementar agora:

- leitura automatica de SMS;
- captura automatica de notificacoes Android;
- app Android companion;
- Open Finance;
- integracao por e-mail;
- importacao nova de arquivos dentro da Central;
- IA externa para interpretar alertas;
- criacao automatica de categorias;
- confirmacao automatica de transacoes;
- substituicao do fluxo atual de Lancamentos;
- substituicao da tela de Conciliacao;
- substituicao do fluxo Conferir Fatura.

---

## 6. Modelo de Dados

Criar colecao Firestore:

```text
importCandidates
```

### Tipos

```ts
export type ImportCandidateSource =
  | 'pasted_text'
  | 'shared_text'
  | 'file_bank_statement'
  | 'file_card_invoice'
  | 'email'
  | 'open_finance'
  | 'companion_app';

export type ImportCandidateStatus =
  | 'pending'
  | 'confirmed'
  | 'ignored'
  | 'duplicate'
  | 'error';

export type ParsedTransactionType =
  | 'expense'
  | 'income'
  | 'transfer'
  | 'refund'
  | 'card_expense'
  | 'unknown';
```

### Interface

```ts
export interface ImportCandidate {
  id?: string;
  userId: string;

  source: ImportCandidateSource;
  status: ImportCandidateStatus;

  rawContent: string;
  rawTitle?: string;
  rawUrl?: string;

  parsed: {
    type: ParsedTransactionType;
    amount?: number;
    date?: string;
    description?: string;
    merchant?: string;
    accountHint?: string;
    bankHint?: string;
    cardLastDigits?: string;
    categoryHint?: string;
    installments?: {
      current?: number;
      total?: number;
    };
    confidence: number;
    reasons: string[];
  };

  suggestions: {
    accountId?: string;
    creditCardId?: string;
    categoryId?: string;
    tagIds?: string[];
    confidence: number;
    reasons: string[];
  };

  duplicateCheck?: {
    isPossibleDuplicate: boolean;
    matchedTransactionIds: string[];
    reason?: string;
  };

  confirmedTransactionId?: string;
  errorMessage?: string;

  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
  ignoredAt?: string;
}
```

Datas devem seguir o padrao atual do projeto: strings ISO ou `YYYY-MM-DD`, conforme o contexto ja usado em `transactions`.

---

## 7. Firestore Rules

Atualizar `firestore.rules` com:

- funcao `isValidImportCandidate(data)`;
- leitura apenas pelo dono;
- criacao apenas por usuario autenticado;
- atualizacao apenas pelo dono;
- `userId` imutavel;
- `status` restrito aos valores validos;
- limite de tamanho para `rawContent`;
- validacao basica de `parsed`, `suggestions`, `createdAt` e `updatedAt`.

Tambem revisar em tarefa proxima a regra de `reconciliationHistory`, pois o codigo atual usa `credit_card_invoice` e as rules podem nao aceitar esse tipo.

---

## 8. Parser de Alertas Bancarios

Criar servico:

```text
src/services/importAlertParser.ts
```

Funcao principal:

```ts
export function parseBankAlert(
  rawText: string,
  referenceDate = new Date()
): ParsedImportResult
```

### Deve reconhecer

Valores:

```text
R$ 59,90
R$59,90
59,90 BRL
valor de R$ 59,90
```

Datas:

```text
07/07
07/07/2026
hoje
ontem
```

Cartao:

```text
cartao final 1234
final 1234
**** 1234
```

Operacoes:

- compra no credito;
- compra no debito;
- Pix enviado;
- Pix recebido;
- transferencia enviada;
- transferencia recebida;
- pagamento;
- estorno;
- devolucao.

Parcelamento:

```text
parcela 2/10
2 de 10
02/10
em 10x
```

O parser deve retornar:

- tipo provavel;
- valor;
- data;
- descricao;
- estabelecimento;
- final do cartao, se houver;
- parcelas, se houver;
- confianca;
- razoes da leitura.

Nao usar IA nessa fase.

---

## 9. Sugestoes

Criar servico:

```text
src/services/importSuggestionService.ts
```

Responsabilidades:

- sugerir cartao por final de cartao, quando possivel;
- sugerir conta por `bankHint`, `bankName`, `bankCode` ou nome da conta;
- sugerir categoria por regras simples de estabelecimento;
- sugerir tags como `pix`, `online`, `recorrente`.

### Cartoes

Adicionar campo opcional ao tipo `CreditCard`:

```ts
lastFourDigits?: string;
```

Esse campo nao deve ser obrigatorio e nao pode quebrar cartoes existentes.

A edicao visual desse campo pode ser feita na mesma fase ou em subfase posterior.

---

## 10. Duplicidade

Criar servico:

```text
src/services/importDuplicateService.ts
```

Criterios de possivel duplicidade:

- mesmo valor;
- data igual ou diferenca de ate 1 dia;
- mesma conta ou cartao, se identificado;
- descricao ou estabelecimento semelhante.

A duplicidade deve gerar alerta, mas nao bloquear a confirmacao.

O usuario deve poder:

- confirmar mesmo assim;
- editar o candidato;
- marcar como duplicado;
- ignorar.

---

## 11. Confirmacao do Candidato

Criar servico:

```text
src/services/importCandidateService.ts
```

Funcao principal:

```ts
confirmImportCandidate(candidateId: string, input: ConfirmImportCandidateInput): Promise<string>
```

A funcao deve:

1. Buscar o candidato.
2. Validar `userId`.
3. Validar `status === 'pending'`.
4. Criar a transacao real.
5. Atualizar o candidato para `confirmed`.
6. Gravar `confirmedTransactionId`.
7. Gravar `confirmedAt`.

### Lancamento bancario

Quando o candidato virar transacao de conta bancaria:

- usar `runTransaction`;
- criar documento em `transactions`;
- atualizar `accounts.balance` se o status for efetivamente pago;
- respeitar a logica canonica de saldo do projeto.

### Lancamento de cartao

Quando o candidato virar transacao de cartao:

- nao alterar `accounts.balance`;
- preencher `creditCardId`;
- preencher `accountId` com o id do cartao, seguindo padrao atual;
- calcular `invoicePeriod`;
- usar `status: 'realizado'`;
- respeitar campos de parcelamento quando aplicavel.

---

## 12. Interface

Adicionar rotas:

```text
/importar
/importar/compartilhar
/importar/:id
```

### Menu

Adicionar item no menu principal ou financeiro:

```text
Importar
```

### Tela `/importar`

Deve conter:

- entrada para colar alerta bancario;
- botao `Analisar alerta`;
- lista de candidatos pendentes;
- historico recente;
- atalhos para fluxos existentes:
  - Lancamentos;
  - Conciliacao;
  - Cartoes / Conferir Fatura.

A Central deve deixar claro que arquivos de fatura continuam no fluxo especializado de Cartoes.

### Tela de revisao

Campos editaveis:

- tipo;
- valor;
- data;
- conta ou cartao;
- categoria;
- tags;
- descricao;
- observacao;
- parcelamento, se aplicavel.

Exibir tambem:

- texto original;
- confianca da leitura;
- razoes da sugestao;
- alerta de duplicidade, se houver.

Acoes:

- confirmar lancamento;
- salvar como pendente;
- ignorar;
- marcar como duplicado.

---

## 13. PWA Share Target

Adicionar ao manifesto no `vite.config.ts`:

```ts
share_target: {
  action: '/importar/compartilhar',
  method: 'GET',
  params: {
    title: 'title',
    text: 'text',
    url: 'url',
  },
}
```

A rota `/importar/compartilhar` deve:

- exigir autenticacao;
- ler `title`, `text` e `url`;
- priorizar `text`;
- usar `title` e `url` como complemento;
- exibir previa;
- criar candidato somente se houver conteudo util.

Verificar tambem se o deploy possui fallback SPA para abertura direta dessa rota.

---

## 14. Fase 2 - Arquivos

A Fase 2 so deve comecar depois da Fase 1 estabilizada.

Objetivo:

- avaliar se importacoes bancarias OFX/CSV/XLSX devem gerar candidatos antes de virar transacoes;
- consolidar parte da logica hoje presente em `Transactions.tsx`;
- evitar duplicar `invoiceImportService`;
- manter `Conferir Fatura` como fluxo especializado de cartao;
- permitir revisao em lote de candidatos.

A Fase 2 pode incluir:

- OFX bancario;
- CSV bancario;
- XLS/XLSX bancario;
- PDF textual simples;
- mapeamento de colunas;
- candidatos em lote;
- confirmacao multipla.

---

## 15. Fase 3 - Futuro

Somente considerar depois da Central estar estavel:

- importacao por e-mail;
- app companion Android;
- Open Finance;
- perfis por banco;
- aprendizado local de categoria por estabelecimento;
- consentimento explicito para uso de IA externa.

Nenhuma dessas frentes deve criar transacoes definitivas sem revisao.

---

## 16. Testes Minimos

Criar testes unitarios para o parser.

Casos obrigatorios:

1. Compra em cartao.
2. Pix recebido.
3. Pix enviado.
4. Compra parcelada.
5. Estorno.
6. Data ausente.
7. Valor ausente.
8. Cartao final detectado.
9. Texto de baixa confianca.

Exemplo:

```ts
parseBankAlert(
  'Compra aprovada no cartao final 1234 em MERCADO CENTRAL no valor de R$ 84,90 em 07/07.'
)
```

Esperado:

```ts
{
  type: 'card_expense',
  amount: 84.90,
  cardLastDigits: '1234',
  merchant: 'MERCADO CENTRAL',
  date: '2026-07-07'
}
```

---

## 17. Criterios de Aceite da Fase 1

A Fase 1 estara concluida quando:

1. Existir rota e tela `Importar`.
2. Usuario conseguir colar texto de alerta bancario.
3. Parser extrair valor, tipo, data, descricao e cartao quando possivel.
4. Sistema criar `importCandidate` com status `pending`.
5. Usuario conseguir revisar candidato.
6. Usuario conseguir confirmar e gerar transacao real.
7. Usuario conseguir ignorar candidato.
8. Usuario conseguir marcar candidato como duplicado.
9. Sistema detectar duplicidade basica.
10. `/importar/compartilhar` receber texto compartilhado.
11. `share_target` estiver configurado no manifesto.
12. `firestore.rules` aceitar a nova colecao com seguranca.
13. Testes unitarios do parser passarem.
14. `npm run lint` passar.
15. `npm run build` passar.
16. Fluxos atuais de lancamento manual, conciliacao e fatura continuarem funcionando.

---

## 18. Estrategia de Implementacao

### Etapa 1 - Base

1. Criar tipos.
2. Criar parser.
3. Criar testes do parser.
4. Criar validators/Firestore Rules.
5. Criar servico de candidatos.

### Etapa 2 - Sugestoes e Duplicidade

1. Criar sugestao de conta/cartao/categoria/tags.
2. Criar checagem de duplicidade.
3. Integrar sugestoes ao candidato.

### Etapa 3 - Interface

1. Criar tela `Importar`.
2. Criar lista de pendentes.
3. Criar revisao de candidato.
4. Criar acoes de ignorar e duplicar.

### Etapa 4 - Confirmacao

1. Criar confirmacao bancaria com `runTransaction`.
2. Criar confirmacao de cartao sem impacto em saldo.
3. Atualizar status do candidato.
4. Registrar transacao confirmada.

### Etapa 5 - PWA

1. Configurar `share_target`.
2. Criar rota `/importar/compartilhar`.
3. Testar no Android com PWA instalada.
4. Validar fallback de rota no deploy.

---

## 19. Resultado Esperado

Ao final da Fase 1, o Fiducia tera uma Central de Importacao simples, segura e util para uso mobile.

O usuario podera:

- colar alertas bancarios;
- compartilhar textos para o Fiducia quando instalado como PWA;
- revisar dados extraidos;
- transformar candidatos em lancamentos reais;
- evitar duplicidades;
- manter controle total antes de qualquer alteracao financeira.

A solucao cria a base para importacao mais ampla no futuro sem duplicar os fluxos ja existentes nem enfraquecer as regras contabeis do sistema.