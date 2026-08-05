import { describe, expect, it } from 'vitest';
import type { Account, Category, CreditCard, Transaction } from '../types';
import { buildMonthlyStatement } from './monthlyStatement';
import { buildMonthlyStatementCsv } from './monthlyStatementCsv';

const base = { userId: 'u1', createdAt: '2026-08-01' };
const transaction = (data: Partial<Transaction>): Transaction => ({
  ...base,
  type: 'expense',
  amount: 0,
  date: '2026-08-01',
  description: '',
  status: 'paid',
  ...data,
});

describe('buildMonthlyStatementCsv', () => {
  it('exporta a composição mensal com nomes e valores em formato brasileiro', () => {
    const transactions = [
      transaction({ id: 'income', type: 'income', amount: 2500, description: 'Salário', accountId: 'account', categoryId: 'income-category' }),
      transaction({ id: 'expense', amount: 1234.56, date: '2026-08-03', description: 'Mercado', accountId: 'account', categoryId: 'expense-category' }),
    ];
    const accounts = [{ ...base, id: 'account', name: 'Conta principal', type: 'checking', balance: 0 }] as Account[];
    const categories = [
      { ...base, id: 'income-category', name: 'Renda', type: 'income', icon: '', isDefault: false },
      { ...base, id: 'expense-category', name: 'Alimentação', type: 'expense', icon: '', isDefault: false },
    ] as Category[];
    const csv = buildMonthlyStatementCsv(buildMonthlyStatement(transactions, [], [], '2026-08'), accounts, categories, []);

    expect(csv).toContain('Data;Tipo;Descrição;Categoria;Conta/Cartão;Valor (R$);Status');
    expect(csv).toContain('2026-08-03;Despesa em conta;Mercado;Alimentação;Conta principal;1234,56;paid');
    expect(csv).toContain('2026-08-01;Receita recebida;Salário;Renda;Conta principal;2500,00;paid');
  });

  it('escapa separadores e aspas sem corromper o CSV', () => {
    const transactions = [transaction({ id: 'expense', amount: 10, description: 'Loja; "Centro"', accountId: 'account' })];
    const accounts = [{ ...base, id: 'account', name: 'Conta; Principal', type: 'checking', balance: 0 }] as Account[];
    const cards = [] as CreditCard[];
    const statement = buildMonthlyStatement(transactions, [], [], '2026-08');

    const csv = buildMonthlyStatementCsv(statement, accounts, [], cards);

    expect(csv).toContain('"Loja; ""Centro"""');
    expect(csv).toContain('"Conta; Principal"');
    expect(csv.split('\r\n')).toHaveLength(2);
  });
});
