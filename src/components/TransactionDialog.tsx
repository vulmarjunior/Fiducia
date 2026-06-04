import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, doc, runTransaction, addDoc, writeBatch } from 'firebase/firestore';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Select as ShadcnSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { MoneyInput } from './MoneyInput';
import { CategorySelect } from './CategorySelect';
import { calculateInvoicePeriod, getNextPeriod, dateToLocalISOString, parseLocalDate, isEffectivelyPaid, isPeriodClosed } from '../lib/utils';
import { logActivity } from '../services/activityLogService';
import { toast } from 'sonner';
import { Repeat, MessageSquare, Tag, Paperclip, ThumbsUp, ThumbsDown, Plus } from 'lucide-react';
import Select from 'react-select';
import { motion } from 'motion/react';
import { useTransactionDialog } from '../contexts/TransactionDialogContext';

const now = new Date();
const currentDateStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
const getBalanceChange = (type: string, amount: number) => {
  return type === 'receita' ? amount : -amount;
};

function computeInstallmentParts(total: number, count: number) {
  const base = Math.floor((total / count) * 100) / 100;
  const remainder = Math.round((total - (base * count)) * 100) / 100;
  return { base, remainder };
}

function getInstallmentAmount(i: number, position: string, count: number, base: number, remainder: number): number {
  if (position === 'first' && i === 0) return base + remainder;
  if (position === 'last' && i === count - 1) return base + remainder;
  if (position === 'spread' && i < Math.round(remainder * 100)) return base + 0.01;
  return base;
}

function getRecurrenceParams(frequency: string): { iterations: number; advanceDate: (d: Date, i: number) => void } {
  switch (frequency) {
    case 'semanal': return { iterations: 52, advanceDate: (d, i) => d.setDate(d.getDate() + i * 7) };
    case 'mensal': return { iterations: 12, advanceDate: (d, i) => d.setMonth(d.getMonth() + i) };
    case 'bimestral': return { iterations: 6, advanceDate: (d, i) => d.setMonth(d.getMonth() + i * 2) };
    case 'trimestral': return { iterations: 4, advanceDate: (d, i) => d.setMonth(d.getMonth() + i * 3) };
    case 'semestral': return { iterations: 2, advanceDate: (d, i) => d.setMonth(d.getMonth() + i * 6) };
    case 'anual': return { iterations: 5, advanceDate: (d, i) => d.setFullYear(d.getFullYear() + i) };
    default: return { iterations: 12, advanceDate: (d, i) => d.setMonth(d.getMonth() + i) };
  }
}

