import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Bookmark, Flag, History, Landmark, Lightbulb } from 'lucide-react';
import { useData } from '../../data/DataProvider';
import { useToast } from '../../data/toast';
import { localISODate } from '../../lib/format';
import { getCachedRates, loadRates, setManualRates, type Rates } from '../../lib/rates';
import { hasErrors, rules, validate } from '../../lib/validate';
import { go } from '../../router';
import { Button, Card, ConfirmDelete, Field, Input, Modal, MoneyInput, NumberInput, Row, Segmented, Stat, type Tone } from '../../components/ui';

/** Layout padrão: entradas à esquerda, resultado à direita (empilha no celular). */
export function CalcLayout({ inputs, result, sim }: { inputs: ReactNode; result: ReactNode; sim?: SimProps }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_1fr]">
      <Card className="h-fit space-y-4">{inputs}</Card>
      <div className="min-w-0 space-y-4">{sim && <SimBar {...sim} />}{result}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Simulações salvas e "virar meta"
// ---------------------------------------------------------------------------
export interface SimGoal { description: string; target: number; current?: number; deadline?: string | null }
export interface SimProps { calc: string; label: string; values: Record<string, unknown>; onLoad: (v: Record<string, any>) => void; summary: string; goal?: SimGoal | null }

/** Junta vários useState num objeto só, para salvar e recarregar: bindState({ a: [a, setA], b: [b, setB] }). */
export function bindState(entries: Record<string, [unknown, (v: any) => void]>) {
  return {
    values: Object.fromEntries(Object.entries(entries).map(([k, [v]]) => [k, v])),
    onLoad: (vals: Record<string, any>) => { for (const [k, [, set]] of Object.entries(entries)) if (k in vals) set(vals[k]); },
  };
}

// Simulação escolhida na tela inicial das calculadoras, aplicada quando a calculadora abre.
let pending: { calc: string; values: Record<string, unknown> } | null = null;
export const openSimulation = (calc: string, values: Record<string, unknown>) => { pending = { calc, values }; };

function SimBar({ calc, label, values, onLoad, summary, goal }: SimProps) {
  const { data, insert, remove } = useData();
  const toast = useToast();
  const saved = data.simulations.filter((x) => x.calc === calc);
  const [saveOpen, setSaveOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (pending?.calc === calc) { onLoad(pending.values); pending = null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calc]);

  const save = async () => {
    const e = rules.required(title, 'Nome') || rules.maxLength(title, 60, 'Nome');
    setError(e || null);
    if (e) return;
    if (await insert('simulations', { calc, title: title.trim(), values, summary })) { toast('Simulação salva'); setSaveOpen(false); }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="soft" className="min-h-10 px-3.5" onClick={() => { setTitle(`${label} · ${new Date().toLocaleDateString('pt-BR')}`); setError(null); setSaveOpen(true); }}><Bookmark size={15} /> Salvar</Button>
      {goal && goal.target > 0 && <Button variant="soft" className="min-h-10 px-3.5 text-emerald-300" onClick={() => setGoalOpen(true)}><Flag size={15} /> Virar meta</Button>}
      {saved.length > 0 && <Button variant="ghost" className="min-h-10 px-3.5" onClick={() => setListOpen(true)}><History size={15} /> Salvas ({saved.length})</Button>}

      <Modal open={saveOpen} onClose={() => setSaveOpen(false)} title="Salvar simulação" footer={<Button className="w-full" onClick={save}>Salvar</Button>}>
        <div className="space-y-4">
          <Field label="Nome" error={error}><Input value={title} onChange={(e) => { setTitle(e.target.value); setError(null); }} maxLength={60} autoFocus /></Field>
          <p className="whitespace-pre-line rounded-2xl bg-white/[.03] p-3 text-xs text-slate-400 ring-1 ring-white/5">{summary}</p>
        </div>
      </Modal>
      <Modal open={listOpen} onClose={() => setListOpen(false)} title="Simulações salvas">
        <ul className="space-y-2.5">
          {saved.map((x) => (
            <Row key={x.id} icon={<History size={17} />} title={x.title} subtitle={x.summary.split('\n')[0]}
              onClick={() => { onLoad(x.values); setListOpen(false); toast('Simulação carregada'); }}
              actions={<ConfirmDelete onConfirm={() => remove('simulations', x.id)} />} />
          ))}
        </ul>
      </Modal>
      {goal && <GoalFromSim open={goalOpen} onClose={() => setGoalOpen(false)} goal={goal} />}
    </div>
  );
}

