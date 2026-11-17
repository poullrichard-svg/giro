import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, Baby, Car, Coins, Gift, GraduationCap, Heart, History, Home, Pencil, PiggyBank, Plane, Plus, Shield, Smartphone, Target, Trash2, Trophy, Wrench,
} from 'lucide-react';
import { useData } from '../data/DataProvider';
import { useToast } from '../data/toast';
import { AddCard, Button, Card, ConfirmDelete, Empty, Field, Input, Modal, MoneyInput, NumberInput, PageHeader, Row, Segmented, Tilt, cx } from '../components/ui';
import { Line } from '../components/charts';
import { Celebration } from '../components/Celebration';
import { formatBRL, formatDate, localISODate } from '../lib/format';
import { GOAL_COLORS, GOAL_ICONS, goalPlan, goalTimeline, justCompleted, type GoalStatus } from '../lib/goals';
import { hasErrors, rules, validate, type Errors } from '../lib/validate';
import { go } from '../router';
import type { Goal, GoalType } from '../types';

const ICONS: Record<string, typeof Target> = { target: Target, piggy: PiggyBank, shield: Shield, car: Car, home: Home, plane: Plane, graduation: GraduationCap, gift: Gift, heart: Heart, phone: Smartphone, wrench: Wrench, baby: Baby };
const iconOf = (g: Goal) => ICONS[g.icon ?? ''] ?? Target;
const colorOf = (g: Goal) => g.color ?? '#22c55e';
const STATUS: Record<GoalStatus, { label: string; cls: string }> = {
  concluida: { label: 'Concluída 🎉', cls: 'bg-amber-500/15 text-amber-300' },
  'no-prazo': { label: 'No ritmo para o prazo', cls: 'bg-emerald-500/15 text-emerald-300' },
  atrasada: { label: 'Abaixo do ritmo', cls: 'bg-rose-500/15 text-rose-300' },
  vencida: { label: 'Prazo vencido', cls: 'bg-rose-500/15 text-rose-300' },
  'sem-prazo': { label: 'Sem prazo', cls: 'bg-white/10 text-slate-300' },
  'sem-aportes': { label: 'Faça o primeiro aporte', cls: 'bg-sky-500/15 text-sky-300' },
};
const fmt = (g: Goal, v: number) => (g.type === 'financial' ? formatBRL(v) : `${Math.round(v)}%`);

export default function Goals({ id }: { id?: string }) {
  const { data } = useData();
  const [form, setForm] = useState<{ open: boolean; editing?: Goal }>({ open: false });
  const [contrib, setContrib] = useState<Goal | null>(null);
  const [celebrate, setCelebrate] = useState<string | null>(null);
  const goal = id ? data.goals.find((g) => g.id === id) : undefined;

  return (
    <>
      {goal ? <GoalDetail goal={goal} onEdit={() => setForm({ open: true, editing: goal })} onContribute={() => setContrib(goal)} /> : <GoalList onNew={() => setForm({ open: true })} onContribute={setContrib} />}
      <GoalForm open={form.open} editing={form.editing} onClose={() => setForm({ open: false })} />
      <ContributionForm goal={contrib} onClose={() => setContrib(null)} onCompleted={setCelebrate} />
      {celebrate && <Celebration title={celebrate} onClose={() => setCelebrate(null)} />}
    </>
  );
}

