import { formatBRL } from '../lib/format';

export function Donut({ data, size = 160 }: { data: Array<{ label: string; value: number; color: string }>; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total <= 0) return <p className="py-8 text-center text-xs text-slate-500">Sem despesas no período</p>;
  const r = 40;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <svg width={size} height={size} viewBox="0 0 100 100" className="-rotate-90 shrink-0" role="img" aria-label="Gastos por categoria">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#1e293b" strokeWidth="14" />
        {data.map((d) => {
          const len = (d.value / total) * c;
          const el = <circle key={d.label} cx="50" cy="50" r={r} fill="none" stroke={d.color} strokeWidth="14" strokeDasharray={`${Math.max(0, len - 0.6)} ${c}`} strokeDashoffset={-acc}><title>{`${d.label}: ${formatBRL(d.value)}`}</title></circle>;
          acc += len;
          return el;
        })}
      </svg>
      <ul className="w-full space-y-1.5 text-xs">
        {data.slice(0, 8).map((d) => (
          <li key={d.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
            <span className="flex-1 truncate text-slate-300">{d.label}</span>
            <span className="text-slate-500">{((d.value / total) * 100).toFixed(0)}%</span>
            <span className="w-24 text-right font-medium text-slate-200">{formatBRL(d.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Barras agrupadas (ex.: receitas x despesas por mês). */
export function Bars({ data, series }: { data: Array<{ label: string; values: number[] }>; series: Array<{ name: string; color: string }> }) {
  const max = Math.max(1, ...data.flatMap((d) => d.values));
  return (
    <div>
      <div className="flex h-40 items-end gap-2">
        {data.map((d) => (
          <div key={d.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <div className="flex h-full w-full items-end justify-center gap-0.5">
              {d.values.map((v, i) => (
                <div key={i} title={`${series[i].name}: ${formatBRL(v)}`} className="w-full max-w-4 rounded-t" style={{ height: `${(v / max) * 100}%`, background: series[i].color, minHeight: v > 0 ? 2 : 0 }} />
              ))}
            </div>
            <span className="text-[10px] uppercase text-slate-500">{d.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-4 text-xs text-slate-400">
        {series.map((s) => (<span key={s.name} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.name}</span>))}
      </div>
    </div>
  );
}

/** Linha simples para evolução de patrimônio. */
export function Line({ points, color = '#10b981', secondary }: { points: number[]; color?: string; secondary?: number[] }) {
  if (points.length < 2) return null;
  const all = [...points, ...(secondary ?? [])];
  const max = Math.max(...all, 1);
  const toPath = (arr: number[]) => arr.map((v, i) => `${(i / (arr.length - 1)) * 100},${40 - (v / max) * 38}`).join(' ');
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-32 w-full" role="img" aria-label="Evolução">
      {secondary && <polyline points={toPath(secondary)} fill="none" stroke="#64748b" strokeWidth="0.6" strokeDasharray="1.5 1.5" vectorEffect="non-scaling-stroke" />}
      <polyline points={`0,40 ${toPath(points)} 100,40`} fill={color} opacity="0.12" />
      <polyline points={toPath(points)} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