function GoalFromSim({ open, onClose, goal }: { open: boolean; onClose: () => void; goal: SimGoal }) {
  const { insert } = useData();
  const toast = useToast();
  const [f, setF] = useState({ description: goal.description, target: goal.target, current: goal.current ?? 0, deadline: goal.deadline ?? '' });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  useEffect(() => { if (open) { setErrors({}); setF({ description: goal.description, target: Math.round(goal.target * 100) / 100, current: goal.current ?? 0, deadline: goal.deadline ?? '' }); } }, [open, goal]);
  const save = async () => {
    const e = validate({
      description: [rules.required(f.description, 'Nome da meta')],
      target: [rules.positive(f.target, 'Valor da meta')],
      current: [f.current > f.target && 'O valor guardado já passa da meta'],
      deadline: [rules.optionalDate(f.deadline, 'Prazo'), f.deadline && f.deadline <= localISODate() && 'O prazo precisa ser uma data futura'],
    });
    setErrors(e);
    if (hasErrors(e)) return;
    if (await insert('goals', { description: f.description.trim(), targetAmount: f.target, currentAmount: f.current, type: 'financial', deadline: f.deadline || null })) {
      toast('Meta criada', 'ok', { label: 'Ver', onClick: () => go('metas') });
      onClose();
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Transformar em meta" footer={<Button className="w-full" onClick={save}>Criar meta</Button>}>
      <div className="space-y-4">
        <Field label="Nome da meta" error={errors.description}><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={60} /></Field>
        <Field label="Valor da meta" error={errors.target}><MoneyInput value={f.target} onChange={(v) => setF({ ...f, target: v })} /></Field>
        <Field label="Já tenho guardado" error={errors.current}><MoneyInput value={f.current} onChange={(v) => setF({ ...f, current: v })} /></Field>
        <Field label="Prazo (opcional)" error={errors.deadline}><Input type="date" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

/** Data daqui a N meses (para prazos de metas). */
export const monthsFromNow = (n: number) => { const d = new Date(); d.setMonth(d.getMonth() + Math.max(1, Math.round(n))); return localISODate(d); };

// ---------------------------------------------------------------------------
// Taxas do Banco Central
// ---------------------------------------------------------------------------
export function useRates() {
  const [rates, setRates] = useState<Rates>(getCachedRates);
  const [loading, setLoading] = useState(false);
  const refresh = async (force = false) => { setLoading(true); setRates(await loadRates(force)); setLoading(false); };
  useEffect(() => { void refresh(); }, []);
  return { rates, loading, refresh, setManual: (r: Pick<Rates, 'selic' | 'cdi' | 'ipca'> | null) => { setManualRates(r); void refresh(true); } };
}

const SOURCE_LABEL: Record<Rates['source'], string> = { 'banco-central': 'Banco Central', manual: 'valor manual', padrao: 'valor padrão (sem conexão)', guardado: 'último valor salvo (sem conexão)' };

export function RatesBar({ r }: { r: ReturnType<typeof useRates> }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ selic: r.rates.selic, cdi: r.rates.cdi, ipca: r.rates.ipca });
  const pct = (v: number) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  return (
    <div className="surface flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[1.4rem] px-4 py-3 text-sm">
      <Landmark size={16} className="text-sky-400" />
      <span className="text-slate-300">Selic <strong className="font-mono text-white">{pct(r.rates.selic)}</strong></span>
      <span className="text-slate-300">CDI <strong className="font-mono text-white">{pct(r.rates.cdi)}</strong></span>
      <span className="text-slate-300">IPCA 12m <strong className="font-mono text-white">{pct(r.rates.ipca)}</strong></span>
      <span className="label text-slate-500">{r.loading ? 'atualizando…' : `${SOURCE_LABEL[r.rates.source]}${r.rates.updatedAt && r.rates.source !== 'padrao' ? ` · ${new Date(r.rates.updatedAt).toLocaleDateString('pt-BR')}` : ''}`}</span>
      <button type="button" className="label press ml-auto rounded-full bg-white/[.05] px-3 py-1.5 text-brand-300 ring-1 ring-white/10" onClick={() => { setF({ selic: r.rates.selic, cdi: r.rates.cdi, ipca: r.rates.ipca }); setOpen(true); }}>Editar</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Taxas de referência"
        footer={<div className="grid grid-cols-2 gap-2.5"><Button variant="soft" onClick={() => { r.setManual(null); setOpen(false); }}>Usar automático</Button><Button onClick={() => { r.setManual(f); setOpen(false); }}>Usar estes valores</Button></div>}>
        <div className="space-y-4">
          <p className="text-sm text-slate-400">O app busca as taxas no Banco Central. Sem internet, ou se quiser simular outro cenário, digite aqui.</p>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Selic a.a."><NumberInput value={f.selic} onChange={(v) => setF({ ...f, selic: v })} suffix="%" /></Field>
            <Field label="CDI a.a."><NumberInput value={f.cdi} onChange={(v) => setF({ ...f, cdi: v })} suffix="%" /></Field>
            <Field label="IPCA 12m"><NumberInput value={f.ipca} onChange={(v) => setF({ ...f, ipca: v })} suffix="%" /></Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export function RateField({ label = 'Taxa de juros', value, onChange, period, onPeriod }: { label?: string; value: number; onChange: (v: number) => void; period: 'mes' | 'ano'; onPeriod: (p: 'mes' | 'ano') => void }) {
  return (
    <Field label={label}>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <NumberInput value={value} onChange={onChange} suffix={period === 'mes' ? '% a.m.' : '% a.a.'} />
        <Segmented value={period} onChange={onPeriod} options={[{ value: 'mes', label: 'mês' }, { value: 'ano', label: 'ano' }]} />
      </div>
    </Field>
  );
}

export function TermField({ label = 'Prazo', value, onChange, unit, onUnit }: { label?: string; value: number; onChange: (v: number) => void; unit: 'meses' | 'anos'; onUnit: (u: 'meses' | 'anos') => void }) {
  return (
    <Field label={label}>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <NumberInput value={value} onChange={onChange} suffix={unit} />
        <Segmented value={unit} onChange={onUnit} options={[{ value: 'meses', label: 'meses' }, { value: 'anos', label: 'anos' }]} />
      </div>
    </Field>
  );
}

const TEXT_TO_TONE: Record<string, Tone> = { 'text-emerald-400': 'good', 'text-rose-400': 'bad', 'text-amber-400': 'warn', 'text-sky-400': 'info' };

/** Resultado de calculadora: cartão colorido (o principal fica em destaque). */
export function Big({ label, value, tone = 'text-white', sub }: { label: string; value: ReactNode; tone?: string; sub?: ReactNode }) {
  const t = TEXT_TO_TONE[tone] ?? 'brand';
  return <Stat label={label} value={value} tone={t} sub={sub} />;
}

export function Tip({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-[1.4rem] border border-sky-500/20 bg-sky-500/[.06] p-4">
      <Lightbulb size={18} className="mt-0.5 shrink-0 text-sky-400" />
      <p className="text-xs leading-relaxed text-sky-100/80">{children}</p>
    </div>
  );
}

/** Veredito em destaque (ex.: "Compensa parcelar"). */
export function Verdict({ tone, title, children }: { tone: Tone; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="solid shine rounded-[1.75rem] p-5" style={{ '--tone': ({ good: '#10b981', bad: '#f43f5e', warn: '#f59e0b', info: '#3b82f6', brand: '#16a34a' } as Record<string, string>)[tone] ?? '#16a34a' } as React.CSSProperties}>
      <p className="relative font-display text-xl font-black">{title}</p>
      {children && <p className="relative mt-1 text-sm font-medium text-white/85">{children}</p>}
    </div>
  );
}

export const toMonthly = (pct: number, period: 'mes' | 'ano') => (period === 'mes' ? pct / 100 : Math.pow(1 + pct / 100, 1 / 12) - 1);
export const toMonths = (n: number, unit: 'meses' | 'anos') => Math.max(0, Math.round(unit === 'anos' ? n * 12 : n));

/**
 * Preenche campos com as taxas do Banco Central até a pessoa mexer neles (ou carregar uma simulação).
 * Devolve a função que marca "mexeu".
 */
export function useRateSync(apply: () => void, deps: unknown[]) {
  const dirty = useRef(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!dirty.current) apply(); }, deps);
  return () => { dirty.current = true; };
}
