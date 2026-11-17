/**
 * Metas: quanto falta, quanto guardar por mês, ritmo real e previsão — cálculos puros (goals.test.ts).
 */
import type { Goal, GoalContribution } from '../types';
import { addDays, daysUntil, localISODate, round2 } from './format';

export type GoalStatus = 'concluida' | 'no-prazo' | 'atrasada' | 'vencida' | 'sem-prazo' | 'sem-aportes';

export interface GoalPlan {
  pct: number;
  left: number;
  done: boolean;
  monthsLeft: number | null;
  monthlyNeeded: number | null;
  /** Média guardada por mês nos últimos 90 dias (aportes − retiradas). */
  pace: number;
  projectedDate: string | null;
  status: GoalStatus;
}

export function goalPlan(goal: Goal, contributions: GoalContribution[], today = localISODate()): GoalPlan {
  const target = goal.targetAmount;
  const current = goal.currentAmount;
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const left = round2(Math.max(0, target - current));
  const done = target > 0 && current >= target - 0.004;
  const days = goal.deadline ? daysUntil(goal.deadline, today) : null;
  const monthsLeft = days != null && days > 0 ? Math.max(1, Math.ceil(days / 30.44)) : null;
  const monthlyNeeded = !done && monthsLeft ? round2(left / monthsLeft) : null;

  const since = addDays(today, -90);
  const recent = contributions.filter((c) => c.goalId === goal.id && c.date >= since && c.date <= today);
  const first = contributions.filter((c) => c.goalId === goal.id).map((c) => c.date).sort()[0];
  // Se a meta tem menos de 90 dias de histórico, a média usa o tempo que ela realmente tem (mínimo 1 mês).
  const span = first ? Math.max(30.44, Math.min(90, daysUntil(today, first) + 1)) : 90;
  const pace = round2(recent.reduce((s, c) => s + c.amount, 0) / (span / 30.44));
  const projectedDate = done ? null : pace > 0 ? addDays(today, Math.ceil((left / pace) * 30.44)) : null;

  let status: GoalStatus = 'sem-prazo';
  if (done) status = 'concluida';
  else if (days != null && days < 0) status = 'vencida';
  else if (goal.deadline && !first) status = 'sem-aportes';
  else if (goal.deadline) status = projectedDate && projectedDate <= goal.deadline ? 'no-prazo' : 'atrasada';
  return { pct, left, done, monthsLeft, monthlyNeeded, pace, projectedDate, status };
}

/** Linha do tempo do valor guardado (para o gráfico), do aporte mais antigo até hoje. */
export function goalTimeline(goal: Goal, contributions: GoalContribution[]) {
  const mine = contributions.filter((c) => c.goalId === goal.id).sort((a, b) => a.date.localeCompare(b.date));
  const total = mine.reduce((s, c) => s + c.amount, 0);
  // Valor que já existia antes do histórico (metas antigas ou "já tenho" ao criar).
  let acc = round2(goal.currentAmount - total);
  const points = [acc];
  for (const c of mine) { acc = round2(acc + c.amount); points.push(acc); }
  return points;
}

/** Se um aporte fez a meta passar do alvo (para comemorar). */
export const justCompleted = (goal: Goal, added: number) => goal.targetAmount > 0 && goal.currentAmount < goal.targetAmount - 0.004 && goal.currentAmount + added >= goal.targetAmount - 0.004;

export const GOAL_ICONS = ['target', 'piggy', 'shield', 'car', 'home', 'plane', 'graduation', 'gift', 'heart', 'phone', 'wrench', 'baby'] as const;
export const GOAL_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#ec4899', '#84cc16'];
