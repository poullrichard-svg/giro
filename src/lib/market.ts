/**
 * Painel de investimentos — catálogo, classificação e rankings (market.test.ts).
 * Cotações vêm da função /api/mercado (brapi.dev, com atraso). Nada aqui é recomendação.
 */

export type AssetType = 'acao' | 'fii' | 'etf' | 'bdr';
export type FiiKind = 'tijolo' | 'papel' | 'fof' | 'hibrido';

export interface Asset {
  ticker: string; name: string; price: number | null; changePct: number | null;
  volume: number | null; marketCap: number | null; logo: string | null; sector: string | null; type: AssetType;
}

export interface CatalogItem { type: AssetType; kind?: FiiKind; segment: string }

/** Ativos conhecidos (os mais negociados/populares), com o tipo de FII e o segmento em português. */
export const CATALOG: Record<string, CatalogItem> = {
  // Ações
  PETR4: { type: 'acao', segment: 'Petróleo' }, PETR3: { type: 'acao', segment: 'Petróleo' }, PRIO3: { type: 'acao', segment: 'Petróleo' },
  VALE3: { type: 'acao', segment: 'Mineração' }, ITUB4: { type: 'acao', segment: 'Bancos' }, BBDC4: { type: 'acao', segment: 'Bancos' },
  BBAS3: { type: 'acao', segment: 'Bancos' }, SANB11: { type: 'acao', segment: 'Bancos' }, ITSA4: { type: 'acao', segment: 'Bancos' },
  B3SA3: { type: 'acao', segment: 'Bolsa' }, BBSE3: { type: 'acao', segment: 'Seguros' }, WEGE3: { type: 'acao', segment: 'Indústria' },
  ABEV3: { type: 'acao', segment: 'Bebidas' }, MGLU3: { type: 'acao', segment: 'Varejo' }, LREN3: { type: 'acao', segment: 'Varejo' },
  RADL3: { type: 'acao', segment: 'Farmácias' }, SUZB3: { type: 'acao', segment: 'Papel e celulose' }, RENT3: { type: 'acao', segment: 'Aluguel de carros' },
  ELET3: { type: 'acao', segment: 'Energia' }, EGIE3: { type: 'acao', segment: 'Energia' }, TAEE11: { type: 'acao', segment: 'Energia' },
  CMIG4: { type: 'acao', segment: 'Energia' }, SBSP3: { type: 'acao', segment: 'Saneamento' }, VIVT3: { type: 'acao', segment: 'Telecom' },
  EMBR3: { type: 'acao', segment: 'Aviação' }, GGBR4: { type: 'acao', segment: 'Siderurgia' }, JBSS3: { type: 'acao', segment: 'Alimentos' },
  // FIIs de tijolo (imóveis de verdade)
  HGLG11: { type: 'fii', kind: 'tijolo', segment: 'Logística' }, BTLG11: { type: 'fii', kind: 'tijolo', segment: 'Logística' },
  LVBI11: { type: 'fii', kind: 'tijolo', segment: 'Logística' }, XPLG11: { type: 'fii', kind: 'tijolo', segment: 'Logística' },
  XPML11: { type: 'fii', kind: 'tijolo', segment: 'Shoppings' }, VISC11: { type: 'fii', kind: 'tijolo', segment: 'Shoppings' },
  HSML11: { type: 'fii', kind: 'tijolo', segment: 'Shoppings' }, PVBI11: { type: 'fii', kind: 'tijolo', segment: 'Lajes corporativas' },
  HGRU11: { type: 'fii', kind: 'tijolo', segment: 'Renda urbana' }, TRXF11: { type: 'fii', kind: 'tijolo', segment: 'Renda urbana' },
  // FIIs de papel (recebíveis imobiliários, CRIs)
  KNCR11: { type: 'fii', kind: 'papel', segment: 'Recebíveis (CDI)' }, KNIP11: { type: 'fii', kind: 'papel', segment: 'Recebíveis (IPCA)' },
  MXRF11: { type: 'fii', kind: 'papel', segment: 'Recebíveis' }, CPTS11: { type: 'fii', kind: 'papel', segment: 'Recebíveis' },
  IRDM11: { type: 'fii', kind: 'papel', segment: 'Recebíveis' }, RECR11: { type: 'fii', kind: 'papel', segment: 'Recebíveis' },
  VGIR11: { type: 'fii', kind: 'papel', segment: 'Recebíveis (CDI)' }, KNSC11: { type: 'fii', kind: 'papel', segment: 'Recebíveis' },
  // Fundos de fundos e híbridos
  BCFF11: { type: 'fii', kind: 'fof', segment: 'Fundo de fundos' }, KFOF11: { type: 'fii', kind: 'fof', segment: 'Fundo de fundos' },
  RBRF11: { type: 'fii', kind: 'fof', segment: 'Fundo de fundos' }, KNRI11: { type: 'fii', kind: 'hibrido', segment: 'Lajes + logística' },
  // ETFs
  BOVA11: { type: 'etf', segment: 'Ibovespa' }, SMAL11: { type: 'etf', segment: 'Small caps' }, IVVB11: { type: 'etf', segment: 'S&P 500 (EUA)' },
  HASH11: { type: 'etf', segment: 'Criptomoedas' }, GOLD11: { type: 'etf', segment: 'Ouro' }, DIVO11: { type: 'etf', segment: 'Dividendos' },
};

