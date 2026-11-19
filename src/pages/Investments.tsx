import { useMemo, useState } from 'react';
import { Activity, ArrowDownRight, ArrowUpRight, Building, ChartLine, Info, Landmark, RefreshCw, Search, Star, TrendingDown, TrendingUp, WifiOff } from 'lucide-react';
import { Button, Card, Empty, IconButton, Input, PageHeader, Segmented, cx } from '../components/ui';
import { breadth, CATALOG, FII_KINDS, fiiKindOf, search, segmentOf, sortForList, topMovers, type Asset, type FiiKind } from '../lib/market';
import { useMarket } from '../lib/marketData';
import { usePrefs } from '../data/usePrefs';
import { useRates } from './calculators/common';
import { formatBRL, formatNumber } from '../lib/format';
import { go } from '../router';

type Tab = 'destaques' | 'acoes' | 'fiis' | 'etfs' | 'favoritos';
const TABS: Array<{ value: Tab; label: string }> = [
  { value: 'destaques', label: 'Hoje' }, { value: 'acoes', label: 'Ações' }, { value: 'fiis', label: 'FIIs' }, { value: 'etfs', label: 'ETFs' }, { value: 'favoritos', label: '★' },
];
const TYPE_COLOR: Record<Asset['type'], string> = { acao: '#3b82f6', fii: '#f59e0b', etf: '#8b5cf6', bdr: '#64748b' };
const pct = (v: number | null) => (v == null ? '—' : `${v > 0 ? '+' : ''}${formatNumber(v, 2)}%`);

