import { useMemo, useState } from 'react';
import { HandCoins, ChevronRight, PiggyBank as PiggyBankIcon } from 'lucide-react';
import { usePrefs } from '../data/usePrefs';
import { debtsSummary, openInstallmentsUntil } from '../lib/debts';
import { useCloud } from '../cloud/CloudProvider';
import { firstName } from '../cloud/profile';
import { AlertTriangle, ArrowDown, ArrowDownCircle, ArrowUp, ArrowUpCircle, BarChart3, Bell, Car, CalendarClock, HardDriveDownload, PieChart, Sparkles, Wallet } from 'lucide-react';
import { useData } from '../data/DataProvider';
import { useQuickAdd } from '../components/Shell';
import { useToast } from '../data/toast';
import { parseQuickEntry } from '../lib/quickParse';
import { budgetAlert } from '../lib/planning';
import { Card, Empty, Money, PeriodNav, Row, Stat, Tilt } from '../components/ui';
import { Bars, Donut } from '../components/charts';
import { colorFor } from '../lib/categories';
import { CategoryBadge } from '../components/CategoryBadge';
import { Welcome } from '../components/Welcome';
import { BudgetCard, ProjectionCard, UpcomingCard } from '../components/PlanningCards';
import { BACKUP_KEY, downloadBackup } from '../data/backup';
import { daysUntil } from '../lib/format';
import { addMonths, currentMonth, elapsedDays, formatBRL, formatDate, localISODate, monthLabel, shortMonthLabel } from '../lib/format';
import { categoryBreakdown, driverStats, lastMonthsSeries, monthTotals, vehicleAlerts } from '../lib/stats';

