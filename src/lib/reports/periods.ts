import type { ReportIntervalType } from '../../types/reports';

export interface DateBucket {
  key: string;
  label: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export function getMonthBounds(monthStr: string): { startDate: string; endDate: string } {
  const [yearStr, mStr] = monthStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(mStr, 10); // 1-12
  const lastDay = new Date(year, month, 0).getDate();
  const startDate = `${yearStr}-${mStr.padStart(2, '0')}-01`;
  const endDate = `${yearStr}-${mStr.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { startDate, endDate };
}

function formatDateBR(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${d}/${m}`;
}

export function generateBuckets(
  startDate: string,
  endDate: string,
  intervalType: ReportIntervalType
): DateBucket[] {
  const buckets: DateBucket[] = [];
  const [startY, startM, startD] = startDate.split('-').map(Number);
  const [endY, endM, endD] = endDate.split('-').map(Number);

  const start = new Date(startY, startM - 1, startD);
  const end = new Date(endY, endM - 1, endD);

  if (intervalType === 'day') {
    const current = new Date(start);
    while (current <= end) {
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, '0');
      const d = String(current.getDate()).padStart(2, '0');
      const key = `${y}-${m}-${d}`;
      buckets.push({
        key,
        label: `${d}/${m}`,
        startDate: key,
        endDate: key,
      });
      current.setDate(current.getDate() + 1);
    }
    return buckets;
  }

  if (intervalType === 'week') {
    // Semanas começam na segunda-feira (1) e terminam no domingo (0)
    // Recortadas nos limites do intervalo
    let current = new Date(start);
    while (current <= end) {
      const weekStartStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
      
      // Encontra o próximo domingo ou o fim do intervalo
      const dayOfWeek = current.getDay(); // 0 = domingo, 1 = segunda, ..., 6 = sábado
      const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
      
      const weekEnd = new Date(current);
      weekEnd.setDate(weekEnd.getDate() + daysUntilSunday);
      
      const actualEnd = weekEnd > end ? new Date(end) : weekEnd;
      const weekEndStr = `${actualEnd.getFullYear()}-${String(actualEnd.getMonth() + 1).padStart(2, '0')}-${String(actualEnd.getDate()).padStart(2, '0')}`;
      
      const key = `${weekStartStr}_${weekEndStr}`;
      const label = weekStartStr === weekEndStr 
        ? formatDateBR(weekStartStr)
        : `${formatDateBR(weekStartStr)} a ${formatDateBR(weekEndStr)}`;

      buckets.push({
        key,
        label,
        startDate: weekStartStr,
        endDate: weekEndStr,
      });

      // Avança para o dia seguinte ao fim da semana
      const nextDay = new Date(actualEnd);
      nextDay.setDate(nextDay.getDate() + 1);
      current = nextDay;
    }
    return buckets;
  }

  if (intervalType === 'month') {
    let current = new Date(start.getFullYear(), start.getMonth(), 1);
    const lastMonthDate = new Date(end.getFullYear(), end.getMonth(), 1);

    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    while (current <= lastMonthDate) {
      const y = current.getFullYear();
      const m = current.getMonth(); // 0-11
      const mStr = String(m + 1).padStart(2, '0');
      const key = `${y}-${mStr}`;
      
      // Início é o maior entre dia 1 e start
      const monthStart = `${y}-${mStr}-01`;
      const actualStart = monthStart < startDate ? startDate : monthStart;
      
      // Fim é o menor entre último dia do mês e end
      const lastDayNum = new Date(y, m + 1, 0).getDate();
      const monthEnd = `${y}-${mStr}-${String(lastDayNum).padStart(2, '0')}`;
      const actualEnd = monthEnd > endDate ? endDate : monthEnd;

      buckets.push({
        key,
        label: `${monthNames[m]}/${String(y).slice(2)}`,
        startDate: actualStart,
        endDate: actualEnd,
      });

      current.setMonth(current.getMonth() + 1);
    }
    return buckets;
  }

  return buckets;
}