function GoalList({ onNew, onContribute }: { onNew: () => void; onContribute: (g: Goal) => void }) {
  const { data } = useData();
  const totals = useMemo(() => {
    const fin = data.goals.filter((g) => g.type === 'financial');
    return { saved: fin.reduce((s, g) => s + g.currentAmount, 0), target: fin.reduce((s, g) => s + g.targetAmount, 0), done: data.goals.filter((g) => goalPlan(g, []).done).length };
  }, [data.goals]);
  return (
    <div>
      <PageHeader eyebrow="Objetivos" title="Metas" subtitle={data.goals.length ? `${formatBRL(totals.saved)} guardados de ${formatBRL(totals.target)} · ${totals.done} ${totals.done === 1 ? 'concluída' : 'concluídas'}` : 'Objetivos financeiros e pessoais'}
        actions={<Button onClick={onNew}><Plus size={16} /> Nova meta</Button>} />
      <div className="stagger grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.goals.map((g) => {
          const plan = goalPlan(g, data.goalContributions);
          const Icon = iconOf(g); const color = colorOf(g);
          return (
            <Tilt key={g.id} max={5} className={cx('tinted rounded-[2rem] p-6', plan.done && 'ring-1 ring-amber-400/40')} style={{ '--tone': color } as React.CSSProperties}>
              <span className="watermark" style={{ color }}><Icon size={130} strokeWidth={1.4} /></span>
              <button type="button" onClick={() => go('metas', g.id)} className="pop relative flex w-full items-start gap-3 text-left">
                <span className="solid flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ '--tone': plan.done ? '#f59e0b' : color } as React.CSSProperties}>{plan.done ? <Trophy size={20} /> : <Icon size={20} />}</span>
                <span className="min-w-0">
                  <span className="block truncate font-display text-lg font-black text-white">{g.description}</span>
                  <span className={cx('label mt-1 inline-block rounded-full px-2 py-0.5', STATUS[plan.status].cls)}>{STATUS[plan.status].label}</span>
                </span>
              </button>
              <div className="pop-sm relative mt-5">
                <div className="label mb-2 flex justify-between"><span className="text-slate-400">{fmt(g, g.currentAmount)} de {fmt(g, g.targetAmount)}</span><span style={{ color }}>{Math.round(plan.pct)}%</span></div>
                <div className="h-3 overflow-hidden rounded-full bg-white/[.06]"><div className="fill-x h-full rounded-full" style={{ width: `${plan.pct}%`, background: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 60%, white))`, boxShadow: `0 0 14px ${color}` }} /></div>
                <p className="label mt-2 text-slate-500">
                  {plan.done ? 'Parabéns!' : plan.monthlyNeeded ? `Guarde ${fmt(g, plan.monthlyNeeded)}/mês até ${formatDate(g.deadline)}` : plan.pace > 0 ? `No ritmo atual: ${plan.projectedDate ? formatDate(plan.projectedDate) : '—'}` : g.deadline ? `Até ${formatDate(g.deadline)}` : 'Toque para ver o histórico'}
                </p>
              </div>
              {!plan.done && <Button variant="soft" className="relative mt-4 min-h-11 w-full text-[11px]" onClick={() => onContribute(g)}><Coins size={15} /> {g.type === 'financial' ? 'Aportar' : 'Atualizar'}</Button>}
            </Tilt>
          );
        })}
        <AddCard label="Criar nova meta" onClick={onNew} className={data.goals.length === 0 ? 'md:col-span-2 xl:col-span-3' : 'min-h-[16rem]'} />
      </div>
    </div>
  );
}

function GoalDetail({ goal, onEdit, onContribute }: { goal: Goal; onEdit: () => void; onContribute: () => void }) {
  const { data, update, remove } = useData();
  const toast = useToast();
  const plan = goalPlan(goal, data.goalContributions);
  const history = data.goalContributions.filter((c) => c.goalId === goal.id);
  const timeline = goalTimeline(goal, data.goalContributions);
  const before = timeline[0];
  const Icon = iconOf(goal); const color = colorOf(goal);

  const undo = async (cId: string, amount: number) => {
    const max = goal.type === 'activity' ? 100 : Infinity;
    if (await remove('goalContributions', cId)) await update('goals', goal.id, { currentAmount: Math.min(max, Math.max(0, goal.currentAmount - amount)) });
  };

  return (
    <div>
      <button onClick={() => go('metas')} className="label press mb-4 flex items-center gap-2 rounded-full bg-white/[.04] px-3.5 py-2 text-slate-400 ring-1 ring-white/10 hover:text-white"><ArrowLeft size={14} /> Metas</button>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <span className="solid flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.4rem]" style={{ '--tone': color } as React.CSSProperties}><Icon size={28} /></span>
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl font-black text-white md:text-3xl">{goal.description}</h1>
            <span className={cx('label mt-1 inline-block rounded-full px-2.5 py-1', STATUS[plan.status].cls)}>{STATUS[plan.status].label}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 max-md:[&>*]:flex-1">
          {!plan.done && <Button onClick={onContribute}><Coins size={16} /> {goal.type === 'financial' ? 'Aportar' : 'Atualizar'}</Button>}
          <Button variant="soft" onClick={onEdit}><Pencil size={15} /> Editar</Button>
        </div>
      </div>

      <div className="stagger mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Box label="Guardado" value={fmt(goal, goal.currentAmount)} sub={`${Math.round(plan.pct)}% de ${fmt(goal, goal.targetAmount)}`} color={color} />
        <Box label="Falta" value={fmt(goal, plan.left)} />
        <Box label="Por mês até o prazo" value={plan.monthlyNeeded != null ? fmt(goal, plan.monthlyNeeded) : '—'} sub={goal.deadline ? `prazo ${formatDate(goal.deadline)}` : 'defina um prazo'} />
        <Box label="Seu ritmo (90 dias)" value={plan.pace > 0 ? `${fmt(goal, plan.pace)}/mês` : '—'} sub={plan.projectedDate ? `conclui por volta de ${formatDate(plan.projectedDate)}` : plan.done ? 'concluída' : 'sem aportes recentes'} />
      </div>
      <div className="mb-5 h-3 overflow-hidden rounded-full bg-white/[.06]"><div className="fill-x h-full rounded-full" style={{ width: `${plan.pct}%`, background: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 60%, white))`, boxShadow: `0 0 14px ${color}` }} /></div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card title="Evolução">
          {timeline.length > 1 ? <Line points={timeline} color={color} /> : <p className="py-8 text-center text-sm text-slate-500">O gráfico aparece depois do primeiro aporte.</p>}
        </Card>
        <Card title={<><History size={14} /> Histórico de aportes</>}>
          {history.length === 0 && before <= 0 ? <Empty icon={<Coins size={24} />} title="Nenhum aporte ainda" /> : (
            <ul className="stagger space-y-2.5">
              {history.map((h) => (
                <Row key={h.id} tone={h.amount >= 0 ? 'good' : 'bad'} icon={<Coins size={16} />}
                  title={h.note || (h.amount >= 0 ? 'Aporte' : 'Retirada')} subtitle={formatDate(h.date)}
                  amount={`${h.amount >= 0 ? '+' : '−'} ${fmt(goal, Math.abs(h.amount))}`} amountTone={h.amount >= 0 ? 'good' : 'bad'}
                  actions={<ConfirmDelete label="Desfazer aporte" onConfirm={() => undo(h.id, h.amount)} />} />
              ))}
              {before > 0 && <Row tone="info" icon={<PiggyBank size={16} />} title="Saldo inicial" subtitle="já existia" amount={fmt(goal, before)} />}
            </ul>
          )}
        </Card>
      </div>
      <div className="mt-6 flex justify-end">
        <DeleteGoal onConfirm={async () => { if (await remove('goals', goal.id)) { toast('Meta excluída'); go('metas'); } }} />
      </div>
    </div>
  );
}

