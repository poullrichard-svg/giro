/**
 * Veículo: desgaste de pneus e filtros, e depreciação pela FIPE (vehicleCare.test.ts).
 */
import type { Vehicle } from '../types';
import { daysUntil, localISODate, round2 } from './format';

export type WearKey = 'oleo' | 'pneus' | 'ar' | 'combustivel' | 'cabine';
export interface WearItem { key: WearKey; label: string; intervalKm: number; lastKm: number; usedKm: number; remaining: number; pct: number; level: 'ok' | 'atencao' | 'trocar' }

const level = (remaining: number, interval: number): WearItem['level'] => (remaining <= 0 ? 'trocar' : remaining <= Math.max(500, interval * 0.1) ? 'atencao' : 'ok');

/** Itens de manutenção por km: só os que têm intervalo e última troca informados. */
export function wearItems(v: Vehicle): WearItem[] {
  const defs: Array<[WearKey, string, number | null | undefined, number | null | undefined]> = [
    ['oleo', 'Óleo e filtro de óleo', v.oilIntervalKm, v.lastOilChangeKm],
    ['pneus', v.tireSize ? `Pneus ${v.tireSize}` : 'Pneus', v.tireLifeKm, v.tireInstalledKm],
    ['ar', 'Filtro de ar', v.airFilterIntervalKm, v.airFilterLastKm],
    ['combustivel', 'Filtro de combustível', v.fuelFilterIntervalKm, v.fuelFilterLastKm],
    ['cabine', 'Filtro de cabine (ar-condicionado)', v.cabinFilterIntervalKm, v.cabinFilterLastKm],
  ];
  return defs.flatMap(([key, label, interval, last]) => {
    if (!interval || interval <= 0 || last == null) return [];
    const used = Math.max(0, v.odometer - last);
    const remaining = Math.round(interval - used);
    return [{ key, label, intervalKm: interval, lastKm: last, usedKm: Math.round(used), remaining, pct: Math.min(100, (used / interval) * 100), level: level(remaining, interval) }];
  });
}

/** Média de km por dia desde uma data (para estimar quando trocar). */
export function kmPerDay(fromKm: number, fromDate: string | null | undefined, odometer: number, today = localISODate()) {
  if (!fromDate) return null;
  const days = -daysUntil(fromDate, today);
  return days >= 7 && odometer > fromKm ? (odometer - fromKm) / days : null;
}

export interface Depreciation { fipe: number; ref: string | null; base: number; baseLabel: string; lost: number; pct: number; perYear: number | null; perMonth: number | null; years: number | null }

/** Depreciação: compara a FIPE atual com o preço de compra (ou com a primeira FIPE guardada). */
export function depreciation(v: Vehicle, today = localISODate()): Depreciation | null {
  const fipe = v.fipe?.value;
  if (!fipe) return null;
  const hist = [...(v.fipeHistory ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  const base = v.purchasePrice && v.purchasePrice > 0 ? { value: v.purchasePrice, date: v.purchaseDate ?? null, label: 'preço de compra' }
    : hist.length > 1 ? { value: hist[0].value, date: hist[0].date, label: `FIPE de ${hist[0].ref ?? hist[0].date}` } : null;
  if (!base) return { fipe, ref: v.fipe?.refMonth ?? null, base: 0, baseLabel: '', lost: 0, pct: 0, perYear: null, perMonth: null, years: null };
  const lost = round2(base.value - fipe);
  const years = base.date ? Math.max(0, -daysUntil(base.date, today)) / 365.25 : null;
  const perYear = years && years >= 0.25 ? round2(lost / years) : null;
  return { fipe, ref: v.fipe?.refMonth ?? null, base: base.value, baseLabel: base.label, lost, pct: base.value > 0 ? (lost / base.value) * 100 : 0, perYear, perMonth: perYear != null ? round2(perYear / 12) : null, years };
}

/** "R$ 52.345,00" (texto da FIPE) → 52345. */
export const parseFipeValue = (s: string) => Number(String(s).replace(/[^\d,]/g, '').replace(',', '.')) || 0;
