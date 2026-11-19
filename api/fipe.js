// Função do Vercel: tabela FIPE pela API pública da Parallelum (grátis, sem chave).
//   /api/fipe?tipo=carros                         → marcas
//   /api/fipe?tipo=carros&marca=59                → modelos
//   /api/fipe?tipo=carros&marca=59&modelo=5940    → anos
//   /api/fipe?tipo=carros&marca=59&modelo=5940&ano=2014-3 → valor
// Valores da FIPE mudam uma vez por mês: cache de 1 dia.
const TIPOS = ['carros', 'motos', 'caminhoes'];

export default async function handler(req, res) {
  const q = req.query ?? Object.fromEntries(new URL(req.url, 'http://x').searchParams);
  const tipo = String(q.tipo ?? '');
  const marca = q.marca != null ? String(q.marca) : null;
  const modelo = q.modelo != null ? String(q.modelo) : null;
  const ano = q.ano != null ? String(q.ano) : null;
  if (!TIPOS.includes(tipo) || (marca && !/^\d{1,6}$/.test(marca)) || (modelo && !/^\d{1,8}$/.test(modelo)) || (ano && !/^\d{4,5}-\d$/.test(ano))) {
    res.status(400).json({ error: 'parâmetros inválidos' });
    return;
  }
  let path = `/${tipo}/marcas`;
  if (marca) path += `/${marca}/modelos`;
  if (marca && modelo) path += `/${modelo}/anos`;
  if (marca && modelo && ano) path += `/${ano}`;
  try {
    const r = await fetch(`https://parallelum.com.br/fipe/api/v1${path}`, { headers: { accept: 'application/json' } });
    if (!r.ok) { res.status(r.status === 404 ? 404 : 502).json({ error: `FIPE: HTTP ${r.status}` }); return; }
    const j = await r.json();
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    res.status(200).json(marca && !modelo ? (j.modelos ?? []) : j);
  } catch (e) {
    res.status(502).json({ error: String(e && e.message ? e.message : e) });
  }
}
