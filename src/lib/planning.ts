/**
 * Orçamento, próximos vencimentos e projeção do fim do mês — cálculos puros (planning.test.ts).
 */
import type { Account, Budget, Card, FixedBill, FixedPayment, Transaction, Vehicle } from '../types';
import { accountBalance, invoiceMonthFor, invoiceSummary, isInternal, txMonth } from './cards';
import { addDays, addMonths, daysUntil, round2 } from './format';

// ---------------------------------------------------------------------------
// Orçamento por categoria
// ---------------------------------------------------------------------------
export type BudgetLevel = 'ok' | 'atencao' | 'estourou';
export interface BudgetStatus { id: string; category: string; limit: number; spent: number; pct: number; level: BudgetLevel; left: number }

export const levelFor = (pct: number): BudgetLevel => (pct >= 100 ? 'estourou' : pct >= 80 ? 'atencao' : 'ok');

/** Gasto do mês na categoria: lançamentos (cartão no mês da fatura) + contas fixas da categoria. */
export function spentIn(category: string, tx: Transaction[], fixed: FixedBill[], month: string) {
  const v = tx.filter((t) => t.type === 'expense' && !isInternal(t) && t.category === category && t.date && txMonth(t) === month).reduce((s, t) => s + t.amount, 0)
    + fixed.filter((f) => f.type === 'expense' && f.category === category).reduce((s, f) => s + f.amount, 0);
  return round2(v);
}

export function budgetStatus(budgets: Budget[], tx: Transaction[], fixed: FixedBill[], month: string): BudgetStatus[] {
  return budgets.filter((b) => b.limit > 0).map((b) => {
    const spent = spentIn(b.category, tx, fixed, month);
    const pct = (spent / b.limit) * 100;
    return { id: b.id, category: b.category, limit: b.limit, spent, pct, level: levelFor(pct), left: round2(b.limit - spent) };
  }).sort((a, b) => b.pct - a.pct);
}

/** Se um novo gasto fizer a categoria cruzar 80% ou 100%, devolve o novo nível (para avisar na hora). */
export function crossedLevel(limit: number, before: number, added: number): BudgetLevel | null {
  if (limit <= 0) return null;
  const a = levelFor((before / limit) * 100); const b = levelFor(((before + added) / limit) * 100);
  return a !== b && b !== 'ok' ? b : null;
}

/** Média de gasto da categoria nos 3 meses anteriores — sugestão de limite. */
export function averageSpent(category: string, tx: Transaction[], fixed: FixedBill[], month: string, months = 3) {
  const vals = Array.from({ length: months }, (_, i) => spentIn(category, tx, fixed, addMonths(month, -(i + 1))));
  return round2(vals.reduce((s, v) => s + v, 0) / months);
}

// ---------------------------------------------------------------------------
// Próximos vencimentos
// ---------------------------------------------------------------------------
export interface DueItem {
  id: string;
  kind: 'fixa' | 'fatura' | 'veiculo';
  title: string;
  date: string;
  daysLeft: number;
  amount: number;
  /** Dados para a ação (marcar paga / abrir cartão / abrir veículo). */
  ref: { fixedId?: string; month?: string; cardId?: string; vehicleId?: string };
}

const clampDate = (month: string, day: number) => {
  const [y, m] = month.split('-').map(Number);
  return `${month}-${String(Math.min(day, new Date(y, m, 0).getDate())).padStart(2, '0')}`;
};

/**
 * O que vence até `days` dias a partir de hoje (e o que já venceu neste mês sem pagar).
 * Contas fixas: só despesas, sem pagamento marcado no mês. Faturas: com valor em aberto.
 */
