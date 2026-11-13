/**
 * Cálculos financeiros puros (sem React), testados em finance.test.ts.
 * Taxas sempre em decimal (0.01 = 1%).
 */
import { round2 } from './format';

export const annualToMonthly = (annual: number) => Math.pow(1 + annual, 1 / 12) - 1;
export const monthlyToAnnual = (monthly: number) => Math.pow(1 + monthly, 12) - 1;

export interface ScheduleRow {
  month: number;
  installment: number;
  interest: number;
  amortization: number;
  extras: number;
  balance: number;
}

export interface LoanResult {
  system: 'price' | 'sac';
  principal: number;
  firstInstallment: number;
  lastInstallment: number;
  totalPaid: number;
  totalInterest: number;
  totalExtras: number;
  schedule: ScheduleRow[];
}

/** Parcela fixa da Tabela Price (PMT). */
export const pmt = (principal: number, rate: number, n: number) => {
  if (n <= 0) return 0;
  if (rate === 0) return principal / n;
  return (principal * rate) / (1 - Math.pow(1 + rate, -n));
};

/**
 * Financiamento pelo sistema Price (parcela fixa) ou SAC (amortização constante).
 * `monthlyExtras` cobre seguros/taxas mensais (ex.: MIP/DFI e tarifa no imobiliário).
 */
export function loan(
  principal: number,
  monthlyRate: number,
  months: number,
  system: 'price' | 'sac',
  monthlyExtras = 0,
): LoanResult {
  const schedule: ScheduleRow[] = [];
  let balance = principal;
  const fixed = pmt(principal, monthlyRate, months);
  const amortSac = months > 0 ? principal / months : 0;
  let totalInterest = 0;

  for (let m = 1; m <= months; m++) {
    const interest = balance * monthlyRate;
    const amortization = system === 'price' ? fixed - interest : amortSac;
    balance = Math.max(0, balance - amortization);
    totalInterest += interest;
    schedule.push({
      month: m,
      installment: round2(amortization + interest + monthlyExtras),
      interest: round2(interest),
      amortization: round2(amortization),
      extras: round2(monthlyExtras),
      balance: round2(balance),
    });
  }

  const totalExtras = monthlyExtras * months;
  return {
    system,
    principal: round2(principal),
    firstInstallment: schedule[0]?.installment ?? 0,
    lastInstallment: schedule[schedule.length - 1]?.installment ?? 0,
    totalPaid: round2(principal + totalInterest + totalExtras),
    totalInterest: round2(totalInterest),
    totalExtras: round2(totalExtras),
    schedule,
  };
}

export interface ConsorcioInput {
  credit: number; // carta de crédito
  months: number;
  adminFeePct: number; // taxa de administração total (ex.: 0.18)
  reserveFundPct: number; // fundo de reserva total (ex.: 0.02)
  insuranceMonthlyPct: number; // seguro prestamista sobre a carta, mensal (ex.: 0.0005)
  annualAdjustmentPct: number; // reajuste anual da carta (INCC/IPCA), ex.: 0.05
  bidPct: number; // lance (ex.: 0.3)
  embeddedBid: boolean; // lance embutido (sai da própria carta)
}

export interface ConsorcioResult {
  installment: number; // parcela inicial
  totalCostNoAdjust: number;
  totalWithAdjust: number;
  feesTotal: number;
  effectiveFeePct: number; // custo total sobre a carta
  bidValue: number;
  creditAvailable: number; // crédito que você leva pra casa
  ownCashForBid: number; // dinheiro do bolso para o lance
  installmentAfterBid: number;
  equivalentMonthlyRate: number; // taxa mensal equivalente (comparar com financiamento)
}

