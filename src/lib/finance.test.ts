import { describe, expect, it } from 'vitest';
import {
  annualToMonthly, compound, consorcio, driverCost, fixedIncomeComparison, irRate, loan,
  monthsToTarget, pmt, rateFromPmt, requiredMonthly, withdrawalPlan,
} from './finance';

describe('loan', () => {
  it('Price: 10.000 a 1% a.m. em 12x dá parcela ~888,49', () => {
    expect(pmt(10000, 0.01, 12)).toBeCloseTo(888.49, 2);
    const r = loan(10000, 0.01, 12, 'price');
    expect(r.firstInstallment).toBeCloseTo(888.49, 2);
    expect(r.schedule.at(-1)!.balance).toBeCloseTo(0, 1);
    expect(r.totalInterest).toBeCloseTo(661.86, 0);
  });
  it('SAC: amortização constante e parcela decrescente', () => {
    const r = loan(12000, 0.01, 12, 'sac');
    expect(r.firstInstallment).toBeCloseTo(1120, 2);
    expect(r.lastInstallment).toBeCloseTo(1010, 2);
    expect(r.totalInterest).toBeCloseTo(780, 2);
  });
  it('taxa zero divide igualmente', () => {
    expect(loan(1200, 0, 12, 'price').firstInstallment).toBe(100);
  });
});

describe('consorcio', () => {
  it('calcula parcela com taxa de adm e fundo de reserva', () => {
    const r = consorcio({ credit: 100000, months: 100, adminFeePct: 0.18, reserveFundPct: 0.02, insuranceMonthlyPct: 0, annualAdjustmentPct: 0, bidPct: 0, embeddedBid: false });
    expect(r.installment).toBe(1200);
    expect(r.totalCostNoAdjust).toBe(120000);
    expect(r.effectiveFeePct).toBeCloseTo(0.2);
    expect(r.equivalentMonthlyRate).toBeGreaterThan(0);
  });
  it('lance embutido reduz o crédito disponível', () => {
    const r = consorcio({ credit: 100000, months: 100, adminFeePct: 0.18, reserveFundPct: 0.02, insuranceMonthlyPct: 0, annualAdjustmentPct: 0, bidPct: 0.25, embeddedBid: true });
    expect(r.creditAvailable).toBe(75000);
    expect(r.ownCashForBid).toBe(0);
  });
});

describe('investimentos', () => {
  it('converte taxa anual em mensal', () => {
    expect(annualToMonthly(0.12682503)).toBeCloseTo(0.01, 6);
  });
  it('juros compostos', () => {
    const r = compound(1000, 100, 0.01, 12);
    expect(r.invested).toBe(2200);
    expect(r.final).toBeCloseTo(2395.08, 1);
  });
  it('meses até a meta e aporte necessário são consistentes', () => {
    const m = monthsToTarget(0, 1000, 0.01, 100000)!;
    expect(m).toBe(70);
    const need = requiredMonthly(0, 0.01, 70, 100000);
    expect(need).toBeLessThanOrEqual(1000);
    expect(rateFromPmt(10000, pmt(10000, 0.015, 24), 24)).toBeCloseTo(0.015, 6);
  });
  it('renda perpétua quando o saque <= rendimento', () => {
    expect(withdrawalPlan(100000, 500, 0.01).perpetual).toBe(true);
    expect(withdrawalPlan(10000, 1000, 0.01).months).toBe(11);
  });
  it('IR regressivo e comparação de renda fixa', () => {
    expect(irRate(100)).toBe(0.225);
    expect(irRate(800)).toBe(0.15);
    const r = fixedIncomeComparison({ amount: 10000, months: 12, cdiAnnual: 0.12, selicAnnual: 0.12, trMonthly: 0, products: [
      { name: 'CDB 100%', pctCdi: 1, taxFree: false }, { name: 'LCI 90%', pctCdi: 0.9, taxFree: true },
    ] });
    const cdb = r.results.find((x) => x.name === 'CDB 100%')!;
    expect(cdb.gross).toBeCloseTo(1200, 0);
    expect(r.irPct).toBe(0.175); // 12 meses = 365 dias
    expect(cdb.net).toBeCloseTo(990, 0);
  });
});

describe('driverCost', () => {
  it('soma custos e calcula custo por km', () => {
    const r = driverCost({
      ownership: 'owned', vehicleValue: 60000, installment: 0, monthlyKm: 5000, insuranceMonthly: 300,
      ipvaAnnual: 2400, licensingAnnual: 0, depreciationAnnualPct: 0.1, tireSetCost: 2000, tireLifeKm: 40000,
      oilChangeCost: 250, oilIntervalKm: 10000, otherMaintenanceMonthly: 0, fuelPrice: 6, kmPerLiter: 12,
      desiredProfitMonthly: 5000, rentIncludesMaintenance: false,
    });
    // 300 + 200 + 500 + 250 + 125 + 2500 = 3875
    expect(r.monthlyCost).toBe(3875);
    expect(r.costPerKm).toBe(0.78);
    expect(r.minRatePerKm).toBe(1.78);
  });
});
