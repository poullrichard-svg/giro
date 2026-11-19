// Função do Vercel: cotações da B3 pela brapi.dev (ações, FIIs e ETFs), com atraso.
// A chave fica no servidor (variável BRAPI_TOKEN na Vercel), nunca no app.
// Resposta em cache por 15 minutos para respeitar o limite do plano gratuito.
const BASE = 'https://brapi.dev/api';

async function get(path, token) {
  const sep = path.includes('?') ? '&' : '?';
  const r = await fetch(`${BASE}${path}${token ? `${sep}token=${encodeURIComponent(token)}` : ''}`, { headers: { accept: 'application/json' } });
  if (!r.ok) {
    const e = new Error(`brapi ${path.split('?')[0]}: HTTP ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return r.json();
}

const slim = (s) => ({
  stock: s.stock ?? s.symbol, name: s.name ?? s.shortName ?? s.longName, close: s.close ?? s.regularMarketPrice,
  change: s.change ?? s.regularMarketChangePercent, volume: s.volume ?? s.regularMarketVolume,
  market_cap: s.market_cap ?? s.marketCap ?? null, logo: s.logo ?? null, sector: s.sector ?? null, type: s.type ?? null,
});

export default async function handler(_req, res) {
  const token = process.env.BRAPI_TOKEN || '';
  try {
    const lists = await Promise.allSettled([
      get('/quote/list?type=stock&sortBy=volume&sortOrder=desc&limit=150', token),
      get('/quote/list?type=fund&sortBy=volume&sortOrder=desc&limit=150', token),
    ]);
    const ok = lists.filter((l) => l.status === 'fulfilled').map((l) => l.value);
    if (!ok.length) {
      const status = lists[0].reason?.status;
      res.status(status === 401 || status === 403 ? 503 : 502).json({ error: status === 401 || status === 403 ? 'sem-token' : String(lists[0].reason?.message ?? 'erro') });
      return;
    }
    const seen = new Set();
    const assets = ok.flatMap((j) => j.stocks ?? j.results ?? []).map(slim).filter((s) => s.stock && !seen.has(s.stock) && seen.add(s.stock));
    let index = null;
    try {
      const q = await get('/quote/%5EBVSP', token);
      const r = q.results?.[0];
      if (r) index = { name: 'Ibovespa', points: r.regularMarketPrice ?? null, changePct: r.regularMarketChangePercent ?? null };
    } catch { /* índice é opcional */ }
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
    res.status(200).json({ updatedAt: new Date().toISOString(), source: 'brapi.dev (B3, com atraso)', index, assets });
  } catch (e) {
    res.status(502).json({ error: String(e && e.message ? e.message : e) });
  }
}
