# Sessão — Extrato Mensal Investigável v0.10.0

> **LLM:** deepseek-v4-pro | **Agente:** opencode

## Objetivo

Permitir que o usuário identifique os lançamentos que formam os cards mensais e iniciar a transformação de Relatórios em uma superfície investigável.

## Resultado

- Receitas e despesas mensais do Dashboard ganharam detalhamento clicável e responsivo.
- A lista diferencia despesa em conta, pagamento de fatura e receita recebida.
- Relatórios ganhou a aba inicial Extrato Mensal, com totais reconciliados ao Dashboard e filtros de composição.
- Cada item abre o lançamento original para consulta ou edição.

## Arquivos

- `src/lib/monthlyStatement.ts`
- `src/lib/monthlyStatement.test.ts`
- `src/components/MonthlyStatementEntries.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/Reports.tsx`
- `package.json`, `package-lock.json`, `src/lib/utils.ts`
- `CHANGELOG.md`, `docs/MASTER_PLAN.md`

## Validações

- TypeScript sem erros.
- 78 testes aprovados; 2 cenários de emulador ignorados sem host local.
- Build de produção concluído.
- Aplicação local sem overlay ou erros de console.

## Segurança

Implementação somente de leitura. Nenhum dado do Firebase foi alterado ou migrado.
