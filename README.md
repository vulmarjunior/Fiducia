# Fiducia — Gestão Financeira Pessoal

Aplicação web para controle completo das suas finanças: contas, cartões de crédito, orçamentos, metas, conciliação bancária e relatórios inteligentes com IA.

> **Versão atual:** `0.5.1` | **Status:** Em desenvolvimento ativo

---

## Funcionalidades

### Dashboard
Visão geral com saldo consolidado, receitas e despesas do mês, cobertura de caixa (projeção de 90 dias), gráfico de fluxo e últimos lançamentos.

### Lançamentos
CRUD completo de receitas, despesas e transferências com suporte a parcelamento, recorrência, séries (editar/excluir apenas este, este e futuros, ou todos), confirmação rápida de pendências e importação CSV/Excel.

### Contas Bancárias
Múltiplas contas (corrente, poupança, carteira, investimento), diagnóstico de saldo, ajuste por reconciliação (partidas dobradas) e reset.

### Cartões de Crédito
Faturas com grupos visuais (parcelamentos anteriores, compras do período, créditos/estornos, pagamentos), visualização organizada ou cronológica, comprometimento futuro com parcelamentos, importação de fatura PDF com IA (Groq) e conferência inteligente (PDF/CSV/XLS/XLSX) que compara, sugere matches e permite revisar antes de importar.

### Conciliação Bancária
Importação OFX/CSV, auto-match de transações, sugestão de matches com IA e análise de divergências.

### Relatórios (6 abas)
- **Fluxo de Caixa** — receitas vs despesas mensais, taxa de poupança
- **Categorias** — distribuição percentual com métrica % Renda
- **Tendência & Orçamento** — curva diária de gastos vs limites
- **Projeção Futura** — simulação de saldo com 3 cenários (Conservador, Realista, Projetado), horizonte configurável e visão diária de risco
- **Faturas de Cartão** — evolução mensal, peso por cartão, status (aberta/fechada/paga/futura)
- **Análise IA** — Groq interpreta os dados calculados pelo sistema e gera score financeiro com recomendações personalizadas

### Orçamentos e Metas
Limites de gasto por categoria com tabela Orçado × Realizado. Metas financeiras com acompanhamento de progresso.

### Auditoria
Diagnóstico de integridade de saldo, correção por reconciliação e reabertura de períodos contábeis fechados.

### Outros
- **Autenticação** Google + modo convidado anônimo
- **Tema** claro/escuro com paleta navy
- **PWA** instalável em dispositivos móveis
- **Exportação PDF** para relatórios, extratos e faturas
- **Categorias** hierárquicas com ícones do Lucide
- **Tags** livres com cores personalizadas
- **Activity Log** com histórico de todas as operações

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Runtime | Node.js, Vite 6 |
| Linguagem | TypeScript 5.8 |
| UI | React 19, Tailwind CSS 4, Shadcn/UI (Base UI) |
| Backend | Firebase (Firestore + Auth) |
| IA | Groq API (`llama-3.3-70b-versatile`) |
| Gráficos | Recharts |
| PDF | jsPDF + autotable (lazy-loaded) |
| Testes | Vitest |
| Lint | `tsc --noEmit` |

---

## Começando

```bash
git clone https://github.com/vulmarjunior/Fiducia.git
cd Fiducia
npm install
```

Crie um arquivo `.env.local` baseado no `.env.example`:

```env
GROQ_API_KEY=sua_chave_groq
APP_URL=http://localhost:3000
```

```bash
npm run dev      # http://localhost:3000
```

### Comandos disponíveis

```bash
npm run dev       # Servidor de desenvolvimento
npm run build     # Build de produção
npm run preview   # Preview do build
npm run lint      # Verificação de tipos (tsc --noEmit)
npm run test      # Testes unitários (Vitest)
```

---

## Estrutura do Projeto

```
src/
├── App.tsx                    # Rotas (React Router v7)
├── main.tsx                   # Entry point + PWA + ThemeProvider
├── firebase.ts                # Init Firebase
├── index.css                  # Tailwind + tema
├── contexts/                  # AuthContext, TransactionDialogContext
├── components/
│   ├── ui/                    # Primitivos (dialog, select, popover, button, etc.)
│   ├── Layout.tsx             # Sidebar + navegação
│   ├── TransactionDialog.tsx  # Modal unificado de lançamento
│   ├── InvoiceReconciliationDialog.tsx  # Conferência de fatura
│   ├── PdfImportReviewDialog.tsx        # Importação rápida PDF
│   ├── MoneyInput.tsx         # Campo monetário com formatação pt-BR
│   ├── CalcPopover.tsx        # Calculadora inline
│   ├── CategorySelect.tsx     # Seletor hierárquico de categorias
│   ├── PageHelp.tsx           # Helper contextual por página
│   └── ConfirmDialog.tsx      # Diálogo de confirmação
├── pages/                     # 14 páginas (Dashboard, Transactions, etc.)
├── services/                  # importService, ofxService, pdfInvoiceService, groqService
├── lib/                       # Lógica de negócio (cashCoverage, invoiceAnalysis, utils, etc.)
├── types/                     # Interfaces TypeScript
└── utils/                     # Utilitários (creditCardUtils, cleanUndefined)
```

### Rotas

| Path | Página |
|------|--------|
| `/login` | Login |
| `/` | Dashboard |
| `/transactions` | Lançamentos |
| `/reconciliation` | Conciliação |
| `/audit` | Auditoria |
| `/accounts` | Contas |
| `/cards` | Cartões de Crédito |
| `/budgets` | Orçamentos |
| `/reports` | Relatórios |
| `/goals` | Metas |
| `/categories` | Categorias |
| `/tags` | Tags |
| `/activity` | Activity Log |
| `/settings` | Configurações |

### Firestore — Coleções

Cada coleção é isolada por `userId`.

| Coleção | Descrição |
|---------|-----------|
| `users` | Perfil do usuário |
| `accounts` | Contas bancárias (corrente, poupança, carteira, investimento) |
| `creditCards` | Cartões (limite, fechamento, vencimento) |
| `transactions` | Lançamentos (receita, despesa, transferência) |
| `invoices` | Faturas de cartão |
| `categories` | Categorias hierárquicas |
| `tags` | Rótulos personalizados |
| `budgets` | Orçamentos mensais por categoria |
| `goals` | Metas financeiras |
| `closedPeriods` | Períodos contábeis fechados |
| `recurrenceRules` | Regras de recorrência |
| `installments` | Contratos de parcelamento |
| `activityLogs` | Histórico de operações |
| `reconciliationHistory` | Histórico de conciliações |

---

## Links

- **App publicado:** https://fiducianew.vercel.app/
- **Repositório:** https://github.com/vulmarjunior/Fiducia

---

## Licença

Projeto privado. Todos os direitos reservados.
