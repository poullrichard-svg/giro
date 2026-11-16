import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Car, CircleDollarSign, Pencil, Plus, Smartphone, Target, TrendingDown, TrendingUp } from 'lucide-react';
import { useData } from '../data/DataProvider';
import { useToast } from '../data/toast';
import { BigTile, Button, Card, ConfirmDelete, Empty, Field, IconButton, IconChip, Input, MiniStat, Modal, MoneyInput, NumberInput, PageHeader, PeriodNav, Progress, Row, Segmented, Select, cx } from '../components/ui';
import { DRIVER_APPS } from '../lib/categories';
import { addDays, addMonths, elapsedDays, formatBRL, formatDayLabel, formatNumber, hoursToHHMM, localISODate, monthLabel, parseISODate } from '../lib/format';
import { driverStats } from '../lib/stats';
import type { DriverApp, DriverSession } from '../types';

type Mode = 'dia' | 'semana' | 'mes';
const APP_COLORS: Record<string, string> = { Uber: '#94a3b8', '99': '#f59e0b', InDrive: '#84cc16', Particular: '#10b981', Outro: '#7c5cff' };

const weekStart = (iso: string) => { const d = parseISODate(iso); return addDays(iso, -((d.getDay() + 6) % 7)); };

const GOAL_KEY = 'giro.driverDailyGoal';
const readGoal = () => { try { return Number(localStorage.getItem(GOAL_KEY)) || 300; } catch { return 300; } };

