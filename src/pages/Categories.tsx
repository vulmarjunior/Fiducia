import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { logActivity } from '../services/activityLogService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Tags, Plus, Trash2, Edit, Download, Layers, HelpCircle, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { CATEGORY_ICONS, getCategoryIcon, suggestIcon, DEFAULT_TEMPLATES } from '../lib/categoryIcons';
import { PageHelp } from '../components/PageHelp';
import { DEFAULT_CATEGORY_TREE } from '../lib/defaultCategories';
import { writeBatch } from 'firebase/firestore';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableCategoryItem({ cat, level, children, onEdit, onDelete }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 0,
    position: isDragging ? 'relative' as const : 'static' as const,
  };
  const Icon = getCategoryIcon(cat.icon);
  const isIncome = cat.type === 'receita' || cat.type === 'income';

  return (
    <div ref={setNodeRef} style={style} className="flex flex-col">
      <div className={`flex items-center justify-between p-2 hover:bg-secondary rounded-md border border-border bg-card ${level > 0 ? 'ml-6 border-l-4 border-l-muted-foreground' : ''}`}>
        <div className="flex items-center gap-3">
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1 -ml-1">
            <GripVertical className="h-4 w-4" />
          </div>
          <div className={`p-1.5 rounded-lg ${isIncome ? 'bg-fiducia-green/10 text-fiducia-green' : 'bg-fiducia-red/10 text-fiducia-red'}`}>
            <Icon className="h-4 w-4" />
          </div>
          <span className="font-medium text-[13px]">{cat.name}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onEdit(cat)} className="text-muted-foreground hover:text-fiducia-blue min-w-[44px] min-h-[44px] flex items-center justify-center">
            <Edit className="h-4 w-4" />
          </button>
          <button onClick={() => onDelete(cat.id)} className="text-muted-foreground hover:text-fiducia-red min-w-[44px] min-h-[44px] flex items-center justify-center">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

