import React, { createContext, useCallback, useContext, useState } from 'react';

const getCurrentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};
const isMonth = (value: string | null): value is string => !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
interface ReportingPeriodContextValue { selectedMonth: string; setSelectedMonth: (month: string) => void; resetToCurrentMonth: () => void; }
const ReportingPeriodContext = createContext<ReportingPeriodContextValue | null>(null);
export function ReportingPeriodProvider({ children }: { children: React.ReactNode }) {
  const [selectedMonth, setMonth] = useState(() => { const stored = localStorage.getItem('fiducia_reportingMonth'); return isMonth(stored) ? stored : getCurrentMonth(); });
  const setSelectedMonth = useCallback((month: string) => { if (!isMonth(month)) return; localStorage.setItem('fiducia_reportingMonth', month); setMonth(month); }, []);
  const resetToCurrentMonth = useCallback(() => setSelectedMonth(getCurrentMonth()), [setSelectedMonth]);
  return <ReportingPeriodContext.Provider value={{ selectedMonth, setSelectedMonth, resetToCurrentMonth }}>{children}</ReportingPeriodContext.Provider>;
}
export function useReportingPeriod() { const context = useContext(ReportingPeriodContext); if (!context) throw new Error('useReportingPeriod deve ser usado dentro de ReportingPeriodProvider'); return context; }