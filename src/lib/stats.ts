import type { DriverSession, FixedBill, FixedPayment, Transaction, Vehicle, VehicleExpense } from '../types';
import { addMonths, daysUntil, hhmmToHours, localISODate, round2 } from './format';

const sum = <T,>(arr: T[], f: (x: T) => number) => round2(arr.reduce((s, x) => s + (f(x) || 0), 0));

export function monthTotals(tx: Transaction[], fixed: FixedBill[], month: string) {
  const m = tx.filter((t) => t.date?.startsWith(month));
  const varIncome = sum(m.filter((t) => t.type === 'income'), (t) => t.amount);
  const varExpense = sum(m.filter((t) => t.type === 'expense'), (t) => t.amount);
  const fixIncome = sum(fixed.filter((t) => t.type === 'income'), (t) => t.amount);
  const fixExpense = sum(fixed.filter((t) => t.type === 'expense'), (t) => t.amount);
  return {
    varIncome, varExpense, fixIncome, fixExpense,
    income: round2(varIncome + fixIncome),
    expense: round2(varExpense + fixExpense),
    balance: round2(varIncome + fixIncome - varExpense - fixExpense),
  };
}

export function categoryBreakdown(tx: Transaction[], fixed: FixedBill[], month: string) {
  const map = new Map<string, number>();
  for (const t of tx) if (t.type === 'expense' && t.date?.startsWith(month)) map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  for (const t of fixed) if (t.type === 'expense') map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  return [...map.entries()].map(([label, value]) => ({ label, value: round2(value) })).sort((a, b) => b.value - a.value);
}

export function lastMonthsSeries(tx: Transaction[], fixed: FixedBill[], endMonth: string, count = 6) {
  return Array.from({ length: count }, (_, i) => {
    const month = addMonths(endMonth, i - count + 1);
    const t = monthTotals(tx, fixed, month);
    return { month, income: t.income, expense: t.expense };
  });
}

export interface Alert { id: string; severity: 'danger' | 'warn' | 'info'; title: string; detail: string; days?: number; href?: string }

/** Contas fixas sem pagamento registrado no mês, vencendo em até `window` dias (ou atrasadas). */
export function fixedBillAlerts(fixed: FixedBill[], payments: FixedPayment[], today = localISODate(), window = 5): Alert[] {
  const month = today.slice(0, 7);
  const day = Number(today.slice(8, 10));
  return fixed
    .filter((f) => f.type === 'expense' && f.dueDay && !payments.some((p) => p.fixedId === f.id && p.month === month))
    .map((f) => ({ f, diff: f.dueDay! - day }))
    .filter(({ diff }) => diff <= window)
    .map(({ f, diff }) => ({
      id: `fixed-${f.id}`,
      severity: diff < 0 ? 'danger' : diff <= 1 ? 'warn' : 'info',
      title: f.description,
      detail: diff < 0 ? `Venceu dia ${f.dueDay} (${-diff}d atrás)` : diff === 0 ? 'Vence hoje' : `Vence dia ${f.dueDay} (em ${diff}d)`,
      days: diff,
      href: '#/fixas',
    }) as Alert);
}

export function vehicleAlerts(vehicles: Vehicle[], today = localISODate()): Alert[] {
  const out: Alert[] = [];
  for (const v of vehicles.filter((x) => x.active)) {
    const docs: Array<[string, string | null | undefined]> = [['IPVA', v.ipvaDueDate], ['Licenciamento', v.licensingDueDate], ['Seguro', v.insuranceDueDate]];
    for (const [label, date] of docs) {
      if (!date) continue;
      const d = daysUntil(date, today);
      if (d > 30) continue;
      out.push({ id: `${v.id}-${label}`, severity: d < 0 ? 'danger' : d <= 7 ? 'warn' : 'info', title: `${label} · ${v.name}`, detail: d < 0 ? `Vencido há ${-d} dias` : d === 0 ? 'Vence hoje' : `Vence em ${d} dias`, days: d, href: `#/veiculos/${v.id}` });
    }
    const oil = oilStatus(v);
    if (oil && oil.remaining <= 1000) {
      out.push({ id: `${v.id}-oil`, severity: oil.remaining <= 0 ? 'danger' : 'warn', title: `Troca de óleo · ${v.name}`, detail: oil.remaining <= 0 ? `Passou ${Math.abs(oil.remaining).toLocaleString('pt-BR')} km` : `Faltam ${oil.remaining.toLocaleString('pt-BR')} km`, href: `#/veiculos/${v.id}` });
    }
  }
  return out;
}

export function oilStatus(v: Vehicle) {
  if (v.lastOilChangeKm == null || !v.oilIntervalKm) return null;
  const next = v.lastOilChangeKm + v.oilIntervalKm;
  const remaining = Math.round(next - v.odometer);
  return { next, remaining, pct: Math.min(100, Math.max(0, ((v.odometer - v.lastOilChangeKm) / v.oilIntervalKm) * 100)) };
}

/** Custo fixo mensal do veículo (parcela/aluguel + seguro + IPVA e licenciamento diluídos). */
export const vehicleFixedMonthly = (v: Vehicle) =>
  round2(v.installmentValue + (v.ownership === 'rented' ? 0 : v.insuranceValue + (v.ipvaValue + v.licensingValue) / 12));

export function driverStats(sessions: DriverSession[], vehicleExpenses: VehicleExpense[], vehicles: Vehicle[], filter: (date: string) => boolean, daysInPeriod: number) {
  const s = sessions.filter((x) => filter(x.date));
  const gross = sum(s, (x) => x.amount);
  const trips = s.reduce((a, x) => a + (x.trips || 0), 0);
  const km = sum(s, (x) => x.kmDriven);
  const hours = s.reduce((a, x) => a + hhmmToHours(x.hoursWorked), 0);
  const fuel = sum(s, (x) => x.fuelSpent);
  const food = sum(s, (x) => x.foodSpent);
  const vexp = sum(vehicleExpenses.filter((e) => filter(e.date)), (e) => e.amount);
  const operationalCost = round2(fuel + food + vexp);
  const operationalProfit = round2(gross - operationalCost);

  // Custo fixo dos veículos ativos, proporcional aos dias do período.
  const usedIds = new Set(s.map((x) => x.vehicleId).filter(Boolean));
  const fleet = vehicles.filter((v) => v.active && (usedIds.size === 0 || usedIds.has(v.id)));
  const fixedCost = round2((fleet.reduce((a, v) => a + vehicleFixedMonthly(v), 0) / 30) * daysInPeriod);
  const netProfit = round2(operationalProfit - fixedCost);

  const byApp = new Map<string, number>();
  for (const x of s) byApp.set(x.app, (byApp.get(x.app) ?? 0) + x.amount);
  const days = new Set(s.map((x) => x.date)).size;
  const per = (v: number, d: number) => (d > 0 ? round2(v / d) : 0);

  return {
    sessions: s, gross, trips, km: round2(km), hours, fuel, food, vehicleExpenses: vexp, operationalCost, operationalProfit, fixedCost, netProfit, daysWorked: days,
    byApp: [...byApp.entries()].map(([label, value]) => ({ label, value: round2(value) })).sort((a, b) => b.value - a.value),
    perTrip: per(gross, trips), perHour: per(gross, hours), perKm: per(gross, km),
    profitPerTrip: per(netProfit, trips), profitPerHour: per(netProfit, hours), profitPerKm: per(netProfit, km),
    costPerKm: per(operationalCost + fixedCost, km), avgPerDay: per(gross, days),
  };
}
