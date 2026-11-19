import { describe, expect, it } from 'vitest';
import { breadth, fiiKindOf, normalizeAsset, search, topMovers } from './market';

describe('mercado', () => {
  it('entende os dois formatos da brapi e classifica FIIs', () => {
    const a = normalizeAsset({ stock: 'hglg11', name: 'CSHG LOGISTICA', close: 160.5, change: -0.42, volume: 9_000_000, type: 'fund', sector: 'Finance' })!;
    expect(a).toMatchObject({ ticker: 'HGLG11', type: 'fii', price: 160.5, changePct: -0.42, sector: 'Logística' });
    expect(fiiKindOf(a)).toBe('tijolo');
    const b = normalizeAsset({ symbol: 'PETR4', shortName: 'PETROBRAS PN', regularMarketPrice: 38.1, regularMarketChangePercent: 1.25 })!;
    expect(b).toMatchObject({ ticker: 'PETR4', type: 'acao', name: 'PETROBRAS PN', changePct: 1.25 });
    expect(normalizeAsset({ stock: 'XYZW11', type: 'fund', close: 10 })!.type).toBe('fii');
    expect(normalizeAsset({ stock: 'AAPL34', type: 'bdr', close: 50 })!.type).toBe('bdr');
    expect(normalizeAsset({ stock: 'ABCD3', sector: 'Retail Trade', close: 5 })!.sector).toBe('Varejo');
    expect(normalizeAsset({ name: 'sem ticker' })).toBeNull();
  });
  it('maiores altas/baixas só entre ativos com liquidez', () => {
    const list = [
      { stock: 'PETR4', close: 38, change: 3, volume: 5e8 }, { stock: 'VALE3', close: 60, change: -2.5, volume: 4e8 },
      { stock: 'MXRF11', close: 10, change: 1, volume: 2e7, type: 'fund' }, { stock: 'TINY3', close: 1, change: 40, volume: 1000 },
      { stock: 'ITUB4', close: 33, change: -0.1, volume: 3e8 },
    ].map(normalizeAsset).filter(Boolean) as any[];
    const m = topMovers(list, 3);
    expect(m.up.map((a) => a.ticker)).toEqual(['PETR4', 'MXRF11']);
    expect(m.down.map((a) => a.ticker)).toEqual(['VALE3', 'ITUB4']);
    expect(m.traded[0].ticker).toBe('PETR4');
    expect(breadth(list)).toMatchObject({ up: 2, down: 2, total: 4 });
    expect(search(list, 'logíst').length).toBe(0);
    expect(search(list, 'mxrf').map((a) => a.ticker)).toEqual(['MXRF11']);
  });
});
