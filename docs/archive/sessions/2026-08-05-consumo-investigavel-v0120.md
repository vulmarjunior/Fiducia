# Sessão — Consumo Investigável v0.12.0

> **LLM:** deepseek-v4-pro | **Agente:** opencode

## Objetivo

Responder onde o dinheiro foi gasto, distinguir conta e cartão e explicar variações sem duplicar pagamentos de fatura.

## Resultado

- Categorias foi renomeada para Consumo.
- O total separa despesas diretas e compras no cartão.
- Pagamentos de fatura são excluídos; créditos e estornos reduzem o consumo.
- Categorias com maior aumento ou redução são destacadas.
- Itens sem categoria recebem alerta próprio.
- Cada categoria abre sua composição em modal responsivo e permite acessar o lançamento.
- Mês/3M/6M/12M seguem o período global e comparam janelas equivalentes.

## Arquivos

- `src/lib/consumptionAnalysis.ts`
- `src/lib/consumptionAnalysis.test.ts`
- `src/pages/Reports.tsx`
- `src/components/MonthlyStatementEntries.tsx`
- `src/lib/monthlyStatement.ts`
- `package.json`, `package-lock.json`, `src/lib/utils.ts`
- `CHANGELOG.md`, `docs/MASTER_PLAN.md`

## Segurança

Somente leitura. Nenhum documento do Firebase foi escrito ou migrado.

## Validações

- TypeScript sem erros.
- 82 testes aprovados; 2 cenários de emulador ignorados sem host local.
- Build de produção concluído.
