import { useEffect, useMemo, useState } from 'react';
import { BellRing, CalendarClock, Car, CheckCircle2, CreditCard, Gauge, PiggyBank, Repeat, TrendingDown, TrendingUp } from 'lucide-react';
import { useData } from '../data/DataProvider';
import { useToast } from '../data/toast';
import { usePayFixed } from '../data/actions';
import { EXPENSE_CATEGORIES, colorFor } from '../lib/categories';
import { formatBRL, formatDate } from '../lib/format';
import { averageSpent, budgetStatus, monthEndProjection, spentIn, upcomingDue, type BudgetStatus, type DueItem } from '../lib/planning';
import { enableReminders, remindersEnabled, remindersSupported, sendDueReminders } from '../lib/reminders';
import { go } from '../router';
import { Button, Card, Empty, Field, Modal, MoneyInput, Money, Progress, Row, cx } from './ui';

const LEVEL_TONE = { ok: 'good', atencao: 'warn', estourou: 'bad' } as const;

// ---------------------------------------------------------------------------
export function BudgetCard({ month }: { month: string }) {
  const { data } = useData();
  const [open, setOpen] = useState(false);
  const list = useMemo(() => budgetStatus(data.budgets, data.transactions, data.fixed, month), [data.budgets, data.transactions, data.fixed, month]);
  const total = list.reduce((s, b) => s + b.limit, 0);
  const spent = list.reduce((s, b) => s + b.spent, 0);

  return (
    <Card title={<><PiggyBank size={14} className="text-emerald-400" /> Orçamento do mês</>}
      action={<button type="button" onClick={() => setOpen(true)} className="label press rounded-full bg-white/[.05] px-3.5 py-2 text-brand-300 ring-1 ring-white/10 hover:bg-white/10">{list.length ? 'Editar limites' : 'Definir limites'}</button>}>
      {list.length === 0 ? (
        <Empty icon={<PiggyBank size={26} />} title="Defina quanto quer gastar" text="Ex.: Mercado até R$ 800, Lazer até R$ 300. Avisamos ao chegar em 80% e ao passar do limite." action={<Button onClick={() => setOpen(true)}>Definir limites</Button>} />
      ) : (
        <>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div><p className="label text-slate-500">Gasto nas categorias com limite</p><p className="font-display text-2xl font-black text-white"><Money value={spent} /> <span className="text-base text-slate-500">de {formatBRL(total)}</span></p></div>
            <span className={cx('label rounded-full px-3 py-1.5', spent > total ? 'bg-rose-500/15 text-rose-300' : 'bg-emerald-500/15 text-emerald-300')}>{total > 0 ? `${Math.round((spent / total) * 100)}%` : '—'}</span>
          </div>
          <ul className="stagger space-y-3.5">{list.map((b) => <BudgetRow key={b.id} b={b} />)}</ul>
        </>
      )}
      <BudgetForm open={open} onClose={() => setOpen(false)} month={month} />
    </Card>
  );
}

function BudgetRow({ b }: { b: BudgetStatus }) {
  return (
    <li>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorFor(b.category), boxShadow: `0 0 8px ${colorFor(b.category)}` }} />
        <span className="min-w-0 flex-1 truncate text-sm font-bold text-white">{b.category}</span>
        <span className="font-mono text-xs font-extrabold text-slate-300">{formatBRL(b.spent)} <span className="text-slate-600">/ {formatBRL(b.limit)}</span></span>
      </div>
      <Progress value={b.pct} tone={LEVEL_TONE[b.level]} />
      <p className={cx('label mt-1.5', b.level === 'estourou' ? 'text-rose-400' : b.level === 'atencao' ? 'text-amber-400' : 'text-slate-500')}>
        {b.level === 'estourou' ? `Passou ${formatBRL(-b.left)} do limite` : b.level === 'atencao' ? `Atenção: ${Math.round(b.pct)}% usado · restam ${formatBRL(b.left)}` : `Restam ${formatBRL(b.left)}`}
      </p>
    </li>
  );
}