export function Categories() {
  const { user, isAuthReady } = useAuth();
  const [categories, setCategories] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [batchType, setBatchType] = useState('despesa');
  const [formData, setFormData] = useState({ name: '', type: 'despesa', parentId: 'nenhuma', icon: 'HelpCircle' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [iconSearch, setIconSearch] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeCat = categories.find(c => c.id === active.id);
    const overCat = categories.find(c => c.id === over.id);

    if (!activeCat || !overCat) return;
    
    if ((activeCat.parentId || null) !== (overCat.parentId || null)) {
      toast.error("Só é possível reordenar categorias do mesmo nível.");
      return;
    }

    const parentId = activeCat.parentId || null;
    const siblings = categories
      .filter(c => (c.parentId || null) === parentId && c.type === activeCat.type)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    const oldIndex = siblings.findIndex(c => c.id === active.id);
    const newIndex = siblings.findIndex(c => c.id === over.id);

    const newSiblings = arrayMove(siblings, oldIndex, newIndex);

    const batch = writeBatch(db);
    newSiblings.forEach((cat: any, index) => {
      batch.update(doc(db, 'categories', cat.id), { order: index });
    });

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'categories');
      toast.error('Erro ao reordenar categorias');
    }
  };

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const q = query(collection(db, 'categories'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCategories(data);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'categories'));

    return () => unsubscribe();
  }, [user, isAuthReady]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
        const siblings = categories.filter(c => c.type === formData.type && (c.parentId || 'nenhuma') === formData.parentId);
        const nextOrder = siblings.length > 0 ? Math.max(...siblings.map(c => c.order || 0)) + 1 : 0;

        const categoryData: any = {
          userId: user.uid,
          name: formData.name,
          type: formData.type,
          icon: formData.icon || suggestIcon(formData.name),
          isDefault: false,
          order: nextOrder,
          createdAt: new Date().toISOString()
        };
        
        if (formData.parentId !== 'nenhuma') {
          categoryData.parentId = formData.parentId;
        }
  
        if (editingId) {
          await updateDoc(doc(db, 'categories', editingId), {
            name: categoryData.name,
            type: categoryData.type,
            icon: categoryData.icon,
            parentId: formData.parentId === 'nenhuma' ? null : formData.parentId
          });
          logActivity({ userId: user.uid, action: 'update', entityType: 'category', entityId: editingId, description: `Categoria editada: ${categoryData.name}` }).catch(() => {});
          toast.success('Categoria atualizada com sucesso');
        } else {
          const catRef = await addDoc(collection(db, 'categories'), categoryData);
          logActivity({ userId: user.uid, action: 'create', entityType: 'category', entityId: catRef.id, description: `Categoria criada: ${categoryData.name}` }).catch(() => {});
          toast.success('Categoria criada com sucesso');
        }
      
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'categories');
      toast.error('Falha ao salvar categoria');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      const deleted = categories.find(c => c.id === deleteConfirmId);
      await deleteDoc(doc(db, 'categories', deleteConfirmId));
      logActivity({ userId: user.uid, action: 'delete', entityType: 'category', entityId: deleteConfirmId, description: `Categoria excluída: ${deleted?.name || deleteConfirmId}` }).catch(() => {});
      toast.success('Categoria excluída');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `categories/${deleteConfirmId}`);
      toast.error('Falha ao excluir categoria');
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleResetCategories = async () => {
    if (!user) return;
    try {
      const batch = writeBatch(db);
      const q = query(collection(db, 'categories'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        toast.info('Não há categorias para excluir.');
        setIsResetDialogOpen(false);
        return;
      }

      snapshot.docs.forEach((docSnapshot) => {
        batch.delete(docSnapshot.ref);
      });

      await batch.commit();
      logActivity({ userId: user.uid, action: 'delete', entityType: 'category', entityId: 'batch', description: 'Todas as categorias excluídas' }).catch(() => {});
      toast.success('Todas as categorias foram excluídas.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'categories (batch)');
      toast.error('Erro ao excluir categorias.');
    } finally {
      setIsResetDialogOpen(false);
    }
  };

  const handleImportDefaults = async () => {
    if (!user) return;

    try {
      const batch = writeBatch(db);
      let added = 0;

      for (const group of DEFAULT_CATEGORY_TREE) {
        const catType = group.type === 'expense' ? 'despesa' : 'receita';

        const parentExists = categories.some(c =>
          c.name.toLowerCase() === group.name.toLowerCase() &&
          (c.type === catType || (catType === 'despesa' && c.type === 'expense') || (catType === 'receita' && c.type === 'income'))
        );

        let parentId: string | null = null;

        if (!parentExists) {
          const parentRef = doc(collection(db, 'categories'));
          batch.set(parentRef, {
            userId: user.uid,
            name: group.name,
            type: catType,
            icon: group.icon,
            isDefault: true,
            createdAt: new Date().toISOString()
          });
          parentId = parentRef.id;
          added++;
        } else {
          const existing = categories.find(c =>
            c.name.toLowerCase() === group.name.toLowerCase() &&
            (c.type === catType || (catType === 'despesa' && c.type === 'expense') || (catType === 'receita' && c.type === 'income'))
          );
          parentId = existing?.id || null;
        }

        for (const sub of group.subs) {
          const subExists = categories.some(c =>
            c.name.toLowerCase() === sub.name.toLowerCase() &&
            c.parentId === parentId
          );

          if (!subExists) {
            const subRef = doc(collection(db, 'categories'));
            batch.set(subRef, {
              userId: user.uid,
              name: sub.name,
              type: catType,
              icon: sub.icon,
              isDefault: true,
              parentId: parentId,
              createdAt: new Date().toISOString()
            });
            added++;
          }
        }
      }

      if (added > 0) {
        await batch.commit();
        logActivity({ userId: user.uid, action: 'create', entityType: 'category', entityId: 'batch', description: `${added} categorias padrão importadas` }).catch(() => {});
        toast.success(`${added} categorias padrão importadas com sucesso.`);
      } else {
        toast.info('Todas as categorias padrão já existem.');
      }
    } catch (error) {
      console.error('Erro ao importar padrões:', error);
      handleFirestoreError(error, OperationType.CREATE, 'categories');
      toast.error('Falha ao importar categorias padrão');
    }
  };

  const handleBatchImport = async () => {
    if (!user || !batchText.trim()) return;

    const lines = batchText.split('\n').filter(l => l.trim());
    const batch = writeBatch(db);
    let added = 0;
    
    // Track newly created categories in this batch to prevent duplicates
    const newCategories: { id: string, name: string, type: string, parentId: string | null }[] = [];
    const orderCounters: Record<string, number> = {};

    try {
      for (const line of lines) {
        const parts = line.split('>').map(p => p.trim());
        let currentParentId: string | null = null;

        for (const part of parts) {
          // Check if category already exists in DB
          let existing = categories.find(c => 
            c.name.toLowerCase() === part.toLowerCase() && 
            c.type === batchType &&
            (c.parentId || null) === currentParentId
          );

          // Check if category was just created in this batch
          if (!existing) {
            const newlyCreated = newCategories.find(c => 
              c.name.toLowerCase() === part.toLowerCase() && 
              c.type === batchType &&
              c.parentId === currentParentId
            );
            if (newlyCreated) {
              existing = { id: newlyCreated.id } as any;
            }
          }

          if (!existing) {
            const newDocRef = doc(collection(db, 'categories'));
            const newId = newDocRef.id;
            const icon = suggestIcon(part);
            
            const parentKey = `${batchType}_${currentParentId || 'root'}`;
            if (orderCounters[parentKey] === undefined) {
              const existingSiblings = categories.filter(c => c.type === batchType && (c.parentId || null) === currentParentId);
              orderCounters[parentKey] = existingSiblings.length > 0 ? Math.max(...existingSiblings.map(c => c.order || 0)) + 1 : 0;
            }

            batch.set(newDocRef, {
              userId: user.uid,
              name: part,
              type: batchType,
              icon: icon,
              isDefault: false,
              parentId: currentParentId,
              order: orderCounters[parentKey]++,
              createdAt: new Date().toISOString()
            });
            
            newCategories.push({
              id: newId,
              name: part,
              type: batchType,
              parentId: currentParentId
            });
            
            currentParentId = newId;
            added++;
          } else {
            currentParentId = existing.id;
          }
        }
      }

      await batch.commit();
      logActivity({ userId: user.uid, action: 'create', entityType: 'category', entityId: 'batch', description: `${added} categorias criadas em lote` }).catch(() => {});
      toast.success(`${added} novas categorias criadas.`);
      setIsBatchDialogOpen(false);
      setBatchText('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'categories');
      toast.error('Erro na importação em lote');
    }
  };

  const resetForm = () => {
    setFormData({ name: '', type: 'despesa', parentId: 'nenhuma', icon: 'HelpCircle' });
    setEditingId(null);
    setIconSearch('');
  };

  const openEdit = (category: any) => {
    setFormData({ 
      name: category.name, 
      type: category.type,
      parentId: category.parentId || 'nenhuma',
      icon: category.icon || 'HelpCircle'
    });
    setEditingId(category.id);
    setIsDialogOpen(true);
  };

  const expenses = categories.filter(c => c.type === 'despesa' || c.type === 'expense');
  const incomes = categories.filter(c => c.type === 'receita' || c.type === 'income');

  const renderCategoryList = (cats: any[], parentId: string | null = null, level: number = 0) => {
    const filtered = cats
      .filter(c => (c.parentId || null) === parentId)
      .sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) {
          return a.order - b.order;
        }
        return a.name.localeCompare(b.name);
      });

    if (filtered.length === 0) return null;

    return (
      <SortableContext items={filtered.map(c => c.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-1">
          {filtered.map(cat => (
            <SortableCategoryItem 
              key={cat.id} 
              cat={cat} 
              level={level} 
              onEdit={openEdit} 
              onDelete={setDeleteConfirmId}
            >
              {renderCategoryList(cats, cat.id, level + 1)}
            </SortableCategoryItem>
          ))}
        </div>
      </SortableContext>
    );
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="space-y-6">
        <div className="flex justify-between items-center flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-3xl font-bold tracking-tight">Categorias</h2>
          <PageHelp
            title="Categorias"
            description="Organize seus lançamentos com categorias (Alimentação, Transporte, Salário, etc.). Suporta subcategorias para uma classificação mais detalhada."
            items={[
              { label: "Tipo", desc: "Cada categoria pode ser de receita ou despesa. Aparecerão nos campos correspondentes ao criar lançamentos." },
              { label: "Subcategoria", desc: "Defina uma categoria pai para criar hierarquia. Ex: 'Transporte' > 'Combustível' e 'Estacionamento'." },
              { label: "Ordem", desc: "Arraste para reordenar. A ordem é refletida nos dropdowns de lançamentos." },
            ]}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Dialog open={isBatchDialogOpen} onOpenChange={setIsBatchDialogOpen}>
            <DialogTrigger render={<Button variant="outline" />}>
              <Layers className="mr-2 h-4 w-4" /> Importação em Lote
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Importação em Lote</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Tipo das Categorias</Label>
                  <Select value={batchType} onValueChange={setBatchType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo">
                        {batchType === 'despesa' ? 'Despesa' : batchType === 'receita' ? 'Receita' : 'Selecione o tipo'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="despesa">Despesa</SelectItem>
                      <SelectItem value="receita">Receita</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Lista de Categorias (uma por linha)</Label>
                  <textarea 
                    className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Ex: Alimentação&#10;Transporte > Combustível&#10;Lazer > Cinema"
                    value={batchText}
                    onChange={(e) => setBatchText(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground italic">Use {'>'} para criar subcategorias.</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setBatchText(DEFAULT_TEMPLATES.pessoal.map(c => c.name).join('\n'))}>Template Pessoal</Button>
                  <Button variant="secondary" size="sm" onClick={() => setBatchText(DEFAULT_TEMPLATES.empresarial.map(c => c.name).join('\n'))}>Template Empresarial</Button>
                </div>
                <Button className="w-full" onClick={handleBatchImport}>Importar Agora</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Button variant="outline" onClick={handleImportDefaults}>
            <Download className="mr-2 h-4 w-4" /> Importar Padrões
          </Button>
          <Button variant="outline" onClick={() => setIsResetDialogOpen(true)} className="text-fiducia-red hover:text-fiducia-red hover:bg-fiducia-red/10 border-fiducia-red/20">
            <Trash2 className="mr-2 h-4 w-4" /> Zerar Categorias
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger render={<Button />}>
              <Plus className="mr-2 h-4 w-4" /> Nova Categoria
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? 'Editar Categoria' : 'Adicionar Nova Categoria'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Categoria</Label>
                  <Input 
                    id="name" 
                    value={formData.name} 
                    onChange={(e) => setFormData({...formData, name: e.target.value})} 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ícone</Label>
                  <Input 
                    placeholder="Buscar ícone..." 
                    value={iconSearch}
                    onChange={(e) => setIconSearch(e.target.value)}
                    className="mb-2 h-8 text-sm"
                  />
                  <div className="grid grid-cols-5 sm:grid-cols-8 gap-2 p-2 border rounded-md max-h-[40vh] overflow-y-auto">
                    {Object.keys(CATEGORY_ICONS)
                      .filter(iconName => iconName.toLowerCase().includes(iconSearch.toLowerCase()))
                      .slice(0, 100) // Limita a 100 ícones para não travar a renderização
                      .map(iconName => {
                      const IconComp = CATEGORY_ICONS[iconName];
                      return (
                        <button
                          key={iconName}
                          type="button"
                          onClick={() => setFormData({...formData, icon: iconName})}
                          className={`p-2 rounded-md hover:bg-secondary flex items-center justify-center ${formData.icon === iconName ? 'bg-fiducia-blue text-white' : 'text-muted-foreground'}`}
                          title={iconName}
                        >
                          <IconComp className="h-4 w-4" />
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 text-right">
                    {Object.keys(CATEGORY_ICONS).filter(iconName => iconName.toLowerCase().includes(iconSearch.toLowerCase())).length > 100 
                      ? `Mostrando 100 de ${Object.keys(CATEGORY_ICONS).filter(iconName => iconName.toLowerCase().includes(iconSearch.toLowerCase())).length} ícones. Digite para filtrar mais.` 
                      : `${Object.keys(CATEGORY_ICONS).filter(iconName => iconName.toLowerCase().includes(iconSearch.toLowerCase())).length} ícones encontrados.`}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Tipo</Label>
                  <Select 
                    value={formData.type} 
                    onValueChange={(value) => setFormData({...formData, type: value, parentId: 'nenhuma'})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo">
                        {formData.type === 'despesa' ? 'Despesa' : formData.type === 'receita' ? 'Receita' : 'Selecione o tipo'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="despesa">Despesa</SelectItem>
                      <SelectItem value="receita">Receita</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parentId">Categoria Pai (Opcional)</Label>
                  <Select 
                    value={formData.parentId} 
                    onValueChange={(value) => setFormData({...formData, parentId: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Nenhuma">
                        {formData.parentId === 'nenhuma' 
                          ? 'Nenhuma (Categoria Principal)' 
                          : categories.find(c => c.id === formData.parentId)?.name || 'Categoria Desconhecida'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhuma">Nenhuma (Categoria Principal)</SelectItem>
                      {categories
                        .filter(c => (c.type === formData.type || (formData.type === 'despesa' && c.type === 'expense') || (formData.type === 'receita' && c.type === 'income')) && !c.parentId && c.id !== editingId)
                        .map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full">Salvar Categoria</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-fiducia-red flex items-center gap-2">
              <Tags className="h-5 w-5" /> Despesas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {renderCategoryList(expenses)}
              {expenses.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma categoria de despesa.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-fiducia-green flex items-center gap-2">
              <Tags className="h-5 w-5" /> Receitas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {renderCategoryList(incomes)}
              {incomes.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma categoria de receita.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm text-muted-foreground">
            Tem certeza que deseja excluir esta categoria? Esta ação não pode ser desfeita.
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-fiducia-red">Zerar Todas as Categorias</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm text-muted-foreground">
            <p className="mb-2"><strong>Atenção!</strong> Esta ação irá excluir <strong>todas</strong> as suas categorias permanentemente.</p>
            <p>Isso pode afetar lançamentos e orçamentos que dependem dessas categorias. Tem certeza absoluta que deseja continuar?</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsResetDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleResetCategories}>Sim, excluir tudo</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </DndContext>
  );
}
