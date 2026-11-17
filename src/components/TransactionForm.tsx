import { useEffect, useMemo, useState } from 'react';
import { CreditCard, Landmark, Sparkles, Wallet } from 'lucide-react';
import type { Transaction, TxType } from '../types';
import { useData } from '../data/DataProvider';
import { useToast } from '../data/toast';
import { cardPurchase, invoiceDates, invoiceMonthFor } from '../lib/cards';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS } from '../lib/categories';
import { formatBRL, formatDate, localISODate, monthLabel } from '../lib/format';
import { parseQuickEntry } from '../lib/quickParse';
import { hasErrors, rules, validate, type Errors } from '../lib/validate';
import { newId } from '../data/db';
import { Button, Field, Input, Modal, MoneyInput, NumberInput, Segmented, Select, cx } from './ui';

export interface TxPreset { type?: TxType; text?: string; editing?: Transaction }

type Form = { type: TxType; amount: number; description: string; category: string; paymentMethod: string; date: string; vehicleId: string; source: string; installments: number };
type Field_ = 'amount' | 'description' | 'date' | 'source' | 'installments';

export default function TransactionForm({ open, onClose, preset }: { open: boolean; onClose: () => void; preset?: TxPreset }) {
  const { insert, update, data } = useData();
  const toast = useToast();
  const accounts = data.accounts.filter((a) => !a.archived);
  const cards = data.cards.filter((c) => !c.archived);
  const defaultSource = accounts[0] ? `acc:${accounts[0].id}` : '';
  const blank = (type: TxType = 'expense'): Form => ({ type, amount: 0, description: '', category: type === 'expense' ? 'Alimentação' : 'Salário', paymentMethod: 'Pix', date: localISODate(), vehicleId: '', source: defaultSource, installments: 1 });
  const [quick, setQuick] = useState('');
  const [f, setF] = useState<Form>(blank());
  const [errors, setErrors] = useState<Errors<Field_>>({});
  // Some com o erro assim que a pessoa mexe no formulário; volta a validar ao salvar.
  useEffect(() => { setErrors({}); }, [f]);
  const [busy, setBusy] = useState(false);
  const editing = preset?.editing;

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (editing) {
      setF({ type: editing.type, amount: editing.amount, description: editing.description, category: editing.category, paymentMethod: editing.paymentMethod, date: editing.date,
        vehicleId: editing.vehicleId ?? '', source: editing.cardId ? `card:${editing.cardId}` : editing.accountId ? `acc:${editing.accountId}` : defaultSource, installments: 1 });
    } else setF(blank(preset?.type));
    setQuick(preset?.text ?? '');
    if (preset?.text) applyQuick(preset.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preset]);

  const applyQuick = (text: string) => {
    const p = parseQuickEntry(text);
    if (!p) return;
    // "no crédito" → usa o primeiro cartão, se houver.
    const src = p.paymentMethod === 'Crédito' && p.type === 'expense' && cards[0] ? `card:${cards[0].id}` : undefined;
    setF((x) => ({ ...x, ...p, ...(src ? { source: src } : {}) }));
  };

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const cats = f.type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const vehicles = data.vehicles.filter((v) => v.active);
  const showVehicle = vehicles.length > 0 && f.type === 'expense' && ['Veículo', 'Combustível', 'Transporte'].includes(f.category);
  const card = f.source.startsWith('card:') ? cards.find((c) => `card:${c.id}` === f.source) : undefined;
  const isInstallment = !!editing?.installmentGroup;

  const invoiceHint = useMemo(() => {
    if (!card || !/^\d{4}-\d{2}-\d{2}$/.test(f.date)) return null;
    const m = invoiceMonthFor(f.date, card);
    return `Cai na fatura de ${monthLabel(m).toLowerCase()} (vence ${formatDate(invoiceDates(card, m).due)})`;
  }, [card, f.date]);

  const save = async () => {
    const e = validate<Field_>({
      amount: [rules.positive(f.amount, 'Valor'), rules.max(f.amount, 10_000_000, 'Valor')],
      description: [rules.maxLength(f.description, 120, 'Descrição')],
      date: [rules.date(f.date)],
      source: [!f.source && 'Escolha de onde saiu o dinheiro', card && f.type === 'income' && 'Receitas não podem ir para um cartão — escolha uma conta'],
      installments: [card && !editing ? rules.intBetween(f.installments, 1, 48, 'Parcelas') : null],
    });
    setErrors(e);
    if (hasErrors(e)) { toast('Confira os campos destacados', 'error'); return; }
    setBusy(true);
    const description = f.description.trim() || f.category;
    const base = { type: f.type, amount: f.amount, description, category: f.category, date: f.date, vehicleId: f.vehicleId || null };
    let ok = false;
    if (editing) {
      const patch: Partial<Transaction> = card
        ? { ...base, paymentMethod: 'Crédito', cardId: card.id, accountId: null,
            // Parcela: mantém a fatura dela. Compra simples: recalcula pela data.
            invoiceMonth: isInstallment && editing.cardId === card.id ? editing.invoiceMonth : invoiceMonthFor(f.date, card),
            ...(isInstallment ? { description: editing.description.replace(/ \(\d+\/\d+\)$/, '') === description ? editing.description : description } : {}) }
        : { ...base, paymentMethod: f.paymentMethod, accountId: f.source.slice(4), cardId: null, invoiceMonth: null };
      ok = await update('transactions', editing.id, patch);
    } else if (card) {
      ok = !!(await insert('transactions', cardPurchase({ description, amount: f.amount, category: f.category, date: f.date, card, installments: f.installments, group: newId() }).map((p) => ({ ...p, vehicleId: base.vehicleId }))));
    } else {
      ok = !!(await insert('transactions', { ...base, paymentMethod: f.paymentMethod, accountId: f.source.slice(4) }));
    }
    setBusy(false);
    if (ok) {
      toast(editing ? 'Lançamento atualizado' : card && f.installments > 1 ? `Compra de ${formatBRL(f.amount)} em ${f.installments}x lançada` : `${f.type === 'income' ? 'Receita' : 'Despesa'} de ${formatBRL(f.amount)} lançada`);
      onClose();
    }
  };

  const sourceOptions = [
    ...accounts.map((a) => ({ id: `acc:${a.id}`, name: a.name, color: a.color, icon: a.kind === 'carteira' ? Wallet : Landmark })),
    ...(f.type === 'expense' ? cards.map((c) => ({ id: `card:${c.id}`, name: c.name, color: c.color, icon: CreditCard })) : []),
  ];

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Editar lançamento' : 'Novo lançamento'}
      footer={<Button className="w-full" disabled={busy} onClick={save}>{busy ? 'Salvando…' : 'Salvar'}</Button>}>
      <form className="space-y-4" noValidate onSubmit={(e) => { e.preventDefault(); save(); }}>
        {!editing && (
          <Field label="Lançamento rápido" hint='Ex.: "gastei 35 almoço no pix", "recebi 1200 salário", "abasteci 150 ontem"'>
            <div className="relative">
              <Sparkles size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
              <Input className="pl-9" value={quick} placeholder="Escreva como falaria…" onChange={(e) => { setQuick(e.target.value); applyQuick(e.target.value); }} />
            </div>
          </Field>
        )}
        <Segmented value={f.type} onChange={(t) => setF((x) => ({ ...x, type: t, category: t === 'expense' ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0], source: t === 'income' && x.source.startsWith('card:') ? defaultSource : x.source }))}
          options={[{ value: 'expense', label: 'Despesa' }, { value: 'income', label: 'Receita' }]} />
        <Field label={card && f.installments > 1 && !editing ? 'Valor total da compra' : 'Valor'} error={errors.amount}
          hint={card && f.installments > 1 && !editing && f.amount > 0 ? `${f.installments}x de ${formatBRL(f.amount / f.installments)}` : undefined}>
          <MoneyInput value={f.amount} onChange={(v) => set('amount', v)} className="text-lg font-semibold" />
        </Field>
        <Field label="Descrição" error={errors.description}><Input value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Ex.: Mercado do mês" maxLength={120} /></Field>
        <Field label={f.type === 'income' ? 'Entrou em' : 'Pagou com'} group error={errors.source}>
          <div className="flex flex-wrap gap-2">
            {sourceOptions.map((o) => {
              const on = f.source === o.id;
              return (
                <button key={o.id} type="button" aria-pressed={on} onClick={() => set('source', o.id)}
                  className={cx('press flex items-center gap-2 rounded-full py-2 pl-2.5 pr-3.5 text-sm font-bold ring-1 transition', on ? 'text-white' : 'text-slate-400 ring-white/10 hover:text-white')}
                  style={on ? { background: `color-mix(in srgb, ${o.color} 22%, transparent)`, boxShadow: `0 0 0 2px ${o.color}` } : undefined}>
                  <o.icon size={15} style={{ color: o.color }} /> {o.name}
                </button>
              );
            })}
          </div>
        </Field>
        {card ? (
          <div className="grid grid-cols-2 items-start gap-3">
            {!editing ? (
              <Field label="Parcelas" error={errors.installments}><NumberInput value={f.installments} onChange={(v) => set('installments', Math.round(v) || 1)} suffix="x" /></Field>
            ) : (
              <p className="label self-center text-slate-500">{isInstallment ? `Parcela ${editing.installmentIndex}/${editing.installmentCount} — a edição vale só para ela` : 'Compra no cartão'}</p>
            )}
            <Field label="Categoria"><Select value={cats.includes(f.category) ? f.category : 'Outros'} onChange={(e) => set('category', e.target.value)} options={cats} /></Field>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria"><Select value={cats.includes(f.category) ? f.category : 'Outros'} onChange={(e) => set('category', e.target.value)} options={cats} /></Field>
            <Field label="Forma"><Select value={f.paymentMethod} onChange={(e) => set('paymentMethod', e.target.value)} options={PAYMENT_METHODS.filter((m) => m !== 'Crédito')} /></Field>
          </div>
        )}
        <Field label={card ? 'Data da compra' : 'Data'} error={errors.date} hint={invoiceHint ?? undefined}><Input type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></Field>
        {showVehicle && (
          <Field label="Veículo (opcional)">
            <Select value={f.vehicleId} onChange={(e) => set('vehicleId', e.target.value)} options={[{ value: '', label: '—' }, ...vehicles.map((v) => ({ value: v.id, label: [v.name, v.plate].filter(Boolean).join(' · ') }))]} />
          </Field>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
