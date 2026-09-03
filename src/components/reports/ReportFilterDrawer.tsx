import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import type { Account, Category, CreditCard } from '../../types';
import type { PaymentStatusFilter, ReportFilters, ReportTab } from '../../types/reports';
import { Search, CheckSquare, Square, Filter, X, Calendar } from 'lucide-react';
import { getMonthBounds } from '../../lib/reports/periods';

interface ReportFilterDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeTab: ReportTab;
  filters: ReportFilters;
  onApplyFilters: (newFilters: ReportFilters) => void;
  categories: Category[];
  accounts: Account[];
  creditCards: CreditCard[];
}

export function ReportFilterDrawer({
  open,
  onOpenChange,
  activeTab,
  filters,
  onApplyFilters,
  categories,
  accounts,
  creditCards,
}: ReportFilterDrawerProps) {
  const defaultBounds = getMonthBounds(filters.selectedMonth);

  // Estado local (rascunho)
  const [periodMode, setPeriodMode] = useState<'month' | 'custom'>(
    filters.customRange ? 'custom' : 'month'
  );
  const [draftStartDate, setDraftStartDate] = useState(
    filters.customRange?.startDate || defaultBounds.startDate
  );
  const [draftEndDate, setDraftEndDate] = useState(
    filters.customRange?.endDate || defaultBounds.endDate
  );
  const [draftCategoryIds, setDraftCategoryIds] = useState<string[] | undefined>(filters.categoryIds);
  const [draftOriginIds, setDraftOriginIds] = useState<string[] | undefined>(filters.originIds);
  const [draftStatus, setDraftStatus] = useState<PaymentStatusFilter>(filters.status);
  const [draftIncludePending, setDraftIncludePending] = useState<boolean>(filters.includePending);
  const [draftIncludeSavings, setDraftIncludeSavings] = useState<boolean>(Boolean(filters.includeSavings));
  const [draftAccumulated, setDraftAccumulated] = useState<boolean>(filters.accumulated);
  const [searchCategory, setSearchCategory] = useState('');

  // Ao abrir, sincroniza o rascunho com os filtros aplicados atuais
  useEffect(() => {
    if (open) {
      const bounds = getMonthBounds(filters.selectedMonth);
      setPeriodMode(filters.customRange ? 'custom' : 'month');
      setDraftStartDate(filters.customRange?.startDate || bounds.startDate);
      setDraftEndDate(filters.customRange?.endDate || bounds.endDate);
      setDraftCategoryIds(filters.categoryIds);
      setDraftOriginIds(filters.originIds);
      setDraftStatus(filters.status);
      setDraftIncludePending(filters.includePending);
      setDraftIncludeSavings(Boolean(filters.includeSavings));
      setDraftAccumulated(filters.accumulated);
      setSearchCategory('');
    }
  }, [open, filters]);

  const isCategoryTab = activeTab === 'expenses' || activeTab === 'income';
  const relevantCategories = categories.filter(c => {
    if (activeTab === 'expenses') return c.type === 'expense';
    if (activeTab === 'income') return c.type === 'income';
    return true;
  });

  // Padrão de disponibilidade imediata: contas não-investimento (+ cartões em categorias).
  // Investimentos ficam visíveis no filtro, mas desmarcados por padrão.
  const availableAccountIds = accounts
    .filter(a => a.type !== 'investment')
    .map(a => a.id || '')
    .filter(Boolean);
  const allOrigins = isCategoryTab
    ? [...accounts.map(a => a.id || ''), ...creditCards.map(c => c.id || '')]
    : accounts.map(a => a.id || '');
  const defaultOriginIds = isCategoryTab
    ? [...availableAccountIds, ...creditCards.map(c => c.id || '')]
    : availableAccountIds;

  const filteredCategories = relevantCategories.filter(c =>
    c.name.toLowerCase().includes(searchCategory.toLowerCase())
  );

  // Toggle category
  const toggleCategory = (catId: string) => {
    setDraftCategoryIds(prev => {
      const current = prev !== undefined ? prev : relevantCategories.map(c => c.id || '');
      if (current.includes(catId)) {
        return current.filter(id => id !== catId);
      } else {
        return [...current, catId];
      }
    });
  };

  const selectAllCategories = () => {
    setDraftCategoryIds(relevantCategories.map(c => c.id || ''));
  };

  const clearCategories = () => {
    setDraftCategoryIds([]);
  };

  // Toggle origin
  const toggleOrigin = (origId: string) => {
    setDraftOriginIds(prev => {
      const current = prev !== undefined ? prev : defaultOriginIds;
      if (current.includes(origId)) {
        return current.filter(id => id !== origId);
      } else {
        return [...current, origId];
      }
    });
  };

  const selectAllOrigins = () => {
    setDraftOriginIds(allOrigins);
  };

  const clearOrigins = () => {
    setDraftOriginIds([]);
  };

  const handleApply = () => {
    const customRange =
      periodMode === 'custom' && draftStartDate && draftEndDate && draftStartDate <= draftEndDate
        ? { startDate: draftStartDate, endDate: draftEndDate }
        : undefined;

    onApplyFilters({
      ...filters,
      customRange,
      categoryIds: draftCategoryIds,
      originIds: draftOriginIds,
      status: draftStatus,
      includePending: draftIncludePending,
      includeSavings: draftIncludeSavings,
      accumulated: draftAccumulated,
    });
    onOpenChange(false);
  };

  const handleResetDefaults = () => {
    setPeriodMode('month');
    setDraftStartDate(defaultBounds.startDate);
    setDraftEndDate(defaultBounds.endDate);
    setDraftCategoryIds(undefined);
    setDraftOriginIds(undefined);
    setDraftStatus('all');
    setDraftIncludePending(false);
    setDraftIncludeSavings(false);
    setDraftAccumulated(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col p-6">
        <DialogHeader className="pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-primary" />
              <DialogTitle className="text-xl font-bold">Filtros do Relatório</DialogTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={handleResetDefaults} className="text-xs text-muted-foreground hover:text-foreground">
              Restaurar padrões
            </Button>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Ajuste os filtros e clique em Aplicar. Alterações não salvas serão descartadas ao fechar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-6 pr-1">
          {/* Período: Mês Civil vs Intervalo Personalizado */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
              Período
            </label>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                type="button"
                onClick={() => setPeriodMode('month')}
                className={`py-2 px-3 rounded-lg text-xs font-medium border transition-colors ${
                  periodMode === 'month'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:bg-muted border-border text-muted-foreground'
                }`}
              >
                Mês Civil ({filters.selectedMonth})
              </button>
              <button
                type="button"
                onClick={() => setPeriodMode('custom')}
                className={`py-2 px-3 rounded-lg text-xs font-medium border transition-colors ${
                  periodMode === 'custom'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:bg-muted border-border text-muted-foreground'
                }`}
              >
                Intervalo Personalizado
              </button>
            </div>

            {periodMode === 'custom' && (
              <div className="p-3 bg-muted/40 rounded-lg border border-border/60 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Data Inicial
                    </label>
                    <Input
                      type="date"
                      value={draftStartDate}
                      onChange={(e) => setDraftStartDate(e.target.value)}
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      Data Final
                    </label>
                    <Input
                      type="date"
                      value={draftEndDate}
                      onChange={(e) => setDraftEndDate(e.target.value)}
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                </div>
                {draftStartDate && draftEndDate && draftStartDate > draftEndDate && (
                  <p className="text-[11px] text-rose-500 font-medium">
                    A data inicial não pode ser posterior à data final.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Situação de Pagamento */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
              Situação
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDraftStatus('all')}
                className={`py-2 px-3 rounded-lg text-xs font-medium border transition-colors ${
                  draftStatus === 'all'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:bg-muted border-border text-muted-foreground'
                }`}
              >
                Todas as situações
              </button>
              <button
                type="button"
                onClick={() => setDraftStatus('paid')}
                className={`py-2 px-3 rounded-lg text-xs font-medium border transition-colors ${
                  draftStatus === 'paid'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:bg-muted border-border text-muted-foreground'
                }`}
              >
                Apenas Realizadas
              </button>
              <button
                type="button"
                onClick={() => setDraftStatus('pending')}
                className={`py-2 px-3 rounded-lg text-xs font-medium border transition-colors ${
                  draftStatus === 'pending'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:bg-muted border-border text-muted-foreground'
                }`}
              >
                Apenas Pendentes
              </button>
            </div>
            {isCategoryTab && (
              <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
                Para compras de cartão, a situação segue a fatura (quitada, a quitar ou parcial; parcial conta como a quitar).
                Os valores representam <strong>compras</strong>, não o saldo a pagar da fatura.
              </p>
            )}
          </div>

          {/* Opções de Fluxo (apenas para cashflow e accounts) */}
          {!isCategoryTab && (
            <div className="p-3 bg-muted/40 rounded-lg space-y-3 border border-border/60">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                Comportamento de Caixa
              </label>
              <div className="flex items-center justify-between text-xs">
                <div>
                  <span className="font-medium text-foreground block">Incluir compromissos pendentes</span>
                  <span className="text-muted-foreground">Simula os compromissos futuros sobre a base de saldo</span>
                </div>
                <input
                  type="checkbox"
                  checked={draftIncludePending}
                  onChange={e => setDraftIncludePending(e.target.checked)}
                  className="w-4 h-4 rounded text-primary focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-between text-xs pt-2 border-t border-border/40">
                <div>
                  <span className="font-medium text-foreground block">Incluir Reservas e Investimentos</span>
                  <span className="text-muted-foreground">Incorpora contas de reserva/investimento no saldo e nas movimentações</span>
                </div>
                <input
                  type="checkbox"
                  checked={draftIncludeSavings}
                  onChange={e => setDraftIncludeSavings(e.target.checked)}
                  className="w-4 h-4 rounded text-primary focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-between text-xs pt-2 border-t border-border/40">
                <div>
                  <span className="font-medium text-foreground block">Visão Acumulada</span>
                  <span className="text-muted-foreground">Acumula entradas e saídas desde o início do período</span>
                </div>
                <input
                  type="checkbox"
                  checked={draftAccumulated}
                  onChange={e => setDraftAccumulated(e.target.checked)}
                  className="w-4 h-4 rounded text-primary focus:ring-primary"
                />
              </div>
            </div>
          )}

          {/* Origens (Contas e Cartões) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Origem ({isCategoryTab ? 'Contas e Cartões' : 'Contas Bancárias'})
              </label>
              <div className="flex items-center gap-2 text-xs">
                <button type="button" onClick={selectAllOrigins} className="text-primary hover:underline">
                  Todas
                </button>
                <span className="text-muted-foreground">•</span>
                <button type="button" onClick={clearOrigins} className="text-muted-foreground hover:underline">
                  Limpar
                </button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mb-2 leading-relaxed">
              Por padrão, contas de <strong>investimento</strong> ficam fora do saldo por não terem disponibilidade imediata. Marque-as se quiser incluí-las.
            </p>

            <div className="space-y-2 border border-border rounded-lg p-3 max-h-48 overflow-y-auto">
              {accounts.length > 0 && (
                <div>
                  <span className="text-[11px] font-semibold text-muted-foreground block mb-1">Contas</span>
                  <div className="space-y-1">
                    {accounts.map(acc => {
                      const id = acc.id || '';
                      const isSelected = draftOriginIds === undefined ? defaultOriginIds.includes(id) : draftOriginIds.includes(id);
                      return (
                        <div
                          key={id}
                          onClick={() => toggleOrigin(id)}
                          className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50 cursor-pointer text-xs"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-primary shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-muted-foreground shrink-0" />
                          )}
                          <span className="truncate">{acc.name}</span>
                          {acc.type === 'investment' && (
                            <span className="ml-auto text-[10px] text-muted-foreground shrink-0">Investimento</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {isCategoryTab && creditCards.length > 0 && (
                <div className="pt-2 border-t border-border/40">
                  <span className="text-[11px] font-semibold text-muted-foreground block mb-1">Cartões de Crédito</span>
                  <div className="space-y-1">
                    {creditCards.map(card => {
                      const id = card.id || '';
                      const isSelected = draftOriginIds === undefined ? defaultOriginIds.includes(id) : draftOriginIds.includes(id);
                      return (
                        <div
                          key={id}
                          onClick={() => toggleOrigin(id)}
                          className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50 cursor-pointer text-xs"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-primary shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-muted-foreground shrink-0" />
                          )}
                          <span className="truncate">{card.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Categorias (apenas para despesas e receitas) */}
          {isCategoryTab && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Categorias
                </label>
                <div className="flex items-center gap-2 text-xs">
                  <button type="button" onClick={selectAllCategories} className="text-primary hover:underline">
                    Todas
                  </button>
                  <span className="text-muted-foreground">•</span>
                  <button type="button" onClick={clearCategories} className="text-muted-foreground hover:underline">
                    Limpar
                  </button>
                </div>
              </div>

              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Buscar categoria..."
                  value={searchCategory}
                  onChange={e => setSearchCategory(e.target.value)}
                  className="pl-8 text-xs h-8"
                />
              </div>

              <div className="space-y-1 border border-border rounded-lg p-3 max-h-56 overflow-y-auto">
                {filteredCategories.length === 0 ? (
                  <div className="py-4 text-center text-xs text-muted-foreground">
                    Nenhuma categoria encontrada
                  </div>
                ) : (
                  filteredCategories.map(cat => {
                    const id = cat.id || '';
                    const isSelected = draftCategoryIds === undefined || draftCategoryIds.includes(id);
                    return (
                      <div
                        key={id}
                        onClick={() => toggleCategory(id)}
                        className={`flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50 cursor-pointer text-xs ${
                          cat.parentId ? 'pl-6 text-muted-foreground' : 'font-medium'
                        }`}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-primary shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                        <span className="truncate">{cat.name}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleApply}>
            Aplicar Filtros
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
