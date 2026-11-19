import { describe, expect, it } from 'vitest';
import { depreciation, kmPerDay, parseFipeValue, wearItems } from './vehicleCare';
import type { Vehicle } from '../types';

const base = { id: 'v', name: 'Onix', plate: 'ABC1D23', fuelType: 'Flex', ownership: 'owned', odometer: 60000, fuelConsumption: 12, ipvaValue: 0, licensingValue: 0, insuranceValue: 0, installmentValue: 0, oilIntervalKm: 10000, lastOilChangeKm: 52000, active: true } as Vehicle;

describe('pneus e filtros', () => {
  it('calcula desgaste, quanto falta e o nível de alerta', () => {
    const v = { ...base, tireSize: '175/70 R14', tireLifeKm: 40000, tireInstalledKm: 25000, airFilterIntervalKm: 10000, airFilterLastKm: 50500, fuelFilterIntervalKm: 20000, cabinFilterIntervalKm: 15000, cabinFilterLastKm: 46000 };
    const w = Object.fromEntries(wearItems(v).map((x) => [x.key, x]));
    expect(Object.keys(w)).toEqual(['oleo', 'pneus', 'ar', 'cabine']); // filtro de combustível sem "última troca" fica de fora
    expect(w.oleo).toMatchObject({ remaining: 2000, level: 'ok' });
    expect(w.pneus).toMatchObject({ label: 'Pneus 175/70 R14', usedKm: 35000, remaining: 5000, pct: 87.5, level: 'ok' });
    expect(w.ar).toMatchObject({ remaining: 500, level: 'atencao' });
    expect(w.cabine).toMatchObject({ remaining: 1000, level: 'atencao' });
    expect(wearItems({ ...v, odometer: 66000 }).find((x) => x.key === 'pneus')!.level).toBe('trocar');
  });
  it('km por dia desde a troca', () => {
    expect(kmPerDay(50000, '2026-10-20', 53000, '2026-11-19')).toBe(100);
    expect(kmPerDay(50000, '2026-11-17', 50300, '2026-11-19')).toBeNull();
  });
});

describe('FIPE e depreciação', () => {
  it('compara com o preço de compra', () => {
    const v = { ...base, purchasePrice: 80000, purchaseDate: '2024-11-19', fipe: { type: 'carros', brandId: '23', modelId: '1', yearId: '2022-1', label: 'Onix', value: 68000, refMonth: 'novembro de 2026', updatedAt: '2026-11-19' } } as Vehicle;
    const d = depreciation(v, '2026-11-19')!;
    expect(d).toMatchObject({ fipe: 68000, base: 80000, lost: 12000, baseLabel: 'preço de compra' });
    expect(d.pct).toBe(15);
    expect(d.perYear).toBeCloseTo(6004.1, 0);
  });
  it('sem preço de compra usa a primeira FIPE guardada', () => {
    const v = { ...base, fipe: { type: 'carros', brandId: '1', modelId: '1', yearId: '1', label: 'x', value: 47500, updatedAt: '2026-11-19' }, fipeHistory: [{ date: '2025-11-19', value: 50000, ref: 'novembro de 2025' }, { date: '2026-11-19', value: 47500 }] } as Vehicle;
    expect(depreciation(v, '2026-11-19')).toMatchObject({ base: 50000, lost: 2500, pct: 5, baseLabel: 'FIPE de novembro de 2025' });
    expect(depreciation({ ...base })).toBeNull();
  });
  it('lê o valor no formato da FIPE', () => { expect(parseFipeValue('R$ 52.345,67')).toBe(52345.67); });
});
