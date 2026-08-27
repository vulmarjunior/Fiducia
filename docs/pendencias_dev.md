# Pendências de Desenvolvimento — Sessão Atual

> Documento efêmero da pauta atual. Ao concluir, transferir para `docs/archive/sessions/` e limpar este arquivo.
> **LLM:** deepseek-v4-pro | **Agente:** opencode

---

## Sessão ativa — Separação do carregamento inicial v0.15.5

**Objetivo:** reduzir e tornar cacheável o chunk principal de aproximadamente 1,2 MB sem mascarar o custo total do aplicativo.

**Escopo:** medir a composição real do bundle inicial, separar apenas dependências estáveis com fronteiras arquiteturais claras, comparar o carregamento antes/depois e validar autenticação, Dashboard e PWA.

**Estado:** implementação concluída localmente; aguardando publicação e validação.

> **LLM:** deepseek-v4-pro | **Agente:** opencode
