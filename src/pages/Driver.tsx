import { useEffect, useMemo, useState } from 'react';
import { Briefcase, CalendarDays, Car, CircleDollarSign, Package, Pencil, Plus, SlidersHorizontal, Smartphone, Target, TrendingDown, TrendingUp, Wrench } from 'lucide-react';
import { useData } from '../data/DataProvider';
import { useToast } from '../data/toast';
import { BigTile, Button, Card, ConfirmDelete, Empty, Field, IconButton, IconChip, Input, MiniStat, Modal, MoneyInput, NumberInput, PageHeader, PeriodNav, Progress, Row, Segmented, Select, cx } from '../components/ui';
import { hasErrors, rules, validate, type Errors } from '../lib/validate';
import { WorkSetup } from '../components/WorkSetup';
import { countFieldLabel, countLabel, incomeCategoryFor, kindsOf, panelTitle, platformOf, PROFILE_ID, unitLabel, WORK_TYPES } from '../lib/work';
import { addDays, addMonths, elapsedDays, formatBRL, formatDayLabel, formatNumber, hoursToHHMM, localISODate, monthLabel, parseISODate } from '../lib/format';
import { driverStats } from '../lib/stats';
import { appProfit, maintenanceRates } from '../lib/driverInsights';
import { BestTimes } from '../components/BestTimes';
import type { DriverSession, WorkKind, WorkProfile } from '../types';

type Mode = 'dia' | 'semana' | 'mes';
const KIND_ICON: Record<WorkKind, typeof Car> = { passageiro: Car, entrega: Package, fixo: Briefcase };

const weekStart = (iso: string) => { const d = parseISODate(iso); return addDays(iso, -((d.getDay() + 6) % 7)); };

// Meta antiga (guardada no navegador antes do perfil existir).
const legacyGoal = () => { try { return Number(localStorage.getItem('giro.driverDailyGoal')) || 300; } catch { return 300; } };

export default function Driver() {
  const { data } = useData();
  const profile = data.settings.find((x) => x.id === PROFILE_ID) ?? null;
  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader eyebrow="Vamos começar" title="Que tipo de motorista você é?" subtitle="Marque tudo o que você faz — dá para mudar quando quiser. O painel se ajusta ao seu jeito de trabalhar." />
        <WorkSetup profile={null} />
      </div>
    );
  }
  return <DriverPanel profile={profile} />;
}

