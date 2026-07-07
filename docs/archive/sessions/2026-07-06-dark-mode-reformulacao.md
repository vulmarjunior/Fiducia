# Sessão: Reformulação Completa do Dark Mode (v0.3.4)

> **LLM:** deepseek-v4-pro | **Agente:** opencode
> **Data:** 2026-07-06

---

## Objetivo

Reformular o dark mode para unificar o padrão de contraste em todas as telas do sistema, usando paleta alinhada ao degrade da logo (emerald → cyan → blue).

## Diagnóstico

Análise completa de todas as 14 telas revelou 3 problemas-raiz:

1. **Border invisível:** `--border-color` (#334155) idêntico a `--surface2` (#334155) — bordas desapareciam
2. **`bg-white` sem dark variant:** ~17 ocorrências em CreditCards.tsx (inputs, cards, toggles, tabelas)
3. **Cores hardcoded sem consistência:** ~84 ocorrências de `text-{color}-{shade}`, 48% sem `dark:` correspondente

## Resultado

Dark mode inteiramente refatorado com paleta navy profundo (`#0a101c` / `#131c2e` / `#1c2944`). Raiz do problema resolvida: `--border-color` agora difere de `--surface2` (`#2d3d5c` vs `#1c2944`). Contraste WCAG AA garantido em todos os textos (mínimo 4.5:1). ~65 pontos de correção em 14 arquivos.

### Nova paleta dark mode

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
| `--chart-4` | `--fiducia-red` | `--fiducia-purple` |
| `--chart-5` | `--text-muted` | `--fiducia-red` |

## Arquivos tocados

| Arquivo | Ação | Pontos |
|---------|------|--------|
| `src/index.css` | Editado — Bloco `.dark` refatorado | Fundação |
| `src/pages/CreditCards.tsx` | Editado | 18 correções |
| `src/pages/Reconciliation.tsx` | Editado | 3 correções |
| `src/pages/Reports.tsx` | Editado | 5 correções |
| `src/pages/Audit.tsx` | Editado | 2 correções |
| `src/pages/Categories.tsx` | Editado | 1 correção |
| `src/pages/Accounts.tsx` | Editado | 2 correções |
| `src/pages/Dashboard.tsx` | Editado | 2 correções |
| `src/pages/Login.tsx` | Editado | 2 correções |
| `src/components/TransactionDialog.tsx` | Editado | 6 correções (modais) |
| `src/components/ConfirmDialog.tsx` | Editado | 2 correções |
| `src/components/PdfImportReviewDialog.tsx` | Editado | 3 correções |
| `src/components/Layout.tsx` | Editado | 1 correção |
| `src/components/ui/sonner.tsx` | Editado | 1 correção |
| `package.json` | Editado — v0.3.4 | — |
| `src/lib/utils.ts` | Editado — `APP_VERSION` | — |
| `CHANGELOG.md` | Editado — entrada v0.3.4 | — |
| `docs/MASTER_PLAN.md` | Editado — versão | — |

## Decisões arquiteturais

> **Paleta dark mode unificada:** Fundo navy profundo (`#0a101c`) com superfícies em azul-escuro escalonadas (`#131c2e` / `#1c2944`). Bordas sempre visíveis com `#2d3d5c` (nunca iguais a `surface2`). Cores fiducia-* mantêm tom 400 no dark mode com backgrounds translúcidos (12% opacity). Ring e sidebar-primary usam `--fiducia-blue` como cor de destaque, substituindo o neutro `--text-primary`.

> **Regra de contraste para botões:** Botões com `text-white` sobre fundo colorido devem sempre incluir `dark:text-background` para manter legibilidade com a nova paleta onde `--primary` mapeia para `--text-primary` (quase branco).

> **Ícones em gradientes:** Ícones sobre o gradiente brand (`from-emerald-400 via-cyan-400 to-blue-500`) usam `dark:text-[#0a101c]` para contraste com o fundo claro do gradiente.

## Validações

- `npm run lint` — ✅ Sem erros
- `npm run build` — ✅ Build OK (7.9s)
- Revisão manual — 14 telas com dark mode unificado
