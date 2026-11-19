import { describe, expect, it } from 'vitest';
import { attackOrder, buildInstallments, debtStatus, debtsSummary, openInstallmentsUntil, simulatePayoff } from './debts';
import type { Debt } from '../types';

let n = 0; const id = () => `i${++n}`;
const debt = (o: Partial<Debt> & { total?: number; count?: number; first?: string }): Debt => ({
  id: o.id ?? id(), creditor: o.creditor ?? 'X', kind: o.kind ?? 'acordo', category: 'Empréstimos', monthlyRate: o.monthlyRate ?? null, originalAmount: o.originalAmount ?? null,
  installments: o.installments ?? buildInstallments(o.total ?? 1000, o.count ?? 1, o.first ?? '2026-11-26', id),
});
const TODAY = '2026-11-19';

describe('parcelas', () => {
  it('divide o total e joga os centavos na última; vencimento mensal ajusta fim de mês', () => {
    const p = buildInstallments(1000, 3, '2026-01-31', id);
    expect(p.map((x) => x.amount)).toEqual([333.33, 333.33, 333.34]);
    expect(p.map((x) => x.dueDate)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });
});

describe('situação da dívida', () => {
  it('Estácio: acordo e mensalidades vencendo dia 26/11', () => {
    const acordo = debt({ creditor: 'Estácio – acordo', total: 3611.26, originalAmount: 4200 });
    const mens = debt({ creditor: 'Estácio – mensalidades', total: 3596.01, kind: 'faculdade' });
    const s = debtStatus(acordo, TODAY);
    expect(s).toMatchObject({ total: 3611.26, remaining: 3611.26, nextDays: 7, done: false, discount: 588.74 });
    const sum = debtsSummary([acordo, mens], TODAY);
    expect(sum).toMatchObject({ remaining: 7207.27, open: 2, overdueCount: 0, dueIn30: 7207.27, freeDate: '2026-11-26', milestone: 0 });
  });
  it('pagar parcela atualiza o progresso; atrasadas são contadas', () => {
    const d = debt({ total: 900, count: 3, first: '2026-10-10' });
    d.installments[0].paidAt = '2026-10-10';
    const s = debtStatus(d, TODAY);
    expect(s).toMatchObject({ paid: 300, remaining: 600, paidCount: 1, overdueAmount: 300 });
    expect(s.next?.dueDate).toBe('2026-11-10');
    expect(debtsSummary([d], TODAY).milestone).toBe(25);
    expect(openInstallmentsUntil([d], '2026-11-30').length).toBe(1);
    d.installments.forEach((i) => { i.paidAt = '2026-11-19'; });
    expect(debtStatus(d, TODAY).done).toBe(true);
    expect(debtsSummary([d], TODAY).milestone).toBe(100);
  });
});

describe('estratégia', () => {
  const card = debt({ id: 'cartao', total: 3000, count: 10, monthlyRate: 12 });
  const loan = debt({ id: 'emprestimo', total: 800, count: 4, monthlyRate: 3 });
  const friend = debt({ id: 'amigo', total: 300, count: 3 });
  it('avalanche ataca o maior juros; bola de neve o menor saldo', () => {
    expect(attackOrder([loan, card, friend], 'avalanche', TODAY).map((x) => x.debt.id)).toEqual(['cartao', 'emprestimo', 'amigo']);
    expect(attackOrder([loan, card, friend], 'bola-de-neve', TODAY).map((x) => x.debt.id)).toEqual(['amigo', 'emprestimo', 'cartao']);
  });
  it('pagar um extra por mês termina antes e paga menos juros', () => {
    const base = simulatePayoff([card, loan, friend], 'avalanche', 0, TODAY);
    const extra = simulatePayoff([card, loan, friend], 'avalanche', 200, TODAY);
    expect(extra.months).toBeLessThan(base.months);
    expect(extra.interest).toBeLessThan(base.interest);
    const snow = simulatePayoff([card, loan, friend], 'bola-de-neve', 200, TODAY);
    expect(snow.interest).toBeGreaterThanOrEqual(extra.interest);
  });
});
