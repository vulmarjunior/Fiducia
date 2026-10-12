import { describe, expect, it } from 'vitest';
import { getClosedInvoiceBlock, isPeriodClosed } from './utils';

const cards = [{ id: 'card-1', name: 'C6', closingDay: 30, dueDay: 10 }];
const invoices = [{ id: 'inv-10', cardId: 'card-1', period: '2026-10', status: 'fechada' }];

describe('isPeriodClosed para cartões', () => {
  it('bloqueia lançamento legado sem invoicePeriod pela fatura derivada da data', () => {
    expect(isPeriodClosed('2026-09-27', 'card-1', cards, invoices, [])).toBe(true);
    expect(isPeriodClosed('2026-09-27', 'card-1', cards, invoices, [], '')).toBe(true);
  });

  it('libera lançamento movido para fatura aberta mesmo com data caindo em fatura fechada', () => {
    expect(isPeriodClosed('2026-09-27', 'card-1', cards, invoices, [], '2026-11')).toBe(false);
  });

  it('bloqueia quando o próprio invoicePeriod aponta para fatura fechada', () => {
    expect(isPeriodClosed('2026-09-27', 'card-1', cards, invoices, [], '2026-10')).toBe(true);
  });

  it('bloqueia faturas pagas e parciais do invoicePeriod', () => {
    const paga = [{ id: 'inv-11', cardId: 'card-1', period: '2026-11', status: 'paga' }];
    const parcial = [{ id: 'inv-11', cardId: 'card-1', period: '2026-11', status: 'parcial' }];
    expect(isPeriodClosed('2026-09-27', 'card-1', cards, paga, [], '2026-11')).toBe(true);
    expect(isPeriodClosed('2026-09-27', 'card-1', cards, parcial, [], '2026-11')).toBe(true);
  });

  it('não bloqueia período sem documento de fatura', () => {
    expect(isPeriodClosed('2026-09-27', 'card-1', cards, [], [])).toBe(false);
  });

  it('mantém bloqueio por closedPeriods em contas comuns, ignorando invoicePeriod', () => {
    const closedPeriods = [{ accountId: 'acc-1', period: '2026-09' }];
    expect(isPeriodClosed('2026-09-27', 'acc-1', cards, invoices, closedPeriods)).toBe(true);
    expect(isPeriodClosed('2026-09-27', 'acc-1', cards, invoices, closedPeriods, '2026-11')).toBe(true);
  });
});

describe('getClosedInvoiceBlock', () => {
  it('retorna cartão e período bloqueadores para a mensagem', () => {
    expect(getClosedInvoiceBlock('2026-09-27', 'card-1', cards, invoices, [])).toEqual({
      cardId: 'card-1',
      cardName: 'C6',
      period: '2026-10',
    });
  });

  it('retorna null quando o lançamento está em fatura aberta', () => {
    expect(getClosedInvoiceBlock('2026-09-27', 'card-1', cards, invoices, [], '2026-11')).toBeNull();
  });

  it('retorna período sem cartão para conta comum fechada', () => {
    const closedPeriods = [{ accountId: 'acc-1', month: '2026-09' }];
    expect(getClosedInvoiceBlock('2026-09-27', 'acc-1', cards, invoices, closedPeriods)).toEqual({ period: '2026-09' });
  });
});
