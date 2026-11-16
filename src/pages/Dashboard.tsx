import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowDownCircle, ArrowUp, ArrowUpCircle, BarChart3, Bell, Car, CalendarClock, PieChart, Sparkles, Wallet } from 'lucide-react';
import { useData } from '../data/DataProvider';
import { useQuickAdd } from '../components/Shell';
import { Card, Empty, Money, PeriodNav, Row, Stat, Tilt } from '../components/ui';
import { Bars, Donut } from '../components/charts';
import { colorFor } from '../lib/categories';
import { CategoryBadge } from '../components/CategoryBadge';
import { addMonths, currentMonth, elapsedDays, formatBRL, formatDate, localISODate, monthLabel, shortMonthLabel } from '../lib/format';
import { categoryBreakdown, driverStats, fixedBillAlerts, lastMonthsSeries, monthTotals, vehicleAlerts } from '../lib/stats';

export default function Dashboard() {
  const { data } = useData();
  const quickAdd = useQuickAdd();
  const [month, setMonth] = useState(currentMonth());
  const [quick, setQuick] = useState('');

  const totals = useMemo(() => monthTotals(data.transactions, data.fixed, month), [data.transactions, data.fixed, month]);
  const cats = useMemo(() => categoryBreakdown(data.transactions, data.fixed, month).map((c, i) => ({ ...c, color: colorFor(c.label, i) })), [data.transactions, data.fixed, month]);
  const series = useMemo(() => lastMonthsSeries(data.transactions, data.fixed, month), [data.transactions, data.fixed, month]);
  const alerts = useMemo(() => [...fixedBillAlerts(data.fixed, data.fixedPayments), ...vehicleAlerts(data.vehicles)].sort((a, b) => (a.days ?? 0) - (b.days ?? 0)), [data.fixed, data.fixedPayments, data.vehicles]);
  const driver = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    const last = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
    return driverStats(data.sessions, data.vehicleExpenses, data.vehicles, (d) => d.startsWith(month), elapsedDays(`${month}-01`, last));
  }, [data.sessions, data.vehicleExpenses, data.vehicles, month]);
  const recent = data.transactions.slice(0, 6);
  const isCurrent = month === currentMonth();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const today = (() => { const s = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }); return s.charAt(0).toUpperCase() + s.slice(1); })();
  const spentPct = totals.income > 0 ? Math.min(100, (totals.expense / totals.income) * 100) : totals.expense > 0 ? 100 : 0;
  const unpaid = useMemo(() => {
    const paid = new Set(data.fixedPayments.filter((p) => p.month === month).map((p) => p.fixedId));
    const list = data.fixed.filter((f) => f.type === 'expense' && !paid.has(f.id));
    return { total: list.reduce((s, f) => s + f.amount, 0), count: list.length };
  }, [data.fixed, data.fixedPayments, month]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="label text-brand-300">{today}</p>
          <h1 className="mt-1.5 font-display text-3xl font-black tracking-tight text-white md:text-4xl">{greeting}! <span className="inline-block origin-[70%_70%] animate-[wave_2.4s_ease-in-out_1]">👋</span></h1>
        </div>
        <PeriodNav label={monthLabel(month)} onPrev={() => setMonth(addMonths(month, -1))} onNext={() => setMonth(addMonths(month, 1))} onToday={() => setMonth(currentMonth())} />
      </div>

      {/* Cartão principal 3D com borda luminosa */}
      <Tilt max={5} className="solid ring-glow shine rounded-[2.25rem] p-6 md:p-8" style={{ '--tone': '#16a34a' } as React.CSSProperties}>
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-lime-300/30 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-sky-400/25 blur-3xl" />
        <span className="watermark !opacity-[.13] text-white"><Wallet size={190} strokeWidth={1.4} /></span>
        <div className="relative grid gap-6 md:grid-cols-[1.2fr_1fr] md:items-end">
          <div className="pop">
            <p className="label text-white/75">Saldo de {monthLabel(month).split(' ')[0].toLowerCase()}</p>
            <Money value={totals.balance} className="mt-2 block font-display text-[2.6rem] font-black leading-none tracking-tight drop-shadow-[0_6px_18px_rgba(0,0,0,.3)] md:text-6xl" />
            <div className="mt-5 max-w-sm">
              <div className="label mb-2 flex justify-between text-white/75"><span>Gasto do que entrou</span><span>{spentPct.toFixed(0)}%</span></div>
              <div className="h-2.5 overflow-hidden rounded-full bg-black/25"><div className="fill-x h-full rounded-full bg-white shadow-[0_0_14px_white]" style={{ width: `${spentPct}%` }} /></div>
            </div>
          </div>
          <div className="pop-sm grid grid-cols-2 gap-3">
            <div className="rounded-[1.4rem] bg-white/15 p-4 ring-1 ring-white/25">
              <p className="label flex items-center gap-1.5 text-white/80"><ArrowUp size={13} strokeWidth={3} /> Entrou</p>
              <Money value={totals.income} className="mt-1.5 block font-display text-xl font-black" />
            </div>
            <div className="rounded-[1.4rem] bg-black/15 p-4 ring-1 ring-white/20">
              <p className="label flex items-center gap-1.5 text-white/80"><ArrowDown size={13} strokeWidth={3} /> Saiu</p>
              <Money value={totals.expense} className="mt-1.5 block font-display text-xl font-black" />
            </div>
          </div>
        </div>
      </Tilt>

      <div className="stagger grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <Stat label="Entradas" money={totals.income} tone="good" icon={<ArrowUpCircle />} sub={`fixas ${formatBRL(totals.fixIncome)}`} />
        <Stat label="Saídas" money={totals.expense} tone="bad" icon={<ArrowDownCircle />} sub={`fixas ${formatBRL(totals.fixExpense)}`} />
        <Stat label="Contas a pagar" money={unpaid.total} tone="warn" icon={<CalendarClock />} sub={`${unpaid.count} ${unpaid.count === 1 ? 'conta pendente' : 'contas pendentes'}`} />
        <Stat label="Lucro motorista" money={driver.netProfit} tone={driver.netProfit >= 0 ? 'info' : 'bad'} icon={<Car />} sub={`${formatBRL(driver.gross)} bruto · ${driver.daysWorked} ${driver.daysWorked === 1 ? 'dia' : 'dias'}`} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); quickAdd({ text: quick }); setQuick(''); }} className="surface group flex items-center gap-3 rounded-[1.75rem] p-2 pl-5 transition duration-300 focus-within:border-brand-400/50 focus-within:ring-4 focus-within:ring-brand-500/15">
        <Sparkles size={20} className="shrink-0 text-brand-300 transition duration-500 group-focus-within:rotate-[20deg] group-focus-within:scale-125" />
        <input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder='Lançar rápido: "gastei 45 mercado no débito"' className="min-h-12 min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:font-medium placeholder:text-slate-500" />
        <button type="submit" className="press btn-shine rounded-[1.2rem] bg-gradient-to-br from-brand-500 to-brand-700 px-5 py-3.5 text-[11px] font-extrabold uppercase tracking-[.1em] text-white shadow-[0_8px_24px_-8px] shadow-brand-500">Lançar</button>
      </form>

      {isCurrent && alerts.length > 0 && (
        <Card title={<><Bell size={14} className="text-amber-400" /> Atenção</>}>
          <ul className="stagger-x space-y-2.5">
            {alerts.slice(0, 6).map((a) => (
              <Row key={a.id} tone={a.severity === 'danger' ? 'bad' : a.severity === 'warn' ? 'warn' : 'info'} icon={<AlertTriangle size={18} />}
                title={a.title} subtitle={a.detail} onClick={() => { if (a.href) window.location.hash = a.href.replace('#', ''); }} />
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={<><PieChart size={14} className="text-rose-400" /> Categorias</>}><Donut data={cats} /></Card>
        <Card title={<><BarChart3 size={14} className="text-sky-400" /> Histórico de 6 meses</>}>
          <Bars data={series.map((s) => ({ label: shortMonthLabel(s.month), values: [s.income, s.expense] }))} series={[{ name: 'Receitas', color: '#34d399', to: '#047857' }, { name: 'Despesas', color: '#fb7185', to: '#be123c' }]} />
        </Card>
      </div>

      <Card title="Últimos lançamentos" action={<a href="#/lancamentos" className="label press rounded-full bg-white/[.05] px-3.5 py-2 text-brand-300 ring-1 ring-white/10 hover:bg-white/10">Ver todos →</a>}>
        {recent.length === 0 ? (
          <Empty icon={<Sparkles size={28} />} title="Nada lançado ainda" text='Toque no + ou escreva no campo acima, tipo "recebi 1200 salário".' />
        ) : (
          <ul className="stagger space-y-2.5">
            {recent.map((t) => (
              <Row key={t.id} leading={<CategoryBadge category={t.category} />} title={t.description}
                subtitle={`${t.category} · ${t.date === localISODate() ? 'Hoje' : formatDate(t.date)}`}
                amount={`${t.type === 'income' ? '+' : '−'} ${formatBRL(t.amount)}`} amountTone={t.type === 'income' ? 'good' : 'bad'}
                onClick={() => quickAdd({ editing: t })} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
