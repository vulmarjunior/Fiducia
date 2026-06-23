# Plano — Análise Inteligente com Groq

> **LLM:** deepseek-v4-pro | **Agente:** opencode

---

## Objetivo

Melhorar o uso da Groq no Fiducia para que ela deixe de gerar dicas genéricas e passe a interpretar os dados calculados pelo sistema: cobertura de caixa, faturas, categorias, tendências e datas críticas.

---

## Fase 1 — Definir Papel da IA

A Groq não deve calcular saldos, faturas ou projeções. Isso fica com o Fiducia.

A IA deve:

- interpretar resultados;
- explicar causas;
- priorizar riscos;
- sugerir ações;
- gerar resumo em português claro.

**Entrega:**

- Regra documentada: "IA interpreta, sistema calcula".

---

## Fase 2 — Criar Pacote Estruturado de Dados

Criar uma função, por exemplo:

```ts
buildFinancialInsightContext()
```

Ela deve reunir:

- cobertura de caixa;
- menor saldo projetado;
- primeira data de risco;
- total a receber;
- total de obrigações;
- faturas abertas, fechadas e futuras;
- maiores cartões;
- categorias que mais pesam;
- evolução dos últimos meses;
- datas críticas.

**Entrega:**

- Objeto JSON enxuto e auditável para enviar à Groq.
- Limite de dados para evitar prompt grande demais.

---

## Fase 3 — Novo Prompt da Groq

Substituir o prompt genérico atual por um prompt fixo e mais rigoroso.

Formato esperado da resposta:

```text
1. Diagnóstico principal
2. Datas críticas
3. Principais causas
4. Riscos se nada mudar
5. Ações recomendadas por impacto
```

Regras do prompt:

- não inventar dados;
- não recalcular valores;
- citar valores e datas do contexto;
- ser específico;
- evitar conselhos genéricos;
- se não houver risco, explicar a folga;
- se houver risco, apontar o primeiro dia crítico.

**Entrega:**

- Novo prompt em função dedicada, por exemplo `buildGroqFinancialAnalysisPrompt()`.

---

## Fase 4 — Integrar com Motores Internos

A análise deve usar primeiro:

- `cashCoverage.ts`;
- futuro `invoiceAnalysis.ts`;
- dados de categorias;
- fluxo de caixa mensal;
- orçamentos, se disponível.

**Entrega:**

- A IA recebe dados processados, não lista bruta gigante de transações.

---

## Fase 5 — Nova UI de Análise Inteligente

Melhorar a aba "Análise IA" em `/reports`.

Ela deve mostrar:

- contexto usado na análise;
- botão "Gerar análise inteligente";
- estado de carregamento;
- análise em blocos;
- aviso de que os cálculos vêm do Fiducia e a IA apenas interpreta.

**Entrega:**

- Aba mais útil, com resposta estruturada.

---

## Fase 6 — Testes

Testar funções puras:

- contexto enviado;
- prompt gerado;
- ausência de dados sensíveis desnecessários;
- limite de transações/categorias;
- comportamento quando não há dados suficientes.

**Entrega:**

- Testes unitários para o construtor de contexto e prompt.

---

## Fase 7 — Documentação

Atualizar:

- `docs/calculo_metricas.md`;
- `docs/MASTER_PLAN.md`;
- `CHANGELOG.md`, se houver entrega;
- `docs/pendencias_dev.md`.

Registrar decisão arquitetural:

> A Groq interpreta dados calculados pelo Fiducia. Ela não é fonte de verdade dos cálculos financeiros.

---

## Resultado Esperado

A Groq deve deixar de responder algo como:

> "Controle seus gastos e economize mais."

E passar a responder algo como:

> "Seu menor saldo projetado é R$ 800 em 08/08. A pressão vem da fatura fechada do cartão Nubank de R$ 3.400, vencendo antes da receita principal de 10/08. A ação de maior impacto é reservar R$ 1.200 até 05/08 ou negociar o vencimento da fatura."
