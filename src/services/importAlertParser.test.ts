import { describe, expect, it } from 'vitest';
import { parseBankAlert } from './importAlertParser';

const referenceDate = new Date(2026, 6, 7);

describe('parseBankAlert', () => {
  it('detecta compra em cartao', () => {
    const parsed = parseBankAlert('Compra aprovada no cartao final 1234 em MERCADO CENTRAL no valor de R$ 84,90 em 07/07.', referenceDate);

    expect(parsed.type).toBe('card_expense');
    expect(parsed.amount).toBe(84.9);
    expect(parsed.cardLastDigits).toBe('1234');
    expect(parsed.merchant).toBe('MERCADO CENTRAL');
    expect(parsed.date).toBe('2026-07-07');
    expect(parsed.confidence).toBeGreaterThan(0.7);
  });

  it('detecta pix recebido', () => {
    const parsed = parseBankAlert('Pix recebido de JOAO SILVA no valor de R$ 150,00.', referenceDate);

    expect(parsed.type).toBe('income');
    expect(parsed.amount).toBe(150);
    expect(parsed.date).toBe('2026-07-07');
  });

  it('detecta pix enviado', () => {
    const parsed = parseBankAlert('Pix enviado para MARIA no valor de R$ 45,50 em 06/07/2026.', referenceDate);

    expect(parsed.type).toBe('expense');
    expect(parsed.amount).toBe(45.5);
    expect(parsed.date).toBe('2026-07-06');
  });

  it('detecta compra parcelada', () => {
    const parsed = parseBankAlert('Compra aprovada em 10x no cartao final 9876. Valor R$ 120,00 em LOJA EXEMPLO.', referenceDate);

    expect(parsed.type).toBe('card_expense');
    expect(parsed.amount).toBe(120);
    expect(parsed.cardLastDigits).toBe('9876');
    expect(parsed.installments?.total).toBe(10);
  });

  it('detecta estorno', () => {
    const parsed = parseBankAlert('Estorno aprovado no valor de R$ 32,10 em 07/07/2026.', referenceDate);

    expect(parsed.type).toBe('refund');
    expect(parsed.amount).toBe(32.1);
  });

  it('usa data atual com baixa confianca quando data esta ausente', () => {
    const parsed = parseBankAlert('Compra no debito valor de R$ 12,00 em PADARIA.', referenceDate);

    expect(parsed.date).toBe('2026-07-07');
    expect(parsed.reasons.some(reason => reason.includes('Data nao encontrada'))).toBe(true);
  });

  it('mantem baixa confianca quando valor esta ausente', () => {
    const parsed = parseBankAlert('Compra aprovada no cartao final 1234 em MERCADO CENTRAL.', referenceDate);

    expect(parsed.amount).toBeUndefined();
    expect(parsed.confidence).toBeLessThan(0.7);
  });

  it('detecta final do cartao com asteriscos', () => {
    const parsed = parseBankAlert('Compra aprovada cartao **** 4321 valor R$ 10,00 hoje.', referenceDate);

    expect(parsed.cardLastDigits).toBe('4321');
  });

  it('retorna unknown para texto de baixa confianca', () => {
    const parsed = parseBankAlert('Mensagem informativa do banco sem dados de compra.', referenceDate);

    expect(parsed.type).toBe('unknown');
    expect(parsed.amount).toBeUndefined();
    expect(parsed.confidence).toBeLessThan(0.35);
  });
});