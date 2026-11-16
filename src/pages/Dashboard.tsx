import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, BarChart3, Bell, Car, PieChart, Repeat, Sparkles, Wallet } from 'lucide-react';
import { useData } from '../data/DataProvider';
import { useQuickAdd } from '../components/Shell';
import { Card, Empty, IconChip, Money, PeriodNav, Stat, Tilt, cx } from '../components/ui';
import { Bars, Donut } from '../components/charts';
import { colorFor } from '../lib/categories';
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
  const spentPct = totals.income > 0 ? Math.min(100, (totals.expense / totals.income) * 100) : totals.expense > 0 ? 100 : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-slate-400">{(() => { const s = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }); return s.charAt(0).toUpperCase() + s.slice(1); })()}</p>
          <h1 className="text-gradient text-2xl font-extrabold tracking-tight md:text-3xl">{greeting}! 👋</h1>
        </div>
        <PeriodNav label={monthLabel(month)} onPrev={() => setMonth(addMonths(month, -1))} onNext={() => setMonth(addMonths(month, 1))} onToday={() => setMonth(currentMonth())} />
      </div>

      <div className="stagger grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        {/* Cartão de saldo 3D */}
        <Tilt max={6} className="hero-card relative rounded-[2rem] p-6 text-white md:p-7">
          <div className="pop relative z-10 flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-white/80">Saldo de {monthLabel(month).split(' ')[0].toLowerCase()}</p>
              <Money value={totals.balance} className="mt-1 block text-4xl font-extrabold tracking-tight drop-shadow-md md:text-5xl" />
            </div>
            <div className="rounded-2xl bg-white/20 p-2.5 ring-1 ring-white/30 backdrop-blur"><Wallet size={22} /></div>
          </div>
          <div className="pop relative z-10 mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-black/15 p-3 ring-1 ring-white/20 backdrop-blur">
              <p className="flex items-center gap-1.5 text-xs text-white/80"><ArrowUpCircle size={14} /> Entrou</p>
              <Money value={totals.income} className="mt-0.5 block text-lg font-bold" />
            </div>
            <div className="rounded-2xl bg-black/15 p-3 ring-1 ring-white/20 backdrop-blur">
              <p className="flex items-center gap-1.5 text-xs text-white/80"><ArrowDownCircle size={14} /> Saiu</p>
              <Money value={totals.expense} className="mt-0.5 block text-lg font-bold" />
            </div>
          </div>
          <div className="relative z-10 mt-5">
            <div className="mb-1.5 flex justify-between text-[11px] text-white/80"><span>Gasto do que entrou</span><span>{spentPct.toFixed(0)}%</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-black/20"><div className="fill-x h-full rounded-full bg-white shadow-[0_0_12px_white]" style={{ width: `${spentPct}%` }} /></div>
          </div>
        </Tilt>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
          <Stat label="Lucro como motorista" money={driver.netProfit} tone={driver.netProfit >= 0 ? 'good' : 'bad'} icon={<Car size={16} />} sub={`${formatBRL(driver.gross)} bruto · ${driver.daysWorked} ${driver.daysWorked === 1 ? 'dia' : 'dias'}`} />
          <Stat label="Contas fixas do mês" money={totals.fixExpense} tone="warn" icon={<Repeat size={16} />} sub={`receitas fixas ${formatBRL(totals.fixIncome)}`} />
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); quickAdd({ text: quick }); setQuick(''); }} className="glass group relative flex items-center gap-2 rounded-3xl p-2 pl-4 transition focus-within:ring-4 focus-within:ring-brand-500/20">
        <Sparkles size={20} className="shrink-0 text-brand-300 transition group-focus-within:rotate-12 group-focus-within:scale-110" />
        <input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder='Lançar rápido: "gastei 45 mercado no débito"' className="min-h-11 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500" />
        <button type="submit" className="press rounded-2xl bg-gradient-to-r from-brand-500 to-fuchsia-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-500/30">Lançar</button>
      </form>

      {isCurrent && alerts.length > 0 && (
        <Card title={<span className="flex items-center gap-2"><IconChip tone="warn" size="sm"><Bell size={14} /></IconChip> Atenção</span>}>
          <ul className="stagger space-y-2">
            {alerts.slice(0, 6).map((a) => (
              <li key={a.id}>
                <a href={a.href} className={cx('flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition hover:translate-x-1', a.severity === 'danger' ? 'border-rose-500/25 bg-rose-500/[.07]' : a.severity === 'warn' ? 'border-amber-500/25 bg-amber-500/[.07]' : 'border-sky-500/20 bg-sky-500/[.06]')}>
                  <AlertTriangle size={16} className={cx('shrink-0', a.severity === 'danger' ? 'text-rose-400' : a.severity === 'warn' ? 'text-amber-400' : 'text-sky-400')} />
                  <span className="flex-1 truncate text-sm font-medium text-slate-100">{a.title}</span>
                  <span className="text-xs text-slate-400">{a.detail}</span>
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={<span className="flex items-center gap-2"><IconChip size="sm" tone="bad"><PieChart size={14} /></IconChip> Para onde foi o dinheiro</span>}><Donut data={cats} /></Card>
        <Card title={<span className="flex items-center gap-2"><IconChip size="sm" tone="info"><BarChart3 size={14} /></IconChip> Últimos 6 meses</span>}>
          <Bars data={series.map((s) => ({ label: shortMonthLabel(s.month), values: [s.income, s.expense] }))} series={[{ name: 'Receitas', color: '#34d399', to: '#0d9488' }, { name: 'Despesas', color: '#fb7185', to: '#be185d' }]} />
        </Card>
      </div>

      <Card title="Últimos lançamentos" action={<a href="#/lancamentos" className="rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-brand-300 hover:bg-white/10">Ver todos →</a>}>
        {recent.length === 0 ? (
          <Empty icon={<Sparkles size={28} />} title="Nada lançado ainda" text='Toque no + ou escreva no campo acima, tipo "recebi 1200 salário".' />
        ) : (
          <ul className="stagger space-y-1.5">
            {recent.map((t) => (
              <li key={t.id} className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-white/[.04]">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${colorFor(t.category)}, ${colorFor(t.category)}88)`, boxShadow: `0 6px 16px -6px ${colorFor(t.category)}` }}>
                  {t.category.charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-100">{t.description}</p>
                  <p className="text-xs text-slate-500">{t.category} · {t.date === localISODate() ? 'Hoje' : formatDate(t.date)}</p>
                </div>
                <span className={cx('text-sm font-bold tabular-nums', t.type === 'income' ? 'text-emerald-300' : 'text-rose-300')}>{t.type === 'income' ? '+' : '−'} {formatBRL(t.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
