# Revisão final v0.20.7

> **LLM:** deepseek-v4-pro | **Agente:** opencode

Commit revisado: 84b803e. Remoto main consultado e confirmado nesse mesmo commit. Sem alteração de código de produção nesta revisão.

## Achados

1. CreditCards.tsx:260-262: o pagamento filtra créditos por accountId, enquanto a tela aceita todos os créditos vinculados por transactionBelongsToCard. Um crédito com creditCardId correto e accountId ausente ou diferente reduz o valor exibido, mas não o total calculado no primeiro pagamento.
2. creditCardUtils.ts:88-90: fatura aberta documental sem compras é ignorada pelo limite porque o chamador fornece zero explícito. Reprodução: documento de 357,97 resulta em resumo documental de 357,97 e uso de limite zero.

## Validações

TypeScript e build aprovados; 193 testes passaram, 3 do emulador ignorados. Java não disponível no PATH. Build avisa sobre chunk maior que 500 kB. Testes temporários de investigação foram removidos após execução. A divergência de limite foi reproduzida com as funções reais. A diferença por saldo transportado foi investigada, mas não é classificada como defeito nesta revisão: accountFlow contabiliza obrigações anteriores separadamente.

## Próximo passo

Corrigir os dois achados com testes de regressão antes de considerar a revisão aprovada. Versão mantida; nenhuma nova entrega de código ou publicação nesta revisão.

## Retificação após esclarecimento do usuário

O valor 357,97 usado na revisão era uma fixture de teste, não uma fatura lida no banco. O usuário esclareceu que a obrigação antiga desse valor era um erro já tratado. O item 2 não autoriza aumentar uso de limite nem restaurar essa dívida: a mudança de fallback da v0.20.7 relaxou a proteção documentada em 2026-09-07 e deve ser reavaliada como possível regressão dos relatórios.

Consulta autenticada da aplicação v0.20.7: C6 setembro pago, restante zero; outubro C6 2954,70 e Itaú 5364,52, total residual do relatório 8319,22. Não foi observada obrigação isolada de 357,97 nem residual anterior de cartão no relatório de outubro. Existe parcela Amazon de 357,97 (5/6) na fatura C6 de outubro, que não pode ser confundida com a obrigação errada apenas pelo valor. Não houve leitura direta dos documentos Firestore nem alteração financeira.
