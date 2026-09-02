// Reproducao independente da auditoria v0.16.0. Somente dados sinteticos.
// Executar na raiz: node --import tsx docs/archive/sessions/2026-09-02-auditoria-relatorios.repro.ts
// Alternativa se tsx falhar no sandbox: empacotar com esbuild (platform node, format cjs)
// e executar o arquivo gerado com node. Comandos completos no relatorio da auditoria.
// Saida 1 significa que os contratos auditados ainda apresentam divergencias.
import { isDeepStrictEqual } from 'node:util';
import type { Account, CreditCard, Invoice, Transaction } from '../../../src/types/index';
import type { ReportFilters } from '../../../src/types/reports';
import { normalizeTransactions } from '../../../src/lib/reports/normalize';
import { buildAccountFlowReport } from '../../../src/lib/reports/accountFlow';
import { buildInvoiceObligations } from '../../../src/lib/reports/invoiceEvents';
import { buildCategoryReport } from '../../../src/lib/reports/categoryReport';

const account = (id: string, initialBalance: number, balance = initialBalance): Account => ({
  id, name: id, userId: 'synthetic', type: 'checking', initialBalance, balance, createdAt: '2026-01-01', openingDate: '2026-01-01',
});
const transaction = (overrides: Partial<Transaction>): Transaction => ({
  id: 'synthetic', userId: 'synthetic', type: 'expense', status: 'paid', amount: 100,
  date: '2026-08-10', description: 'Dado sintetico', accountId: 'A', createdAt: '2026-08-10', ...overrides,
});
const card: CreditCard = { id: 'card', name: 'Cartao sintetico', userId: 'synthetic', limit: 5000, closingDay: 20, dueDay: 27, createdAt: '' };
const invoice = (overrides: Partial<Invoice> = {}): Invoice => ({
  id: 'invoice', userId: 'synthetic', cardId: 'card', period: '2026-08', status: 'aberta', totalAmount: 1000, ...overrides,
});
const base: ReportFilters = { selectedMonth: '2026-08', status: 'all', intervalType: 'day', accumulated: false, includePending: false };
const flow = (accounts: Account[], txs: Transaction[], invs: Invoice[] = [], changes: Partial<ReportFilters> = {}) =>
  buildAccountFlowReport(accounts, [card], invs, normalizeTransactions(txs, [], [card], invs), { ...base, ...changes });
const results: { case: string; expected: unknown; actual: unknown; passed: boolean }[] = [];
const check = (name: string, expected: unknown, actual: unknown) => results.push({ case: name, expected, actual, passed: isDeepStrictEqual(expected, actual) });

const multiTx = [transaction({ id: 'income-A', type: 'income', amount: 500 }), transaction({ id: 'expense-B', accountId: 'B', amount: 100 })];
const multiAccounts = [account('A', 1000, 1500), account('B', 2000, 1900)];
const multi = flow(multiAccounts, multiTx);
check('01 movimentos de uma conta nao pertencem a outra', [1500, 1900], multi.accountFlowResult.accounts.map(a => a.endingBalance));
check('02 saldo do indicador coincide com ultimo ponto do grafico', { indicator: 3400, chart: 3400 },
  { indicator: multi.cashFlowResult.endingBalance, chart: multi.cashFlowResult.points.at(-1)?.endingBalance });
check('03 identidade saldo inicial + entradas - saidas = saldo final', multi.cashFlowResult.startingBalance! + multi.cashFlowResult.totalInflow - multi.cashFlowResult.totalOutflow, multi.cashFlowResult.endingBalance);

const past = multiTx.map(t => ({ ...t, date: '2026-07-10' }));
check('04 saldo historico nao incorpora movimentos de outras contas', [1500, 1900], flow(multiAccounts, past).accountFlowResult.accounts.map(a => a.startingBalance));
check('05 selecao vazia nao equivale a todas as contas', 0, flow(multiAccounts, multiTx, [], { originIds: [] }).accountFlowResult.accounts.length);

const purchase = transaction({ id: 'purchase', accountId: 'card', creditCardId: 'card', invoicePeriod: '2026-08', status: 'pending', amount: 1000 });
check('06 compra pendente nao e agendamento de pagamento de fatura', 100000,
  buildInvoiceObligations([invoice()], [card], normalizeTransactions([purchase], [], [card], [invoice()]), '2026-08').totalResidualCents);

