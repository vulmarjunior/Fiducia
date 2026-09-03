import { describe, expect, it } from 'vitest';
import { getMonthBounds, generateBuckets, getMonthsInRange } from './periods';

describe('periods', () => {
  it('getMonthBounds retorna o primeiro e último dia do mês', () => {
    const bounds = getMonthBounds('2026-08');
    expect(bounds.startDate).toBe('2026-08-01');
    expect(bounds.endDate).toBe('2026-08-31');
  });

  it('getMonthsInRange enumera corretamente intervalos no mesmo mês', () => {
    const months = getMonthsInRange('2026-08-05', '2026-08-25');
    expect(months).toEqual(['2026-08']);
  });

  it('getMonthsInRange enumera múltiplos meses quando o intervalo atravessa meses', () => {
    const months = getMonthsInRange('2026-06-20', '2026-09-10');
    expect(months).toEqual(['2026-06', '2026-07', '2026-08', '2026-09']);
  });

  it('getMonthsInRange funciona na virada de ano', () => {
    const months = getMonthsInRange('2026-11-15', '2027-02-10');
    expect(months).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
  });

  it('generateBuckets gera buckets diários para o intervalo customizado', () => {
    const buckets = generateBuckets('2026-08-01', '2026-08-03', 'day');
    expect(buckets).toHaveLength(3);
    expect(buckets[0].key).toBe('2026-08-01');
    expect(buckets[2].key).toBe('2026-08-03');
  });

  it('fevereiro bissexto: último dia 29 e limites inclusivos', () => {
    const bounds = getMonthBounds('2028-02');
    expect(bounds.endDate).toBe('2028-02-29');
    const buckets = generateBuckets('2028-02-01', '2028-02-29', 'day');
    expect(buckets).toHaveLength(29);
  });

  it('ISO com horário e último dia do mês: limites locais inclusivos', () => {
    // O motor normaliza datas cortando o horário; o bucket diário deve cobrir 31/12
    const buckets = generateBuckets('2026-12-01', '2026-12-31', 'day');
    expect(buckets.at(-1)?.key).toBe('2026-12-31');
    expect(buckets).toHaveLength(31);
  });

  it('semana atravessando mês: soma só os dias do intervalo, sem duplicar dias', () => {
    // 2026-08-31 é segunda-feira e 2026-09-06 é domingo — semana completa dentro do intervalo
    const buckets = generateBuckets('2026-08-31', '2026-09-06', 'week');
    expect(buckets).toHaveLength(1);
    expect(buckets[0].startDate).toBe('2026-08-31');
    expect(buckets[0].endDate).toBe('2026-09-06');

    // Semana recortada: intervalo termina em quarta-feira (02/09)
    const trimmed = generateBuckets('2026-08-31', '2026-09-02', 'week');
    expect(trimmed).toHaveLength(1);
    expect(trimmed[0].startDate).toBe('2026-08-31');
    expect(trimmed[0].endDate).toBe('2026-09-02');

    // Nenhum dia pode entrar em dois grupos: soma das semanas = soma dos dias
    const days = generateBuckets('2026-08-01', '2026-09-15', 'day');
    const weeks = generateBuckets('2026-08-01', '2026-09-15', 'week');
    const daysCovered = days.reduce((s, b) => s + 1, 0);
    const weeksCovered = weeks.reduce((s, b) => {
      const [sy, sm, sd] = b.startDate.split('-').map(Number);
      const [ey, em, ed] = b.endDate.split('-').map(Number);
      return s + (new Date(ey, em - 1, ed).getTime() - new Date(sy, sm - 1, sd).getTime()) / 86400000 + 1;
    }, 0);
    expect(weeksCovered).toBe(daysCovered);
  });
});
