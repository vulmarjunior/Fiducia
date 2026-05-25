import React, { useState } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { Category } from '../types';
import { ConfirmDialog } from './ConfirmDialog';
import { 
  Briefcase, 
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownToLine, 
  Utensils, 
  Car, 
  Home, 
  Film, 
  Heart, 
  GraduationCap, 
  ShoppingBag,
  DollarSign,
  Zap,
  Droplets,
  Users,
  Shirt,
  Sofa,
  Wrench,
  ShoppingCart,
  Apple,
  Truck,
  Coffee,
  Pizza,
  Fuel,
  Shield,
  FileText,
  ParkingCircle,
  AlertTriangle,
  Bus,
  HeartPulse,
  Stethoscope,
  Smile,
  Pill,
  Activity,
  Scissors,
  Hand,
  Sparkles,
  Bath,
  Star,
  Dumbbell,
  BaggageClaim,
  BookOpen,
  Landmark,
  Video,
  Book,
  Backpack,
  Ticket,
  Music,
  Gamepad2,
  Palette,
  Plane,
  Hotel,
  Map,
  Watch,
  Laptop,
  Refrigerator,
  Bed,
  Gift,
  Baby,
  Globe,
  Tv,
  CreditCard,
  Wifi,
  Smartphone,
  Percent,
  Banknote,
  Building,
  Paperclip,
  Sun,
  Award,
  Undo,
  ArrowRightLeft,
  Download,
  Plus, 
  Trash2, 
  Edit2, 
  X, 
  Search,
  Check,
  AlertCircle
} from 'lucide-react';

// Help helper to get corresponding Lucide icon component
export const getCategoryIcon = (iconName: string, size = 16, className = '') => {
  const iconMap: { [key: string]: React.ComponentType<any> } = {
    Briefcase,
    TrendingUp,
    TrendingDown,
    ArrowUpRight,
    ArrowDownToLine,
    Utensils,
    Car,
    Home,
    Film,
    Heart,
    GraduationCap,
    ShoppingBag,
    DollarSign,
    Zap,
    Droplets,
    Users,
    Shirt,
    Sofa,
    Wrench,
    ShoppingCart,
    Apple,
    Truck,
    Coffee,
    Pizza,
    Fuel,
    Shield,
    FileText,
    ParkingCircle,
    AlertTriangle,
    Bus,
    HeartPulse,
    Stethoscope,
    Smile,
    Pill,
    Activity,
    Scissors,
    Hand,
    Sparkles,
    Bath,
    Star,
    Dumbbell,
    BaggageClaim,
    BookOpen,
    Landmark,
    Video,
    Book,
    Backpack,
    Ticket,
    Music,
    Gamepad2,
    Palette,
    Plane,
    Hotel,
    Map,
    Watch,
    Laptop,
    Refrigerator,
    Bed,
    Gift,
    Baby,
    Globe,
    Tv,
    CreditCard,
    Wifi,
    Smartphone,
    Percent,
    Banknote,
    Building,
    Paperclip,
    Sun,
    Award,
    Undo,
    ArrowRightLeft,
    Download
  };

  const IconComp = iconMap[iconName] || DollarSign;
  return <IconComp size={size} className={className} />;
};

