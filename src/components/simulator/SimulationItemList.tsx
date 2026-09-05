import React from 'react';
import { SimulatedItem } from '../../types/simulator';
import { CreditCard, Account, Category } from '../../types';
import { Switch } from '../ui/switch';
import { Button } from '../ui/button';
import { Trash2, CreditCard as CardIcon, TrendingDown, TrendingUp, Calendar, Sparkles } from 'lucide-react';

interface SimulationItemListProps {
  items: SimulatedItem[];
  creditCards: CreditCard[];
  accounts: Account[];
  categories: Category[];
  onToggleItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onClearAll: () => void;
}

export function SimulationItemList({
  items,
  creditCards,
  accounts,
  categories,
  onToggleItem,
  onDeleteItem,
  onClearAll,
}: SimulationItemListProps) {
  const fmt = (v: number) =>
    `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const fmtDate = (dStr: string) => {
    if (!dStr) return '—';
    const [y, m, d] = dStr.split('-');
    return `${d}/${m}/${y}`;
  };

  if (items.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 text-center shadow-xs">
        <Sparkles className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
        <h4 className="text-sm font-bold text-foreground">Nenhuma hipótese adicionada</h4>
        <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
          Use o formulário acima para simular compras parceladas, gastos imprevistos ou receitas extras e veja o impacto em tempo real no seu caixa.
        </p>
      </div>
    );
  }

  const activeCount = items.filter(i => i.enabled).length;

  return (
    <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-foreground">Hipóteses Ativas na Simulação</h3>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary text-secondary-foreground">
            {activeCount} de {items.length} ativas
          </span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 h-8 gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Limpar todas
        </Button>
      </div>

      <div className="divide-y divide-border">
        {items.map((item) => {
          const card = creditCards.find(c => c.id === item.cardId);
          const account = accounts.find(a => a.id === item.accountId);
          const category = categories.find(c => c.id === item.categoryId);

          return (
            <div
              key={item.id}
              className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                !item.enabled ? 'opacity-50 bg-secondary/15' : 'hover:bg-secondary/20'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="pt-0.5">
                  <Switch
                    checked={item.enabled}
                    onCheckedChange={() => onToggleItem(item.id)}
                    aria-label={`Alternar hipótese ${item.name}`}
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-foreground">{item.name}</span>

                    {item.type === 'card_expense' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-fiducia-blue/10 text-fiducia-blue border border-fiducia-blue/20">
                        <CardIcon className="w-3 h-3" />
                        {card?.name || 'Cartão'} · {item.installments || 1}x de {fmt((item.amount / (item.installments || 1)))}
                      </span>
                    )}

                    {item.type === 'expense' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-fiducia-red/10 text-fiducia-red border border-fiducia-red/20">
                        <TrendingDown className="w-3 h-3" />
                        {item.recurrence === 'monthly' ? 'Despesa Mensal' : 'Despesa à Vista'}
                        {account ? ` (${account.name})` : ''}
                      </span>
                    )}

                    {item.type === 'income' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-fiducia-green/10 text-fiducia-green border border-fiducia-green/20">
                        <TrendingUp className="w-3 h-3" />
                        {item.recurrence === 'monthly' ? 'Receita Mensal' : 'Receita Extra'}
                        {account ? ` (${account.name})` : ''}
                      </span>
                    )}

                    {category && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-secondary text-muted-foreground">
                        {category.name}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Início: {fmtDate(item.date)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4 pl-11 sm:pl-0">
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground">
                    {item.type === 'card_expense' && (item.installments || 1) > 1 ? 'Total da Compra' : 'Valor'}
                  </div>
                  <div className={`text-base font-bold font-mono ${
                    item.type === 'income' ? 'text-fiducia-green' : 'text-foreground'
                  }`}>
                    {item.type === 'income' ? '+' : '-'}{fmt(item.amount)}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDeleteItem(item.id)}
                  className="h-8 w-8 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg"
                  title="Excluir hipótese"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
