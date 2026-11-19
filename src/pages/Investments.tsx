import { useCallback, useMemo, useState } from 'react';
import { Activity, ArrowDownRight, ArrowUpRight, Building, ChartLine, Info, Landmark, RefreshCw, Search, Star, TrendingDown, TrendingUp, WifiOff } from 'lucide-react';
import { Button, Card, Empty, IconButton, Input, PageHeader, Segmented, cx } from '../components/ui';
import { AUVP_EXCLUDED_SEGMENTS, breadth, CATALOG, fundamentalFilter, FII_KINDS, fiiKindOf, search, segmentOf, sortForList, topMovers, type Asset, type FiiKind } from '../lib/market';
import { useMarket } from '../lib/marketData';
import { usePrefs } from '../data/usePrefs';
import { useRates } from './calculators/common';
import { formatBRL, formatNumber } from '../lib/format';
import { go } from '../router';
import { useData } from '../data/DataProvider';
import { AssetSheet, SheetCtx, useAssetSheet } from './investments/AssetSheet';
import { PortfolioTab, type OpPreset } from './investments/Portfolio';
import { guessKind } from '../lib/portfolio';

type Tab = 'carteira' | 'destaques' | 'acoes' | 'fiis' | 'etfs' | 'cripto' | 'metodo' | 'favoritos';
const TABS: Array<{ value: Tab; label: string }> = [
  { value: 'carteira', label: 'Carteira' }, { value: 'destaques', label: 'Hoje' }, { value: 'acoes', label: 'Ações' }, { value: 'fiis', label: 'FIIs' }, { value: 'etfs', label: 'ETFs' },
  { value: 'cripto', label: 'Cripto' }, { value: 'metodo', label: 'Método' }, { value: 'favoritos', label: '★' },
];
const TYPE_COLOR: Record<Asset['type'], string> = { acao: '#3b82f6', fii: '#f59e0b', etf: '#8b5cf6', bdr: '#64748b', cripto: '#f97316' };
let pendingPreset: OpPreset | null = null;
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
  const [logoFailed, setLogoFailed] = useState(false);
  const kind = fiiKindOf(a);
  const color = TYPE_COLOR[a.type];
  const sheet = useAssetSheet();
  return (
    <li className="surface flex min-w-0 items-center gap-3 rounded-[1.3rem] p-3" data-ticker={a.ticker}>
      <button type="button" onClick={() => sheet.open(a)} aria-label={`Ver ficha de ${a.ticker}`} className="press flex min-w-0 flex-1 items-center gap-3 text-left">
      {rank != null && <span className="w-4 shrink-0 text-center font-display text-sm font-black text-slate-500">{rank}</span>}
      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl text-[10px] font-black text-white" style={{ background: `color-mix(in srgb, ${color} 30%, #0b0915)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 45%, transparent)` }}>
        {a.logo && !logoFailed ? <img src={a.logo} alt="" className="h-full w-full bg-white object-contain p-1" loading="lazy" onError={() => setLogoFailed(true)} /> : a.ticker.slice(0, 4)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display font-black text-white">{a.ticker}</p>
        <p className="truncate text-[11px] text-slate-500">{kind && <span className="label mr-1 rounded-full px-1.5 py-0.5 !text-[9px]" style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}>{FII_KINDS.find((k) => k.value === kind)?.label}</span>}{segmentOf(a)} · {a.name}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-mono text-sm font-extrabold text-white">{a.price != null ? formatBRL(a.price) : '—'}</p>
        <Change v={a.changePct} />
      </div>
      </button>
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
  const { data } = useData();
  const tab: Tab = (TABS.some((t) => t.value === tabParam) ? tabParam : data.investments.length ? 'carteira' : 'destaques') as Tab;
  const [sheetAsset, setSheetAsset] = useState<Asset | null>(null);
  // A troca de aba recria a tela: a compra pré-preenchida passa por fora do estado.
  const [preset, setPreset] = useState<OpPreset | null>(() => { const x = pendingPreset; pendingPreset = null; return x; });
  const clearPreset = useCallback(() => setPreset(null), []);
  const addToPortfolio = useCallback((a: Asset) => {
    const pr: OpPreset = { ticker: a.ticker, kind: guessKind(a.ticker, [a]), side: 'compra', price: a.price ?? undefined };
    setSheetAsset(null);
    if (tab === 'carteira') setPreset(pr); else { pendingPreset = pr; go('investimentos', 'carteira'); }
  }, [tab]);
  const sheetApi = useMemo(() => ({ open: setSheetAsset, onAdd: addToPortfolio }), [addToPortfolio]);
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
    if (tab === 'cripto') l = assets.filter((a) => a.type === 'cripto').sort((x, y) => (y.marketCap ?? 0) - (x.marketCap ?? 0));
    if (tab === 'favoritos') l = assets.filter((a) => watchlist.includes(a.ticker));
    return search(l, q).slice(0, 80);
  }, [tab, stocks, segment, fiiKind, assets, watchlist, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const cdiMonth = (Math.pow(1 + rates.rates.cdi / 100, 1 / 12) - 1) * 1000;
  const time = m.data ? new Date(m.data.updatedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <SheetCtx.Provider value={sheetApi}>
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

      {tab !== 'carteira' && <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="tinted relative overflow-hidden rounded-[2rem] p-5" style={{ '--tone': br.avg >= 0 ? '#10b981' : '#e11d48' } as React.CSSProperties}>
          <span className="watermark text-white"><Activity size={140} strokeWidth={1.2} /></span>
          <div className="relative">
            <p className="label text-white/70">{m.data?.index?.points ? 'Ibovespa' : 'Termômetro do dia'}</p>
            {m.data?.index?.points
              ? <>
                  <div className="mt-1 flex flex-wrap items-center gap-3"><p className="font-display text-3xl font-black text-white">{formatNumber(m.data.index.points, 0)} pts</p><Change v={m.data.index.changePct} big /></div>
                  {m.data.ifix?.points ? <p className="mt-1 flex flex-wrap items-center gap-2 text-sm font-semibold text-white/80">IFIX (fundos imobiliários) {formatNumber(m.data.ifix.points, 0)} pts <Change v={m.data.ifix.changePct} /></p> : null}
                </>
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
      </div>}

      <div role="tablist" aria-label="Seções" className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {TABS.map((t) => (
          <button key={t.value} type="button" role="tab" aria-selected={tab === t.value} onClick={() => go('investimentos', t.value)}
            className={cx('press shrink-0 rounded-2xl px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[.1em] ring-1 transition', tab === t.value ? 'bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-[0_6px_20px_-6px] shadow-brand-500 ring-brand-400/40' : 'bg-[#08070f] text-slate-400 ring-white/[.07] hover:text-white')}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'carteira' && <PortfolioTab assets={assets} preset={preset} onPresetUsed={clearPreset} />}
      {!['destaques', 'metodo', 'carteira'].includes(tab) && (
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
      {tab === 'metodo' && <MethodTab assets={assets} />}
      {!['destaques', 'metodo', 'carteira'].includes(tab) && (
        list.length ? <ul className="stagger grid gap-2 lg:grid-cols-2">{list.map((a) => <AssetRow key={a.ticker} a={a} />)}</ul>
          : <Empty icon={tab === 'favoritos' ? <Star size={24} /> : <Search size={24} />} title={tab === 'favoritos' ? 'Nenhum favorito ainda' : m.loading ? 'Buscando cotações…' : tab === 'cripto' && !q ? 'Cotações de cripto indisponíveis agora' : 'Nada encontrado'} text={tab === 'favoritos' ? 'Toque na estrela de um ativo para acompanhar aqui.' : undefined} />
      )}

      <Card className="mt-5" title={<span className="flex items-center gap-2"><Info size={15} className="text-sky-400" /> Entenda os tipos</span>}>
        <div className="grid gap-3 text-sm text-slate-300 md:grid-cols-2">
          <p><b className="text-white">Ações:</b> pedaços de empresas. Podem subir ou cair bastante e pagar dividendos. Para longo prazo.</p>
          <p><b className="text-white">FIIs de tijolo:</b> donos de imóveis (galpões, shoppings, escritórios). Pagam aluguéis todo mês.</p>
          <p><b className="text-white">FIIs de papel:</b> emprestam para o setor imobiliário (CRIs). Renda acompanha juros e inflação.</p>
          <p><b className="text-white">ETFs:</b> uma cesta pronta (ex.: BOVA11 = Ibovespa, IVVB11 = bolsa dos EUA).</p>
          <p><b className="text-white">Criptomoedas:</b> dinheiro digital (Bitcoin, Ethereum…). Sobem e caem muito, 24h por dia — se tiver, que seja uma parte pequena.</p>
          <p><b className="text-white">Renda fixa:</b> Tesouro, CDB, LCI/LCA. Antes da bolsa, monte sua reserva de emergência aqui.</p>
          <p><b className="text-white">Alta do dia ≠ bom investimento.</b> Olhe o histórico, a empresa e diversifique.</p>
        </div>
        <p className="mt-4 text-[11px] text-slate-500">Informação, não recomendação de compra ou venda. Cotações com atraso, fonte: {m.data?.source ?? 'brapi.dev (B3)'}.</p>
      </Card>
      <AssetSheet asset={sheetAsset} onClose={() => setSheetAsset(null)} onAdd={addToPortfolio} />
    </div>
    </SheetCtx.Provider>
  );
}

const FILTER_LABEL = {
  'para-estudar': ['Passa no que dá para checar', 'bg-emerald-500/15 text-emerald-300'],
  pequena: ['Abaixo de R$ 3 bi', 'bg-white/10 text-slate-300'],
  'setor-excluido': ['Setor fora do índice', 'bg-rose-500/15 text-rose-300'],
  'sem-dados': ['Sem dados de valor de mercado', 'bg-white/10 text-slate-400'],
} as const;
const LINKS = [
  { name: 'Canal Investidor Sardinha (YouTube)', url: 'https://www.youtube.com/@InvestidorSardinha' },
  { name: 'AUVP11 — página oficial', url: 'https://analitica.auvp.com.br/campanhas/auvp11' },
  { name: 'Quem é Raul Sena (Investidor10)', url: 'https://investidor10.com.br/conteudo/raul-sena-o-investidor-sardinha/' },
];

/** Aba "Método": princípios públicos do Investidor Sardinha / AUVP, o ETF AUVP11 e o filtro pelos critérios públicos do índice. */
function MethodTab({ assets }: { assets: Asset[] }) {
  const auvp = assets.find((a) => a.ticker === 'AUVP11');
  const stocks = sortForList(assets.filter((a) => a.type === 'acao' && CATALOG[a.ticker]));
  const [show, setShow] = useState<'todas' | 'para-estudar'>('para-estudar');
  const rows = stocks.map((a) => ({ a, r: fundamentalFilter(a) })).filter((x) => show === 'todas' || x.r === 'para-estudar');
  return (
    <div className="space-y-4">
      <section className="tinted relative overflow-hidden rounded-[2rem] p-5 md:p-6" style={{ '--tone': '#0ea5e9' } as React.CSSProperties}>
        <span className="watermark text-white"><ChartLine size={140} strokeWidth={1.2} /></span>
        <div className="relative">
          <p className="label text-white/70">Inspirado no Investidor Sardinha (AUVP)</p>
          <h2 className="mt-1 font-display text-2xl font-black text-white">Investir como sócio, no longo prazo</h2>
          <ul className="mt-3 space-y-2 text-sm text-white/90">
            <li>• <b>Comprar e segurar (buy and hold):</b> montar posição em vários ativos e manter por anos, sem ficar comprando e vendendo.</li>
            <li>• <b>Ser sócio de boas empresas,</b> na linha de Luiz Barsi: entender o negócio antes de comprar e acompanhar de perto.</li>
            <li>• <b>Renda com dividendos:</b> reinvestir os proventos para a bola de neve crescer.</li>
            <li>• <b>Diversificar</b> entre setores e tipos de ativo.</li>
          </ul>
        </div>
      </section>

      <Card title={<span className="flex items-center gap-2"><Star size={15} className="text-sky-400" /> AUVP11 — o ETF da AUVP</span>}>
        {auvp ? <ul className="mb-3"><AssetRow a={auvp} /></ul> : <p className="mb-3 text-xs text-slate-500">Cotação do AUVP11 indisponível agora.</p>}
        <ul className="space-y-1.5 text-sm text-slate-300">
          <li>• Gestão BTG Pactual, replica o índice <b className="text-white">Teva Ações Fundamentos</b>. Na B3 desde junho de 2025.</li>
          <li>• Escolhe empresas por fundamentos, não pelo volume negociado (diferente do Ibovespa).</li>
          <li>• Não distribui dividendos: os proventos são reinvestidos no próprio fundo.</li>
          <li>• Taxa divulgada de cerca de 0,49% ao ano — confira na página oficial antes de investir.</li>
        </ul>
      </Card>

      <Card title={<span className="flex items-center gap-2"><Search size={15} className="text-emerald-400" /> Filtro pelos critérios públicos do índice</span>}>
        <p className="text-sm text-slate-300">O índice do AUVP11 divulga estas regras. O Giro checa as duas primeiras sozinho; as outras você confere no RI da empresa ou em sites de análise.</p>
        <ul className="mt-3 grid gap-1.5 text-xs text-slate-300 sm:grid-cols-2">
          <li>✅ Fora: {AUVP_EXCLUDED_SEGMENTS.join(', ').toLowerCase()}</li>
          <li>✅ Valor de mercado acima de R$ 3 bilhões</li>
          <li>🔎 Lucro em todos os últimos 5 anos</li>
          <li>🔎 Dívida de no máximo 3× o EBIT</li>
          <li>🔎 Pelo menos 5 anos na bolsa</li>
          <li>🔎 Liquidez mínima</li>
        </ul>
        <Segmented className="mt-4" value={show} onChange={setShow} options={[{ value: 'para-estudar', label: 'Para estudar' }, { value: 'todas', label: 'Todas' }]} />
        {rows.length ? (
          <ul className="mt-3 space-y-2" data-testid="filtro-lista">
            {rows.map(({ a, r }) => (
              <li key={a.ticker} className="flex min-w-0 items-center gap-3 rounded-2xl bg-white/[.03] px-3 py-2.5 ring-1 ring-white/[.05]" data-ticker={a.ticker}>
                <div className="min-w-0 flex-1"><p className="font-display font-black text-white">{a.ticker}</p><p className="truncate text-[11px] text-slate-500">{segmentOf(a)}{a.marketCap ? ` · ${formatBRL(a.marketCap / 1e9).replace(',00', '')} bi` : ''}</p></div>
                <span className={cx('label shrink-0 rounded-full px-2.5 py-1 !text-[9px]', FILTER_LABEL[r][1])}>{FILTER_LABEL[r][0]}</span>
              </li>
            ))}
          </ul>
        ) : <p className="mt-3 text-center text-xs text-slate-500">Sem cotações para filtrar agora.</p>}
        <p className="mt-3 text-[11px] text-slate-500">"Passa no que dá para checar" não quer dizer que a empresa está no AUVP11 nem que é indicação de compra.</p>
      </Card>

      <Card title="Para estudar com a fonte">
        <div className="space-y-2">
          {LINKS.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="surface surface-hover flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-white">{l.name}<ArrowUpRight size={16} className="shrink-0 text-slate-500" /></a>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-slate-500">Resumo feito a partir de informações públicas. O Giro não tem ligação com o Investidor Sardinha nem com a AUVP. Opiniões e carteiras deles mudam com o tempo — confira sempre na fonte. Não é recomendação de investimento.</p>
      </Card>
    </div>
  );
}
