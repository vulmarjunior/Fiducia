import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Wallet, Landmark, PiggyBank, Plus, Trash2, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { MoneyInput } from '../components/MoneyInput';

export function Accounts() {
  const { user, isAuthReady } = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', type: 'corrente', balance: 0, agency: '', accountNumber: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const q = query(collection(db, 'accounts'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAccounts(data);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'accounts'));

    return () => unsubscribe();
  }, [user, isAuthReady]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const balance = formData.balance;
      
      const accountData: any = {
        userId: user.uid,
        name: formData.name,
        type: formData.type,
        balance: balance,
        createdAt: new Date().toISOString()
      };

      if (formData.type === 'corrente' || formData.type === 'checking') {
        if (formData.agency) accountData.agency = formData.agency;
        if (formData.accountNumber) accountData.accountNumber = formData.accountNumber;
      }

      if (editingId) {
        const updateData: any = {
          name: accountData.name,
          type: accountData.type,
          balance: accountData.balance
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

  const resetForm = () => {
    setFormData({ name: '', type: 'corrente', balance: 0, agency: '', accountNumber: '' });
    setEditingId(null);
  };

  const openEdit = (account: any) => {
    setFormData({ 
      name: account.name, 
      type: account.type || 'corrente', 
      balance: account.balance,
      agency: account.agency || '',
      accountNumber: account.accountNumber || ''
    });
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
      default: return <Landmark className="h-6 w-6" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
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
                      {formData.type === 'corrente' ? 'Conta Corrente' : formData.type === 'poupanca' ? 'Poupança' : formData.type === 'carteira' ? 'Carteira' : 'Selecione o tipo'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corrente">Conta Corrente</SelectItem>
                    <SelectItem value="poupanca">Poupança</SelectItem>
                    <SelectItem value="carteira">Carteira</SelectItem>
                  </SelectContent>
                </Select>
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
              </CardTitle>
              <div className="flex gap-2">
                <button onClick={() => openEdit(account)} className="text-muted-foreground hover:text-fiducia-blue">
                  <Edit className="h-4 w-4" />
                </button>
                <button onClick={() => setDeleteConfirmId(account.id)} className="text-muted-foreground hover:text-fiducia-red">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-fiducia-blue">R$ {account.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="flex flex-col gap-1 mt-2">
                <p className="text-xs text-muted-foreground capitalize">
                  {account.type === 'corrente' || account.type === 'checking' ? 'Conta Corrente' : account.type === 'poupanca' || account.type === 'savings' ? 'Poupança' : 'Carteira'}
                </p>
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
    </div>
  );
}
