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

// Criptomoedas: a brapi só libera no plano pago; usamos a CoinGecko (grátis, preços em reais)
// e, se ela falhar, o Mercado Bitcoin.
const COINS = ['bitcoin', 'ethereum', 'tether', 'solana', 'ripple', 'binancecoin', 'usd-coin', 'cardano', 'dogecoin', 'tron', 'chainlink', 'avalanche-2', 'litecoin', 'polkadot', 'shiba-inu'];
const MB = ['BTC', 'ETH', 'USDT', 'SOL', 'XRP', 'USDC', 'ADA', 'DOGE', 'LINK', 'LTC', 'DOT', 'AVAX'];
async function crypto() {
  try {
    const key = process.env.COINGECKO_API_KEY;
    const r = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=brl&ids=${COINS.join(',')}&price_change_percentage=24h`, { headers: { accept: 'application/json', ...(key ? { 'x-cg-demo-api-key': key } : {}) } });
    if (!r.ok) throw new Error(`coingecko ${r.status}`);
    const list = await r.json();
    if (!Array.isArray(list) || !list.length) throw new Error('coingecko vazio');
    return { source: 'CoinGecko', assets: list.map((c) => ({ stock: String(c.symbol).toUpperCase(), name: c.name, close: c.current_price, change: c.price_change_percentage_24h, volume: c.current_price ? c.total_volume / c.current_price : null, market_cap: c.market_cap, logo: c.image, sector: 'Criptomoeda', type: 'crypto' })) };
  } catch {
    try {
      const r = await fetch(`https://api.mercadobitcoin.net/api/v4/tickers?symbols=${MB.map((s) => `${s}-BRL`).join(',')}`, { headers: { accept: 'application/json' } });
      if (!r.ok) return null;
      const list = await r.json();
      return { source: 'Mercado Bitcoin', assets: list.map((c) => { const last = Number(c.last); const open = Number(c.open); return { stock: String(c.pair).split('-')[0], name: String(c.pair).split('-')[0], close: last, change: open ? ((last - open) / open) * 100 : null, volume: Number(c.vol), market_cap: null, logo: null, sector: 'Criptomoeda', type: 'crypto' }; }) };
    } catch { return null; }
  }
}

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
    const [ibov, ifix, cr] = await Promise.all([index('^BVSP', 'Ibovespa', token), index('IFIX.SA', 'IFIX', token), crypto()]);
    if (cr) assets.push(...cr.assets.filter((c) => c.stock && c.close != null && !seen.has(c.stock) && seen.add(c.stock)));
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    res.status(200).json({ updatedAt: new Date().toISOString(), source: `brapi.dev (B3, com atraso)${cr ? ` · cripto: ${cr.source}` : ''}`, index: ibov, ifix, assets });
  } catch (e) {
    res.status(502).json({ error: String(e && e.message ? e.message : e) });
  }
}