function Box({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="surface rounded-[1.5rem] p-4">
      <p className="label text-slate-500">{label}</p>
      <p className="mt-1 truncate font-display text-lg font-black md:text-xl" style={{ color: color ?? '#fff' }}>{value}</p>
      {sub && <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">{sub}</p>}
    </div>
  );
}

function GoalForm({ open, editing, onClose }: { open: boolean; editing?: Goal; onClose: () => void }) {
  const { insert, update } = useData();
  const toast = useToast();
  const blank = { description: '', type: 'financial' as GoalType, targetAmount: 0, currentAmount: 0, deadline: '', icon: 'target', color: GOAL_COLORS[0] };
  const [f, setF] = useState(blank);
  const [errors, setErrors] = useState<Errors<'description' | 'targetAmount' | 'deadline' | 'currentAmount'>>({});
  useEffect(() => { if (open) { setErrors({}); setF(editing ? { description: editing.description, type: editing.type, targetAmount: editing.targetAmount, currentAmount: editing.currentAmount, deadline: editing.deadline ?? '', icon: editing.icon ?? 'target', color: editing.color ?? GOAL_COLORS[0] } : blank); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open, editing]);
  useEffect(() => { setErrors({}); }, [f]);

  const save = async () => {
    const e = validate({
      description: [rules.required(f.description, 'Descrição'), rules.maxLength(f.description, 60, 'Descrição')],
      targetAmount: [f.type === 'financial' && rules.positive(f.targetAmount, 'Valor alvo')],
      currentAmount: [rules.nonNegative(f.currentAmount, 'Valor guardado')],
      deadline: [rules.optionalDate(f.deadline, 'Prazo'), !editing && f.deadline && f.deadline <= localISODate() && 'O prazo precisa ser uma data futura'],
    });
    setErrors(e);
    if (hasErrors(e)) return;
    const payload = { description: f.description.trim(), type: f.type, targetAmount: f.type === 'financial' ? f.targetAmount : 100, deadline: f.deadline || null, icon: f.icon, color: f.color };
    const ok = editing ? await update('goals', editing.id, payload) : !!(await insert('goals', { ...payload, currentAmount: f.currentAmount }));
    if (ok) { toast(editing ? 'Meta atualizada' : 'Meta criada'); onClose(); }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Editar meta' : 'Nova meta'} footer={<Button className="w-full" onClick={save}>{editing ? 'Salvar' : 'Criar'}</Button>}>
      <div className="space-y-4">
        {!editing && <Segmented value={f.type} onChange={(t) => setF({ ...f, type: t })} options={[{ value: 'financial', label: 'Financeira (R$)' }, { value: 'activity', label: 'Atividade (%)' }]} />}
        <Field label="Descrição" error={errors.description}><Input value={f.description} maxLength={60} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Ex.: Entrada do carro novo" autoFocus /></Field>
        {f.type === 'financial' && (
          <div className="grid grid-cols-2 items-start gap-3">
            <Field label="Valor alvo" error={errors.targetAmount}><MoneyInput value={f.targetAmount} onChange={(v) => setF({ ...f, targetAmount: v })} /></Field>
            {!editing && <Field label="Já tenho" error={errors.currentAmount}><MoneyInput value={f.currentAmount} onChange={(v) => setF({ ...f, currentAmount: v })} placeholder="R$ 0,00" /></Field>}
          </div>
        )}
        <Field label="Prazo (opcional)" error={errors.deadline} hint="Com prazo, o app calcula quanto guardar por mês"><Input type="date" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} /></Field>
        <Field label="Ícone" group>
          <div className="grid grid-cols-6 gap-2">
            {GOAL_ICONS.map((k) => { const I = ICONS[k]; const on = f.icon === k; return (
              <button key={k} type="button" aria-label={`Ícone ${k}`} aria-pressed={on} onClick={() => setF({ ...f, icon: k })}
                className={cx('press flex aspect-square items-center justify-center rounded-2xl ring-1 transition', on ? 'text-white ring-2' : 'bg-white/[.04] text-slate-400 ring-white/10')}
                style={on ? { background: `color-mix(in srgb, ${f.color} 30%, transparent)`, boxShadow: `0 0 0 2px ${f.color}` } : undefined}><I size={20} /></button>
            ); })}
          </div>
        </Field>
        <Field label="Cor" group>
          <div className="grid grid-cols-8 gap-2">
            {GOAL_COLORS.map((c) => (
              <button key={c} type="button" aria-label={`Cor ${c}`} aria-pressed={f.color === c} onClick={() => setF({ ...f, color: c })}
                className={cx('press aspect-square w-full max-w-9 justify-self-center rounded-full ring-offset-2 ring-offset-[#110e1d] transition', f.color === c ? 'scale-110 ring-2 ring-white' : '')} style={{ background: c, boxShadow: `0 4px 14px -4px ${c}` }} />
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  );
}

function ContributionForm({ goal, onClose, onCompleted }: { goal: Goal | null; onClose: () => void; onCompleted: (title: string) => void }) {
  const { insert, update } = useData();
  const toast = useToast();
  const [f, setF] = useState({ value: 0, withdraw: false, date: localISODate(), note: '' });
  const [errors, setErrors] = useState<Errors<'value' | 'date'>>({});
  useEffect(() => { if (goal) { setErrors({}); setF({ value: 0, withdraw: false, date: localISODate(), note: '' }); } }, [goal]);
  useEffect(() => { setErrors({}); }, [f]);
  if (!goal) return null;
  const fin = goal.type === 'financial';

  const save = async () => {
    const e = validate({
      value: [rules.positive(f.value, 'Valor'), f.withdraw && f.value > goal.currentAmount + 0.004 && `Você só tem ${fmt(goal, goal.currentAmount)} nesta meta`],
      date: [rules.date(f.date), f.date > localISODate() && 'A data não pode ser no futuro'],
    });
    setErrors(e);
    if (hasErrors(e)) return;
    const amount = f.withdraw ? -f.value : f.value;
    const max = fin ? Infinity : 100;
    const next = Math.min(max, Math.max(0, goal.currentAmount + amount));
    const ok = await insert('goalContributions', { goalId: goal.id, amount: next - goal.currentAmount, date: f.date, note: f.note.trim() || null });
    if (!ok || !(await update('goals', goal.id, { currentAmount: next }))) return;
    onClose();
    if (!f.withdraw && justCompleted(goal, amount)) onCompleted(goal.description);
    else toast(f.withdraw ? 'Retirada registrada' : 'Aporte registrado');
  };

  return (
    <Modal open onClose={onClose} title={goal.description} footer={<Button className="w-full" onClick={save}>Salvar</Button>}>
      <div className="space-y-4">
        <Segmented value={f.withdraw ? 'out' : 'in'} onChange={(v) => setF({ ...f, withdraw: v === 'out' })} options={[{ value: 'in', label: fin ? 'Guardar' : 'Avançar' }, { value: 'out', label: fin ? 'Retirar' : 'Voltar' }]} />
        <Field label={fin ? (f.withdraw ? 'Quanto vai retirar' : 'Quanto vai guardar') : 'Pontos percentuais'} error={errors.value}
          hint={fin ? `Guardado: ${formatBRL(goal.currentAmount)} de ${formatBRL(goal.targetAmount)}` : `Progresso atual: ${Math.round(goal.currentAmount)}%`}>
          {fin ? <MoneyInput value={f.value} onChange={(v) => setF({ ...f, value: v })} className="text-lg font-semibold" autoFocus /> : <NumberInput value={f.value} onChange={(v) => setF({ ...f, value: v })} suffix="%" />}
        </Field>
        <div className="grid grid-cols-2 items-start gap-3">
          <Field label="Data" error={errors.date}><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Observação"><Input value={f.note} maxLength={40} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Ex.: 13º salário" /></Field>
        </div>
      </div>
    </Modal>
  );
}

function DeleteGoal({ onConfirm }: { onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 3000); return () => clearTimeout(t); }, [armed]);
  return <Button variant="danger" className={cx(armed && '!bg-rose-500 !text-white')} onClick={() => (armed ? onConfirm() : setArmed(true))}><Trash2 size={15} /> {armed ? 'Toque de novo para excluir' : 'Excluir meta'}</Button>;
}
