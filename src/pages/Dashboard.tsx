import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, Bell, Car, Sparkles, Wallet } from 'lucide-react';
import { useData } from '../data/DataProvider';
import { useQuickAdd } from '../components/Shell';
import { Card, Empty, Input, PeriodNav, Stat, cx } from '../components/ui';
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-slate-500">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="text-xl font-bold text-white md:text-2xl">Visão geral</h1>
        </div>
        <PeriodNav label={monthLabel(month)} onPrev={() => setMonth(addMonths(month, -1))} onNext={() => setMonth(addMonths(month, 1))} onToday={() => setMonth(currentMonth())} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); quickAdd({ text: quick }); setQuick(''); }} className="relative">
        <Sparkles size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-400" />
        <Input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder='Lançar rápido: "gastei 45 mercado no débito"' className="min-h-13 rounded-2xl pl-11" />
      </form>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Saldo do mês" value={formatBRL(totals.balance)} tone={totals.balance >= 0 ? 'good' : 'bad'} icon={<Wallet size={16} />} sub="Receitas − despesas (inclui fixas)" />
        <Stat label="Receitas" value={formatBRL(totals.income)} tone="good" icon={<ArrowUpCircle size={16} className="text-emerald-400" />} sub={`Fixas ${formatBRL(totals.fixIncome)}`} />
        <Stat label="Despesas" value={formatBRL(totals.expense)} tone="bad" icon={<ArrowDownCircle size={16} className="text-rose-400" />} sub={`Fixas ${formatBRL(totals.fixExpense)}`} />
        <Stat label="Motorista (lucro)" value={formatBRL(driver.netProfit)} tone={driver.netProfit >= 0 ? 'good' : 'bad'} icon={<Car size={16} />} sub={`${formatBRL(driver.gross)} bruto · ${driver.daysWorked} ${driver.daysWorked === 1 ? "dia" : "dias"}`} />
      </div>

      {isCurrent && alerts.length > 0 && (
        <Card title={<span className="flex items-center gap-2"><Bell size={16} className="text-amber-400" /> Atenção</span>}>
          <ul className="divide-y divide-white/5">
            {alerts.slice(0, 6).map((a) => (
              <li key={a.id}>
                <a href={a.href} className="flex items-center gap-3 py-2.5">
                  <AlertTriangle size={16} className={cx(a.severity === 'danger' ? 'text-rose-400' : a.severity === 'warn' ? 'text-amber-400' : 'text-sky-400')} />
                  <span className="flex-1 truncate text-sm text-slate-200">{a.title}</span>
                  <span className="text-xs text-slate-400">{a.detail}</span>
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Para onde foi o dinheiro"><Donut data={cats} /></Card>
        <Card title="Últimos 6 meses">
          <Bars data={series.map((s) => ({ label: shortMonthLabel(s.month), values: [s.income, s.expense] }))} series={[{ name: 'Receitas', color: '#10b981' }, { name: 'Despesas', color: '#f43f5e' }]} />
        </Card>
      </div>

      <Card title="Últimos lançamentos" action={<a href="#/lancamentos" className="text-xs text-brand-400">Ver todos</a>}>
        {recent.length === 0 ? (
          <Empty title="Nada lançado ainda" text="Use o botão + ou o campo de lançamento rápido acima." />
        ) : (
          <ul className="divide-y divide-white/5">
            {recent.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2.5">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colorFor(t.category) }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-200">{t.description}</p>
                  <p className="text-xs text-slate-500">{t.category} · {t.date === localISODate() ? 'Hoje' : formatDate(t.date)}</p>
                </div>
                <span className={cx('text-sm font-semibold', t.type === 'income' ? 'text-emerald-400' : 'text-rose-400')}>{t.type === 'income' ? '+' : '−'} {formatBRL(t.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
