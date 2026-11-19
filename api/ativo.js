// Função do Vercel: ficha de um ativo (o que a empresa faz, setor, site, máxima/mínima do ano e 3 meses de preço).
// Uma consulta à brapi por ativo, guardada por 6 horas.
export default async function handler(req, res) {
  const t = String(req.query?.t ?? new URL(req.url, 'http://x').searchParams.get('t') ?? '').toUpperCase().trim();
  if (!/^[A-Z0-9]{4,8}$/.test(t)) { res.status(400).json({ error: 'ticker inválido' }); return; }
  const token = process.env.BRAPI_TOKEN || '';
  try {
    const r = await fetch(`https://brapi.dev/api/quote/${t}?modules=summaryProfile&range=3mo&interval=1d`, {
      headers: { accept: 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    });
    if (!r.ok) { res.status(r.status === 401 || r.status === 403 ? 503 : r.status === 404 ? 404 : 502).json({ error: r.status === 404 ? 'não encontrado' : `HTTP ${r.status}` }); return; }
    const q = (await r.json()).results?.[0];
    if (!q) { res.status(404).json({ error: 'não encontrado' }); return; }
    const p = q.summaryProfile ?? {};
    const summary = typeof p.longBusinessSummary === 'string' && !/n[aã]o informado/i.test(p.longBusinessSummary) ? p.longBusinessSummary : null;
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    res.status(200).json({
      ticker: t, name: q.longName ?? q.shortName ?? t, price: q.regularMarketPrice ?? null, changePct: q.regularMarketChangePercent ?? null,
      low52: q.fiftyTwoWeekLow ?? null, high52: q.fiftyTwoWeekHigh ?? null, pe: q.priceEarnings ?? null, eps: q.earningsPerShare ?? null, marketCap: q.marketCap ?? null,
      profile: {
        summary, sector: p.sectorDisp ?? p.sector ?? null, industry: p.industryDisp ?? p.industry ?? null, website: p.website ?? null,
        city: p.city ?? null, state: p.state ?? null, employees: p.fullTimeEmployees ?? null, since: p.startDate ?? null,
        listingSegment: p.listingSegment ?? null, administrator: p.administratorName ?? null,
      },
      history: (q.historicalDataPrice ?? []).filter((h) => h.close != null).map((h) => ({ date: new Date(h.date * 1000).toISOString().slice(0, 10), close: h.close })),
    });
  } catch (e) {
    res.status(502).json({ error: String(e && e.message ? e.message : e) });
  }
}
