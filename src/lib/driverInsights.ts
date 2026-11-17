/**
 * Análises do painel do motorista — cálculos puros (driverInsights.test.ts).
 */
import type { DriverSession, Vehicle, VehicleExpense } from '../types';
import { hhmmToHours, parseISODate, round2 } from './format';

// ---------------------------------------------------------------------------
// Dia da semana
// ---------------------------------------------------------------------------
export const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export interface WeekdayStat { day: number; label: string; days: number; gross: number; hours: number; perDay: number; perHour: number }

/** Média por dia trabalhado e por hora, para cada dia da semana. */
export function weekdayStats(sessions: DriverSession[]): WeekdayStat[] {
  const byDay = WEEKDAYS.map((label, day) => ({ day, label, dates: new Set<string>(), gross: 0, hours: 0 }));
  for (const s of sessions) {
    const d = byDay[parseISODate(s.date).getDay()];
    d.dates.add(s.date); d.gross += s.amount; d.hours += hhmmToHours(s.hoursWorked);
  }
  return byDay.map((d) => ({ day: d.day, label: d.label, days: d.dates.size, gross: round2(d.gross), hours: round2(d.hours), perDay: d.dates.size ? round2(d.gross / d.dates.size) : 0, perHour: d.hours ? round2(d.gross / d.hours) : 0 }));
}

// ---------------------------------------------------------------------------
// Faixa de horário
// ---------------------------------------------------------------------------
export const TIME_SLOTS = [
  { id: 'madrugada', label: 'Madrugada', from: 0, to: 6 },
  { id: 'manha', label: 'Manhã', from: 6, to: 12 },
  { id: 'tarde', label: 'Tarde', from: 12, to: 18 },
  { id: 'noite', label: 'Noite', from: 18, to: 24 },
] as const;

export interface SlotStat { id: string; label: string; range: string; hours: number; gross: number; perHour: number }

/**
 * Distribui o ganho de cada turno pelas faixas de horário que ele cobriu (proporcional às horas),
 * inclusive turnos que viram a meia-noite. Turnos sem horário de início ficam de fora.
 */
export function timeSlotStats(sessions: DriverSession[]): { slots: SlotStat[]; withStart: number; total: number } {
  const acc = TIME_SLOTS.map((t) => ({ ...t, hours: 0, gross: 0 }));
  let withStart = 0;
  for (const s of sessions) {
    const dur = hhmmToHours(s.hoursWorked);
    if (!s.startTime || dur <= 0) continue;
    withStart++;
    const start = hhmmToHours(s.startTime);
    const perHour = s.amount / dur;
    // Percorre o turno em pedaços que não cruzam limites de faixa nem a meia-noite.
    let t = start; let left = dur;
    while (left > 1e-9) {
      const h = t % 24;
      const slot = acc.find((x) => h >= x.from && h < x.to)!;
      const step = Math.min(left, slot.to - h);
      slot.hours += step; slot.gross += perHour * step;
      t += step; left -= step;
    }
  }
  return {
    slots: acc.map((x) => ({ id: x.id, label: x.label, range: `${String(x.from).padStart(2, '0')}h–${String(x.to % 24).padStart(2, '0')}h`, hours: round2(x.hours), gross: round2(x.gross), perHour: x.hours ? round2(x.gross / x.hours) : 0 })),
    withStart, total: sessions.length,
  };
}

// ---------------------------------------------------------------------------
// Comparação entre aplicativos pelo lucro
// ---------------------------------------------------------------------------
export interface AppProfit { app: string; gross: number; directCost: number; sharedCost: number; net: number; hours: number; km: number; perHour: number; perKm: number; margin: number }

/**
 * Lucro líquido por aplicativo: ganho − (combustível + alimentação do próprio turno)
 * − parte dos custos do veículo (gastos do período + custo fixo), rateada pelos km rodados em cada app.
 */