const AVAILABLE_ICONS = [
    { name: 'Home', label: 'Moradia / Casa' },
    { name: 'Zap', label: 'Energia' },
    { name: 'Droplets', label: 'Água / Lava-jato' },
    { name: 'Users', label: 'Empregados / Prestadores' },
    { name: 'Shirt', label: 'Lavanderia / Vestuário' },
    { name: 'Sofa', label: 'Mobiliário' },
    { name: 'Wrench', label: 'Reparos / Manutenção' },
    { name: 'ShoppingCart', label: 'Supermercado' },
    { name: 'Apple', label: 'Feira / Orgânicos' },
    { name: 'Utensils', label: 'Restaurante / Alimentação' },
    { name: 'Truck', label: 'Delivery' },
    { name: 'Coffee', label: 'Café / Utensílios' },
    { name: 'Pizza', label: 'Lanches' },
    { name: 'Fuel', label: 'Combustível' },
    { name: 'Car', label: 'Veículo / Táxi' },
    { name: 'Shield', label: 'Seguro' },
    { name: 'FileText', label: 'Impostos / Tributos' },
    { name: 'ParkingCircle', label: 'Estacionamento' },
    { name: 'AlertTriangle', label: 'Multas / Alertas' },
    { name: 'Bus', label: 'Transporte Público' },
    { name: 'HeartPulse', label: 'Plano de Saúde' },
    { name: 'Stethoscope', label: 'Médico / Pediatra' },
    { name: 'Smile', label: 'Dentista' },
    { name: 'Pill', label: 'Farmácia' },
    { name: 'Activity', label: 'Exames / Esporte' },
    { name: 'Scissors', label: 'Barbearia / Cabelereiro' },
    { name: 'Hand', label: 'Manicure e Pedicure' },
    { name: 'Sparkles', label: 'Depilação' },
    { name: 'Bath', label: 'Higiene / Cosméticos' },
    { name: 'Star', label: 'Estética' },
    { name: 'Dumbbell', label: 'Academia' },
    { name: 'BaggageClaim', label: 'Equipamentos' },
    { name: 'GraduationCap', label: 'Escola' },
    { name: 'BookOpen', label: 'Faculdade / Educação' },
    { name: 'Landmark', label: 'Bancos / Financiamento' },
    { name: 'Video', label: 'Cursos / Treinamentos' },
    { name: 'Book', label: 'Livros' },
    { name: 'Backpack', label: 'Material Escolar' },
    { name: 'Ticket', label: 'Cinema / Teatro' },
    { name: 'Music', label: 'Shows / Música' },
    { name: 'Gamepad2', label: 'Jogos' },
    { name: 'Palette', label: 'Hobbies' },
    { name: 'Plane', label: 'Viagem / Passagens' },
    { name: 'Hotel', label: 'Hospedagem' },
    { name: 'Map', label: 'Passeios / Tours' },
    { name: 'Watch', label: 'Acessórios / Jóias' },
    { name: 'Laptop', label: 'Eletrônicos / Freelas' },
    { name: 'Refrigerator', label: 'Eletrodomésticos' },
    { name: 'Bed', label: 'Cama e Banho' },
    { name: 'Gift', label: 'Presentes / Brinquedos' },
    { name: 'Baby', label: 'Infantil' },
    { name: 'Heart', label: 'Doações / Dízimos' },
    { name: 'Globe', label: 'Missões / Ofertas' },
    { name: 'Tv', label: 'Streaming' },
    { name: 'CreditCard', label: 'Cartões / Assinaturas' },
    { name: 'Wifi', label: 'Internet' },
    { name: 'Smartphone', label: 'Telefonia' },
    { name: 'Percent', label: 'Juros / Taxas' },
    { name: 'Banknote', label: 'Dinheiro / IOF' },
    { name: 'Building', label: 'Entidades / SICOOB' },
    { name: 'Briefcase', label: 'Salário / Trabalho' },
    { name: 'Paperclip', label: 'Escritório' },
    { name: 'DollarSign', label: 'Empréstimos / Pessoal' },
    { name: 'Lock', label: 'Custódia' },
    { name: 'TrendingDown', label: 'Perdas' },
    { name: 'Sun', label: 'Férias' },
    { name: 'Award', label: 'Bônus e Comissões' },
    { name: 'ShoppingBag', label: 'Venda de Bens' },
    { name: 'TrendingUp', label: 'Investimentos / Ganhos' },
    { name: 'Download', label: 'Resgates' },
    { name: 'Undo', label: 'Reembolso' },
    { name: 'ArrowRightLeft', label: 'Transferências' }
];

interface CategoryManagerProps {
  categories: Category[];
  onRefresh: () => void;
}

