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
});
