import { useEffect, useMemo, useState } from 'react';
import { BankPicker } from '../components/BankPicker';
import { ArrowLeft, ArrowLeftRight, CreditCard, Landmark, Pencil, Plus, Receipt, Wallet } from 'lucide-react';
import { useData } from '../data/DataProvider';
import { useToast } from '../data/toast';
import { newId } from '../data/db';
import { AddCard, BigTile, Button, Card as Panel, ConfirmDelete, Empty, Field, Input, Modal, MoneyInput, NumberInput, PageHeader, PeriodNav, Row, Select, Stat, Tilt, cx } from '../components/ui';
import { ACCOUNT_COLORS, ACCOUNT_KINDS, accountBalance, cardUsedLimit, invoiceMonthFor, invoiceSummary } from '../lib/cards';
import { addMonths, formatBRL, formatDate, localISODate, monthLabel } from '../lib/format';
import { hasErrors, rules, validate, type Errors } from '../lib/validate';
import { go } from '../router';
import type { Account, Card } from '../types';

const STATUS: Record<string, { label: string; cls: string }> = {
  aberta: { label: 'Aberta', cls: 'bg-sky-500/15 text-sky-300' },
  fechada: { label: 'Fechada', cls: 'bg-amber-500/15 text-amber-300' },
  paga: { label: 'Paga', cls: 'bg-emerald-500/15 text-emerald-300' },
  futura: { label: 'Futura', cls: 'bg-white/10 text-slate-300' },
};

export default function Accounts({ id }: { id?: string }) {
  const { data } = useData();
  const card = id ? data.cards.find((c) => c.id === id) : undefined;
  if (card) return <CardDetail card={card} />;
  return <Overview />;
}