export const CategoryManager: React.FC<CategoryManagerProps> = ({ categories, onRefresh }) => {
  const { createCategory, updateCategory, deleteCategory, authUser, resetCategoriesToDefault } = useFirebase();

  // Search and view states
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTypeTab, setActiveTypeTab] = useState<'expense' | 'income'>('expense');
  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState('');

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const confirmResetCategories = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Importar Plano de Contas Padrão',
      message: 'Isso irá importar as categorias faltantes do Plano de Contas padrão oficial. Deseja continuar?',
      confirmText: 'Importar',
      cancelText: 'Cancelar',
      isDestructive: false,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        handleResetCategories();
      }
    });
  };

  const handleResetCategories = async () => {
    setIsResetting(true);
    setResetMessage('Importando...');
    try {
      const count = await resetCategoriesToDefault();
      if (count > 0) {
        setResetMessage(`${count} categorias adicionadas/atualizadas!`);
      } else {
        setResetMessage("Já atualizado! Nenhuma nova.");
      }
      onRefresh();
      setTimeout(() => setResetMessage(''), 8000);
    } catch (err: any) {
      setResetMessage("Erro: " + err.message);
      setTimeout(() => setResetMessage(''), 8000);
    } finally {
      setIsResetting(false);
    }
  };

  // New Category states
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('DollarSign');
  const [newParentId, setNewParentId] = useState<string>('');

  // Editing Category states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editParentId, setEditParentId] = useState<string>('');

  // Handlers
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !authUser) return;

    try {
      await createCategory({
        userId: authUser.uid,
        name: newName.trim(),
        type: activeTypeTab,
        icon: newIcon,
        parentId: newParentId || undefined,
        isDefault: false
      });
      setNewName('');
      setNewIcon('DollarSign');
      setNewParentId('');
      setIsAdding(false);
      onRefresh();
    } catch (err) {
      console.error('Error creating category:', err);
    }
  };

  const handleStartEdit = (category: Category) => {
    if (!category.id) return;
    setEditingId(category.id);
    setEditName(category.name);
    setEditIcon(category.icon);
    setEditParentId(category.parentId || '');
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim()) return;
    try {
      // Create a clean object to update, explicitly handling parentId
      const updatePayload: any = {
        name: editName.trim(),
        icon: editIcon
      };
      
      if (editParentId) {
        updatePayload.parentId = editParentId;
      } else {
        updatePayload.parentId = null; // Use null to remove the field in Firestore, avoiding undefined errors
      }

      await updateCategory(id, updatePayload);
      setEditingId(null);
      setEditParentId('');
      onRefresh();
    } catch (err) {
      console.error('Error updating category:', err);
    }
  };

  const handleDelete = async (category: Category) => {
    if (!category.id) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Excluir Categoria',
      message: `Tem certeza que deseja excluir a categoria "${category.name}"? As transações associadas a ela permanecerão registradas, mas perderão a categorização.`,
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      isDestructive: true,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          await deleteCategory(category.id as string);
          onRefresh();
        } catch (err) {
          console.error('Error deleting category:', err);
        }
      }
    });
  };

  // Group root categories and their subcategories
  const mainCategories = categories.filter(cat => cat.type === activeTypeTab && !cat.parentId);
  const subCategories = categories.filter(cat => cat.type === activeTypeTab && cat.parentId);

  const matchesSearch = (name: string) => name.toLowerCase().includes(searchQuery.toLowerCase());

  // Filter root categories that match OR have matching children
  const mainCategoriesToShow = mainCategories.filter(mainCat => {
    if (!searchQuery) return true;
    const isMainMatch = matchesSearch(mainCat.name);
    const hasChildMatch = subCategories.some(sub => sub.parentId === mainCat.id && matchesSearch(sub.name));
    return isMainMatch || hasChildMatch;
  });

  const orphanSubs = subCategories.filter(sc => !mainCategories.some(mc => mc.id === sc.parentId));
  const orphanSubsToShow = orphanSubs.filter(sc => !searchQuery || matchesSearch(sc.name));

  // Simple direct helper to append subcategory
  const handleQuickAddSub = (parentId: string) => {
    setNewParentId(parentId);
    setIsAdding(true);
    // Focus search or name input
    setTimeout(() => {
      const el = document.getElementById('new-cat-name-input');
      if (el) el.focus();
    }, 100);
  };

  return (
    <div className="bg-card border border-border rounded-2xl shadow-card overflow-hidden">
      {/* Tab Header */}
      <div className="p-6 border-b border-border space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-foreground">Plano de Contas & Categorias</h3>
            <p className="text-xs text-muted-foreground">Estruture sua árvore de classificação de receitas e despesas</p>
          </div>
          
          <div className="flex items-center gap-2">
            {resetMessage && (
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mr-2">
                {resetMessage}
              </span>
            )}
            <button
              onClick={confirmResetCategories}
              disabled={isResetting}
              className="flex items-center gap-1.5 px-3 py-2 bg-muted text-muted-foreground hover:bg-neutral-200 dark:hover:bg-neutral-800 text-xs font-bold rounded-xl transition shadow-sm disabled:opacity-50"
            >
              <ArrowDownToLine size={14} />
              {isResetting ? 'Importando...' : 'Aplicar Plano Padrão'}
            </button>
            <button
              onClick={() => setIsAdding(!isAdding)}
              className="flex items-center gap-1.5 px-4 py-2 bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-bold rounded-xl hover:opacity-90 transition shadow-sm"
            >
              {isAdding ? <X size={14} /> : <Plus size={14} />}
              {isAdding ? 'Cancelar' : 'Nova Categoria'}
            </button>
          </div>
        </div>

        {/* Filters and Search toolbar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex bg-muted p-1 rounded-xl w-full sm:w-64">
            <button
              onClick={() => { setActiveTypeTab('expense'); setIsAdding(false); }}
              className={`flex-1 text-center py-1.5 text-xs font-semibold rounded-lg transition ${
                activeTypeTab === 'expense'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Despesas (Saídas)
            </button>
            <button
              onClick={() => { setActiveTypeTab('income'); setIsAdding(false); }}
              className={`flex-1 text-center py-1.5 text-xs font-semibold rounded-lg transition ${
                activeTypeTab === 'income'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Receitas (Entradas)
            </button>
          </div>

          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar categoria..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-border rounded-xl bg-background text-xs text-foreground focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Add New Category Form Drawer/Block */}
      {isAdding && (
        <div className="p-6 bg-muted/30 border-b border-border animate-slide-down">
          <form onSubmit={handleCreate} className="space-y-4 max-w-xl">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Cadastrar em {activeTypeTab === 'expense' ? 'Despesas' : 'Receitas'}
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">Nome da Categoria</label>
                <input
                  id="new-cat-name-input"
                  type="text"
                  placeholder="Ex: Saúde bucal, Restaurante, Dividendos..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary animate-fade-in"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">Classificação / Categoria Pai</label>
                <select
                  value={newParentId}
                  onChange={(e) => setNewParentId(e.target.value)}
                  className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Nenhuma (Esta será uma Categoria Principal)</option>
                  {mainCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>-- Subcategoria de: {cat.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">Ícone Ilustrativo</label>
                <div className="flex gap-2">
                  <div className="p-2 border border-border rounded-xl bg-background text-foreground flex items-center justify-center w-10 h-10">
                    {getCategoryIcon(newIcon, 20)}
                  </div>
                  <select
                    value={newIcon}
                    onChange={(e) => setNewIcon(e.target.value)}
                    className="flex-1 px-3 py-2 border border-border bg-background text-foreground rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {AVAILABLE_ICONS.map(ic => (
                      <option key={ic.name} value={ic.name}>{ic.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 border border-border text-xs font-semibold rounded-xl text-muted-foreground hover:bg-muted transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-xl hover:opacity-90 transition shadow-md"
              >
                Criar Categoria
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Categories Grid list */}
      <div className="p-6">
        {mainCategoriesToShow.length === 0 ? (
          <div className="text-center py-12 text-xs text-muted-foreground border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/10">
            Nenhuma categoria encontrada de tipo {activeTypeTab === 'expense' ? 'Despesa' : 'Receita'}.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
            {mainCategoriesToShow.map(mainCat => {
              const isMainEditing = editingId === mainCat.id;
              const mainSubs = subCategories.filter(sc => sc.parentId === mainCat.id && (!searchQuery || matchesSearch(sc.name)));
              const editParentOptions = mainCategories.filter(m => m.id !== editingId);

              return (
                <div 
                  key={mainCat.id} 
                  className={`bg-white dark:bg-slate-900/40 border rounded-2xl p-5 shadow-sm transition-all duration-300 flex flex-col justify-between min-h-[170px] ${
                    isMainEditing 
                      ? 'border-primary ring-1 ring-primary/45 bg-primary/5' 
                      : 'border-slate-200/80 dark:border-slate-800/80 hover:shadow-md'
                  }`}
                >
                  <div>
                    {/* Parent Category Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/60">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          activeTypeTab === 'income' 
                            ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500' 
                            : 'bg-rose-50 dark:bg-rose-950/20 text-rose-500'
                        }`}>
                          {getCategoryIcon(isMainEditing ? editIcon : mainCat.icon, 18)}
                        </div>
                        
                        <div>
                          {isMainEditing ? (
                            <div className="space-y-1.5 min-w-[130px]">
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full px-2 py-1 border border-border bg-background text-foreground text-xs rounded-lg focus:outline-none"
                                placeholder="Nome"
                              />
                              <select
                                value={editIcon}
                                onChange={(e) => setEditIcon(e.target.value)}
                                className="w-full px-1.5 py-1 border border-border bg-background text-foreground text-[10px] rounded-lg focus:outline-none"
                              >
                                {AVAILABLE_ICONS.map(ic => (
                                  <option key={ic.name} value={ic.name}>{ic.label}</option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <>
                              <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-100 uppercase tracking-wide">
                                {mainCat.name}
                              </h4>
                              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                                {mainCat.isDefault ? 'Padrão' : 'Personalizada'}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Actions Column */}
                      <div className="flex items-center gap-1.5">
                        {isMainEditing ? (
                          <>
                            <button
                              onClick={() => mainCat.id && handleSaveEdit(mainCat.id)}
                              className="p-1 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition cursor-pointer"
                              title="Salvar alterações"
                            >
                              <Check size={12} />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1 bg-muted border border-border text-muted-foreground rounded-lg hover:text-foreground transition cursor-pointer"
                              title="Cancelar"
                            >
                              <X size={12} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => mainCat.id && handleQuickAddSub(mainCat.id)}
                              className="p-1 px-1.5 border border-dashed border-emerald-500/30 hover:border-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[9px] rounded-lg transition-all duration-200 flex items-center gap-0.5 cursor-pointer"
                              title="Criar Subcategoria"
                            >
                              <Plus size={9} /> Sub
                            </button>
                            <button
                              onClick={() => handleStartEdit(mainCat)}
                              className="p-1 hover:bg-muted border border-border text-muted-foreground hover:text-foreground rounded-lg transition cursor-pointer"
                              title="Editar Categoria"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={() => handleDelete(mainCat)}
                              className="p-1 hover:bg-red-50 border border-red-200 text-red-500 dark:border-red-950/20 dark:hover:bg-red-950/20 rounded-lg transition cursor-pointer"
                              title="Excluir Categoria"
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Subcategories Section */}
                    <div className="mt-4 pl-1">
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 font-extrabold block mb-2">
                        Subcategorias ({mainSubs.length})
                      </span>

                      {mainSubs.length === 0 ? (
                        <p className="text-[10px] italic text-muted-foreground/60 py-1 pl-2 border-l border-slate-100 dark:border-slate-800">
                          Nenhuma subcategoria criada. Use "+ Sub" para criar.
                        </p>
                      ) : (
                        <div className="space-y-1.5 border-l border-slate-100 dark:border-slate-800 pr-1 pl-2">
                          {mainSubs.map(sub => {
                            const isSubEditing = editingId === sub.id;

                            return (
                              <div 
                                key={sub.id} 
                                className={`group relative flex items-center justify-between p-1.5 rounded-xl border transition-all duration-200 ${
                                  isSubEditing 
                                    ? 'border-primary bg-primary/5' 
                                    : 'border-transparent hover:border-slate-100 dark:hover:border-slate-800/40 bg-slate-50/40 dark:bg-slate-900/10 hover:bg-slate-100/50 dark:hover:bg-slate-900/30'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <div className="text-muted-foreground flex-shrink-0">
                                    {getCategoryIcon(isSubEditing ? editIcon : sub.icon, 13, 'opacity-70')}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    {isSubEditing ? (
                                      <div className="space-y-1.5 w-full">
                                        <input
                                          type="text"
                                          value={editName}
                                          onChange={(e) => setEditName(e.target.value)}
                                          className="w-full px-2 py-0.5 border border-border bg-background text-foreground text-[11px] rounded-md focus:outline-none"
                                          placeholder="Nome da Subcategoria"
                                        />
                                        <div className="flex gap-1 items-center">
                                          <select
                                            value={editIcon}
                                            onChange={(e) => setEditIcon(e.target.value)}
                                            className="flex-1 px-1 py-0.5 border border-border bg-background text-foreground text-[9px] rounded-md focus:outline-none"
                                          >
                                            {AVAILABLE_ICONS.map(ic => (
                                              <option key={ic.name} value={ic.name}>{ic.label}</option>
                                            ))}
                                          </select>
                                          <select
                                            value={editParentId}
                                            onChange={(e) => setEditParentId(e.target.value)}
                                            className="flex-1 px-1 py-0.5 border border-border bg-background text-foreground text-[9px] rounded-md focus:outline-none"
                                          >
                                            <option value="">(Principal)</option>
                                            {editParentOptions.map(p => (
                                              <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                          </select>
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                                        {sub.name}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {/* Active Controls */}
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200 flex-shrink-0 ml-1.5">
                                  {isSubEditing ? (
                                    <>
                                      <button
                                        onClick={() => sub.id && handleSaveEdit(sub.id)}
                                        className="p-0.5 bg-emerald-500 text-white rounded hover:bg-emerald-600 transition cursor-pointer"
                                        title="Salvar"
                                      >
                                        <Check size={11} />
                                      </button>
                                      <button
                                        onClick={() => setEditingId(null)}
                                        className="p-0.5 bg-muted border border-border text-muted-foreground rounded hover:text-foreground transition cursor-pointer"
                                        title="Cancelar"
                                      >
                                        <X size={11} />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => handleStartEdit(sub)}
                                        className="p-0.5 border border-border hover:bg-card text-muted-foreground hover:text-foreground rounded transition cursor-pointer"
                                        title="Editar"
                                      >
                                        <Edit2 size={11} />
                                      </button>
                                      <button
                                        onClick={() => handleDelete(sub)}
                                        className="p-0.5 border border-red-100 hover:bg-red-50 text-red-500 rounded transition cursor-pointer"
                                        title="Excluir"
                                      >
                                        <Trash2 size={11} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Orphans rendering */}
        {orphanSubsToShow.length > 0 && (
          <div className="mt-8 pt-6 border-t border-dashed border-red-200 dark:border-red-900/50">
            <div className="mb-4">
              <h3 className="text-sm font-bold text-red-600 flex items-center gap-1.5"><AlertCircle size={14} /> Subcategorias Órfãs</h3>
              <p className="text-[10px] text-muted-foreground">Estas subcategorias estão atribuídas a um grupo principal que não existe mais. Edite-as para realocar.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-red-50/50 dark:bg-red-950/10 border border-red-100 dark:border-red-900/30 rounded-2xl p-4 flex flex-col gap-2">
                {orphanSubsToShow.map(sub => {
                  const isSubEditing = editingId === sub.id;
                  const editParentOptions = mainCategories.filter(m => m.id !== editingId);

                  return (
                    <div 
                      key={sub.id} 
                      className={`group relative flex items-center justify-between p-2 rounded-xl border transition-all duration-200 ${
                        isSubEditing 
                          ? 'border-primary bg-background' 
                          : 'border-transparent bg-background shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {/* Identical editing block as regular subcategories */}
                        {isSubEditing ? (
                          <div className="flex-1 flex flex-col gap-1.5 w-full">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full px-2 py-1 border border-border bg-background text-foreground text-xs rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                              autoFocus
                            />
                            <div className="flex items-center gap-1.5">
                              <select
                                value={editIcon}
                                onChange={(e) => setEditIcon(e.target.value)}
                                className="flex-1 px-1 py-0.5 border border-border bg-background text-foreground text-[9px] rounded-md focus:outline-none"
                              >
                                {AVAILABLE_ICONS.map(ic => (
                                  <option key={ic.name} value={ic.name}>{ic.label}</option>
                                ))}
                              </select>
                              <select
                                value={editParentId}
                                onChange={(e) => setEditParentId(e.target.value)}
                                className="flex-1 px-1 py-0.5 border border-red-300 bg-background text-foreground text-[9px] rounded-md focus:outline-none"
                              >
                                <option value="" disabled>Selecione um grupo válido</option>
                                {editParentOptions.map(p => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="w-5 h-5 rounded-md bg-red-100 dark:bg-red-900/20 text-red-500 flex items-center justify-center flex-shrink-0">
                              {getCategoryIcon(sub.icon, 10)}
                            </div>
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {sub.name}
                            </p>
                          </>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200 flex-shrink-0 ml-1.5">
                        {isSubEditing ? (
                          <>
                            <button
                              onClick={() => sub.id && handleSaveEdit(sub.id)}
                              className="p-1 bg-emerald-500 text-white rounded hover:bg-emerald-600 transition"
                            >
                              <Check size={11} />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1 bg-muted border border-border text-muted-foreground rounded hover:text-foreground transition"
                            >
                              <X size={11} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleStartEdit(sub)}
                              className="p-1 border border-border hover:bg-card text-muted-foreground hover:text-foreground rounded transition"
                              title="Editar"
                            >
                              <Edit2 size={11} />
                            </button>
                            <button
                              onClick={() => handleDelete(sub)}
                              className="p-1 border border-red-100 hover:bg-red-50 text-red-500 rounded transition"
                              title="Excluir"
                            >
                              <Trash2 size={11} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        {...confirmDialog}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
