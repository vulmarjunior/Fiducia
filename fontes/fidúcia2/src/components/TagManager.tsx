import React, { useState } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { Tag } from '../types';
import { ConfirmDialog } from './ConfirmDialog';
import { 
  Tag as TagIcon, 
  Plus, 
  Trash2, 
  Edit2, 
  X, 
  Search,
  Check
} from 'lucide-react';

interface TagManagerProps {
  tags: Tag[];
  onRefresh: () => void;
}

const TAG_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#10b981', '#14b8a6', 
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e',
  '#64748b', '#71717a'
];

export const TagManager: React.FC<TagManagerProps> = ({ tags, onRefresh }) => {
  const { createTag, updateTag, deleteTag, authUser } = useFirebase();

  // Search and view states
  const [searchQuery, setSearchQuery] = useState('');

  // New Tag states
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(TAG_COLORS[0]);

  // Editing Tag states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // Handlers
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !authUser) return;

    try {
      await createTag({
        userId: authUser.uid,
        name: newName,
        color: newColor
      });

      setNewName('');
      setNewColor(TAG_COLORS[0]);
      setIsAdding(false);
      onRefresh();
    } catch (err) {
      console.error('Failed to create tag', err);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !editName.trim()) return;

    try {
      await updateTag(editingId, {
        name: editName,
        color: editColor
      });

      setEditingId(null);
      onRefresh();
    } catch (err) {
      console.error('Failed to update tag', err);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Excluir Tag',
      message: `Tem certeza que deseja excluir a tag "${name}"?\nEsta ação removerá a tag de todos os lançamentos que a utilizam.`,
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      isDestructive: true,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          await deleteTag(id);
          onRefresh();
        } catch (err) {
          console.error('Failed to delete tag', err);
        }
      }
    });
  };

  const startEditing = (tag: Tag) => {
    setEditingId(tag.id || null);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditName('');
    setEditColor('');
  };

  // Filter 
  const filteredTags = tags.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden flex flex-col md:flex-row">
      {/* Sidebar - Add New Tag */}
      <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-border p-6 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-6">
          <TagIcon size={16} className="text-primary" />
          Nova Tag
        </h3>

        {!isAdding ? (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full py-3 px-4 border-2 border-dashed border-border rounded-xl text-sm font-semibold text-muted-foreground hover:text-primary hover:border-primary hover:bg-primary/5 transition flex items-center justify-center gap-2"
          >
            <Plus size={16} /> Adicionar Nova Tag
          </button>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4 animate-fade-in">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1 block">Nome da Tag</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: Viagem Paris, Projeto X"
                required
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-2">Cor</label>
              <div className="flex flex-wrap gap-2">
                {TAG_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewColor(color)}
                    className="w-8 h-8 rounded-full border border-border flex items-center justify-center transition-transform hover:scale-110"
                    style={{ backgroundColor: color }}
                  >
                    {newColor === color && <Check size={14} className="text-white drop-shadow-md" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="flex-1 py-2 px-3 border border-border rounded-xl text-xs font-semibold text-foreground hover:bg-muted transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!newName.trim()}
                className="flex-1 py-2 px-3 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:bg-primary/90 transition disabled:opacity-50"
              >
                Salvar Tag
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Main Content - Tag List */}
      <div className="flex-1 p-6 flex flex-col">
        {/* Header Options */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="text"
              placeholder="Buscar tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-border bg-background text-foreground rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-hidden"
            />
          </div>
        </div>

        {/* Tags List */}
        <div className="flex-1 min-h-[300px]">
          {filteredTags.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-muted/30 rounded-2xl border border-dashed border-border">
              <TagIcon size={40} className="text-muted-foreground mb-3 opacity-20" />
              <p className="text-sm font-semibold text-foreground">Nenhuma tag encontrada</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">{searchQuery ? 'Tente buscar com outro termo' : 'Nenhuma tag cadastrada.'}</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {filteredTags.map(tag => (
                <div key={tag.id} className="group">
                  {editingId === tag.id ? (
                      <form onSubmit={handleUpdate} className="flex items-center gap-2 bg-card border border-border p-2 rounded-xl shadow-xs">
                        <div className="flex flex-wrap max-w-[80px] sm:max-w-[120px] gap-1 h-8 shrink-0 overflow-y-auto">
                          {TAG_COLORS.map(color => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setEditColor(color)}
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: color, border: editColor === color ? '2px solid white' : 'none' }}
                            />
                          ))}
                        </div>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-32 px-2 py-1 bg-background border border-border rounded text-sm focus:outline-none"
                          autoFocus
                          required
                        />
                        <button type="button" onClick={cancelEditing} className="p-1 text-muted-foreground hover:bg-muted rounded"><X size={14}/></button>
                        <button type="submit" className="p-1 text-green-500 hover:bg-green-500/10 rounded"><Check size={14}/></button>
                      </form>
                  ) : (
                    <div 
                      className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full text-sm font-medium border shadow-xs"
                      style={{ backgroundColor: `${tag.color}15`, borderColor: `${tag.color}30`, color: tag.color }}
                    >
                      <TagIcon size={12} fill={tag.color} className="opacity-70" />
                      {tag.name}
                      <div className="w-[1px] h-4 mx-1 opacity-20" style={{ backgroundColor: tag.color }}></div>
                      <div className="flex items-center">
                        <button onClick={() => startEditing(tag)} className="p-1 opacity-50 hover:opacity-100 transition"><Edit2 size={12}/></button>
                        <button onClick={() => handleDelete(tag.id!, tag.name)} className="p-1 opacity-50 hover:opacity-100 hover:text-red-500 transition"><Trash2 size={12}/></button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <ConfirmDialog
        {...confirmDialog}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
