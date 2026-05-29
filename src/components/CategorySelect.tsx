import Select from 'react-select';
import { getCategoryIcon } from '../lib/categoryIcons';

interface CategoryOption {
  value: string;
  label: string;
  icon: string;
  level: number;
}

interface CategorySelectProps {
  categories: any[];
  value: string;
  onChange: (value: string) => void;
  typeFilter?: string;
  placeholder?: string;
}

const getCategoryOptions = (cats: any[], parentId: string | null = null, level: number = 0): CategoryOption[] => {
  const filtered = cats.filter(c => (c.parentId || null) === parentId);
  let options: CategoryOption[] = [];
  filtered.forEach(cat => {
    options.push({
      value: cat.id,
      label: cat.name,
      icon: cat.icon,
      level,
    });
    options = options.concat(getCategoryOptions(cats, cat.id, level + 1));
  });
  return options;
};

export function CategorySelect({ categories, value, onChange, typeFilter, placeholder }: CategorySelectProps) {
  const filtered = typeFilter ? categories.filter(c => {
    if (c.type === typeFilter) return true;
    if ((typeFilter === 'expense' || typeFilter === 'despesa') && (c.type === 'expense' || c.type === 'despesa')) return true;
    if ((typeFilter === 'income' || typeFilter === 'receita') && (c.type === 'income' || c.type === 'receita')) return true;
    return false;
  }) : categories;
  const opts = getCategoryOptions(filtered);

  if (opts.length === 0) {
    opts.push({ value: 'default', label: 'Categoria Padrão', icon: 'HelpCircle', level: 0 });
  }

  return (
    <Select
      options={opts}
      value={opts.find(c => c.value === value) || null}
      onChange={(selected: any) => onChange(selected?.value || '')}
      placeholder={placeholder || 'Buscar...'}
      isSearchable
      menuPosition="fixed"
      menuPortalTarget={document.body}
      formatOptionLabel={(option: any) => {
        const Icon = getCategoryIcon(option.icon);
        return (
          <div className="flex items-center gap-2 overflow-hidden">
            <Icon className="h-3 w-3 opacity-70 shrink-0" />
            <span className="truncate">{option.label}</span>
          </div>
        );
      }}
      styles={{
        control: (base) => ({
          ...base,
          minHeight: '48px',
          borderRadius: '0.75rem',
          border: 'none',
          backgroundColor: 'rgb(249 250 251)',
          boxShadow: 'none',
        }),
        menuPortal: base => ({ ...base, zIndex: 9999 }),
        menu: (base) => ({ ...base, zIndex: 9999, minWidth: '280px' }),
        option: (base, { data }) => ({
          ...base,
          paddingLeft: `${(data.level * 16) + 12}px`,
          whiteSpace: 'normal',
          wordBreak: 'break-word',
          paddingTop: '8px',
          paddingBottom: '8px',
        }),
      }}
    />
  );
}
