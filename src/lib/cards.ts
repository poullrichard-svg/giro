/**
 * Contas, cartões, faturas e parcelamentos — cálculos puros (testados em cards.test.ts).
 */
import type { Account, Card, Transaction } from '../types';
import { addMonths, round2 } from './format';

/** Mês em que um lançamento conta no orçamento: compras no cartão contam no mês da fatura. */
export const txMonth = (t: Pick<Transaction, 'date' | 'cardId' | 'invoiceMonth'>) => (t.cardId && t.invoiceMonth ? t.invoiceMonth : t.date.slice(0, 7));

/** Transferências e pagamentos de fatura não são receita nem despesa. */
export const isInternal = (t: Pick<Transaction, 'internal'>) => !!t.internal;

/**
 * Fatura (identificada pelo mês de vencimento) em que cai uma compra feita em `date`.
 * Compras no dia do fechamento ou depois vão para a fatura seguinte.
 */
export function invoiceMonthFor(date: string, card: Pick<Card, 'closingDay' | 'dueDay'>) {
  const month = date.slice(0, 7);
  const day = Number(date.slice(8, 10));
  const closingMonth = day < card.closingDay ? month : addMonths(month, 1);
  // Vencimento no mesmo mês do fechamento se o dia de vencimento vem depois; senão, no mês seguinte.
  return card.dueDay > card.closingDay ? closingMonth : addMonths(closingMonth, 1);
}

/** Divide um valor em N parcelas de centavos exatos (a diferença de arredondamento vai na 1ª). */
export function splitInstallments(total: number, count: number) {
  const n = Math.max(1, Math.floor(count));
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / n);
  return Array.from({ length: n }, (_, i) => (base + (i === 0 ? cents - base * n : 0)) / 100);
}

export interface PurchaseInput {
  description: string;
  amount: number;
  category: string;
  date: string;
  card: Card;
  installments: number;
  group: string;
}

/** Gera os lançamentos de uma compra no cartão (um por parcela, cada um na sua fatura). */
export function cardPurchase(p: PurchaseInput): Array<Omit<Transaction, 'id'>> {
  const first = invoiceMonthFor(p.date, p.card);
  const parts = splitInstallments(p.amount, p.installments);
  return parts.map((amount, i) => ({
    description: parts.length > 1 ? `${p.description} (${i + 1}/${parts.length})` : p.description,
    amount, type: 'expense', category: p.category, paymentMethod: 'Crédito', date: p.date,
    cardId: p.card.id, accountId: null, invoiceMonth: addMonths(first, i),
    installmentGroup: parts.length > 1 ? p.group : null, installmentIndex: parts.length > 1 ? i + 1 : null, installmentCount: parts.length > 1 ? parts.length : null,
  }));
}

/** Data de vencimento e de fechamento de uma fatura. */
export function invoiceDates(card: Pick<Card, 'closingDay' | 'dueDay'>, invoiceMonth: string) {
  const clampDay = (month: string, day: number) => {
    const [y, m] = month.split('-').map(Number);
    return `${month}-${String(Math.min(day, new Date(y, m, 0).getDate())).padStart(2, '0')}`;
  };
  const closingMonth = card.dueDay > card.closingDay ? invoiceMonth : addMonths(invoiceMonth, -1);
  return { due: clampDay(invoiceMonth, card.dueDay), closing: clampDay(closingMonth, card.closingDay) };
}

export interface InvoiceSummary { month: string; total: number; paid: number; open: number; status: 'aberta' | 'fechada' | 'paga' | 'futura'; due: string; closing: string; items: Transaction[] }

export function invoiceSummary(card: Card, tx: Transaction[], month: string, today: string): InvoiceSummary {
  const items = tx.filter((t) => t.cardId === card.id && t.invoiceMonth === month && !t.internal);
  const total = round2(items.reduce((s, t) => s + (t.type === 'expense' ? t.amount : -t.amount), 0));
  const paid = round2(tx.filter((t) => t.internal === 'invoice-payment' && t.cardId === card.id && t.invoiceMonth === month).reduce((s, t) => s + t.amount, 0));
  const open = round2(Math.max(0, total - paid));
  const { due, closing } = invoiceDates(card, month);
  const status = total > 0 && open <= 0.004 ? 'paga' : today >= closing ? 'fechada' : month > invoiceMonthFor(today, card) ? 'futura' : 'aberta';
  return { month, total, paid, open, status, due, closing, items };
}

/** Limite usado: tudo que ainda não foi pago, inclusive parcelas futuras. */
export function cardUsedLimit(card: Card, tx: Transaction[]) {
  const months = [...new Set(tx.filter((t) => t.cardId === card.id && t.invoiceMonth).map((t) => t.invoiceMonth!))];
  return round2(months.reduce((s, m) => s + invoiceSummary(card, tx, m, '0000-00-00').open, 0));
}

/** Saldo de uma conta: saldo inicial + entradas − saídas (inclui transferências e pagamentos de fatura). */
export function accountBalance(account: Account, tx: Transaction[], until?: string) {
  const own = tx.filter((t) => t.accountId === account.id && (!until || t.date <= until));
  return round2(own.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), account.initialBalance));
}

export const ACCOUNT_KINDS: Array<{ value: Account['kind']; label: string }> = [
  { value: 'corrente', label: 'Conta corrente' }, { value: 'poupanca', label: 'Poupança' }, { value: 'carteira', label: 'Carteira (dinheiro)' },
  { value: 'investimento', label: 'Investimentos' }, { value: 'outro', label: 'Outra' },
];
export const ACCOUNT_COLORS = ['#22c55e', '#8b5cf6', '#f97316', '#ef4444', '#3b82f6', '#06b6d4', '#eab308', '#ec4899', '#64748b'];
