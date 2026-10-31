# Importação e conciliação de fatura de cartão — PRD e plano de execução

> **Projeto:** fiducia
> **Status:** proposto
> **Homologação:** pendente
> **Aprovado por:** pendente
> **Planejado por:** OIKOS
> **Executor:** agente do projeto `fiducia`
> **Versão-alvo:** a definir
> **Documento:** fonte da intenção; o fato é verificado no GitHub (commits, PRs, CI, deploy)
> **Origem:** teste com a fatura Itaú final 2038 de novembro/2026 e análise do código em 31/10/2026.

## 1. Problema

Conciliar a fatura fechada do cartão com o que já foi lançado no Fiducia é
manual e pouco confiável. Cartões não fornecem OFX; o banco entrega, quando
muito, XLSX — e na maioria das vezes PDF. O fluxo atual deveria resolver isso
pelo botão **Conferir Fatura**, mas ele falha já na leitura do arquivo real:

- A planilha do Itaú tem uma capa de 13 linhas antes do cabeçalho
  (`Data | Lançamento | Parcelamento | Valor`). O leitor presume que a
  **primeira linha** é o cabeçalho, renomeia tudo para `Coluna 1..10` e não
  reconhece nenhuma coluna — resultado: **“Nenhuma linha de fatura foi
  identificada no arquivo.”**
- O fallback de IA também não salva: as datas chegam como
  `Tue Oct 06 2026 00:00:00 GMT...` e os valores como `59.78` (ponto decimal,
  sem R$). O pré-parser espera `DD/MM/AAAA` e `1.234,56`; a IA recebe texto
  bruto com capa e rodapé e devolve zero linhas aproveitáveis.
- Quando a leitura funciona por outro caminho, o período gravado é derivado da
  **data da linha**, não da fatura que está sendo conferida. Uma parcela com
  data de 07/11/2025, pertencente à fatura de novembro/2026, é criada na fatura
  de novembro/2025.
- Pagamentos aparecem como linhas negativas (“Pagamento Pix”) e podem ser
  tratados como crédito comum, duplicando o fluxo “Pagar Fatura”.
- O total declarado da fatura nunca é usado como prova: uma extração
  incompleta passa despercebida.

Consequência prática: o responsável pede a um agente externo para comparar o
PDF do banco com o PDF exportado do Fiducia, recebe a lista do que falta e
**lança um por um**. O sistema tem a capacidade, mas não a confiabilidade.

### Evidência do teste de 31/10/2026

Arquivo `fatura-fechada-final 2038-novembro2026.xlsx`, aba `Fatura 11-26`:

| Item | Resultado |
|---|---|
| Linhas totais / linhas de dados | 140 / 119 (linhas 14–132) |
| Cabeçalho real | linha 14 (`Data | Lançamento | Parcelamento | Valor`) |
| Datas | 07/11/2025 a 28/10/2026 |
| Parcelas | 29 linhas com “Parcela X de Y” em **coluna separada** |
| Negativos | 4: Pagamento Pix −5.000,00 e −5.425,15; redução de mensalidade −26,25; estorno Tiktok −280,42 |
| Total declarado na capa | **R$ 12.608,99** |
| Soma de todas as linhas | R$ 2.183,84 |
| Prova aritmética | 12.608,99 − 10.425,15 (os dois Pix) = 2.183,84 |

O arquivo é internamente consistente e autoverificável. O problema está no
leitor, não no arquivo.

## 2. Objetivo

Baixar a fatura do banco e arrastá-la para o Fiducia **sem limpeza manual**,
ver em uma tela o que falta lançar e o que diverge, com o total da fatura
fechando, e confirmar as ações em lote.

## 3. Não-objetivos (fora de escopo)

- Open Finance ou integração direta com APIs do banco.
- Importação por foto/screenshot da fatura.
- Alterar o fluxo de pagamento de fatura (“Pagar Fatura”) ou o modelo de saldo.
- Aplicar a conciliação sem revisão e confirmação do usuário.
- Migrar ou reescrever lançamentos legados em massa.
- Unificar o modal de lançamentos (frente separada, já diagnosticada).
- Importação de extrato bancário (OFX) — fora do problema do cartão.

## 4. Usuários e casos de uso

