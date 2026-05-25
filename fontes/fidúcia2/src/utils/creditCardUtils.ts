export function getInvoicePeriod(
  purchaseDate: Date,
  closingDay: number
): string {
  const day = purchaseDate.getDate();
  const month = purchaseDate.getMonth(); // 0-based
  const year = purchaseDate.getFullYear();

  if (day <= closingDay) {
    // A compra está dentro do período que ainda não fechou: fatura do mês atual
    const invoiceMonth = month + 1; // converte para 1-based
    return `${year}-${String(invoiceMonth).padStart(2, '0')}`;
  } else {
    // A compra caiu após o corte: vai para a fatura do próximo mês
    let invoiceMonth = month + 2; // mês seguinte, 1-based
    let invoiceYear = year;
    if (invoiceMonth > 12) {
      invoiceMonth = 1;
      invoiceYear += 1;
    }
    return `${invoiceYear}-${String(invoiceMonth).padStart(2, '0')}`;
  }
}

export function getInvoiceStatus(
  invoicePeriod: string, // "YYYY-MM"
  closingDay: number,
  dueDay: number,
  today: Date
): 'aberta' | 'fechada' | 'paga' {
  const [year, month] = invoicePeriod.split('-').map(Number);

  // Data em que esta fatura fechou
  const closingDate = new Date(year, month - 1, closingDay);

  // Data de vencimento (pagamento) desta fatura
  // O vencimento ocorre no mês seguinte ao fechamento
  let dueMonth = month;
  let dueYear = year;
  if (dueDay <= closingDay) {
    // Vencimento cai no mês seguinte ao período da fatura
    dueMonth += 1;
    if (dueMonth > 12) { dueMonth = 1; dueYear += 1; }
  }
  const dueDate = new Date(dueYear, dueMonth - 1, dueDay);

  if (today < closingDate) return 'aberta';     // ainda acumulando compras
  if (today < dueDate) return 'fechada';        // fechou, ainda não venceu
  return 'paga';                                // vencimento já passou
}
