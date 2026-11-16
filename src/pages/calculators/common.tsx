import type { ReactNode } from 'react';
import { Lightbulb } from 'lucide-react';
import { Card, Field, NumberInput, Segmented, Stat, type Tone } from '../../components/ui';

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
