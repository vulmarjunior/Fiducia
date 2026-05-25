import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { Plus, Trash2, Edit, Tag as TagIcon } from 'lucide-react';
import { toast } from 'sonner';

export function Tags() {
  const { user, isAuthReady } = useAuth();
  const [tags, setTags] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', color: '#3b82f6' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmTag, setDeleteConfirmTag] = useState<any | null>(null);

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const q = query(collection(db, 'tags'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTags(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'tags'));

    return () => unsubscribe();
  }, [user, isAuthReady]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.name.trim()) return;

    try {
      const tagData = {
        userId: user.uid,
        name: formData.name.trim(),
        color: formData.color,
        createdAt: new Date().toISOString()
      };

      if (editingId) {
        await updateDoc(doc(db, 'tags', editingId), tagData);
        toast.success('Tag atualizada');
      } else {
        await addDoc(collection(db, 'tags'), tagData);
        toast.success('Tag criada');
      }
      
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'tags');
      toast.error('Erro ao salvar tag');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmTag) return;
    try {
      await deleteDoc(doc(db, 'tags', deleteConfirmTag.id));
      toast.success('Tag excluída');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `tags/${deleteConfirmTag.id}`);
      toast.error('Erro ao excluir tag');
    } finally {
      setDeleteConfirmTag(null);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', color: '#3b82f6' });
    setEditingId(null);
  };

  const openEdit = (tag: any) => {
    setFormData({ name: tag.name, color: tag.color });
    setEditingId(tag.id);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">Tags</h2>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 h-4 w-4" /> Nova Tag
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Tag' : 'Nova Tag'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input 
                  id="name" 
                  value={formData.name} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})} 
                  placeholder="Ex: Viagem, Impostos..."
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="color">Cor</Label>
                <Input 
                  id="color" 
                  type="color"
                  value={formData.color} 
                  onChange={(e) => setFormData({...formData, color: e.target.value})} 
                  className="h-10 p-1 w-full"
                  required 
                />
              </div>
              <Button type="submit" className="w-full">
                {editingId ? 'Atualizar' : 'Salvar'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tags.map((tag) => (
          <Card key={tag.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div 
                    className="p-3 rounded-full"
                    style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                  >
                    <TagIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{tag.name}</h3>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button onClick={() => openEdit(tag)} className="text-muted-foreground hover:text-fiducia-blue">
                    <Edit className="h-4 w-4" />
                  </button>
                  <button onClick={() => setDeleteConfirmTag(tag)} className="text-muted-foreground hover:text-fiducia-red">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {tags.length === 0 && (
          <div className="col-span-full p-8 text-center text-muted-foreground border rounded-lg border-dashed">
            Nenhuma tag encontrada. Adicione uma para começar.
          </div>
        )}
      </div>

      <Dialog open={!!deleteConfirmTag} onOpenChange={(open) => !open && setDeleteConfirmTag(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm text-muted-foreground">
            Tem certeza que deseja excluir esta tag? Esta ação não pode ser desfeita.
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmTag(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
