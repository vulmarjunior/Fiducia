import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc, getDocs, writeBatch } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';
import { Wallet, Landmark, PiggyBank, Plus, Trash2, Edit, Building, ChevronDown, Search, TrendingUp, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { MoneyInput } from '../components/MoneyInput';

interface BankInfo {
  code: number;
  name: string;
  fullName: string;
}

export function Accounts() {
  const { user, isAuthReady } = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '', type: 'corrente', balance: 0, agency: '', accountNumber: '',
    bankCode: '', bankName: '', excludeFromCashFlow: false
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [resetConfirmId, setResetConfirmId] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const [banks, setBanks] = useState<BankInfo[]>([]);
  const [bankSearch, setBankSearch] = useState('');
  const [showBankDropdown, setShowBankDropdown] = useState(false);

  const fetchBanks = async () => {
    try {
      const cached = sessionStorage.getItem('fiducia_bank_list');
      if (cached) {
        setBanks(JSON.parse(cached));
        return;
      }
      const res = await fetch('https://brasilapi.com.br/api/banks/v1');
      if (res.ok) {
        const data: BankInfo[] = await res.json();
        const validBanks = data.filter(b => b.code != null).sort((a, b) => a.name.localeCompare(b.name));
        setBanks(validBanks);
        sessionStorage.setItem('fiducia_bank_list', JSON.stringify(validBanks));
      }
    } catch (error) {
      console.error('Failed to fetch banks', error);
    }
  };

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const q = query(collection(db, 'accounts'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAccounts(data);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'accounts'));

    return () => unsubscribe();
  }, [user, isAuthReady]);

  const filteredBanks = banks.filter(b =>
    !bankSearch || b.name.toLowerCase().includes(bankSearch.toLowerCase()) || String(b.code).includes(bankSearch)
  ).slice(0, 50);

  const handleBankSelect = (bank: BankInfo) => {
    setFormData(prev => ({
      ...prev,
      bankCode: String(bank.code),
      bankName: bank.fullName || bank.name
    }));
    setBankSearch(bank.name);
    setShowBankDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const accountData: any = {
        userId: user.uid,
        name: formData.name,
        type: formData.type,
        balance: formData.balance,
        excludeFromCashFlow: formData.excludeFromCashFlow,
        createdAt: new Date().toISOString()
      };

      if (formData.type === 'corrente' || formData.type === 'checking') {
        if (formData.agency) accountData.agency = formData.agency;
        if (formData.accountNumber) accountData.accountNumber = formData.accountNumber;
      }
      if (formData.bankCode) accountData.bankCode = formData.bankCode;
      if (formData.bankName) accountData.bankName = formData.bankName;

      if (editingId) {
        const updateData: any = {
          name: accountData.name,
          type: accountData.type,
          balance: accountData.balance,
          excludeFromCashFlow: accountData.excludeFromCashFlow,
          bankCode: formData.bankCode || '',
          bankName: formData.bankName || '',
        };
        if (formData.type === 'corrente' || formData.type === 'checking') {
          updateData.agency = formData.agency || '';
          updateData.accountNumber = formData.accountNumber || '';
        } else {
          updateData.agency = '';
          updateData.accountNumber = '';
        }

        await updateDoc(doc(db, 'accounts', editingId), updateData);
        toast.success('Conta atualizada com sucesso');
      } else {
        await addDoc(collection(db, 'accounts'), accountData);
        toast.success('Conta criada com sucesso');
      }
      
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'accounts');
      toast.error('Falha ao salvar conta');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteDoc(doc(db, 'accounts', deleteConfirmId));
      toast.success('Conta excluída');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `accounts/${deleteConfirmId}`);
      toast.error('Falha ao excluir conta');
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleReset = async () => {
    if (!resetConfirmId || !user) return;
    setIsResetting(true);
    try {
      const batch = writeBatch(db);
      const affectedAccounts: Record<string, number> = {};
      let opCount = 0;
      const MAX_BATCH = 450;

      const commitBatch = async () => {
        if (opCount > 0) {
          await batch.commit();
        }
      };

      const tQuery = query(
        collection(db, 'transactions'),
        where('userId', '==', user.uid),
        where('accountId', '==', resetConfirmId)
      );
      const tSnap = await getDocs(tQuery);

      const destQuery = query(
        collection(db, 'transactions'),
        where('userId', '==', user.uid),
        where('destinationAccountId', '==', resetConfirmId)
      );
      const destSnap = await getDocs(destQuery);

      const allDocs = [...tSnap.docs, ...destSnap.docs];
      const seenIds = new Set<string>();

      for (const docSnap of allDocs) {
        if (seenIds.has(docSnap.id)) continue;
        seenIds.add(docSnap.id);
        const data = docSnap.data();

        if (data.type === 'transferencia') {
          if (data.accountId === resetConfirmId && data.destinationAccountId) {
            const destId = data.destinationAccountId;
            affectedAccounts[destId] = (affectedAccounts[destId] || 0) - data.amount;
          }
          if (data.destinationAccountId === resetConfirmId && data.accountId) {
            const srcId = data.accountId;
            affectedAccounts[srcId] = (affectedAccounts[srcId] || 0) + data.amount;
          }
        }

        batch.delete(docSnap.ref);
        opCount++;

        if (opCount >= MAX_BATCH) {
          await commitBatch();
        }
      }

      for (const [accId, change] of Object.entries(affectedAccounts)) {
        const accRef = doc(db, 'accounts', accId);
        const acc = accounts.find(a => a.id === accId);
        if (acc) {
          batch.update(accRef, { balance: (acc.balance || 0) + change });
          opCount++;
          if (opCount >= MAX_BATCH) {
            await commitBatch();
          }
        }
      }

      const accountRef = doc(db, 'accounts', resetConfirmId);
      batch.update(accountRef, { balance: 0 });
      opCount++;

      await commitBatch();

      toast.success('Conta zerada com sucesso');
      setResetConfirmId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `accounts/${resetConfirmId}`);
      toast.error('Erro ao zerar conta');
    } finally {
      setIsResetting(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', type: 'corrente', balance: 0, agency: '', accountNumber: '', bankCode: '', bankName: '', excludeFromCashFlow: false });
    setBankSearch('');
    setShowBankDropdown(false);
    setEditingId(null);
  };

  const openEdit = (account: any) => {
    setFormData({
      name: account.name,
      type: account.type || 'corrente',
      balance: account.balance,
      agency: account.agency || '',
      accountNumber: account.accountNumber || '',
      bankCode: account.bankCode || '',
      bankName: account.bankName || '',
      excludeFromCashFlow: account.excludeFromCashFlow || false,
    });
    setBankSearch(account.bankName || '');
    setEditingId(account.id);
    setIsDialogOpen(true);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'corrente':
      case 'checking': return <Landmark className="h-6 w-6 text-fiducia-blue" />;
      case 'poupanca':
      case 'savings': return <PiggyBank className="h-6 w-6 text-fiducia-green" />;
      case 'carteira':
      case 'wallet': return <Wallet className="h-6 w-6 text-fiducia-amber" />;
      case 'investment':
      case 'investimento': return <TrendingUp className="h-6 w-6 text-purple-500" />;
      default: return <Landmark className="h-6 w-6" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'corrente':
      case 'checking': return 'Conta Corrente';
      case 'poupanca':
      case 'savings': return 'Poupança';
      case 'carteira':
      case 'wallet': return 'Carteira';
      case 'investment':
      case 'investimento': return 'Investimento';
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h2 className="text-3xl font-bold tracking-tight">Contas</h2>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 h-4 w-4" /> Nova Conta
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Conta' : 'Adicionar Nova Conta'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Conta</Label>
                <Input 
                  id="name" 
                  value={formData.name} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})} 
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Tipo de Conta</Label>
                <Select 
                  value={formData.type} 
                  onValueChange={(value) => setFormData({...formData, type: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo">
                      {getTypeLabel(formData.type)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corrente">Conta Corrente</SelectItem>
                    <SelectItem value="poupanca">Poupança</SelectItem>
                    <SelectItem value="carteira">Carteira</SelectItem>
                    <SelectItem value="investment">Investimento</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 relative">
                <Label>Banco</Label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => { setShowBankDropdown(!showBankDropdown); if (!banks.length) fetchBanks(); }}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-input rounded-lg bg-background text-sm text-left hover:bg-accent/50 transition-colors"
                  >
                    <span className={formData.bankName ? 'text-foreground' : 'text-muted-foreground'}>
                      {formData.bankName || 'Selecione um banco...'}
                    </span>
                    <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />
                  </button>
                  {showBankDropdown && (
                    <div className="absolute z-50 mt-1 w-full bg-background border border-border rounded-xl shadow-lg overflow-hidden">
                      <div className="p-2 border-b border-border">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            placeholder="Buscar banco..."
                            value={bankSearch}
                            onChange={(e) => setBankSearch(e.target.value)}
                            className="pl-9 h-9 text-sm"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {filteredBanks.length === 0 ? (
                          <div className="p-3 text-center text-sm text-muted-foreground">
                            Nenhum banco encontrado
                          </div>
                        ) : (
                          filteredBanks.map((bank) => (
                            <button
                              key={bank.code}
                              type="button"
                              onClick={() => handleBankSelect(bank)}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-accent transition-colors text-left ${
                                 formData.bankCode === String(bank.code) ? 'bg-primary/10 text-primary' : ''
                              }`}
                            >
                              <Building className="w-4 h-4 shrink-0 text-muted-foreground" />
                              <div className="min-w-0 flex-1">
                                <div className="font-medium truncate">{bank.name}</div>
                                <div className="text-xs text-muted-foreground">Cód: {bank.code}</div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {(formData.type === 'corrente' || formData.type === 'checking') && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="agency">Agência</Label>
                    <Input 
                      id="agency" 
                      value={formData.agency} 
                      onChange={(e) => setFormData({...formData, agency: e.target.value})} 
                      placeholder="Ex: 0001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accountNumber">Conta</Label>
                    <Input 
                      id="accountNumber" 
                      value={formData.accountNumber} 
                      onChange={(e) => setFormData({...formData, accountNumber: e.target.value})} 
                      placeholder="Ex: 12345-6"
                    />
                  </div>
                </div>
              )}

              <MoneyInput
                id="balance"
                label="Saldo Inicial"
                value={formData.balance}
                onChange={(v) => setFormData({ ...formData, balance: v })}
                required
              />

              <div className="flex items-center justify-between p-3 border border-border rounded-xl">
                <div>
                  <Label className="text-sm font-medium">Excluir do Fluxo de Caixa</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Contas de investimento ou reserva que não afetam o saldo disponível</p>
                </div>
                <Switch
                  checked={formData.excludeFromCashFlow}
                  onCheckedChange={(v) => setFormData({...formData, excludeFromCashFlow: v})}
                />
              </div>

              <Button type="submit" className="w-full">Salvar Conta</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {accounts.map((account) => (
          <Card key={account.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                {getIcon(account.type)}
                {account.name}
                {account.excludeFromCashFlow && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/30 text-amber-600 dark:text-amber-400">
                    Investimento
                  </Badge>
                )}
              </CardTitle>
              <div className="flex gap-0.5">
                <button onClick={() => openEdit(account)} className="text-muted-foreground hover:text-fiducia-blue min-w-[44px] min-h-[44px] flex items-center justify-center" title="Editar">
                  <Edit className="h-4 w-4" />
                </button>
                <button onClick={() => setResetConfirmId(account.id)} className="text-muted-foreground hover:text-amber-500 min-w-[44px] min-h-[44px] flex items-center justify-center" title="Zerar saldo">
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button onClick={() => setDeleteConfirmId(account.id)} className="text-muted-foreground hover:text-fiducia-red min-w-[44px] min-h-[44px] flex items-center justify-center" title="Excluir">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-fiducia-blue">R$ {account.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="flex flex-col gap-1 mt-2">
                <p className="text-xs text-muted-foreground">
                  {getTypeLabel(account.type)}
                </p>
                {account.bankName && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Building className="w-3 h-3" />
                    {account.bankName}
                  </p>
                )}
                {(account.type === 'corrente' || account.type === 'checking') && (account.agency || account.accountNumber) && (
                  <p className="text-xs text-muted-foreground">
                    {account.agency && `Ag: ${account.agency}`}
                    {account.agency && account.accountNumber && ' | '}
                    {account.accountNumber && `Cc: ${account.accountNumber}`}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {accounts.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
            Nenhuma conta encontrada. Crie uma para começar!
          </div>
        )}
      </div>
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm text-muted-foreground">
            Tem certeza que deseja excluir esta conta? Esta ação não pode ser desfeita.
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetConfirmId} onOpenChange={(open) => !open && setResetConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zerar Conta</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3 text-sm">
            <p className="text-muted-foreground">
              Isso vai <strong>excluir TODAS as transações</strong> desta conta e <strong>zerar o saldo</strong> para R$ 0,00.
            </p>
            <p className="text-muted-foreground">
              Transferências envolvendo esta conta também serão removidas, e os saldos das contas de origem/destino serão ajustados.
            </p>
            <p className="text-amber-600 dark:text-amber-400 font-medium">
              Esta ação não pode ser desfeita.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setResetConfirmId(null)} disabled={isResetting}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReset} disabled={isResetting}>
              {isResetting ? 'Zerando...' : 'Zerar e Apagar Transações'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