export function appProfit(sessions: DriverSession[], sharedCosts: number): AppProfit[] {
  const totalKm = sessions.reduce((s, x) => s + (x.kmDriven || 0), 0);
  const totalHours = sessions.reduce((s, x) => s + hhmmToHours(x.hoursWorked), 0);
  const map = new Map<string, { gross: number; direct: number; km: number; hours: number }>();
  for (const s of sessions) {
    const a = map.get(s.app) ?? { gross: 0, direct: 0, km: 0, hours: 0 };
    a.gross += s.amount; a.direct += (s.fuelSpent || 0) + (s.foodSpent || 0); a.km += s.kmDriven || 0; a.hours += hhmmToHours(s.hoursWorked);
    map.set(s.app, a);
  }
  return [...map.entries()].map(([app, a]) => {
    // Sem km registrado, rateia pelas horas.
    const share = totalKm > 0 ? a.km / totalKm : totalHours > 0 ? a.hours / totalHours : 1 / map.size;
    const sharedCost = round2(sharedCosts * share);
    const net = round2(a.gross - a.direct - sharedCost);
    return { app, gross: round2(a.gross), directCost: round2(a.direct), sharedCost, net, hours: round2(a.hours), km: round2(a.km), perHour: a.hours ? round2(net / a.hours) : 0, perKm: a.km ? round2(net / a.km) : 0, margin: a.gross ? net / a.gross : 0 };
  }).sort((x, y) => y.net - x.net);
}

// ---------------------------------------------------------------------------
// Reserva de manutenção
// ---------------------------------------------------------------------------
export const MAINTENANCE_BUCKETS = [
  { id: 'pneus', label: 'Pneus', categories: ['Pneus'] },
  { id: 'oleo', label: 'Óleo', categories: ['Troca de óleo'] },
  { id: 'revisao', label: 'Revisões e peças', categories: ['Manutenção'] },
] as const;

/** Quanto separar por km rodado em cada item. */
export function maintenanceRates(v: Vehicle) {
  const per = (cost?: number | null, km?: number | null) => (cost && km && km > 0 ? cost / km : 0);
  return {
    pneus: per(v.tireSetCost, v.tireLifeKm),
    oleo: per(v.oilChangeCost, v.oilIntervalKm),
    revisao: per(v.revisionCost, v.revisionIntervalKm),
  };
}

export interface ReserveBucket { id: string; label: string; perKm: number; accrued: number; spent: number; balance: number }
export interface Reserve { active: boolean; perKm: number; km: number; since: string | null; buckets: ReserveBucket[]; accrued: number; spent: number; balance: number }

/**
 * Reserva acumulada desde que foi ativada: km rodados (pelo hodômetro) × valor por km,
 * menos o que já foi gasto em pneus, óleo e manutenção desde então.
 */
export function maintenanceReserve(v: Vehicle, expenses: VehicleExpense[]): Reserve {
  const rates = maintenanceRates(v);
  const perKm = rates.pneus + rates.oleo + rates.revisao;
  const active = v.reserveStartKm != null && !!v.reserveStartDate && perKm > 0;
  const km = active ? Math.max(0, v.odometer - (v.reserveStartKm ?? 0)) : 0;
  const mine = expenses.filter((e) => e.vehicleId === v.id && active && e.date >= (v.reserveStartDate ?? ''));
  const buckets = MAINTENANCE_BUCKETS.map((b) => {
    const accrued = round2(km * rates[b.id]);
    const spent = round2(mine.filter((e) => (b.categories as readonly string[]).includes(e.category)).reduce((s, e) => s + e.amount, 0));
    return { id: b.id, label: b.label, perKm: rates[b.id], accrued, spent, balance: round2(accrued - spent) };
  });
  const accrued = round2(buckets.reduce((s, b) => s + b.accrued, 0));
  const spent = round2(buckets.reduce((s, b) => s + b.spent, 0));
  return { active, perKm, km, since: v.reserveStartDate ?? null, buckets, accrued, spent, balance: round2(accrued - spent) };
}
