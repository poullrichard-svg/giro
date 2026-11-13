import { useMemo, useState } from 'react';
import { Download, Pencil, Search } from 'lucide-react';
import { useData } from '../data/DataProvider';
import { useQuickAdd } from '../components/Shell';
import { Button, Card, ConfirmDelete, Empty, IconButton, Input, PageHeader, PeriodNav, Segmented, Select, Stat, cx } from '../components/ui';
import { colorFor } from '../lib/categories';
import { addMonths, currentMonth, formatBRL, formatDayLabel, monthLabel } from '../lib/format';
import type { Transaction } from '../types';
import { downloadCSV } from '../lib/csv';

export default function Transactions() {
  const { data, remove } = useData();
  const quickAdd = useQuickAdd();
  const [month, setMonth] = useState(currentMonth());
  const [type, setType] = useState<'all' | 'income' | 'expense'>('all');
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');

  const list = useMemo(() => data.transactions.filter((t) =>
    t.date?.startsWith(month) && (type === 'all' || t.type === type) && (!cat || t.category === cat) &&
    (!q || `${t.description} ${t.category} ${t.paymentMethod}`.toLowerCase().includes(q.toLowerCase())),
  ).sort((a, b) => b.date.localeCompare(a.date)), [data.transactions, month, type, cat, q]);

  const groups = useMemo(() => {
    const m = new Map<string, Transaction[]>();
    for (const t of list) m.set(t.date, [...(m.get(t.date) ?? []), t]);
    return [...m.entries()];
  }, [list]);

  const cats = useMemo(() => [...new Set(data.transactions.filter((t) => t.date?.startsWith(month)).map((t) => t.category))].sort(), [data.transactions, month]);
  const inc = list.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const exp = list.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  return (
    <div>
      <PageHeader title="Lançamentos" subtitle="Entradas e saídas do dia a dia" actions={
        <>
          <PeriodNav label={monthLabel(month)} onPrev={() => setMonth(addMonths(month, -1))} onNext={() => setMonth(addMonths(month, 1))} onToday={() => setMonth(currentMonth())} />
          <Button variant="soft" onClick={() => downloadCSV(`lancamentos-${month}.csv`, list.map((t) => ({ Data: t.date, Tipo: t.type === 'income' ? 'Receita' : 'Despesa', Descrição: t.description, Categoria: t.category, Pagamento: t.paymentMethod, Valor: t.amount })))}><Download size={16} /> CSV</Button>
        </>
      } />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="Entradas" value={formatBRL(inc)} tone="good" />
        <Stat label="Saídas" value={formatBRL(exp)} tone="bad" />
        <Stat label="Resultado" value={formatBRL(inc - exp)} tone={inc - exp >= 0 ? 'good' : 'bad'} sub="sem contas fixas" />
      </div>

      <div className="mb-4 grid gap-2 md:grid-cols-[1fr_auto_200px]">
        <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><Input className="pl-9" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Segmented value={type} onChange={setType} options={[{ value: 'all', label: 'Todos' }, { value: 'income', label: 'Entradas' }, { value: 'expense', label: 'Saídas' }]} />
        <Select value={cat} onChange={(e) => setCat(e.target.value)} options={[{ value: '', label: 'Todas as categorias' }, ...cats]} />
      </div>

      {groups.length === 0 ? (
        <Card><Empty title="Nenhum lançamento" text="Nada encontrado para esse mês/filtro." action={<Button onClick={() => quickAdd()}>Novo lançamento</Button>} /></Card>
      ) : (
        <div className="space-y-3">
          {groups.map(([date, items]) => {
            const dayTotal = items.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);
            return (
              <Card key={date} className="p-0 md:p-0">
                <div className="flex items-center justify-between border-b border-white/5 px-4 py-2.5 text-xs">
                  <span className="font-semibold capitalize text-slate-300">{formatDayLabel(date)}</span>
                  <span className={dayTotal >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{formatBRL(dayTotal)}</span>
                </div>
                <ul className="divide-y divide-white/5">
                  {items.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 px-4 py-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colorFor(t.category) }} />
                      <button className="min-w-0 flex-1 text-left" onClick={() => quickAdd({ editing: t })}>
                        <p className="truncate text-sm text-slate-200">{t.description}</p>
                        <p className="text-xs text-slate-500">{t.category} · {t.paymentMethod}</p>
                      </button>
                      <span className={cx('whitespace-nowrap text-sm font-semibold', t.type === 'income' ? 'text-emerald-400' : 'text-rose-400')}>{t.type === 'income' ? '+' : '−'} {formatBRL(t.amount)}</span>
                      <IconButton label="Editar" className="hidden md:inline-flex" onClick={() => quickAdd({ editing: t })}><Pencil size={16} /></IconButton>
                      <ConfirmDelete onConfirm={() => remove('transactions', t.id)} />
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
