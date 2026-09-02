import React from 'react';
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
} from 'lucide-react';

interface ReportHeaderProps {
  filters: ReportFilters;
  onFilterChange: (newFilters: ReportFilters) => void;
  onOpenFilterDrawer: () => void;
  onExportCsv: () => void;
  onExportPdf?: () => void;
  showIntervalSelector?: boolean;
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
}: ReportHeaderProps) {
  const { selectedMonth, setSelectedMonth, resetToCurrentMonth } = useReportingPeriod();

  const [yearStr, mStr] = selectedMonth.split('-');
  const year = parseInt(yearStr, 10);
  const monthIdx = parseInt(mStr, 10) - 1;
  const monthName = MONTH_NAMES[monthIdx] || '';

  const formatIsoToBr = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

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

  // Contagem de filtros ativos
  let activeFilterCount = 0;
  if (filters.status !== 'all') activeFilterCount += 1;
  if (filters.categoryIds !== undefined) activeFilterCount += 1;
  if (filters.originIds !== undefined) activeFilterCount += 1;
  if (filters.includePending) activeFilterCount += 1;
  if (filters.accumulated) activeFilterCount += 1;
  if (filters.customRange) activeFilterCount += 1;

  const setIntervalType = (intervalType: ReportIntervalType) => {
    onFilterChange({ ...filters, intervalType });
  };

  return (
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 py-3 border-b border-border mb-6">
      {/* Navegação mensal ou Intervalo Personalizado */}
      <div className="flex items-center gap-2 flex-wrap">
        {filters.customRange ? (
          <div className="flex items-center bg-primary/10 border border-primary/30 rounded-lg px-3 py-1.5 gap-2 text-xs font-semibold text-primary shadow-xs">
            <Calendar className="w-4 h-4" />
            <span>
              Intervalo: {formatIsoToBr(filters.customRange.startDate)} a {formatIsoToBr(filters.customRange.endDate)}
            </span>
            <button
              type="button"
              onClick={handleClearCustomRange}
              className="ml-1 p-0.5 rounded-full hover:bg-primary/20 text-primary transition-colors cursor-pointer"
              title="Voltar ao mês civil"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center bg-card border border-border rounded-lg p-1 shadow-xs">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevMonth}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title="Mês anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <div className="px-3 flex items-center gap-1.5 font-semibold text-sm min-w-[140px] justify-center text-foreground">
                <Calendar className="w-4 h-4 text-primary" />
                <span>{monthName} {year}</span>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleNextMonth}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title="Próximo mês"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleCurrentMonth}
              className="h-9 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Mês atual
            </Button>
          </>
        )}
      </div>

      {/* Controles de agrupamento, filtros e exportações */}
      <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-between md:justify-end">
        {showIntervalSelector && (
          <div className="flex items-center bg-muted/60 p-1 rounded-lg border border-border text-xs">
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
    </div>
  );
}
