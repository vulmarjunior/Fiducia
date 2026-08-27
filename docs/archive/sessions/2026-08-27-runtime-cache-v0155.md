# Sessão — Runtime inicial com cache estável v0.15.5

**Data:** 27/08/2026
**Versão:** 0.15.5

## Objetivo

Reduzir o entry de aproximadamente 1,2 MB e impedir que alterações pequenas no aplicativo invalidem novamente as dependências estáveis, sem esconder o custo real do Firebase.

## Diagnóstico

A análise por sourcemap mostrou que o arquivo inicial era dominado por Firestore, Auth, React DOM, React Router e Base UI. O código local representava apenas uma parcela pequena do artefato.

## Entrega

- Criadas fronteiras explícitas de build para `firebase-runtime`, `react-runtime` e `ui-runtime`.
- Mantidos pacotes específicos de páginas nos carregamentos lazy correspondentes.
- Adicionados testes da classificação, inclusive para caminhos Windows e para impedir a inclusão de `react-select` no runtime inicial.
- Atualizada a versão oficial para 0.15.5.

## Resultado medido

- Entry: 1.228,28 kB para 52,18 kB, redução de 95,8%.
- Runtimes estáveis: Firebase 773,66 kB; React 237,09 kB; UI 269,17 kB.
- Precache PWA: 3.985,86 KiB para 3.978,18 KiB.
- Os hashes dos três runtimes permaneceram iguais após a alteração isolada da versão do aplicativo.
- Trade-off aceito: cerca de 32,8 kB gzip adicionais no primeiro carregamento por perda de compressão cruzada, em troca de paralelismo e de evitar baixar novamente aproximadamente 356 kB gzip em atualizações comuns.

## Validações

- `npm run lint` — aprovado.
- `npm run test -- --maxWorkers=1` — 101 testes aprovados e 3 cenários de emulador ignorados localmente.
- `npm run build` — aprovado, sem ciclos entre chunks.
- Deploy Vercel `dpl_9MNEGtgBxsZYEhHRJoxeXmVkStyo` — `READY` em produção.
- Produção autenticada — v0.15.5 confirmada no Dashboard, em Contas e em Relatórios; runtimes separados presentes; console e logs sem erros.
- GitHub Actions — CI aprovado.

## Próximo passo

Ampliar a verificação automatizada de interface nos fluxos críticos, mantendo Firebase e o modelo de proprietário único atuais.

> **LLM:** deepseek-v4-pro | **Agente:** opencode
