import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BadgeCheck, Building2, CalendarClock, Check, CreditCard, GraduationCap, Handshake, Landmark, Receipt, Users, ExternalLink, Flame, HandCoins, Lightbulb, Pencil, Plus, Rocket, Snowflake, Trash2, TriangleAlert, Trophy, Undo2 } from 'lucide-react';
import { useData } from '../data/DataProvider';
import { useToast } from '../data/toast';
import { usePayDebt } from '../data/actions';
import { newId } from '../data/db';
import { AddCard, Button, Card, Empty, Field, Input, Modal, Money, MoneyInput, NumberInput, PageHeader, Row, Segmented, Select, Tilt, cx } from '../components/ui';
import { Celebration } from '../components/Celebration';
import { EXPENSE_CATEGORIES } from '../lib/categories';
import { addDays, formatBRL, formatDate, localISODate, monthLabel } from '../lib/format';
import { attackOrder, buildInstallments, DEBT_KINDS, debtStatus, debtsSummary, kindLabel, openInstallmentsUntil, simulatePayoff, type Strategy } from '../lib/debts';
import { hasErrors, rules, validate, type Errors } from '../lib/validate';
import { go } from '../router';
import type { Debt, DebtInstallment, DebtKind } from '../types';

const dueText = (days: number) => (days < 0 ? `atrasada ${-days} ${days === -1 ? 'dia' : 'dias'}` : days === 0 ? 'vence hoje' : days === 1 ? 'vence amanhã' : `vence em ${days} dias`);
const MILESTONE: Record<number, string> = {
  0: 'Todo começo conta. Cada parcela paga é uma vitória.',
  25: 'Você já quitou 25%! O mais difícil é começar — e você começou.',
  50: 'Metade do caminho! Continue nesse ritmo.',
  75: 'Falta pouco! Mais de 75% já foi.',
  100: 'Livre de dívidas! 🎉 Agora é hora de montar sua reserva.',
};
const TOOLS = [
  { name: 'Serasa Limpa Nome', text: 'Veja dívidas no seu CPF e ofertas com desconto para quitar.', url: 'https://www.serasa.com.br/limpa-nome-online/' },
  { name: 'Registrato (Banco Central)', text: 'Grátis: mostra todos os empréstimos, cartões e financiamentos no seu nome.', url: 'https://www.bcb.gov.br/cidadaniafinanceira/registrato' },
  { name: 'consumidor.gov.br', text: 'Reclame e negocie direto com empresas e bancos. Grátis.', url: 'https://www.consumidor.gov.br/' },
];

/** Ícone e cor de cada tipo de dívida. */
const KIND_LOOK: Record<DebtKind, { icon: typeof HandCoins; color: string }> = {
  acordo: { icon: Handshake, color: '#f97316' }, faculdade: { icon: GraduationCap, color: '#8b5cf6' }, cartao: { icon: CreditCard, color: '#e11d48' },
  emprestimo: { icon: Landmark, color: '#0ea5e9' }, financiamento: { icon: Building2, color: '#14b8a6' }, contas: { icon: Receipt, color: '#f59e0b' },
  pessoal: { icon: Users, color: '#ec4899' }, outro: { icon: HandCoins, color: '#64748b' },
};
const lookOf = (k: DebtKind) => KIND_LOOK[k] ?? KIND_LOOK.outro;

/** Etiqueta de situação: quitada, atrasada, vence logo ou em dia. */
function StatusChip({ st }: { st: ReturnType<typeof debtStatus> }) {
  const [cls, text] = st.done ? ['bg-emerald-400/15 text-emerald-300 ring-emerald-400/30', 'Quitada']
    : st.overdue.length ? ['bg-rose-500/20 text-rose-200 ring-rose-400/40', `Atrasada ${-(st.nextDays ?? 0)} ${st.nextDays === -1 ? 'dia' : 'dias'}`]
    : st.nextDays != null && st.nextDays <= 7 ? ['bg-amber-400/15 text-amber-200 ring-amber-400/30', st.nextDays === 0 ? 'Vence hoje' : st.nextDays === 1 ? 'Vence amanhã' : `Vence em ${st.nextDays} dias`]
    : ['bg-sky-400/15 text-sky-200 ring-sky-400/30', 'Em dia'];
  return <span className={cx('label inline-flex items-center gap-1 rounded-full px-2.5 py-1 ring-1', cls)}>{st.done ? <BadgeCheck size={12} /> : st.overdue.length ? <TriangleAlert size={12} /> : <CalendarClock size={12} />}{text}</span>;
}

