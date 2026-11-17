/**
 * Taxas de referência (Selic, CDI, IPCA 12 meses) do Banco Central.
 * Ordem: valor manual (se o usuário definiu) → cache recente → /api/taxas (Vercel) → API do BC direto
 * → último valor guardado → valores padrão. Funciona offline com o último valor conhecido.
 */
export interface Rates { selic: number; cdi: number; ipca: number; updatedAt: string | null; source: 'banco-central' | 'manual' | 'padrao' | 'guardado' }

export const DEFAULT_RATES: Rates = { selic: 15, cdi: 14.9, ipca: 4.5, updatedAt: null, source: 'padrao' };
const CACHE = 'giro.rates';
const MANUAL = 'giro.rates.manual';
const FRESH_MS = 12 * 3600_000;
const SGS = { selic: 432, cdi: 4389, ipca: 13522 } as const;

const read = <T,>(k: string): T | null => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : null; } catch { return null; } };
const write = (k: string, v: unknown) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem storage */ } };

/** Último valor de uma série do SGS ("15,00" → 15). */
export function parseSGS(json: unknown): number | null {
  if (!Array.isArray(json) || !json.length) return null;
  const v = Number(String((json[json.length - 1] as { valor?: unknown }).valor ?? '').replace(',', '.'));
  return Number.isFinite(v) && v > -50 && v < 1000 ? v : null;
}

const valid = (r: Partial<Rates> | null): r is Rates => !!r && [r.selic, r.cdi, r.ipca].every((x) => typeof x === 'number' && Number.isFinite(x));

async function withTimeout(url: string, ms = 6000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, { signal: ctl.signal, headers: { accept: 'application/json' } }); } finally { clearTimeout(t); }
}

async function fetchOnline(): Promise<Rates | null> {
  try {
    const r = await withTimeout('/api/taxas');
    if (r.ok && (r.headers.get('content-type') ?? '').includes('json')) {
      const j = await r.json();
      const rates = { selic: Number(j.selic), cdi: Number(j.cdi), ipca: Number(j.ipca), updatedAt: new Date().toISOString(), source: 'banco-central' as const };
      if (valid(rates)) return rates;
    }
  } catch { /* tenta direto */ }
  try {
    const vals = await Promise.all(Object.values(SGS).map(async (code) => parseSGS(await (await withTimeout(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados/ultimos/1?formato=json`)).json())));
    const [selic, cdi, ipca] = vals;
    if (selic != null && cdi != null && ipca != null) return { selic, cdi, ipca, updatedAt: new Date().toISOString(), source: 'banco-central' };
  } catch { /* sem internet ou bloqueado */ }
  return null;
}

export function getCachedRates(): Rates {
  const manual = read<Rates>(MANUAL);
  if (valid(manual)) return { ...manual, source: 'manual' };
  const cached = read<Rates>(CACHE);
  return valid(cached) ? cached : DEFAULT_RATES;
}

/** Busca as taxas (se o cache estiver velho) e devolve a melhor disponível. */
export async function loadRates(force = false): Promise<Rates> {
  const manual = read<Rates>(MANUAL);
  if (valid(manual)) return { ...manual, source: 'manual' };
  const cached = read<Rates>(CACHE);
  if (!force && valid(cached) && cached.updatedAt && Date.now() - new Date(cached.updatedAt).getTime() < FRESH_MS) return cached;
  const online = await fetchOnline();
  if (online) { write(CACHE, online); return online; }
  return valid(cached) ? { ...cached, source: 'guardado' } : DEFAULT_RATES;
}

export function setManualRates(r: Pick<Rates, 'selic' | 'cdi' | 'ipca'> | null) {
  write(MANUAL, r ? { ...r, updatedAt: new Date().toISOString(), source: 'manual' } : null);
}
