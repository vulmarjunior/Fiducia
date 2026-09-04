import { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { futurePresets, historicalPresets, resolvePeriodPreset, type ReportDateRange } from '../../lib/reports/periodPresets';
import { getMonthBounds } from '../../lib/reports/periods';

interface Props {
  range: ReportDateRange;
  onChange: (range: ReportDateRange, preset?: string) => void;
  future?: boolean;
  monthly?: boolean;
}

export function ReportPeriodSelector({ range, onChange, future = false, monthly = false }: Props) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [draft, setDraft] = useState(range);
  const format = (value: string) => value.split('-').reverse().join('/');
  const valid = Boolean(draft.startDate && draft.endDate && draft.startDate <= draft.endDate);
  const apply = (value: ReportDateRange, preset?: string) => {
    onChange(monthly ? { startDate: getMonthBounds(value.startDate.slice(0, 7)).startDate, endDate: getMonthBounds(value.endDate.slice(0, 7)).endDate } : value, preset);
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={value => { setOpen(value); if (value) { setDraft(range); setCustom(false); } }}>
      <PopoverTrigger className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground" aria-label="Escolher período do relatório">
        <Calendar className="h-4 w-4 text-primary" />
        <span>{format(range.startDate)} a {format(range.endDate)}</span>
        <ChevronDown className="h-4 w-4" />
      </PopoverTrigger>
      <PopoverContent align="start" className="max-w-[calc(100vw-2rem)]">
        <p className="px-2 text-xs text-muted-foreground">{monthly ? 'Meses completos de competência' : future ? 'Projeção a partir de hoje' : 'Atalhos até hoje, incluindo o mês atual'}</p>
        {(future ? futurePresets : historicalPresets).filter(([key]) => !monthly || (key !== 'today' && key !== 'week')).map(([key, label]) => (
          <button type="button" key={key} className="rounded-md px-2 py-1.5 text-left hover:bg-muted focus-visible:bg-muted" onClick={() => apply(resolvePeriodPreset(key, future), key)}>{label}</button>
        ))}
        <button type="button" className="rounded-md px-2 py-1.5 text-left hover:bg-muted" onClick={() => setCustom(true)}>Escolher período…</button>
        {custom && <div className="space-y-3 border-t border-border pt-3">
          {!future && <label className="block text-xs">De<input aria-label="Data inicial" type="date" value={draft.startDate} max={draft.endDate} onChange={e => setDraft({ ...draft, startDate: e.target.value })} className="mt-1 block w-full rounded border border-border bg-background p-2" /></label>}
          <label className="block text-xs">Até<input aria-label="Data final" type="date" value={draft.endDate} min={draft.startDate} onChange={e => setDraft({ ...draft, endDate: e.target.value })} className="mt-1 block w-full rounded border border-border bg-background p-2" /></label>
          {!valid && <p role="alert" className="text-xs text-destructive">Informe uma data final igual ou posterior à inicial.</p>}
          <button type="button" disabled={!valid} className="rounded-md bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50" onClick={() => apply(draft)}>Aplicar período</button>
        </div>}
      </PopoverContent>
    </Popover>
  );
}
