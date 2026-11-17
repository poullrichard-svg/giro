import { useMemo, useState, useEffect } from 'react';
import { ArrowDownCircle, ArrowUpCircle, CalendarClock, CheckCircle2, Pencil, Plus, Repeat } from 'lucide-react';
import { useData } from '../data/DataProvider';
import { useToast } from '../data/toast';
import { AddCard, Button, Card, Check, ConfirmDelete, Empty, Field, IconButton, Input, Modal, MoneyInput, PageHeader, PeriodNav, Progress, Row, Segmented, Select, Stat } from '../components/ui';
import { hasErrors, rules, validate, type Errors } from '../lib/validate';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../lib/categories';
import { addMonths, currentMonth, formatBRL, localISODate, monthLabel } from '../lib/format';
import type { FixedBill, TxType } from '../types';

const blank = (): Omit<FixedBill, 'id'> => ({ description: '', amount: 0, type: 'expense', category: 'Moradia', dueDay: 10 });

export default function FixedBills() {
  const { data, insert, update, remove } = useData();
  const toast = useToast();
  const [month, setMonth] = useState(currentMonth());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FixedBill | null>(null);
  const [f, setF] = useState(blank());
  const [errors, setErrors] = useState<Errors<'description' | 'amount' | 'dueDay'>>({});
  // Some com o erro assim que a pessoa mexe no formulário; volta a validar ao salvar.
  useEffect(() => { setErrors({}); }, [f]);

  const paidMap = useMemo(() => new Map(data.fixedPayments.filter((p) => p.month === month).map((p) => [p.fixedId, p])), [data.fixedPayments, month]);
  const sorted = useMemo(() => [...data.fixed].sort((a, b) => (a.dueDay ?? 99) - (b.dueDay ?? 99)), [data.fixed]);
  const expenses = sorted.filter((x) => x.type === 'expense');
  const incomes = sorted.filter((x) => x.type === 'income');
  const totalExp = expenses.reduce((s, x) => s + x.amount, 0);
  const paidExp = expenses.filter((x) => paidMap.has(x.id)).reduce((s, x) => s + x.amount, 0);
  const totalInc = incomes.reduce((s, x) => s + x.amount, 0);
  const today = localISODate();

  const openForm = (bill?: FixedBill, type?: TxType) => {
    setEditing(bill ?? null);
    setF(bill ? { description: bill.description, amount: bill.amount, type: bill.type, category: bill.category, dueDay: bill.dueDay ?? null } : { ...blank(), type: type ?? 'expense', category: type === 'income' ? 'Salário' : 'Moradia' });
    setErrors({});
    setOpen(true);
  };

  const save = async () => {
    const e = validate({
      description: [rules.required(f.description, 'Descrição'), rules.maxLength(f.description, 60, 'Descrição')],
      amount: [rules.positive(f.amount, 'Valor'), rules.max(f.amount, 1_000_000, 'Valor')],
      dueDay: [f.dueDay != null && rules.dayOfMonth(f.dueDay, 'Dia do vencimento')],
    });
    setErrors(e);
    if (hasErrors(e)) return;
    const payload = { ...f, description: f.description.trim() };
    const ok = editing ? await update('fixed', editing.id, payload) : !!(await insert('fixed', payload));
    if (ok) { setOpen(false); toast('Conta fixa salva'); }
  };

  const togglePaid = async (bill: FixedBill) => {
    const p = paidMap.get(bill.id);
    if (p) await remove('fixedPayments', p.id);
    else await insert('fixedPayments', { fixedId: bill.id, month, amount: bill.amount });
  };

  const BillRow = ({ b }: { b: FixedBill }) => {
    const paid = paidMap.has(b.id);
    const late = !paid && b.type === 'expense' && month === today.slice(0, 7) && b.dueDay && b.dueDay < Number(today.slice(8));
    return (
      <Row muted={paid} leading={<Check checked={paid} onChange={() => togglePaid(b)} label={paid ? 'Desmarcar pago' : 'Marcar como pago'} />}
        title={b.description}
        subtitle={<span className={late ? 'text-rose-400' : undefined}>{b.category}{b.dueDay ? ` · dia ${b.dueDay}` : ''}{late ? ' · atrasada' : paid ? ' · pago' : ''}</span>}
        amount={formatBRL(b.amount)} amountTone={b.type === 'income' ? 'good' : 'bad'} onClick={() => openForm(b)}
        actions={<>
          <IconButton label="Editar" className="hidden md:inline-flex" onClick={() => openForm(b)}><Pencil size={15} /></IconButton>
          <ConfirmDelete onConfirm={() => remove('fixed', b.id)} />
        </>} />
    );
  };


  return (
    <div>
      <PageHeader eyebrow="Todo mês" title="Contas fixas" subtitle="Se repetem todo mês — marque quando pagar" actions={
        <>
          <PeriodNav label={monthLabel(month)} onPrev={() => setMonth(addMonths(month, -1))} onNext={() => setMonth(addMonths(month, 1))} onToday={() => setMonth(currentMonth())} />
          <Button onClick={() => openForm()}><Plus size={16} /> Nova</Button>
        </>
      } />
      <div className="stagger mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Stat label="Despesas fixas" money={totalExp} tone="bad" icon={<ArrowDownCircle />} />
        <Stat label="Receitas fixas" money={totalInc} tone="good" icon={<ArrowUpCircle />} />
        <Stat label="Já pago" money={paidExp} tone="info" icon={<CheckCircle2 />} sub={`${expenses.filter((x) => paidMap.has(x.id)).length}/${expenses.length} contas`} />
        <Stat label="Falta pagar" money={totalExp - paidExp} tone="warn" icon={<CalendarClock />} />
      </div>
      {totalExp > 0 && <div className="mb-6"><Progress value={(paidExp / totalExp) * 100} /></div>}

      {sorted.length === 0 ? (
        <Card><Empty icon={<Repeat size={28} />} title="Nenhuma conta fixa" text="Cadastre aluguel, luz, internet, salário… e o app soma no saldo de todo mês." action={<Button onClick={() => openForm()}>Cadastrar conta</Button>} /></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title={<><ArrowDownCircle size={14} className="text-rose-400" /> Despesas</>} action={<IconButton label="Nova despesa fixa" onClick={() => openForm(undefined, 'expense')}><Plus size={16} /></IconButton>}>
            {expenses.length ? <ul className="stagger space-y-2.5">{expenses.map((b) => <BillRow key={b.id} b={b} />)}</ul> : <AddCard label="Nova despesa fixa" onClick={() => openForm(undefined, 'expense')} className="w-full" />}
          </Card>
          <Card title={<><ArrowUpCircle size={14} className="text-emerald-400" /> Receitas</>} action={<IconButton label="Nova receita fixa" onClick={() => openForm(undefined, 'income')}><Plus size={16} /></IconButton>}>
            {incomes.length ? <ul className="stagger space-y-2.5">{incomes.map((b) => <BillRow key={b.id} b={b} />)}</ul> : <AddCard label="Nova receita fixa" onClick={() => openForm(undefined, 'income')} className="w-full" />}
          </Card>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Editar conta fixa' : 'Nova conta fixa'} footer={<Button className="w-full" onClick={save}>Salvar</Button>}>
        <div className="space-y-4">
          <Segmented value={f.type} onChange={(t) => setF({ ...f, type: t, category: t === 'income' ? 'Salário' : 'Moradia' })} options={[{ value: 'expense', label: 'Despesa' }, { value: 'income', label: 'Receita' }]} />
          <Field label="Descrição" error={errors.description}><Input maxLength={60} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Ex.: Aluguel, Internet, Salário" autoFocus /></Field>
          <Field label="Valor mensal" error={errors.amount}><MoneyInput value={f.amount} onChange={(v) => setF({ ...f, amount: v })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} options={f.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES} /></Field>
            <Field label="Dia do vencimento" error={errors.dueDay}><Input type="number" inputMode="numeric" min={1} max={31} value={f.dueDay ?? ''} onChange={(e) => setF({ ...f, dueDay: e.target.value ? Number(e.target.value) : null })} /></Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}
