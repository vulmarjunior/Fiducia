import { describe, expect, it } from 'vitest';
import { resolvePeriodPreset } from './periodPresets';

describe('report period shortcuts', () => {
  const today = new Date(2026, 8, 4, 22);
  it('uses local dates, including today', () => {
    expect(resolvePeriodPreset('today', false, today)).toEqual({ startDate: '2026-09-04', endDate: '2026-09-04' });
    expect(resolvePeriodPreset('3months', false, today)).toEqual({ startDate: '2026-07-01', endDate: '2026-09-04' });
  });
  it('starts weeks on Monday and ends future weeks on Sunday', () => {
    expect(resolvePeriodPreset('week', false, today).startDate).toBe('2026-08-31');
    expect(resolvePeriodPreset('week', true, today).endDate).toBe('2026-09-06');
    expect(resolvePeriodPreset('week', true, new Date(2026, 8, 6)).endDate).toBe('2026-09-06');
  });
  it('handles year boundaries and leap February', () => {
    expect(resolvePeriodPreset('12months', false, new Date(2026, 0, 5)).startDate).toBe('2025-02-01');
    expect(resolvePeriodPreset('month', true, new Date(2024, 1, 2)).endDate).toBe('2024-02-29');
  });
  it('counts future days inclusively and uses calendar months', () => {
    expect(resolvePeriodPreset('30d', true, today).endDate).toBe('2026-10-03');
    expect(resolvePeriodPreset('90d', true, today).endDate).toBe('2026-12-02');
    expect(resolvePeriodPreset('6months', true, today).endDate).toBe('2027-03-03');
    expect(resolvePeriodPreset('6months', true, new Date(2026, 7, 31)).endDate).toBe('2027-02-27');
  });
});
