import { describe, expect, it } from 'vitest';
import { COLLECTIONS } from '../data/db';
import { buildContext, recurringExpenses, unusualSpending, type Data } from './summary';
import { looksLikeKey, maskKey } from './config';
import type { Transaction } from '../types';

const empty = () => Object.fromEntries(COLLECTIONS.map((c) => [c, []])) as unknown as Data;
let n = 0;
const tx = (o: Partial<Transaction>): Transaction => ({ id: `t${n++}`, description: 'x', amount: 10, type: 'expense', category: 'Outros', paymentMethod: 'pix', date: '2026-11-10', ...o });
const TODAY = '2026-11-17';

describe('recurringExpenses', () => {
  it('acha gasto que se repete em 3 meses com valor parecido', () => {
    const t = ['2026-09-05', '2026-10-05', '2026-11-05'].map((date) => tx({ description: 'Netflix', amount: 39.9, category: 'Assinaturas', date }));
    t.push(tx({ description: 'Mercado', amount: 300, date: '2026-09-02' }), tx({ description: 'Mercado', amount: 80, date: '2026-10-02' }), tx({ description: 'mercado', amount: 520, date: '2026-11-02' }));
    const r = recurringExpenses({ transactions: t }, TODAY);
    expect(r.map((x) => x.name)).toEqual(['Netflix']);
    expect(r[0].monthly).toBe(39.9);
  });
});

describe('unusualSpending', () => {
  it('aponta categoria bem acima da média dos 3 meses anteriores', () => {
    const t = ['2026-08-10', '2026-09-10', '2026-10-10'].map((date) => tx({ category: 'Lazer', amount: 100, date }));
    t.push(tx({ category: 'Lazer', amount: 260, date: '2026-11-03' }));
    t.push(...['2026-08-10', '2026-09-10', '2026-10-10', '2026-11-10'].map((date) => tx({ category: 'Mercado', amount: 500, date })));
    const u = unusualSpending({ transactions: t, fixed: [] }, TODAY);
    expect(u).toEqual([{ category: 'Lazer', thisMonth: 260, average: 100, ratio: 2.6 }]);
  });
});

describe('buildContext', () => {
  const data = () => {
    const d = empty();
    d.transactions = ['2026-09-05', '2026-10-05', '2026-11-05'].map((date) => tx({ description: 'Spotify Família', amount: 34.9, category: 'Assinaturas', date }));
    d.goals = [{ id: 'g', description: 'Moto nova', type: 'financial', targetAmount: 15000, currentAmount: 3000, deadline: '2027-11-17' }];
    return d;
  };
  it('não envia descrições de lançamentos sem permissão', () => {
    const c = buildContext(data(), TODAY);
    expect(c).not.toContain('Spotify');
    expect(c).toContain('Assinaturas');
    expect(c).toContain('Moto nova');
    expect(JSON.parse(c).finance.recurringExpenses).toHaveLength(1);
  });
  it('envia o nome quando o usuário permite', () => {
    expect(buildContext(data(), TODAY, { shareDescriptions: true })).toContain('Spotify Família');
  });
  it('fica pequeno mesmo com muitos lançamentos', () => {
    const d = data();
    for (let i = 0; i < 3000; i++) d.transactions.push(tx({ description: `compra ${i}`, amount: 10 + (i % 50), category: ['Mercado', 'Combustível', 'Lazer'][i % 3], date: `2026-${String(6 + (i % 6)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}` }));
    expect(buildContext(d, TODAY).length).toBeLessThan(6000);
  });
  it('driver é null sem turnos', () => {
    expect(JSON.parse(buildContext(empty(), TODAY)).driver).toBeNull();
  });
});

describe('chave', () => {
  it('valida formato e mascara', () => {
    expect(looksLikeKey('sk-ant-api03-abcdefghijklmnopqrstuvwxyz')).toBe(true);
    expect(looksLikeKey('minha-chave')).toBe(false);
    expect(maskKey('sk-ant-api03-abcdefghijklmnopqrstuvwxyz')).toBe('sk-ant-api…wxyz');
  });
});
