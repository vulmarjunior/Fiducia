export interface ReportDateRange { startDate: string; endDate: string }

export const historicalPresets = [
  ['today', 'Hoje'], ['week', 'Esta semana'], ['month', 'Este mês'],
  ['3months', 'Últimos 3 meses'], ['6months', 'Últimos 6 meses'],
  ['12months', 'Últimos 12 meses'], ['year', 'Este ano'],
] as const;
export const futurePresets = [
  ['week', 'Até o fim da semana'], ['month', 'Até o fim do mês'],
  ['30d', 'Próximos 30 dias'], ['60d', 'Próximos 60 dias'],
  ['90d', 'Próximos 90 dias'], ['6months', 'Próximos 6 meses'],
  ['12months', 'Próximos 12 meses'],
] as const;

export function localDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Historical month/year shortcuts run through today; weeks start on Monday. */
export function resolvePeriodPreset(key: string, future = false, now = new Date()): ReportDateRange {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  if (future) {
    if (key === 'week') end.setDate(end.getDate() + (7 - end.getDay()) % 7);
    else if (key === 'month') end.setMonth(end.getMonth() + 1, 0);
    else if (key.endsWith('months')) {
      const target = new Date(start.getFullYear(), start.getMonth() + parseInt(key, 10), 1);
      const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
      end.setFullYear(target.getFullYear(), target.getMonth(), Math.min(start.getDate(), lastDay));
      end.setDate(end.getDate() - 1);
    } else end.setDate(end.getDate() + parseInt(key, 10) - 1);
  } else {
    if (key === 'week') start.setDate(start.getDate() - (start.getDay() + 6) % 7);
    else if (key === 'month') start.setDate(1);
    else if (key === 'year') start.setMonth(0, 1);
    else if (key.endsWith('months')) start.setMonth(start.getMonth() - parseInt(key, 10) + 1, 1);
  }
  return { startDate: localDateString(start), endDate: localDateString(end) };
}
