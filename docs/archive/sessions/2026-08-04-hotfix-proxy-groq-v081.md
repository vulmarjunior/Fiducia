# Sessão — Hotfix Proxy Groq v0.8.1

> **LLM:** deepseek-v4-pro | **Agente:** opencode

O teste pós-deploy detectou HTTP 500 no carregamento da função. A importação do JSON de configuração Firebase foi removida do runtime serverless. A API key pública do projeto Firebase passou a ser constante da função, sem relação com o segredo Groq.

Validação final esperada: chamada sem Firebase ID token retorna HTTP 401.