| Quem | O que precisa fazer | Hoje |
|---|---|---|
| Responsável | Importar a fatura XLSX do Itaú e conferir o que falta | Recebe “nenhuma linha identificada” |
| Responsável | Importar fatura apenas em PDF | Extração degradada; resultado imprevisível |
| Responsável | Tratar pagamento parcial já feito | Pagamento pode virar crédito duplicado |
| Responsável | Reconciliar parcela antiga na fatura atual | Lançamento criado no período errado |
| Responsável | Provar que a extração veio completa | Não há validação contra o total declarado |

## 5. Requisitos

### Funcionais

- **RF1 — Detectar o cabeçalho.** Varrer as primeiras ~30 linhas e localizar a
  linha que contenha, no mínimo, uma coluna de data, uma de valor e uma de
  descrição. Não presumir a primeira linha.
- **RF2 — Encerrar no rodapé.** Parar em “Subtotal”, “Total”, “Importante
  saber”, linhas vazias consecutivas ou linha sem data+valor.
- **RF3 — Ler os tipos reais.** Aceitar datas nativas da planilha, números com
  sinal, e também texto BR (`1.234,56`), parênteses, traço final e coluna D/C.
- **RF4 — Ler parcelamento em coluna própria.** Reconhecer `Parcela X de Y` e
  `X/Y` na descrição, sem perder o vínculo de parcela.
- **RF5 — Separar pagamento de composição da fatura.** Linha negativa com
  “pagamento” é liquidação, não crédito de compra: fica fora da soma da fatura
  e é conciliada com o valor já pago / fluxo “Pagar Fatura”.
- **RF6 — Usar o total declarado como âncora.** Extrair total e vencimento da
  capa; validar `soma(linhas exceto pagamentos) = total declarado` (±R$ 0,01).
  Se não bater, mostrar a diferença e **bloquear o apply**.
- **RF7 — Fatura autoritativa.** Todo lançamento criado ou corrigido durante a
  conferência recebe o `invoicePeriod` da fatura aberta na tela; a data da
  linha não sobrescreve o período. Fallback pela data apenas quando não houver
  contexto de fatura.
- **RF8 — Matching por valor, não por texto.** Valor exato + mesmo cartão +
  mesmo período é evidência forte; divergência de data é informativa (compra ×
  processamento); descrição nunca é exigida. Buscar também no período vizinho
  (±1) e oferecer **“mover para esta fatura”** em vez de “criar”.
- **RF9 — Revisão com totais e seções.** Exibir total declarado, soma
  importada, soma no Fiducia, conciliado e diferença; seções Faltando,
  Diferentes, Revisar, Créditos e Pagamentos; ações em lote.
- **RF10 — Idempotência.** Reimportar o mesmo arquivo não duplica lançamentos
  já conciliados (chave: cartão + período + data + valor + descrição
  normalizada, mais o estado de conciliação).
- **RF11 — Um único fluxo de importação.** “Importar PDF” (cria sem comparar)
  deve ser removido ou absorvido pelo “Conferir Fatura”; o usuário não pode
  escolher o caminho que duplica.

### Não funcionais

- **RNF1 — Caminho XLSX/CSV determinístico**, sem dependência de IA.
- **RNF2 — Nenhuma escrita antes do “Aplicar Conferência”.**
- **RNF3 — Fixtures anonimizadas** das faturas reais para testes de regressão.
- **RNF4 — Desempenho:** 200 linhas processadas em menos de 2 s; sem
  truncamento de 6.000/12.000 caracteres no caminho de planilha.
- **RNF5 — Privacidade:** planilha processada localmente; nenhum envio de
  fatura bruta a terceiros. IA só no fallback de PDF, com o comportamento atual.
- **RNF6 — Compatibilidade** com lançamentos e períodos legados; nenhuma
  migração destrutiva.

## 6. Entregas

