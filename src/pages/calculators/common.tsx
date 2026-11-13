import type { ReactNode } from 'react';
import { Card, Field, NumberInput, Segmented } from '../../components/ui';

/** Layout padrão: entradas à esquerda, resultado à direita (empilha no celular). */
export function CalcLayout({ inputs, result }: { inputs: ReactNode; result: ReactNode }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_1fr]">
      <Card className="h-fit space-y-4">{inputs}</Card>
      <div className="space-y-4">{result}</div>
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

export function Big({ label, value, tone = 'text-white', sub }: { label: string; value: ReactNode; tone?: string; sub?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export function Tip({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3 text-xs leading-relaxed text-sky-200/80">{children}</p>;
}

export const toMonthly = (pct: number, period: 'mes' | 'ano') => (period === 'mes' ? pct / 100 : Math.pow(1 + pct / 100, 1 / 12) - 1);
export const toMonths = (n: number, unit: 'meses' | 'anos') => Math.max(0, Math.round(unit === 'anos' ? n * 12 : n));
