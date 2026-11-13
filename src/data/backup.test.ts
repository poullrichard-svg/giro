import { describe, expect, it } from 'vitest';
import { buildBackup, parseBackup } from './backup';

describe('backup', () => {
  it('lê o próprio formato', () => {
    const b = buildBackup({ transactions: [{ id: 'a', amount: 1 }], fixed: [], fixedPayments: [], sessions: [], vehicles: [], vehicleExpenses: [], goals: [], shopping: [] } as any);
    expect(parseBackup(JSON.stringify(b)).transactions).toHaveLength(1);
  });
  it('aceita o backup da versão antiga (coleções na raiz)', () => {
    const r = parseBackup(JSON.stringify({ exportedAt: 'x', transactions: [{ id: 't' }], vehicles: [{ id: 'v' }, { nope: 1 }] }));
    expect(r.transactions).toHaveLength(1);
    expect(r.vehicles).toHaveLength(1);
  });
  it('rejeita arquivos inválidos', () => {
    expect(() => parseBackup('oi')).toThrow();
    expect(() => parseBackup('{"foo":1}')).toThrow();
  });
});
