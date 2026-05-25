export interface DefaultCategoryGroup {
  name: string;
  type: 'income' | 'expense';
  icon: string;
  subs: { name: string; icon: string }[];
}

export const DEFAULT_CATEGORY_TREE: DefaultCategoryGroup[] = [
  {
    name: 'Aluguel e moradia', type: 'expense', icon: 'Home',
    subs: [
      { name: 'Aluguel', icon: 'Home' },
      { name: 'Condomínio', icon: 'Home' },
      { name: 'IPTU + TRSD', icon: 'FileText' },
      { name: 'Energia elétrica', icon: 'Zap' },
      { name: 'Água e esgoto', icon: 'Droplets' },
    ]
  },
  {
    name: 'Casa', type: 'expense', icon: 'Home',
    subs: [
      { name: 'Empregados domésticos', icon: 'Users' },
      { name: 'Lavanderia e passadeira', icon: 'Shirt' },
      { name: 'Mobiliário', icon: 'Sofa' },
      { name: 'Reparos e conservação', icon: 'Wrench' }
    ]
  },
  {
    name: 'Mercado', type: 'expense', icon: 'ShoppingCart',
    subs: [
      { name: 'Supermercado', icon: 'ShoppingCart' },
      { name: 'Feira livre', icon: 'Apple' }
    ]
  },
  {
    name: 'Alimentação fora', type: 'expense', icon: 'Utensils',
    subs: [
      { name: 'Restaurantes e bares', icon: 'Utensils' },
      { name: 'Delivery', icon: 'Truck' },
      { name: 'Café e padaria', icon: 'Coffee' },
      { name: 'Lanches', icon: 'Pizza' }
    ]
  },
  {
    name: 'Transporte — veículo', type: 'expense', icon: 'Car',
    subs: [
      { name: 'Combustível', icon: 'Fuel' },
      { name: 'Financiamento veículo', icon: 'Car' },
      { name: 'Seguro veicular', icon: 'Shield' },
      { name: 'Tributos (IPVA, licenciamento)', icon: 'FileText' },
      { name: 'Manutenção e peças', icon: 'Wrench' },
      { name: 'Lava-jato', icon: 'Droplets' },
      { name: 'Estacionamento', icon: 'ParkingCircle' },
      { name: 'Multas', icon: 'AlertTriangle' }
    ]
  },
  {
    name: 'Transporte urbano', type: 'expense', icon: 'Bus',
    subs: [
      { name: 'Táxi / Uber', icon: 'Car' },
      { name: 'Metrô / Ônibus', icon: 'Bus' }
    ]
  },
  {
    name: 'Saúde', type: 'expense', icon: 'HeartPulse',
    subs: [
      { name: 'Plano de saúde', icon: 'HeartPulse' },
      { name: 'Médicos e terapeutas', icon: 'Stethoscope' },
      { name: 'Dentista', icon: 'Smile' },
      { name: 'Farmácia', icon: 'Pill' },
      { name: 'Exames e procedimentos', icon: 'Activity' }
    ]
  },
  {
    name: 'Cuidados pessoais', type: 'expense', icon: 'Users',
    subs: [
      { name: 'Barbearia / Cabelereiro', icon: 'Scissors' },
      { name: 'Manicure e pedicure', icon: 'Hand' },
      { name: 'Depilação', icon: 'Sparkles' },
      { name: 'Cosméticos e higiene', icon: 'Bath' },
      { name: 'Estética e afins', icon: 'Star' }
    ]
  },
  {
    name: 'Fitness e esporte', type: 'expense', icon: 'Activity',
    subs: [
      { name: 'Academia', icon: 'Dumbbell' },
      { name: 'Esportes e atividades', icon: 'Activity' },
      { name: 'Equipamentos esportivos', icon: 'BaggageClaim' }
    ]
  },
  {
    name: 'Educação', type: 'expense', icon: 'GraduationCap',
    subs: [
      { name: 'Escola (mensalidade)', icon: 'GraduationCap' },
      { name: 'Faculdade / Pós-graduação', icon: 'BookOpen' },
      { name: 'Financiamento estudantil', icon: 'Landmark' },
      { name: 'Cursos e treinamentos', icon: 'Video' },
      { name: 'Inscrição em concursos', icon: 'FileText' },
      { name: 'Livros didáticos', icon: 'Book' },
      { name: 'Material e uniforme escolar', icon: 'Backpack' }
    ]
  },
  {
    name: 'Lazer e cultura', type: 'expense', icon: 'Ticket',
    subs: [
      { name: 'Cinema e teatro', icon: 'Ticket' },
      { name: 'Shows e eventos', icon: 'Music' },
      { name: 'Jogos', icon: 'Gamepad2' },
      { name: 'Literatura', icon: 'Book' },
      { name: 'Hobbies em geral', icon: 'Palette' }
    ]
  },
  {
    name: 'Viagens', type: 'expense', icon: 'Plane',
    subs: [
      { name: 'Passagens', icon: 'Plane' },
      { name: 'Hospedagem', icon: 'Hotel' },
      { name: 'Alimentação na viagem', icon: 'Utensils' },
      { name: 'Passeios e tours', icon: 'Map' },
      { name: 'Seguro viagem', icon: 'Shield' }
    ]
  },
  {
    name: 'Vestuário', type: 'expense', icon: 'Shirt',
    subs: [
      { name: 'Roupas e calçados', icon: 'Shirt' },
      { name: 'Acessórios', icon: 'Watch' }
    ]
  },
  {
    name: 'Eletrônicos e eletrodomésticos', type: 'expense', icon: 'Laptop',
    subs: [
      { name: 'Eletrônicos', icon: 'Laptop' },
      { name: 'Eletrodomésticos', icon: 'Refrigerator' },
      { name: 'Utensílios domésticos', icon: 'Coffee' },
      { name: 'Cama, mesa e banho', icon: 'Bed' }
    ]
  },
  {
    name: 'Família e filhos', type: 'expense', icon: 'Baby',
    subs: [
      { name: 'Brinquedos e presentes', icon: 'Gift' },
      { name: 'Atividades infantis', icon: 'Activity' },
      { name: 'Vestuário infantil', icon: 'Shirt' }
    ]
  },
  {
    name: 'Presentes', type: 'expense', icon: 'Gift',
    subs: [
      { name: 'Presentes', icon: 'Gift' }
    ]
  },
  {
    name: 'Doações', type: 'expense', icon: 'Heart',
    subs: [
      { name: 'Dízimos', icon: 'Heart' },
      { name: 'Ofertas e missões', icon: 'Globe' }
    ]
  },
  {
    name: 'Assinaturas e serviços digitais', type: 'expense', icon: 'Tv',
    subs: [
      { name: 'Streaming', icon: 'Tv' },
      { name: 'Programa de pontos', icon: 'CreditCard' }
    ]
  },
  {
    name: 'Telecomunicações', type: 'expense', icon: 'Smartphone',
    subs: [
      { name: 'Internet', icon: 'Wifi' },
      { name: 'Telefonia', icon: 'Smartphone' }
    ]
  },
  {
    name: 'Serviços bancários', type: 'expense', icon: 'Landmark',
    subs: [
      { name: 'Anuidade cartão de crédito', icon: 'CreditCard' },
      { name: 'Tarifa pacote de serviços', icon: 'Landmark' },
      { name: 'Juros cartão de crédito', icon: 'Percent' },
      { name: 'IOF', icon: 'Banknote' }
    ]
  },
  {
    name: 'Impostos', type: 'expense', icon: 'FileText',
    subs: [
      { name: 'IRRF', icon: 'FileText' },
      { name: 'Outras taxas e tributos', icon: 'FileText' }
    ]
  },
  {
    name: 'Trabalho e profissão', type: 'expense', icon: 'Briefcase',
    subs: [
      { name: 'Entidade de classe', icon: 'Building' },
      { name: 'Despesas IBO', icon: 'Briefcase' },
      { name: 'Material de escritório', icon: 'Paperclip' },
      { name: 'Prestadores de serviço', icon: 'Users' }
    ]
  },
  {
    name: 'Dívidas e empréstimos', type: 'expense', icon: 'DollarSign',
    subs: [
      { name: 'Empréstimos pessoais', icon: 'DollarSign' },
      { name: 'Financiamentos', icon: 'Landmark' },
      { name: 'Parcelamentos', icon: 'CreditCard' }
    ]
  },
  {
    name: 'Investimentos — custos', type: 'expense', icon: 'TrendingDown',
    subs: [
      { name: 'Custódia', icon: 'Lock' },
      { name: 'Custos operacionais', icon: 'Activity' },
      { name: 'IOF sobre investimentos', icon: 'Percent' },
      { name: 'Perdas', icon: 'TrendingDown' },
      { name: 'Cota SICOOB', icon: 'Building' }
    ]
  },
  {
    name: 'Salário e remuneração', type: 'income', icon: 'Briefcase',
    subs: [
      { name: 'Salário / Pró-labore', icon: 'Briefcase' },
      { name: '13º salário', icon: 'Banknote' },
      { name: 'Férias', icon: 'Sun' },
      { name: 'Bônus e comissões', icon: 'Award' }
    ]
  },
  {
    name: 'Renda extra', type: 'income', icon: 'Plus',
    subs: [
      { name: 'Freelas e consultorias', icon: 'Laptop' },
      { name: 'Venda de bens', icon: 'ShoppingBag' },
      { name: 'Prestação de serviços', icon: 'Wrench' }
    ]
  },
  {
    name: 'Rendas passivas', type: 'income', icon: 'TrendingUp',
    subs: [
      { name: 'Aluguel recebido', icon: 'Home' },
      { name: 'Dividendos', icon: 'TrendingUp' },
      { name: 'Juros recebidos', icon: 'Percent' }
    ]
  },
  {
    name: 'Investimentos — rendimentos', type: 'income', icon: 'TrendingUp',
    subs: [
      { name: 'Rendimentos renda fixa', icon: 'TrendingUp' },
      { name: 'Rendimentos renda variável', icon: 'TrendingUp' },
      { name: 'Resgates', icon: 'Download' }
    ]
  },
  {
    name: 'Reembolsos e restituições', type: 'income', icon: 'Undo',
    subs: [
      { name: 'Reembolso de despesas', icon: 'Undo' },
      { name: 'Cashback cartão', icon: 'CreditCard' },
      { name: 'Restituição IR', icon: 'FileText' },
      { name: 'Transferências recebidas', icon: 'ArrowRightLeft' }
    ]
  }
];
