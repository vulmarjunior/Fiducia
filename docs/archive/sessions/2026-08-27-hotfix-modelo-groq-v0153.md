# Sessão — Hotfix do modelo Groq v0.15.3

> **LLM:** deepseek-v4-pro | **Agente:** opencode

## Objetivo

Restaurar e validar em produção todos os recursos de IA sob demanda após a descontinuação do modelo `llama-3.3-70b-versatile` no plano gratuito/desenvolvedor da Groq.

## Resultado

- Modelo central migrado para `openai/gpt-oss-120b`.
- Extração e análise de faturas passaram a herdar o modelo central, sem identificadores duplicados.
- Proxy alinhado à API atual por meio de `max_completion_tokens` e `include_reasoning: false`.
- Observabilidade do proxy ampliada sem registrar prompts nem dados financeiros.
- Regras do Firestore republicadas sem o aviso de função não utilizada.
- Dashboard permaneceu sem a dica financeira automática, conforme decisão do proprietário.

## Publicação

- Commits de código: `367e29b` e `b7b767c`.
- Vercel: `dpl_GmruDoAPH4NyiM8pZdWegrvKLVvx`, alvo `production`, estado `Ready`.
- Firestore: regras compiladas e publicadas no banco nomeado do projeto.

## Validações

- TypeScript: aprovado.
- Vitest: 90 testes aprovados; 3 cenários do emulador ignorados localmente.
- Build Vite/PWA: aprovado, com aviso conhecido de chunks maiores que 500 kB.
- Produção autenticada: Relatórios → IA respondeu e `/api/groq` registrou HTTP 200.
- GitHub Actions: workflow `CI` da `main` em estado `passing`.

## Pendências

- Monitorar os recursos Groq sob demanda após a troca de modelo.
- Avaliar code splitting do pacote compartilhado de ícones em sessão própria.

> **LLM:** deepseek-v4-pro | **Agente:** opencode