| ID | Entrega | Critério de aceite (verificável) | Status | Evidência |
|---|---|---|---|---|
| E1 | Leitor robusto de XLSX/CSV: cabeçalho detectado, rodapé encerrado, tipos reais, coluna de parcela, negativos | Fixture da fatura Itaú 11/2026, sem limpeza, produz 119 linhas e soma R$ 2.183,84 (ou R$ 12.608,99 sem os pagamentos) | planejado | |
| E2 | Âncora de total: extrair total/vencimento e validar a soma | Fixture com uma linha removida mostra a diferença e não permite aplicar | planejado | |
| E3 | Pagamentos separados e conciliados com o valor pago | Os dois “Pagamento Pix” não entram na composição; fatura reconhece pagamento parcial | planejado | |
| E4 | Fatura autoritativa + ação “mover” | Linha de 07/11/2025 criada na fatura 2026-11; lançamento de mesmo valor em período vizinho oferece mover | planejado | |
| E5 | Política de matching por valor | Descrição “Mercado” × “METASUPERMERCADOPORTO VELHOBR” com mesmo valor e período casa sem criar duplicata | planejado | |
| E6 | Revisão consolidada e fluxo único | Tela mostra os cinco totais e seções; “Importar PDF” não cria mais sem comparar | planejado | |
| E7 | PDF: reconstrução geométrica das linhas + âncora de total | Fixture PDF soma o total declarado; extração incompleta bloqueia com diferença | planejado | |
| E8 | Ponte “colar lista” (opcional) | Lista markdown/CSV colada do agente externo é revisada e criada em lote | planejado | |

**Fases sugeridas:** Fase 1 = E1–E5 (caminho XLSX confiável); Fase 2 = E6
(consolidação e remoção do fluxo duplicado); Fase 3 = E7–E8 (PDF e ponte).

**Vocabulário de status:** `planejado` → `em execução` → `implementado` →
`testado` → `homologado` → `publicado`. Também `bloqueado` e `abandonado`.

**Regra:** cada transição exige evidência (commit, PR, run de CI, deploy,
homologação). Entrega sem evidência não sobe de status.

## 7. Dependências e riscos

| Item | Tipo | Impacto | Mitigação |
|---|---|---|---|
| Layout do banco muda sem aviso | Externo | Leitor quebra | Detecção por conteúdo, fixture versionada e mensagem clara de “layout não reconhecido” |
| Pagamento já registrado no fluxo “Pagar Fatura” | Produto | Dupla contagem | RF5: pagamento não entra na composição; conciliar com `paidAmount` |
| Lançamentos legados em períodos errados | Dados | “Sobrando/Faltando” falso | Busca em ±1 período e ação “mover”, com confirmação |
| Apply em produção durante o desenvolvimento | Operacional | Dados reais afetados | Testar em emulador/sandbox e com fatura de teste; nunca aplicar sem revisão |
| Fatura fechada/paga bloqueia aplicação | Regra atual | Teste interrompido | Manter bloqueio; usar fatura aberta de teste |
| PDF com layout de tabela complexo | Técnico | Extração incompleta | E7 + âncora de total bloqueante |
| Sem `.gitattributes` (LF) no projeto | Higiene | Ruído de CRLF em docs | Fora do escopo; issue própria do OIKOS |

## 8. Gates

1. **Plano aprovado** — sem aprovação, nada é implementado.
2. **Implementação** — por entrega, em branch própria.
3. **Teste** — CI verde e teste manual com fixture real anonimizada.
4. **Homologação** — aceite do usuário com a fatura do mês.
5. **Publicação** — autorização separada; deploy não é homologação.

## 9. Diário de execução (append-only)

| Data | Entrega | O que foi feito | Evidência | Desvio |
|---|---|---|---|---|
| | | | | |

## 10. Verificações do OIKOS (append-only)

| Data | Aderência | Observação |
|---|---|---|
| 2026-10-31 | plano proposto | Diagnóstico levantado a partir do arquivo real e do código da v0.20.8; nenhuma alteração de código feita |
| 2026-10-31 | teste manual | Após limpeza do XLSX, o leitor reconheceu as linhas; o matching marcou muitos lançamentos já existentes como “Faltando”, confirmando E4/E5 como prioridade |
| 2026-10-31 | lacuna de interface | Não há opção visível de crédito avulso na fatura; só “Estornar” uma despesa. O modelo aceita receita (a fatura subtrai), mas o modal esconde as abas de tipo quando a conta é cartão |
| 2026-10-31 | lacuna de modelo | A fatura não carrega saldo credor: `getInvoiceFinancialSummary` corta o total em zero. Crédito maior que a fatura é perdido e não abate a fatura seguinte; “Estornar” também não aparece em parcelas (`!t.parentId`) |

> **LLM:** deepseek-v4.1-flash | **Agente:** opencode
