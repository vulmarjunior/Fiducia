import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Target, Plus, Trash2, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { MoneyInput } from '../components/MoneyInput';

export function Goals() {
  const { user, isAuthReady } = useAuth();
  const [goals, setGoals] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', targetAmount: 0, currentAmount: 0, deadline: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const q = query(collection(db, 'goals'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGoals(data);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'goals'));

    return () => unsubscribe();
  }, [user, isAuthReady]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const targetAmount = formData.targetAmount;
      const currentAmount = formData.currentAmount;

      if (targetAmount <= 0) {
        toast.error('O valor da meta deve ser válido e maior que zero');
        return;
      }

      const goalData = {
        userId: user.uid,
        name: formData.name,
        targetAmount,
        currentAmount: isNaN(currentAmount) ? 0 : currentAmount,
        deadline: formData.deadline,
        createdAt: new Date().toISOString()
      };

      if (editingId) {
        await updateDoc(doc(db, 'goals', editingId), {
          name: goalData.name,
          targetAmount: goalData.targetAmount,
          currentAmount: goalData.currentAmount,
          deadline: goalData.deadline
        });
        toast.success('Meta atualizada com sucesso');
      } else {
        await addDoc(collection(db, 'goals'), goalData);
        toast.success('Meta criada com sucesso');
      }
      
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'goals');
      toast.error('Falha ao salvar meta');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteDoc(doc(db, 'goals', deleteConfirmId));
      toast.success('Meta excluída');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `goals/${deleteConfirmId}`);
      toast.error('Falha ao excluir meta');
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', targetAmount: 0, currentAmount: 0, deadline: '' });
    setEditingId(null);
  };

  const openEdit = (goal: any) => {
    setFormData({ 
      name: goal.name, 
      targetAmount: goal.targetAmount, 
      currentAmount: goal.currentAmount,
      deadline: goal.deadline || ''
    });
    setEditingId(goal.id);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">Metas</h2>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 h-4 w-4" /> Nova Meta
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Meta' : 'Adicionar Nova Meta'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Meta</Label>
                <Input 
                  id="name" 
                  value={formData.name} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})} 
                  required 
                />
              </div>
              <MoneyInput
                id="targetAmount"
                label="Valor da Meta"
                value={formData.targetAmount}
                onChange={(v) => setFormData({ ...formData, targetAmount: v })}
                required
              />
              <MoneyInput
                id="currentAmount"
                label="Valor Atual (Guardado)"
                value={formData.currentAmount}
                onChange={(v) => setFormData({ ...formData, currentAmount: v })}
              />
              <div className="space-y-2">
                <Label htmlFor="deadline">Data Limite (Opcional)</Label>
                <Input 
                  id="deadline" 
                  type="date"
                  value={formData.deadline} 
                  onChange={(e) => setFormData({...formData, deadline: e.target.value})} 
                />
              </div>
              <Button type="submit" className="w-full">Salvar Meta</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {goals.map((goal) => {
          const percentage = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));

          return (
            <Card key={goal.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                  <Target className="h-5 w-5 text-fiducia-blue" />
                  {goal.name}
                </CardTitle>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(goal)} className="text-muted-foreground hover:text-fiducia-blue">
                    <Edit className="h-4 w-4" />
                  </button>
                  <button onClick={() => setDeleteConfirmId(goal.id)} className="text-muted-foreground hover:text-fiducia-red">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mt-2">
                  <div className="flex justify-between items-baseline mb-1.5">
                    <span className="text-[12.5px] font-medium">R$ {goal.currentAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className="text-[11px] text-muted-foreground font-mono">de R$ {goal.targetAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="h-[6px] bg-secondary rounded-[3px] overflow-hidden">
                    <div 
                      className="h-full rounded-[3px] bg-fiducia-blue" 
                      style={{ width: `${percentage}%` }} 
                    />
                  </div>
                  <div className="mt-2 flex justify-between items-center text-xs text-muted-foreground">
                    <span>{percentage}% concluído</span>
                    {goal.deadline && (
                      <span>Até {new Date(goal.deadline).toLocaleDateString('pt-BR')}</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {goals.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
            Nenhuma meta encontrada. Crie uma para começar a poupar!
          </div>
        )}
      </div>
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm text-muted-foreground">
            Tem certeza que deseja excluir esta meta? Esta ação não pode ser desfeita.
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
