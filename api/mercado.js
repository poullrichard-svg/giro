// Função do Vercel: cotações da B3 pela brapi.dev (ações, FIIs e ETFs), com atraso.
// A chave fica no servidor (variável BRAPI_TOKEN na Vercel), nunca no app.
// Plano gratuito: 1 ativo por consulta de cotação, mas a "lista" traz todos de uma vez.
// Por atualização: 2 listas + Ibovespa + IFIX + AUVP11 = 5 consultas, guardadas por 30 min.
const BASE = 'https://brapi.dev/api';
const SINGLE = ['AUVP11'];

async function get(path, token) {
  const r = await fetch(`${BASE}${path}`, { headers: { accept: 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) } });
  if (!r.ok) {
    const e = new Error(`brapi ${path.split('?')[0]}: HTTP ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return r.json();
}

const slim = (s) => ({
  stock: s.stock ?? s.symbol, name: s.name ?? s.shortName ?? null, longName: s.longName ?? null,
  close: s.close ?? s.regularMarketPrice ?? null, change: s.change ?? s.regularMarketChangePercent ?? null,
  volume: s.volume ?? s.regularMarketVolume ?? null, market_cap: s.market_cap ?? s.marketCap ?? null,
  logo: s.logo ?? s.logourl ?? null, sector: s.sector ?? null, subsector: s.subsector ?? null, type: s.type ?? null, subType: s.subType ?? null,
});

const index = async (symbol, name, token) => {
  try {
    const r = (await get(`/quote/${encodeURIComponent(symbol)}`, token)).results?.[0];
    return r ? { name, points: r.regularMarketPrice ?? null, changePct: r.regularMarketChangePercent ?? null } : null;
  } catch { return null; }
};

export default async function handler(_req, res) {
  const token = process.env.BRAPI_TOKEN || '';
  try {
    const lists = await Promise.allSettled([
      get('/quote/list?type=stock&sortBy=volume&sortOrder=desc&limit=1000', token),
      get('/quote/list?type=fund&sortBy=volume&sortOrder=desc&limit=1000', token),
    ]);
    const ok = lists.filter((l) => l.status === 'fulfilled').map((l) => l.value);
    if (!ok.length) {
      const status = lists[0].reason?.status;
      res.status(status === 401 || status === 403 ? 503 : 502).json({ error: status === 401 || status === 403 ? 'sem-token' : String(lists[0].reason?.message ?? 'erro') });
      return;
    }
    const seen = new Set();
    const assets = ok.flatMap((j) => j.stocks ?? []).map(slim)
      .filter((s) => s.stock && s.close != null && (s.volume ?? 0) > 0 && !/F$/.test(s.stock) && !seen.has(s.stock) && seen.add(s.stock));
    const extra = await Promise.all(SINGLE.filter((t) => !seen.has(t)).map(async (t) => {
      try { const r = (await get(`/quote/${t}`, token)).results?.[0]; return r ? slim(r) : null; } catch { return null; }
    }));
    assets.push(...extra.filter(Boolean));
    const [ibov, ifix] = await Promise.all([index('^BVSP', 'Ibovespa', token), index('IFIX.SA', 'IFIX', token)]);
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    res.status(200).json({ updatedAt: new Date().toISOString(), source: 'brapi.dev (B3, com atraso)', index: ibov, ifix, assets });
  } catch (e) {
    res.status(502).json({ error: String(e && e.message ? e.message : e) });
  }
}
