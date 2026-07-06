# Organização de Lançamentos na Fatura de Cartão de Crédito

> Resumo técnico da lógica de classificação, ordenação e apresentação.
> **Sistema:** Fiducia v0.3.2 | **Arquivo:** `src/pages/CreditCards.tsx`

---

## 1. Classificação em 5 Grupos

A função `classifyInvoiceTransaction()` (`CreditCards.tsx:710`) categoriza cada transação com base no tipo e relacionamento com o cartão:

| Ordem | Grupo | Critério | Exemplo |
|-------|-------|----------|---------|
| 1 | **Compras do Período** | Tudo que não cai nos grupos abaixo + parcelas 1 (compra nova) | Compra à vista, parcela 1/10 |
| 2 | **Parcelamentos Anteriores** | `installmentNumber >= 2` | Parcela 3/10 de compra passada |
| 3 | **Outros Débitos** | Transferência saindo do cartão (`accountId === cardId`) | Saque, pagamento de outra fatura |
| 4 | **Créditos e Estornos** | Receita na conta do cartão (`income` + `accountId === cardId`) | Estorno, cashback |
| 5 | **Pagamentos e Ajustes** | Transferência entrando no cartão (`destinationAccountId === cardId`) | Pagamento da fatura via conta corrente |

### Código-fonte

```typescript
const classifyInvoiceTransaction = (t: any, cardId: string, currentPeriod: string) => {
  if ((t.type === 'transfer' || t.type === 'transferencia') && t.destinationAccountId === cardId) return 'PAGAMENTOS_AJUSTES';
  if ((t.type === 'transfer' || t.type === 'transferencia') && t.accountId === cardId) return 'OUTROS_DEBITOS';
  if ((t.type === 'income' || t.type === 'receita') && t.accountId === cardId) return 'CREDITOS_ESTORNOS';
  if (t.installmentNumber && t.installmentNumber >= 2) return 'PARCELAMENTOS_ANTERIORES';
  return 'COMPRAS_DO_PERIODO';
};
```

---

## 2. Ordenação por Grupo

Cada grupo tem regra própria de ordenação (`CreditCards.tsx:1202-1219`):

| Grupo | Ordenação |
|-------|-----------|
| **Parcelamentos Anteriores** | `postingDate` → `description` alfabético → `installmentNumber` |
| **Compras do Período** | `date` cronológico |
| **Demais grupos** | `postingDate \|\| date` cronológico |

---

## 3. Modos de Visualização

- **Organizado** (padrão) — 5 grupos com subtotais e cabeçalhos coloridos
- **Cronológico** — tabela plana ordenada por data

---

## 4. Lógica de Período da Fatura

`calculateInvoicePeriod()` (`src/lib/utils.ts:11`) determina a qual fatura uma transação pertence:

1. Se o **dia da compra > dia de fechamento**, a compra vai para o **próximo ciclo**
2. Se `dueDay <= closingDay`, o vencimento cai no mês seguinte ao fechamento
3. O `invoicePeriod` é armazenado no campo `invoicePeriod` da transação (formato `YYYY-MM`)

### Exemplo

| Cartão | Fechamento | Vencimento | Compra em 28/06 | invoicePeriod |
|--------|-----------|------------|-----------------|---------------|
| Nubank | Dia 25 | Dia 05 | 28/06/2026 | `2026-07` |
| Nubank | Dia 25 | Dia 05 | 20/06/2026 | `2026-06` |

---

## 5. Tratamento Especial de Parcelamento

Para cada transação parcelada, o sistema distingue 3 datas:

| Campo | Significado | Exibição |
|-------|-------------|----------|
| `date` | Data de lançamento genérica | Sempre visível |
| `postingDate` | Data de lançamento da parcela na fatura | Usada para parcelas >= 2 (se disponível) |
| `originalPurchaseDate` | Data da compra original | Exibida como subtítulo: "compra DD/MM" para parcelas >= 2 |

A **parcela 1** sempre afeta o saldo da conta bancária (se débito). **Parcelas >= 2** são apenas marcadores na fatura, sem impacto no saldo.

### Exemplo de apresentação

```
15/05 — Compra de Notebook          Categoria: Informática
         compra 20/04               Parcela 3/10      + R$ 450,00
```

---

## 6. Filtro de Transações da Fatura

O conjunto de transações de uma fatura é determinado por:

```typescript
const periodTransactions = transactions.filter(t =>
  (t.accountId === card.id || t.destinationAccountId === card.id) &&
  t.invoicePeriod === currentPeriod
);
```

Toda transação cujo `invoicePeriod` bate com o período calculado para o mês selecionado, independentemente do tipo. Isso inclui compras, parcelas de meses anteriores, estornos, ajustes e pagamentos — todos agrupados na mesma fatura.

---

## 7. Cálculo do Total da Fatura

```typescript
const totalInvoice = previousBalance + periodExpenses - periodPayments - periodIncomes;
```

| Componente | Definição |
|------------|-----------|
| `previousBalance` | `calculatePeriodBalance()` do período anterior |
| `periodExpenses` | Soma de transações `expense`/`despesa` do período atual |
| `periodPayments` | Soma de `transfer`/`transferencia` com destino no cartão |
| `periodIncomes` | Soma de `income`/`receita` na conta do cartão |

---

## 8. Status da Fatura

| Status | Origem | Condição |
|--------|--------|----------|
| **aberta** | Padrão | Sem invoice persistida ou `status === 'aberta'` |
| **fechada** | Invoice persistida | `status === 'fechada'` |
| **paga** | Invoice persistida | `status === 'paga'` OU `totalInvoice <= 0 && periodPayments > 0` |

---

## 9. Consistência com a Interface `Transaction`

Campos relevantes do tipo `Transaction` (`src/types/index.ts`):

```typescript
{
  creditCardId?: string;           // Cartão ao qual pertence
  invoicePeriod?: string;           // Período da fatura (YYYY-MM)
  installmentNumber?: number;       // Nº da parcela atual
  totalInstallments?: number;       // Total de parcelas
  ccRecurrenceType?: 'avulso' | 'parcelado' | 'fixo';
  originalPurchaseDate?: string;    // Data da compra original
  postingDate?: string;             // Data de lançamento na fatura
  isSystemGeneratedDate?: boolean;  // Se a data foi estimada pelo sistema
}
```
