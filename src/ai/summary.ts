/**
 * Resumos compactos dos dados para mandar à IA.
 * Regra: só números agregados, categorias e nomes que o próprio usuário deu a metas/contas.
 * Descrições de lançamentos só vão se o usuário permitir (shareDescriptions).
 * Nada de fotos, IDs, contas bancárias ou datas individuais além do necessário.
 */
import type { Collections, CollectionKey } from '../data/db';
import { addDays, addMonths, hhmmToHours, round2 } from '../lib/format';
import { categoryBreakdown, monthTotals } from '../lib/stats';
import { budgetStatus, monthEndProjection, upcomingDue } from '../lib/planning';
import { accountBalance, isInternal, txMonth } from '../lib/cards';
import { appProfit, timeSlotStats, weekdayStats } from '../lib/driverInsights';
import { goalPlan } from '../lib/goals';
import { debtStatus, debtsSummary } from '../lib/debts';

export type Data = { [K in CollectionKey]: Collections[K][] };
const r = (n: number) => Math.round(n);

/** Gastos recorrentes (mesma descrição em 3+ meses com valor parecido) — candidatos a assinatura. */
export function recurringExpenses(data: Pick<Data, 'transactions'>, today: string) {
  const since = addMonths(today.slice(0, 7), -5);
  const groups = new Map<string, { name: string; months: Set<string>; amounts: number[]; last: string; category: string }>();
  for (const t of data.transactions) {
    if (t.type !== 'expense' || isInternal(t) || t.date.slice(0, 7) < since) continue;
    const key = t.description.trim().toLowerCase().replace(/\s+\d+\/\d+$/, '');
    if (!key) continue;
    const g = groups.get(key) ?? { name: t.description.trim(), months: new Set(), amounts: [], last: '', category: t.category };
    g.months.add(t.date.slice(0, 7)); g.amounts.push(t.amount); if (t.date > g.last) g.last = t.date;
    groups.set(key, g);
  }
  return [...groups.values()]
    .filter((g) => g.months.size >= 3 && Math.max(...g.amounts) - Math.min(...g.amounts) <= Math.max(5, 0.15 * Math.min(...g.amounts)))
    .map((g) => ({ name: g.name, category: g.category, monthly: round2(g.amounts.reduce((s, a) => s + a, 0) / g.amounts.length), months: g.months.size, last: g.last }))
    .sort((a, b) => b.monthly - a.monthly);
}

/** Categorias com gasto no mês bem acima da média dos 3 meses anteriores. */
export function unusualSpending(data: Pick<Data, 'transactions' | 'fixed'>, today: string, factor = 1.5) {
  const month = today.slice(0, 7);
  const now = categoryBreakdown(data.transactions, data.fixed, month);
  const prev = [1, 2, 3].map((i) => categoryBreakdown(data.transactions, data.fixed, addMonths(month, -i)));
  return now.flatMap(({ label, value }) => {
    const avg = prev.reduce((s, p) => s + (p.find((x) => x.label === label)?.value ?? 0), 0) / 3;
    return avg >= 20 && value >= avg * factor ? [{ category: label, thisMonth: value, average: round2(avg), ratio: round2(value / avg) }] : [];
  });
}

