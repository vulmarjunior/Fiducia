import { describe, expect, it } from 'vitest';
import { buildInvoiceAnalysis } from './invoiceAnalysis';

const BASE_DATE = new Date(2026, 5, 23); // June 23, 2026

describe('buildInvoiceAnalysis', () => {
  const card1 = { id: 'card-1', name: 'Nubank', limit: 5000, closingDay: 20, dueDay: 5 };
  const card2 = { id: 'card-2', name: 'Inter', limit: 3000, closingDay: 10, dueDay: 15 };

  it('analisa uma fatura fechada a partir de transacoes e invoice persistida', () => {
    const result = buildInvoiceAnalysis({
      creditCards: [card1],
      transactions: [
        { id: 'tx-1', type: 'despesa', status: 'realizado', amount: 200, date: '2026-05-25', description: 'Mercado', accountId: 'card-1', invoicePeriod: '2026-06' },
        { id: 'tx-2', type: 'despesa', status: 'realizado', amount: 300, date: '2026-06-01', description: 'Farmacia', accountId: 'card-1', invoicePeriod: '2026-06' },
        { id: 'tx-3', type: 'transferencia', status: 'pendente', amount: 500, date: '2026-06-28', description: 'Pgto fatura', accountId: 'acc-1', destinationAccountId: 'card-1', invoicePeriod: '2026-06' },
      ],
      invoices: [
        { id: 'inv-1', cardId: 'card-1', period: '2026-06', status: 'fechada', totalAmount: 500 },
      ],
      startDate: new Date(2026, 4, 1),
      endDate: new Date(2026, 7, 31),
    });

    expect(result.summary.totalClosed).toBe(500);
    expect(result.summary.totalOpen).toBe(0);
    expect(result.summary.totalPaid).toBe(0);
    expect(result.detailList).toHaveLength(1);
    expect(result.detailList[0]).toMatchObject({
      cardId: 'card-1',
      cardName: 'Nubank',
      period: '2026-06',
      status: 'closed',
      amount: 500,
    });
  });

  it('detecta fatura paga via invoice persistida', () => {
    const result = buildInvoiceAnalysis({
      creditCards: [card1],
      transactions: [
        { id: 'tx-1', type: 'despesa', status: 'realizado', amount: 150, date: '2026-04-30', description: 'Compra', accountId: 'card-1', invoicePeriod: '2026-05' },
      ],
      invoices: [
        { id: 'inv-1', cardId: 'card-1', period: '2026-05', status: 'paga', totalAmount: 150 },
      ],
      startDate: new Date(2026, 3, 1),
      endDate: new Date(2026, 5, 31),
    });

    expect(result.summary.totalPaid).toBe(150);
    expect(result.detailList[0].status).toBe('paid');
  });

  it('calcula totais por cartao em varios meses', () => {
    const result = buildInvoiceAnalysis({
      creditCards: [card1, card2],
      transactions: [
        { id: 'tx-1', type: 'despesa', status: 'realizado', amount: 200, date: '2026-05-25', description: 'A', accountId: 'card-1', invoicePeriod: '2026-06' },
        { id: 'tx-2', type: 'despesa', status: 'realizado', amount: 300, date: '2026-06-25', description: 'B', accountId: 'card-1', invoicePeriod: '2026-07' },
        { id: 'tx-3', type: 'despesa', status: 'realizado', amount: 400, date: '2026-05-05', description: 'C', accountId: 'card-2', invoicePeriod: '2026-05' },
        { id: 'tx-4', type: 'despesa', status: 'realizado', amount: 500, date: '2026-06-05', description: 'D', accountId: 'card-2', invoicePeriod: '2026-06' },
      ],
      invoices: [],
      startDate: new Date(2026, 4, 1),
      endDate: new Date(2026, 7, 31),
    });

    expect(result.cardBreakdown).toHaveLength(2);
    const card1Data = result.cardBreakdown.find(c => c.cardId === 'card-1')!;
    const card2Data = result.cardBreakdown.find(c => c.cardId === 'card-2')!;
    expect(card1Data.total).toBe(500);
    expect(card2Data.total).toBe(900);
    expect(card1Data.pct).toBeCloseTo((500 / 1400) * 100, 1);
    expect(card2Data.pct).toBeCloseTo((900 / 1400) * 100, 1);
  });

  it('gera dados mensais para grafico de barras empilhadas', () => {
    const result = buildInvoiceAnalysis({
      creditCards: [card1, card2],
      transactions: [
        { id: 'tx-1', type: 'despesa', status: 'realizado', amount: 200, date: '2026-05-25', description: 'A', accountId: 'card-1', invoicePeriod: '2026-06' },
        { id: 'tx-2', type: 'despesa', status: 'realizado', amount: 300, date: '2026-06-05', description: 'B', accountId: 'card-2', invoicePeriod: '2026-06' },
      ],
      invoices: [],
      startDate: new Date(2026, 5, 1),
      endDate: new Date(2026, 6, 30),
    });

    const june = result.monthlyData.find(m => m.month === '2026-06')!;
    expect(june).toBeDefined();
    expect(june.total).toBe(500);
    expect(june.cards['card-1'].amount).toBe(200);
    expect(june.cards['card-2'].amount).toBe(300);
  });

  it('calcula media mensal corretamente', () => {
    const result = buildInvoiceAnalysis({
      creditCards: [card1],
      transactions: [
        { id: 'tx-1', type: 'despesa', status: 'realizado', amount: 100, date: '2026-05-25', description: 'A', accountId: 'card-1', invoicePeriod: '2026-06' },
        { id: 'tx-2', type: 'despesa', status: 'realizado', amount: 200, date: '2026-06-25', description: 'B', accountId: 'card-1', invoicePeriod: '2026-07' },
        { id: 'tx-3', type: 'despesa', status: 'realizado', amount: 300, date: '2026-07-25', description: 'C', accountId: 'card-1', invoicePeriod: '2026-08' },
      ],
      invoices: [],
      startDate: new Date(2026, 4, 1),
      endDate: new Date(2026, 8, 31),
    });

    expect(result.summary.monthlyAverage).toBe(200);
    expect(result.summary.largestInvoice).toBe(300);
  });

  it('filtra por cartao especifico', () => {
    const result = buildInvoiceAnalysis({
      creditCards: [card1, card2],
      transactions: [
        { id: 'tx-1', type: 'despesa', status: 'realizado', amount: 100, date: '2026-05-25', description: 'A', accountId: 'card-1', invoicePeriod: '2026-06' },
        { id: 'tx-2', type: 'despesa', status: 'realizado', amount: 200, date: '2026-06-05', description: 'B', accountId: 'card-2', invoicePeriod: '2026-06' },
      ],
      invoices: [],
      selectedCardId: 'card-1',
      startDate: new Date(2026, 4, 1),
      endDate: new Date(2026, 7, 31),
    });

    expect(result.cardBreakdown).toHaveLength(1);
    expect(result.cardBreakdown[0].cardId).toBe('card-1');
    expect(result.cardBreakdown[0].total).toBe(100);
    expect(result.summary.cardsCount).toBe(1);
  });

  it('filtra por status', () => {
    const result = buildInvoiceAnalysis({
      creditCards: [card1],
      transactions: [
        { id: 'tx-1', type: 'despesa', status: 'realizado', amount: 200, date: '2026-05-25', description: 'A', accountId: 'card-1', invoicePeriod: '2026-06' },
        { id: 'tx-2', type: 'despesa', status: 'realizado', amount: 300, date: '2026-04-25', description: 'B', accountId: 'card-1', invoicePeriod: '2026-05' },
      ],
      invoices: [
        { id: 'inv-1', cardId: 'card-1', period: '2026-06', status: 'fechada', totalAmount: 200 },
        { id: 'inv-2', cardId: 'card-1', period: '2026-05', status: 'paga', totalAmount: 300 },
      ],
      statusFilter: 'closed',
      startDate: new Date(2026, 3, 1),
      endDate: new Date(2026, 7, 31),
    });

    expect(result.detailList).toHaveLength(1);
    expect(result.detailList[0].status).toBe('closed');
  });

  it('inclui creditos e estornos quando includeCredits e true', () => {
    const resultWithCredits = buildInvoiceAnalysis({
      creditCards: [card1],
      transactions: [
        { id: 'tx-1', type: 'despesa', status: 'realizado', amount: 500, date: '2026-05-25', description: 'Compra', accountId: 'card-1', invoicePeriod: '2026-06' },
        { id: 'tx-2', type: 'receita', status: 'realizado', amount: 100, date: '2026-06-01', description: 'Estorno', accountId: 'card-1', invoicePeriod: '2026-06' },
      ],
      invoices: [],
      includeCredits: true,
      startDate: new Date(2026, 4, 1),
      endDate: new Date(2026, 7, 31),
    });

    const resultWithoutCredits = buildInvoiceAnalysis({
      creditCards: [card1],
      transactions: [
        { id: 'tx-1', type: 'despesa', status: 'realizado', amount: 500, date: '2026-05-25', description: 'Compra', accountId: 'card-1', invoicePeriod: '2026-06' },
        { id: 'tx-2', type: 'receita', status: 'realizado', amount: 100, date: '2026-06-01', description: 'Estorno', accountId: 'card-1', invoicePeriod: '2026-06' },
      ],
      invoices: [],
      includeCredits: false,
      startDate: new Date(2026, 4, 1),
      endDate: new Date(2026, 7, 31),
    });

    expect(resultWithCredits.detailList[0].amount).toBe(400);
    expect(resultWithoutCredits.detailList[0].amount).toBe(500);
  });

  it('detecta faturas futuras com parcelas pendentes', () => {
    const result = buildInvoiceAnalysis({
      creditCards: [card1],
      transactions: [
        { id: 'tx-1', type: 'despesa', status: 'pendente', amount: 100, date: '2026-07-25', description: 'Parcela 2/6', accountId: 'card-1', invoicePeriod: '2026-08', installmentNumber: 2, totalInstallments: 6 },
        { id: 'tx-2', type: 'despesa', status: 'pendente', amount: 100, date: '2026-08-25', description: 'Parcela 3/6', accountId: 'card-1', invoicePeriod: '2026-09', installmentNumber: 3, totalInstallments: 6 },
      ],
      invoices: [],
      startDate: new Date(2026, 5, 1),
      endDate: new Date(2026, 9, 30),
    });

    expect(result.summary.totalFuture).toBe(200);
    const futureItems = result.detailList.filter(d => d.status === 'future');
    expect(futureItems).toHaveLength(2);
    expect(futureItems[0].period).toBe('2026-08');
    expect(futureItems[1].period).toBe('2026-09');
  });

  it('calcula variacao mes a mes por cartao', () => {
    const result = buildInvoiceAnalysis({
      creditCards: [card1],
      transactions: [
        { id: 'tx-1', type: 'despesa', status: 'realizado', amount: 200, date: '2026-05-25', description: 'A', accountId: 'card-1', invoicePeriod: '2026-06' },
        { id: 'tx-2', type: 'despesa', status: 'realizado', amount: 300, date: '2026-06-25', description: 'B', accountId: 'card-1', invoicePeriod: '2026-07' },
      ],
      invoices: [],
      startDate: new Date(2026, 4, 1),
      endDate: new Date(2026, 7, 31),
    });

    const june = result.detailList.find(d => d.period === '2026-06')!;
    const july = result.detailList.find(d => d.period === '2026-07')!;
    expect(june.previousAmount).toBe(0);
    expect(june.variation).toBe(0);
    expect(july.previousAmount).toBe(200);
    expect(july.variation).toBeCloseTo(50, 1);
  });

  it('retorna arrays vazios quando nao ha dados', () => {
    const result = buildInvoiceAnalysis({
      creditCards: [],
      transactions: [],
      invoices: [],
      startDate: new Date(2026, 4, 1),
      endDate: new Date(2026, 7, 31),
    });

    expect(result.detailList).toHaveLength(0);
    expect(result.cardBreakdown).toHaveLength(0);
    expect(result.summary.totalOpen).toBe(0);
    expect(result.summary.totalClosed).toBe(0);
    expect(result.summary.totalPaid).toBe(0);
    expect(result.summary.totalFuture).toBe(0);
    expect(result.summary.largestInvoice).toBe(0);
    expect(result.summary.monthlyAverage).toBe(0);
  });

  it('atribui cores consistentes por cartao', () => {
    const result = buildInvoiceAnalysis({
      creditCards: [card1, card2],
      transactions: [
        { id: 'tx-1', type: 'despesa', status: 'realizado', amount: 100, date: '2026-05-25', description: 'A', accountId: 'card-1', invoicePeriod: '2026-06' },
        { id: 'tx-2', type: 'despesa', status: 'realizado', amount: 200, date: '2026-06-05', description: 'B', accountId: 'card-2', invoicePeriod: '2026-06' },
      ],
      invoices: [],
      startDate: new Date(2026, 4, 1),
      endDate: new Date(2026, 7, 31),
    });

    const c1 = result.cardBreakdown.find(c => c.cardId === 'card-1')!;
    const c2 = result.cardBreakdown.find(c => c.cardId === 'card-2')!;
    expect(c1.color).toBeTruthy();
    expect(c2.color).toBeTruthy();
    expect(c1.color).not.toBe(c2.color);

    const june = result.monthlyData.find(m => m.month === '2026-06')!;
    expect(june.cards['card-1'].color).toBe(c1.color);
    expect(june.cards['card-2'].color).toBe(c2.color);
  });

  it('gera dados de tendencia mensal', () => {
    const result = buildInvoiceAnalysis({
      creditCards: [card1],
      transactions: [
        { id: 'tx-1', type: 'despesa', status: 'realizado', amount: 200, date: '2026-05-25', description: 'A', accountId: 'card-1', invoicePeriod: '2026-06' },
        { id: 'tx-2', type: 'despesa', status: 'realizado', amount: 300, date: '2026-06-25', description: 'B', accountId: 'card-1', invoicePeriod: '2026-07' },
      ],
      invoices: [],
      startDate: new Date(2026, 5, 1),
      endDate: new Date(2026, 7, 31),
    });

    expect(result.trend).toHaveLength(3);
    expect(result.trend.find(t => t.month === '2026-06')!.total).toBe(200);
    expect(result.trend.find(t => t.month === '2026-07')!.total).toBe(300);
    expect(result.trend.find(t => t.month === '2026-08')!.total).toBe(0);
  });
});