function Overview() {
  const { data } = useData();
  const today = localISODate();
  const [accForm, setAccForm] = useState<{ open: boolean; editing?: Account }>({ open: false });
  const [cardForm, setCardForm] = useState<{ open: boolean; editing?: Card }>({ open: false });
  const [transferOpen, setTransferOpen] = useState(false);
  const accounts = data.accounts.filter((a) => !a.archived);
  const cards = data.cards.filter((c) => !c.archived);
  const balances = useMemo(() => new Map(accounts.map((a) => [a.id, accountBalance(a, data.transactions)])), [accounts, data.transactions]);
  const total = [...balances.values()].reduce((s, v) => s + v, 0);
  const openInvoices = cards.reduce((s, c) => s + invoiceSummary(c, data.transactions, invoiceMonthFor(today, c), today).open, 0);

  return (
    <div>
      <PageHeader eyebrow="Seu dinheiro" title="Contas e cartões" subtitle="Saldo de cada conta, faturas e limites" actions={<>
        <Button onClick={() => setAccForm({ open: true })}><Plus size={16} /> Conta</Button>
        <Button variant="soft" onClick={() => setCardForm({ open: true })}><CreditCard size={16} /> Cartão</Button>
        <Button variant="soft" disabled={accounts.length < 2} onClick={() => setTransferOpen(true)}><ArrowLeftRight size={16} /> Transferir</Button>
      </>} />

      <div className="stagger mb-6 grid gap-3 md:grid-cols-3 md:gap-4">
        <BigTile label="Saldo em contas" money={total} tone={total >= 0 ? 'good' : 'bad'} icon={<Wallet />} sub={`${accounts.length} ${accounts.length === 1 ? 'conta' : 'contas'}`} />
        <Stat label="Faturas atuais" money={openInvoices} tone="warn" icon={<Receipt />} sub="em aberto nos cartões" />
        <Stat label="Saldo menos faturas" money={total - openInvoices} tone={total - openInvoices >= 0 ? 'info' : 'bad'} icon={<Landmark />} sub="o que sobra depois de pagar" />
      </div>

      <h2 className="label mb-3 text-slate-400">Contas</h2>
      <div className="stagger mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((a) => {
          const bal = balances.get(a.id) ?? 0;
          const Icon = a.kind === 'carteira' ? Wallet : Landmark;
          return (
            <Tilt key={a.id} as="button" type="button" onClick={() => setAccForm({ open: true, editing: a })} className="tinted flex items-center gap-4 rounded-[1.75rem] p-5 text-left" style={{ '--tone': a.color } as React.CSSProperties}>
              <span className="solid flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ '--tone': a.color } as React.CSSProperties}><Icon size={22} /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-lg font-black text-white">{a.name}</span>
                <span className="label block text-slate-400">{ACCOUNT_KINDS.find((k) => k.value === a.kind)?.label}</span>
              </span>
              <span className={cx('font-mono text-base font-extrabold', bal < 0 ? 'text-rose-400' : 'text-white')}>{formatBRL(bal)}</span>
            </Tilt>
          );
        })}
        <AddCard label="Nova conta" onClick={() => setAccForm({ open: true })} className="min-h-24" />
      </div>

      <h2 className="label mb-3 text-slate-400">Cartões de crédito</h2>
      <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => {
          const m = invoiceMonthFor(today, c);
          const inv = invoiceSummary(c, data.transactions, m, today);
          const used = cardUsedLimit(c, data.transactions);
          return (
            <Tilt key={c.id} as="button" type="button" max={10} onClick={() => go('contas', c.id)} className="solid shine flex aspect-[1.6/1] flex-col justify-between rounded-[1.75rem] p-5 text-left" style={{ '--tone': c.color } as React.CSSProperties}>
              <div className="pop relative flex items-start justify-between">
                <span className="font-display text-xl font-black">{c.name}</span>
                <CreditCard size={26} className="opacity-80" />
              </div>
              <div className="pop-sm relative">
                <p className="label text-white/75">Fatura de {monthLabel(m).split(' ')[0].toLowerCase()} · vence {formatDate(inv.due).slice(0, 5)}</p>
                <p className="font-display text-3xl font-black tracking-tight drop-shadow">{formatBRL(inv.open)}</p>
                {c.limit > 0 && (
                  <div className="mt-2">
                    <div className="h-1.5 overflow-hidden rounded-full bg-black/25"><div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, (used / c.limit) * 100)}%` }} /></div>
                    <p className="mt-1 text-[11px] font-semibold text-white/80">Disponível {formatBRL(Math.max(0, c.limit - used))} de {formatBRL(c.limit)}</p>
                  </div>
                )}
              </div>
            </Tilt>
          );
        })}
        <AddCard label="Novo cartão" onClick={() => setCardForm({ open: true })} className="aspect-[1.6/1]" />
      </div>

      <AccountForm {...accForm} onClose={() => setAccForm({ open: false })} />
      <CardForm {...cardForm} onClose={() => setCardForm({ open: false })} />
      <TransferForm open={transferOpen} onClose={() => setTransferOpen(false)} />
    </div>
  );
}

function CardDetail({ card }: { card: Card }) {
  const { data, remove } = useData();
  const today = localISODate();
  const [month, setMonth] = useState(invoiceMonthFor(today, card));
  const [payOpen, setPayOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const inv = useMemo(() => invoiceSummary(card, data.transactions, month, today), [card, data.transactions, month, today]);
  const st = STATUS[inv.status];

  return (
    <div>
      <button onClick={() => go('contas')} className="label press mb-4 flex items-center gap-2 rounded-full bg-white/[.04] px-3.5 py-2 text-slate-400 ring-1 ring-white/10 hover:text-white"><ArrowLeft size={14} /> Contas e cartões</button>
      <PageHeader eyebrow="Cartão de crédito" title={card.name} subtitle={`Fecha dia ${card.closingDay} · vence dia ${card.dueDay}`} actions={<>
        <PeriodNav label={`Fatura de ${monthLabel(month)}`} onPrev={() => setMonth(addMonths(month, -1))} onNext={() => setMonth(addMonths(month, 1))} onToday={() => setMonth(invoiceMonthFor(today, card))} />
        <Button variant="soft" onClick={() => setEditOpen(true)}><Pencil size={15} /> Editar</Button>
      </>} />

      <div className="stagger mb-6 grid gap-3 md:grid-cols-3 md:gap-4">
        <BigTile label="Valor da fatura" money={inv.total} tone="info" icon={<Receipt />} sub={<span className={cx('rounded-full px-2.5 py-1', st.cls)}>{st.label}</span>} />
        <Stat label="Já pago" money={inv.paid} tone="good" icon={<Wallet />} />
        <Stat label="Falta pagar" money={inv.open} tone={inv.open > 0 ? 'warn' : 'good'} icon={<CreditCard />} sub={`fecha ${formatDate(inv.closing)} · vence ${formatDate(inv.due)}`} />
      </div>

      {inv.open > 0 && <Button className="mb-6 w-full md:w-auto" onClick={() => setPayOpen(true)}><Wallet size={16} /> Pagar fatura</Button>}

      <Panel title={<><Receipt size={14} className="text-sky-400" /> Compras desta fatura</>}>
        {inv.items.length === 0 ? <Empty icon={<CreditCard size={26} />} title="Nenhuma compra nesta fatura" text="Lance uma despesa escolhendo este cartão em “Pagou com”." /> : (
          <ul className="stagger space-y-2.5">
            {inv.items.map((t) => (
              <Row key={t.id} tone="info" icon={<CreditCard size={17} />} title={t.description}
                subtitle={`${t.category} · compra em ${formatDate(t.date)}${t.installmentCount ? ` · parcela ${t.installmentIndex}/${t.installmentCount}` : ''}`}
                amount={formatBRL(t.amount)} amountTone="bad" actions={<ConfirmDelete onConfirm={() => remove('transactions', t.id)} />} />
            ))}
          </ul>
        )}
      </Panel>
      <PayInvoice open={payOpen} onClose={() => setPayOpen(false)} card={card} month={month} amount={inv.open} />
      <CardForm open={editOpen} editing={card} onClose={() => setEditOpen(false)} />
    </div>
  );
}

function AccountForm({ open, editing, onClose }: { open: boolean; editing?: Account; onClose: () => void }) {
  const { data, insert, update } = useData();
  const toast = useToast();
  const blank = (): Omit<Account, 'id'> => ({ name: '', kind: 'corrente', color: ACCOUNT_COLORS[data.accounts.length % ACCOUNT_COLORS.length], initialBalance: 0 });
  const [f, setF] = useState(blank);
  const [neg, setNeg] = useState(false);
  const [errors, setErrors] = useState<Errors<'name'>>({});
  // Some com o erro assim que a pessoa mexe no formulário; volta a validar ao salvar.
  useEffect(() => { setErrors({}); }, [f, neg]);
  useEffect(() => { if (open) { setErrors({}); setF(editing ? { ...editing } : blank()); setNeg((editing?.initialBalance ?? 0) < 0); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open, editing]);
  const activeCount = data.accounts.filter((a) => !a.archived).length;

  const save = async () => {
    const e = validate({ name: [rules.required(f.name, 'Nome'), rules.maxLength(f.name, 40, 'Nome')] });
    setErrors(e);
    if (hasErrors(e)) return;
    const payload = { ...f, name: f.name.trim(), initialBalance: neg ? -Math.abs(f.initialBalance) : Math.abs(f.initialBalance) };
    delete (payload as any).id;
    const ok = editing ? await update('accounts', editing.id, payload) : !!(await insert('accounts', payload));
    if (ok) { toast('Conta salva'); onClose(); }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Editar conta' : 'Nova conta'} footer={<Button className="w-full" onClick={save}>Salvar</Button>}>
      <div className="space-y-4">
        <Field label="Banco" group><BankPicker name={f.name} onPick={(name, color) => setF({ ...f, name, color })} onOther={() => { setF({ ...f, name: '' }); setTimeout(() => document.getElementById('account-name')?.focus(), 50); }} /></Field>
        <Field label="Nome" error={errors.name} hint="Se escolheu um banco acima, pode mudar o nome (ex.: Nubank PJ)"><Input id="account-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex.: Nubank, Itaú, Dinheiro" maxLength={40} /></Field>
        <Field label="Tipo"><Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as Account['kind'] })} options={ACCOUNT_KINDS} /></Field>
        <Field label="Saldo inicial" hint="Quanto tinha na conta quando começou a usar o app">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <MoneyInput value={Math.abs(f.initialBalance)} onChange={(v) => setF({ ...f, initialBalance: v })} />
            <button type="button" onClick={() => setNeg(!neg)} className={cx('press rounded-2xl px-4 text-xs font-extrabold ring-1', neg ? 'bg-rose-500/15 text-rose-300 ring-rose-500/30' : 'bg-white/5 text-slate-400 ring-white/10')}>{neg ? 'Negativo' : 'Positivo'}</button>
          </div>
        </Field>
        <ColorPicker value={f.color} onChange={(c) => setF({ ...f, color: c })} />
        {editing && (
          <Button variant="danger" className="w-full" disabled={!editing.archived && activeCount <= 1}
            onClick={async () => { await update('accounts', editing.id, { archived: !editing.archived }); onClose(); }}>
            {editing.archived ? 'Reativar conta' : activeCount <= 1 ? 'É sua única conta ativa' : 'Arquivar conta (mantém o histórico)'}
          </Button>
        )}
      </div>
    </Modal>
  );
}

function CardForm({ open, editing, onClose }: { open: boolean; editing?: Card; onClose: () => void }) {
  const { data, insert, update } = useData();
  const toast = useToast();
  const blank = (): Omit<Card, 'id'> => ({ name: '', color: ACCOUNT_COLORS[(data.cards.length + 1) % ACCOUNT_COLORS.length], limit: 0, closingDay: 3, dueDay: 10, accountId: data.accounts[0]?.id ?? null });
  const [f, setF] = useState(blank);
  const [errors, setErrors] = useState<Errors<'name' | 'closingDay' | 'dueDay' | 'limit'>>({});
  // Some com o erro assim que a pessoa mexe no formulário; volta a validar ao salvar.
  useEffect(() => { setErrors({}); }, [f]);
  useEffect(() => { if (open) { setErrors({}); setF(editing ? { ...editing } : blank()); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open, editing]);

  const save = async () => {
    const e = validate({
      name: [rules.required(f.name, 'Nome'), rules.maxLength(f.name, 30, 'Nome')],
      closingDay: [rules.dayOfMonth(f.closingDay, 'Dia do fechamento')],
      dueDay: [rules.dayOfMonth(f.dueDay, 'Dia do vencimento'), f.dueDay === f.closingDay && 'Vencimento e fechamento não podem ser no mesmo dia'],
      limit: [rules.nonNegative(f.limit, 'Limite')],
    });
    setErrors(e);
    if (hasErrors(e)) return;
    const payload = { ...f, name: f.name.trim() };
    delete (payload as any).id;
    const ok = editing ? await update('cards', editing.id, payload) : !!(await insert('cards', payload));
    if (ok) { toast('Cartão salvo'); onClose(); }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Editar cartão' : 'Novo cartão'} footer={<Button className="w-full" onClick={save}>Salvar</Button>}>
      <div className="space-y-4">
        <Field label="Banco do cartão" group><BankPicker name={f.name} onPick={(name, color) => setF({ ...f, name, color })} onOther={() => { setF({ ...f, name: '' }); setTimeout(() => document.getElementById('card-name')?.focus(), 50); }} /></Field>
        <Field label="Nome" error={errors.name}><Input id="card-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex.: Nubank, Inter, C6" maxLength={30} /></Field>
        <Field label="Limite" error={errors.limit}><MoneyInput value={f.limit} onChange={(v) => setF({ ...f, limit: v })} /></Field>
        <div className="grid grid-cols-2 items-start gap-3">
          <Field label="Dia do fechamento" error={errors.closingDay}><NumberInput value={f.closingDay} onChange={(v) => setF({ ...f, closingDay: Math.round(v) })} /></Field>
          <Field label="Dia do vencimento" error={errors.dueDay}><NumberInput value={f.dueDay} onChange={(v) => setF({ ...f, dueDay: Math.round(v) })} /></Field>
        </div>
        <Field label="Conta que paga a fatura"><Select value={f.accountId ?? ''} onChange={(e) => setF({ ...f, accountId: e.target.value || null })} options={data.accounts.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name }))} /></Field>
        <ColorPicker value={f.color} onChange={(c) => setF({ ...f, color: c })} />
        {editing && <Button variant="danger" className="w-full" onClick={async () => { await update('cards', editing.id, { archived: !editing.archived }); onClose(); if (!editing.archived) go('contas'); }}>{editing.archived ? 'Reativar cartão' : 'Arquivar cartão (mantém o histórico)'}</Button>}
      </div>
    </Modal>
  );
}

function TransferForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, insert } = useData();
  const toast = useToast();
  const accounts = data.accounts.filter((a) => !a.archived);
  const [f, setF] = useState({ from: '', to: '', amount: 0, date: localISODate() });
  const [errors, setErrors] = useState<Errors<'to' | 'amount' | 'date'>>({});
  // Some com o erro assim que a pessoa mexe no formulário; volta a validar ao salvar.
  useEffect(() => { setErrors({}); }, [f]);
  useEffect(() => { if (open) { setErrors({}); setF({ from: accounts[0]?.id ?? '', to: accounts[1]?.id ?? '', amount: 0, date: localISODate() }); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open]);

  const save = async () => {
    const e = validate({ to: [f.from === f.to && 'Escolha contas diferentes'], amount: [rules.positive(f.amount, 'Valor')], date: [rules.date(f.date)] });
    setErrors(e);
    if (hasErrors(e)) return;
    const group = newId();
    const from = accounts.find((a) => a.id === f.from)!; const to = accounts.find((a) => a.id === f.to)!;
    const base = { amount: f.amount, category: 'Transferência', paymentMethod: 'Transferência', date: f.date, internal: 'transfer' as const, transferGroup: group };
    const ok = await insert('transactions', [
      { ...base, type: 'expense', description: `Transferência para ${to.name}`, accountId: from.id },
      { ...base, type: 'income', description: `Transferência de ${from.name}`, accountId: to.id },
    ]);
    if (ok) { toast(`${formatBRL(f.amount)} transferidos`); onClose(); }
  };

  const opts = accounts.map((a) => ({ value: a.id, label: a.name }));
  return (
    <Modal open={open} onClose={onClose} title="Transferir entre contas" footer={<Button className="w-full" onClick={save}>Transferir</Button>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 items-start gap-3">
          <Field label="De"><Select value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} options={opts} /></Field>
          <Field label="Para" error={errors.to}><Select value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} options={opts} /></Field>
        </div>
        <Field label="Valor" error={errors.amount}><MoneyInput value={f.amount} onChange={(v) => setF({ ...f, amount: v })} className="text-lg font-semibold" /></Field>
        <Field label="Data" error={errors.date}><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <p className="text-xs text-slate-500">Transferências mudam o saldo das contas, mas não contam como receita nem despesa.</p>
      </div>
    </Modal>
  );
}

function PayInvoice({ open, onClose, card, month, amount }: { open: boolean; onClose: () => void; card: Card; month: string; amount: number }) {
  const { data, insert } = useData();
  const toast = useToast();
  const accounts = data.accounts.filter((a) => !a.archived);
  const [f, setF] = useState({ accountId: '', amount: 0, date: localISODate() });
  const [errors, setErrors] = useState<Errors<'amount' | 'date' | 'accountId'>>({});
  // Some com o erro assim que a pessoa mexe no formulário; volta a validar ao salvar.
  useEffect(() => { setErrors({}); }, [f]);
  useEffect(() => { if (open) { setErrors({}); setF({ accountId: card.accountId && accounts.some((a) => a.id === card.accountId) ? card.accountId : accounts[0]?.id ?? '', amount, date: localISODate() }); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open]);

  const save = async () => {
    const e = validate({ accountId: [!f.accountId && 'Escolha a conta'], amount: [rules.positive(f.amount, 'Valor'), f.amount > amount + 0.004 && `O valor em aberto é ${formatBRL(amount)}`], date: [rules.date(f.date)] });
    setErrors(e);
    if (hasErrors(e)) return;
    const ok = await insert('transactions', { type: 'expense', amount: f.amount, description: `Fatura ${card.name} · ${monthLabel(month).toLowerCase()}`, category: 'Cartão de crédito', paymentMethod: 'Boleto', date: f.date, accountId: f.accountId, cardId: card.id, invoiceMonth: month, internal: 'invoice-payment' });
    if (ok) { toast('Pagamento da fatura registrado'); onClose(); }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Pagar fatura · ${card.name}`} footer={<Button className="w-full" onClick={save}>Confirmar pagamento</Button>}>
      <div className="space-y-4">
        <Field label="Pagar com a conta" error={errors.accountId}><Select value={f.accountId} onChange={(e) => setF({ ...f, accountId: e.target.value })} options={accounts.map((a) => ({ value: a.id, label: a.name }))} /></Field>
        <Field label="Valor" error={errors.amount} hint="Pode pagar só uma parte — o resto continua em aberto"><MoneyInput value={f.amount} onChange={(v) => setF({ ...f, amount: v })} className="text-lg font-semibold" /></Field>
        <Field label="Data do pagamento" error={errors.date}><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <p className="text-xs text-slate-500">As compras já contaram no orçamento do mês da fatura; o pagamento só tira o dinheiro da conta.</p>
      </div>
    </Modal>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <Field label="Cor" group>
      <div className="flex flex-wrap gap-2.5">
        {ACCOUNT_COLORS.map((c) => (
          <button key={c} type="button" aria-label={`Cor ${c}`} aria-pressed={value === c} onClick={() => onChange(c)}
            className={cx('press h-9 w-9 rounded-full ring-offset-2 ring-offset-[var(--color-panel-2)] transition', value === c ? 'scale-110 ring-2 ring-white' : 'ring-0')} style={{ background: c, boxShadow: `0 4px 14px -4px ${c}` }} />
        ))}
      </div>
    </Field>
  );
}

