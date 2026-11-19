import { createContext, useContext, useEffect, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Building2, Calendar, ExternalLink, Globe, Plus, Star, Users } from 'lucide-react';
import { Button, Modal, cx } from '../../components/ui';
import { Line } from '../../components/charts';
import { CATALOG, CRYPTO_INFO, FII_KINDS, fiiKindOf, segmentOf, type Asset } from '../../lib/market';
import { usePrefs } from '../../data/usePrefs';
import { formatBRL, formatDate, formatNumber } from '../../lib/format';

export interface AssetDetail {
  ticker: string; name: string; price: number | null; changePct: number | null; low52: number | null; high52: number | null;
  pe: number | null; eps: number | null; marketCap: number | null;
  profile: { summary: string | null; sector: string | null; industry: string | null; website: string | null; city: string | null; state: string | null; employees: number | null; since: string | null; listingSegment: string | null; administrator: string | null };
  history: Array<{ date: string; close: number }>;
}

/** Abre a ficha de qualquer ativo (lista, rankings, carteira). */
export const SheetCtx = createContext<{ open: (a: Asset) => void; onAdd?: (a: Asset) => void }>({ open: () => {} });
export const useAssetSheet = () => useContext(SheetCtx);

const cache = new Map<string, AssetDetail>();
const bi = (v: number) => (v >= 1e9 ? `${formatNumber(v / 1e9, 1)} bi` : `${formatNumber(v / 1e6, 0)} mi`);
const SEGMENT_LISTING: Record<string, string> = { NM: 'Novo Mercado (mais alto nível de governança)', N1: 'Nível 1 de governança', N2: 'Nível 2 de governança' };

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return <div className="flex items-start gap-2.5 rounded-2xl bg-white/[.03] p-3 ring-1 ring-white/[.05]"><span className="mt-0.5 text-slate-500">{icon}</span><div className="min-w-0"><p className="label text-slate-500">{label}</p><p className="truncate text-sm font-bold text-white">{value}</p></div></div>;
}