export function financeSummary(data: Data, today: string, opts: { shareDescriptions?: boolean } = {}) {
  const month = today.slice(0, 7);
  const months = [0, 1, 2].map((i) => addMonths(month, -i)).map((m) => {
    const t = monthTotals(data.transactions, data.fixed, m);
    return { month: m, income: r(t.income), expense: r(t.expense), balance: r(t.balance) };
  });
  const proj = monthEndProjection({ accounts: data.accounts, tx: data.transactions, fixed: data.fixed, payments: data.fixedPayments, cards: data.cards, debts: data.debts }, today);
  const due = upcomingDue({ fixed: data.fixed, payments: data.fixedPayments, cards: data.cards, tx: data.transactions, vehicles: data.vehicles, debts: data.debts }, today, 7);
  const ds = debtsSummary(data.debts, today);
  const recurring = recurringExpenses(data, today);
  return {
    today,
    months,
    topCategoriesThisMonth: categoryBreakdown(data.transactions, data.fixed, month).slice(0, 8).map((c) => ({ category: c.label, amount: r(c.value) })),
    budgets: budgetStatus(data.budgets, data.transactions, data.fixed, month).map((b) => ({ category: b.category, limit: r(b.limit), spent: r(b.spent), pct: r(b.pct) })),
    balanceToday: r(proj.balanceToday),
    projectedEndOfMonth: r(proj.projected),
    dueNext7Days: { count: due.length, total: r(due.reduce((s, d) => s + d.amount, 0)) },
    accounts: data.accounts.filter((a) => !a.archived).map((a) => ({ name: a.name, balance: r(accountBalance(a, data.transactions, today)) })),
    fixedBills: data.fixed.map((f) => ({ category: f.category, type: f.type, amount: r(f.amount), ...(opts.shareDescriptions ? { name: f.description } : {}) })),
    goals: data.goals.map((g) => { const p = goalPlan(g, data.goalContributions, today); return { name: g.description, saved: r(g.currentAmount), target: r(g.targetAmount), deadline: g.deadline ?? null, monthlyNeeded: p.monthlyNeeded != null ? r(p.monthlyNeeded) : null, status: p.status }; }),
    debts: data.debts.length ? { remaining: r(ds.remaining), paid: r(ds.paid), overdue: r(ds.overdueAmount), dueNext30Days: r(ds.dueIn30), freeDate: ds.freeDate,
      list: data.debts.map((d) => { const st = debtStatus(d, today); return { kind: d.kind, ...(opts.shareDescriptions ? { creditor: d.creditor } : {}), remaining: r(st.remaining), monthlyRate: d.monthlyRate ?? null, installmentsLeft: st.count - st.paidCount, nextDue: st.next?.dueDate ?? null }; }) } : null,
    unusualSpending: unusualSpending(data, today),
    recurringExpenses: recurring.map((x) => ({ ...(opts.shareDescriptions ? { name: x.name } : {}), category: x.category, monthly: x.monthly, months: x.months, lastSeen: x.last })),
  };
}

export function driverSummary(data: Data, today: string) {
  const since = addDays(today, -30);
  const s = data.sessions.filter((x) => x.date > since && x.date <= today);
  if (!s.length) return null;
  const gross = s.reduce((a, x) => a + x.amount, 0);
  const hours = s.reduce((a, x) => a + hhmmToHours(x.hoursWorked), 0);
  const km = s.reduce((a, x) => a + (x.kmDriven || 0), 0);
  const costs = data.vehicleExpenses.filter((e) => e.date > since && e.date <= today).reduce((a, e) => a + e.amount, 0);
  return {
    period: 'últimos 30 dias', days: new Set(s.map((x) => x.date)).size, gross: r(gross), hours: round2(hours), km: r(km), vehicleCosts: r(costs),
    perHour: hours ? round2(gross / hours) : null, perKm: km ? round2(gross / km) : null,
    byApp: appProfit(s, costs).map((a) => ({ app: a.app, gross: r(a.gross), net: r(a.net), netPerHour: round2(a.perHour) })),
    byWeekday: weekdayStats(s).filter((w) => w.days > 0).map((w) => ({ day: w.label, avgPerDay: r(w.perDay), perHour: round2(w.perHour) })),
    byTimeSlot: timeSlotStats(s).slots.filter((t) => t.hours > 0).map((t) => ({ slot: t.label, perHour: round2(t.perHour) })),
    vehicles: data.vehicles.map((v) => ({ kind: v.kind, model: v.model ?? null })),
  };
}

export function weekSummary(data: Data, today: string) {
  const week = (from: string, to: string) => {
    const tx = data.transactions.filter((t) => !isInternal(t) && t.date > from && t.date <= to);
    const byCat = new Map<string, number>();
    for (const t of tx) if (t.type === 'expense') byCat.set(t.category, (byCat.get(t.category) ?? 0) + t.amount);
    return {
      income: r(tx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)),
      expense: r(tx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)),
      byCategory: [...byCat].map(([category, v]) => ({ category, amount: r(v) })).sort((a, b) => b.amount - a.amount).slice(0, 6),
    };
  };
  return { thisWeek: week(addDays(today, -7), today), previousWeek: week(addDays(today, -14), addDays(today, -7)) };
}

/** Contexto completo que acompanha cada pergunta. É isto que o usuário vê em "O que é enviado". */
export function buildContext(data: Data, today: string, opts: { shareDescriptions?: boolean } = {}) {
  const ctx = { finance: financeSummary(data, today, opts), week: weekSummary(data, today), driver: driverSummary(data, today) };
  return JSON.stringify(ctx);
}

export { txMonth };
