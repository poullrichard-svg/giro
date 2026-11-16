export const EXPENSE_CATEGORIES = [
  'Alimentação', 'Mercado', 'Moradia', 'Contas de casa', 'Transporte', 'Veículo', 'Combustível',
  'Saúde', 'Educação', 'Lazer', 'Assinaturas', 'Vestuário', 'Cartão de crédito', 'Empréstimos',
  'Impostos', 'Pets', 'Presentes', 'Outros',
];

export const INCOME_CATEGORIES = ['Salário', 'Corridas (apps)', 'Entregas', 'Freelance', 'Vendas', 'Investimentos', 'Reembolso', 'Outros'];

export const PAYMENT_METHODS = ['Pix', 'Débito', 'Crédito', 'Dinheiro', 'Boleto', 'Transferência'];


export const VEHICLE_EXPENSE_CATEGORIES = [
  'Combustível', 'Troca de óleo', 'Manutenção', 'Pneus', 'IPVA', 'Licenciamento', 'Seguro',
  'Parcela', 'Aluguel', 'Multa', 'Lavagem', 'Pedágio/Estacionamento', 'Outros',
];

export const CATEGORY_COLORS: Record<string, string> = {
  'Alimentação': '#f59e0b', 'Mercado': '#84cc16', 'Moradia': '#3b82f6', 'Contas de casa': '#06b6d4',
  'Transporte': '#8b5cf6', 'Veículo': '#a855f7', 'Combustível': '#ef4444', 'Saúde': '#ec4899',
  'Educação': '#14b8a6', 'Lazer': '#f97316', 'Assinaturas': '#6366f1', 'Vestuário': '#d946ef',
  'Cartão de crédito': '#e11d48', 'Empréstimos': '#be123c', 'Impostos': '#78716c', 'Pets': '#a3e635',
  'Presentes': '#fb7185', 'Outros': '#64748b',
};

const FALLBACK = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];
export const colorFor = (cat: string, i = 0) => CATEGORY_COLORS[cat] ?? FALLBACK[i % FALLBACK.length];