export function AssetSheet({ asset, onClose, onAdd }: { asset: Asset | null; onClose: () => void; onAdd?: (a: Asset) => void }) {
  const { watchlist, toggleWatch } = usePrefs();
  const [d, setD] = useState<AssetDetail | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  useEffect(() => {
    if (!asset) return;
    setD(cache.get(asset.ticker) ?? null);
    if (asset.type === 'cripto' || cache.has(asset.ticker)) { setState('idle'); return; }
    let alive = true;
    setState('loading');
    fetch(`/api/ativo?t=${encodeURIComponent(asset.ticker)}`).then((r) => r.json().then((j) => ({ ok: r.ok, j }))).then(({ ok, j }) => {
      if (!alive) return;
      if (ok && j?.ticker) { cache.set(asset.ticker, j); setD(j); setState('idle'); } else setState('error');
    }).catch(() => alive && setState('error'));
    return () => { alive = false; };
  }, [asset]);
  if (!asset) return null;
  const fav = watchlist.includes(asset.ticker);
  const kind = fiiKindOf(asset);
  const price = d?.price ?? asset.price;
  const chg = d?.changePct ?? asset.changePct;
  const lo = d?.low52; const hi = d?.high52;
  const pos = lo != null && hi != null && price != null && hi > lo ? Math.min(100, Math.max(0, ((price - lo) / (hi - lo)) * 100)) : null;
  const first = d?.history[0]?.close; const last = d?.history.at(-1)?.close;
  const trend = first && last ? ((last - first) / first) * 100 : null;
  const p = d?.profile;
  const about = asset.type === 'cripto' ? CRYPTO_INFO[asset.ticker] ?? 'Criptomoeda negociada 24 horas por dia. Preço muito volátil.'
    : asset.type === 'fii' ? `${kind ? FII_KINDS.find((k) => k.value === kind)?.text + ' ' : ''}${p?.summary ?? ''}`.trim() || 'Fundo imobiliário negociado na B3. Paga rendimentos, em geral, todo mês.'
    : asset.type === 'etf' ? `ETF que acompanha: ${segmentOf(asset)}. Uma cesta de ativos comprada de uma vez só.${p?.summary ? ' ' + p.summary : ''}`
    : p?.summary ?? null;

  return (
    <Modal open onClose={onClose} title={asset.ticker}>
      <div className="space-y-4" data-testid="asset-sheet">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-300">{d?.name ?? asset.name}</p>
            <p className="label mt-0.5 text-slate-500">{CATALOG[asset.ticker]?.segment ?? p?.industry ?? segmentOf(asset)}{p?.sector && asset.type === 'acao' ? ` · ${p.sector}` : ''}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-xl font-extrabold text-white">{price != null ? formatBRL(price) : '—'}</p>
            {chg != null && <p className={cx('inline-flex items-center gap-0.5 font-mono text-xs font-extrabold', chg > 0 ? 'text-emerald-300' : chg < 0 ? 'text-rose-300' : 'text-slate-400')}>{chg > 0 ? <ArrowUpRight size={13} /> : chg < 0 ? <ArrowDownRight size={13} /> : null}{chg > 0 ? '+' : ''}{formatNumber(chg, 2)}% hoje</p>}
          </div>
        </div>

        {d && d.history.length > 1 && (
          <div className="rounded-[1.4rem] bg-white/[.03] p-3 ring-1 ring-white/[.05]">
            <p className="label mb-1 flex justify-between text-slate-500"><span>Últimos 3 meses</span>{trend != null && <span className={trend >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{trend >= 0 ? '+' : ''}{formatNumber(trend, 1)}%</span>}</p>
            <Line points={d.history.map((h) => h.close)} color={trend != null && trend < 0 ? '#f43f5e' : '#22c55e'} />
          </div>
        )}
        {state === 'loading' && <p className="label animate-pulse text-center text-slate-500">Buscando a ficha…</p>}

        {pos != null && (
          <div>
            <p className="label mb-1.5 text-slate-500">Mínima e máxima de 12 meses</p>
            <div className="relative h-2 rounded-full bg-gradient-to-r from-rose-500/60 via-amber-400/60 to-emerald-500/60"><span className="absolute -top-1 h-4 w-1.5 -translate-x-1/2 rounded-full bg-white shadow" style={{ left: `${pos}%` }} /></div>
            <p className="mt-1 flex justify-between font-mono text-[11px] text-slate-400"><span>{formatBRL(lo!)}</span><span>{formatBRL(hi!)}</span></p>
          </div>
        )}

        {about && (
          <div>
            <p className="label mb-1 text-slate-500">{asset.type === 'acao' ? 'O que a empresa faz' : 'O que é'}</p>
            <p className="text-sm leading-relaxed text-slate-300" data-testid="asset-about">{about}</p>
          </div>
        )}
        {state === 'error' && !about && <p className="text-xs text-slate-500">Descrição indisponível agora.</p>}

        <div className="grid grid-cols-2 gap-2">
          {d?.marketCap ? <Fact icon={<Building2 size={14} />} label="Valor de mercado" value={`R$ ${bi(d.marketCap)}`} /> : asset.marketCap ? <Fact icon={<Building2 size={14} />} label="Valor de mercado" value={`R$ ${bi(asset.marketCap)}`} /> : null}
          {d?.pe != null && d.pe > 0 && <Fact icon={<Calendar size={14} />} label="Preço / lucro (P/L)" value={`${formatNumber(d.pe, 1)} anos de lucro`} />}
          {p?.employees ? <Fact icon={<Users size={14} />} label="Funcionários" value={formatNumber(p.employees, 0)} /> : null}
          {p?.since ? <Fact icon={<Calendar size={14} />} label="Fundada em" value={formatDate(p.since).slice(-4)} /> : null}
          {p?.city ? <Fact icon={<Building2 size={14} />} label="Sede" value={`${p.city.charAt(0)}${p.city.slice(1).toLowerCase()}${p.state ? `/${p.state}` : ''}`} /> : null}
          {p?.administrator ? <Fact icon={<Building2 size={14} />} label="Administrador" value={p.administrator} /> : null}
        </div>
        {p?.listingSegment && SEGMENT_LISTING[p.listingSegment] && <p className="text-xs text-slate-400">Listagem: {SEGMENT_LISTING[p.listingSegment]}</p>}

        <div className="flex flex-wrap gap-2">
          {onAdd && <Button className="flex-1" onClick={() => { onClose(); onAdd(asset); }}><Plus size={15} /> Adicionar à carteira</Button>}
          <Button variant="soft" onClick={() => toggleWatch(asset.ticker)} aria-label={fav ? 'Tirar dos favoritos' : 'Favoritar'}><Star size={15} fill={fav ? 'currentColor' : 'none'} className={fav ? 'text-amber-300' : ''} /> {fav ? 'Favorito' : 'Favoritar'}</Button>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {p?.website && <a href={p.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-bold text-brand-300"><Globe size={12} /> Site da empresa</a>}
          {asset.type !== 'cripto' && <a href={`https://www.google.com/search?q=${encodeURIComponent(asset.ticker + ' relação com investidores')}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-bold text-brand-300"><ExternalLink size={12} /> Relação com investidores</a>}
        </div>
        <p className="text-[10px] text-slate-600">Informação, não recomendação. Dados: brapi.dev{asset.type === 'cripto' ? ' / CoinGecko' : ''}.</p>
      </div>
    </Modal>
  );
}