export function TransactionDialog() {
  const { isOpen, options, close } = useTransactionDialog();
  const { user } = useAuth();

  const [accounts, setAccounts] = useState<any[]>([]);
  const [creditCards, setCreditCards] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [closedPeriods, setClosedPeriods] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [dataReady, setDataReady] = useState(false);

  useEffect(() => {
    if (!isOpen || !user) return;
    setDataReady(false);

    const unsubs: (() => void)[] = [];
    let loaded = 0;
    const checkReady = () => { loaded++; if (loaded >= 7) setDataReady(true); };

    const aq = query(collection(db, 'accounts'), where('userId', '==', user.uid));
    unsubs.push(onSnapshot(aq, (s) => { setAccounts(s.docs.map(d => ({ id: d.id, ...d.data() }))); checkReady(); }, () => checkReady()));

    const ccq = query(collection(db, 'creditCards'), where('userId', '==', user.uid));
    unsubs.push(onSnapshot(ccq, (s) => { setCreditCards(s.docs.map(d => ({ id: d.id, ...d.data() }))); checkReady(); }, () => checkReady()));

    const cq = query(collection(db, 'categories'), where('userId', '==', user.uid));
    unsubs.push(onSnapshot(cq, (s) => { setCategories(s.docs.map(d => ({ id: d.id, ...d.data() }))); checkReady(); }, () => checkReady()));

    const tq = query(collection(db, 'tags'), where('userId', '==', user.uid));
    unsubs.push(onSnapshot(tq, (s) => { setTags(s.docs.map(d => ({ id: d.id, ...d.data() }))); checkReady(); }, () => checkReady()));

    const iq = query(collection(db, 'invoices'), where('userId', '==', user.uid));
    unsubs.push(onSnapshot(iq, (s) => { setInvoices(s.docs.map(d => ({ id: d.id, ...d.data() }))); checkReady(); }, () => checkReady()));

    const cpq = query(collection(db, 'closedPeriods'), where('userId', '==', user.uid));
    unsubs.push(onSnapshot(cpq, (s) => { setClosedPeriods(s.docs.map(d => ({ id: d.id, ...d.data() }))); checkReady(); }, () => checkReady()));

    const txq = query(collection(db, 'transactions'), where('userId', '==', user.uid));
    unsubs.push(onSnapshot(txq, (s) => { setTransactions(s.docs.map(d => ({ id: d.id, ...d.data() }))); checkReady(); }, () => checkReady()));

    return () => unsubs.forEach(u => u());
  }, [isOpen, user]);

  const [formData, setFormData] = useState({
    type: 'despesa' as string,
    amount: 0,
    date: currentDateStr,
    description: '',
    categoryId: '',
    accountId: '',
    destinationAccountId: '',
    status: 'pago' as string,
    invoicePeriod: '',
    ccRecurrenceType: 'avulso' as 'avulso' | 'parcelado' | 'fixo',
    installmentsCount: '2',
    frequency: 'mensal',
    billingDay: new Date().getDate().toString(),
    tagIds: [] as string[],
    observation: '',
    isRecurring: false,
    installments: 1,
    remainderPosition: 'first' as 'first' | 'last' | 'spread',
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTx, setEditingTx] = useState<any>(null);
  const [showRecurrence, setShowRecurrence] = useState(false);
  const [showObservation, setShowObservation] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [isNewCategoryOpen, setIsNewCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isNewTagOpen, setIsNewTagOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');
  const keepOpenRef = useRef(false);
  const descriptionRef = useRef<HTMLInputElement>(null);

  const isCreditCard = useMemo(() => creditCards.some((cc: any) => cc.id === formData.accountId), [creditCards, formData.accountId]);
  const card = useMemo(() => creditCards.find((cc: any) => cc.id === formData.accountId), [creditCards, formData.accountId]);

  const resetForm = useCallback(() => {
    const d = new Date();
    const today = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    setFormData({
      type: options?.presetType || 'despesa',
      amount: 0,
      date: today,
      description: '',
      categoryId: '',
      accountId: options?.presetAccountId || '',
      destinationAccountId: '',
      status: today <= currentDateStr ? 'pago' : 'pendente',
      invoicePeriod: '',
      ccRecurrenceType: 'avulso',
      installmentsCount: '2',
      frequency: 'mensal',
      billingDay: d.getDate().toString(),
      tagIds: [],
      observation: '',
      isRecurring: false,
      installments: 1,
      remainderPosition: 'first',
    });
    setEditingId(null);
    setEditingTx(null);
    setShowRecurrence(false);
    setShowObservation(false);
    setShowTags(false);
    keepOpenRef.current = false;
  }, [options?.presetAccountId, options?.presetType]);

  const populateEdit = useCallback((tx: any) => {
    const cardFromTx = creditCards.find((c: any) => c.id === tx.accountId);
    setFormData({
      type: tx.type || 'despesa',
      amount: tx.amount || 0,
      date: tx.date?.split('T')[0] || currentDateStr,
      description: tx.description || '',
      categoryId: tx.categoryId || '',
      accountId: tx.accountId || '',
      destinationAccountId: tx.destinationAccountId || '',
      status: tx.status || 'pago',
      invoicePeriod: tx.invoicePeriod || '',
      ccRecurrenceType: tx.ccRecurrenceType || (tx.parentId ? 'avulso' : 'avulso'),
      installmentsCount: tx.totalInstallments?.toString() || '2',
      frequency: tx.frequency || 'mensal',
      billingDay: tx.billingDay || tx.date?.split('T')[0]?.split('-')[2] || new Date().getDate().toString(),
      tagIds: tx.tags || [],
      observation: tx.observation || '',
      isRecurring: !!tx.parentId,
      installments: tx.totalInstallments || 1,
      remainderPosition: 'first',
    });
    setEditingId(tx.id);
    setEditingTx(tx);
    setShowRecurrence(!!tx.parentId);
    setShowObservation(!!tx.observation);
    setShowTags(!!(tx.tags && tx.tags.length > 0));
    if (options?.presetMonth) {
      setFormData(prev => ({ ...prev, invoicePeriod: options.presetMonth! }));
    }
  }, [creditCards, options?.presetMonth]);

  useEffect(() => {
    if (!isOpen) return;
    if (options?.editId && transactions.length > 0 && dataReady) {
      const tx = transactions.find((t: any) => t.id === options.editId);
      if (tx) {
        populateEdit(tx);
        return;
      }
    }
    if (dataReady) resetForm();
  }, [isOpen, options?.editId, transactions, dataReady, populateEdit, resetForm]);

  useEffect(() => {
    if (!formData.accountId || !dataReady) return;
    const c = creditCards.find((cc: any) => cc.id === formData.accountId);
    if (c) {
      const period = calculateInvoicePeriod(formData.date, c.closingDay, c.dueDay);
      setFormData(prev => {
        if (prev.invoicePeriod !== period && !editingId) {
          return { ...prev, invoicePeriod: period, status: 'pago' };
        }
        if (!editingId) return { ...prev, status: 'pago' };
        return prev;
      });
    } else if (!editingId) {
      setFormData(prev => ({
        ...prev,
        invoicePeriod: '',
        status: formData.date <= currentDateStr ? 'pago' : 'pendente'
      }));
    }
  }, [formData.accountId, formData.date, creditCards, dataReady, editingId]);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newCategoryName.trim()) return;
    try {
      const icon = (await import('../lib/categoryIcons')).suggestIcon;
      const docRef = await addDoc(collection(db, 'categories'), {
        userId: user.uid,
        name: newCategoryName.trim(),
        type: formData.type,
        icon: icon(newCategoryName.trim()),
        isDefault: false,
        createdAt: new Date().toISOString()
      });
      setFormData(prev => ({ ...prev, categoryId: docRef.id }));
      setNewCategoryName('');
      setIsNewCategoryOpen(false);
      toast.success('Categoria criada');
    } catch (error) {
      toast.error('Erro ao criar categoria');
      handleFirestoreError(error, OperationType.CREATE, 'categories');
    }
  };

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTagName.trim()) return;
    try {
      const docRef = await addDoc(collection(db, 'tags'), {
        userId: user.uid,
        name: newTagName.trim(),
        color: newTagColor,
        createdAt: new Date().toISOString()
      });
      setFormData(prev => ({ ...prev, tagIds: [...prev.tagIds, docRef.id] }));
      setNewTagName('');
      setIsNewTagOpen(false);
      toast.success('Tag criada');
    } catch (error) {
      toast.error('Erro ao criar tag');
      handleFirestoreError(error, OperationType.CREATE, 'tags');
    }
  };
  const handleCreateSubmit = async () => {
    if (!user) return;
    const amount = formData.amount;
    if (amount <= 0) { toast.error('Valor deve ser positivo'); return; }

    if (isPeriodClosed(formData.date, formData.accountId, creditCards, invoices, closedPeriods, formData.invoicePeriod)) {
      toast.error('Período fechado para esta conta.'); return;
    }
    if (formData.type === 'transferencia' && formData.destinationAccountId && isPeriodClosed(formData.date, formData.destinationAccountId, creditCards, invoices, closedPeriods)) {
      toast.error('Período fechado para conta de destino.'); return;
    }
    if (formData.type !== 'transferencia' && !formData.categoryId) {
      toast.error('Selecione uma categoria'); return;
    }

    const finalStatus = isCreditCard ? 'realizado' : formData.status;

    const baseTData: any = {
      userId: user.uid,
      type: formData.type,
      amount,
      description: formData.description,
      status: finalStatus,
      tags: formData.tagIds.length > 0 ? formData.tagIds : [],
      observation: formData.observation || '',
      reconciliationStatus: 'nao_conciliado'
    };

    if (formData.type === 'transferencia') {
      baseTData.accountId = formData.accountId;
      baseTData.destinationAccountId = formData.destinationAccountId;
    } else {
      baseTData.accountId = formData.accountId;
      baseTData.categoryId = formData.categoryId;
    }

    if (isCreditCard && card) {
      baseTData.creditCardId = formData.accountId;
    }

    try {
      if (formData.ccRecurrenceType === 'parcelado') {
        const numInstallments = parseInt(formData.installmentsCount) || 2;
        const { base: installmentBase, remainder } = computeInstallmentParts(amount, numInstallments);
        const parentId = crypto.randomUUID();

        await runTransaction(db, async (transaction) => {
          let accountSnap: any = null;
          if (!isCreditCard && formData.accountId) {
            accountSnap = await transaction.get(doc(db, 'accounts', formData.accountId));
          }

          let currentPeriod = isCreditCard && formData.invoicePeriod
            ? formData.invoicePeriod
            : calculateInvoicePeriod(formData.date, card?.closingDay || 1, card?.dueDay || 1);

          for (let i = 0; i < numInstallments; i++) {
            const date = parseLocalDate(formData.date);
            date.setMonth(date.getMonth() + i);
            const dateStr = date.toISOString();
            const instAmount = getInstallmentAmount(i, formData.remainderPosition, numInstallments, installmentBase, remainder);

            const tData: any = {
              ...baseTData,
              amount: instAmount,
              date: dateStr,
              createdAt: new Date().toISOString(),
              parentId,
              installmentNumber: i + 1,
              totalInstallments: numInstallments,
              description: `${formData.description} (${i + 1}/${numInstallments})`,
            };

            if (isCreditCard && card) {
              tData.invoicePeriod = currentPeriod;
              tData.ccRecurrenceType = 'parcelado';
            } else {
              tData.categoryId = formData.categoryId;
              tData.accountId = formData.accountId;
            }

            transaction.set(doc(collection(db, 'transactions')), tData);
            if (isCreditCard) {
              currentPeriod = getNextPeriod(currentPeriod);
            }
          }

          if (accountSnap?.exists() && isEffectivelyPaid({ status: finalStatus })) {
            const firstAmount = getInstallmentAmount(0, formData.remainderPosition, numInstallments, installmentBase, remainder);
            const change = getBalanceChange(formData.type, firstAmount);
            transaction.update(doc(db, 'accounts', formData.accountId), { balance: (accountSnap.data().balance || 0) + change });
          }
        });

        logActivity({ userId: user.uid, action: 'create', entityType: 'transaction', entityId: parentId, description: `${numInstallments} parcelas: ${formData.description}` }).catch(() => {});
        toast.success(`${numInstallments} parcelas geradas`);
      } else if (isCreditCard && card && formData.ccRecurrenceType === 'fixo') {
        const { iterations, advanceDate } = getRecurrenceParams(formData.frequency);
        const batch = writeBatch(db);

        const ruleData = {
          userId: user.uid,
          accountId: formData.accountId,
          categoryId: formData.categoryId,
          amount,
          description: formData.description,
          frequency: formData.frequency,
          billingDay: parseInt(formData.billingDay),
          status: 'active',
          type: 'expense',
          createdAt: new Date().toISOString(),
          startDate: dateToLocalISOString(formData.date)
        };
        const ruleRef = doc(collection(db, 'recurrenceRules'));
        batch.set(ruleRef, ruleData);

        for (let i = 0; i < iterations; i++) {
          const date = parseLocalDate(formData.date);
          advanceDate(date, i);
          const dateStr = date.toISOString();

          const tData: any = {
            ...baseTData,
            date: dateStr,
            createdAt: new Date().toISOString(),
            parentId: ruleRef.id,
            creditCardId: formData.accountId,
            invoicePeriod: i === 0 && formData.invoicePeriod
              ? formData.invoicePeriod
              : calculateInvoicePeriod(dateStr, card.closingDay, card.dueDay),
            ccRecurrenceType: 'fixo',
          };
          batch.set(doc(collection(db, 'transactions')), tData);
        }
        await batch.commit();
        logActivity({ userId: user.uid, action: 'create', entityType: 'transaction', entityId: ruleRef.id, description: `Fixo: ${formData.description}` }).catch(() => {});
        toast.success('Lançamento fixo configurado');
      } else {
        const iterations = !isCreditCard && formData.isRecurring
          ? getRecurrenceParams(formData.frequency).iterations
          : 1;

        await runTransaction(db, async (transaction) => {
          let srcSnap: any = null;
          let destSnap: any = null;
          if (!isCreditCard && formData.accountId) {
            srcSnap = await transaction.get(doc(db, 'accounts', formData.accountId));
          }
          if (!isCreditCard && formData.type === 'transferencia' && formData.destinationAccountId) {
            destSnap = await transaction.get(doc(db, 'accounts', formData.destinationAccountId));
          }

          for (let i = 0; i < iterations; i++) {
            const date = parseLocalDate(formData.date);
            if (!isCreditCard && formData.isRecurring && i > 0) {
              const { advanceDate } = getRecurrenceParams(formData.frequency);
              advanceDate(date, i);
            }
            const dateStr = date.toISOString();

            const tData: any = {
              ...baseTData,
              date: dateStr,
              createdAt: new Date().toISOString(),
            };

            if (isCreditCard && card) {
              tData.creditCardId = formData.accountId;
              tData.invoicePeriod = i === 0 && formData.invoicePeriod
                ? formData.invoicePeriod
                : calculateInvoicePeriod(dateStr, card.closingDay, card.dueDay);
              tData.ccRecurrenceType = 'avulso';
            }

            if (!isCreditCard && formData.isRecurring && iterations > 1) {
              tData.parentId = crypto.randomUUID();
              tData.isRecurring = true;
              tData.frequency = formData.frequency;
            }

            transaction.set(doc(collection(db, 'transactions')), tData);
          }

          if (srcSnap?.exists() && isEffectivelyPaid({ status: finalStatus })) {
            const change = getBalanceChange(formData.type, amount);
            transaction.update(doc(db, 'accounts', formData.accountId), { balance: (srcSnap.data().balance || 0) + change });
          }
          if (destSnap?.exists() && isEffectivelyPaid({ status: finalStatus })) {
            transaction.update(doc(db, 'accounts', formData.destinationAccountId), { balance: (destSnap.data().balance || 0) + amount });
          }
        });

        logActivity({ userId: user.uid, action: 'create', entityType: 'transaction', entityId: 'new', description: formData.description }).catch(() => {});
        toast.success(iterations > 1 ? 'Lançamentos gerados' : 'Lançamento adicionado');
      }

      if (!keepOpenRef.current) {
        close();
        resetForm();
      }
    } catch (error) {
      toast.error('Erro ao salvar lançamento');
      handleFirestoreError(error, OperationType.CREATE, 'transactions');
    }
  };

  const handleEditSubmit = async () => {
    if (!user || !editingId || !editingTx) return;

    if (isPeriodClosed(editingTx.date, editingTx.accountId, creditCards, invoices, closedPeriods, editingTx.invoicePeriod)) {
      toast.error('Período fechado para esta conta.'); return;
    }

    const amount = formData.amount;
    if (amount <= 0) { toast.error('Valor deve ser positivo'); return; }

    const isSeries = editingTx.parentId || editingTx.installmentId;
    const baseFieldsChanged = formData.description !== editingTx.description ||
      formData.categoryId !== (editingTx.categoryId || '') ||
      JSON.stringify(formData.tagIds) !== JSON.stringify(editingTx.tags || []) ||
      formData.observation !== (editingTx.observation || '');

    const financialFieldsChanged = formData.amount !== editingTx.amount ||
      formData.date !== (editingTx.date?.split('T')[0] || '') ||
      formData.invoicePeriod !== (editingTx.invoicePeriod || '') ||
      formData.type !== editingTx.type ||
      formData.status !== editingTx.status;

    const becameParcelado = !editingTx.parentId && formData.ccRecurrenceType === 'parcelado';
    const changedInstallmentCount = !!editingTx.parentId && formData.ccRecurrenceType === 'parcelado' &&
      parseInt(formData.installmentsCount) !== editingTx.totalInstallments;

    try {
      // Convert avulso → parcelado (credit card)
      if (becameParcelado && isCreditCard && card && formData.type !== 'transferencia') {
        const numInstallments = parseInt(formData.installmentsCount) || 2;
        if (numInstallments < 2) { toast.error('Mínimo de 2 parcelas'); return; }

        const { base: installmentBase, remainder } = computeInstallmentParts(amount, numInstallments);
        const firstAmount = getInstallmentAmount(0, formData.remainderPosition, numInstallments, installmentBase, remainder);
        const parentId = crypto.randomUUID();

        await runTransaction(db, async (transaction) => {
          const txRef = doc(db, 'transactions', editingId);
          const txSnap = await transaction.get(txRef);
          if (!txSnap.exists()) throw new Error('Transaction not found');

          transaction.update(txRef, {
            type: formData.type,
            amount: firstAmount,
            description: `${formData.description} (1/${numInstallments})`,
            date: dateToLocalISOString(formData.date),
            categoryId: formData.type !== 'transferencia' ? formData.categoryId : null,
            creditCardId: formData.accountId,
            accountId: formData.accountId,
            invoicePeriod: formData.invoicePeriod || calculateInvoicePeriod(formData.date, card.closingDay, card.dueDay),
            status: 'realizado',
            tags: formData.tagIds.length > 0 ? formData.tagIds : [],
            observation: formData.observation || '',
            parentId,
            installmentNumber: 1,
            totalInstallments: numInstallments,
            ccRecurrenceType: 'parcelado',
            updatedAt: new Date().toISOString(),
          });

          const origDate = parseLocalDate(formData.date);
          let currentPeriod = formData.invoicePeriod || calculateInvoicePeriod(formData.date, card.closingDay, card.dueDay);

          for (let i = 1; i < numInstallments; i++) {
            const futureDate = new Date(origDate);
            futureDate.setMonth(futureDate.getMonth() + i);
            currentPeriod = getNextPeriod(currentPeriod);
            const instAmount = getInstallmentAmount(i, formData.remainderPosition, numInstallments, installmentBase, remainder);

            transaction.set(doc(collection(db, 'transactions')), {
              userId: user.uid,
              type: formData.type,
              amount: instAmount,
              date: futureDate.toISOString(),
              description: `${formData.description} (${i + 1}/${numInstallments})`,
              creditCardId: formData.accountId,
              accountId: formData.accountId,
              invoicePeriod: currentPeriod,
              status: 'pendente',
              reconciliationStatus: 'nao_conciliado',
              categoryId: formData.type !== 'transferencia' ? formData.categoryId : null,
              tags: formData.tagIds.length > 0 ? formData.tagIds : [],
              observation: formData.observation || '',
              parentId,
              installmentNumber: i + 1,
              totalInstallments: numInstallments,
              ccRecurrenceType: 'parcelado',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        });

        logActivity({ userId: user.uid, action: 'update', entityType: 'transaction', entityId: editingId, description: `Convertido para ${numInstallments} parcelas: ${formData.description}` }).catch(() => {});
        toast.success(`Convertido para ${numInstallments} parcelas`);
        close();
        resetForm();
        return;
      }

      // Convert avulso → parcelado (bank account)
      if (becameParcelado && !isCreditCard && formData.type !== 'transferencia') {
        const numInstallments = parseInt(formData.installmentsCount) || 2;
        if (numInstallments < 2) { toast.error('Mínimo de 2 parcelas'); return; }

        const { base: installmentBase, remainder } = computeInstallmentParts(amount, numInstallments);
        const firstAmount = getInstallmentAmount(0, formData.remainderPosition, numInstallments, installmentBase, remainder);
        const parentId = crypto.randomUUID();

        await runTransaction(db, async (transaction) => {
          const txRef = doc(db, 'transactions', editingId);
          const txSnap = await transaction.get(txRef);
          if (!txSnap.exists()) throw new Error('Transaction not found');
          const oldT = txSnap.data() as any;

          let accountSnap: any = null;
          let balanceDelta = 0;

          if (formData.accountId) {
            accountSnap = await transaction.get(doc(db, 'accounts', formData.accountId));

            if (accountSnap?.exists() && isEffectivelyPaid(oldT)) {
              const oldEffect = getBalanceChange(oldT.type, oldT.amount);
              const newStatus = formData.status;
              const newEffect = isEffectivelyPaid({ status: newStatus }) ? getBalanceChange(formData.type, firstAmount) : 0;
              balanceDelta = newEffect - oldEffect;
            }
          }

          transaction.update(txRef, {
            type: formData.type,
            amount: firstAmount,
            description: `${formData.description} (1/${numInstallments})`,
            date: dateToLocalISOString(formData.date),
            categoryId: formData.type !== 'transferencia' ? formData.categoryId : null,
            accountId: formData.accountId,
            status: formData.status,
            tags: formData.tagIds.length > 0 ? formData.tagIds : [],
            observation: formData.observation || '',
            parentId,
            installmentNumber: 1,
            totalInstallments: numInstallments,
            updatedAt: new Date().toISOString(),
          });

          const origDate = parseLocalDate(formData.date);

          for (let i = 1; i < numInstallments; i++) {
            const futureDate = new Date(origDate);
            futureDate.setMonth(futureDate.getMonth() + i);
            const instAmount = getInstallmentAmount(i, formData.remainderPosition, numInstallments, installmentBase, remainder);

            transaction.set(doc(collection(db, 'transactions')), {
              userId: user.uid,
              type: formData.type,
              amount: instAmount,
              date: futureDate.toISOString(),
              description: `${formData.description} (${i + 1}/${numInstallments})`,
              accountId: formData.accountId,
              categoryId: formData.type !== 'transferencia' ? formData.categoryId : null,
              status: 'pendente',
              reconciliationStatus: 'nao_conciliado',
              tags: formData.tagIds.length > 0 ? formData.tagIds : [],
              observation: formData.observation || '',
              parentId,
              installmentNumber: i + 1,
              totalInstallments: numInstallments,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }

          if (accountSnap?.exists() && balanceDelta !== 0) {
            transaction.update(doc(db, 'accounts', formData.accountId), { balance: (accountSnap.data().balance || 0) + balanceDelta });
          }
        });

        logActivity({ userId: user.uid, action: 'update', entityType: 'transaction', entityId: editingId, description: `Convertido para ${numInstallments} parcelas: ${formData.description}` }).catch(() => {});
        toast.success(`Convertido para ${numInstallments} parcelas`);
        close();
        resetForm();
        return;
      }
      const updateData: any = {
        type: formData.type,
        amount,
        description: formData.description,
        date: dateToLocalISOString(formData.date),
        categoryId: formData.type !== 'transferencia' ? formData.categoryId : null,
        status: isCreditCard ? 'realizado' : formData.status,
        tags: formData.tagIds.length > 0 ? formData.tagIds : [],
        observation: formData.observation || '',
        updatedAt: new Date().toISOString()
      };

      if (formData.type !== 'transferencia') {
        updateData.categoryId = formData.categoryId;
      }

      if (isCreditCard && card) {
        updateData.creditCardId = formData.accountId;
        updateData.invoicePeriod = formData.invoicePeriod || calculateInvoicePeriod(formData.date, card.closingDay, card.dueDay);
      }

      // Series propagation: if series and only base fields changed, update all siblings
      if (isSeries && baseFieldsChanged && !financialFieldsChanged) {
        const seriesKey = editingTx.parentId || editingTx.installmentId;
        const siblings = transactions.filter((t: any) =>
          (t.parentId === seriesKey || t.installmentId === seriesKey) && t.id !== editingTx.id
        );

        const batch = writeBatch(db);
        const txRef = doc(db, 'transactions', editingTx.id);
        batch.update(txRef, { ...updateData, parentId: editingTx.parentId || null });

        const seriesUpdate: any = {
          description: formData.description,
          categoryId: formData.type !== 'transferencia' ? formData.categoryId : null,
          tags: formData.tagIds.length > 0 ? formData.tagIds : [],
          observation: formData.observation || '',
          updatedAt: new Date().toISOString()
        };
        if (formData.type !== 'transferencia') seriesUpdate.categoryId = formData.categoryId;

        for (const sibling of siblings) {
          batch.update(doc(db, 'transactions', sibling.id), seriesUpdate);
        }
        await batch.commit();
        logActivity({ userId: user.uid, action: 'update', entityType: 'transaction', entityId: editingId, description: `Série atualizada: ${formData.description}` }).catch(() => {});
        toast.success('Série atualizada');
      } else {
        await runTransaction(db, async (transaction) => {
          const txRef = doc(db, 'transactions', editingId);
          const txSnap = await transaction.get(txRef);
          if (!txSnap.exists()) throw new Error('Transaction not found');
          const oldT = txSnap.data() as any;

          const accountDeltas: Record<string, number> = {};

          if (!creditCards.some((cc: any) => cc.id === oldT.accountId)) {
            const oldPaid = isEffectivelyPaid(oldT);
            const newPaid = isEffectivelyPaid({ status: formData.status }) && !isCreditCard;

            if (oldPaid) {
              if (oldT.type === 'transferencia') {
                if (oldT.accountId) accountDeltas[oldT.accountId] = (accountDeltas[oldT.accountId] || 0) + oldT.amount;
                if (oldT.destinationAccountId) accountDeltas[oldT.destinationAccountId] = (accountDeltas[oldT.destinationAccountId] || 0) - oldT.amount;
              } else {
                accountDeltas[oldT.accountId] = (accountDeltas[oldT.accountId] || 0) - getBalanceChange(oldT.type, oldT.amount);
              }
            }

            if (newPaid && !isCreditCard) {
              if (formData.type === 'transferencia') {
                if (formData.accountId) accountDeltas[formData.accountId] = (accountDeltas[formData.accountId] || 0) - amount;
                if (formData.destinationAccountId) accountDeltas[formData.destinationAccountId] = (accountDeltas[formData.destinationAccountId] || 0) + amount;
              } else {
                accountDeltas[formData.accountId] = (accountDeltas[formData.accountId] || 0) + getBalanceChange(formData.type, amount);
              }
            }
          }

          if (isCreditCard) {
            const relatedInvoice = invoices.find((i: any) => i.paymentTransactionId === editingId);
            if (relatedInvoice) {
              const invRef = doc(db, 'invoices', relatedInvoice.id);
              const invSnap = await transaction.get(invRef);
              if (invSnap.exists()) {
                const newStatus = formData.status === 'pago' && relatedInvoice.status !== 'paga' ? 'paga'
                  : formData.status !== 'pago' && relatedInvoice.status === 'paga' ? 'fechada' : null;
                if (newStatus) transaction.update(invRef, { status: newStatus });
              }
            }
          }

          const accountSnaps: Record<string, any> = {};
          for (const accId of Object.keys(accountDeltas)) {
            if (accountDeltas[accId] === 0) continue;
            accountSnaps[accId] = await transaction.get(doc(db, 'accounts', accId));
          }
          for (const [accId, delta] of Object.entries(accountDeltas)) {
            if (delta === 0) continue;
            const snap = accountSnaps[accId];
            if (snap?.exists()) {
              transaction.update(doc(db, 'accounts', accId), { balance: (snap.data().balance || 0) + delta });
            }
          }

          transaction.update(txRef, updateData);
        });

        logActivity({ userId: user.uid, action: 'update', entityType: 'transaction', entityId: editingId, description: formData.description }).catch(() => {});
        toast.success('Lançamento atualizado');
      }

      close();
      resetForm();
    } catch (error) {
      toast.error('Erro ao atualizar lançamento');
      handleFirestoreError(error, OperationType.UPDATE, 'transactions');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      await handleEditSubmit();
    } else {
      await handleCreateSubmit();
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) { close(); if (!keepOpenRef.current) resetForm(); }
    }}>
      <DialogContent className="w-[95vw] sm:max-w-[480px] p-0 overflow-hidden rounded-2xl border-none shadow-2xl bg-background dark:bg-surface max-h-[95vh] flex flex-col">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-xl font-bold text-foreground">
            {editingId ? 'Editar ' : 'Nova '}
            {isCreditCard ? 'despesa no cartão' : formData.type === 'receita' ? 'receita' : formData.type === 'despesa' ? 'despesa' : 'transferência'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Formulário para adicionar ou editar um lançamento financeiro.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!isCreditCard && (
            <Tabs value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })} className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-muted p-1 rounded-xl h-11">
                <TabsTrigger value="despesa" className="rounded-lg data-[state=active]:bg-background dark:data-[state=active]:bg-muted data-[state=active]:text-red-600 dark:data-[state=active]:text-red-400 data-[state=active]:shadow-sm">Despesa</TabsTrigger>
                <TabsTrigger value="receita" className="rounded-lg data-[state=active]:bg-background dark:data-[state=active]:bg-muted data-[state=active]:text-green-600 dark:data-[state=active]:text-green-400 data-[state=active]:shadow-sm">Receita</TabsTrigger>
                <TabsTrigger value="transferencia" className="rounded-lg data-[state=active]:bg-background dark:data-[state=active]:bg-muted data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm">Transf.</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          {isCreditCard && (
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-center py-2 bg-red-50 dark:bg-red-950/20 rounded-xl text-red-600 dark:text-red-400">
              Despesa no Cartão de Crédito — status sempre realizado
            </div>
          )}

          <form id="transaction-dialog-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1.5">
              <Label htmlFor="tx-desc" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Descrição</Label>
              <Input
                ref={descriptionRef}
                id="tx-desc"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ex: Supermercado, Salário..."
                className="bg-muted border-none focus:ring-2 focus:ring-primary/20 h-12 text-base rounded-xl"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <MoneyInput
                id="tx-amount"
                label="Valor"
                value={formData.amount}
                onChange={(value) => setFormData({ ...formData, amount: value })}
                required
              />
              <div className="space-y-1.5">
                <Label htmlFor="tx-date" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Data</Label>
                <Input
                  id="tx-date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => {
                    const newDate = e.target.value;
                    const c = creditCards.find((cc: any) => cc.id === formData.accountId);
                    if (c) {
                      setFormData({
                        ...formData,
                        date: newDate,
                        invoicePeriod: calculateInvoicePeriod(newDate, c.closingDay, c.dueDay),
                        status: 'pago'
                      });
                    } else {
                      setFormData({
                        ...formData,
                        date: newDate,
                        status: newDate <= currentDateStr ? 'pago' : 'pendente'
                      });
                    }
                  }}
                  className="bg-muted border-none focus:ring-2 focus:ring-primary/20 h-12 text-base rounded-xl"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {formData.type === 'transferencia' ? 'Origem' : 'Conta/Cartão'}
                </Label>
                <Select
                  options={[
                    {
                      label: 'Contas',
                      options: accounts.map((a: any) => ({ value: a.id, label: a.name }))
                    },
                    ...(formData.type !== 'transferencia' ? [{
                      label: 'Cartões de Crédito',
                      options: creditCards.map((c: any) => ({ value: c.id, label: c.name }))
                    }] : [])
                  ]}
                  value={
                    [...accounts.map((a: any) => ({ value: a.id, label: a.name })),
                    ...creditCards.map((c: any) => ({ value: c.id, label: c.name }))]
                      .find(opt => opt.value === formData.accountId) || null
                  }
                  onChange={(selected: any) => {
                    const newAccountId = selected?.value || '';
                    const c = creditCards.find((cc: any) => cc.id === newAccountId);
                    setFormData({
                      ...formData,
                      accountId: newAccountId,
                      invoicePeriod: c ? calculateInvoicePeriod(formData.date, c.closingDay, c.dueDay) : '',
                      status: c ? 'pago' : (formData.date <= currentDateStr ? 'pago' : 'pendente')
                    });
                  }}
                  placeholder="Selecione"
                  className="text-sm"
                  menuPosition="fixed"
                  menuPortalTarget={document.body}
                  styles={{
                    control: (base: any) => ({ ...base, minHeight: '48px', borderRadius: '0.75rem', border: 'none', backgroundColor: 'var(--muted)', boxShadow: 'none' }),
                    menuPortal: (base: any) => ({ ...base, zIndex: 9999 }),
                    menu: (base: any) => ({ ...base, zIndex: 9999, minWidth: '280px', backgroundColor: 'var(--popover)' }),
                    groupHeading: (base: any) => ({ ...base, fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted-foreground)', paddingTop: '10px', paddingBottom: '4px', paddingLeft: '12px' }),
                    option: (base: any, state: any) => ({
                      ...base,
                      whiteSpace: 'normal',
                      wordBreak: 'break-word',
                      paddingTop: '8px',
                      paddingBottom: '8px',
                      backgroundColor: state.isFocused ? 'var(--accent)' : 'transparent',
                      color: state.isFocused ? 'var(--accent-foreground)' : 'var(--popover-foreground)',
                    }),
                  }}
                />
                {(isCreditCard || formData.invoicePeriod) && (
                  <div className="mt-2 space-y-1.5">
                    <Label htmlFor="tx-invoice" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Período da Fatura</Label>
                    <Input
                      id="tx-invoice"
                      type="month"
                      value={formData.invoicePeriod}
                      onChange={(e) => setFormData({ ...formData, invoicePeriod: e.target.value })}
                      className="bg-muted border-none focus:ring-2 focus:ring-primary/20 h-10 text-sm rounded-xl text-fiducia-blue font-bold"
                      required={isCreditCard}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                {formData.type === 'transferencia' && !isCreditCard ? (
                  <>
                    <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Destino</Label>
                    <Select
                      options={accounts.filter((a: any) => a.id !== formData.accountId).map((a: any) => ({ value: a.id, label: a.name }))}
                      value={accounts.map((a: any) => ({ value: a.id, label: a.name })).find((opt: any) => opt.value === formData.destinationAccountId) || null}
                      onChange={(selected: any) => setFormData({ ...formData, destinationAccountId: selected?.value || '' })}
                      placeholder="Destino"
                      className="text-sm"
                      menuPosition="fixed"
                      menuPortalTarget={document.body}
                      styles={{
                        control: (base: any) => ({ ...base, minHeight: '48px', borderRadius: '0.75rem', border: 'none', backgroundColor: 'var(--muted)', boxShadow: 'none' }),
                        menuPortal: (base: any) => ({ ...base, zIndex: 9999 }),
                        menu: (base: any) => ({ ...base, zIndex: 9999, minWidth: '280px', backgroundColor: 'var(--popover)' }),
                        option: (base: any, state: any) => ({
                          ...base, backgroundColor: state.isFocused ? 'var(--accent)' : 'transparent',
                          color: state.isFocused ? 'var(--accent-foreground)' : 'var(--popover-foreground)',
                        }),
                      }}
                    />
                  </>
                ) : !isCreditCard && formData.type !== 'transferencia' ? (
                  <>
                    <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Categoria</Label>
                    <div className="flex gap-1.5 items-center">
                      <div className="flex-1 min-w-0">
                          <CategorySelect
                            categories={categories}
                            value={formData.categoryId}
                            onChange={(val) => setFormData({ ...formData, categoryId: val })}
                            typeFilter={formData.type}
                            placeholder="Buscar..."
                          />
                        </div>
                        <Button type="button" variant="outline" size="icon" onClick={() => setIsNewCategoryOpen(true)} className="h-12 w-12 shrink-0 rounded-xl bg-muted border-none hover:bg-muted">
                          <Plus className="h-5 w-5 text-muted-foreground" />
                        </Button>
                      </div>
                    </>
                  ) : isCreditCard ? (
                    <>
                      <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Categoria</Label>
                      <div className="flex gap-1.5 items-center">
                        <div className="flex-1 min-w-0">
                          <CategorySelect
                            categories={categories}
                            value={formData.categoryId}
                            onChange={(val) => setFormData({ ...formData, categoryId: val })}
                            typeFilter="despesa"
                          placeholder="Buscar..."
                        />
                      </div>
                      <Button type="button" variant="outline" size="icon" onClick={() => setIsNewCategoryOpen(true)} className="h-12 w-12 shrink-0 rounded-xl bg-muted border-none hover:bg-muted">
                        <Plus className="h-5 w-5 text-muted-foreground" />
                      </Button>
                    </div>
                  </>
                ) : null}
              </div>
            </div>

            {/* Icon bar */}
            {!isCreditCard && (
              <div className="flex items-center justify-around py-4 border-y border-gray-50 dark:border-gray-800">
                <button type="button" onClick={() => setShowRecurrence(!showRecurrence)}
                  className={`p-3 rounded-2xl transition-all ${showRecurrence ? 'bg-primary/10 text-primary shadow-inner' : 'bg-muted text-muted-foreground hover:bg-muted'}`} title="Recorrência">
                  <Repeat className="h-6 w-6" />
                </button>
                <button type="button" onClick={() => setShowObservation(!showObservation)}
                  className={`p-3 rounded-2xl transition-all ${showObservation ? 'bg-primary/10 text-primary shadow-inner' : 'bg-muted text-muted-foreground hover:bg-muted'}`} title="Observação">
                  <MessageSquare className="h-6 w-6" />
                </button>
                <button type="button" className="p-3 rounded-2xl bg-muted text-muted-foreground/30 cursor-not-allowed" disabled title="Anexo (Em breve)">
                  <Paperclip className="h-6 w-6" />
                </button>
                <button type="button" onClick={() => setShowTags(!showTags)}
                  className={`p-3 rounded-2xl transition-all ${showTags ? 'bg-primary/10 text-primary shadow-inner' : 'bg-muted text-muted-foreground hover:bg-muted'}`} title="Tags">
                  <Tag className="h-6 w-6" />
                </button>
              </div>
            )}

            {/* Recurrence section */}
            {(showRecurrence || isCreditCard) && (
              <motion.div initial={false} animate={{ height: 'auto', opacity: 1 }} className="overflow-hidden space-y-4">
                <div className="p-4 bg-muted rounded-2xl space-y-4">
                  {isCreditCard ? (
                    <div className="space-y-4">
                      {editingId && editingTx?.parentId && editingTx.installmentNumber && editingTx.totalInstallments && (
                        <div className="text-xs font-bold text-muted-foreground bg-background rounded-xl p-3 text-center border border-border/50">
                          Parcela {editingTx.installmentNumber} de {editingTx.totalInstallments} — série original
                        </div>
                      )}
                      {!(editingId && editingTx?.parentId) && (
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setFormData({ ...formData, ccRecurrenceType: 'avulso' })}
                          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${formData.ccRecurrenceType === 'avulso' ? 'bg-primary text-white shadow-lg' : 'bg-background text-muted-foreground border border-border/50'}`}>AVULSO</button>
                        <button type="button" onClick={() => setFormData({ ...formData, ccRecurrenceType: 'parcelado' })}
                          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${formData.ccRecurrenceType === 'parcelado' ? 'bg-primary text-white shadow-lg' : 'bg-background text-muted-foreground border border-border/50'}`}>PARCELADO</button>
                        <button type="button" onClick={() => setFormData({ ...formData, ccRecurrenceType: 'fixo' })}
                          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${formData.ccRecurrenceType === 'fixo' ? 'bg-primary text-white shadow-lg' : 'bg-background text-muted-foreground border border-border/50'}`}>RECORRENTE</button>
                      </div>
                      )}
                      {formData.ccRecurrenceType === 'parcelado' && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-muted-foreground uppercase">Nº Parcelas</Label>
                            <Input type="number" min="2" value={formData.installmentsCount}
                              onChange={(e) => setFormData({ ...formData, installmentsCount: e.target.value })}
                              className="bg-background border-none h-10 rounded-xl" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-muted-foreground uppercase">Valor Parcela</Label>
                            <div className="h-10 flex items-center px-3 bg-background rounded-xl text-sm font-medium text-secondary-foreground">
                              {(() => {
                                const total = formData.amount || 0;
                                const count = parseInt(formData.installmentsCount) || 2;
                                const parts = computeInstallmentParts(total, count);
                                return getInstallmentAmount(0, formData.remainderPosition, count, parts.base, parts.remainder).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                              })()}
                            </div>
                          </div>
                        </div>
                      )}
                      {formData.ccRecurrenceType === 'fixo' && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-muted-foreground uppercase">Frequência</Label>
                            <ShadcnSelect value={formData.frequency} onValueChange={(v) => setFormData({ ...formData, frequency: v })}>
                              <SelectTrigger className="bg-background border-none h-10 rounded-xl"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="mensal">Mensal</SelectItem>
                                <SelectItem value="bimestral">Bimestral</SelectItem>
                                <SelectItem value="trimestral">Trimestral</SelectItem>
                                <SelectItem value="semestral">Semestral</SelectItem>
                                <SelectItem value="anual">Anual</SelectItem>
                              </SelectContent>
                            </ShadcnSelect>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-muted-foreground uppercase">Dia Cobrança</Label>
                            <Input type="number" min="1" max="31" value={formData.billingDay}
                              onChange={(e) => setFormData({ ...formData, billingDay: e.target.value })}
                              className="bg-background border-none h-10 rounded-xl" />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {editingId && editingTx?.parentId && editingTx.installmentNumber && editingTx.totalInstallments && (
                        <div className="text-xs font-bold text-muted-foreground bg-background rounded-xl p-3 text-center border border-border/50">
                          Parcela {editingTx.installmentNumber} de {editingTx.totalInstallments} — série original
                        </div>
                      )}
                      {!(editingId && editingTx?.parentId) && (
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setFormData({ ...formData, ccRecurrenceType: 'parcelado', isRecurring: false })}
                          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${!formData.isRecurring && formData.ccRecurrenceType === 'parcelado' ? 'bg-primary text-white shadow-lg' : 'bg-background text-muted-foreground border border-border/50'}`}>PARCELADO</button>
                        <button type="button" onClick={() => setFormData({ ...formData, ccRecurrenceType: 'avulso', isRecurring: !formData.isRecurring })}
                          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${formData.isRecurring ? 'bg-primary text-white shadow-lg' : 'bg-background text-muted-foreground border border-border/50'}`}>RECORRENTE</button>
                      </div>
                      )}
                      {formData.ccRecurrenceType === 'parcelado' && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-muted-foreground uppercase">Nº Parcelas</Label>
                            <Input type="number" min="2" value={formData.installmentsCount}
                              onChange={(e) => setFormData({ ...formData, installmentsCount: e.target.value })}
                              className="bg-background border-none h-10 rounded-xl" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-muted-foreground uppercase">Valor Parcela</Label>
                            <div className="h-10 flex items-center px-3 bg-background rounded-xl text-sm font-medium text-secondary-foreground">
                              {(() => {
                                const total = formData.amount || 0;
                                const count = parseInt(formData.installmentsCount) || 2;
                                const parts = computeInstallmentParts(total, count);
                                return getInstallmentAmount(0, formData.remainderPosition, count, parts.base, parts.remainder).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                              })()}
                            </div>
                          </div>
                        </div>
                      )}
                      {formData.ccRecurrenceType === 'parcelado' && (() => {
                        const parts = computeInstallmentParts(formData.amount || 0, parseInt(formData.installmentsCount) || 2);
                        return parts.remainder > 0 ? (
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-muted-foreground uppercase">Diferença de Centavos</Label>
                            <ShadcnSelect value={formData.remainderPosition} onValueChange={(v) => setFormData({ ...formData, remainderPosition: v as any })}>
                              <SelectTrigger className="bg-background border-none h-10 rounded-xl text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="first">1ª parcela (+R$ {parts.remainder.toFixed(2)})</SelectItem>
                                <SelectItem value="last">Última parcela (+R$ {parts.remainder.toFixed(2)})</SelectItem>
                                <SelectItem value="spread">Distribuído</SelectItem>
                              </SelectContent>
                            </ShadcnSelect>
                          </div>
                        ) : null;
                      })()}
                      {formData.isRecurring && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-muted-foreground uppercase">Frequência</Label>
                            <ShadcnSelect value={formData.frequency} onValueChange={(v) => setFormData({ ...formData, frequency: v })}>
                              <SelectTrigger className="bg-background border-none h-10 rounded-xl"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="mensal">Mensal</SelectItem>
                                <SelectItem value="bimestral">Bimestral</SelectItem>
                                <SelectItem value="trimestral">Trimestral</SelectItem>
                                <SelectItem value="semestral">Semestral</SelectItem>
                                <SelectItem value="anual">Anual</SelectItem>
                              </SelectContent>
                            </ShadcnSelect>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-muted-foreground uppercase">Repetições</Label>
                            <Input type="number" min="1" value={formData.installments}
                              onChange={(e) => setFormData({ ...formData, installments: parseInt(e.target.value) })}
                              className="bg-background border-none h-10 rounded-xl" />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Observation */}
            {(showObservation) && (
              <motion.div initial={false} animate={{ height: 'auto', opacity: 1 }} className="overflow-hidden">
                <div className="p-4 bg-muted rounded-2xl space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">Observações</Label>
                    <span className="text-[10px] text-muted-foreground">{(formData.observation || '').length}/500</span>
                  </div>
                  <textarea value={formData.observation || ''}
                    onChange={(e) => setFormData({ ...formData, observation: e.target.value })}
                    placeholder="Adicione detalhes..."
                    maxLength={500}
                    className="w-full bg-background border-none rounded-xl p-3 text-sm min-h-[80px] focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                  />
                </div>
              </motion.div>
            )}

            {/* Tags */}
            {(showTags) && (
              <motion.div initial={false} animate={{ height: 'auto', opacity: 1 }} className="overflow-hidden">
                <div className="p-4 bg-muted rounded-2xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">Tags</Label>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setIsNewTagOpen(true)}
                      className="h-6 text-[10px] text-primary hover:text-primary/80">+ Nova Tag</Button>
                  </div>
                  <Select
                    isMulti
                    options={tags.map((t: any) => ({ value: t.id, label: t.name, color: t.color }))}
                    value={tags.filter((t: any) => formData.tagIds.includes(t.id)).map((t: any) => ({ value: t.id, label: t.name, color: t.color }))}
                    onChange={(selected: any) => setFormData({ ...formData, tagIds: selected ? selected.map((s: any) => s.value) : [] })}
                    placeholder="Selecione tags..."
                    className="text-sm"
                    menuPosition="fixed"
                    menuPortalTarget={document.body}
                    styles={{
                       control: (base: any) => ({ ...base, minHeight: '40px', borderRadius: '0.75rem', border: 'none', backgroundColor: 'var(--muted)', boxShadow: 'none' }),
                       menuPortal: (base: any) => ({ ...base, zIndex: 9999 }),
                       menu: (base: any) => ({ ...base, backgroundColor: 'var(--popover)' }),
                       option: (base: any, state: any) => ({
                         ...base, backgroundColor: state.isFocused ? 'var(--accent)' : 'transparent',
                         color: state.isFocused ? 'var(--accent-foreground)' : 'var(--popover-foreground)',
                       }),
                       multiValue: (base: any, state: any) => ({ ...base, backgroundColor: state.data.color + '20', borderRadius: '4px' }),
                       multiValueLabel: (base: any, state: any) => ({ ...base, color: state.data.color, fontWeight: 600 }),
                       multiValueRemove: (base: any, state: any) => ({ ...base, color: state.data.color, ':hover': { backgroundColor: state.data.color + '40', color: state.data.color } }),
                     }}
                  />
                </div>
              </motion.div>
            )}

            {/* Status (only for non-credit-card) */}
            {!isCreditCard && (
              <div className="flex items-center justify-between p-3 bg-muted rounded-2xl border border-border/50">
                <div className="flex flex-col">
                  <Label className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight">Status</Label>
                  <span className="text-xs font-semibold text-secondary-foreground">
                    {formData.status === 'pago' ? (formData.type === 'receita' ? 'Recebido' : 'Pago') : 'Pendente'}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => setFormData({ ...formData, status: 'pago' })}
                    className={`p-2 rounded-lg transition-all ${formData.status === 'pago' ? 'bg-green-100 text-green-600 shadow-sm' : 'bg-background text-muted-foreground/50 hover:text-muted-foreground border border-border/50'}`}
                    title={formData.type === 'receita' ? 'Recebido' : 'Pago'}>
                    <ThumbsUp className={`h-4 w-4 ${formData.status === 'pago' ? 'fill-current' : ''}`} />
                  </button>
                  <button type="button" onClick={() => setFormData({ ...formData, status: 'pendente' })}
                    className={`p-2 rounded-lg transition-all ${formData.status === 'pendente' ? 'bg-amber-100 text-amber-500 shadow-sm' : 'bg-background text-muted-foreground/50 hover:text-muted-foreground border border-border/50'}`}
                    title="Pendente">
                    <ThumbsDown className={`h-4 w-4 ${formData.status === 'pendente' ? 'fill-current' : ''}`} />
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>

        <div className="p-6 pt-2 flex items-center justify-between gap-4 bg-background border-t border-gray-50 dark:border-gray-800">
          <Button type="button" variant="ghost" onClick={() => { close(); resetForm(); }}
            className="h-14 rounded-2xl text-muted-foreground font-semibold hover:bg-muted">
            Cancelar
          </Button>
          {!editingId && !isCreditCard && (
            <Button form="transaction-dialog-form" type="submit" onClick={() => { keepOpenRef.current = true; }}
              variant="outline" className={`h-14 rounded-2xl font-semibold transition-all border-2 ${
                formData.type === 'despesa' ? 'border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20' :
                formData.type === 'receita' ? 'border-green-200 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20' :
                'border-blue-200 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20'
              }`}>
              Salvar e Continuar
            </Button>
          )}
          <Button form="transaction-dialog-form" type="submit" onClick={() => { keepOpenRef.current = false; }}
            className={`h-14 rounded-2xl font-bold text-white shadow-xl transition-all active:scale-[0.98] ${
              formData.type === 'despesa' ? 'bg-red-600 shadow-red-100 dark:shadow-red-950' :
              formData.type === 'receita' ? 'bg-green-600 shadow-green-100 dark:shadow-green-950' :
              formData.type === 'transferencia' ? 'bg-blue-600 shadow-blue-100 dark:shadow-blue-950' :
              'bg-blue-600 shadow-blue-100 dark:shadow-blue-950'
            }`}>
            {editingId ? 'Atualizar' : 'Salvar'}
          </Button>
        </div>
      </DialogContent>

      {/* New Category Dialog */}
      <Dialog open={isNewCategoryOpen} onOpenChange={setIsNewCategoryOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Nova Categoria</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateCategory} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsNewCategoryOpen(false)}>Cancelar</Button>
              <Button type="submit">Criar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Tag Dialog */}
      <Dialog open={isNewTagOpen} onOpenChange={setIsNewTagOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Nova Tag</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateTag} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={newTagName} onChange={(e) => setNewTagName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2">
                <Input type="color" value={newTagColor} onChange={(e) => setNewTagColor(e.target.value)} className="w-12 h-10 p-1 rounded-md" />
                <Input value={newTagColor} onChange={(e) => setNewTagColor(e.target.value)} className="flex-1" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsNewTagOpen(false)}>Cancelar</Button>
              <Button type="submit">Criar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
