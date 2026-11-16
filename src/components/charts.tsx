import { useId } from 'react';
import { formatBRL } from '../lib/format';
import { Money } from './ui';

export function Donut({ data, size = 176 }: { data: Array<{ label: string; value: number; color: string }>; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total <= 0) return <p className="py-10 text-center text-xs text-slate-500">Sem despesas no período</p>;
  const r = 40;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 100 100" className="-rotate-90" role="img" aria-label="Gastos por categoria">
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,.05)" strokeWidth="12" /><circle cx="50" cy="50" r="31" fill="#0b0915" stroke="rgba(255,255,255,.06)" strokeWidth=".6" />
          {data.map((d, i) => {
            const len = (d.value / total) * c;
            const el = (
              <circle key={d.label} className="donut-seg" cx="50" cy="50" r={r} fill="none" stroke={d.color} strokeWidth="12"
                strokeDasharray={`${Math.max(0, len - 1.2)} ${c}`} strokeDashoffset={-acc}
                style={{ animationDelay: `${i * 0.08}s`, filter: `drop-shadow(0 0 4px ${d.color}88)` }}>
                <title>{`${d.label}: ${formatBRL(d.value)}`}</title>
              </circle>
            );
            acc += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="label text-slate-500">Total</span>
          <Money value={total} className="mt-1 font-display text-base font-black text-white" />
        </div>
      </div>
      <ul className="stagger-x grid w-full gap-2">
        {data.slice(0, 6).map((d) => (
          <li key={d.label} className="surface surface-hover flex items-center gap-3 rounded-2xl px-3.5 py-2.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color, boxShadow: `0 0 10px ${d.color}` }} />
            <div className="min-w-0 flex-1">
              <p className="label truncate !tracking-[.1em] text-white">{d.label}</p>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/5"><div className="fill-x h-full rounded-full" style={{ width: `${(d.value / total) * 100}%`, background: d.color }} /></div>
            </div>
            <div className="text-right">
              <p className="font-mono text-xs font-extrabold text-white">{formatBRL(d.value)}</p>
              <p className="font-mono text-[10px] font-bold text-slate-500">{((d.value / total) * 100).toFixed(1)}%</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Barras agrupadas (ex.: receitas x despesas por mês), crescendo de baixo para cima. */
export function Bars({ data, series }: { data: Array<{ label: string; values: number[] }>; series: Array<{ name: string; color: string; to?: string }> }) {
  const max = Math.max(1, ...data.flatMap((d) => d.values));
  return (
    <div>
      <div className="relative flex h-44 items-end gap-2">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-5 top-0 flex flex-col justify-between">
          {[0, 1, 2, 3].map((i) => <div key={i} className="border-t border-dashed border-white/[.06]" />)}
        </div>
        {data.map((d, di) => (
          <div key={d.label} className="group relative flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <div className="flex h-full w-full items-end justify-center gap-1">
              {d.values.map((v, i) => (
                <div key={i} title={`${series[i].name}: ${formatBRL(v)}`}
                  className="bar-grow w-full max-w-6 rounded-t-[10px] rounded-b-[4px] transition duration-300 group-hover:brightness-125"
                  style={{ height: `${(v / max) * 100}%`, minHeight: v > 0 ? 3 : 0, animationDelay: `${di * 0.06 + i * 0.04}s`,
                    background: `linear-gradient(180deg, ${series[i].color}, ${series[i].to ?? series[i].color + '55'})`, boxShadow: v > 0 ? `0 0 14px ${series[i].color}55` : undefined }} />
              ))}
            </div>
            <span className="label text-slate-500 transition group-hover:text-white">{d.label}</span>
          </div>
        ))}
      </div>
      <div className="label mt-4 flex gap-5 text-slate-400">
        {series.map((s) => (<span key={s.name} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: s.color, boxShadow: `0 0 8px ${s.color}` }} />{s.name}</span>))}
      </div>
    </div>
  );
}

/** Linha com área em gradiente para evolução de patrimônio / saldo. */
export function Line({ points, color = '#a78bfa', secondary }: { points: number[]; color?: string; secondary?: number[] }) {
  const id = useId();
  if (points.length < 2) return null;
  const all = [...points, ...(secondary ?? [])];
  const max = Math.max(...all, 1);
  const toPath = (arr: number[]) => arr.map((v, i) => `${(i / (arr.length - 1)) * 100},${40 - (v / max) * 37}`).join(' ');
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-36 w-full overflow-visible" role="img" aria-label="Evolução">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity=".45" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {secondary && <polyline points={toPath(secondary)} fill="none" stroke="#64748b" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
      <polyline points={`0,40 ${toPath(points)} 100,40`} fill={`url(#${id})`} />
      <polyline points={toPath(points)} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
    </svg>
  );
}
