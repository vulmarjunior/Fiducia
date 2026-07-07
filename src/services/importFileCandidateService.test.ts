import { describe, expect, it } from 'vitest';
import { getBankStatementFilePreview, parseBankStatementFile } from './importFileCandidateService';

describe('parseBankStatementFile', () => {
  it('cria linhas importadas a partir de CSV bancario', async () => {
    const csv = 'Data,Descricao,Valor\n07/07/2026,MERCADO CENTRAL,-84.90\n06/07/2026,PIX RECEBIDO,150.00';
    const file = new File([csv], 'extrato.csv', { type: 'text/csv' });

    const lines = await parseBankStatementFile(file);

    expect(lines).toHaveLength(2);
    expect(lines[0].parsed.date).toBe('2026-07-07');
    expect(lines[0].parsed.description).toContain('MERCADO CENTRAL');
    expect(lines[0].parsed.type).toBe('expense');
  });

  it('gera previa com mapeamento automatico', async () => {
    const csv = 'Data,Historico,Debito,Credito\n07/07/2026,PADARIA,12.50,\n08/07/2026,SALARIO,,1000.00';
    const file = new File([csv], 'extrato.csv', { type: 'text/csv' });

    const preview = await getBankStatementFilePreview(file);

    expect(preview.kind).toBe('csv');
    expect(preview.lineCount).toBe(2);
    expect(preview.defaultMapping.date).toBe('Data');
    expect(preview.defaultMapping.description).toBe('Historico');
    expect(preview.defaultMapping.debit).toBe('Debito');
    expect(preview.defaultMapping.credit).toBe('Credito');
  });

  it('respeita mapeamento manual de colunas', async () => {
    const csv = 'Quando,O que,Saiu,Entrou\n07/07/2026,PADARIA,12.50,';
    const file = new File([csv], 'extrato.csv', { type: 'text/csv' });

    const lines = await parseBankStatementFile(file, {
      mapping: { date: 'Quando', description: 'O que', debit: 'Saiu', credit: 'Entrou' },
    });

    expect(lines).toHaveLength(1);
    expect(lines[0].parsed.date).toBe('2026-07-07');
    expect(lines[0].parsed.description).toBe('PADARIA');
    expect(lines[0].parsed.type).toBe('expense');
  });

  it('rejeita formatos nao suportados', async () => {
    const file = new File(['texto'], 'extrato.txt', { type: 'text/plain' });

    await expect(parseBankStatementFile(file)).rejects.toThrow('Formato de arquivo nao suportado');
  });
});