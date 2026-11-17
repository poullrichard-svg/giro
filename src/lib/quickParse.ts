/**
 * Interpreta um lançamento em texto livre, ex.:
 *   "gastei 35,90 almoço no pix"   -> despesa 35,90 Alimentação, Pix
 *   "recebi 1200 salário"          -> receita 1200 Salário
 *   "abasteci 150 ontem"           -> despesa 150 Combustível, data de ontem
 * Pensado para ser reutilizado no bot de WhatsApp.
 */
import { addDays, localISODate } from './format';
import type { TxType } from '../types';

export interface QuickEntry {
  type: TxType;
  amount: number;
  description: string;
  category: string;
  paymentMethod: string;
  date: string;
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const INCOME_WORDS = ['recebi', 'ganhei', 'entrou', 'entrada', 'receita', 'salario', 'pagamento recebido', 'vendi', 'corrida', 'corridas', 'faturei'];

const CATEGORY_RULES: Array<[string, string[]]> = [
  ['Combustível', ['gasolina', 'etanol', 'alcool', 'abasteci', 'abastecimento', 'combustivel', 'diesel', 'gnv', 'posto']],
  ['Veículo', ['oficina', 'mecanico', 'pneu', 'oleo', 'lavagem', 'lava jato', 'ipva', 'licenciamento', 'multa', 'revisao', 'estacionamento', 'pedagio']],
  ['Mercado', ['mercado', 'supermercado', 'feira', 'atacadao', 'assai', 'hortifruti', 'acougue', 'padaria']],
  ['Alimentação', ['almoco', 'janta', 'jantar', 'lanche', 'cafe', 'restaurante', 'ifood', 'pizza', 'marmita', 'comida', 'refeicao']],
  ['Moradia', ['aluguel', 'condominio', 'iptu', 'financiamento casa', 'prestacao casa']],
  ['Contas de casa', ['luz', 'energia', 'agua', 'internet', 'gas', 'telefone', 'celular', 'conta de']],
  ['Saúde', ['farmacia', 'remedio', 'medico', 'consulta', 'exame', 'dentista', 'plano de saude', 'academia']],
  ['Educação', ['escola', 'faculdade', 'curso', 'livro', 'material escolar']],
  ['Lazer', ['cinema', 'bar', 'show', 'viagem', 'passeio', 'cerveja', 'festa']],
  ['Assinaturas', ['netflix', 'spotify', 'assinatura', 'prime', 'disney', 'youtube', 'hbo', 'max']],
  ['Vestuário', ['roupa', 'tenis', 'sapato', 'camisa', 'calca']],
  ['Transporte', ['onibus', 'metro', 'passagem', 'uber', '99', 'taxi']],
  ['Pets', ['racao', 'veterinario', 'pet']],
];

const INCOME_RULES: Array<[string, string[]]> = [
  ['Entregas', ['ifood', 'rappi', 'mercado livre', 'shopee', 'amazon', 'loggi', 'lalamove', '99food', 'entrega', 'entregas', 'diaria']],
  ['Corridas (apps)', ['uber', '99', 'indrive', 'corrida', 'corridas', 'app']],
  ['Salário', ['salario', 'pagamento', 'holerite', 'adiantamento', 'vale']],
  ['Freelance', ['freela', 'freelance', 'bico', 'servico']],
  ['Vendas', ['vendi', 'venda']],
  ['Investimentos', ['rendimento', 'dividendo', 'juros']],
  ['Reembolso', ['reembolso', 'devolucao', 'estorno']],
];

const PAYMENT_RULES: Array<[string, string[]]> = [
  ['Pix', ['pix']],
  ['Crédito', ['credito', 'cartao de credito', 'no cartao', 'parcelado']],
  ['Débito', ['debito']],
  ['Dinheiro', ['dinheiro', 'especie', 'cash']],
  ['Boleto', ['boleto']],
];

const FILLER = new Set(['gastei', 'paguei', 'comprei', 'recebi', 'ganhei', 'entrou', 'abasteci', 'reais', 'real', 'r$', 'no', 'na', 'nos', 'nas', 'de', 'do', 'da', 'com', 'em', 'o', 'a', 'hoje', 'ontem', 'anteontem', 'pix', 'debito', 'credito', 'dinheiro', 'boleto', 'cartao', 'via', 'pelo', 'pela', 'dia']);

/** Sugere a categoria de um texto (descrição de extrato, por exemplo). */
export function guessCategory(text: string, type: TxType): string {
  const n = norm(text);
  const has = (w: string) => new RegExp(`(^|\\W)${w}(\\W|$)`).test(n);
  const rules = type === 'income' ? INCOME_RULES : CATEGORY_RULES;
  return rules.find(([, words]) => words.some(has))?.[0] ?? 'Outros';
}

export function parseQuickEntry(text: string, today = localISODate()): QuickEntry | null {
  const raw = text.trim();
  if (!raw) return null;
  const n = norm(raw);

  const m = n.match(/(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/);
  if (!m) return null;
  let numStr = m[1];
  if (numStr.includes(',')) numStr = numStr.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(numStr)) numStr = numStr.replace(/\./g, '');
  const amount = parseFloat(numStr);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const has = (w: string) => new RegExp(`(^|\\W)${w}(\\W|$)`).test(n);
  const isIncome = INCOME_WORDS.some(has) || /^\+/.test(raw);
  const type: TxType = isIncome ? 'income' : 'expense';

  const rules = isIncome ? INCOME_RULES : CATEGORY_RULES;
  const category = rules.find(([, words]) => words.some(has))?.[0] ?? 'Outros';
  const paymentMethod = PAYMENT_RULES.find(([, words]) => words.some(has))?.[0] ?? 'Pix';

  let date = today;
  if (has('anteontem')) date = addDays(today, -2);
  else if (has('ontem')) date = addDays(today, -1);
  const dm = n.match(/\bdia (\d{1,2})(?:\/(\d{1,2}))?\b/);
  if (dm) {
    const [y, mo] = today.split('-');
    date = `${y}-${String(dm[2] ?? mo).padStart(2, '0')}-${dm[1].padStart(2, '0')}`;
  }

  // Mantém as palavras originais (com acento), tirando valor, data e palavras de ligação.
  const words = raw.split(/\s+/).filter((w) => {
    const k = norm(w).replace(/[^\p{L}\d$]/gu, '');
    return k && !FILLER.has(k) && !/^[+\-]?r?\$?\d/.test(k);
  });
  let description = words.join(' ').replace(/[^\p{L}\d ]/gu, '').trim();
  if (!description) description = category;
  description = description.charAt(0).toUpperCase() + description.slice(1);

  return { type, amount: Math.round(amount * 100) / 100, description, category, paymentMethod, date };
}
