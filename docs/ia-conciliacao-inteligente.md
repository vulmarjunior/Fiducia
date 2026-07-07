# Conciliação Inteligente com IA

> **STATUS: IMPLEMENTADO em v0.3.x** — Todas as funcionalidades descritas neste documento foram implementadas em `src/pages/Reconciliation.tsx` (AI Auto-Match via `handleAiAutoMatch`, AI Análise de Divergências via `handleAiAnalysis`). Este documento é mantido como referência da especificação original.

## Objetivo
Aprimorar a página de Conciliação (`src/pages/Reconciliation.tsx`) com inteligência artificial para:
1. Matching automático por similaridade de descrição (não só valor exato)
2. Detecção de divergências entre extrato bancário e lançamentos do sistema

## Pré-requisitos
- `src/services/groqService.ts` já existe com `callGroq(messages, options)`
- `src/pages/Reconciliation.tsx` já implementa conciliação manual + `autoReconcile()` básico

---

## Funcionalidade 1: AI Auto-Match

### O que faz
Botão "✨ Auto-Conciliar com IA" que envia as transações importadas + do sistema para a Groq.
A IA infere correspondências mesmo quando:
- Descrições diferentes para o mesmo gasto ("UBER TRIP" vs "Uber")
- Diferença de centavos (R$ 49,99 vs R$ 50,00)
- Datas próximas mas não exatas

### Implementação

**Estado a adicionar** (após `isUploading`):
```tsx
const [isAiMatching, setIsAiMatching] = useState(false);
const [aiMatchSuggestions, setAiMatchSuggestions] = useState<Record<string, string> | null>(null);
```

**Função `handleAiAutoMatch`:**
```tsx
const handleAiAutoMatch = async () => {
  if (importedTransactions.length === 0 || systemTransactions.length === 0) return;
  setIsAiMatching(true);
  try {
    const pendingImported = importedTransactions.filter(t => t.status === 'pending');
    const unmatchedSystem = systemTransactions.filter(t => !importedTransactions.some(imp => imp.matchedWithSystemId === t.id));

    const prompt = `Você é um assistente de conciliação financeira. Faça o match entre as transações do banco (importadas) e as transações do sistema.

Regras:
- Mesmo valor é evidência forte, mas diferenças de centavos podem existir
- Similaridade de descrição é evidência forte
- Proximidade de data (até 5 dias) ajuda
- Cada transação só pode ter um match
- NÃO invente matches — se não houver correspondência, não inclua

Responda APENAS com um array JSON, sem formatação markdown:
[{"importedId": "id_importado", "systemId": "id_sistema", "confidence": 0.95}]

Transações importadas (banco):
${JSON.stringify(pendingImported.map(t => ({ id: t.id, desc: t.description, amount: t.amount, date: t.date.split('T')[0], type: t.type })))}

Transações do sistema:
${JSON.stringify(unmatchedSystem.map(t => ({ id: t.id, desc: t.description, amount: t.amount, date: t.date.split('T')[0], type: t.type })))}`;

    const result = await callGroq([{ role: 'user', content: prompt }], { maxTokens: 1000, temperature: 0.1 });

    const matches = JSON.parse(result);
    let appliedCount = 0;

    const newImported = [...importedTransactions];
    const matchedSystemIds = new Set<string>();

    for (const match of matches) {
      if (match.confidence >= 0.7 && !matchedSystemIds.has(match.systemId)) {
        const idx = newImported.findIndex(t => t.id === match.importedId);
        if (idx !== -1 && newImported[idx].status === 'pending') {
          newImported[idx] = { ...newImported[idx], status: 'matched', matchedWithSystemId: match.systemId };
          matchedSystemIds.add(match.systemId);
          appliedCount++;
        }
      }
    }

    setImportedTransactions(newImported);
    toast.success(`IA encontrou ${matches.length} match(es). ${appliedCount} aplicado(s) automaticamente.`);

    if (matches.length > appliedCount) {
      toast.info(`${matches.length - appliedCount} match(es) com confiança baixa — verifique manualmente.`);
    }
  } catch (error) {
    console.error('AI Auto-Match error:', error);
    toast.error('Erro no auto-match com IA. Tente o auto-match padrão.');
  } finally {
    setIsAiMatching(false);
  }
};
```

**UI — Botão** (ao lado do botão "Auto Conciliar" existente):
```tsx
<Button
  onClick={handleAiAutoMatch}
  disabled={isAiMatching || importedTransactions.length === 0}
  variant="outline"
  className="gap-2"
>
  {isAiMatching ? (
    <><Loader2 className="w-4 h-4 animate-spin" /> Buscando matches...</>
  ) : (
    <><Sparkles className="w-4 h-4" /> Auto-Conciliar com IA</>
  )}
</Button>
```

