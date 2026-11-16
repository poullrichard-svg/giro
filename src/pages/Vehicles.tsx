import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarClock, CarFront, Droplets, FileText, Fuel, Gauge, Pencil, Plus, Shield, Wrench } from 'lucide-react';
import { useData } from '../data/DataProvider';
import { useToast } from '../data/toast';
import { Button, Card, ConfirmDelete, Empty, Field, Input, Modal, MoneyInput, NumberInput, PageHeader, Progress, Segmented, Row, Select, Stat, Tilt, cx } from '../components/ui';
import { VEHICLE_EXPENSE_CATEGORIES } from '../lib/categories';
import { daysUntil, formatBRL, formatDate, formatNumber, localISODate } from '../lib/format';
import { oilStatus, vehicleAlerts, vehicleFixedMonthly } from '../lib/stats';
import { go } from '../router';
import type { Vehicle, VehicleExpense, VehicleOwnership } from '../types';

const OWNERSHIP: Record<VehicleOwnership, string> = { owned: 'Quitado', financed: 'Financiado', rented: 'Alugado' };

export function Plate({ plate, small }: { plate: string; small?: boolean }) {
  const p = (plate || '———————').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const pretty = /^[A-Z]{3}\d{4}$/.test(p) ? `${p.slice(0, 3)}-${p.slice(3)}` : p.length === 7 ? `${p.slice(0, 3)}${p.slice(3)}` : p;
  return (
    <div className={cx('inline-flex flex-col overflow-hidden rounded-md border-2 border-slate-800 bg-white text-center shadow', small ? 'w-24' : 'w-32')}>
      <div className={cx('flex items-center justify-between bg-blue-700 px-1.5 font-bold text-white', small ? 'text-[6px]' : 'text-[8px]')}><span>BR</span><span>BRASIL</span><span className="opacity-0">BR</span></div>
      <div className={cx('font-mono font-black tracking-wider text-slate-900', small ? 'py-0.5 text-sm' : 'py-1 text-lg')}>{pretty}</div>
    </div>
  );
}

export default function Vehicles({ id }: { id?: string }) {
  const { data } = useData();
  const [form, setForm] = useState<{ open: boolean; editing?: Vehicle }>({ open: false });
  const vehicle = id ? data.vehicles.find((v) => v.id === id) : undefined;

  if (vehicle) return <><VehicleDetail v={vehicle} onEdit={() => setForm({ open: true, editing: vehicle })} /><VehicleForm {...form} onClose={() => setForm({ open: false })} /></>;

  return (
    <div>
      <PageHeader eyebrow="Garagem" title="Veículos" subtitle="Documentos, manutenção e custos de cada carro" actions={<Button onClick={() => setForm({ open: true })}><Plus size={16} /> Adicionar veículo</Button>} />
      {data.vehicles.length === 0 ? (
        <Card><Empty icon={<CarFront size={32} />} title="Nenhum veículo cadastrado" text="Cadastre placa, IPVA, seguro, parcela e quilometragem para receber alertas e saber o custo real por km." action={<Button onClick={() => setForm({ open: true })}>Cadastrar veículo</Button>} /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.vehicles.map((v) => {
            const alerts = vehicleAlerts([v]);
            const oil = oilStatus(v);
            return (
              <Tilt as="button" key={v.id} onClick={() => go('veiculos', v.id)} className={cx('surface rounded-[2rem] p-5 text-left', !v.active && 'opacity-50')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg font-black text-white">{v.name}</p>
                    <p className="truncate text-xs text-slate-500">{[v.brand, v.model, v.year].filter(Boolean).join(' · ') || '—'}</p>
                    <span className="mt-2 inline-block rounded-md bg-white/5 px-2 py-0.5 text-[11px] text-slate-300">{OWNERSHIP[v.ownership]}</span>
                  </div>
                  <Plate plate={v.plate} small />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div><p className="text-slate-500">Hodômetro</p><p className="font-semibold text-slate-200">{formatNumber(v.odometer)} km</p></div>
                  <div><p className="text-slate-500">Custo fixo/mês</p><p className="font-semibold text-slate-200">{formatBRL(vehicleFixedMonthly(v))}</p></div>
                </div>
                {oil && <div className="mt-3"><div className="mb-1 flex justify-between text-[11px] text-slate-500"><span>Óleo</span><span>{oil.remaining > 0 ? `faltam ${formatNumber(oil.remaining)} km` : 'vencido'}</span></div><Progress value={oil.pct} tone={oil.remaining <= 0 ? 'bad' : oil.remaining <= 1000 ? 'warn' : 'good'} /></div>}
                {alerts.length > 0 && <p className="mt-3 text-xs text-amber-400">⚠ {alerts.map((a) => a.title.split(' · ')[0]).join(', ')}</p>}
              </Tilt>
            );
          })}
        </div>
      )}
      <VehicleForm {...form} onClose={() => setForm({ open: false })} />
    </div>
  );
}