export default function Dashboard() {
  const { data, insert } = useData();
  const quickAdd = useQuickAdd();
  const toast = useToast();
  const [month, setMonth] = useState(currentMonth());
  const [quick, setQuick] = useState('');

  const totals = useMemo(() => monthTotals(data.transactions, data.fixed, month), [data.transactions, data.fixed, month]);
  const cats = useMemo(() => categoryBreakdown(data.transactions, data.fixed, month).map((c, i) => ({ ...c, color: colorFor(c.label, i) })), [data.transactions, data.fixed, month]);
  const series = useMemo(() => lastMonthsSeries(data.transactions, data.fixed, month), [data.transactions, data.fixed, month]);
  // Vencimentos têm cartão próprio; aqui ficam só os avisos de manutenção (troca de óleo).
  const alerts = useMemo(() => vehicleAlerts(data.vehicles).filter((a) => a.id.endsWith('-oil')), [data.vehicles]);
  const driver = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    const last = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
    return driverStats(data.sessions, data.vehicleExpenses, data.vehicles, (d) => d.startsWith(month), elapsedDays(`${month}-01`, last));
  }, [data.sessions, data.vehicleExpenses, data.vehicles, month]);
  const recent = data.transactions.slice(0, 6);
  const isCurrent = month === currentMonth();

  const isEmpty = data.transactions.length === 0 && data.fixed.length === 0 && data.sessions.length === 0 && data.debts.length === 0;
  const [backupTick, setBackupTick] = useState(0);
  const backupDays = useMemo(() => {
    void backupTick;
    if (data.transactions.length < 5) return null;
    let last: string | null = null;
    try { last = localStorage.getItem(BACKUP_KEY); } catch { /* sem storage */ }
    return last ? -daysUntil(last.slice(0, 10)) : Infinity;
  }, [data.transactions.length, backupTick]);
  const hour = new Date().getHours();
  const name = firstName(useCloud().profile);
  const { driver: driverMode } = usePrefs();
  const debtSum = debtsSummary(data.debts, localISODate());
  const goalsSaved = data.goals.filter((g) => g.type === 'financial').reduce((t, g) => t + g.currentAmount, 0);
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
          <h1 className="mt-1.5 font-display text-3xl font-black tracking-tight text-white md:text-4xl">{greeting}{name ? `, ${name}` : ''}! <span className="inline-block origin-[70%_70%] animate-[wave_2.4s_ease-in-out_1]">👋</span></h1>
        </div>
        <PeriodNav label={monthLabel(month)} onPrev={() => setMonth(addMonths(month, -1))} onNext={() => setMonth(addMonths(month, 1))} onToday={() => setMonth(currentMonth())} />
      </div>

      {isEmpty && <Welcome />}
      {!isEmpty && backupDays !== null && backupDays > 7 && (
        <div className="flex flex-wrap items-center gap-3 rounded-[1.5rem] border border-amber-500/25 bg-amber-500/[.07] p-3 pl-4">
          <HardDriveDownload size={18} className="shrink-0 text-amber-400" />
          <p className="min-w-0 flex-1 text-sm font-semibold text-amber-100">{backupDays === Infinity ? 'Você ainda não fez backup dos seus dados.' : `Faz ${backupDays} dias desde o último backup.`} <span className="font-medium text-amber-200/70">Seus dados ficam só neste aparelho.</span></p>
          <button type="button" onClick={() => { downloadBackup(data); setBackupTick((x) => x + 1); }} className="press rounded-xl bg-amber-400 px-3.5 py-2 text-[11px] font-extrabold uppercase tracking-wider text-amber-950">Fazer backup</button>
        </div>
      )}

      {!isEmpty && <>
      {/* Cartão principal 3D com borda luminosa */}
      <Tilt max={5} className="solid ring-glow shine rounded-[2.25rem] p-6 md:p-8" style={{ '--tone': '#16a34a' } as React.CSSProperties}>
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-lime-300/30 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-sky-400/25 blur-3xl" />
        <span className="watermark !opacity-[.13] text-white"><Wallet size={190} strokeWidth={1.4} /></span>
        <div className="relative grid gap-6 md:grid-cols-[1.2fr_1fr] md:items-end">
          <div className="pop">
            <p className="label text-white/75">Resultado de {monthLabel(month).split(' ')[0].toLowerCase()} <span className="normal-case tracking-normal text-white/60">· entradas − saídas</span></p>
            <Money value={totals.balance} className="mt-2 block font-display text-[2.6rem] font-black leading-none tracking-tight drop-shadow-[0_6px_18px_rgba(0,0,0,.3)] md:text-6xl" />
            <div className="mt-5 max-w-sm">
              <div className="label mb-2 flex justify-between text-white/75"><span>Gasto do que entrou</span><span>{spentPct.toFixed(0)}%</span></div>
              <div className="h-2.5 overflow-hidden rounded-full bg-black/25"><div className="fill-x h-full rounded-full bg-white shadow-[0_0_14px_white]" style={{ width: `${spentPct}%` }} /></div>
            </div>
          </div>
          <div className="pop-sm grid grid-cols-2 gap-3">
            <div className="rounded-[1.4rem] bg-emerald-950/45 p-4 ring-1 ring-emerald-200/40">
              <p className="label flex items-center gap-2 text-emerald-100">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-300 text-emerald-950 shadow-[0_0_12px] shadow-emerald-300/70"><ArrowUp size={14} strokeWidth={3.2} /></span> Entrou
              </p>
              <Money value={totals.income} className="mt-2 block font-display text-xl font-black text-white" />
            </div>
            <div className="rounded-[1.4rem] bg-rose-600/80 p-4 ring-1 ring-rose-200/50 shadow-[0_10px_24px_-10px] shadow-rose-900">
              <p className="label flex items-center gap-2 text-rose-50">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-rose-600 shadow-[0_0_12px] shadow-rose-200/70"><ArrowDown size={14} strokeWidth={3.2} /></span> Saiu
              </p>
              <Money value={totals.expense} className="mt-2 block font-display text-xl font-black text-white" />
            </div>
          </div>
        </div>
      </Tilt>

      <div className="stagger grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <Stat label="Entradas" money={totals.income} tone="good" icon={<ArrowUpCircle />} sub={`fixas ${formatBRL(totals.fixIncome)}`} />
        <Stat label="Saídas" money={totals.expense} tone="bad" icon={<ArrowDownCircle />} sub={`fixas ${formatBRL(totals.fixExpense)}`} />
        <Stat label="Contas a pagar" money={unpaid.total} tone="warn" icon={<CalendarClock />} sub={`${unpaid.count} ${unpaid.count === 1 ? 'conta pendente' : 'contas pendentes'}`} />
        {driverMode
          ? <Stat label="Lucro motorista" money={driver.netProfit} tone={driver.netProfit >= 0 ? 'info' : 'bad'} icon={<Car />} sub={`${formatBRL(driver.gross)} bruto · ${driver.daysWorked} ${driver.daysWorked === 1 ? 'dia' : 'dias'}`} />
          : debtSum.remaining > 0
            ? <Stat label="Falta quitar" money={debtSum.remaining} tone="bad" icon={<HandCoins />} sub={`dívidas · ${Math.round(debtSum.pct)}% quitado`} />
            : <Stat label="Guardado em metas" money={goalsSaved} tone="info" icon={<PiggyBankIcon />} sub={`${data.goals.length} ${data.goals.length === 1 ? 'meta' : 'metas'}`} />}
      </div>

      {isCurrent && <DebtStrip />}
      {isCurrent && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ProjectionCard today={localISODate()} />
          <UpcomingCard today={localISODate()} />
        </div>
      )}
      </>}

      <form onSubmit={async (e) => {
        e.preventDefault();
        const p = parseQuickEntry(quick);
        // Sem valor reconhecido: abre o formulário para completar.
        if (!p) { quickAdd({ text: quick }); setQuick(''); return; }
        const alert = p.type === 'expense' ? budgetAlert(data.budgets, data.transactions, data.fixed, p.category, p.date.slice(0, 7), p.amount) : null;
        const saved = await insert('transactions', { ...p, vehicleId: null });
        if (saved && alert) setTimeout(() => toast(alert.text, alert.kind), 400);
        if (saved) {
          setQuick('');
          toast(`${p.type === 'income' ? 'Receita' : 'Despesa'} de ${formatBRL(p.amount)} lançada · ${p.category}`, 'ok', { label: 'Editar', onClick: () => quickAdd({ editing: saved[0] }) });
        }
      }} className="surface group flex items-center gap-3 rounded-[1.75rem] p-2 pl-5 transition duration-300 focus-within:border-brand-400/50 focus-within:ring-4 focus-within:ring-brand-500/15">
        <Sparkles size={20} className="shrink-0 text-brand-300 transition duration-500 group-focus-within:rotate-[20deg] group-focus-within:scale-125" />
        <input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder='Lançar rápido: "gastei 45 mercado no débito"' className="min-h-12 min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:font-medium placeholder:text-slate-500" />
        <button type="submit" className="press btn-shine rounded-[1.2rem] bg-gradient-to-br from-brand-500 to-brand-700 px-5 py-3.5 text-[11px] font-extrabold uppercase tracking-[.1em] text-white shadow-[0_8px_24px_-8px] shadow-brand-500">Lançar</button>
      </form>

      {!isEmpty && <>
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

      <BudgetCard month={month} />

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
      </>}
    </div>
  );
}

