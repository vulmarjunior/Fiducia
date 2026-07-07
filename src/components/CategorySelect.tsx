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
      classNamePrefix="rs"
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
          backgroundColor: 'var(--muted)',
          boxShadow: 'none',
        }),
        menuPortal: base => ({ ...base, zIndex: 9999 }),
        menu: (base) => ({ ...base, zIndex: 9999, minWidth: '280px', backgroundColor: 'var(--popover)' }),
        menuList: (base) => ({ ...base, backgroundColor: 'var(--popover)' }),
        option: (base, state) => ({
          ...base,
          paddingLeft: `${(state.data.level * 16) + 12}px`,
          whiteSpace: 'normal',
          wordBreak: 'break-word',
          paddingTop: '8px',
          paddingBottom: '8px',
          backgroundColor: state.isSelected || state.isFocused ? 'var(--accent)' : 'transparent',
          color: state.isSelected || state.isFocused ? 'var(--accent-foreground)' : 'var(--popover-foreground)',
          ':hover': { backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' },
        }),
        singleValue: (base) => ({ ...base, color: 'var(--popover-foreground)' }),
        input: (base) => ({ ...base, color: 'var(--popover-foreground)' }),
        placeholder: (base) => ({ ...base, color: 'var(--muted-foreground)' }),
        noOptionsMessage: (base) => ({ ...base, color: 'var(--muted-foreground)' }),
        loadingMessage: (base) => ({ ...base, color: 'var(--muted-foreground)' }),
      }}
    />
  );
}