function DocRow({ icon, label, value, due, perMonth }: { icon: React.ReactNode; label: string; value: number; due?: string | null; perMonth?: boolean }) {
  const d = due ? daysUntil(due) : null;
  const tone = d === null ? 'text-slate-500' : d < 0 ? 'text-rose-400' : d <= 30 ? 'text-amber-400' : 'text-emerald-400';
  return (
    <Row tone={d === null ? 'brand' : d < 0 ? 'bad' : d <= 30 ? 'warn' : 'good'} icon={icon} title={label}
      subtitle={<span className={tone}>{due ? `${d! < 0 ? 'Venceu' : 'Vence'} em ${formatDate(due)}${d! >= 0 ? ` (${d}d)` : ''}` : 'Sem data cadastrada'}</span>}
      amount={`${formatBRL(value)}${perMonth ? '/mês' : ''}`} />
  );
}

function VehicleDetail({ v, onEdit }: { v: Vehicle; onEdit: () => void }) {
  const { data, remove, update, insert } = useData();
  const toast = useToast();
  const [expOpen, setExpOpen] = useState<{ open: boolean; category?: string }>({ open: false });
  const [year, setYear] = useState(localISODate().slice(0, 4));
  const expenses = useMemo(() => data.vehicleExpenses.filter((e) => e.vehicleId === v.id), [data.vehicleExpenses, v.id]);
  const sessions = useMemo(() => data.sessions.filter((s) => s.vehicleId === v.id), [data.sessions, v.id]);
  const yearExp = expenses.filter((e) => e.date.startsWith(year));
  const month = localISODate().slice(0, 7);
  const monthTotal = expenses.filter((e) => e.date.startsWith(month)).reduce((s, e) => s + e.amount, 0) + sessions.filter((s) => s.date.startsWith(month)).reduce((a, s) => a + s.fuelSpent, 0);
  const yearTotal = yearExp.reduce((s, e) => s + e.amount, 0);
  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of yearExp) m.set(e.category, (m.get(e.category) ?? 0) + e.amount);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [yearExp]);
  const oil = oilStatus(v);
  const years = [...new Set([localISODate().slice(0, 4), ...expenses.map((e) => e.date.slice(0, 4))])].sort().reverse();

  // Consumo médio pelo método do tanque cheio: km entre abastecimentos / litros.
  const avgConsumption = useMemo(() => {
    const fuel = expenses.filter((e) => e.category === 'Combustível' && e.odometer && e.liters).sort((a, b) => a.odometer! - b.odometer!);
    let km = 0; let liters = 0;
    for (let i = 1; i < fuel.length; i++) { km += fuel[i].odometer! - fuel[i - 1].odometer!; liters += fuel[i].liters!; }
    return liters > 0 ? km / liters : null;
  }, [expenses]);

  const financedLeft = v.ownership === 'financed' && v.installmentsRemaining ? v.installmentValue * v.installmentsRemaining : 0;

  return (
    <div>
      <button onClick={() => go('veiculos')} className="mb-3 flex items-center gap-1 text-sm text-slate-400 hover:text-white"><ArrowLeft size={16} /> Veículos</button>
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Plate plate={v.plate} />
          <div>
            <h1 className="text-xl font-bold text-white">{v.name}</h1>
            <p className="text-sm text-slate-500">{[v.brand, v.model, v.year, v.color, v.fuelType].filter(Boolean).join(' · ')}</p>
            {v.renavam && <p className="text-xs text-slate-600">RENAVAM {v.renavam}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="soft" onClick={onEdit}><Pencil size={16} /> Editar</Button>
          <Button onClick={() => setExpOpen({ open: true })}><Plus size={16} /> Gasto</Button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Hodômetro" value={`${formatNumber(v.odometer)} km`} icon={<Gauge size={14} />} />
        <Stat label="Gasto no mês" money={monthTotal} tone="bad" sub="inclui combustível das corridas" />
        <Stat label="Custo fixo mensal" money={vehicleFixedMonthly(v)} tone="warn" sub={OWNERSHIP[v.ownership]} />
        <Stat label="Consumo médio" value={avgConsumption ? `${formatNumber(avgConsumption, 1)} km/l` : `${formatNumber(v.fuelConsumption, 1)} km/l`} sub={avgConsumption ? 'calculado pelos abastecimentos' : 'informado no cadastro'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Documentos e custos fixos">
          <ul className="stagger space-y-2.5">
            <DocRow icon={<FileText size={18} />} label="IPVA" value={v.ipvaValue} due={v.ipvaDueDate} />
            <DocRow icon={<CalendarClock size={18} />} label="Licenciamento" value={v.licensingValue} due={v.licensingDueDate} />
            <DocRow icon={<Shield size={18} />} label="Seguro" value={v.insuranceValue} due={v.insuranceDueDate} perMonth />
            {v.ownership !== 'owned' && (
              <Row tone="info" icon={<CarFront size={18} />} title={v.ownership === 'rented' ? 'Aluguel' : 'Parcela'}
                subtitle={financedLeft > 0 ? `${v.installmentsRemaining} parcelas · saldo ≈ ${formatBRL(financedLeft)}` : 'mensal'}
                amount={`${formatBRL(v.installmentValue)}/mês`} />
            )}
          </ul>
        </Card>

        <Card title="Troca de óleo" action={<Button variant="soft" onClick={() => setExpOpen({ open: true, category: 'Troca de óleo' })}><Droplets size={14} /> Registrar troca</Button>}>
          {oil ? (
            <>
              <Progress value={oil.pct} tone={oil.remaining <= 0 ? 'bad' : oil.remaining <= 1000 ? 'warn' : 'good'} />
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div><p className="text-slate-500">Última troca</p><p className="font-semibold text-slate-200">{formatNumber(v.lastOilChangeKm!)} km</p></div>
                <div><p className="text-slate-500">Próxima</p><p className="font-semibold text-slate-200">{formatNumber(oil.next)} km</p></div>
                <div><p className="text-slate-500">{oil.remaining >= 0 ? 'Faltam' : 'Passou'}</p><p className={cx('font-semibold', oil.remaining <= 0 ? 'text-rose-400' : oil.remaining <= 1000 ? 'text-amber-400' : 'text-emerald-400')}>{formatNumber(Math.abs(oil.remaining))} km</p></div>
              </div>
            </>
          ) : <p className="text-sm text-slate-500">Registre a última troca para acompanhar a próxima (intervalo: {formatNumber(v.oilIntervalKm)} km).</p>}
          <div className="mt-4 flex items-end gap-2">
            <Field label="Atualizar hodômetro" className="flex-1"><OdometerInput v={v} onSave={(km) => update('vehicles', v.id, { odometer: km }).then((ok) => ok && toast('Hodômetro atualizado'))} /></Field>
          </div>
        </Card>
      </div>

      <Card className="mt-4" title={`Gastos em ${year} · ${formatBRL(yearTotal)}`} action={<Select className="h-9 min-h-9 w-24" value={year} onChange={(e) => setYear(e.target.value)} options={years} />}>
        {byCat.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {byCat.map(([c, val]) => <span key={c} className="label rounded-full bg-white/[.05] px-3 py-1.5 text-slate-400 ring-1 ring-white/10">{c}: <strong className="font-mono text-white">{formatBRL(val)}</strong></span>)}
          </div>
        )}
        {yearExp.length === 0 ? <Empty icon={<Wrench size={28} />} title="Sem gastos lançados" text="Abastecimentos, revisões, pneus, multas, IPVA…" /> : (
          <ul className="stagger space-y-2.5">
            {yearExp.map((e) => (
              <Row key={e.id} tone={e.category === 'Combustível' ? 'bad' : e.category === 'Troca de óleo' ? 'warn' : 'info'}
                icon={e.category === 'Combustível' ? <Fuel size={18} /> : e.category === 'Troca de óleo' ? <Droplets size={18} /> : <Wrench size={18} />}
                title={`${e.category}${e.description ? ` · ${e.description}` : ''}`}
                subtitle={`${formatDate(e.date)}${e.odometer ? ` · ${formatNumber(e.odometer)} km` : ''}${e.liters ? ` · ${formatNumber(e.liters, 1)} L` : ''}`}
                amount={formatBRL(e.amount)} amountTone="bad" actions={<ConfirmDelete onConfirm={() => remove('vehicleExpenses', e.id)} />} />
            ))}
          </ul>
        )}
      </Card>

      <div className="mt-6 flex justify-between gap-2">
        <Button variant="soft" onClick={() => update('vehicles', v.id, { active: !v.active })}>{v.active ? 'Marcar como inativo (vendido)' : 'Reativar veículo'}</Button>
        <DeleteVehicle onConfirm={async () => { if (await remove('vehicles', v.id)) go('veiculos'); }} />
      </div>
      <ExpenseForm open={expOpen.open} category={expOpen.category} vehicle={v} onClose={() => setExpOpen({ open: false })} insert={insert} update={update} />
    </div>
  );
}

