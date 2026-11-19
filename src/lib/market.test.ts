import { describe, expect, it } from 'vitest';
import { breadth, fiiKindOf, fundamentalFilter, normalizeAsset, search, topMovers } from './market';

describe('mercado', () => {
  it('entende os dois formatos da brapi e classifica FIIs', () => {
    const a = normalizeAsset({ stock: 'hglg11', name: 'CSHG LOGISTICA', close: 160.5, change: -0.42, volume: 9_000_000, type: 'fund', sector: 'Finance' })!;
    expect(a).toMatchObject({ ticker: 'HGLG11', type: 'fii', price: 160.5, changePct: -0.42, sector: 'Logística' });
    expect(fiiKindOf(a)).toBe('tijolo');
    const b = normalizeAsset({ symbol: 'PETR4', shortName: 'PETROBRAS PN', regularMarketPrice: 38.1, regularMarketChangePercent: 1.25 })!;
    expect(b).toMatchObject({ ticker: 'PETR4', type: 'acao', name: 'PETROBRAS PN', changePct: 1.25 });
    expect(normalizeAsset({ stock: 'XYZW11', type: 'fund', subType: 'fii', close: 10 })!.type).toBe('fii');
    expect(normalizeAsset({ stock: 'AAPL34', type: 'bdr', close: 50 })!.type).toBe('bdr');
    expect(normalizeAsset({ stock: 'ABCD3', sector: 'Retail Trade', close: 5 })!.sector).toBe('Varejo');
    expect(normalizeAsset({ name: 'sem ticker' })).toBeNull();
    expect(normalizeAsset({ stock: 'BTC', name: 'Bitcoin', close: 500000, change: -1, type: 'crypto' })!).toMatchObject({ ticker: 'BTC', type: 'cripto' });
  });
  it('maiores altas/baixas só entre ativos com liquidez', () => {
    const list = [
      { stock: 'PETR4', close: 38, change: 3, volume: 5e7 }, { stock: 'VALE3', close: 60, change: -2.5, volume: 4e7 },
      { stock: 'MXRF11', close: 10, change: 1, volume: 2e6, type: 'fund' }, { stock: 'TINY3', close: 1, change: 40, volume: 1000 },
      { stock: 'FNAM11', close: 0.66, change: 9, volume: 4e8, type: 'fund', subType: 'etf' }, { stock: 'MICO3', close: 2, change: 15, volume: 9e6, market_cap: 3e8 },
      { stock: 'ITUB4', close: 33, change: -0.1, volume: 3e7 },
    ].map(normalizeAsset).filter(Boolean) as any[];
    const m = topMovers(list, 3);
    expect(m.up.map((a) => a.ticker)).toEqual(['PETR4', 'MXRF11']);
    expect(m.down.map((a) => a.ticker)).toEqual(['VALE3', 'ITUB4']);
    expect(m.traded[0].ticker).toBe('VALE3');
    expect(breadth(list)).toMatchObject({ up: 2, down: 2, total: 4 });
    expect(search(list, 'logíst').length).toBe(0);
    expect(search(list, 'mxrf').map((a) => a.ticker)).toEqual(['MXRF11']);
  });
});

describe('filtro fundamentalista (critérios públicos do AUVP11)', () => {
  it('tira varejo, proteína animal e aéreas; exige valor de mercado ≥ R$ 3 bi', () => {
    const f = (o: any) => fundamentalFilter(normalizeAsset(o)!);
    expect(f({ stock: 'MGLU3', market_cap: 9e9 })).toBe('setor-excluido');
    expect(f({ stock: 'MBRF3', market_cap: 5e10 })).toBe('setor-excluido');
    expect(f({ stock: 'AZUL3', market_cap: 4e9 })).toBe('setor-excluido');
    expect(f({ stock: 'EMBJ3', market_cap: 4e10 })).toBe('para-estudar');
    expect(f({ stock: 'ITUB4', market_cap: 3e11 })).toBe('para-estudar');
    expect(f({ stock: 'ABCD3', market_cap: 8e8 })).toBe('pequena');
    expect(f({ stock: 'PETR4' })).toBe('sem-dados');
    expect(f({ stock: 'AUVP11', type: 'fund' })).toBe('sem-dados');
  });
});

describe('formato real da brapi (amostra de 19/11/2026)', () => {
  it('usa subType e subsector; ignora fundo sem classificação', () => {
    const etf = normalizeAsset({ stock: 'SMAL11', name: 'SMAL11', close: 98.06, change: -0.16, volume: 5553737, market_cap: null, sector: 'Miscellaneous', subsector: null, type: 'fund', subType: 'etf' })!;
    expect(etf).toMatchObject({ type: 'etf', sector: 'Small caps' });
    const fii = normalizeAsset({ stock: 'PVBI11', close: 80, change: 0.2, volume: 1e5, sector: 'Miscellaneous', subsector: 'Escritórios', type: 'fund', subType: 'fii' })!;
    expect(fii).toMatchObject({ type: 'fii', sector: 'Lajes corporativas' });
    const novo = normalizeAsset({ stock: 'GARE11', close: 7.93, change: -0.5, volume: 414276, sector: 'Miscellaneous', subsector: 'Multicategoria', type: 'fund', subType: 'fii' })!;
    expect(novo).toMatchObject({ type: 'fii', sector: null });
    expect(normalizeAsset({ stock: 'XPCA11', close: 9, type: 'fund', subType: 'fi-agro' })!).toMatchObject({ type: 'fii', sector: 'Fiagro' });
    expect(normalizeAsset({ stock: 'IBOV11', close: 167793, type: 'fund', subType: null })).toBeNull();
    const acao = normalizeAsset({ stock: 'CPLE3', name: 'CIA PARANAENSE DE ENERGIA - COPEL', close: 15.13, change: -0.98, volume: 34699800, market_cap: 45382684789, sector: 'Utilities', subsector: 'Energia Elétrica', type: 'stock', subType: 'stock' })!;
    expect(acao).toMatchObject({ type: 'acao', sector: 'Energia Elétrica' });
    const unit = normalizeAsset({ stock: 'TAEE11', close: 36, type: 'stock', subType: 'unit' })!;
    expect(unit.type).toBe('acao');
    const auvp = normalizeAsset({ symbol: 'AUVP11', shortName: 'AUVP11', longName: 'BTG Pactual Teva Auvp Acoes Fundamentos Fundo De Indice', regularMarketPrice: 119.35, regularMarketChangePercent: -0.54, regularMarketVolume: 6133, logourl: 'https://icons.brapi.dev/icons/AUVP11.svg' })!;
    expect(auvp).toMatchObject({ type: 'etf', price: 119.35, name: 'BTG Pactual Teva Auvp Acoes Fundamentos Fundo De Indice', logo: 'https://icons.brapi.dev/icons/AUVP11.svg' });
  });
});
