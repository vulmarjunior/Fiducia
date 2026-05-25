import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function calculateInvoicePeriod(dateInput: string | Date, closingDay: number, dueDay: number) {
  // Parse date safely, assuming local timezone if YYYY-MM-DD
  let d: Date;
  if (typeof dateInput === 'string') {
    const datePart = dateInput.split('T')[0];
    d = new Date(datePart + 'T12:00:00');
  } else {
    d = dateInput;
  }
  const day = d.getDate();
  let month = d.getMonth();
  let year = d.getFullYear();

  // If purchase is strictly AFTER closing day, it goes to the NEXT closing cycle
  if (day > closingDay) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  // Now we have the closing month/year.
  // Does the due date fall in the same month as the closing date, or the next month?
  // Usually, if dueDay <= closingDay, the due date is in the NEXT month.
  // Example: Closes 25, Due 05 -> Due is next month.
  // Example: Closes 10, Due 20 -> Due is same month.
  if (dueDay <= closingDay) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  return `${year}-${(month + 1).toString().padStart(2, '0')}`;
}

export function getPreviousPeriod(period: string) {
  const [year, month] = period.split('-').map(Number);
  let prevMonth = month - 1;
  let prevYear = year;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear--;
  }
  return `${prevYear}-${prevMonth.toString().padStart(2, '0')}`;
}

export function getNextPeriod(period: string) {
  const [year, month] = period.split('-').map(Number);
  let nextMonth = month + 1;
  let nextYear = year;
  if (nextMonth === 13) {
    nextMonth = 1;
    nextYear++;
  }
  return `${nextYear}-${nextMonth.toString().padStart(2, '0')}`;
}

export function resolveAccountName(accountId: string | undefined, accounts: any[], creditCards: any[]) {
  if (!accountId) return 'Desconhecida';
  const account = accounts.find(a => a.id === accountId);
  if (account) return account.name;
  const card = creditCards.find(c => c.id === accountId);
  if (card) return card.name;
  return 'Desconhecida';
}