function DriverPanel({ profile }: { profile: WorkProfile }) {
  const { data, insert, update, remove, put } = useData();
  const [mode, setMode] = useState<Mode>('dia');
  const [day, setDay] = useState(localISODate());
  const [goal, setGoal] = useState(() => profile.dailyGoal || legacyGoal());
  const [form, setForm] = useState<{ open: boolean; editing?: DriverSession }>({ open: false });
  const [setupOpen, setSetupOpen] = useState(false);
  const kinds = useMemo(() => kindsOf(profile), [profile]);
  const unit = unitLabel(kinds);
  const units = countLabel(kinds).toLowerCase();

  // Salva a meta no perfil, sem gravar a cada tecla.
  useEffect(() => {
    if (goal === profile.dailyGoal) return;
    const t = setTimeout(() => put('settings', { ...profile, dailyGoal: goal }), 600);
    return () => clearTimeout(t);
  }, [goal, profile, put]);

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
  const apps = useMemo(() => appProfit(st.sessions, st.vehicleExpenses + st.fixedCost), [st]);
  // Quanto separar para manutenção pelos km rodados no período (veículos com reserva configurada).
  const reserve = useMemo(() => {
    let amount = 0; let km = 0;
    for (const x of st.sessions) {
      const v = data.vehicles.find((y) => y.id === x.vehicleId);
      if (!v) continue;
      const r = maintenanceRates(v); const per = r.pneus + r.oleo + r.revisao;
      if (per > 0) { amount += x.kmDriven * per; km += x.kmDriven; }
    }
    return { amount, km };
  }, [st.sessions, data.vehicles]);
  const step = (n: number) => setDay(mode === 'dia' ? addDays(day, n) : mode === 'semana' ? addDays(day, 7 * n) : `${addMonths(day.slice(0, 7), n)}-01`);
  const goalTarget = goal * (mode === 'dia' ? 1 : Math.max(1, mode === 'semana' ? 6 : st.daysWorked || 22));

  return (
    <div>
      <PageHeader eyebrow={profile.types.map((t) => WORK_TYPES.find((w) => w.id === t)?.label).filter(Boolean).join(' · ')} title={panelTitle(kinds)} subtitle={`Ganhos, custos e lucro real das suas ${units}`} actions={
        <>
          <Segmented value={mode} onChange={setMode} options={[{ value: 'dia', label: 'Dia' }, { value: 'semana', label: 'Semana' }, { value: 'mes', label: 'Mês' }]} />
          <PeriodNav label={period.label} onPrev={() => step(-1)} onNext={() => step(1)} onToday={() => setDay(localISODate())} />
          <Button onClick={() => setForm({ open: true })}><Plus size={16} /> Registrar dia</Button>
          <Button variant="soft" onClick={() => setSetupOpen(true)}><SlidersHorizontal size={16} /> Personalizar</Button>
        </>
      } />

      <div className="stagger mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat label="Km rodados" value={`${formatNumber(st.km)} km`} />
        <MiniStat label={countLabel(kinds)} value={st.trips} />
        <MiniStat label="Faturamento" money={st.gross} tone="good" />
        <MiniStat label="Custos" money={st.operationalCost + st.fixedCost} tone="bad" />
      </div>

      <div className="stagger mb-5 grid gap-3 md:grid-cols-3 md:gap-4">
        <BigTile label="Ganhos brutos" money={st.gross} tone="good" icon={<TrendingUp />} sub={mode !== 'dia' ? `média ${formatBRL(st.avgPerDay)}/dia` : `${st.trips} ${units}`} />
        <BigTile label="Gastos totais" money={st.operationalCost + st.fixedCost} tone="bad" icon={<TrendingDown />} sub={`combustível ${formatBRL(st.fuel)} · fixos ${formatBRL(st.fixedCost)}`} />
        <BigTile label="Lucro líquido" money={st.netProfit} tone={st.netProfit >= 0 ? 'warn' : 'bad'} icon={<CircleDollarSign />} sub={`antes dos fixos ${formatBRL(st.operationalProfit)}`} />
      </div>

      {reserve.km > 0 && (
        <a href={`#/veiculos/${st.sessions.find((x) => x.vehicleId)?.vehicleId ?? ''}`} className="surface surface-hover mb-5 flex items-center gap-3 rounded-[1.5rem] p-3.5 pl-4">
          <Wrench size={18} className="shrink-0 text-amber-400" />
          <p className="min-w-0 flex-1 text-sm text-slate-300">Separe <strong className="font-mono text-amber-300">{formatBRL(reserve.amount)}</strong> deste período para manutenção <span className="text-slate-500">({formatNumber(reserve.km)} km × {formatBRL(reserve.amount / reserve.km)}/km)</span></p>
        </a>
      )}

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
        <MiniStat label={`Fat. por ${unit}`} money={st.perTrip} />
        <MiniStat label="Lucro por hora" money={st.profitPerHour} tone="warn" />
        <MiniStat label="Lucro por km" money={st.profitPerKm} tone="warn" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.5fr]">
        <Card title={<><Smartphone size={14} className="text-brand-300" /> Aplicativos por lucro</>}>
          {apps.length === 0 ? <p className="label py-8 text-center text-slate-600">Sem registros no período</p> : (
            <>
              <ul className="stagger space-y-2.5">
                {apps.map((a, i) => {
                  const pl = platformOf(profile, { app: a.app, platformId: null }); const Icon = KIND_ICON[pl.kind];
                  return (
                    <li key={a.app} className="group surface surface-hover rounded-[1.4rem] p-3">
                      <div className="flex items-center gap-3">
                        <IconChip tone={pl.color}><Icon size={18} /></IconChip>
                        <div className="min-w-0 flex-1">
                          <p className="label text-slate-500">{i === 0 && apps.length > 1 ? '🏆 Mais lucrativo' : 'Plataforma'}</p>
                          <p className="truncate font-display text-[15px] font-black text-white">{a.app}</p>
                        </div>
                        <div className="text-right">
                          <p className="label text-slate-500">Lucro</p>
                          <p className={cx('font-mono text-sm font-extrabold', a.net >= 0 ? 'text-emerald-400' : 'text-rose-400')}>{formatBRL(a.net)}</p>
                        </div>
                      </div>
                      <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl bg-white/[.03] py-1.5"><p className="label !text-[9px] text-slate-500">Faturou</p><p className="font-mono text-[11px] font-bold text-slate-200">{formatBRL(a.gross)}</p></div>
                        <div className="rounded-xl bg-white/[.03] py-1.5"><p className="label !text-[9px] text-slate-500">Lucro/hora</p><p className="font-mono text-[11px] font-bold text-slate-200">{a.hours ? formatBRL(a.perHour) : '—'}</p></div>
                        <div className="rounded-xl bg-white/[.03] py-1.5"><p className="label !text-[9px] text-slate-500">Margem</p><p className="font-mono text-[11px] font-bold text-slate-200">{Math.round(a.margin * 100)}%</p></div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-[11px] text-slate-500">Lucro = ganho − combustível e alimentação do turno − gastos e custo fixo do carro divididos pelos km rodados em cada app.</p>
            </>
          )}
        </Card>
        <Card title={<><CalendarDays size={14} className="text-brand-300" /> Registros</>}>
          {st.sessions.length === 0 ? (
            <Empty icon={<Car size={28} />} title="Nenhum registro no período" text="Registre o fechamento do dia: quanto fez em cada app, km, horas e gastos." action={<Button onClick={() => setForm({ open: true })}>Registrar dia</Button>} />
          ) : (
            <ul className="stagger space-y-2.5">
              {st.sessions.map((s) => {
                const v = data.vehicles.find((x) => x.id === s.vehicleId);
                const pl = platformOf(profile, s); const k = s.workKind ?? pl.kind;
                return (
                  <Row key={s.id} tone={pl.color} icon={<span className="font-display text-[11px] font-black">{pl.name.slice(0, 3)}</span>}
                    title={`${pl.name} · ${formatDayLabel(s.date)}`}
                    subtitle={[`${s.trips} ${countFieldLabel(k).toLowerCase()}`, `${formatNumber(s.kmDriven)} km`, s.hoursWorked, s.fuelSpent > 0 && `comb. ${formatBRL(s.fuelSpent)}`, v?.name].filter(Boolean).join(' · ')}
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

      <BestTimes sessions={data.sessions} />

      <SessionForm open={form.open} editing={form.editing} profile={profile} defaultDate={mode === 'dia' ? day : localISODate()} onClose={() => setForm({ open: false })} insert={insert} update={update} />
      <Modal open={setupOpen} onClose={() => setSetupOpen(false)} title="Seu jeito de trabalhar">
        <WorkSetup profile={profile} onDone={() => setSetupOpen(false)} />
      </Modal>
    </div>
  );
}

function SessionForm({ open, editing, profile, defaultDate, onClose, insert, update }: {
  open: boolean; editing?: DriverSession; profile: WorkProfile; defaultDate: string; onClose: () => void;
  insert: ReturnType<typeof useData>['insert']; update: ReturnType<typeof useData>['update'];
}) {
  const { data } = useData();
  const toast = useToast();
  const vehicles = data.vehicles.filter((v) => v.active);
  const platforms = profile.platforms.filter((p) => p.enabled);
  // Sugere a última plataforma usada.
  const lastPlatform = platforms.find((p) => p.id === data.sessions[0]?.platformId) ?? platforms[0];
  const vehicleFor = (kind?: string) => vehicles.find((v) => (v.kind ?? 'carro') === kind) ?? vehicles[0];
  const empty = () => ({ date: defaultDate, startTime: data.sessions.find((x) => x.startTime)?.startTime ?? '', app: lastPlatform?.name ?? 'Outro', platformId: (lastPlatform?.id ?? null) as string | null, workKind: lastPlatform?.kind ?? 'passageiro' as WorkKind, amount: 0, trips: 0, kmDriven: 0, hoursWorked: '08:00', fuelSpent: 0, foodSpent: 0, fuelConsumption: vehicleFor(lastPlatform?.vehicle)?.fuelConsumption ?? 10, observation: '', vehicleId: vehicleFor(lastPlatform?.vehicle)?.id ?? '' });
  const [f, setF] = useState(empty);
  const [odometer, setOdometer] = useState(0);
  const [toLedger, setToLedger] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors<'date' | 'amount' | 'km' | 'hours' | 'platform' | 'odometer' | 'start'>>({});
  // Some com o erro assim que a pessoa mexe no formulário; volta a validar ao salvar.
  useEffect(() => { setErrors({}); }, [f, odometer]);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setF(editing ? { ...editing, startTime: editing.startTime ?? '', platformId: editing.platformId ?? null, workKind: editing.workKind ?? platformOf(profile, editing).kind, observation: editing.observation ?? '', vehicleId: editing.vehicleId ?? '' } : empty());
    setOdometer(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const vehicle = vehicles.find((v) => v.id === f.vehicleId);

  const save = async () => {
    const e = validate({
      platform: [!f.app && 'Escolha onde trabalhou'],
      date: [rules.date(f.date), f.date > localISODate() && 'A data não pode ser no futuro'],
      amount: [rules.positive(f.amount, f.workKind === 'fixo' ? 'Valor da diária' : 'Valor ganho'), rules.max(f.amount, 100_000, 'Valor')],
      km: [rules.nonNegative(f.kmDriven, 'Km rodados'), rules.max(f.kmDriven, 3000, 'Km rodados')],
      hours: [rules.time(f.hoursWorked, 'Horas')],
      start: [f.startTime ? rules.time(f.startTime, 'Horário de início') : null],
      odometer: [vehicle && odometer > 0 && odometer < vehicle.odometer && `O hodômetro atual já é ${formatNumber(vehicle.odometer)} km`],
    });
    setErrors(e);
    if (hasErrors(e)) return;
    setBusy(true);
    const payload = { ...f, startTime: f.startTime || null, vehicleId: f.vehicleId || null, observation: f.observation || null };
    let ok: boolean;
    if (editing) ok = await update('sessions', editing.id, payload);
    else {
      ok = !!(await insert('sessions', payload));
      if (ok && toLedger) {
        const desc = `${f.app}${vehicle ? ` (${vehicle.name})` : ''}`;
        const rows = [{ description: `${f.workKind === 'fixo' ? 'Diária' : 'Ganhos'} ${desc}`, amount: f.amount, type: 'income' as const, category: incomeCategoryFor(f.workKind), paymentMethod: 'Pix', date: f.date }];
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
          <Field label="Data" error={errors.date}><Input type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></Field>
        </div>
        <Field label="Onde trabalhou" group error={errors.platform}>
          <div className="flex flex-wrap gap-2">
            {platforms.map((p) => {
              const on = f.platformId === p.id || (!f.platformId && f.app === p.name);
              return (
                <button key={p.id} type="button" aria-pressed={on}
                  onClick={() => { const v = vehicleFor(p.vehicle); setF((x) => ({ ...x, app: p.name, platformId: p.id, workKind: p.kind, ...(x.vehicleId || !v ? {} : { vehicleId: v.id, fuelConsumption: v.fuelConsumption }) })); }}
                  className={cx('press flex items-center gap-2 rounded-full py-2 pl-2.5 pr-3.5 text-sm font-bold ring-1 transition', on ? 'text-white ring-2' : 'text-slate-400 ring-white/10 hover:text-white')}
                  style={on ? { background: `color-mix(in srgb, ${p.color} 22%, transparent)`, boxShadow: `0 0 0 2px ${p.color}` } : undefined}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} /> {p.name}
                </button>
              );
            })}
          </div>
        </Field>
        {vehicles.length > 0 && (
          <Field label="Veículo"><Select value={f.vehicleId ?? ''} onChange={(e) => { const v = vehicles.find((x) => x.id === e.target.value); setF((x) => ({ ...x, vehicleId: e.target.value, fuelConsumption: v?.fuelConsumption ?? x.fuelConsumption })); }} options={[{ value: '', label: '—' }, ...vehicles.map((v) => ({ value: v.id, label: [v.name, v.plate].filter(Boolean).join(' · ') }))]} /></Field>
        )}
        <Field label={f.workKind === 'fixo' ? 'Valor da diária' : 'Quanto ganhou (bruto)'} error={errors.amount}><MoneyInput value={f.amount} onChange={(v) => set('amount', v)} className="text-lg font-semibold" /></Field>
        <div className="grid grid-cols-2 items-start gap-3">
          <Field label="Começou às" error={errors.start} hint="Para achar seus melhores horários"><Input type="time" value={f.startTime ?? ''} onChange={(e) => set('startTime', e.target.value)} /></Field>
          <Field label="Horas trabalhadas" error={errors.hours}><Input type="time" value={f.hoursWorked} onChange={(e) => set('hoursWorked', e.target.value)} /></Field>
          <Field label={countFieldLabel(f.workKind)}><NumberInput value={f.trips} onChange={(v) => set('trips', Math.round(v))} /></Field>
          <Field label="Km rodados" error={errors.km}><NumberInput value={f.kmDriven} onChange={(v) => set('kmDriven', v)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Combustível"><MoneyInput value={f.fuelSpent} onChange={(v) => set('fuelSpent', v)} /></Field>
          <Field label="Alimentação"><MoneyInput value={f.foodSpent} onChange={(v) => set('foodSpent', v)} /></Field>
        </div>
        {vehicle && (
          <Field label="Hodômetro no fim do dia (opcional)" error={errors.odometer} hint={`Atual: ${formatNumber(vehicle.odometer)} km. Se deixar em branco, somamos os km rodados.`}>
            <NumberInput value={odometer} onChange={setOdometer} suffix="km" />
          </Field>
        )}
        <Field label="Observação"><Input value={f.observation ?? ''} onChange={(e) => set('observation', e.target.value)} placeholder={f.workKind === 'passageiro' ? 'Ex.: dinâmico alto no centro' : 'Ex.: rota zona sul, 3 coletas'} /></Field>
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
