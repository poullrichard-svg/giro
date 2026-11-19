import { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, ChartLine, ChevronRight, EyeOff } from 'lucide-react';
import { useData } from '../data/DataProvider';
import { usePrefs } from '../data/usePrefs';
import { useToast } from '../data/toast';
import { buildPositions, portfolioSummary } from '../lib/portfolio';
import { useMarket } from '../lib/marketData';
import { formatBRL, formatNumber } from '../lib/format';
import { cx } from './ui';

/** Início: como a carteira e os ativos dela estão hoje. Só busca cotações se o cartão estiver ligado. */
export function InvestStrip() {
  const { data } = useData();
  const { homeInvest, setHomeInvest, visible } = usePrefs();
  const show = homeInvest && visible('investimentos') && data.investments.length > 0;
  return show ? <InvestStripCard onHide={() => setHomeInvest(false)} /> : null;
}

function InvestStripCard({ onHide }: { onHide: () => void }) {
  const { data } = useData();
  const toast = useToast();
  const m = useMarket();
  const assets = m.data?.assets ?? [];
  const positions = useMemo(() => buildPositions(data.investments, assets), [data.investments, assets]);
  const sum = useMemo(() => portfolioSummary(positions), [positions]);
  const quotes = new Map(assets.map((a) => [a.ticker, a]));
  const moving = positions.filter((p) => p.quantity > 0 && quotes.get(p.ticker)?.changePct != null)
    .map((p) => ({ p, pct: quotes.get(p.ticker)!.changePct! }));
  const up = moving.filter((x) => x.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, 3);
  const down = moving.filter((x) => x.pct < 0).sort((a, b) => a.pct - b.pct).slice(0, 3);
  const dayPct = sum.value - sum.day > 0 ? (sum.day / (sum.value - sum.day)) * 100 : 0;

  const Item = ({ t, pct, day }: { t: string; pct: number; day: number | null }) => (
    <li className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-black/20 px-3 py-2">
      <span className="truncate font-display text-sm font-black text-white">{t}</span>
      <span className={cx('flex shrink-0 items-center gap-1 font-mono text-[11px] font-extrabold', pct > 0 ? 'text-emerald-300' : 'text-rose-300')}>
        {pct > 0 ? <ArrowUpRight size={12} strokeWidth={3} /> : <ArrowDownRight size={12} strokeWidth={3} />}{pct > 0 ? '+' : ''}{formatNumber(pct, 2)}%
        {day != null && <span className="hidden text-white/50 sm:inline">· {day > 0 ? '+' : ''}{formatBRL(day)}</span>}
      </span>
    </li>
  );

  return (
    <section className="tinted relative mb-4 overflow-hidden rounded-[1.8rem] p-4 md:p-5" style={{ '--tone': sum.day >= 0 ? '#0ea5e9' : '#e11d48' } as React.CSSProperties} data-testid="invest-strip">
      <span className="watermark text-white"><ChartLine size={120} strokeWidth={1.2} /></span>
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <a href="#/investimentos/carteira" className="min-w-0">
            <p className="label flex items-center gap-1.5 text-white/70">Meus investimentos hoje <ChevronRight size={13} /></p>
            <p className="mt-0.5 font-display text-2xl font-black text-white">{formatBRL(sum.value)}</p>
            <p className={cx('text-sm font-bold', sum.day > 0 ? 'text-emerald-200' : sum.day < 0 ? 'text-rose-200' : 'text-white/70')}>
              {m.loading && !m.data ? 'Buscando cotações…' : sum.day === 0 ? 'Sem variação hoje' : `${sum.day > 0 ? '+' : ''}${formatBRL(sum.day)} (${dayPct > 0 ? '+' : ''}${formatNumber(dayPct, 2)}%) hoje`}
            </p>
          </a>
          <button type="button" aria-label="Esconder do Início" title="Esconder do Início" onClick={() => { onHide(); toast('Escondido do Início. Para mostrar de novo: Ajustes → Personalizar o app.'); }}
            className="press shrink-0 rounded-xl bg-black/25 p-2 text-white/70 hover:text-white"><EyeOff size={16} /></button>
        </div>
        {(up.length > 0 || down.length > 0) && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="min-w-0"><p className="label mb-1.5 text-emerald-200/80">Subindo</p>
              {up.length ? <ul className="space-y-1.5" data-testid="invest-up">{up.map(({ p, pct }) => <Item key={p.ticker} t={p.ticker} pct={pct} day={p.dayChange} />)}</ul> : <p className="text-xs text-white/50">Nenhum hoje</p>}</div>
            <div className="min-w-0"><p className="label mb-1.5 text-rose-200/80">Caindo</p>
              {down.length ? <ul className="space-y-1.5" data-testid="invest-down">{down.map(({ p, pct }) => <Item key={p.ticker} t={p.ticker} pct={pct} day={p.dayChange} />)}</ul> : <p className="text-xs text-white/50">Nenhum hoje</p>}</div>
          </div>
        )}
      </div>
    </section>
  );
}
