# Pendencias de Desenvolvimento - Sessao Atual

> Documento efemero da pauta atual. Ao concluir, transferir para `docs/archive/sessions/` e limpar este arquivo.
> **LLM:** deepseek-v4-pro | **Agente:** opencode

---

## Sessao em andamento - Períodos Civis na Projeção Futura + Análise

### Objetivo

Análise profunda do funcionamento da Projeção Futura e correção dos filtros de período para usar meses civis (fim do mês) em vez de meses rolantes.

### Resultado tecnico

- Documentada análise completa da lógica do motor `buildCashCoverageProjection`:
  - Fase A: coleta de eventos (transações pendentes, faturas, recorrências)
  - Fase B: filtro de cenário (conservador/realista/projetado)
  - Fase C: simulação diária com clamp de datas passadas
  - Fase D: agregação mensal com separação banco vs cartão
  - Fase E: KPIs agregados
- Corrigido `projPeriod` e `projEndDate`: filtros agora usam último dia do mês civil.
  - `'30d'` (novo): today + 30 dias rolantes
  - `'nextMonth'` (novo): último dia do mês seguinte
  - `'3months'`: último dia do 3º mês seguinte
  - `'6months'` / `'12months'`: idem
- Identificada raiz do falso positivo: janela de 1 mês rolante (13/07→13/08) era curta demais para enxergar evento de 15/08.

### Arquivos tocados

- `src/pages/Reports.tsx` — State `projPeriod`, `projEndDate`, labels, PageHelp
- `package.json` — Versão 0.6.0 → 0.6.1
- `src/lib/utils.ts` — APP_VERSION 0.6.0 → 0.6.1
- `CHANGELOG.md` — Entry 0.6.1
- `docs/MASTER_PLAN.md` — Versão, entregas, última alteração

### Validacoes

- `npm run lint` — Sem erros
- `npm run test` — 54/54 passando

### Pendencias antes de release

- Build de produção (não executado nesta sessão; confirmação visual pendente)