const partial = invoice({ status: 'parcial', paidAmount: 400, paymentTransactionIds: ['scheduled'] });
const scheduled = transaction({ id: 'scheduled', status: 'pending', amount: 200, date: '2026-08-27' });
const partialFlow = flow([account('A', 1000)], [scheduled], [partial], { includePending: true });
check('07 pagamento oficial pendente reduz residual sem precisar creditCardId', 400, partialFlow.accountFlowResult.unallocatedInvoiceObligations);
check('08 previsao nao duplica agendamento oficial', 400, partialFlow.accountFlowResult.consolidatedProjectedEndingBalance);

const paidPurchase = { ...purchase, status: 'paid' as const };
check('09 compras sem documento de fatura continuam sendo obrigacao', 100000,
  buildInvoiceObligations([], [card], normalizeTransactions([paidPurchase], [], [card]), '2026-08').totalResidualCents);

check('10 desativar pendencias nao desconta fatura do saldo previsto', 1000,
  flow([account('A', 1000)], [], [invoice({ totalAmount: 100 })]).accountFlowResult.consolidatedProjectedEndingBalance);
check('11 selecao parcial nao recebe obrigacao sem conta arbitraria', 1000,
  flow([account('A', 1000), account('B', 2000)], [], [invoice({ totalAmount: 100 })], { originIds: ['A'], includePending: true }).accountFlowResult.consolidatedProjectedEndingBalance);
check('12 vencimento fora do intervalo personalizado nao entra', 0,
  flow([account('A', 1000)], [], [invoice({ totalAmount: 100 })], { includePending: true, customRange: { startDate: '2026-08-01', endDate: '2026-08-05' } }).accountFlowResult.unallocatedInvoiceObligations);

const category = buildCategoryReport('expenses', normalizeTransactions([
  transaction({ id: 'july-purchase', amount: 100, creditCardId: 'card', accountId: 'card', date: '2026-07-25', postingDate: '2026-07-25', invoicePeriod: '2026-08' }),
], [], [card]), [], [], { ...base, intervalType: 'month' });
check('13 evolucao mensal coincide com distribuicao do mes da fatura', category.total, category.evolution.reduce((s, p) => s + p.total, 0));

const pending = transaction({ id: 'pending', status: 'pending', amount: 100 });
const pendingResult = flow([account('A', 1000)], [pending], [], { includePending: true });
check('14 incluir pendentes afeta valores exibidos em entradas x saidas', 100, pendingResult.cashFlowResult.totalOutflow);
check('15 somente realizados exclui pendencias tambem do detalhamento', 0,
  flow([account('A', 1000)], [pending]).cashFlowResult.points.flatMap(p => p.entries).length);

check('16 nao declarar conciliacao sem comparar saldo persistido', false,
  flow([account('A', 1000, 9000)], []).accountFlowResult.accounts[0].isReconciled);
const noInitial = { ...account('A', 0, 9000), initialBalance: undefined };
check('17 ausencia de saldo inicial nao pode resultar em conciliado', false, flow([noInitial], []).accountFlowResult.accounts[0].isReconciled);
const futureAccount = { ...account('A', 1000), openingDate: '2026-09-01', createdAt: '2026-09-01' };
check('18 conta aberta em setembro nao fornece capital em agosto', 0, flow([futureAccount], []).accountFlowResult.consolidatedStartingBalance);

check('controle 01 uma conta com receita e despesa proprias', 1300, flow([account('A', 1000, 1300)], [
  transaction({ id: 'own-income', type: 'income', amount: 500 }), transaction({ id: 'own-expense', amount: 200 }),
]).cashFlowResult.endingBalance);
check('controle 02 transferencia interna preserva total', 3000, flow([account('A', 1000), account('B', 2000)], [
  transaction({ id: 'transfer', type: 'transfer', accountId: 'A', destinationAccountId: 'B', amount: 200 }),
]).cashFlowResult.endingBalance);
check('controle 03 credito de cartao reduz consumo', 250, buildCategoryReport('expenses', normalizeTransactions([
  transaction({ id: 'purchase-300', accountId: 'card', creditCardId: 'card', invoicePeriod: '2026-08', amount: 300 }),
  transaction({ id: 'refund-50', accountId: 'card', creditCardId: 'card', invoicePeriod: '2026-08', type: 'income', amount: 50 }),
], [], [card]), [], [], base).total);

console.log(JSON.stringify({ base: '46bf0f3 / v0.16.0', data: 'synthetic only', results,
  total: results.length, divergences: results.filter(r => !r.passed).length }, null, 2));
process.exitCode = results.some(r => !r.passed) ? 1 : 0;
