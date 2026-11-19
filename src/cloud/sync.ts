/**
 * Sincronização aparelho ⇄ nuvem.
 *
 * - O app grava sempre primeiro no aparelho; cada alteração entra na fila (_outbox).
 * - sync(): envia a fila (push) e depois baixa o que mudou em outros aparelhos (pull).
 * - Conflito: vence a alteração mais recente (updatedAt). O servidor aplica a mesma regra.
 * - Itens apagados viram "tombstones" (deleted = true) para sumirem nos outros aparelhos.
 */
import { ackOutbox, COLLECTIONS, getAll, getOutbox, write, type CollectionKey, type OutboxEntry } from '../data/db';

export interface PushItem { collection: string; id: string; data: unknown | null; deleted: boolean; updated_at: string }
export interface RemoteRow { collection: string; id: string; data: any | null; deleted: boolean; updated_at: string; rev: number }
export interface Remote {
  push(items: PushItem[]): Promise<number>;
  pull(afterRev: number, limit: number): Promise<RemoteRow[]>;
}

export const CURSOR_KEY = 'giro.sync.cursor';
export const OWNER_KEY = 'giro.owner';
const PAGE = 500;
const MAX_ITEMS = 200;
const MAX_BYTES = 900_000;

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return memLs.get(k) ?? null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { memLs.set(k, v); } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { memLs.delete(k); } },
};
const memLs = new Map<string, string>();
export const syncStorage = ls;

export const getCursor = () => { const v = ls.get(CURSOR_KEY); return v == null ? null : Number(v) || 0; };
/** O primeiro download da conta já terminou neste aparelho? */
export const initialPullDone = () => getCursor() != null;

const isCollection = (c: string): c is CollectionKey => (COLLECTIONS as string[]).includes(c);

/** Envia a fila em lotes. Devolve quantos itens foram enviados. */
export async function pushOutbox(remote: Remote): Promise<number> {
  const queue = await getOutbox();
  if (!queue.length) return 0;
  // Lê o estado atual de cada coleção que tem algo na fila.
  const byCol = new Map<CollectionKey, Map<string, any>>();
  for (const c of new Set(queue.map((q) => q.collection))) byCol.set(c, new Map((await getAll(c)).map((x: any) => [x.id, x])));

  let batch: { e: OutboxEntry; item: PushItem }[] = []; let bytes = 0; let sent = 0;
  const flush = async () => {
    if (!batch.length) return;
    await remote.push(batch.map((b) => b.item));
    await ackOutbox(batch.map((b) => b.e));
    sent += batch.length; batch = []; bytes = 0;
  };
  for (const e of queue) {
    const rec = byCol.get(e.collection)?.get(e.id);
    const item: PushItem = rec
      ? { collection: e.collection, id: e.id, data: rec, deleted: false, updated_at: rec.updatedAt ?? e.at }
      : { collection: e.collection, id: e.id, data: null, deleted: true, updated_at: e.at };
    const size = rec ? JSON.stringify(rec).length : 100;
    if (batch.length && (batch.length >= MAX_ITEMS || bytes + size > MAX_BYTES)) await flush();
    batch.push({ e, item }); bytes += size;
  }
  await flush();
  return sent;
}

/** Baixa tudo que mudou desde o último download. Devolve quantos registros foram aplicados. */
export async function pullChanges(remote: Remote): Promise<number> {
  let cursor = getCursor() ?? 0;
  let applied = 0;
  for (;;) {
    const rows = await remote.pull(cursor, PAGE);
    if (!rows.length) break;
    // Alteração local ainda não enviada e mais nova que a da nuvem: mantém a local.
    const pending = new Map((await getOutbox()).map((e) => [e.key, e.at]));
    const put: Partial<Record<CollectionKey, any[]>> = {}; const del: Partial<Record<CollectionKey, string[]>> = {};
    for (const r of rows) {
      if (!isCollection(r.collection)) continue;
      const localAt = pending.get(`${r.collection}/${r.id}`);
      if (localAt && localAt > r.updated_at) continue;
      if (r.deleted || r.data == null) (del[r.collection] ??= []).push(r.id);
      else (put[r.collection] ??= []).push({ ...r.data, id: r.id });
      applied++;
    }
    await write({ put, del }, { track: false });
    cursor = Math.max(cursor, ...rows.map((r) => r.rev));
    ls.set(CURSOR_KEY, String(cursor));
    if (rows.length < PAGE) break;
  }
  if (getCursor() == null) ls.set(CURSOR_KEY, String(cursor));
  return applied;
}

// ---------------------------------------------------------------------------
// Estado visível (indicador "Sincronizado" na tela)
// ---------------------------------------------------------------------------
export type SyncPhase = 'off' | 'idle' | 'syncing' | 'offline' | 'error';
export interface SyncStatus { phase: SyncPhase; pending: number; lastSyncAt: string | null; error: string | null }
let status: SyncStatus = { phase: 'off', pending: 0, lastSyncAt: null, error: null };
const listeners = new Set<(s: SyncStatus) => void>();
export const getSyncStatus = () => status;
export const subscribeSync = (fn: (s: SyncStatus) => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const setStatus = (patch: Partial<SyncStatus>) => { status = { ...status, ...patch }; listeners.forEach((l) => l(status)); };
export const resetSyncStatus = () => setStatus({ phase: 'off', pending: 0, lastSyncAt: null, error: null });
export const refreshPending = async () => setStatus({ pending: (await getOutbox()).length });

const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

let running: Promise<number> | null = null;
let again = false;

/** Envia e recebe. Se já estiver rodando, agenda mais uma rodada. Devolve quantos registros chegaram. */
export function syncNow(remote: Remote, onApplied?: () => void): Promise<number> {
  if (running) { again = true; return running; }
  running = (async () => {
    let total = 0;
    do {
      again = false;
      if (offline()) { setStatus({ phase: 'offline' }); await refreshPending(); break; }
      setStatus({ phase: 'syncing', error: null });
      try {
        await pushOutbox(remote);
        const n = await pullChanges(remote);
        total += n;
        if (n) onApplied?.();
        setStatus({ phase: 'idle', lastSyncAt: new Date().toISOString() });
      } catch (e: any) {
        const net = offline() || /fetch|network|Failed to fetch|NetworkError|Load failed/i.test(String(e?.message ?? e));
        setStatus({ phase: net ? 'offline' : 'error', error: net ? null : String(e?.message ?? e) });
        if (!net) console.error('sync', e);
        again = false;
      }
      await refreshPending();
    } while (again);
    return total;
  })().finally(() => { running = null; });
  return running;
}

// Avisos de "o usuário gravou algo" (DataProvider → agenda uma sincronização).
const changeListeners = new Set<() => void>();
export const onLocalChange = (fn: () => void) => { changeListeners.add(fn); return () => { changeListeners.delete(fn); }; };
export const emitLocalChange = () => changeListeners.forEach((f) => f());
