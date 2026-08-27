import { describe, expect, it } from 'vitest';
import { HelpCircle } from 'lucide-react';
import { CATEGORY_ICONS, DEFAULT_TEMPLATES, getCategoryIcon, suggestIcon } from './categoryIcons';
import { DEFAULT_CATEGORY_TREE } from './defaultCategories';

describe('categoryIcons', () => {
  it('covers every icon used by the default category tree', () => {
    const iconNames = DEFAULT_CATEGORY_TREE.flatMap(group => [
      group.icon,
      ...group.subs.map(subcategory => subcategory.icon),
    ]);

    expect(iconNames.filter(iconName => !(iconName in CATEGORY_ICONS))).toEqual([]);
  });

  it('covers templates and automatic suggestions', () => {
    const templateIcons = Object.values(DEFAULT_TEMPLATES)
      .flat()
      .map(template => template.icon);
    const suggestedIcons = [
      'alimentação',
      'transporte',
      'moradia',
      'saúde',
      'educação',
      'salário',
      'investimento',
      'cartão',
      'imposto',
    ].map(suggestIcon);

    expect([...templateIcons, ...suggestedIcons].filter(iconName => !(iconName in CATEGORY_ICONS))).toEqual([]);
  });

  it('uses HelpCircle for missing or legacy icon names', () => {
    expect(getCategoryIcon(undefined)).toBe(HelpCircle);
    expect(getCategoryIcon('IconeLegadoInexistente')).toBe(HelpCircle);
  });
});
