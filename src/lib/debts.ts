/**
 * Dívidas — cálculos puros (debts.test.ts).
 * Uma dívida tem parcelas com vencimento; pagar uma parcela cria um lançamento.
 */
import type { Debt, DebtInstallment, DebtKind } from '../types';
import { addMonths, daysUntil, round2 } from './format';

export const DEBT_KINDS: Array<{ value: DebtKind; label: string; category: string }> = [
  { value: 'acordo', label: 'Acordo / renegociação', category: 'Empréstimos' },
  { value: 'faculdade', label: 'Faculdade / escola', category: 'Educação' },
  { value: 'cartao', label: 'Cartão de crédito', category: 'Cartão de crédito' },
  { value: 'emprestimo', label: 'Empréstimo', category: 'Empréstimos' },
  { value: 'financiamento', label: 'Financiamento', category: 'Empréstimos' },
  { value: 'contas', label: 'Contas atrasadas', category: 'Contas de casa' },
  { value: 'pessoal', label: 'Pessoa conhecida', category: 'Empréstimos' },
  { value: 'outro', label: 'Outra', category: 'Outros' },
];
export const kindLabel = (k: DebtKind) => DEBT_KINDS.find((x) => x.value === k)?.label ?? 'Outra';

const shiftMonth = (date: string, n: number) => {
  const [y, m, d] = date.split('-').map(Number);
  const month = addMonths(`${y}-${String(m).padStart(2, '0')}`, n);
  const [yy, mm] = month.split('-').map(Number);
  const last = new Date(yy, mm, 0).getDate();
  return `${month}-${String(Math.min(d, last)).padStart(2, '0')}`;
};

/** Gera parcelas mensais. `total` é dividido igualmente; a última leva a diferença dos centavos. */
export function buildInstallments(total: number, count: number, firstDue: string, newId: () => string): DebtInstallment[] {
  const n = Math.max(1, Math.floor(count));
  const each = Math.floor((total / n) * 100) / 100;
  return Array.from({ length: n }, (_, i) => ({
    id: newId(), dueDate: shiftMonth(firstDue, i), paidAt: null, transactionId: null,
    amount: i === n - 1 ? round2(total - each * (n - 1)) : each,
  }));
}

export interface DebtStatus {
  total: number; paid: number; remaining: number; pct: number; done: boolean;
  paidCount: number; count: number;
  next: DebtInstallment | null; nextDays: number | null;
  overdue: DebtInstallment[]; overdueAmount: number;
  lastDue: string | null;
  /** Desconto conseguido na negociação (valor original − total negociado). */
  discount: number;
}

export function debtStatus(d: Debt, today: string): DebtStatus {
  const ins = [...d.installments].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const total = round2(ins.reduce((s, i) => s + i.amount, 0));
  const paidList = ins.filter((i) => i.paidAt);
  const paid = round2(paidList.reduce((s, i) => s + i.amount, 0));
  const open = ins.filter((i) => !i.paidAt);
  const overdue = open.filter((i) => i.dueDate < today);
  const next = open[0] ?? null;
  return {
    total, paid, remaining: round2(total - paid), pct: total > 0 ? Math.min(100, (paid / total) * 100) : 0, done: open.length === 0 && ins.length > 0,
    paidCount: paidList.length, count: ins.length,
    next, nextDays: next ? daysUntil(next.dueDate, today) : null,
    overdue, overdueAmount: round2(overdue.reduce((s, i) => s + i.amount, 0)),
    lastDue: open.length ? open[open.length - 1].dueDate : null,
    discount: d.originalAmount && d.originalAmount > total ? round2(d.originalAmount - total) : 0,
  };
}

export interface DebtsSummary {
  remaining: number; paid: number; total: number; pct: number;
  open: number; settled: number; overdueAmount: number; overdueCount: number;
  dueIn30: number; freeDate: string | null; discount: number;
  milestone: 0 | 25 | 50 | 75 | 100;
}

