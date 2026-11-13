import { useState } from 'react';
import { Flag, Plus, Trophy } from 'lucide-react';
import { useData } from '../data/DataProvider';
import { useToast } from '../data/toast';
import { Button, Card, ConfirmDelete, Empty, Field, Input, Modal, MoneyInput, NumberInput, PageHeader, Progress, Segmented } from '../components/ui';
import { daysUntil, formatBRL, formatDate } from '../lib/format';
import type { Goal, GoalType } from '../types';

export default function Goals() {
  const { data, insert, update, remove } = useData();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ description: '', type: 'financial' as GoalType, targetAmount: 0, deadline: '' });
  const [contrib, setContrib] = useState<{ goal: Goal; value: number; withdraw?: boolean } | null>(null);

  const save = async () => {
    if (!f.description.trim() || (f.type === 'financial' && f.targetAmount <= 0)) { toast('Preencha a meta', 'error'); return; }
    const ok = await insert('goals', { ...f, targetAmount: f.type === 'financial' ? f.targetAmount : 100, currentAmount: 0, deadline: f.deadline || null });
    if (ok) { setOpen(false); setF({ description: '', type: 'financial', targetAmount: 0, deadline: '' }); toast('Meta criada'); }
  };

  const addContribution = async () => {
    if (!contrib || contrib.value === 0) return;
    const g = contrib.goal;
    const max = g.type === 'activity' ? 100 : Infinity;
    if (await update('goals', g.id, { currentAmount: Math.min(max, Math.max(0, g.currentAmount + (contrib.withdraw ? -contrib.value : contrib.value))) })) { toast('Progresso atualizado'); setContrib(null); }
  };

  return (
    <div>
      <PageHeader title="Metas" subtitle="Objetivos financeiros e pessoais" actions={<Button onClick={() => setOpen(true)}><Plus size={16} /> Nova meta</Button>} />
      {data.goals.length === 0 ? (
        <Card><Empty icon={<Flag size={32} />} title="Nenhuma meta" text="Ex.: reserva de emergência, trocar de carro, viagem, quitar o cartão." action={<Button onClick={() => setOpen(true)}>Criar meta</Button>} /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.goals.map((g) => {
            const pct = g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 0;
            const done = pct >= 100;
            const days = g.deadline ? daysUntil(g.deadline) : null;
            const monthsLeft = days && days > 0 ? Math.max(1, Math.ceil(days / 30)) : null;
            return (
              <Card key={g.id}>
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-semibold text-white">{done && <Trophy size={16} className="text-amber-400" />}{g.description}</p>
                    <p className="text-xs text-slate-500">{g.type === 'financial' ? `${formatBRL(g.currentAmount)} de ${formatBRL(g.targetAmount)}` : `${g.currentAmount.toFixed(0)}% concluído`}{g.deadline ? ` · até ${formatDate(g.deadline)}` : ''}</p>
                  </div>
                  <ConfirmDelete onConfirm={() => remove('goals', g.id)} />
                </div>
                <Progress value={pct} tone={done ? 'good' : days !== null && days < 0 ? 'bad' : 'good'} />
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>{pct.toFixed(0)}%</span>
                  {g.type === 'financial' && !done && monthsLeft && <span>guarde {formatBRL((g.targetAmount - g.currentAmount) / monthsLeft)}/mês</span>}
                </div>
                {!done && <Button variant="soft" className="mt-3 w-full" onClick={() => setContrib({ goal: g, value: 0 })}>{g.type === 'financial' ? 'Adicionar valor' : 'Atualizar progresso'}</Button>}
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Nova meta" footer={<Button className="w-full" onClick={save}>Criar</Button>}>
        <div className="space-y-4">
          <Segmented value={f.type} onChange={(t) => setF({ ...f, type: t })} options={[{ value: 'financial', label: 'Financeira (R$)' }, { value: 'activity', label: 'Atividade (%)' }]} />
          <Field label="Descrição"><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Ex.: Entrada do carro novo" autoFocus /></Field>
          {f.type === 'financial' && <Field label="Valor alvo"><MoneyInput value={f.targetAmount} onChange={(v) => setF({ ...f, targetAmount: v })} /></Field>}
          <Field label="Prazo (opcional)"><Input type="date" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal open={!!contrib} onClose={() => setContrib(null)} title={contrib?.goal.description ?? ''} footer={<Button className="w-full" onClick={addContribution}>Salvar</Button>}>
        {contrib && (contrib.goal.type === 'financial'
          ? <div className="space-y-4">
              <Segmented value={contrib.withdraw ? 'out' : 'in'} onChange={(v) => setContrib({ ...contrib, withdraw: v === 'out' })} options={[{ value: 'in', label: 'Guardar' }, { value: 'out', label: 'Retirar' }]} />
              <Field label={contrib.withdraw ? 'Quanto vai retirar' : 'Quanto vai guardar agora'}><MoneyInput value={contrib.value} onChange={(v) => setContrib({ ...contrib, value: v })} autoFocus /></Field>
            </div>
          : <Field label="Somar ao progresso (pontos percentuais)"><NumberInput value={contrib.value} onChange={(v) => setContrib({ ...contrib, value: v })} suffix="%" /></Field>)}
      </Modal>
    </div>
  );
}
