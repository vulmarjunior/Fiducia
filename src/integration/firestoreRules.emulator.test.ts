import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, runTransaction, setDoc } from 'firebase/firestore';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

const describeWithEmulator = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;
const createdAt = '2026-08-04T12:00:00.000Z';
const ownerToken = { email: 'vulmarjunior@gmail.com', email_verified: true };

describeWithEmulator('Firestore security rules', () => {
  let testEnvironment: RulesTestEnvironment;

  beforeAll(async () => {
    testEnvironment = await initializeTestEnvironment({
      projectId: 'fiducia-test',
      firestore: { rules: readFileSync('firestore.rules', 'utf8') },
    });
  });

  afterEach(async () => testEnvironment.clearFirestore());
  afterAll(async () => testEnvironment.cleanup());

  it('blocks unauthenticated access and isolates data by user', async () => {
    const userA = testEnvironment.authenticatedContext('user-a', ownerToken).firestore();
    const userB = testEnvironment.authenticatedContext('user-b', ownerToken).firestore();
    const outsider = testEnvironment.authenticatedContext('outsider', { email: 'outra-pessoa@example.com', email_verified: true }).firestore();
    const anonymous = testEnvironment.unauthenticatedContext().firestore();
    const accountRef = doc(userA, 'accounts/account-a');

    await assertSucceeds(setDoc(accountRef, {
      userId: 'user-a', name: 'Conta principal', type: 'checking', balance: 2_000, createdAt,
    }));
    await assertFails(getDoc(doc(anonymous, 'accounts/account-a')));
    await assertFails(getDoc(doc(userB, 'accounts/account-a')));
    await assertFails(getDoc(doc(outsider, 'accounts/account-a')));
    await assertFails(setDoc(doc(userB, 'accounts/forged'), {
      userId: 'user-a', name: 'Conta forjada', type: 'checking', balance: 0, createdAt,
    }));
  });

  it('accepts the owner profile without multi-user roles', async () => {
    const firestore = testEnvironment.authenticatedContext('user-a', ownerToken).firestore();
    await assertSucceeds(setDoc(doc(firestore, 'users/user-a'), {
      email: ownerToken.email,
      name: 'Proprietario',
      createdAt,
    }));
  });

  it('accepts an atomic partial and total invoice payment workflow', async () => {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore();
      await setDoc(doc(firestore, 'accounts/account-a'), {
        userId: 'user-a', name: 'Conta principal', type: 'checking', balance: 2_000, createdAt,
      });
      await setDoc(doc(firestore, 'invoices/invoice-a'), {
        userId: 'user-a', cardId: 'card-a', period: '2026-08', status: 'fechada',
        totalAmount: 1_000, paidAmount: 0, paymentTransactionIds: [],
      });
    });

    const firestore = testEnvironment.authenticatedContext('user-a', ownerToken).firestore();
    const accountRef = doc(firestore, 'accounts/account-a');
    const invoiceRef = doc(firestore, 'invoices/invoice-a');

    const pay = async (paymentId: string, amount: number, finalPayment: boolean) => {
      await assertSucceeds(runTransaction(firestore, async (transaction) => {
        const accountSnapshot = await transaction.get(accountRef);
        const invoiceSnapshot = await transaction.get(invoiceRef);
        const account = accountSnapshot.data()!;
        const invoice = invoiceSnapshot.data()!;
        const paidAmount = (invoice.paidAmount ?? 0) + amount;
        const paymentTransactionIds = [...(invoice.paymentTransactionIds ?? []), paymentId];

        transaction.update(accountRef, { balance: account.balance - amount });
        transaction.update(invoiceRef, {
          paidAmount, paymentTransactionIds, paymentTransactionId: paymentId,
          status: finalPayment ? 'paga' : 'parcial',
        });
        transaction.set(doc(firestore, `transactions/${paymentId}`), {
          userId: 'user-a', type: 'despesa', amount, date: '2026-08-04',
          description: 'Pagamento de fatura', status: 'pago', createdAt,
          accountId: 'account-a', reconciliationStatus: 'nao_conciliado',
        });
      }));
    };

    await pay('payment-partial', 400, false);
    await pay('payment-final', 600, true);

    const account = (await getDoc(accountRef)).data()!;
    const invoice = (await getDoc(invoiceRef)).data()!;
    expect(account.balance).toBe(1_000);
    expect(invoice).toMatchObject({
      paidAmount: 1_000,
      paymentTransactionIds: ['payment-partial', 'payment-final'],
      status: 'paga',
    });
  });
});
