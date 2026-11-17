import { describe, expect, it } from 'vitest';
import { goalPlan, goalTimeline, justCompleted } from './goals';
import type { Goal, GoalContribution } from '../types';

const g = (o: Partial<Goal> = {}): Goal => ({ id: 'g', description: 'Reserva', targetAmount: 12000, currentAmount: 3000, type: 'financial', deadline: '2027-11-17', ...o });
const c = (amount: number, date: string): GoalContribution => ({ id: Math.random().toString(36), goalId: 'g', amount, date });

describe('plano da meta', () => {
  it('quanto falta e quanto guardar por mês até o prazo', () => {
    const p = goalPlan(g(), [], '2026-11-17');
    expect(p).toMatchObject({ left: 9000, monthsLeft: 12, monthlyNeeded: 750, done: false });
    expect(p.pct).toBeCloseTo(25);
  });
  it('ritmo real pelos últimos 90 dias e previsão', () => {
    const list = [c(1000, '2026-09-01'), c(1000, '2026-10-01'), c(1000, '2026-11-01'), c(-300, '2026-11-10'), c(5000, '2026-01-01')];
    const p = goalPlan(g({ deadline: '2027-06-01' }), list, '2026-11-17');
    // Só o que caiu nos últimos 90 dias: 1000 + 1000 + 1000 − 300 = 2.700 em ~3 meses ≈ R$ 913/mês
    expect(p.pace).toBeCloseTo(2700 / (90 / 30.44), 1);
    // faltam 9.000 → ~10 meses → depois de junho/2027
    expect(p.status).toBe('atrasada');
  });
  it('no prazo quando o ritmo alcança o alvo antes da data', () => {
    const p = goalPlan(g({ deadline: '2027-11-17' }), [c(1000, '2026-11-01')], '2026-11-17');
    // história curta (17 dias): média usa 1 mês → R$ 1.000/mês → 9 meses
    expect(p.pace).toBe(1000);
    expect(p.status).toBe('no-prazo');
    expect(p.projectedDate! < '2027-11-17').toBe(true);
  });
  it('concluída, vencida e sem prazo', () => {
    expect(goalPlan(g({ currentAmount: 12000 }), []).status).toBe('concluida');
    expect(goalPlan(g({ deadline: '2026-01-01' }), [], '2026-11-17').status).toBe('vencida');
    expect(goalPlan(g({ deadline: null }), []).status).toBe('sem-prazo');
  });
});

describe('histórico e comemoração', () => {
  it('linha do tempo inclui o valor que já existia', () => {
    expect(goalTimeline(g({ currentAmount: 3500 }), [c(500, '2026-11-01')])).toEqual([3000, 3500]);
  });
  it('comemora só quando cruza o alvo', () => {
    expect(justCompleted(g({ currentAmount: 11500 }), 500)).toBe(true);
    expect(justCompleted(g({ currentAmount: 11000 }), 500)).toBe(false);
    expect(justCompleted(g({ currentAmount: 12000 }), 100)).toBe(false);
  });
});

describe('meta nova', () => {
  it('com prazo e sem aportes pede o primeiro aporte em vez de "atrasada"', () => {
    const g = { id: 'n', description: 'x', type: 'financial' as const, targetAmount: 1000, currentAmount: 100, deadline: '2027-11-17' };
    expect(goalPlan(g, [], '2026-11-17').status).toBe('sem-aportes');
  });
});
