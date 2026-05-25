import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { resolveAccountName } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Select as ShadcnSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Lock, Unlock, RefreshCcw, AlertTriangle } from 'lucide-react';

export function Audit() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [creditCards, setCreditCards] = useState<any[]>([]);
  const [closedPeriods, setClosedPeriods] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  React.useEffect(() => {
    if (!user) return;

    const tQuery = query(collection(db, 'transactions'), where('userId', '==', user.uid));
    const unsubscribeT = onSnapshot(tQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setTransactions(data);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'transactions'));

    const aQuery = query(collection(db, 'accounts'), where('userId', '==', user.uid));
    const unsubscribeA = onSnapshot(aQuery, (snapshot) => {
      setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'accounts'));

    const ccQuery = query(collection(db, 'creditCards'), where('userId', '==', user.uid));
    const unsubscribeCC = onSnapshot(ccQuery, (snapshot) => {
      setCreditCards(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'creditCards'));

    const cpQuery = query(collection(db, 'closedPeriods'), where('userId', '==', user.uid));
    const unsubscribeCP = onSnapshot(cpQuery, (snapshot) => {
      setClosedPeriods(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'closedPeriods'));

    const invQuery = query(collection(db, 'invoices'), where('userId', '==', user.uid));
    const unsubscribeInv = onSnapshot(invQuery, (snapshot) => {
      setInvoices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'invoices'));

    return () => {
      unsubscribeT();
      unsubscribeA();
      unsubscribeCC();
      unsubscribeCP();
      unsubscribeInv();
    };
  }, [user]);

  const accountTransactions = useMemo(() => {
    if (!selectedAccountId) return [];
    return transactions.filter(t => t.accountId === selectedAccountId || t.destinationAccountId === selectedAccountId);
  }, [transactions, selectedAccountId]);

  const runningBalanceTransactions = useMemo(() => {
    let balance = 0;
    return accountTransactions.map(t => {
      const isDestination = t.destinationAccountId === selectedAccountId;
      const isSource = t.accountId === selectedAccountId;
      
      let change = 0;
      if (t.type === 'transferencia') {
        change = isDestination ? t.amount : -t.amount;
      } else {
        change = t.type === 'receita' ? t.amount : -t.amount;
      }
      
      balance += change;
      return { ...t, runningBalance: balance };
    });
  }, [accountTransactions, selectedAccountId]);

  const handleRecalculateBalance = async () => {
    if (!selectedAccountId) return;
    
    const finalBalance = runningBalanceTransactions.length > 0 
      ? runningBalanceTransactions[runningBalanceTransactions.length - 1].runningBalance 
      : 0;

    try {
      const accRef = doc(db, 'accounts', selectedAccountId);
      await updateDoc(accRef, { balance: finalBalance });
      toast.success('Saldo da conta recalculado e corrigido com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `accounts/${selectedAccountId}`);
      toast.error('Erro ao recalcular saldo da conta.');
    }
  };

  const handleUnlockPeriod = (periodId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Reabrir Período',
      description: 'Tem certeza que deseja reabrir este período? Isso permitirá edições em transações antigas.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'closedPeriods', periodId));
          toast.success('Período reaberto com sucesso!');
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `closedPeriods/${periodId}`);
          toast.error('Erro ao reabrir período.');
        } finally {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleReopenInvoice = (invoiceId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Reabrir Fatura',
      description: 'Deseja reabrir esta fatura? O status voltará para "aberta".',
      onConfirm: async () => {
        try {
          await updateDoc(doc(db, 'invoices', invoiceId), { status: 'aberta' });
          toast.success('Fatura reaberta com sucesso!');
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `invoices/${invoiceId}`);
          toast.error('Erro ao reabrir fatura.');
        } finally {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Auditoria e Gestão</h1>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-amber-500" />
              Períodos Fechados (Contas)
            </CardTitle>
            <CardDescription>Bloqueios de edição para contas correntes</CardDescription>
          </CardHeader>
          <CardContent>
            {closedPeriods.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhum período fechado encontrado.</p>
            ) : (
              <div className="space-y-3">
                {closedPeriods.map((cp: any) => (
                  <div key={cp.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                    <div>
                      <p className="font-medium">{resolveAccountName(cp.accountId, accounts, creditCards)}</p>
                      <p className="text-xs text-muted-foreground">
                        Mês: {format(parseISO(cp.period + '-01'), 'MMMM yyyy', { locale: ptBR })}
                      </p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleUnlockPeriod(cp.id)}
                      className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                    >
                      <Unlock className="h-4 w-4 mr-2" />
                      Reabrir
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCcw className="h-5 w-5 text-blue-500" />
              Faturas Fechadas/Pagas
            </CardTitle>
            <CardDescription>Gestão de status de faturas de cartão</CardDescription>
          </CardHeader>
          <CardContent>
            {invoices.filter(i => i.status !== 'aberta').length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma fatura fechada ou paga encontrada.</p>
            ) : (
              <div className="space-y-3">
                {invoices.filter(i => i.status !== 'aberta').map((inv: any) => (
                  <div key={inv.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                    <div>
                      <p className="font-medium">{resolveAccountName(inv.cardId, accounts, creditCards)}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">
                          Período: {format(parseISO(inv.period + '-01'), 'MMMM yyyy', { locale: ptBR })}
                        </p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                          inv.status === 'paga' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {inv.status}
                        </span>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleReopenInvoice(inv.id)}
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    >
                      <RefreshCcw className="h-4 w-4 mr-2" />
                      Reabrir
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Auditoria de Saldo
          </CardTitle>
          <CardDescription>Recalcule o saldo de uma conta com base no histórico de transações</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="w-full max-w-xs">
              <Label>Conta</Label>
              <ShadcnSelect value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma conta" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>{resolveAccountName(acc.id, accounts, creditCards)}</SelectItem>
                  ))}
                  {creditCards.map(cc => (
                    <SelectItem key={cc.id} value={cc.id}>{resolveAccountName(cc.id, accounts, creditCards)}</SelectItem>
                  ))}
                </SelectContent>
              </ShadcnSelect>
            </div>
            {selectedAccountId && (
              <Button onClick={handleRecalculateBalance} variant="destructive">
                Recalcular e Corrigir Saldo
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedAccountId && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Saldo Acumulado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Data</th>
                    <th className="text-left p-2">Descrição</th>
                    <th className="text-right p-2">Valor</th>
                    <th className="text-right p-2">Saldo Acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  {runningBalanceTransactions.map((t: any) => (
                    <tr key={t.id} className="border-b hover:bg-muted/50">
                      <td className="p-2">{format(new Date(t.date), 'dd/MM/yyyy')}</td>
                      <td className="p-2">{t.description}</td>
                      <td className={`p-2 text-right ${t.type === 'receita' ? 'text-green-600' : 'text-red-600'}`}>
                        {t.type === 'receita' ? '+' : '-'} R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-2 text-right font-mono">
                        R$ {t.runningBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={confirmDialog.isOpen} onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, isOpen: open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmDialog.title}</DialogTitle>
            <DialogDescription>{confirmDialog.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}>Cancelar</Button>
            <Button onClick={confirmDialog.onConfirm}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
