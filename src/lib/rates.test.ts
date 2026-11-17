import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_RATES, getCachedRates, loadRates, parseSGS, setManualRates } from './rates';

// localStorage simples para os testes (o vitest roda em Node).
const store = new Map<string, string>();
vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) });

describe('taxas', () => {
  beforeEach(() => { store.clear(); vi.unstubAllGlobals(); vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) }); });

  it('lê o formato do SGS', () => {
    expect(parseSGS([{ data: '14/11/2026', valor: '15,00' }])).toBe(15);
    expect(parseSGS([{ data: '01/10/2026', valor: '4.68' }])).toBe(4.68);
    expect(parseSGS([])).toBeNull();
    expect(parseSGS({ erro: 'x' })).toBeNull();
  });

  it('usa /api/taxas quando responde', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ selic: 14.25, cdi: 14.15, ipca: 4.8 }), { headers: { 'content-type': 'application/json' } })));
    const r = await loadRates(true);
    expect(r).toMatchObject({ selic: 14.25, cdi: 14.15, ipca: 4.8, source: 'banco-central' });
    expect(getCachedRates().selic).toBe(14.25);
  });

  it('sem internet: usa o último guardado, ou o padrão', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect(await loadRates(true)).toEqual(DEFAULT_RATES);
    store.set('giro.rates', JSON.stringify({ selic: 13, cdi: 12.9, ipca: 5, updatedAt: '2026-01-01T00:00:00Z', source: 'banco-central' }));
    expect(await loadRates(true)).toMatchObject({ selic: 13, source: 'guardado' });
  });

  it('valor manual tem prioridade e pode ser desfeito', async () => {
    setManualRates({ selic: 10, cdi: 9.9, ipca: 3 });
    expect(await loadRates(true)).toMatchObject({ selic: 10, source: 'manual' });
    setManualRates(null);
    expect(getCachedRates().source).toBe('padrao');
  });
});
