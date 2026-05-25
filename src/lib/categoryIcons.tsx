import React from 'react';
import { icons, HelpCircle, LucideIcon } from 'lucide-react';

export const CATEGORY_ICONS: Record<string, LucideIcon> = icons as unknown as Record<string, LucideIcon>;

export const getCategoryIcon = (iconName: string | undefined): LucideIcon => {
  if (!iconName || !CATEGORY_ICONS[iconName]) {
    return HelpCircle;
  }
  return CATEGORY_ICONS[iconName];
};

export const suggestIcon = (name: string): string => {
  const n = name.toLowerCase();
  if (n.includes('comida') || n.includes('alimento') || n.includes('restaurante') || n.includes('mercado')) return 'Utensils';
  if (n.includes('transporte') || n.includes('carro') || n.includes('combustível') || n.includes('uber')) return 'Car';
  if (n.includes('casa') || n.includes('moradia') || n.includes('aluguel') || n.includes('condomínio')) return 'Home';
  if (n.includes('saúde') || n.includes('médico') || n.includes('farmácia') || n.includes('hospital')) return 'HeartPulse';
  if (n.includes('lazer') || n.includes('diversão') || n.includes('viagem')) return 'Gamepad2';
  if (n.includes('educação') || n.includes('escola') || n.includes('curso') || n.includes('faculdade')) return 'GraduationCap';
  if (n.includes('salário') || n.includes('renda') || n.includes('recebimento')) return 'Banknote';
  if (n.includes('investimento') || n.includes('ações') || n.includes('tesouro')) return 'TrendingUp';
  if (n.includes('presente') || n.includes('doação')) return 'Gift';
  if (n.includes('compras') || n.includes('shopping')) return 'ShoppingBag';
  if (n.includes('luz') || n.includes('energia') || n.includes('elétrica')) return 'Zap';
  if (n.includes('telefone') || n.includes('celular') || n.includes('internet')) return 'Phone';
  if (n.includes('seguro')) return 'ShieldCheck';
  if (n.includes('viagem') || n.includes('avião')) return 'Plane';
  if (n.includes('café') || n.includes('padaria')) return 'Coffee';
  if (n.includes('trabalho') || n.includes('negócio')) return 'Briefcase';
  if (n.includes('assinatura') || n.includes('netflix') || n.includes('spotify') || n.includes('streaming')) return 'Tv';
  if (n.includes('pessoal')) return 'User';
  if (n.includes('família') || n.includes('filhos')) return 'Users';
  if (n.includes('banco') || n.includes('taxa') || n.includes('juros')) return 'Landmark';
  if (n.includes('cartão')) return 'CreditCard';
  if (n.includes('dinheiro')) return 'DollarSign';
  if (n.includes('imposto') || n.includes('contabilidade')) return 'Receipt';
  if (n.includes('carteira')) return 'Wallet';
  if (n.includes('poupança') || n.includes('reserva')) return 'PiggyBank';
  
  return 'HelpCircle';
};

export const DEFAULT_TEMPLATES = {
  pessoal: [
    { name: 'Alimentação', type: 'despesa', icon: 'Utensils' },
    { name: 'Transporte', type: 'despesa', icon: 'Car' },
    { name: 'Moradia', type: 'despesa', icon: 'Home' },
    { name: 'Lazer', type: 'despesa', icon: 'Gamepad2' },
    { name: 'Saúde', type: 'despesa', icon: 'HeartPulse' },
    { name: 'Educação', type: 'despesa', icon: 'GraduationCap' },
    { name: 'Salário', type: 'receita', icon: 'Banknote' },
    { name: 'Investimentos', type: 'receita', icon: 'TrendingUp' }
  ],
  empresarial: [
    { name: 'Vendas', type: 'receita', icon: 'TrendingUp' },
    { name: 'Serviços', type: 'receita', icon: 'Briefcase' },
    { name: 'Impostos', type: 'despesa', icon: 'Receipt' },
    { name: 'Aluguel Escritório', type: 'despesa', icon: 'Landmark' },
    { name: 'Marketing', type: 'despesa', icon: 'Zap' },
    { name: 'Softwares/SaaS', type: 'despesa', icon: 'Smartphone' },
    { name: 'Equipamentos', type: 'despesa', icon: 'Hammer' },
    { name: 'Contabilidade', type: 'despesa', icon: 'Receipt' }
  ]
};