---

## Funcionalidade 2: IA Análise de Divergências

### O que faz
Depois do matching (manual ou IA), analisa as transações NÃO conciliadas de ambos os lados
e gera um relatório em linguagem natural com:
- Explicações prováveis para cada divergência
- Comparação de totais (extrato vs sistema)
- Recomendação de ação

### Implementação

**Estado a adicionar:**
```tsx
const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
```

**Função `handleAiAnalysis`:**
```tsx
const handleAiAnalysis = async () => {
  if (importedTransactions.length === 0 && systemTransactions.length === 0) return;
  setIsAiAnalyzing(true);
  try {
    const unmatchedImported = importedTransactions.filter(t => t.status !== 'matched');
    const unmatchedSystem = systemTransactions.filter(
      t => !importedTransactions.some(imp => imp.matchedWithSystemId === t.id)
    );

    const bankTotal = unmatchedImported.reduce((s, t) => s + t.amount, 0);
    const sysTotal = unmatchedSystem.reduce((s, t) => s + t.amount, 0);

    const prompt = `Você é um auditor financeiro. Analise as divergências abaixo após uma conciliação.

Transações no EXTRATO BANCÁRIO sem match no sistema:
${JSON.stringify(unmatchedImported.map(t => ({ desc: t.description, amount: t.amount, date: t.date.split('T')[0] })))}

Total no extrato sem match: R$ ${bankTotal.toFixed(2)}

Transações no SISTEMA sem match no extrato:
${JSON.stringify(unmatchedSystem.map(t => ({ desc: t.description, amount: t.amount, date: t.date.split('T')[0] })))}

Total no sistema sem match: R$ ${sysTotal.toFixed(2)}

Forneça:
1. Possíveis explicações para cada divergência
2. Comparação dos totais
3. Recomendação curta

Responda em Português, máximo 3 parágrafos curtos, tom profissional.`;

    const analysis = await callGroq([{ role: 'user', content: prompt }], { maxTokens: 500 });
    setAiAnalysis(analysis);
  } catch (error) {
    console.error('AI Analysis error:', error);
    toast.error('Erro ao gerar análise de divergências.');
  } finally {
    setIsAiAnalyzing(false);
  }
};
```

**UI — Botão + Card de resultado** (após a tabela de transações):
```tsx
{/* AI Analysis */}
<div className="flex gap-2">
  <Button
    onClick={handleAiAnalysis}
    disabled={isAiAnalyzing || (importedTransactions.filter(t => t.status === 'matched').length === 0)}
    variant="outline"
    className="gap-2"
  >
    {isAiAnalyzing ? (
      <><Loader2 className="w-4 h-4 animate-spin" /> Analisando...</>
    ) : (
      <><Sparkles className="w-4 h-4" /> Analisar Divergências com IA</>
    )}
  </Button>
</div>

{aiAnalysis && (
  <div className="bg-gradient-to-br from-fiducia-blue/5 via-transparent to-emerald-500/5 border border-border/60 rounded-2xl p-5 mt-4">
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 via-cyan-400 to-blue-500 flex items-center justify-center shrink-0">
        <FileText className="w-4 h-4 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
          Análise de Divergências IA
        </div>
        <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
          {aiAnalysis}
        </div>
      </div>
    </div>
  </div>
)}
```

**Imports necessários** (já existem ou adicionar):
```tsx
import { Sparkles, Loader2 } from 'lucide-react'; // adicionar
import { callGroq } from '../services/groqService'; // adicionar
```

---

## Consumo de Requisições

| Funcionalidade | Reqs | Quando |
|---|---|---|
| AI Auto-Match | 1 | Por clique no botão (uma vez por sessão) |
| AI Análise | 1 | Por clique no botão (após matching) |
| **Total** | **2 por conciliação** | |

---

## Arquivos Alterados

| Arquivo | Alterações |
|---|---|
| `src/pages/Reconciliation.tsx` | +2 estados, +2 funções, +2 botões, +1 card de resultado |
| `src/services/groqService.ts` | Já existe, sem alterações |

---

## Fluxo do Usuário

1. Abre Conciliação → seleciona conta
2. Faz upload do OFX/CSV do banco
3. Clica **"✨ Auto-Conciliar com IA"** → matches são aplicados automaticamente
4. Revisa matches com confiança baixa (se houver) manualmente
5. Clica **"✨ Analisar Divergências com IA"** → vê relatório do que sobrou
6. Finaliza conciliação (funcionalidade existente, inalterada)