export function upcomingDue(
  { fixed, payments, cards, tx, vehicles }: { fixed: FixedBill[]; payments: FixedPayment[]; cards: Card[]; tx: Transaction[]; vehicles: Vehicle[] },
  today: string, days = 7,
): DueItem[] {
  const out: DueItem[] = [];
  const limit = addDays(today, days);
  const thisMonth = today.slice(0, 7);
  for (const f of fixed) {
    if (f.type !== 'expense' || !f.dueDay) continue;
    for (const month of [thisMonth, addMonths(thisMonth, 1)]) {
      const date = clampDate(month, f.dueDay);
      const paid = payments.some((p) => p.fixedId === f.id && p.month === month);
      const overdueThisMonth = month === thisMonth && date < today;
      if (paid || (date > limit) || (date < today && !overdueThisMonth)) continue;
      out.push({ id: `fixa-${f.id}-${month}`, kind: 'fixa', title: f.description, date, daysLeft: daysUntil(date, today), amount: f.amount, ref: { fixedId: f.id, month } });
    }
  }
  for (const c of cards.filter((x) => !x.archived)) {
    const current = invoiceMonthFor(today, c);
    for (const month of [addMonths(current, -1), current]) {
      const inv = invoiceSummary(c, tx, month, today);
      if (inv.open <= 0 || inv.due > limit || inv.due < addDays(today, -31)) continue;
      out.push({ id: `fatura-${c.id}-${month}`, kind: 'fatura', title: `Fatura ${c.name}`, date: inv.due, daysLeft: daysUntil(inv.due, today), amount: inv.open, ref: { cardId: c.id, month } });
    }
  }
  for (const v of vehicles.filter((x) => x.active)) {
    const docs: Array<[string, string | null | undefined, number]> = [['IPVA', v.ipvaDueDate, v.ipvaValue], ['Licenciamento', v.licensingDueDate, v.licensingValue], ['Seguro', v.insuranceDueDate, v.insuranceValue]];
    for (const [label, date, amount] of docs) {
      if (!date || date > limit || daysUntil(date, today) < -31) continue;
      out.push({ id: `veiculo-${v.id}-${label}`, kind: 'veiculo', title: `${label} · ${v.name}`, date, daysLeft: daysUntil(date, today), amount, ref: { vehicleId: v.id } });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// ---------------------------------------------------------------------------
// Projeção do fim do mês
// ---------------------------------------------------------------------------
export interface Projection {
  endDate: string;
  balanceToday: number;
  fixedToPay: number;
  fixedToReceive: number;
  invoicesToPay: number;
  projected: number;
}

/**
 * Saldo previsto no último dia do mês:
 * saldo das contas hoje − contas fixas ainda não pagas + receitas fixas ainda não recebidas − faturas que vencem até lá.
 * (Lançamentos futuros já registrados também entram.)
 */
export function monthEndProjection(
  { accounts, tx, fixed, payments, cards }: { accounts: Account[]; tx: Transaction[]; fixed: FixedBill[]; payments: FixedPayment[]; cards: Card[] },
  today: string,
): Projection {
  const month = today.slice(0, 7);
  const [y, m] = month.split('-').map(Number);
  const endDate = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
  const active = accounts.filter((a) => !a.archived);
  const balanceToday = round2(active.reduce((s, a) => s + accountBalance(a, tx, today), 0));
  const scheduled = round2(active.reduce((s, a) => s + accountBalance(a, tx, endDate), 0) - balanceToday); // lançamentos futuros do mês
  const paidIds = new Set(payments.filter((p) => p.month === month).map((p) => p.fixedId));
  const fixedToPay = round2(fixed.filter((f) => f.type === 'expense' && !paidIds.has(f.id)).reduce((s, f) => s + f.amount, 0));
  const fixedToReceive = round2(fixed.filter((f) => f.type === 'income' && !paidIds.has(f.id)).reduce((s, f) => s + f.amount, 0));
  let invoicesToPay = 0;
  for (const c of cards.filter((x) => !x.archived)) {
    const current = invoiceMonthFor(today, c);
    for (const im of [addMonths(current, -1), current]) {
      const inv = invoiceSummary(c, tx, im, today);
      if (inv.open > 0 && inv.due <= endDate) invoicesToPay += inv.open;
    }
  }
  invoicesToPay = round2(invoicesToPay);
  return { endDate, balanceToday, fixedToPay, fixedToReceive, invoicesToPay, projected: round2(balanceToday + scheduled - fixedToPay + fixedToReceive - invoicesToPay) };
}

/** Mensagem de aviso se um novo gasto cruzar 80% ou 100% do limite da categoria (ou null). */
export function budgetAlert(budgets: Budget[], tx: Transaction[], fixed: FixedBill[], category: string, month: string, added: number) {
  const budget = budgets.find((b) => b.category === category);
  if (!budget) return null;
  const before = spentIn(category, tx, fixed, month);
  const level = crossedLevel(budget.limit, before, added);
  if (!level) return null;
  const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  return level === 'estourou'
    ? { kind: 'error' as const, text: `${category}: você passou do limite de ${brl(budget.limit)} este mês` }
    : { kind: 'warn' as const, text: `${category}: já usou ${Math.round(((before + added) / budget.limit) * 100)}% do limite de ${brl(budget.limit)}` };
}
