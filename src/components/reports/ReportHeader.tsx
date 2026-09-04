import React, { useState } from 'react';
import { ReportPeriodSelector } from './ReportPeriodSelector';
import { getMonthBounds } from '../../lib/reports/periods';
import { useReportingPeriod } from '../../contexts/ReportingPeriodContext';
import { Button } from '../ui/button';
import type { ReportFilters, ReportIntervalType } from '../../types/reports';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Filter,
  FileSpreadsheet,
  FileText,
  RotateCcw,
  X,
  ChevronsUpDown,
  Clock,
  Shield,
  TrendingUp,
} from 'lucide-react';

interface ReportHeaderProps {
  filters: ReportFilters;
  onFilterChange: (newFilters: ReportFilters) => void;
  onOpenFilterDrawer: () => void;
  onExportCsv: () => void;
  onExportPdf?: () => void;
  showIntervalSelector?: boolean;
  showQuickToggles?: boolean;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function ReportHeader({
  filters,
  onFilterChange,
  onOpenFilterDrawer,
  onExportCsv,
  onExportPdf,
  showIntervalSelector = true,
  showQuickToggles = true,
}: ReportHeaderProps) {
  const { selectedMonth, setSelectedMonth, resetToCurrentMonth } = useReportingPeriod();
  const [showFilterSummary, setShowFilterSummary] = useState(false);

  const [yearStr, mStr] = selectedMonth.split('-');
  const year = parseInt(yearStr, 10);
  const monthIdx = parseInt(mStr, 10) - 1;
  const monthName = MONTH_NAMES[monthIdx] || '';

  const formatIsoToBr = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  const statusLabel = filters.status === 'all'
    ? 'Todas as situações'
    : filters.status === 'paid'
      ? 'Apenas realizadas'
      : 'Apenas pendentes';

  const summaryItems: string[] = [];
  if (filters.customRange) {
    summaryItems.push(`Intervalo: ${formatIsoToBr(filters.customRange.startDate)} a ${formatIsoToBr(filters.customRange.endDate)}`);
  } else {
    summaryItems.push(`Mês: ${monthName} ${year}`);
  }
  summaryItems.push(`Situação: ${statusLabel}`);
  if (filters.categoryIds !== undefined) {
    summaryItems.push(filters.categoryIds.length === 0 ? 'Categorias: nenhuma selecionada' : `Categorias: ${filters.categoryIds.length} selecionada(s)`);
  }
  if (filters.originIds !== undefined) {
    summaryItems.push(filters.originIds.length === 0 ? 'Origens: nenhuma selecionada' : `Origens: ${filters.originIds.length} selecionada(s)`);
  }
  if (filters.includePending) summaryItems.push('Inclui pendentes');
  if (filters.includeSavings) summaryItems.push('Inclui reservas');
  if (filters.accumulated) summaryItems.push('Evolução líquida ativada');

  const handleClearCustomRange = () => {
    onFilterChange({ ...filters, customRange: undefined });
  };

  const handlePrevMonth = () => {
    let y = year;
    let m = monthIdx - 1;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
    const newMonth = `${y}-${String(m + 1).padStart(2, '0')}`;
    setSelectedMonth(newMonth);
    onFilterChange({ ...filters, selectedMonth: newMonth, customRange: undefined });
  };

  const handleNextMonth = () => {
    let y = year;
    let m = monthIdx + 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
    const newMonth = `${y}-${String(m + 1).padStart(2, '0')}`;
    setSelectedMonth(newMonth);
    onFilterChange({ ...filters, selectedMonth: newMonth, customRange: undefined });
  };

  const handleCurrentMonth = () => {
    resetToCurrentMonth();
    const now = new Date();
    const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    onFilterChange({ ...filters, selectedMonth: cur, customRange: undefined });
  };

  // Contagem de filtros ativos (além do padrão)
  let activeFilterCount = 0;
  if (filters.status !== 'all') activeFilterCount += 1;
  if (filters.categoryIds !== undefined) activeFilterCount += 1;
  if (filters.originIds !== undefined) activeFilterCount += 1;
  if (filters.includePending) activeFilterCount += 1;
  if (filters.includeSavings) activeFilterCount += 1;
  if (filters.accumulated) activeFilterCount += 1;
  if (filters.customRange) activeFilterCount += 1;

  const setIntervalType = (intervalType: ReportIntervalType) => {
    onFilterChange({ ...filters, intervalType });
  };

  return (
    <div className="flex flex-wrap items-start md:items-center justify-between gap-4 py-3 border-b border-border mb-6">
      {/* Navegação mensal ou Intervalo Personalizado */}
      <div className="flex items-center gap-2 flex-wrap">
        <ReportPeriodSelector
          range={filters.customRange ?? getMonthBounds(filters.selectedMonth)}
          onChange={customRange => onFilterChange({ ...filters, customRange })}
        />
        {!filters.customRange && <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={handlePrevMonth} aria-label="Mês anterior"><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={handleNextMonth} aria-label="Próximo mês"><ChevronRight className="h-4 w-4" /></Button>
        </div>}
        <Button variant="outline" size="sm" onClick={filters.customRange ? handleClearCustomRange : handleCurrentMonth}>
          {filters.customRange ? 'Voltar ao mês selecionado' : 'Mês atual'}
        </Button>
      </div>

      {/* Controles de agrupamento, filtros e exportações */}
      <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-between md:justify-end">
        {showIntervalSelector && (
          <div className="flex items-center bg-muted/60 p-1 rounded-lg border border-border text-xs">
            <span className="px-2 text-muted-foreground">Agrupar por</span>
            <button
              type="button"
              onClick={() => setIntervalType('day')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filters.intervalType === 'day'
                  ? 'bg-background font-semibold text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Dia
            </button>
            <button
              type="button"
              onClick={() => setIntervalType('week')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filters.intervalType === 'week'
                  ? 'bg-background font-semibold text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Semana
            </button>
            <button
              type="button"
              onClick={() => setIntervalType('month')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filters.intervalType === 'month'
                  ? 'bg-background font-semibold text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Mês
            </button>
          </div>
        )}

        {/* Toggles Rápidos de Caixa (Pendentes, Reservas, Acumulado) */}
        {showQuickToggles && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Toggle Pendentes */}
            <button
              type="button"
              onClick={() => onFilterChange({ ...filters, includePending: !filters.includePending })}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                filters.includePending
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-bold'
                  : 'bg-card border-border text-muted-foreground hover:text-foreground'
              }`}
              title="Alternar inclusão de pendências e faturas futuras previstas"
            >
              <Clock className={`w-3.5 h-3.5 ${filters.includePending ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`} />
              <span>Pendentes</span>
            </button>

            {/* Toggle Reservas */}
            <button
              type="button"
              onClick={() => onFilterChange({ ...filters, includeSavings: !filters.includeSavings })}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                filters.includeSavings
                  ? 'bg-blue-500/15 border-blue-500/40 text-blue-700 dark:text-blue-300 font-bold'
                  : 'bg-card border-border text-muted-foreground hover:text-foreground'
              }`}
              title="Alternar entre apenas giro imediato e inclusão de reservas/investimentos"
            >
              <Shield className={`w-3.5 h-3.5 ${filters.includeSavings ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}`} />
              <span>Reservas</span>
            </button>

            {/* Toggle Acumulado */}
            <button
              type="button"
              onClick={() => onFilterChange({ ...filters, accumulated: !filters.accumulated })}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                filters.accumulated
                  ? 'bg-purple-500/15 border-purple-500/40 text-purple-700 dark:text-purple-300 font-bold'
                  : 'bg-card border-border text-muted-foreground hover:text-foreground'
              }`}
              title="Mostrar a diferença acumulada entre entradas e saídas desde o início do período"
            >
              <TrendingUp className={`w-3.5 h-3.5 ${filters.accumulated ? 'text-purple-600 dark:text-purple-400' : 'text-muted-foreground'}`} />
              <span>Evolução líquida</span>
            </button>
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={onOpenFilterDrawer}
          className="h-9 relative text-xs flex items-center gap-1.5"
        >
          <Filter className="w-3.5 h-3.5 text-primary" />
          <span>Filtros</span>
          {activeFilterCount > 0 && (
            <span className="ml-1 bg-primary text-primary-foreground text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
              {activeFilterCount}
            </span>
          )}
        </Button>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={onExportCsv}
            className="h-9 text-xs text-muted-foreground hover:text-foreground"
            title="Exportar CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            CSV
          </Button>

          {onExportPdf && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExportPdf}
              className="h-9 text-xs text-muted-foreground hover:text-foreground"
              title="Exportar PDF"
            >
              <FileText className="w-3.5 h-3.5 mr-1 text-rose-600" />
              PDF
            </Button>
          )}
        </div>
      </div>

      {/* Resumo visível dos filtros aplicados */}
      {summaryItems.length > 0 && (
        <div className="w-full flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-3 mt-1">
          <button
            type="button"
            onClick={() => setShowFilterSummary(s => !s)}
            className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
            title={showFilterSummary ? 'Recolher resumo' : 'Expandir resumo'}
          >
            <ChevronsUpDown className="w-3.5 h-3.5" />
            Filtros aplicados
          </button>
          {!showFilterSummary && summaryItems.slice(0, 3).map(item => (
            <span key={item} className="text-[11px] bg-muted/60 text-muted-foreground border border-border rounded-full px-2 py-0.5">
              {item}
            </span>
          ))}
          {showFilterSummary && summaryItems.map(item => (
            <span key={item} className="text-[11px] bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5">
              {item}
            </span>
          ))}
          {summaryItems.length > 3 && !showFilterSummary && (
            <span className="text-[11px] text-muted-foreground">+{summaryItems.length - 3}</span>
          )}
        </div>
      )}
    </div>
  );
}
