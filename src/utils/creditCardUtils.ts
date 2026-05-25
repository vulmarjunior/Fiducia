export function getInvoicePeriod(
  purchaseDate: Date,
  closingDay: number
): string {
  const day = purchaseDate.getDate();
  const month = purchaseDate.getMonth();
  const year = purchaseDate.getFullYear();

  if (day <= closingDay) {
    const invoiceMonth = month + 1;
    return `${year}-${String(invoiceMonth).padStart(2, '0')}`;
  } else {
    let invoiceMonth = month + 2;
    let invoiceYear = year;
    if (invoiceMonth > 12) {
      invoiceMonth = 1;
      invoiceYear += 1;
    }
    return `${invoiceYear}-${String(invoiceMonth).padStart(2, '0')}`;
  }
}

export function getInvoiceStatus(
  invoicePeriod: string,
  closingDay: number,
  dueDay: number,
  today: Date
): 'aberta' | 'fechada' | 'paga' {
  const [year, month] = invoicePeriod.split('-').map(Number);

  const closingDate = new Date(year, month - 1, closingDay);

  let dueMonth = month;
  let dueYear = year;
  if (dueDay <= closingDay) {
    dueMonth += 1;
    if (dueMonth > 12) { dueMonth = 1; dueYear += 1; }
  }
  const dueDate = new Date(dueYear, dueMonth - 1, dueDay);

  if (today < closingDate) return 'aberta';
  if (today < dueDate) return 'fechada';
  return 'paga';
}