export const FII_KINDS: Array<{ value: FiiKind; label: string; text: string }> = [
  { value: 'tijolo', label: 'Tijolo', text: 'Donos de imóveis reais (galpões, shoppings, escritórios). Renda vem dos aluguéis.' },
  { value: 'papel', label: 'Papel', text: 'Emprestam para o setor imobiliário (CRIs). Renda segue juros e inflação.' },
  { value: 'fof', label: 'Fundo de fundos', text: 'Compram cotas de outros FIIs. Diversificação pronta.' },
  { value: 'hibrido', label: 'Híbrido', text: 'Misturam imóveis e papéis.' },
];

const num = (v: unknown) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const SECTOR_PT: Record<string, string> = {
  Finance: 'Finanças', 'Energy Minerals': 'Petróleo e gás', 'Non-Energy Minerals': 'Mineração', Utilities: 'Energia e saneamento',
  'Retail Trade': 'Varejo', 'Consumer Non-Durables': 'Consumo', 'Consumer Durables': 'Bens duráveis', 'Producer Manufacturing': 'Indústria',
  Communications: 'Telecom', 'Health Services': 'Saúde', 'Health Technology': 'Saúde', Transportation: 'Transporte',
  'Process Industries': 'Indústria de base', 'Technology Services': 'Tecnologia', 'Electronic Technology': 'Tecnologia',
  'Commercial Services': 'Serviços', 'Consumer Services': 'Serviços', 'Industrial Services': 'Serviços industriais', Miscellaneous: 'Outros',
};

/**
 * Aceita os formatos da brapi (lista antiga: stock/close/change; cotação: symbol/regularMarketPrice/regularMarketChangePercent).
 * Descarta itens sem ticker.
 */
export function normalizeAsset(raw: any): Asset | null {
  const ticker = String(raw?.stock ?? raw?.symbol ?? raw?.ticker ?? '').toUpperCase().trim();
  if (!/^[A-Z0-9^.]{4,12}$/.test(ticker)) return null;
  const cat = CATALOG[ticker];
  const rawType = String(raw?.type ?? '').toLowerCase();
  const type: AssetType = cat?.type ?? (rawType === 'fund' || rawType === 'fii' ? (/11$/.test(ticker) ? 'fii' : 'etf') : rawType === 'bdr' || /3[45]$/.test(ticker) ? 'bdr' : rawType === 'etf' ? 'etf' : 'acao');
  const sector = raw?.sector ? (SECTOR_PT[raw.sector] ?? raw.sector) : null;
  return {
    ticker, type,
    name: String(raw?.name ?? raw?.shortName ?? raw?.longName ?? ticker).trim(),
    price: num(raw?.close ?? raw?.regularMarketPrice ?? raw?.price),
    changePct: num(raw?.change ?? raw?.regularMarketChangePercent ?? raw?.changePercent),
    volume: num(raw?.volume ?? raw?.regularMarketVolume),
    marketCap: num(raw?.market_cap ?? raw?.marketCap),
    logo: typeof raw?.logo === 'string' ? raw.logo : null,
    sector: cat?.segment ?? sector,
  };
}

export const segmentOf = (a: Asset) => CATALOG[a.ticker]?.segment ?? a.sector ?? '—';
export const fiiKindOf = (a: Asset): FiiKind | null => CATALOG[a.ticker]?.kind ?? null;

/** Maiores altas e baixas do dia entre ativos com liquidez (volume mínimo). */
export function topMovers(assets: Asset[], n = 5, minVolume = 1_000_000) {
  const liquid = assets.filter((a) => a.changePct != null && a.price != null && (a.volume ?? 0) >= minVolume && a.type !== 'bdr');
  const up = [...liquid].filter((a) => a.changePct! > 0).sort((a, b) => b.changePct! - a.changePct!).slice(0, n);
  const down = [...liquid].filter((a) => a.changePct! < 0).sort((a, b) => a.changePct! - b.changePct!).slice(0, n);
  const traded = [...liquid].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0)).slice(0, n);
  return { up, down, traded };
}

/** Termômetro do dia: quantos subiram x caíram entre os ativos do catálogo. */
export function breadth(assets: Asset[]) {
  const known = assets.filter((a) => CATALOG[a.ticker] && a.changePct != null);
  const up = known.filter((a) => a.changePct! > 0).length;
  const down = known.filter((a) => a.changePct! < 0).length;
  const avg = known.length ? known.reduce((s, a) => s + a.changePct!, 0) / known.length : 0;
  return { up, down, flat: known.length - up - down, avg, total: known.length };
}

export function search(assets: Asset[], q: string) {
  const s = q.trim().toUpperCase();
  if (!s) return assets;
  return assets.filter((a) => a.ticker.includes(s) || a.name.toUpperCase().includes(s) || segmentOf(a).toUpperCase().includes(s));
}

/** Ativos do catálogo primeiro (ordenados pelo catálogo), depois o resto por volume. */
export function sortForList(assets: Asset[]) {
  const order = Object.keys(CATALOG);
  return [...assets].sort((a, b) => {
    const ia = order.indexOf(a.ticker); const ib = order.indexOf(b.ticker);
    if (ia >= 0 || ib >= 0) return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    return (b.volume ?? 0) - (a.volume ?? 0);
  });
}