/** Faixa das dívidas no Início: quanto falta e a próxima parcela. */
function DebtStrip() {
  const { data } = useData();
  const today = localISODate();
  const sum = debtsSummary(data.debts, today);
  if (!data.debts.length || sum.remaining <= 0) return null;
  const next = openInstallmentsUntil(data.debts, '9999-12-31')[0];
  return (
    <a href="#/dividas" className="surface surface-hover press mb-4 flex items-center gap-4 rounded-[1.6rem] p-4 ring-1 ring-orange-500/20">
      <span className="solid flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ '--tone': sum.overdueAmount > 0 ? '#e11d48' : '#f97316' } as React.CSSProperties}><HandCoins size={20} /></span>
      <span className="min-w-0 flex-1">
        <span className="label block text-orange-300">Dívidas · {Math.round(sum.pct)}% quitado</span>
        <span className="block truncate font-display text-lg font-black text-white">Falta {formatBRL(sum.remaining)}</span>
        {next && <span className="block truncate text-xs text-slate-400">Próxima: {next.debt.creditor} · {formatBRL(next.installment.amount)} em {formatDate(next.installment.dueDate).slice(0, 5)}</span>}
      </span>
      <ChevronRight size={18} className="shrink-0 text-slate-500" />
    </a>
  );
}