/** Cartão de uma dívida na lista. */
function DebtCard({ d, st }: { d: Debt; st: ReturnType<typeof debtStatus> }) {
  const { icon: Icon, color } = lookOf(d.kind);
  return (
    <Tilt max={5} className={cx('tinted relative overflow-hidden rounded-[1.8rem] p-5', st.done && 'opacity-80')} style={{ '--tone': st.done ? '#10b981' : color } as React.CSSProperties}>
      <span className="watermark" style={{ color }}><Icon size={120} strokeWidth={1.3} /></span>
      <button type="button" onClick={() => go('dividas', d.id)} className="pop relative block w-full text-left" aria-label={`${d.creditor} — ${st.done ? 'quitada' : `${st.paidCount}/${st.count} pagas`}`}>
        <div className="flex items-start gap-3">
          <span className="solid flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ '--tone': st.done ? '#10b981' : color } as React.CSSProperties}>{st.done ? <Trophy size={19} /> : <Icon size={19} />}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[17px] font-black leading-tight text-white">{d.creditor}</p>
            <p className="label mt-0.5 truncate text-white/50">{kindLabel(d.kind)}</p>
          </div>
        </div>
        <div className="mt-4 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="label text-white/50">{st.done ? 'Tudo pago' : 'Falta'}</p>
            <p className="truncate font-display text-[26px] font-black leading-none text-white">{formatBRL(st.done ? st.total : st.remaining)}</p>
          </div>
          <StatusChip st={st} />
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-black/30"><div className="fill-x h-full rounded-full" style={{ width: `${Math.max(st.pct, st.done ? 100 : 3)}%`, background: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 45%, white))`, boxShadow: `0 0 12px ${color}` }} /></div>
        <div className="mt-3 flex items-center justify-between gap-2 text-xs">
          <span className="text-white/60">{st.paidCount} de {st.count} {st.count === 1 ? 'parcela' : 'parcelas'}</span>
          {st.next && !st.done && <span className="truncate font-semibold text-white/80">Próxima: <b className="font-mono text-white">{formatBRL(st.next.amount)}</b> · {formatDate(st.next.dueDate).slice(0, 5)}</span>}
          {st.discount > 0 && st.done && <span className="font-semibold text-emerald-200">economizou {formatBRL(st.discount)}</span>}
        </div>
      </button>
    </Tilt>
  );
}

export default function Debts({ id }: { id?: string }) {
  const { data } = useData();
  const [form, setForm] = useState<{ open: boolean; editing?: Debt }>({ open: false });
  const [party, setParty] = useState<string | null>(null);
  const debt = id ? data.debts.find((d) => d.id === id) : undefined;
  return (
    <>
      {debt ? <DebtDetail debt={debt} onEdit={() => setForm({ open: true, editing: debt })} onSettled={setParty} />
        : <DebtList onNew={() => setForm({ open: true })} onSettled={setParty} />}
      <DebtForm open={form.open} editing={form.editing} onClose={() => setForm({ open: false })} />
      {party && <Celebration label="Dívida quitada" title={party} text="Menos uma! Cada dívida quitada é dinheiro de volta no seu bolso." onClose={() => setParty(null)} />}
    </>
  );
}

/** Botão "Paguei" de uma parcela (com a comemoração quando quita a dívida). */
function usePayInstallment(onSettled: (name: string) => void) {
  const { pay } = usePayDebt();
  const toast = useToast();
  return async (d: Debt, i: DebtInstallment) => {
    if (!(await pay(d, i))) return;
    const left = d.installments.filter((x) => !x.paidAt && x.id !== i.id).length;
    if (left === 0) onSettled(d.creditor);
    else toast(`Parcela paga — faltam ${left}. 💪`);
  };
}