export function consorcio(i: ConsorcioInput): ConsorcioResult {
  const feesTotal = i.credit * (i.adminFeePct + i.reserveFundPct);
  const base = (i.credit + feesTotal) / Math.max(1, i.months);
  const insurance = i.credit * i.insuranceMonthlyPct;
  const installment = base + insurance;
  const totalCostNoAdjust = installment * i.months;

  let totalWithAdjust = 0;
  for (let m = 0; m < i.months; m++) {
    totalWithAdjust += installment * Math.pow(1 + i.annualAdjustmentPct, Math.floor(m / 12));
  }

  const bidValue = i.credit * i.bidPct;
  const creditAvailable = i.embeddedBid ? i.credit - bidValue : i.credit;
  const ownCashForBid = i.embeddedBid ? 0 : bidValue;
  // O lance abate do saldo devedor, diluído nas parcelas restantes (estimativa, considerando contemplação logo no início).
  const totalDue = i.credit + feesTotal;
  const installmentAfterBid = Math.max(0, (totalDue - bidValue) / Math.max(1, i.months)) + insurance;

  return {
    installment: round2(installment),
    totalCostNoAdjust: round2(totalCostNoAdjust),
    totalWithAdjust: round2(totalWithAdjust),
    feesTotal: round2(feesTotal),
    effectiveFeePct: (totalCostNoAdjust - i.credit) / i.credit,
    bidValue: round2(bidValue),
    creditAvailable: round2(creditAvailable),
    ownCashForBid: round2(ownCashForBid),
    installmentAfterBid: round2(installmentAfterBid),
    equivalentMonthlyRate: rateFromPmt(creditAvailable, installment, i.months),
  };
}