export default function Driver() {
  const { data, insert, update, remove } = useData();
  const [mode, setMode] = useState<Mode>('dia');
  const [day, setDay] = useState(localISODate());
  const [goal, setGoal] = useState(readGoal);
  const [form, setForm] = useState<{ open: boolean; editing?: DriverSession }>({ open: false });

  useEffect(() => { try { localStorage.setItem(GOAL_KEY, String(goal)); } catch { /* sem storage */ } }, [goal]);

  const period = useMemo(() => {
    if (mode === 'dia') return { label: day === localISODate() ? 'Hoje' : formatDayLabel(day), filter: (d: string) => d === day, days: 1 };
    if (mode === 'semana') {
      const s = weekStart(day); const e = addDays(s, 6);
      return { label: `${parseISODate(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} – ${parseISODate(e).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`, filter: (d: string) => d >= s && d <= e, days: elapsedDays(s, e) };
    }
    const m = day.slice(0, 7); const [y, mm] = m.split('-').map(Number);
    const last = `${m}-${String(new Date(y, mm, 0).getDate()).padStart(2, '0')}`;
    return { label: monthLabel(m), filter: (d: string) => d.startsWith(m), days: elapsedDays(`${m}-01`, last) };
  }, [mode, day]);

  const st = useMemo(() => driverStats(data.sessions, data.vehicleExpenses, data.vehicles, period.filter, period.days), [data.sessions, data.vehicleExpenses, data.vehicles, period]);
  const step = (n: number) => setDay(mode === 'dia' ? addDays(day, n) : mode === 'semana' ? addDays(day, 7 * n) : `${addMonths(day.slice(0, 7), n)}-01`);
  const goalTarget = goal * (mode === 'dia' ? 1 : Math.max(1, mode === 'semana' ? 6 : st.daysWorked || 22));

  return (
    <div>
      <PageHeader eyebrow="Corridas" title="Painel do motorista" subtitle="Ganhos, custos e lucro real das corridas" actions={
        <>
          <Segmented value={mode} onChange={setMode} options={[{ value: 'dia', label: 'Dia' }, { value: 'semana', label: 'Semana' }, { value: 'mes', label: 'Mês' }]} />
          <PeriodNav label={period.label} onPrev={() => step(-1)} onNext={() => step(1)} onToday={() => setDay(localISODate())} />
          <Button onClick={() => setForm({ open: true })}><Plus size={16} /> Registrar dia</Button>
        </>
      } />

      <div className="stagger mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat label="Km rodados" value={`${formatNumber(st.km)} km`} />
        <MiniStat label="Corridas" value={st.trips} />
        <MiniStat label="Faturamento" money={st.gross} tone="good" />
        <MiniStat label="Custos" money={st.operationalCost + st.fixedCost} tone="bad" />
      </div>

      <div className="stagger mb-5 grid gap-3 md:grid-cols-3 md:gap-4">
        <BigTile label="Ganhos brutos" money={st.gross} tone="good" icon={<TrendingUp />} sub={mode !== 'dia' ? `média ${formatBRL(st.avgPerDay)}/dia` : `${st.trips} corridas`} />
        <BigTile label="Gastos totais" money={st.operationalCost + st.fixedCost} tone="bad" icon={<TrendingDown />} sub={`combustível ${formatBRL(st.fuel)} · fixos ${formatBRL(st.fixedCost)}`} />
        <BigTile label="Lucro líquido" money={st.netProfit} tone={st.netProfit >= 0 ? 'warn' : 'bad'} icon={<CircleDollarSign />} sub={`antes dos fixos ${formatBRL(st.operationalProfit)}`} />
      </div>

      <Card className="mb-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <span className="label flex items-center gap-2 text-slate-300"><Target size={15} className="text-brand-300" /> Meta {mode === 'dia' ? 'do dia' : mode === 'semana' ? 'da semana (6 dias)' : 'do mês'}</span>
          <span className="font-mono text-xs font-extrabold text-slate-300">{formatBRL(st.gross)} <span className="text-slate-600">/</span> {formatBRL(goalTarget)}</span>
        </div>
        <Progress value={(st.gross / goalTarget) * 100} tone={st.gross >= goalTarget ? 'good' : 'brand'} />
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <span className="label text-slate-500">Meta diária</span>
          <MoneyInput value={goal} onChange={setGoal} className="h-10 min-h-10 w-36 rounded-xl py-0 text-xs" />
          <span className={cx('label', st.gross >= goalTarget ? 'text-emerald-400' : 'text-slate-500')}>{st.gross >= goalTarget ? '🎉 Meta batida!' : `faltam ${formatBRL(goalTarget - st.gross)}`}</span>
        </div>
      </Card>

      <div className="stagger mb-6 grid grid-cols-3 gap-2.5 md:gap-3">
        <MiniStat label="Horas trabalhadas" value={hoursToHHMM(st.hours)} />
        <MiniStat label="Fat. por hora" money={st.perHour} sub={`lucro ${formatBRL(st.profitPerHour)}`} />
        <MiniStat label="Fat. por km" money={st.perKm} sub={`custo ${formatBRL(st.costPerKm)}`} />
        <MiniStat label="Fat. por corrida" money={st.perTrip} />
        <MiniStat label="Lucro por hora" money={st.profitPerHour} tone="warn" />
        <MiniStat label="Lucro por km" money={st.profitPerKm} tone="warn" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.5fr]">
        <Card title={<><Smartphone size={14} className="text-brand-300" /> Faturamento por aplicativo</>}>
          {st.byApp.length === 0 ? <p className="label py-8 text-center text-slate-600">Sem corridas no período</p> : (
            <ul className="stagger space-y-2.5">
              {st.byApp.map((a) => (
                <li key={a.label} className="group surface surface-hover flex items-center gap-3 rounded-[1.4rem] p-3">
                  <IconChip tone={APP_COLORS[a.label] ?? '#7c5cff'}><Car size={18} /></IconChip>
                  <div className="min-w-0 flex-1">
                    <p className="label text-slate-500">Plataforma</p>
                    <p className="font-display text-[15px] font-black text-white">{a.label}</p>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/5"><div className="fill-x h-full rounded-full" style={{ width: `${(a.value / st.gross) * 100}%`, background: APP_COLORS[a.label] ?? '#7c5cff' }} /></div>
                  </div>
                  <div className="text-right"><p className="label text-slate-500">Ganhos</p><p className="font-mono text-sm font-extrabold text-white">{formatBRL(a.value)}</p></div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={<><CalendarDays size={14} className="text-brand-300" /> Registros</>}>
          {st.sessions.length === 0 ? (
            <Empty icon={<Car size={28} />} title="Nenhum registro no período" text="Registre o fechamento do dia: quanto fez em cada app, km, horas e gastos." action={<Button onClick={() => setForm({ open: true })}>Registrar dia</Button>} />
          ) : (
            <ul className="stagger space-y-2.5">
              {st.sessions.map((s) => {
                const v = data.vehicles.find((x) => x.id === s.vehicleId);
                return (
                  <Row key={s.id} tone={APP_COLORS[s.app] ?? '#7c5cff'} icon={<span className="font-display text-[11px] font-black">{s.app.slice(0, 3)}</span>}
                    title={`${formatDayLabel(s.date)} · ${s.trips} corridas`}
                    subtitle={[`${formatNumber(s.kmDriven)} km`, s.hoursWorked, s.fuelSpent > 0 && `comb. ${formatBRL(s.fuelSpent)}`, v?.name].filter(Boolean).join(' · ')}
                    amount={formatBRL(s.amount)} amountTone="good" onClick={() => setForm({ open: true, editing: s })}
                    actions={<>
                      <IconButton label="Editar" className="hidden md:inline-flex" onClick={() => setForm({ open: true, editing: s })}><Pencil size={15} /></IconButton>
                      <ConfirmDelete onConfirm={() => remove('sessions', s.id)} />
                    </>} />
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <SessionForm open={form.open} editing={form.editing} defaultDate={mode === 'dia' ? day : localISODate()} onClose={() => setForm({ open: false })} insert={insert} update={update} />
    </div>
  );
}

function SessionForm({ open, editing, defaultDate, onClose, insert, update }: {
  open: boolean; editing?: DriverSession; defaultDate: string; onClose: () => void;
  insert: ReturnType<typeof useData>['insert']; update: ReturnType<typeof useData>['update'];
}) {
  const { data } = useData();
  const toast = useToast();
  const vehicles = data.vehicles.filter((v) => v.active);
  const empty = () => ({ date: defaultDate, app: 'Uber' as DriverApp, amount: 0, trips: 0, kmDriven: 0, hoursWorked: '08:00', fuelSpent: 0, foodSpent: 0, fuelConsumption: vehicles[0]?.fuelConsumption ?? 10, observation: '', vehicleId: vehicles[0]?.id ?? '' });
  const [f, setF] = useState(empty);
  const [odometer, setOdometer] = useState(0);
  const [toLedger, setToLedger] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setF(editing ? { ...editing, observation: editing.observation ?? '', vehicleId: editing.vehicleId ?? '' } : empty());
    setOdometer(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const vehicle = vehicles.find((v) => v.id === f.vehicleId);

  const save = async () => {
    if (f.amount <= 0 && f.trips <= 0) { toast('Informe pelo menos o valor ganho', 'error'); return; }
    setBusy(true);
    const payload = { ...f, vehicleId: f.vehicleId || null, observation: f.observation || null };
    let ok: boolean;
    if (editing) ok = await update('sessions', editing.id, payload);
    else {
      ok = !!(await insert('sessions', payload));
      if (ok && toLedger) {
        const desc = `${f.app}${vehicle ? ` (${vehicle.name})` : ''}`;
        const rows = [{ description: `Ganhos ${desc}`, amount: f.amount, type: 'income' as const, category: 'Corridas (apps)', paymentMethod: 'Pix', date: f.date }];
        if (f.fuelSpent > 0) rows.push({ description: `Combustível ${desc}`, amount: f.fuelSpent, type: 'expense' as any, category: 'Combustível', paymentMethod: 'Pix', date: f.date });
        if (f.foodSpent > 0) rows.push({ description: `Alimentação ${desc}`, amount: f.foodSpent, type: 'expense' as any, category: 'Alimentação', paymentMethod: 'Pix', date: f.date });
        await insert('transactions', rows.filter((r) => r.amount > 0).map((r) => ({ ...r, vehicleId: f.vehicleId || null })));
      }
    }
    if (ok && vehicle) {
      const newOdo = odometer > 0 ? odometer : !editing && f.kmDriven > 0 ? vehicle.odometer + f.kmDriven : 0;
      if (newOdo > vehicle.odometer) await update('vehicles', vehicle.id, { odometer: Math.round(newOdo) });
    }
    setBusy(false);
    if (ok) { toast('Dia registrado'); onClose(); }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Editar registro' : 'Registrar dia de trabalho'} footer={<Button className="w-full" disabled={busy} onClick={save}>{busy ? 'Salvando…' : 'Salvar'}</Button>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data"><Input type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></Field>
          <Field label="Aplicativo"><Select value={f.app} onChange={(e) => set('app', e.target.value as DriverApp)} options={[...DRIVER_APPS]} /></Field>
        </div>
        {vehicles.length > 0 && (
          <Field label="Veículo"><Select value={f.vehicleId ?? ''} onChange={(e) => { const v = vehicles.find((x) => x.id === e.target.value); setF((x) => ({ ...x, vehicleId: e.target.value, fuelConsumption: v?.fuelConsumption ?? x.fuelConsumption })); }} options={[{ value: '', label: '—' }, ...vehicles.map((v) => ({ value: v.id, label: `${v.name} · ${v.plate}` }))]} /></Field>
        )}
        <Field label="Quanto ganhou (bruto)"><MoneyInput value={f.amount} onChange={(v) => set('amount', v)} className="text-lg font-semibold" autoFocus /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Corridas"><NumberInput value={f.trips} onChange={(v) => set('trips', Math.round(v))} /></Field>
          <Field label="Km rodados"><NumberInput value={f.kmDriven} onChange={(v) => set('kmDriven', v)} /></Field>
          <Field label="Horas"><Input type="time" value={f.hoursWorked} onChange={(e) => set('hoursWorked', e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Combustível"><MoneyInput value={f.fuelSpent} onChange={(v) => set('fuelSpent', v)} /></Field>
          <Field label="Alimentação"><MoneyInput value={f.foodSpent} onChange={(v) => set('foodSpent', v)} /></Field>
        </div>
        {vehicle && (
          <Field label="Hodômetro no fim do dia (opcional)" hint={`Atual: ${formatNumber(vehicle.odometer)} km. Se deixar em branco, somamos os km rodados.`}>
            <NumberInput value={odometer} onChange={setOdometer} suffix="km" />
          </Field>
        )}
        <Field label="Observação"><Input value={f.observation ?? ''} onChange={(e) => set('observation', e.target.value)} placeholder="Ex.: dinâmico alto no centro" /></Field>
        {!editing && (
          <label className="flex items-center gap-3 text-sm text-slate-300">
            <input type="checkbox" checked={toLedger} onChange={(e) => setToLedger(e.target.checked)} className="h-5 w-5 accent-brand-500" />
            Lançar ganhos e gastos também no financeiro
          </label>
        )}
      </div>
    </Modal>
  );
}
