import { describe, expect, it } from 'vitest';
import { driverStats, fixedBillAlerts, monthTotals, oilStatus, vehicleAlerts } from './stats';
import type { Vehicle } from '../types';

const veh: Vehicle = {
  id: 'v1', name: 'Onix', plate: 'ABC1D23', fuelType: 'Flex', ownership: 'financed', odometer: 50500, fuelConsumption: 12,
  ipvaValue: 2400, ipvaDueDate: '2026-11-20', licensingValue: 0, insuranceValue: 300, installmentValue: 1500,
  oilIntervalKm: 10000, lastOilChangeKm: 41000, active: true,
};

describe('stats', () => {
  it('totais do mês somam fixas', () => {
    const t = monthTotals(
      [{ id: '1', description: 'x', amount: 100, type: 'expense', category: 'A', paymentMethod: 'Pix', date: '2026-11-02' },
       { id: '2', description: 'y', amount: 50, type: 'expense', category: 'A', paymentMethod: 'Pix', date: '2026-10-02' }],
      [{ id: 'f', description: 'Sal', amount: 3000, type: 'income', category: 'Salário' }], '2026-11');
    expect(t).toMatchObject({ income: 3000, expense: 100, balance: 2900 });
  });
  it('alerta de conta fixa só se não paga', () => {
    const fixed = [{ id: 'f1', description: 'Luz', amount: 200, type: 'expense' as const, category: 'Contas de casa', dueDay: 15 }];
    expect(fixedBillAlerts(fixed, [], '2026-11-13')).toHaveLength(1);
    expect(fixedBillAlerts(fixed, [{ id: 'p', fixedId: 'f1', month: '2026-11', amount: 200, paidAt: '' }], '2026-11-13')).toHaveLength(0);
  });
  it('alertas do veículo: IPVA e óleo', () => {
    expect(oilStatus(veh)!.remaining).toBe(500);
    const a = vehicleAlerts([veh], '2026-11-13');
    expect(a.map((x) => x.id).sort()).toEqual(['v1-IPVA', 'v1-oil']);
  });
  it('lucro do motorista desconta custos operacionais e fixos', () => {
    const r = driverStats(
      [{ id: 's', date: '2026-11-13', app: 'Uber', amount: 400, trips: 20, kmDriven: 200, hoursWorked: '10:00', fuelSpent: 100, foodSpent: 30, fuelConsumption: 12, vehicleId: 'v1' }],
      [], [veh], (d) => d === '2026-11-13', 1);
    expect(r.operationalProfit).toBe(270);
    expect(r.fixedCost).toBeCloseTo((1500 + 300 + 200) / 30, 1);
    expect(r.perHour).toBe(40);
  });
});

import { elapsedDays } from './format';
describe('elapsedDays', () => {
  it('conta só os dias já passados', () => {
    expect(elapsedDays('2026-11-01', '2026-11-30', '2026-11-13')).toBe(13);
    expect(elapsedDays('2026-10-01', '2026-10-31', '2026-11-13')).toBe(31);
    expect(elapsedDays('2026-12-01', '2026-12-31', '2026-11-13')).toBe(0);
  });
});
