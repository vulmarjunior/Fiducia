---
name: dev-log
description: Documentação automática de descobertas técnicas durante desenvolvimento. Gera e mantém um dev-log.md por projeto que pode ser injetado em outras IAs como contexto.
compatibility: opencode
metadata:
  audience: developer
  language: pt-BR
---

# Dev Log Skill

1. Detecção de Projeto
Identificar o projeto ativo
Analise o contexto da conversa para identificar o projeto:

Nome explícito: usuário menciona "no cftvdemand", "no ERP", "no portaria remota", etc.
Stack/arquivos: menção de arquivos, rotas, componentes específicos de um projeto
Contexto acumulado: projeto discutido nos últimos turnos da conversa

Se não conseguir identificar o projeto com confiança, pergunte uma vez:

"Qual projeto devo registrar isso? (ex: cftvdemand, portaria-remota, oceano-tec...)"

Após identificado, mantenha durante toda a sessão sem perguntar novamente.
Caminho do arquivo
dev-log.md  (na raiz do projeto — instrua o usuário a colocar lá)
Se o usuário não tiver o arquivo ainda, crie do zero com a estrutura completa.

2. Estrutura do dev-log.md
markdown# Dev Log — [Nome do Projeto]

> Documentação viva de descobertas técnicas. Atualizada automaticamente durante o desenvolvimento.
> **Stack**: [tecnologias principais]
> **Última atualização**: [data]

---

## ✅ O que Funciona

### [Categoria — ex: Autenticação, RTSP, Migrations]

#### [Título curto da descoberta]
- **Status**: ✅ Confirmado
- **Data**: YYYY-MM-DD
- **Contexto**: [o que estava sendo feito quando foi descoberto]
- **Solução**: [o que exatamente funciona, com código se relevante]
- **Observações**: [nuances importantes, versões, condições]

---

## ❌ O que Não Funciona

### [Categoria]

#### [Título curto]
- **Status**: ❌ Confirmado que falha
- **Data**: YYYY-MM-DD
- **Contexto**: [o que foi tentado]
- **Problema**: [por que falha / mensagem de erro]
- **Alternativa conhecida**: [se houver — ou "nenhuma ainda"]

---

## 🔄 Correções de Registro

> Entradas que mudaram de status ou onde houve engano anterior.

#### [Título]
- **Antes**: [o que estava registrado]
- **Depois**: [o que é correto]
- **Data da correção**: YYYY-MM-DD
- **Motivo**: [por que mudou — erro de Claude, teste adicional, mudança de versão, etc.]

---

## 💡 Padrões Descobertos

> Regras reutilizáveis descobertas durante o desenvolvimento. Alta densidade de valor para injetar em outras IAs.

#### [Nome do padrão]
- **Regra**: [enunciado direto e reutilizável]
- **Aplica-se a**: [contexto/componente/lib]
- **Exemplo**: [código ou caso concreto se útil]
- **Fonte**: [de onde veio — teste, doc, erro em produção]

---

## 📋 Decisões de Arquitetura

> Escolhas feitas e por quê. Evita reabrir discussões já resolvidas.

#### [Decisão]
- **Escolha**: [o que foi decidido]
- **Alternativas rejeitadas**: [o que foi descartado e por quê]
- **Data**: YYYY-MM-DD

---

## ⚠️ Armadilhas Conhecidas (Gotchas)

> Comportamentos contraintuitivos que vão te pegar de surpresa.

- **[Lib/API/Ferramenta]**: [descrição do comportamento inesperado e como evitar]

3. Lógica de Atualização
Gatilhos e ações
SituaçãoSeção afetadaAçãoUsuário confirma que funcionou✅ FuncionaAdicionar ou confirmar entradaUsuário confirma que não funcionou❌ Não FuncionaAdicionar entrada com contexto do erroClaude afirmou que funcionava, usuário nega🔄 Correções + mover entradaMover de ✅ para ❌, registrar correçãoUsuário descobre que algo que "não funcionava" na verdade funciona🔄 Correções + mover entradaMover de ❌ para ✅, registrar correçãoPadrão reutilizável identificado💡 PadrõesAdicionar como regra enunciadaDecisão de arquitetura tomada📋 DecisõesRegistrar com alternativas rejeitadasComportamento inesperado de lib/API⚠️ GotchasRegistrar como aviso
Regras de escrita

Seja específico: não "autenticação funciona" — "JWT com RS256 funciona; HS256 falha com erro de chave inválida no Fastify v4.x"
Inclua código quando a solução tem sintaxe não-óbvia
Categorize por subsistema (Auth, DB, RTSP, UI, Deploy, etc.) para facilitar busca
Data sempre: use a data real da conversa
Padrões > eventos: quando possível, converta uma descoberta pontual em uma regra geral na seção 💡

Quando NÃO registrar

Confirmações triviais ("a variável está certa", "o typo foi corrigido")
Comportamentos óbvios da linguagem/framework sem nuance
Coisas que o usuário já sabia e só estava confirmando retoricamente


4. Como Apresentar a Atualização
Após detectar um gatilho e atualizar (ou criar) o arquivo, informe brevemente:

📝 Dev log atualizado — registrei em dev-log.md > ✅ Funciona > Auth: "JWT RS256 com Fastify funciona com plugin @fastify/jwt v8+"

Mantenha o aviso curto — não interrompa o fluxo da conversa com detalhes longos. Se for uma correção, destaque:

📝 Dev log corrigido — o registro anterior estava errado. Movi "X" de ✅ para ❌ e documentei o motivo.


5. Injeção em Outras IAs
Quando o usuário pedir para preparar o log para injetar em outra IA, adicione este bloco no topo do arquivo gerado:
markdown## INSTRUÇÃO PARA IA

Este arquivo é a documentação técnica viva do projeto [Nome].
Ao gerar código ou sugerir soluções:
1. Consulte ✅ Funciona antes de sugerir alternativas — prefira o que já foi validado
2. Evite abordagens listadas em ❌ Não Funciona, a menos que o contexto mudou
3. Respeite as decisões em 📋 Decisões de Arquitetura — não reabra o que já foi decidido
4. Trate 💡 Padrões como regras do projeto, não sugestões
5. Considere ⚠️ Gotchas ao escrever código nas áreas afetadas

6. Comportamento de Criação vs. Atualização
Arquivo não existe ainda
Crie o dev-log.md completo com todas as seções (mesmo que vazias) e adicione a primeira entrada. Informe o usuário:

"Criei o dev-log.md para o projeto [X]. Salve na raiz do repositório."

Arquivo já existe (usuário colar o conteúdo)
Leia o conteúdo atual, localize a seção correta, insira a nova entrada mantendo o formato existente. Não reformate o arquivo inteiro — edições cirúrgicas apenas.
Detecção de duplicatas
Antes de adicionar, verifique se já existe entrada similar. Se sim, atualize a existente em vez de duplicar — e adicione uma nota como "Confirmado novamente em [data]".

7. Notas de Implementação

Datas: use o formato YYYY-MM-DD. Se não tiver a data exata, use a data aproximada da conversa.
Língua: escreva as entradas no mesmo idioma da conversa (pt-BR por padrão para este usuário).
Tom: técnico e direto — este documento é para desenvolvedores e IAs, não para clientes.
Versões: sempre que relevante, registre versão da lib/framework/ferramenta envolvida.
