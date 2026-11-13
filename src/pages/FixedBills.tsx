import { useMemo, useState } from 'react';
import { CheckCircle2, Circle, Pencil, Plus, Repeat } from 'lucide-react';
import { useData } from '../data/DataProvider';
import { useToast } from '../data/toast';
import { Button, Card, ConfirmDelete, Empty, Field, IconButton, Input, Modal, MoneyInput, PageHeader, PeriodNav, Progress, Segmented, Select, Stat, cx } from '../components/ui';
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
    setOpen(true);
  };

  const save = async () => {
    if (!f.description.trim() || f.amount <= 0) { toast('Preencha descrição e valor', 'error'); return; }
    const payload = { ...f, dueDay: f.dueDay ? Math.min(31, Math.max(1, f.dueDay)) : null };
    const ok = editing ? await update('fixed', editing.id, payload) : !!(await insert('fixed', payload));
    if (ok) { setOpen(false); toast('Conta fixa salva'); }
  };

  const togglePaid = async (bill: FixedBill) => {
    const p = paidMap.get(bill.id);
    if (p) await remove('fixedPayments', p.id);
    else await insert('fixedPayments', { fixedId: bill.id, month, amount: bill.amount });
  };

  const Row = ({ b }: { b: FixedBill }) => {
    const paid = paidMap.has(b.id);
    const late = !paid && b.type === 'expense' && month === today.slice(0, 7) && b.dueDay && b.dueDay < Number(today.slice(8));
    return (
      <li className="flex items-center gap-3 px-4 py-2.5">
        {(
          <button onClick={() => togglePaid(b)} aria-label={paid ? 'Desmarcar pago' : 'Marcar como pago'} className={paid ? 'text-emerald-400' : 'text-slate-600 hover:text-slate-300'}>
            {paid ? <CheckCircle2 size={22} /> : <Circle size={22} />}
          </button>
        )}
        <button className="min-w-0 flex-1 text-left" onClick={() => openForm(b)}>
          <p className={cx('truncate text-sm', paid ? 'text-slate-500 line-through' : 'text-slate-200')}>{b.description}</p>
          <p className={cx('text-xs', late ? 'text-rose-400' : 'text-slate-500')}>{b.category}{b.dueDay ? ` · dia ${b.dueDay}` : ''}{late ? ' · atrasada' : ''}</p>
        </button>
        <span className={cx('text-sm font-semibold', b.type === 'income' ? 'text-emerald-400' : 'text-rose-400')}>{formatBRL(b.amount)}</span>
        <IconButton label="Editar" className="hidden md:inline-flex" onClick={() => openForm(b)}><Pencil size={16} /></IconButton>
        <ConfirmDelete onConfirm={() => remove('fixed', b.id)} />
      </li>
    );
  };

  return (
    <div>
      <PageHeader title="Contas fixas" subtitle="Se repetem todo mês — marque quando pagar" actions={
        <>
          <PeriodNav label={monthLabel(month)} onPrev={() => setMonth(addMonths(month, -1))} onNext={() => setMonth(addMonths(month, 1))} onToday={() => setMonth(currentMonth())} />
          <Button onClick={() => openForm()}><Plus size={16} /> Nova</Button>
        </>
      } />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Despesas fixas" value={formatBRL(totalExp)} tone="bad" />
        <Stat label="Receitas fixas" value={formatBRL(totalInc)} tone="good" />
        <Stat label="Já pago" value={formatBRL(paidExp)} sub={`${expenses.filter((x) => paidMap.has(x.id)).length}/${expenses.length} contas`} />
        <Stat label="Falta pagar" value={formatBRL(totalExp - paidExp)} tone="warn" />
      </div>
      {totalExp > 0 && <div className="mb-4"><Progress value={(paidExp / totalExp) * 100} /></div>}

      {sorted.length === 0 ? (
        <Card><Empty icon={<Repeat size={32} />} title="Nenhuma conta fixa" text="Cadastre aluguel, luz, internet, salário… e o app soma no saldo de todo mês." action={<Button onClick={() => openForm()}>Cadastrar conta</Button>} /></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Despesas" className="p-0 md:p-0 [&>header]:px-4 [&>header]:pt-4" action={<Button variant="ghost" onClick={() => openForm(undefined, 'expense')}><Plus size={14} /></Button>}>
            {expenses.length ? <ul className="divide-y divide-white/5">{expenses.map((b) => <Row key={b.id} b={b} />)}</ul> : <Empty title="Sem despesas fixas" />}
          </Card>
          <Card title="Receitas" className="p-0 md:p-0 [&>header]:px-4 [&>header]:pt-4" action={<Button variant="ghost" onClick={() => openForm(undefined, 'income')}><Plus size={14} /></Button>}>
            {incomes.length ? <ul className="divide-y divide-white/5">{incomes.map((b) => <Row key={b.id} b={b} />)}</ul> : <Empty title="Sem receitas fixas" />}
          </Card>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Editar conta fixa' : 'Nova conta fixa'} footer={<Button className="w-full" onClick={save}>Salvar</Button>}>
        <div className="space-y-4">
          <Segmented value={f.type} onChange={(t) => setF({ ...f, type: t, category: t === 'income' ? 'Salário' : 'Moradia' })} options={[{ value: 'expense', label: 'Despesa' }, { value: 'income', label: 'Receita' }]} />
          <Field label="Descrição"><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Ex.: Aluguel, Internet, Salário" autoFocus /></Field>
          <Field label="Valor mensal"><MoneyInput value={f.amount} onChange={(v) => setF({ ...f, amount: v })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} options={f.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES} /></Field>
            <Field label="Dia do vencimento"><Input type="number" inputMode="numeric" min={1} max={31} value={f.dueDay ?? ''} onChange={(e) => setF({ ...f, dueDay: e.target.value ? Number(e.target.value) : null })} /></Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}
