import { useCallback, useEffect, useState } from 'react';
import { normalizeAsset, type Asset } from './market';

export interface MarketData { updatedAt: string; source: string; index: { name: string; points: number | null; changePct: number | null } | null; assets: Asset[] }
type State = { data: MarketData | null; loading: boolean; error: null | 'sem-token' | 'offline' | 'erro'; stale: boolean };
const KEY = 'giro.market';

const readCache = (): MarketData | null => { try { return JSON.parse(localStorage.getItem(KEY) ?? 'null'); } catch { return null; } };

/** Cotações (função /api/mercado). Guarda a última resposta para abrir sem internet. */
export function useMarket() {
  const [s, setS] = useState<State>(() => ({ data: readCache(), loading: true, error: null, stale: !!readCache() }));
  const load = useCallback(async () => {
    setS((x) => ({ ...x, loading: true }));
    try {
      const r = await fetch('/api/mercado', { headers: { accept: 'application/json' } });
      const j = await r.json().catch(() => null);
      if (!j || (r.ok && !Array.isArray(j.assets))) { setS((x) => ({ ...x, loading: false, error: 'erro' })); return; }
      if (!r.ok) { setS((x) => ({ ...x, loading: false, error: j?.error === 'sem-token' ? 'sem-token' : 'erro' })); return; }
      const data: MarketData = { updatedAt: j.updatedAt, source: j.source, index: j.index ?? null, assets: (j.assets ?? []).map(normalizeAsset).filter(Boolean) as Asset[] };
      try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* sem espaço: segue sem cache */ }
      setS({ data, loading: false, error: null, stale: false });
    } catch {
      setS((x) => ({ ...x, loading: false, error: 'offline' }));
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  return { ...s, reload: load };
}
