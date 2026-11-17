import { describe, expect, it } from 'vitest';
import { appProfit, maintenanceRates, maintenanceReserve, timeSlotStats, weekdayStats } from './driverInsights';
import type { DriverSession, Vehicle } from '../types';

const s = (o: Partial<DriverSession>): DriverSession => ({ id: Math.random().toString(36), date: '2026-11-16', app: 'Uber', amount: 0, trips: 0, kmDriven: 0, hoursWorked: '00:00', fuelSpent: 0, foodSpent: 0, fuelConsumption: 10, ...o });

describe('dia da semana', () => {
  it('média por dia trabalhado e por hora', () => {
    const r = weekdayStats([s({ date: '2026-11-16', amount: 300, hoursWorked: '10:00' }), s({ date: '2026-11-16', amount: 100, hoursWorked: '02:00', app: '99' }), s({ date: '2026-11-23', amount: 200, hoursWorked: '08:00' })]);
    const seg = r[1];
    expect(seg).toMatchObject({ label: 'Seg', days: 2, gross: 600, perDay: 300, hours: 20, perHour: 30 });
    expect(r[0].days).toBe(0);
  });
});

describe('faixa de horário', () => {
  it('divide o turno entre as faixas, inclusive virando a meia-noite', () => {
    const r = timeSlotStats([
      s({ startTime: '10:00', hoursWorked: '04:00', amount: 160 }), // 2h manhã, 2h tarde → R$ 40/h
      s({ startTime: '22:00', hoursWorked: '04:00', amount: 240 }), // 2h noite, 2h madrugada → R$ 60/h
      s({ hoursWorked: '05:00', amount: 999 }), // sem horário: fora
    ]);
    expect(r.withStart).toBe(2);
    const by = Object.fromEntries(r.slots.map((x) => [x.id, x]));
    expect(by.manha).toMatchObject({ hours: 2, gross: 80, perHour: 40 });
    expect(by.tarde).toMatchObject({ hours: 2, gross: 80 });
    expect(by.noite).toMatchObject({ hours: 2, gross: 120, perHour: 60 });
    expect(by.madrugada).toMatchObject({ hours: 2, gross: 120 });
  });
});

describe('lucro por aplicativo', () => {
  it('desconta custos diretos e rateia os do carro pelos km', () => {
    const r = appProfit([
      s({ app: 'Uber', amount: 300, kmDriven: 150, fuelSpent: 60, hoursWorked: '06:00' }),
      s({ app: '99', amount: 250, kmDriven: 50, fuelSpent: 20, hoursWorked: '05:00' }),
    ], 100);
    // Uber: 300 − 60 − 75 = 165 ; 99: 250 − 20 − 25 = 205 → 99 lucra mais apesar de faturar menos
    expect(r.map((x) => [x.app, x.net])).toEqual([['99', 205], ['Uber', 165]]);
    expect(r[0].perHour).toBe(41);
  });
});

describe('reserva de manutenção', () => {
  const v: Vehicle = { id: 'v', name: 'Onix', plate: '', fuelType: 'Flex', ownership: 'owned', odometer: 52000, fuelConsumption: 12, ipvaValue: 0, licensingValue: 0, insuranceValue: 0, installmentValue: 0, oilIntervalKm: 10000, active: true,
    oilChangeCost: 250, tireSetCost: 2000, tireLifeKm: 40000, revisionCost: 1200, revisionIntervalKm: 20000, reserveStartKm: 50000, reserveStartDate: '2026-10-01' };
  it('valor por km e saldo acumulado menos gastos desde o início', () => {
    const rates = maintenanceRates(v);
    expect(rates).toEqual({ pneus: 0.05, oleo: 0.025, revisao: 0.06 });
    const r = maintenanceReserve(v, [
      { id: 'e1', vehicleId: 'v', date: '2026-10-20', category: 'Troca de óleo', amount: 240 },
      { id: 'e2', vehicleId: 'v', date: '2026-09-01', category: 'Pneus', amount: 999 }, // antes do início: fora
      { id: 'e3', vehicleId: 'v', date: '2026-11-01', category: 'Combustível', amount: 300 }, // não é manutenção
    ]);
    expect(r).toMatchObject({ active: true, km: 2000, accrued: 270, spent: 240, balance: 30 });
    expect(r.buckets.find((b) => b.id === 'oleo')).toMatchObject({ accrued: 50, spent: 240, balance: -190 });
  });
  it('inativa sem início ou sem custos', () => {
    expect(maintenanceReserve({ ...v, reserveStartKm: null }, []).active).toBe(false);
  });
});
