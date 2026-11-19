import { beforeEach, describe, expect, it } from 'vitest';
import { getAll, getOutbox, setTracking, wipeLocal, write, enqueueAll } from '../data/db';
import { CURSOR_KEY, pullChanges, pushOutbox, syncNow, syncStorage, type PushItem, type Remote, type RemoteRow } from './sync';

/** Servidor falso com as mesmas regras de supabase/giro.sql (mais recente ganha; rev crescente). */
class FakeServer implements Remote {
  rows = new Map<string, RemoteRow>(); rev = 0; pushes = 0; fail = false;
  async push(items: PushItem[]) {
    if (this.fail) throw new TypeError('Failed to fetch');
    this.pushes++;
    let n = 0;
    for (const it of items) {
      const k = `${it.collection}/${it.id}`; const cur = this.rows.get(k);
      if (cur && cur.updated_at > it.updated_at) continue;
      this.rows.set(k, { ...it, data: it.deleted ? null : it.data, rev: ++this.rev }); n++;
    }
    return n;
  }
  async pull(after: number, limit: number) {
    if (this.fail) throw new TypeError('Failed to fetch');
    return [...this.rows.values()].filter((r) => r.rev > after).sort((a, b) => a.rev - b.rev).slice(0, limit);
  }
}
const tx = (id: string, amount: number, updatedAt: string) => ({ id, description: 'x', amount, type: 'expense', category: 'Mercado', paymentMethod: 'pix', date: '2026-11-19', createdAt: updatedAt, updatedAt });

beforeEach(async () => { setTracking(false); await wipeLocal(); syncStorage.del(CURSOR_KEY); setTracking(true); });

describe('sincronização', () => {
  it('alteração local entra na fila, sobe e sai da fila', async () => {
    const s = new FakeServer();
    await write({ put: { transactions: [tx('a', 10, '2026-11-19T10:00:00.000Z')] } });
    expect((await getOutbox()).map((e) => e.key)).toEqual(['transactions/a']);
    await pushOutbox(s);
    expect(await getOutbox()).toEqual([]);
    expect((s.rows.get('transactions/a')!.data as any).amount).toBe(10);
  });

  it('apagar no aparelho apaga na nuvem', async () => {
    const s = new FakeServer();
    await write({ put: { transactions: [tx('a', 10, '2025-01-01T10:00:00.000Z')] } });
    await pushOutbox(s);
    await write({ del: { transactions: ['a'] } });
    await pushOutbox(s);
    expect(s.rows.get('transactions/a')!.deleted).toBe(true);
  });

  it('baixa o que outro aparelho mandou, sem pôr na fila', async () => {
    const s = new FakeServer();
    await s.push([{ collection: 'transactions', id: 'b', data: tx('b', 50, '2026-11-19T09:00:00.000Z'), deleted: false, updated_at: '2026-11-19T09:00:00.000Z' }]);
    expect(await pullChanges(s)).toBe(1);
    expect((await getAll('transactions')).map((t) => t.amount)).toEqual([50]);
    expect(await getOutbox()).toEqual([]);
    expect(syncStorage.get(CURSOR_KEY)).toBe('1');
    // apagado lá → some aqui
    await s.push([{ collection: 'transactions', id: 'b', data: null, deleted: true, updated_at: '2026-11-19T11:00:00.000Z' }]);
    await pullChanges(s);
    expect(await getAll('transactions')).toEqual([]);
  });

  it('conflito: a alteração mais recente ganha nos dois sentidos', async () => {
    const s = new FakeServer();
    // nuvem tem versão das 12h; aparelho editou às 11h sem internet → nuvem ganha
    await s.push([{ collection: 'transactions', id: 'c', data: tx('c', 120, '2026-11-19T12:00:00.000Z'), deleted: false, updated_at: '2026-11-19T12:00:00.000Z' }]);
    await write({ put: { transactions: [tx('c', 110, '2026-11-19T11:00:00.000Z')] } });
    await syncNow(s);
    expect((await getAll('transactions'))[0].amount).toBe(120);
    // aparelho edita às 13h → aparelho ganha
    await write({ put: { transactions: [tx('c', 130, '2026-11-19T13:00:00.000Z')] } });
    await syncNow(s);
    expect((s.rows.get('transactions/c')!.data as any).amount).toBe(130);
    expect((await getAll('transactions'))[0].amount).toBe(130);
  });

  it('não sobrescreve edição local pendente mais nova ao baixar', async () => {
    const s = new FakeServer();
    await s.push([{ collection: 'transactions', id: 'd', data: tx('d', 1, '2026-11-19T08:00:00.000Z'), deleted: false, updated_at: '2026-11-19T08:00:00.000Z' }]);
    await write({ put: { transactions: [tx('d', 2, '2026-11-19T09:00:00.000Z')] } });
    await pullChanges(s);
    expect((await getAll('transactions'))[0].amount).toBe(2);
  });

  it('sem internet: mantém a fila e envia depois', async () => {
    const s = new FakeServer(); s.fail = true;
    await write({ put: { transactions: [tx('e', 5, '2026-11-19T10:00:00.000Z')] } });
    await syncNow(s);
    expect((await getOutbox()).length).toBe(1);
    s.fail = false;
    await syncNow(s);
    expect((await getOutbox()).length).toBe(0);
    expect(s.rows.has('transactions/e')).toBe(true);
  });

  it('primeiro login sobe tudo em lotes', async () => {
    const s = new FakeServer();
    setTracking(false);
    await write({ put: { transactions: Array.from({ length: 450 }, (_, i) => tx(`t${i}`, i, '2026-11-19T10:00:00.000Z')), goals: [{ id: 'g', description: 'Moto', type: 'financial', targetAmount: 1, currentAmount: 0, createdAt: 'x', updatedAt: '2026-11-19T10:00:00.000Z' }] } });
    expect(await getOutbox()).toEqual([]);
    setTracking(true);
    expect(await enqueueAll()).toBe(451);
    await pushOutbox(s);
    expect(s.rows.size).toBe(451);
    expect(s.pushes).toBe(3);
  });

  it('restaurar backup com login: o que sumiu vira apagado na nuvem', async () => {
    const s = new FakeServer();
    await write({ put: { transactions: [tx('x', 1, '2025-01-01T10:00:00.000Z'), tx('y', 2, '2026-11-19T10:00:00.000Z')] } });
    await pushOutbox(s);
    await write({ clear: ['transactions'], put: { transactions: [tx('y', 3, '2026-11-19T12:00:00.000Z')] } });
    await pushOutbox(s);
    expect(s.rows.get('transactions/x')!.deleted).toBe(true);
    expect((s.rows.get('transactions/y')!.data as any).amount).toBe(3);
  });
});
