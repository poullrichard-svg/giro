import { useEffect, useState } from 'react';
import { Coins, Plus, Target, Trash2, Trophy } from 'lucide-react';
import { useData } from '../data/DataProvider';
import { useToast } from '../data/toast';
import { AddCard, Button, Field, IconChip, Input, Modal, MoneyInput, NumberInput, PageHeader, Progress, Segmented, Tilt, cx } from '../components/ui';
import { hasErrors, rules, validate, type Errors } from '../lib/validate';
import { daysUntil, formatBRL, formatDate, localISODate } from '../lib/format';
import type { Goal, GoalType } from '../types';

export default function Goals() {
  const { data, insert, update, remove } = useData();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ description: '', type: 'financial' as GoalType, targetAmount: 0, deadline: '' });
  const [contrib, setContrib] = useState<{ goal: Goal; value: number; withdraw?: boolean } | null>(null);
  const [errors, setErrors] = useState<Errors<'description' | 'targetAmount' | 'deadline' | 'value'>>({});
  // Some com o erro assim que a pessoa mexe no formulário; volta a validar ao salvar.
  useEffect(() => { setErrors({}); }, [f, contrib]);

  const save = async () => {
    const e = validate({
      description: [rules.required(f.description, 'Descrição'), rules.maxLength(f.description, 60, 'Descrição')],
      targetAmount: [f.type === 'financial' && rules.positive(f.targetAmount, 'Valor alvo')],
      deadline: [rules.optionalDate(f.deadline, 'Prazo'), f.deadline && f.deadline <= localISODate() && 'O prazo precisa ser uma data futura'],
    });
    setErrors(e);
    if (hasErrors(e)) return;
    const ok = await insert('goals', { ...f, description: f.description.trim(), targetAmount: f.type === 'financial' ? f.targetAmount : 100, currentAmount: 0, deadline: f.deadline || null });
    if (ok) { setOpen(false); setF({ description: '', type: 'financial', targetAmount: 0, deadline: '' }); toast('Meta criada'); }
  };

  const addContribution = async () => {
    if (!contrib) return;
    const g = contrib.goal;
    const e = validate({ value: [rules.positive(contrib.value, 'Valor'), contrib.withdraw && contrib.value > g.currentAmount + 0.004 && `Você só tem ${formatBRL(g.currentAmount)} nesta meta`] });
    setErrors(e);
    if (hasErrors(e)) return;
    const max = g.type === 'activity' ? 100 : Infinity;
    if (await update('goals', g.id, { currentAmount: Math.min(max, Math.max(0, g.currentAmount + (contrib.withdraw ? -contrib.value : contrib.value))) })) { toast('Progresso atualizado'); setContrib(null); }
  };

  return (
    <div>
      <PageHeader eyebrow="Objetivos" title="Metas" subtitle="Objetivos financeiros e pessoais" actions={<Button onClick={() => { setErrors({}); setOpen(true); }}><Plus size={16} /> Nova meta</Button>} />
      <div className="stagger grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.goals.map((g) => {
          const pct = g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 0;
          const done = pct >= 100;
          const days = g.deadline ? daysUntil(g.deadline) : null;
          const monthsLeft = days && days > 0 ? Math.max(1, Math.ceil(days / 30)) : null;
          const fin = g.type === 'financial';
          return (
            <Tilt key={g.id} max={5} className={cx('surface rounded-[2rem] p-6', done && 'ring-1 ring-amber-400/40')}>
              {done && <span className="watermark !opacity-10 text-amber-400"><Trophy size={130} strokeWidth={1.4} /></span>}
              <div className="pop relative flex items-start gap-3">
                <IconChip tone={done ? 'warn' : 'good'} solid={done}>{done ? <Trophy size={18} /> : <Target size={18} />}</IconChip>
                <div className="min-w-0">
                  <p className="truncate font-display text-lg font-black text-white">{g.description}</p>
                  <p className="label mt-0.5 text-slate-500">{fin ? `Meta: ${formatBRL(g.targetAmount)}` : 'Meta de atividade'}{g.deadline ? ` · até ${formatDate(g.deadline)}` : ''}</p>
                </div>
              </div>
              <div className="pop-sm relative mt-5">
                <div className="label mb-2 flex justify-between"><span className="text-slate-500">Progresso</span><span className={done ? 'text-amber-400' : 'text-emerald-400'}>{pct.toFixed(0)}%</span></div>
                <Progress value={pct} tone={done ? 'warn' : days !== null && days < 0 ? 'bad' : 'good'} />
                <div className="mt-2 flex justify-between font-mono text-[11px] font-extrabold">
                  <span className="text-emerald-400">{fin ? formatBRL(g.currentAmount) : `${g.currentAmount.toFixed(0)}%`}</span>
                  <span className="text-slate-500">{done ? 'Concluída! 🎉' : fin ? `${formatBRL(g.targetAmount - g.currentAmount)} faltando` : `${(100 - g.currentAmount).toFixed(0)}% faltando`}</span>
                </div>
                {fin && !done && monthsLeft && <p className="label mt-2 text-slate-500">Guarde {formatBRL((g.targetAmount - g.currentAmount) / monthsLeft)}/mês</p>}
              </div>
              <div className="relative mt-5 grid grid-cols-2 gap-2.5">
                <Button variant="soft" className="min-h-11 text-[11px]" onClick={() => { setErrors({}); setContrib({ goal: g, value: 0 }); }}><Coins size={15} /> {fin ? 'Aportar' : 'Atualizar'}</Button>
                <DeleteGoal onConfirm={() => remove('goals', g.id)} />
              </div>
            </Tilt>
          );
        })}
        <AddCard label="Criar nova meta" onClick={() => { setErrors({}); setOpen(true); }} className={data.goals.length === 0 ? 'md:col-span-2 xl:col-span-3' : 'min-h-[17rem]'} />
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Nova meta" footer={<Button className="w-full" onClick={save}>Criar</Button>}>
        <div className="space-y-4">
          <Segmented value={f.type} onChange={(t) => setF({ ...f, type: t })} options={[{ value: 'financial', label: 'Financeira (R$)' }, { value: 'activity', label: 'Atividade (%)' }]} />
          <Field label="Descrição" error={errors.description}><Input maxLength={60} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Ex.: Entrada do carro novo" autoFocus /></Field>
          {f.type === 'financial' && <Field label="Valor alvo" error={errors.targetAmount}><MoneyInput value={f.targetAmount} onChange={(v) => setF({ ...f, targetAmount: v })} /></Field>}
          <Field label="Prazo (opcional)" error={errors.deadline}><Input type="date" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal open={!!contrib} onClose={() => setContrib(null)} title={contrib?.goal.description ?? ''} footer={<Button className="w-full" onClick={addContribution}>Salvar</Button>}>
        {contrib && (contrib.goal.type === 'financial'
          ? <div className="space-y-4">
              <Segmented value={contrib.withdraw ? 'out' : 'in'} onChange={(v) => setContrib({ ...contrib, withdraw: v === 'out' })} options={[{ value: 'in', label: 'Guardar' }, { value: 'out', label: 'Retirar' }]} />
              <Field label={contrib.withdraw ? 'Quanto vai retirar' : 'Quanto vai guardar agora'} error={errors.value}><MoneyInput value={contrib.value} onChange={(v) => setContrib({ ...contrib, value: v })} autoFocus /></Field>
            </div>
          : <Field label="Somar ao progresso (pontos percentuais)" error={errors.value}><NumberInput value={contrib.value} onChange={(v) => setContrib({ ...contrib, value: v })} suffix="%" /></Field>)}
      </Modal>
    </div>
  );
}

function DeleteGoal({ onConfirm }: { onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 3000); return () => clearTimeout(t); }, [armed]);
  return <Button variant="danger" className={cx('min-h-11 text-[11px]', armed && '!bg-rose-500 !text-white')} onClick={() => (armed ? onConfirm() : setArmed(true))}><Trash2 size={15} /> {armed ? 'Confirmar' : 'Excluir'}</Button>;
}