function BudgetForm({ open, onClose, month }: { open: boolean; onClose: () => void; month: string }) {
  const { data, put, remove } = useData();
  const toast = useToast();
  const [limits, setLimits] = useState<Record<string, number>>({});
  useEffect(() => { if (open) setLimits(Object.fromEntries(data.budgets.map((b) => [b.category, b.limit]))); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open]);
  const cats = EXPENSE_CATEGORIES.filter((c) => c !== 'Cartão de crédito');

  const save = async () => {
    for (const c of cats) {
      const id = `budget-${c}`;
      const v = limits[c] ?? 0;
      const existing = data.budgets.find((b) => b.category === c);
      if (v > 0) await put('budgets', { id: existing?.id ?? id, category: c, limit: v });
      else if (existing) await remove('budgets', existing.id);
    }
    toast('Limites salvos');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Limites por categoria" footer={<Button className="w-full" onClick={save}>Salvar limites</Button>}>
      <p className="mb-4 text-sm text-slate-400">Deixe em branco as categorias sem limite. A dica mostra a sua média dos últimos 3 meses.</p>
      <div className="space-y-3">
        {cats.map((c) => {
          const avg = averageSpent(c, data.transactions, data.fixed, month);
          const now = spentIn(c, data.transactions, data.fixed, month);
          return (
            <Field key={c} label={c} hint={avg > 0 || now > 0 ? `Média ${formatBRL(avg)}/mês · este mês ${formatBRL(now)}` : undefined}>
              <MoneyInput value={limits[c] ?? 0} onChange={(v) => setLimits((x) => ({ ...x, [c]: v }))} placeholder="Sem limite" />
            </Field>
          );
        })}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
const DUE_ICON = { fixa: Repeat, fatura: CreditCard, veiculo: Car };
const dueText = (d: number) => (d < 0 ? `Atrasada ${-d} ${d === -1 ? 'dia' : 'dias'}` : d === 0 ? 'Vence hoje' : d === 1 ? 'Vence amanhã' : `Vence em ${d} dias`);

export function UpcomingCard({ today }: { today: string }) {
  const { data } = useData();
  const payFixed = usePayFixed();
  const toast = useToast();
  const [notif, setNotif] = useState(remindersEnabled());
  const items = useMemo(() => upcomingDue({ fixed: data.fixed, payments: data.fixedPayments, cards: data.cards, tx: data.transactions, vehicles: data.vehicles }, today, 7),
    [data.fixed, data.fixedPayments, data.cards, data.transactions, data.vehicles, today]);
  const total = items.reduce((s, i) => s + i.amount, 0);

  // Ao abrir o app, avisa pelo sistema o que vence até amanhã (uma vez por dia).
  useEffect(() => { if (notif) void sendDueReminders(items, today); }, [items, today, notif]);

  const act = async (i: DueItem) => {
    if (i.kind === 'fixa' && i.ref.fixedId && i.ref.month) {
      const bill = data.fixed.find((f) => f.id === i.ref.fixedId);
      if (bill && await payFixed(bill, i.ref.month)) toast(`${i.title} marcada como paga`);
    } else if (i.kind === 'fatura' && i.ref.cardId) go('contas', i.ref.cardId);
    else if (i.ref.vehicleId) go('veiculos', i.ref.vehicleId);
  };

  return (
    <Card title={<><CalendarClock size={14} className="text-amber-400" /> Próximos 7 dias</>}
      action={remindersSupported() && !notif ? (
        <button type="button" onClick={async () => { const ok = await enableReminders(); setNotif(ok); toast(ok ? 'Lembretes ativados neste aparelho' : 'Permissão de notificação negada', ok ? 'ok' : 'error'); }}
          className="label press flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-2 text-amber-300 ring-1 ring-amber-500/25"><BellRing size={13} /> Lembrar</button>
      ) : notif ? <span className="label flex items-center gap-1.5 text-emerald-400"><BellRing size={13} /> Lembretes ligados</span> : undefined}>
      {items.length === 0 ? (
        <div className="flex items-center gap-3 rounded-[1.4rem] bg-emerald-500/[.06] p-4 ring-1 ring-emerald-500/15">
          <CheckCircle2 size={22} className="shrink-0 text-emerald-400" />
          <p className="text-sm font-semibold text-emerald-100">Nada vencendo nos próximos 7 dias.</p>
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-400"><strong className="font-mono text-white">{formatBRL(total)}</strong> em {items.length} {items.length === 1 ? 'conta' : 'contas'}</p>
          <ul className="stagger space-y-2.5">
            {items.map((i) => {
              const Icon = DUE_ICON[i.kind];
              return (
                <Row key={i.id} tone={i.daysLeft < 0 ? 'bad' : i.daysLeft <= 1 ? 'warn' : 'info'} icon={<Icon size={17} />}
                  title={i.title} subtitle={<span className={i.daysLeft < 0 ? 'text-rose-400' : i.daysLeft <= 1 ? 'text-amber-400' : undefined}>{dueText(i.daysLeft)} · {formatDate(i.date).slice(0, 5)}</span>}
                  amount={formatBRL(i.amount)} amountTone="bad"
                  actions={<button type="button" onClick={() => act(i)} className="press rounded-xl bg-white/[.06] px-3 py-2 text-[11px] font-extrabold uppercase tracking-wider text-white ring-1 ring-white/10 hover:bg-white/10">{i.kind === 'fixa' ? 'Paguei' : 'Abrir'}</button>} />
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
export function ProjectionCard({ today }: { today: string }) {
  const { data } = useData();
  const p = useMemo(() => monthEndProjection({ accounts: data.accounts, tx: data.transactions, fixed: data.fixed, payments: data.fixedPayments, cards: data.cards }, today),
    [data.accounts, data.transactions, data.fixed, data.fixedPayments, data.cards, today]);
  const lines = [
    { label: 'Contas fixas a pagar', v: -p.fixedToPay, icon: TrendingDown },
    { label: 'Receitas fixas a receber', v: p.fixedToReceive, icon: TrendingUp },
    { label: 'Faturas que vencem no mês', v: -p.invoicesToPay, icon: CreditCard },
  ].filter((l) => l.v !== 0);
  const down = p.projected < p.balanceToday;

  return (
    <Card title={<><Gauge size={14} className="text-sky-400" /> Previsão para {formatDate(p.endDate).slice(0, 5)}</>}>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[1.4rem] bg-white/[.03] p-4 ring-1 ring-white/5">
          <p className="label text-slate-500">Saldo hoje</p>
          <Money value={p.balanceToday} className={cx('mt-1 block font-display text-xl font-black', p.balanceToday < 0 ? 'text-rose-400' : 'text-white')} />
        </div>
        <div className={cx('rounded-[1.4rem] p-4 ring-1', p.projected < 0 ? 'bg-rose-500/10 ring-rose-500/25' : 'bg-emerald-500/10 ring-emerald-500/25')}>
          <p className={cx('label', p.projected < 0 ? 'text-rose-300' : 'text-emerald-300')}>Fim do mês</p>
          <Money value={p.projected} className={cx('mt-1 block font-display text-xl font-black', p.projected < 0 ? 'text-rose-300' : 'text-emerald-300')} />
        </div>
      </div>
      {lines.length > 0 && (
        <ul className="mt-4 space-y-2">
          {lines.map((l) => (
            <li key={l.label} className="flex items-center gap-2.5 text-sm">
              <l.icon size={15} className={l.v < 0 ? 'text-rose-400' : 'text-emerald-400'} />
              <span className="flex-1 text-slate-300">{l.label}</span>
              <span className={cx('font-mono text-xs font-extrabold', l.v < 0 ? 'text-rose-400' : 'text-emerald-400')}>{l.v < 0 ? '−' : '+'} {formatBRL(Math.abs(l.v))}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-slate-500">{p.projected < 0 ? '⚠️ Pelo previsto, o saldo fica negativo antes do fim do mês.' : down ? 'Considera o que ainda falta pagar e receber neste mês.' : 'Considera o que ainda falta pagar e receber neste mês — sobra mais do que hoje.'}</p>
    </Card>
  );
}
