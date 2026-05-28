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
import { PieChart, Plus, Trash2, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { PageHelp } from '../components/PageHelp';
import { MoneyInput } from '../components/MoneyInput';
import { logActivity } from '../services/activityLogService';

export function Budgets() {
  const { user, isAuthReady } = useAuth();
  const [budgets, setBudgets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ categoryId: '', amount: 0, period: 'monthly' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const q = query(collection(db, 'budgets'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBudgets(data);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'budgets'));

    const cQuery = query(collection(db, 'categories'), where('userId', '==', user.uid));
    const unsubscribeC = onSnapshot(cQuery, (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'categories'));

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const tQuery = query(collection(db, 'transactions'), where('userId', '==', user.uid), where('date', '>=', startOfMonth));
    const unsubscribeT = onSnapshot(tQuery, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'transactions'));

    return () => {
      unsubscribe();
      unsubscribeC();
      unsubscribeT();
    };
  }, [user, isAuthReady]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const amount = formData.amount;
      if (amount <= 0) {
        toast.error('O valor deve ser válido e maior que zero');
        return;
      }

      const budgetData = {
        userId: user.uid,
        categoryId: formData.categoryId,
        amount: amount,
        period: formData.period,
        createdAt: new Date().toISOString()
      };

      if (editingId) {
        await updateDoc(doc(db, 'budgets', editingId), {
          categoryId: budgetData.categoryId,
          amount: budgetData.amount,
          period: budgetData.period
        });
        logActivity({ userId: user.uid, action: 'update', entityType: 'budget', entityId: editingId, description: `Orçamento editado: ${formData.categoryId}` }).catch(() => {});
        toast.success('Orçamento atualizado com sucesso');
      } else {
        const budgetRef = await addDoc(collection(db, 'budgets'), budgetData);
        logActivity({ userId: user.uid, action: 'create', entityType: 'budget', entityId: budgetRef.id, description: `Orçamento criado` }).catch(() => {});
        toast.success('Orçamento criado com sucesso');
      }
      
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'budgets');
      toast.error('Falha ao salvar orçamento');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      const deleted = budgets.find(b => b.id === deleteConfirmId);
      await deleteDoc(doc(db, 'budgets', deleteConfirmId));
      logActivity({ userId: user.uid, action: 'delete', entityType: 'budget', entityId: deleteConfirmId, description: `Orçamento excluído: ${deleted?.categoryId || deleteConfirmId}` }).catch(() => {});
      toast.success('Orçamento excluído');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `budgets/${deleteConfirmId}`);
      toast.error('Falha ao excluir orçamento');
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const resetForm = () => {
    setFormData({ categoryId: '', amount: 0, period: 'monthly' });
    setEditingId(null);
  };

  const openEdit = (budget: any) => {
    setFormData({ categoryId: budget.categoryId, amount: budget.amount, period: budget.period });
    setEditingId(budget.id);
    setIsDialogOpen(true);
  };

  const expenseCategories = categories.filter(c => c.type === 'despesa' || c.type === 'expense');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-3xl font-bold tracking-tight">Orçamentos</h2>
          <PageHelp
            title="Orçamentos"
            description="Defina limites mensais de gastos por categoria e acompanhe quanto já foi utilizado. O sistema alerta quando você se aproxima do limite."
            items={[
              { label: "Limite Mensal", desc: "Valor máximo que você pretende gastar em uma categoria a cada mês." },
              { label: "Acompanhamento", desc: "A barra de progresso mostra o percentual usado. O orçamento reinicia automaticamente a cada mês." },
            ]}
          />
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 h-4 w-4" /> Novo Orçamento
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Orçamento' : 'Adicionar Novo Orçamento'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Select 
                  value={formData.categoryId} 
                  onValueChange={(value) => setFormData({...formData, categoryId: value})}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria">
                      {formData.categoryId ? expenseCategories.find(c => c.id === formData.categoryId)?.name || 'Categoria Desconhecida' : 'Selecione a categoria'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <MoneyInput
                id="amount"
                label="Valor Limite"
                value={formData.amount}
                onChange={(v) => setFormData({ ...formData, amount: v })}
                required
              />
              <div className="space-y-2">
                <Label htmlFor="period">Período</Label>
                <Select 
                  value={formData.period} 
                  onValueChange={(value) => setFormData({...formData, period: value})}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o período">
                      {formData.period === 'monthly' ? 'Mensal' : formData.period === 'weekly' ? 'Semanal' : formData.period === 'yearly' ? 'Anual' : 'Selecione o período'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="yearly">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full">Salvar Orçamento</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {budgets.map((budget) => {
          const category = categories.find(c => c.id === budget.categoryId);
          const spent = transactions
            .filter(t => t.categoryId === budget.categoryId && (t.type === 'despesa' || t.type === 'expense'))
            .reduce((sum, t) => sum + t.amount, 0);
          const percentage = Math.min(100, Math.round((spent / budget.amount) * 100));
          const isOverBudget = spent > budget.amount;

          return (
            <Card key={budget.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-fiducia-blue" />
                  {category?.name || 'Categoria Excluída'}
                </CardTitle>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(budget)} className="text-muted-foreground hover:text-fiducia-blue min-w-[44px] min-h-[44px] flex items-center justify-center">
                    <Edit className="h-4 w-4" />
                  </button>
                  <button onClick={() => setDeleteConfirmId(budget.id)} className="text-muted-foreground hover:text-fiducia-red min-w-[44px] min-h-[44px] flex items-center justify-center">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mt-2">
                  <div className="flex justify-between items-baseline mb-1.5">
                    <span className="text-[12.5px] font-medium">Gasto: R$ {spent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className="text-[11px] text-muted-foreground font-mono">de R$ {budget.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="h-[6px] bg-secondary rounded-[3px] overflow-hidden">
                    <div 
                      className={`h-full rounded-[3px] ${isOverBudget ? 'bg-fiducia-red' : percentage > 80 ? 'bg-fiducia-amber' : 'bg-fiducia-green'}`} 
                      style={{ width: `${percentage}%` }} 
                    />
                  </div>
                  <div className="mt-2 text-xs text-right text-muted-foreground">
                    {percentage}% utilizado
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {budgets.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
            Nenhum orçamento encontrado. Crie um para começar a planejar!
          </div>
        )}
      </div>
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm text-muted-foreground">
            Tem certeza que deseja excluir este orçamento? Esta ação não pode ser desfeita.
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