/** Taxa mensal que faz `pv` virar `n` parcelas de `payment` (bisseção). */
export function rateFromPmt(pv: number, payment: number, n: number): number {
  if (pv <= 0 || payment <= 0 || n <= 0 || payment * n <= pv) return 0;
  let lo = 0;
  let hi = 1;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    if (pmt(pv, mid, n) > payment) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

export interface GrowthPoint {
  month: number;
  balance: number;
  invested: number;
}

export interface CompoundResult {
  final: number;
  invested: number;
  interest: number;
  timeline: GrowthPoint[];
}

export function compound(initial: number, monthly: number, monthlyRate: number, months: number): CompoundResult {
  let bal = initial;
  let invested = initial;
  const timeline: GrowthPoint[] = [{ month: 0, balance: initial, invested }];
  for (let m = 1; m <= months; m++) {
    bal = bal * (1 + monthlyRate) + monthly;
    invested += monthly;
    timeline.push({ month: m, balance: round2(bal), invested: round2(invested) });
  }
  return { final: round2(bal), invested: round2(invested), interest: round2(bal - invested), timeline };
}

/** Meses até atingir `target` aportando `monthly`. Retorna null se nunca chega (limite 100 anos). */
export function monthsToTarget(initial: number, monthly: number, monthlyRate: number, target: number): number | null {
  let bal = initial;
  let m = 0;
  while (bal < target) {
    if (m >= 1200) return null;
    bal = bal * (1 + monthlyRate) + monthly;
    m++;
  }
  return m;
}

/** Aporte mensal necessário para chegar em `target` em `months`. */
export function requiredMonthly(initial: number, monthlyRate: number, months: number, target: number): number {
  if (months <= 0) return Math.max(0, target - initial);
  const factor = Math.pow(1 + monthlyRate, months);
  const fvInitial = initial * factor;
  const annuity = monthlyRate === 0 ? months : (factor - 1) / monthlyRate;
  return Math.max(0, (target - fvInitial) / annuity);
}

/** Renda passiva: quanto dura o patrimônio sacando `withdrawal` por mês. */
export function withdrawalPlan(initial: number, withdrawal: number, monthlyRate: number, maxMonths = 1200) {
  let bal = initial;
  let m = 0;
  let withdrawn = 0;
  while (bal > 0 && m < maxMonths) {
    bal = bal * (1 + monthlyRate) - withdrawal;
    withdrawn += withdrawal;
    m++;
  }
  const perpetual = initial * monthlyRate >= withdrawal;
  return {
    perpetual,
    months: perpetual ? null : m,
    sustainableWithdrawal: round2(initial * monthlyRate),
    withdrawn: round2(withdrawn),
  };
}

/** Alíquota de IR regressiva para renda fixa, pelo prazo em dias. */
export const irRate = (days: number) => (days <= 180 ? 0.225 : days <= 360 ? 0.2 : days <= 720 ? 0.175 : 0.15);

export interface FixedIncomeInput {
  amount: number;
  months: number;
  cdiAnnual: number; // ex.: 0.1465
  selicAnnual: number; // para poupança
  trMonthly: number; // TR mensal (ex.: 0.0015)
  products: Array<{ name: string; pctCdi: number; taxFree: boolean }>;
}

export function fixedIncomeComparison(i: FixedIncomeInput) {
  const days = Math.round(i.months * 30.4167);
  const years = days / 365;
  const results = i.products.map((p) => {
    const annual = i.cdiAnnual * p.pctCdi;
    const gross = i.amount * Math.pow(1 + annual, years) - i.amount;
    const ir = p.taxFree ? 0 : gross * irRate(days);
    const net = gross - ir;
    return { name: p.name, gross: round2(gross), ir: round2(ir), net: round2(net), final: round2(i.amount + net) };
  });
  // Poupança: 0,5% a.m. + TR se Selic > 8,5%; senão 70% da Selic + TR.
  const poupMonthly = i.selicAnnual > 0.085 ? 0.005 + i.trMonthly : annualToMonthly(i.selicAnnual * 0.7) + i.trMonthly;
  const poupGross = i.amount * Math.pow(1 + poupMonthly, i.months) - i.amount;
  results.push({ name: 'Poupança', gross: round2(poupGross), ir: 0, net: round2(poupGross), final: round2(i.amount + poupGross) });
  return { days, irPct: irRate(days), results: results.sort((a, b) => b.net - a.net) };
}

export interface DriverCostInput {
  ownership: 'owned' | 'financed' | 'rented';
  vehicleValue: number;
  installment: number; // parcela mensal ou aluguel mensal
  monthlyKm: number;
  insuranceMonthly: number;
  ipvaAnnual: number;
  licensingAnnual: number;
  depreciationAnnualPct: number;
  tireSetCost: number;
  tireLifeKm: number;
  oilChangeCost: number;
  oilIntervalKm: number;
  otherMaintenanceMonthly: number;
  fuelPrice: number;
  kmPerLiter: number;
  desiredProfitMonthly: number;
  rentIncludesMaintenance: boolean;
}

export function driverCost(i: DriverCostInput) {
  const km = Math.max(1, i.monthlyKm);
  const rented = i.ownership === 'rented';
  const skipMaint = rented && i.rentIncludesMaintenance;

  const items = [
    { label: rented ? 'Aluguel' : 'Parcela', value: i.ownership === 'owned' ? 0 : i.installment },
    { label: 'Seguro', value: rented ? 0 : i.insuranceMonthly },
    { label: 'IPVA + licenciamento', value: rented ? 0 : (i.ipvaAnnual + i.licensingAnnual) / 12 },
    { label: 'Depreciação', value: rented ? 0 : (i.vehicleValue * i.depreciationAnnualPct) / 12 },
    { label: 'Pneus', value: skipMaint ? 0 : (i.tireSetCost / Math.max(1, i.tireLifeKm)) * km },
    { label: 'Troca de óleo', value: skipMaint ? 0 : (i.oilChangeCost / Math.max(1, i.oilIntervalKm)) * km },
    { label: 'Outras manutenções', value: skipMaint ? 0 : i.otherMaintenanceMonthly },
    { label: 'Combustível', value: (i.fuelPrice / Math.max(0.1, i.kmPerLiter)) * km },
  ].map((x) => ({ ...x, value: round2(x.value) }));

  const monthlyCost = items.reduce((s, x) => s + x.value, 0);
  return {
    items,
    monthlyCost: round2(monthlyCost),
    costPerKm: round2(monthlyCost / km),
    minRatePerKm: round2((monthlyCost + i.desiredProfitMonthly) / km),
    revenueNeeded: round2(monthlyCost + i.desiredProfitMonthly),
  };
}