function DeleteVehicle({ onConfirm }: { onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  return <Button variant="danger" onClick={() => (armed ? onConfirm() : setArmed(true))}>{armed ? 'Toque de novo para excluir tudo' : 'Excluir veículo'}</Button>;
}

function OdometerInput({ v, onSave }: { v: Vehicle; onSave: (km: number) => void }) {
  const [km, setKm] = useState(v.odometer);
  useEffect(() => setKm(v.odometer), [v.odometer]);
  return (
    <div className="flex gap-2">
      <div className="flex-1"><NumberInput value={km} onChange={setKm} suffix="km" /></div>
      <Button variant="soft" disabled={km === v.odometer} onClick={() => onSave(Math.round(km))}>Salvar</Button>
    </div>
  );
}

function ExpenseForm({ open, onClose, vehicle, category, insert, update }: {
  open: boolean; onClose: () => void; vehicle: Vehicle; category?: string;
  insert: ReturnType<typeof useData>['insert']; update: ReturnType<typeof useData>['update'];
}) {
  const toast = useToast();
  const blank = (): Omit<VehicleExpense, 'id'> => ({ vehicleId: vehicle.id, date: localISODate(), category: category ?? 'Combustível', amount: 0, odometer: vehicle.odometer || null, liters: null, description: '' });
  const [f, setF] = useState(blank);
  const [toLedger, setToLedger] = useState(true);
  useEffect(() => { if (open) setF(blank()); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open, category]);

  const save = async () => {
    if (f.amount <= 0) { toast('Informe o valor', 'error'); return; }
    const ok = await insert('vehicleExpenses', { ...f, description: f.description || null });
    if (!ok) return;
    if (toLedger) await insert('transactions', { description: `${f.category} · ${vehicle.name}${f.description ? ` (${f.description})` : ''}`, amount: f.amount, type: 'expense', category: f.category === 'Combustível' ? 'Combustível' : 'Veículo', paymentMethod: 'Pix', date: f.date, vehicleId: vehicle.id });
    const patch: Partial<Vehicle> = {};
    if (f.odometer && f.odometer > vehicle.odometer) patch.odometer = Math.round(f.odometer);
    if (f.category === 'Troca de óleo' && f.odometer) patch.lastOilChangeKm = Math.round(f.odometer);
    if (Object.keys(patch).length) await update('vehicles', vehicle.id, patch);
    toast('Gasto registrado');
    onClose();
  };

  const isFuel = f.category === 'Combustível';
  return (
    <Modal open={open} onClose={onClose} title={`Gasto · ${vehicle.name}`} footer={<Button className="w-full" onClick={save}>Salvar</Button>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} options={VEHICLE_EXPENSE_CATEGORIES} /></Field>
          <Field label="Data"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        </div>
        <Field label="Valor"><MoneyInput value={f.amount} onChange={(v) => setF({ ...f, amount: v })} className="text-lg font-semibold" autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Hodômetro" hint={isFuel ? 'Com litros, calcula o consumo real' : undefined}><NumberInput value={f.odometer ?? 0} onChange={(v) => setF({ ...f, odometer: v || null })} suffix="km" /></Field>
          {isFuel && <Field label="Litros" hint="Encha o tanque para medir certo"><NumberInput value={f.liters ?? 0} onChange={(v) => setF({ ...f, liters: v || null })} suffix="L" /></Field>}
        </div>
        <Field label="Descrição"><Input value={f.description ?? ''} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Ex.: Posto Shell, revisão 60 mil" /></Field>
        <label className="flex items-center gap-3 text-sm text-slate-300"><input type="checkbox" checked={toLedger} onChange={(e) => setToLedger(e.target.checked)} className="h-5 w-5 accent-brand-500" /> Lançar também no financeiro</label>
      </div>
    </Modal>
  );
}

function VehicleForm({ open, editing, onClose }: { open: boolean; editing?: Vehicle; onClose: () => void }) {
  const { insert, update } = useData();
  const toast = useToast();
  const blank = (): Omit<Vehicle, 'id'> => ({
    name: '', brand: '', model: '', year: new Date().getFullYear(), plate: '', color: '', renavam: '', fuelType: 'Flex', ownership: 'owned',
    odometer: 0, fuelConsumption: 10, ipvaValue: 0, ipvaDueDate: null, licensingValue: 0, licensingDueDate: null, insuranceValue: 0, insuranceDueDate: null,
    installmentValue: 0, installmentsRemaining: null, oilIntervalKm: 10000, lastOilChangeKm: null, notes: '', active: true,
  });
  const [f, setF] = useState(blank);
  const [tab, setTab] = useState<'dados' | 'custos' | 'manut'>('dados');
  useEffect(() => { if (open) { setF(editing ? { ...editing } : blank()); setTab('dados'); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open, editing]);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const save = async () => {
    if (!f.name.trim()) { toast('Dê um nome ao veículo (ex.: Onix prata)', 'error'); setTab('dados'); return; }
    const payload = { ...f, plate: f.plate.toUpperCase().replace(/[^A-Z0-9]/g, ''), ipvaDueDate: f.ipvaDueDate || null, licensingDueDate: f.licensingDueDate || null, insuranceDueDate: f.insuranceDueDate || null };
    delete (payload as any).id;
    const ok = editing ? await update('vehicles', editing.id, payload) : await insert('vehicles', payload);
    if (ok) { toast('Veículo salvo'); onClose(); if (!editing && Array.isArray(ok) && ok[0]) go('veiculos', ok[0].id); }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Editar veículo' : 'Novo veículo'} footer={<Button className="w-full" onClick={save}>Salvar</Button>}>
      <Segmented className="mb-4" value={tab} onChange={setTab} options={[{ value: 'dados', label: 'Dados' }, { value: 'custos', label: 'Custos' }, { value: 'manut', label: 'Manutenção' }]} />
      {tab === 'dados' && (
        <div className="space-y-4">
          <Field label="Apelido"><Input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex.: Onix prata" autoFocus /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Placa"><Input value={f.plate} onChange={(e) => set('plate', e.target.value.toUpperCase())} placeholder="ABC1D23" maxLength={8} className="font-mono uppercase" /></Field>
            <Field label="Ano"><Input type="number" inputMode="numeric" value={f.year ?? ''} onChange={(e) => set('year', e.target.value ? Number(e.target.value) : null)} /></Field>
            <Field label="Marca"><Input value={f.brand ?? ''} onChange={(e) => set('brand', e.target.value)} placeholder="Chevrolet" /></Field>
            <Field label="Modelo"><Input value={f.model ?? ''} onChange={(e) => set('model', e.target.value)} placeholder="Onix 1.0 LT" /></Field>
            <Field label="Cor"><Input value={f.color ?? ''} onChange={(e) => set('color', e.target.value)} /></Field>
            <Field label="Combustível"><Select value={f.fuelType} onChange={(e) => set('fuelType', e.target.value)} options={['Flex', 'Gasolina', 'Etanol', 'Diesel', 'GNV', 'Híbrido', 'Elétrico']} /></Field>
          </div>
          <Field label="RENAVAM (opcional)"><Input inputMode="numeric" value={f.renavam ?? ''} onChange={(e) => set('renavam', e.target.value.replace(/\D/g, ''))} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Hodômetro atual"><NumberInput value={f.odometer} onChange={(v) => set('odometer', Math.round(v))} suffix="km" /></Field>
            <Field label="Consumo médio"><NumberInput value={f.fuelConsumption} onChange={(v) => set('fuelConsumption', v)} suffix="km/l" /></Field>
          </div>
        </div>
      )}
      {tab === 'custos' && (
        <div className="space-y-4">
          <Segmented value={f.ownership} onChange={(v) => set('ownership', v)} options={[{ value: 'owned', label: 'Quitado' }, { value: 'financed', label: 'Financiado' }, { value: 'rented', label: 'Alugado' }]} />
          {f.ownership !== 'owned' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label={f.ownership === 'rented' ? 'Aluguel por mês' : 'Parcela mensal'} hint={f.ownership === 'rented' ? 'Semanal × 4,33' : undefined}><MoneyInput value={f.installmentValue} onChange={(v) => set('installmentValue', v)} /></Field>
              {f.ownership === 'financed' && <Field label="Parcelas restantes"><NumberInput value={f.installmentsRemaining ?? 0} onChange={(v) => set('installmentsRemaining', Math.round(v) || null)} /></Field>}
            </div>
          )}
          {f.ownership !== 'rented' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="IPVA (valor anual)"><MoneyInput value={f.ipvaValue} onChange={(v) => set('ipvaValue', v)} /></Field>
                <Field label="Vencimento IPVA"><Input type="date" value={f.ipvaDueDate ?? ''} onChange={(e) => set('ipvaDueDate', e.target.value)} /></Field>
                <Field label="Licenciamento"><MoneyInput value={f.licensingValue} onChange={(v) => set('licensingValue', v)} /></Field>
                <Field label="Vencimento licenc."><Input type="date" value={f.licensingDueDate ?? ''} onChange={(e) => set('licensingDueDate', e.target.value)} /></Field>
                <Field label="Seguro (por mês)"><MoneyInput value={f.insuranceValue} onChange={(v) => set('insuranceValue', v)} /></Field>
                <Field label="Renovação seguro"><Input type="date" value={f.insuranceDueDate ?? ''} onChange={(e) => set('insuranceDueDate', e.target.value)} /></Field>
              </div>
            </>
          )}
        </div>
      )}
      {tab === 'manut' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Troca de óleo a cada"><NumberInput value={f.oilIntervalKm} onChange={(v) => set('oilIntervalKm', Math.round(v))} suffix="km" /></Field>
            <Field label="Última troca (hodômetro)"><NumberInput value={f.lastOilChangeKm ?? 0} onChange={(v) => set('lastOilChangeKm', Math.round(v) || null)} suffix="km" /></Field>
          </div>
          <Field label="Anotações"><textarea className="min-h-24 w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none focus:border-brand-500/60" value={f.notes ?? ''} onChange={(e) => set('notes', e.target.value)} placeholder="Pneus trocados em…, correia dentada em…" /></Field>
        </div>
      )}
    </Modal>
  );
}