export function debtsSummary(debts: Debt[], today: string): DebtsSummary {
  const st = debts.map((d) => debtStatus(d, today));
  const total = round2(st.reduce((s, x) => s + x.total, 0));
  const paid = round2(st.reduce((s, x) => s + x.paid, 0));
  const pct = total > 0 ? (paid / total) * 100 : 0;
  const in30 = shiftMonth(today, 1);
  const dueIn30 = round2(debts.flatMap((d) => d.installments).filter((i) => !i.paidAt && i.dueDate <= in30).reduce((s, i) => s + i.amount, 0));
  const lasts = st.map((x) => x.lastDue).filter(Boolean) as string[];
  return {
    remaining: round2(total - paid), paid, total, pct,
    open: st.filter((x) => !x.done).length, settled: st.filter((x) => x.done).length,
    overdueAmount: round2(st.reduce((s, x) => s + x.overdueAmount, 0)), overdueCount: st.reduce((s, x) => s + x.overdue.length, 0),
    dueIn30, freeDate: lasts.length ? lasts.sort().at(-1)! : null,
    discount: round2(st.reduce((s, x) => s + x.discount, 0)),
    // Usa o mesmo arredondamento da tela (49,9% aparece como 50%).
    milestone: (total > 0 && paid >= total ? 100 : Math.round(pct) >= 75 ? 75 : Math.round(pct) >= 50 ? 50 : Math.round(pct) >= 25 ? 25 : 0),
  };
}

/** Parcelas em aberto que vencem até `limit` (inclui as atrasadas). */
export function openInstallmentsUntil(debts: Debt[], limit: string) {
  return debts.flatMap((d) => d.installments.filter((i) => !i.paidAt && i.dueDate <= limit).map((i) => ({ debt: d, installment: i })))
    .sort((a, b) => a.installment.dueDate.localeCompare(b.installment.dueDate));
}

// ---------------------------------------------------------------------------
// Estratégia: em que ordem atacar as dívidas
// ---------------------------------------------------------------------------
export type Strategy = 'avalanche' | 'bola-de-neve';

/** Avalanche: maior juros primeiro (economiza mais). Bola de neve: menor saldo primeiro (vitórias rápidas). */
export function attackOrder(debts: Debt[], strategy: Strategy, today: string) {
  const open = debts.map((d) => ({ debt: d, st: debtStatus(d, today) })).filter((x) => !x.st.done);
  return open.sort((a, b) => strategy === 'avalanche'
    ? (b.debt.monthlyRate ?? 0) - (a.debt.monthlyRate ?? 0) || a.st.remaining - b.st.remaining
    : a.st.remaining - b.st.remaining || (b.debt.monthlyRate ?? 0) - (a.debt.monthlyRate ?? 0));
}

export interface PayoffPlan { months: number; interest: number; order: string[] }

/**
 * Simula quitar tudo pagando as parcelas normais + `extra` por mês, que vai para a dívida da vez
 * (e, quando ela acaba, o valor que ia para ela "rola" para a próxima — efeito bola de neve).
 * Juros: só para dívidas com taxa informada (saldo × taxa ao mês). Limite de 50 anos.
 */
export function simulatePayoff(debts: Debt[], strategy: Strategy, extra: number, today: string): PayoffPlan {
  const items = attackOrder(debts, strategy, today).map(({ debt, st }) => {
    const open = debt.installments.filter((i) => !i.paidAt);
    return { id: debt.id, balance: st.remaining, rate: (debt.monthlyRate ?? 0) / 100, min: open.length ? st.remaining / open.length : st.remaining };
  });
  const order: string[] = [];
  let months = 0; let interest = 0;
  const budget = items.reduce((s, x) => s + x.min, 0) + Math.max(0, extra);
  while (items.some((x) => x.balance > 0.005) && months < 600) {
    months++;
    for (const x of items) if (x.balance > 0) { const j = x.balance * x.rate; interest += j; x.balance += j; }
    let money = budget;
    for (const x of items) { if (x.balance <= 0) continue; const pay = Math.min(x.balance, x.min, money); x.balance -= pay; money -= pay; }
    for (const x of items) { if (x.balance <= 0 || money <= 0) continue; const pay = Math.min(x.balance, money); x.balance -= pay; money -= pay; }
    for (const x of items) if (x.balance <= 0.005 && !order.includes(x.id)) { x.balance = 0; order.push(x.id); }
  }
  return { months, interest: round2(interest), order };
}