function Change({ v, big }: { v: number | null; big?: boolean }) {
  const up = (v ?? 0) > 0; const down = (v ?? 0) < 0;
  return (
    <span className={cx('inline-flex items-center gap-0.5 rounded-full font-mono font-extrabold', big ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-[11px]', up ? 'bg-emerald-500/15 text-emerald-300' : down ? 'bg-rose-500/15 text-rose-300' : 'bg-white/10 text-slate-300')}>
      {up ? <ArrowUpRight size={big ? 15 : 12} strokeWidth={3} /> : down ? <ArrowDownRight size={big ? 15 : 12} strokeWidth={3} /> : null}{pct(v)}
    </span>
  );
}

function AssetRow({ a, rank }: { a: Asset; rank?: number }) {
  const { watchlist, toggleWatch } = usePrefs();
  const fav = watchlist.includes(a.ticker);
  const kind = fiiKindOf(a);
  const color = TYPE_COLOR[a.type];
  return (
    <li className="surface flex min-w-0 items-center gap-3 rounded-[1.3rem] p-3" data-ticker={a.ticker}>
      {rank != null && <span className="w-4 shrink-0 text-center font-display text-sm font-black text-slate-500">{rank}</span>}
      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl text-[10px] font-black text-white" style={{ background: `color-mix(in srgb, ${color} 30%, #0b0915)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 45%, transparent)` }}>
        {a.logo && !a.logo.includes('BRAPI') ? <img src={a.logo} alt="" className="h-full w-full bg-white object-contain p-1" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : a.ticker.slice(0, 4)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display font-black text-white">{a.ticker}</p>
        <p className="truncate text-[11px] text-slate-500">{kind && <span className="label mr-1 rounded-full px-1.5 py-0.5 !text-[9px]" style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}>{FII_KINDS.find((k) => k.value === kind)?.label}</span>}{segmentOf(a)} · {a.name}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-mono text-sm font-extrabold text-white">{a.price != null ? formatBRL(a.price) : '—'}</p>
        <Change v={a.changePct} />
      </div>
      <IconButton label={fav ? `Tirar ${a.ticker} dos favoritos` : `Favoritar ${a.ticker}`} onClick={() => toggleWatch(a.ticker)} className={cx('h-9 w-9', fav ? 'bg-amber-400/15 text-amber-300 ring-amber-400/30' : '')}><Star size={16} fill={fav ? 'currentColor' : 'none'} /></IconButton>
    </li>
  );
}

function MoverCard({ title, icon, tone, list }: { title: string; icon: React.ReactNode; tone: string; list: Asset[] }) {
  return (
    <section className="tinted relative overflow-hidden rounded-[1.8rem] p-4" style={{ '--tone': tone } as React.CSSProperties}>
      <p className="label mb-3 flex items-center gap-2 text-white/80">{icon} {title}</p>
      {list.length ? <ul className="space-y-2">{list.map((a, i) => <AssetRow key={a.ticker} a={a} rank={i + 1} />)}</ul> : <p className="py-4 text-center text-xs text-white/60">Nada por aqui agora.</p>}
    </section>
  );
}

export default function Investments({ tab: tabParam }: { tab?: string }) {
  const m = useMarket();
  const rates = useRates();
  const { watchlist } = usePrefs();
  const tab: Tab = (TABS.some((t) => t.value === tabParam) ? tabParam : 'destaques') as Tab;
  const [q, setQ] = useState('');
  const [fiiKind, setFiiKind] = useState<FiiKind | 'todos'>('todos');
  const [segment, setSegment] = useState('todos');
  const assets = m.data?.assets ?? [];
  const movers = useMemo(() => topMovers(assets, 5), [assets]);
  const br = useMemo(() => breadth(assets), [assets]);
  const ofType = (t: Asset['type']) => sortForList(assets.filter((a) => a.type === t));
  const stocks = useMemo(() => ofType('acao'), [assets]); // eslint-disable-line react-hooks/exhaustive-deps
  const segments = useMemo(() => [...new Set(stocks.filter((a) => CATALOG[a.ticker]).map(segmentOf))].sort(), [stocks]);
  const list = useMemo(() => {
    let l: Asset[] = [];
    if (tab === 'acoes') l = stocks.filter((a) => segment === 'todos' || segmentOf(a) === segment);
    if (tab === 'fiis') l = ofType('fii').filter((a) => fiiKind === 'todos' || fiiKindOf(a) === fiiKind);
    if (tab === 'etfs') l = ofType('etf');
    if (tab === 'favoritos') l = assets.filter((a) => watchlist.includes(a.ticker));
    return search(l, q).slice(0, 80);
  }, [tab, stocks, segment, fiiKind, assets, watchlist, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const cdiMonth = (Math.pow(1 + rates.rates.cdi / 100, 1 / 12) - 1) * 1000;
  const time = m.data ? new Date(m.data.updatedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <div>
      <PageHeader eyebrow="Bolsa e renda fixa" title="Investimentos" subtitle={time ? `Cotações da B3 com atraso · atualizado ${time}` : 'Cotações da B3 com atraso'}
        actions={<Button variant="soft" onClick={() => m.reload()} disabled={m.loading} aria-label="Atualizar cotações"><RefreshCw size={15} className={m.loading ? 'animate-spin' : ''} /> {m.loading ? 'Atualizando…' : 'Atualizar'}</Button>} />

      {m.error && (
        <div role="status" className={cx('mb-4 flex items-start gap-3 rounded-[1.4rem] p-4 text-sm ring-1', m.data ? 'bg-amber-500/10 text-amber-100 ring-amber-500/20' : 'bg-white/[.04] text-slate-300 ring-white/10')}>
          {m.error === 'offline' ? <WifiOff size={18} className="mt-0.5 shrink-0" /> : <Info size={18} className="mt-0.5 shrink-0" />}
          <p>{m.error === 'offline' ? (m.data ? 'Sem internet: mostrando as últimas cotações salvas.' : 'Sem internet para buscar as cotações.')
            : m.data ? 'Não deu para atualizar agora; mostrando as últimas cotações salvas.'
            : m.error === 'sem-token' ? 'As cotações ainda não estão ligadas neste site. (Administrador: cadastre a chave BRAPI_TOKEN na Vercel.)'
            : 'Cotações indisponíveis no momento. Tente de novo em alguns minutos.'}</p>
        </div>
      )}

      <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="tinted relative overflow-hidden rounded-[2rem] p-5" style={{ '--tone': br.avg >= 0 ? '#10b981' : '#e11d48' } as React.CSSProperties}>
          <span className="watermark text-white"><Activity size={140} strokeWidth={1.2} /></span>
          <div className="relative">
            <p className="label text-white/70">{m.data?.index?.points ? 'Ibovespa' : 'Termômetro do dia'}</p>
            {m.data?.index?.points
              ? <div className="mt-1 flex flex-wrap items-center gap-3"><p className="font-display text-3xl font-black text-white">{formatNumber(m.data.index.points, 0)} pts</p><Change v={m.data.index.changePct} big /></div>
              : <div className="mt-1 flex flex-wrap items-center gap-3"><p className="font-display text-3xl font-black text-white">{br.total ? `${br.up} sobem` : '—'}</p>{br.total > 0 && <Change v={br.avg} big />}</div>}
            {br.total > 0 && (
              <>
                <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-black/30">
                  <div className="bg-emerald-300" style={{ width: `${(br.up / br.total) * 100}%` }} /><div className="bg-white/30" style={{ width: `${(br.flat / br.total) * 100}%` }} /><div className="bg-rose-400" style={{ width: `${(br.down / br.total) * 100}%` }} />
                </div>
                <p className="mt-2 text-xs font-semibold text-white/80">{br.up} em alta · {br.down} em baixa · entre os {br.total} mais conhecidos</p>
              </>
            )}
          </div>
        </section>
        <section className="surface rounded-[2rem] p-5">
          <p className="label flex items-center gap-2 text-slate-400"><Landmark size={14} /> Renda fixa hoje</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[['Selic', rates.rates.selic], ['CDI', rates.rates.cdi], ['IPCA 12m', rates.rates.ipca]].map(([l, v]) => (
              <div key={l as string} className="rounded-2xl bg-white/[.04] p-2.5"><p className="label text-slate-500">{l}</p><p className="font-display text-lg font-black text-white">{formatNumber(v as number, 2)}%</p></div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400">R$ 1.000 a 100% do CDI rendem cerca de <b className="text-emerald-300">{formatBRL(cdiMonth)}</b> por mês (antes do IR). <button type="button" onClick={() => go('calculadoras', 'rendimento')} className="font-bold text-brand-300 underline underline-offset-2">Simular</button></p>
        </section>
      </div>

      <Segmented value={tab} onChange={(t) => go('investimentos', t)} options={TABS} className="mb-4" />

      {tab !== 'destaques' && (
        <div className="relative mb-3"><Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar ticker, nome ou segmento" className="pl-11" aria-label="Buscar ativo" /></div>
      )}

      {tab === 'destaques' && (
        assets.length === 0 ? <Empty icon={<ChartLine size={26} />} title={m.loading ? 'Buscando cotações…' : 'Sem cotações para mostrar'} /> : (
          <div className="grid gap-3 lg:grid-cols-3">
            <MoverCard title="Maiores altas do dia" icon={<TrendingUp size={14} />} tone="#10b981" list={movers.up} />
            <MoverCard title="Maiores baixas do dia" icon={<TrendingDown size={14} />} tone="#e11d48" list={movers.down} />
            <MoverCard title="Mais negociados" icon={<Activity size={14} />} tone="#3b82f6" list={movers.traded} />
          </div>
        )
      )}

      {tab === 'fiis' && (
        <div className="mb-3">
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {[{ value: 'todos' as const, label: 'Todos' }, ...FII_KINDS].map((k) => (
              <button key={k.value} type="button" onClick={() => setFiiKind(k.value)} className={cx('label press shrink-0 rounded-full px-3.5 py-2 ring-1', fiiKind === k.value ? 'bg-amber-400/20 text-amber-200 ring-amber-400/40' : 'bg-white/[.04] text-slate-400 ring-white/10')}>{k.label}</button>
            ))}
          </div>
          {fiiKind !== 'todos' && <p className="mt-2 flex items-start gap-2 text-xs text-slate-400"><Building size={14} className="mt-0.5 shrink-0 text-amber-300" />{FII_KINDS.find((k) => k.value === fiiKind)?.text}</p>}
        </div>
      )}
      {tab === 'acoes' && segments.length > 0 && (
        <div className="no-scrollbar -mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
          {['todos', ...segments].map((sg) => (
            <button key={sg} type="button" onClick={() => setSegment(sg)} className={cx('label press shrink-0 rounded-full px-3.5 py-2 ring-1', segment === sg ? 'bg-sky-400/20 text-sky-200 ring-sky-400/40' : 'bg-white/[.04] text-slate-400 ring-white/10')}>{sg === 'todos' ? 'Todas' : sg}</button>
          ))}
        </div>
      )}
      {tab !== 'destaques' && (
        list.length ? <ul className="stagger grid gap-2 lg:grid-cols-2">{list.map((a) => <AssetRow key={a.ticker} a={a} />)}</ul>
          : <Empty icon={tab === 'favoritos' ? <Star size={24} /> : <Search size={24} />} title={tab === 'favoritos' ? 'Nenhum favorito ainda' : m.loading ? 'Buscando cotações…' : 'Nada encontrado'} text={tab === 'favoritos' ? 'Toque na estrela de um ativo para acompanhar aqui.' : undefined} />
      )}

      <Card className="mt-5" title={<span className="flex items-center gap-2"><Info size={15} className="text-sky-400" /> Entenda os tipos</span>}>
        <div className="grid gap-3 text-sm text-slate-300 md:grid-cols-2">
          <p><b className="text-white">Ações:</b> pedaços de empresas. Podem subir ou cair bastante e pagar dividendos. Para longo prazo.</p>
          <p><b className="text-white">FIIs de tijolo:</b> donos de imóveis (galpões, shoppings, escritórios). Pagam aluguéis todo mês.</p>
          <p><b className="text-white">FIIs de papel:</b> emprestam para o setor imobiliário (CRIs). Renda acompanha juros e inflação.</p>
          <p><b className="text-white">ETFs:</b> uma cesta pronta (ex.: BOVA11 = Ibovespa, IVVB11 = bolsa dos EUA).</p>
          <p><b className="text-white">Renda fixa:</b> Tesouro, CDB, LCI/LCA. Antes da bolsa, monte sua reserva de emergência aqui.</p>
          <p><b className="text-white">Alta do dia ≠ bom investimento.</b> Olhe o histórico, a empresa e diversifique.</p>
        </div>
        <p className="mt-4 text-[11px] text-slate-500">Informação, não recomendação de compra ou venda. Cotações com atraso, fonte: {m.data?.source ?? 'brapi.dev (B3)'}.</p>
      </Card>
    </div>
  );
}
