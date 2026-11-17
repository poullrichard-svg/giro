// Função do Vercel: busca Selic, CDI e IPCA no Banco Central (SGS) pelo servidor,
// evitando o bloqueio de CORS do navegador. Resposta guardada em cache por 6 horas.
const SERIES = { selic: 432, cdi: 4389, ipca: 13522 };

async function last(code) {
  const r = await fetch(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados/ultimos/1?formato=json`, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`SGS ${code}: HTTP ${r.status}`);
  const [item] = await r.json();
  return { value: Number(String(item.valor).replace(',', '.')), date: item.data };
}

export default async function handler(_req, res) {
  try {
    const entries = await Promise.all(Object.entries(SERIES).map(async ([k, code]) => [k, await last(code)]));
    const data = Object.fromEntries(entries);
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    res.status(200).json({ selic: data.selic.value, cdi: data.cdi.value, ipca: data.ipca.value, dates: { selic: data.selic.date, cdi: data.cdi.date, ipca: data.ipca.date }, source: 'Banco Central (SGS)' });
  } catch (e) {
    res.status(502).json({ error: String(e && e.message ? e.message : e) });
  }
}
