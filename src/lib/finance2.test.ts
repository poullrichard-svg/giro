import { describe, expect, it } from 'vitest';
import {
  averagePrice, bazinCeiling, cashVsInstallments, convertRate, dividendPlan, grahamFairPrice,
  inflationAdjusted, purchasingPower, realRate, rentVsBuy, safetyMargin,
} from './finance';

describe('dividendos e valuation', () => {
  it('número mágico de um FII', () => {
    const r = dividendPlan(100, 0.8, 1000)!;
    expect(r.magicNumber).toBe(125);
    expect(r.magicCapital).toBe(12500);
    expect(r.sharesForTarget).toBe(1250);
    expect(r.annualYield).toBeCloseTo(0.096);
    expect(dividendPlan(0, 1, 1)).toBeNull();
  });
  it('Bazin e Graham', () => {
    expect(bazinCeiling(1.8, 0.06)).toBe(30);
    expect(grahamFairPrice(2, 20)).toBeCloseTo(30, 2);
    expect(grahamFairPrice(-1, 20)).toBeNull();
    expect(safetyMargin(30, 24)).toBeCloseTo(0.2);
  });
  it('preço médio com taxas', () => {
    expect(averagePrice([{ qty: 100, price: 10 }, { qty: 100, price: 12, fees: 20 }]).average).toBeCloseTo(11.1);
  });
});

describe('taxas e inflação', () => {
  it('rentabilidade real e conversões', () => {
    expect(realRate(0.12, 0.04)).toBeCloseTo(0.076923, 5);
    expect(convertRate(0.01, 12, 1)).toBeCloseTo(0.126825, 5); // 1% a.m. -> a.a.
    expect(convertRate(0.12682503, 1, 12)).toBeCloseTo(0.01, 6); // a.a. -> a.m.
    expect(purchasingPower(1000, 0.1, 1)).toBeCloseTo(909.09, 2);
    expect(inflationAdjusted(1000, 0.1, 2)).toBe(1210);
  });
});

describe('decisões de compra', () => {
  it('sem juros embutidos e dinheiro rendendo: parcelar vence', () => {
    const r = cashVsInstallments({ cashPrice: 1000, installment: 100, count: 10, firstNow: false, investMonthlyRate: 0.01 });
    expect(r.hiddenMonthlyRate).toBe(0);
    expect(r.better).toBe('parcelado');
  });
  it('desconto grande à vista: à vista vence e mostra os juros embutidos', () => {
    const r = cashVsInstallments({ cashPrice: 850, installment: 100, count: 10, firstNow: false, investMonthlyRate: 0.01 });
    expect(r.better).toBe('avista');
    expect(r.hiddenMonthlyRate).toBeGreaterThan(0.025);
    expect(r.discountPct).toBeCloseTo(0.15);
  });
  it('alugar x comprar retorna os dois patrimônios', () => {
    const r = rentVsBuy({ propertyPrice: 400000, downPayment: 80000, loanMonthlyRate: 0.009, loanMonths: 360, monthlyCostsOwner: 300, rent: 2000, rentAnnualIncrease: 0.05, investMonthlyRate: 0.008, propertyAnnualAppreciation: 0.05, horizonMonths: 120 });
    expect(r.remainingDebt).toBeGreaterThan(0);
    expect(r.buyerWealth).toBeGreaterThan(0);
    expect(r.renterWealth).toBeGreaterThan(80000);
    expect(['comprar', 'alugar']).toContain(r.better);
  });
});