function DebtList({ onNew, onSettled }: { onNew: () => void; onSettled: (n: string) => void }) {
  const { data } = useData();
  const today = localISODate();
  const sum = useMemo(() => debtsSummary(data.debts, today), [data.debts, today]);
  const upcoming = useMemo(() => openInstallmentsUntil(data.debts, addDays(today, 30)), [data.debts, today]);
  const payInst = usePayInstallment(onSettled);
  const list = useMemo(() => data.debts.map((d) => ({ d, st: debtStatus(d, today) })).sort((a, b) => Number(a.st.done) - Number(b.st.done) || (a.st.next?.dueDate ?? '9').localeCompare(b.st.next?.dueDate ?? '9')), [data.debts, today]);
  const free = sum.remaining <= 0 && data.debts.length > 0;

  if (!data.debts.length) {
    return (
      <div>
        <PageHeader eyebrow="Sair do vermelho" title="Dívidas" subtitle="Cadastre o que você deve e acompanhe até quitar tudo" actions={<Button onClick={onNew}><Plus size={16} /> Nova dívida</Button>} />
        <Empty icon={<HandCoins size={28} />} title="Nenhuma dívida cadastrada" text="Coloque aqui acordos, faculdade, empréstimos, cartão atrasado… O Giro avisa os vencimentos, mostra quanto falta e qual atacar primeiro." action={<Button onClick={onNew}><Plus size={16} /> Cadastrar dívida</Button>} />
        <div className="mt-4"><ToolsCard /></div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader eyebrow="Sair do vermelho" title="Dívidas" subtitle={free ? 'Tudo quitado!' : `${sum.open} em aberto · ${sum.settled} quitada${sum.settled === 1 ? '' : 's'}`} actions={<Button onClick={onNew}><Plus size={16} /> Nova dívida</Button>} />

      <section className="tinted relative mb-5 overflow-hidden rounded-[2rem] p-6 md:p-8" style={{ '--tone': free ? '#16a34a' : sum.overdueAmount > 0 ? '#e11d48' : '#f97316' } as React.CSSProperties}>
        <span className="watermark text-white"><HandCoins size={170} strokeWidth={1.2} /></span>
        <div className="relative">
          <p className="label text-white/70">{free ? 'Você está livre' : 'Falta quitar'}</p>
          <Money value={sum.remaining} className="mt-1 block font-display text-4xl font-black text-white md:text-5xl" />
          <div className="mt-5">
            <div className="label mb-2 flex justify-between text-white/80"><span>Já quitou {formatBRL(sum.paid)}</span><span>{Math.round(sum.pct)}%</span></div>
            <div className="h-3.5 overflow-hidden rounded-full bg-black/25"><div className="fill-x h-full rounded-full bg-gradient-to-r from-emerald-300 to-white shadow-[0_0_16px_rgba(255,255,255,.6)]" style={{ width: `${sum.pct}%` }} /></div>
          </div>
          <p className="mt-4 flex items-start gap-2 text-sm font-semibold text-white/90"><Flame size={17} className="mt-0.5 shrink-0" /> {MILESTONE[sum.milestone]}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {sum.freeDate && <span className="label rounded-full bg-black/25 px-3 py-1.5 text-white">Livre em {monthLabel(sum.freeDate.slice(0, 7))}</span>}
            {sum.overdueAmount > 0 && <span className="label flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-rose-600"><TriangleAlert size={12} /> {formatBRL(sum.overdueAmount)} atrasado</span>}
            {sum.discount > 0 && <span className="label rounded-full bg-black/25 px-3 py-1.5 text-emerald-200">Desconto conseguido {formatBRL(sum.discount)}</span>}
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <Card title={<><HandCoins size={14} className="text-amber-400" /> Próximos 30 dias</>}>
            {upcoming.length === 0 ? <p className="py-4 text-center text-sm text-slate-400">Nenhuma parcela nos próximos 30 dias. 👏</p> : (
              <ul className="stagger space-y-2.5">
                {upcoming.map(({ debt: d, installment: i }) => {
                  const days = Math.round((new Date(`${i.dueDate}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 864e5);
                  const k = [...d.installments].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).findIndex((x) => x.id === i.id) + 1;
                  return (
                    <Row key={i.id} tone={days < 0 ? 'bad' : lookOf(d.kind).color} icon={(() => { const I = lookOf(d.kind).icon; return <I size={16} />; })()}
                      title={d.installments.length > 1 ? `${d.creditor} (${k}/${d.installments.length})` : d.creditor}
                      subtitle={<span className={days < 0 ? 'text-rose-400' : days <= 3 ? 'text-amber-400' : undefined}>{dueText(days)} · {formatDate(i.dueDate).slice(0, 5)}<span className="sm:hidden"> · {formatBRL(i.amount)}</span></span>}
                      amount={formatBRL(i.amount)} amountTone="bad" amountClassName="hidden sm:inline"
                      actions={<Button className="min-h-10 px-3.5 text-[11px]" onClick={() => payInst(d, i)} aria-label={`Paguei — ${d.creditor}`}><Check size={15} strokeWidth={3} /> Paguei</Button>} />
                  );
                })}
              </ul>
            )}
          </Card>
          <div className="stagger grid grid-cols-1 gap-3 sm:grid-cols-2">
            {list.map(({ d, st }) => <DebtCard key={d.id} d={d} st={st} />)}
            <AddCard label="Nova dívida" onClick={onNew} className="min-h-[10rem]" />
          </div>
        </div>
        <div className="min-w-0 space-y-4">
          <StrategyCard />
          <ToolsCard />
        </div>
      </div>
    </div>
  );
}

function StrategyCard() {
  const { data } = useData();
  const today = localISODate();
  const [strategy, setStrategy] = useState<Strategy>('avalanche');
  const [extra, setExtra] = useState(100);
  const order = useMemo(() => attackOrder(data.debts, strategy, today), [data.debts, strategy, today]);
  const base = useMemo(() => simulatePayoff(data.debts, strategy, 0, today), [data.debts, strategy, today]);
  const fast = useMemo(() => simulatePayoff(data.debts, strategy, extra, today), [data.debts, strategy, extra, today]);
  if (!order.length) return null;
  const hasRates = data.debts.some((d) => (d.monthlyRate ?? 0) > 0);
  const saved = base.months - fast.months;
  return (
    <Card title={<><Rocket size={14} className="text-sky-400" /> Plano para quitar mais rápido</>}>
      <Segmented value={strategy} onChange={setStrategy} options={[{ value: 'avalanche', label: <span className="flex items-center gap-1.5"><Flame size={13} /> Avalanche</span> }, { value: 'bola-de-neve', label: <span className="flex items-center gap-1.5"><Snowflake size={13} /> Bola de neve</span> }]} />
      <p className="mt-3 text-xs text-slate-400">{strategy === 'avalanche' ? 'Ataca primeiro a dívida com juros mais altos: é o que mais economiza.' : 'Ataca primeiro a menor dívida: você quita uma logo e ganha motivação.'}{strategy === 'avalanche' && !hasRates ? ' Dica: informe os juros de cada dívida para o plano ficar certo.' : ''}</p>
      <ol className="mt-3 space-y-2">
        {order.map(({ debt: d, st }, i) => (
          <li key={d.id} className="flex items-center gap-3 rounded-2xl bg-white/[.03] px-3 py-2.5 ring-1 ring-white/[.05]">
            <span className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display text-sm font-black', i === 0 ? 'bg-brand-500 text-white' : 'bg-white/10 text-slate-300')}>{i + 1}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-white">{d.creditor}</span><span className="text-[11px] text-slate-500">{formatBRL(st.remaining)}{d.monthlyRate ? ` · ${String(d.monthlyRate).replace('.', ',')}% a.m.` : ''}</span></span>
            {i === 0 && <span className="label text-brand-300">foco agora</span>}
          </li>
        ))}
      </ol>
      <div className="mt-4 rounded-2xl bg-brand-500/[.08] p-4 ring-1 ring-brand-500/20">
        <Field label="Se eu conseguir pagar a mais por mês"><MoneyInput value={extra} onChange={setExtra} /></Field>
        <p className="mt-3 text-sm text-slate-200" data-testid="payoff-result">
          {fast.months >= 600 ? 'Com esses valores a dívida não acaba — o juro é maior que o pagamento.' : <>
            Seguindo este plano, livre em <b className="text-white">{fast.months} {fast.months === 1 ? 'mês' : 'meses'}</b>
            {saved > 0 && <> — <b className="text-emerald-300">{saved} {saved === 1 ? 'mês' : 'meses'} antes</b></>}
            {base.interest - fast.interest > 1 && <> e economiza <b className="text-emerald-300">{formatBRL(base.interest - fast.interest)}</b> de juros</>}.
          </>}
        </p>
        <p className="mt-1 text-[11px] text-slate-500">O extra vai para a dívida "foco agora". Quando ela acaba, o valor dela passa para a próxima.</p>
      </div>
    </Card>
  );
}

function ToolsCard() {
  return (
    <Card title={<><Lightbulb size={14} className="text-amber-400" /> Para negociar e quitar</>}>
      <ul className="space-y-2.5 text-sm text-slate-300">
        <li>• <b className="text-white">Negocie antes de pagar juros:</b> peça desconto à vista ou parcelas menores. Acordos costumam cortar boa parte dos juros.</li>
        <li>• <b className="text-white">Nunca pague uma dívida fazendo outra mais cara</b> (rotativo do cartão e cheque especial são os juros mais altos).</li>
        <li>• <b className="text-white">Anote o valor original</b> ao cadastrar um acordo: o Giro mostra o desconto que você conseguiu.</li>
      </ul>
      <div className="mt-4 space-y-2">
        {TOOLS.map((t) => (
          <a key={t.name} href={t.url} target="_blank" rel="noreferrer" className="surface surface-hover flex items-center gap-3 rounded-2xl px-4 py-3">
            <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-white">{t.name}</span><span className="text-[11px] text-slate-400">{t.text}</span></span>
            <ExternalLink size={15} className="shrink-0 text-slate-500" />
          </a>
        ))}
      </div>
    </Card>
  );
}

function DebtDetail({ debt, onEdit, onSettled }: { debt: Debt; onEdit: () => void; onSettled: (n: string) => void }) {
  const { remove } = useData();
  const { unpay } = usePayDebt();
  const toast = useToast();
  const today = localISODate();
  const st = debtStatus(debt, today);
  const payInst = usePayInstallment(onSettled);
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 3000); return () => clearTimeout(t); }, [armed]);
  const sorted = [...debt.installments].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return (
    <div>
      <button onClick={() => go('dividas')} className="label press mb-4 flex items-center gap-2 rounded-full bg-white/[.04] px-3.5 py-2 text-slate-400 ring-1 ring-white/10 hover:text-white"><ArrowLeft size={14} /> Dívidas</button>
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          {(() => { const L = lookOf(debt.kind); return <span className="solid flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.4rem]" style={{ '--tone': st.done ? '#10b981' : L.color } as React.CSSProperties}>{st.done ? <Trophy size={28} /> : <L.icon size={28} />}</span>; })()}
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl font-black text-white md:text-3xl">{debt.creditor}</h1>
            <p className="label text-slate-500">{kindLabel(debt.kind)}{debt.monthlyRate ? ` · ${String(debt.monthlyRate).replace('.', ',')}% ao mês` : ''}</p>
            <div className="mt-1.5"><StatusChip st={st} /></div>
          </div>
        </div>
        <Button variant="soft" onClick={onEdit}><Pencil size={15} /> Editar</Button>
      </div>
      <div className="stagger mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[['Falta', formatBRL(st.remaining)], ['Já pago', formatBRL(st.paid)], ['Parcelas', `${st.paidCount}/${st.count}`], st.discount > 0 ? ['Desconto conseguido', formatBRL(st.discount)] : ['Total', formatBRL(st.total)]].map(([l, v]) => (
          <div key={l} className="surface rounded-[1.5rem] p-4"><p className="label text-slate-500">{l}</p><p className="mt-1 break-words font-display text-lg font-black text-white md:text-xl">{v}</p></div>
        ))}
      </div>
      <div className="mb-5 h-3 overflow-hidden rounded-full bg-white/[.06]"><div className="fill-x h-full rounded-full" style={{ width: `${st.pct}%`, background: `linear-gradient(90deg, ${lookOf(debt.kind).color}, color-mix(in srgb, ${lookOf(debt.kind).color} 45%, white))` }} /></div>
      {st.done && <p className="mb-4 flex items-center gap-2 rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-200 ring-1 ring-emerald-500/20"><Trophy size={17} /> Dívida quitada! Parabéns.</p>}
      <Card title="Parcelas">
        <ul className="stagger space-y-2.5">
          {sorted.map((i, k) => {
            const late = !i.paidAt && i.dueDate < today;
            return (
              <Row key={i.id} tone={i.paidAt ? 'good' : late ? 'bad' : 'info'} icon={i.paidAt ? <BadgeCheck size={16} /> : <HandCoins size={16} />}
                title={`Parcela ${k + 1} de ${sorted.length}`}
                subtitle={i.paidAt ? `paga em ${formatDate(i.paidAt)}` : <span className={late ? 'text-rose-400' : undefined}>vence {formatDate(i.dueDate)}{late ? ' · atrasada' : ''}</span>}
                amount={formatBRL(i.amount)} amountTone={i.paidAt ? 'good' : 'bad'}
                actions={i.paidAt
                  ? <Button variant="soft" className="min-h-10 px-3 text-[11px]" onClick={async () => { if (await unpay(debt, i)) toast('Pagamento desfeito'); }} aria-label={`Desfazer parcela ${k + 1}`}><Undo2 size={14} /></Button>
                  : <Button className="min-h-10 px-3.5 text-[11px]" onClick={() => payInst(debt, i)} aria-label={`Paguei parcela ${k + 1}`}><Check size={15} strokeWidth={3} /> Paguei</Button>} />
            );
          })}
        </ul>
        <p className="mt-3 text-[11px] text-slate-500">"Paguei" cria a saída no extrato (categoria {debt.category}) na sua conta principal.</p>
      </Card>
      {debt.notes && <p className="mt-4 text-sm text-slate-400">{debt.notes}</p>}
      <div className="mt-6 flex justify-end">
        <Button variant="danger" onClick={async () => { if (!armed) return setArmed(true); if (await remove('debts', debt.id)) { toast('Dívida excluída'); go('dividas'); } }}>
          <Trash2 size={15} /> {armed ? 'Toque de novo para excluir' : 'Excluir dívida'}
        </Button>
      </div>
    </div>
  );
}

function DebtForm({ open, editing, onClose }: { open: boolean; editing?: Debt; onClose: () => void }) {
  const { insert, update } = useData();
  const toast = useToast();
  const blank = { creditor: '', kind: 'acordo' as DebtKind, category: 'Empréstimos', total: 0, count: 1, firstDue: localISODate(), monthlyRate: 0, originalAmount: 0, notes: '' };
  const [f, setF] = useState(blank);
  const [errors, setErrors] = useState<Errors<'creditor' | 'total' | 'count' | 'firstDue' | 'monthlyRate'>>({});
  const anyPaid = !!editing?.installments.some((i) => i.paidAt);
  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (editing) {
      const sorted = [...editing.installments].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      setF({ creditor: editing.creditor, kind: editing.kind, category: editing.category, total: sorted.reduce((s, i) => s + i.amount, 0), count: sorted.length, firstDue: sorted[0]?.dueDate ?? localISODate(), monthlyRate: editing.monthlyRate ?? 0, originalAmount: editing.originalAmount ?? 0, notes: editing.notes ?? '' });
    } else setF(blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);
  useEffect(() => { setErrors({}); }, [f]);
  const each = f.count > 0 ? f.total / Math.floor(f.count) : 0;

  const save = async () => {
    const e = validate({
      creditor: [rules.required(f.creditor, 'Credor'), rules.maxLength(f.creditor, 60, 'Credor')],
      total: [rules.positive(f.total, 'Valor')],
      count: [(f.count < 1 || f.count > 360 || !Number.isInteger(f.count)) && 'Entre 1 e 360 parcelas'],
      firstDue: [rules.date(f.firstDue)],
      monthlyRate: [(f.monthlyRate < 0 || f.monthlyRate > 30) && 'Juros entre 0% e 30% ao mês'],
    });
    setErrors(e);
    if (hasErrors(e)) return;
    const meta = { creditor: f.creditor.trim(), kind: f.kind, category: f.category, monthlyRate: f.monthlyRate || null, originalAmount: f.originalAmount || null, notes: f.notes.trim() || null };
    let ok: boolean;
    if (editing) ok = await update('debts', editing.id, anyPaid ? meta : { ...meta, installments: buildInstallments(f.total, f.count, f.firstDue, newId) });
    else ok = !!(await insert('debts', { ...meta, installments: buildInstallments(f.total, f.count, f.firstDue, newId) }));
    if (ok) { toast(editing ? 'Dívida atualizada' : 'Dívida cadastrada. Vamos quitar! 💪'); onClose(); }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Editar dívida' : 'Nova dívida'} footer={<Button className="w-full" onClick={save}>{editing ? 'Salvar' : 'Cadastrar'}</Button>}>
      <div className="space-y-4">
        <Field label="Com quem é a dívida" error={errors.creditor}><Input value={f.creditor} maxLength={60} onChange={(e) => setF({ ...f, creditor: e.target.value })} placeholder="Ex.: Estácio – acordo" autoFocus /></Field>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-3">
          <Field label="Tipo"><Select value={f.kind} onChange={(e) => { const k = e.target.value as DebtKind; setF({ ...f, kind: k, category: DEBT_KINDS.find((x) => x.value === k)?.category ?? f.category }); }} options={DEBT_KINDS.map((k) => ({ value: k.value, label: k.label }))} /></Field>
          <Field label="Categoria ao pagar"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} options={EXPENSE_CATEGORIES} /></Field>
        </div>
        {anyPaid ? <p className="rounded-2xl bg-white/[.04] p-3 text-xs text-slate-400">Esta dívida já tem parcelas pagas, então valores e datas das parcelas não mudam aqui.</p> : <>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-3">
            <Field label="Valor total a pagar" error={errors.total}><MoneyInput value={f.total} onChange={(v) => setF({ ...f, total: v })} /></Field>
            <Field label="Parcelas" error={errors.count} hint={f.count > 1 && f.total > 0 ? `${Math.floor(f.count)}x de ${formatBRL(each)}` : undefined}><NumberInput value={f.count} onChange={(v) => setF({ ...f, count: Math.round(v) })} suffix="x" /></Field>
          </div>
          <Field label={f.count > 1 ? 'Vencimento da 1ª parcela' : 'Vencimento'} error={errors.firstDue} hint={f.count > 1 ? 'As outras vencem no mesmo dia dos meses seguintes' : undefined}><Input type="date" value={f.firstDue} onChange={(e) => setF({ ...f, firstDue: e.target.value })} /></Field>
        </>}
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-3">
          <Field label="Juros ao mês (opcional)" error={errors.monthlyRate} hint="Ajuda a decidir qual quitar primeiro"><NumberInput value={f.monthlyRate} onChange={(v) => setF({ ...f, monthlyRate: v })} suffix="%" step="0.1" /></Field>
          <Field label="Valor original (opcional)" hint="Mostra o desconto conseguido"><MoneyInput value={f.originalAmount} onChange={(v) => setF({ ...f, originalAmount: v })} placeholder="R$ 0,00" /></Field>
        </div>
        <Field label="Observação"><Input value={f.notes} maxLength={200} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Ex.: protocolo do acordo, matrícula" /></Field>
      </div>
    </Modal>
  );
}
