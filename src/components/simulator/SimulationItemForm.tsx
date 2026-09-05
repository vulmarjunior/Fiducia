import React, { useState } from 'react';
import { SimulatedItem, SimulationItemType } from '../../types/simulator';
import { CreditCard, Account, Category } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { MoneyInput } from '../MoneyInput';
import { Plus, CreditCard as CardIcon, TrendingDown, TrendingUp, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface SimulationItemFormProps {
  creditCards: CreditCard[];
  accounts: Account[];
  categories: Category[];
  onAddItem: (item: SimulatedItem) => void;
}

export function SimulationItemForm({
  creditCards,
  accounts,
  categories,
  onAddItem,
}: SimulationItemFormProps) {
  const todayStr = new Date().toISOString().split('T')[0];

  const [name, setName] = useState('');
  const [type, setType] = useState<SimulationItemType>('card_expense');
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(todayStr);
  const [installments, setInstallments] = useState(1);
  const [cardId, setCardId] = useState(creditCards[0]?.id || '');
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [categoryId, setCategoryId] = useState('');
  const [recurrence, setRecurrence] = useState<'none' | 'monthly'>('none');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Informe um nome ou descrição para a hipótese.');
      return;
    }
    if (amount <= 0) {
      toast.error('Informe um valor maior que zero.');
      return;
    }
    if (!date) {
      toast.error('Informe a data de início/vencimento.');
      return;
    }

    const newItem: SimulatedItem = {
      id: `sim-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      type,
      amount,
      date,
      enabled: true,
      installments: type === 'card_expense' ? installments : undefined,
      cardId: type === 'card_expense' ? (cardId || creditCards[0]?.id) : undefined,
      accountId: type !== 'card_expense' ? (accountId || accounts[0]?.id) : undefined,
      categoryId: categoryId || undefined,
      recurrence: type !== 'card_expense' ? recurrence : 'none',
      createdAt: new Date().toISOString(),
    };

    onAddItem(newItem);
    toast.success('Hipótese adicionada à simulação!');

    // Reset form
    setName('');
    setAmount(0);
    setInstallments(1);
  };

  const installmentAmount = installments > 0 ? (amount / installments) : amount;

  return (
    <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-fiducia-blue/10 text-fiducia-blue flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-[14px] font-bold text-foreground">Adicionar Hipótese ("E se...?")</h3>
            <p className="text-[11px] text-muted-foreground">Simule despesas, receitas ou compras parceladas sem alterar seu saldo real</p>
          </div>
        </div>
      </div>

      {/* Seletor de Tipo */}
      <div className="grid grid-cols-3 gap-2 p-1 bg-secondary/50 rounded-xl border border-border">
        <button
          type="button"
          onClick={() => setType('card_expense')}
          className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
            type === 'card_expense'
              ? 'bg-background shadow-xs text-foreground font-bold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <CardIcon className="w-3.5 h-3.5 text-fiducia-blue" />
          <span>Cartão de Crédito</span>
        </button>
        <button
          type="button"
          onClick={() => setType('expense')}
          className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
            type === 'expense'
              ? 'bg-background shadow-xs text-fiducia-red font-bold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <TrendingDown className="w-3.5 h-3.5 text-fiducia-red" />
          <span>Despesa à Vista</span>
        </button>
        <button
          type="button"
          onClick={() => setType('income')}
          className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
            type === 'income'
              ? 'bg-background shadow-xs text-fiducia-green font-bold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5 text-fiducia-green" />
          <span>Receita Extra</span>
        </button>
      </div>

      {/* Grid de Campos Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            O que você quer simular?
          </Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Novo Smartphone, Troca de pneus, Bônus..."
            className="h-10 text-sm font-medium"
            required
          />
        </div>

        <div className="space-y-1.5">
          <MoneyInput
            value={amount}
            onChange={setAmount}
            label={type === 'card_expense' && installments > 1 ? 'Valor Total da Compra' : 'Valor Previsto'}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            {type === 'card_expense' ? 'Data da Compra' : 'Data Prevista'}
          </Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 text-sm font-medium"
            required
          />
        </div>
      </div>

      {/* Condicional: Configurações de Cartão de Crédito */}
      {type === 'card_expense' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3.5 rounded-xl bg-secondary/30 border border-border/70">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Cartão Utilizado
            </Label>
            <select
              value={cardId}
              onChange={(e) => setCardId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-border bg-card text-xs font-semibold outline-none"
            >
              {creditCards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (Fecha dia {c.closingDay} · Vence dia {c.dueDay})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Número de Parcelas
            </Label>
            <select
              value={installments}
              onChange={(e) => setInstallments(Number(e.target.value))}
              className="w-full h-10 px-3 rounded-lg border border-border bg-card text-xs font-semibold outline-none"
            >
              <option value={1}>1x (À vista na fatura)</option>
              {Array.from({ length: 23 }, (_, i) => i + 2).map((n) => (
                <option key={n} value={n}>
                  {n}x de R$ {(amount > 0 ? amount / n : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col justify-end">
            <div className="p-2 rounded-lg bg-card border border-border/80 text-xs">
              <span className="text-muted-foreground block text-[10px]">Impacto por fatura:</span>
              <strong className="text-foreground font-mono font-bold">
                {installments}x de R$ {installmentAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Condicional: Configurações de Conta / Recorrência (Não-cartão) */}
      {type !== 'card_expense' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-secondary/30 border border-border/70">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Conta de Movimentação
            </Label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-border bg-card text-xs font-semibold outline-none"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.type === 'checking' ? 'Corrente' : a.type === 'savings' ? 'Poupança' : a.type})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Recorrência
            </Label>
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as any)}
              className="w-full h-10 px-3 rounded-lg border border-border bg-card text-xs font-semibold outline-none"
            >
              <option value="none">Única vez (avulso)</option>
              <option value="monthly">Mensalmente (recorrente no período)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Categoria (Opcional)
            </Label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-border bg-card text-xs font-semibold outline-none"
            >
              <option value="">Sem categoria</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Botão de Envio */}
      <div className="flex justify-end pt-1">
        <Button type="submit" className="h-10 px-5 gap-2 text-xs font-bold rounded-xl shadow-xs">
          <Plus className="w-4 h-4" />
          Adicionar à Simulação
        </Button>
      </div>
    </form>
  );
}
