/**
 * Banco local no aparelho (IndexedDB). Sem servidor, funciona offline.
 * Cada coleção vira um "object store" com chave `id`.
 * No futuro, um módulo de sincronização (ex.: Supabase) pode ler/gravar daqui.
 */
import type { DriverSession, FixedBill, FixedPayment, Goal, ShoppingItem, Transaction, Vehicle, VehicleExpense, WorkProfile, Account, Card, Budget, Attachment, Simulation, GoalContribution, Debt, AppPrefs, InvestmentOp } from '../types';

export interface Collections {
  transactions: Transaction;
  fixed: FixedBill;
  fixedPayments: FixedPayment;
  sessions: DriverSession;
  vehicles: Vehicle;
  vehicleExpenses: VehicleExpense;
  goals: Goal;
  shopping: ShoppingItem;
  settings: WorkProfile;
  accounts: Account;
  cards: Card;
  budgets: Budget;
  attachments: Attachment;
  simulations: Simulation;
  goalContributions: GoalContribution;
  debts: Debt;
  prefs: AppPrefs;
  investments: InvestmentOp;
}
export type CollectionKey = keyof Collections;
export const COLLECTIONS: CollectionKey[] = ['transactions', 'fixed', 'fixedPayments', 'sessions', 'vehicles', 'vehicleExpenses', 'goals', 'shopping', 'settings', 'accounts', 'cards', 'budgets', 'attachments', 'simulations', 'goalContributions', 'debts', 'prefs', 'investments'];

/** Todo registro guarda quando foi criado/alterado — útil para ordenar e, no futuro, sincronizar. */
export type Stored<T> = T & { createdAt: string; updatedAt: string };

const DB_NAME = 'giro';
/** Fila de sincronização: chaves "coleção/id" alteradas no aparelho e ainda não enviadas à nuvem. */
export const OUTBOX = '_outbox';
export interface OutboxEntry { key: string; collection: CollectionKey; id: string; at: string }
const DB_VERSION = 11; // v11: "investments" · v10: "prefs" · v9: "debts" · v8: "_outbox" · v7: "goalContributions" · v6: "simulations" · v2: "settings" · v3: "accounts" e "cards" · v4: "budgets" · v5: "attachments"
let dbPromise: Promise<IDBDatabase> | null = null;

export function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const c of COLLECTIONS) if (!db.objectStoreNames.contains(c)) db.createObjectStore(c, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(OUTBOX)) db.createObjectStore(OUTBOX, { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { dbPromise = null; reject(req.error); };
  });
  return dbPromise;
}

const done = (tx: IDBTransaction) => new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });

// ---------------------------------------------------------------------------
// Plano B: alguns navegadores (dentro do WhatsApp/Instagram, abas anônimas,
// modos restritos) bloqueiam ou travam o IndexedDB. Nesse caso usamos o
// localStorage; se nem ele existir, guardamos só na memória (e avisamos).
// ---------------------------------------------------------------------------
export type Engine = 'idb' | 'local' | 'memory';
let enginePromise: Promise<Engine> | null = null;
const LS = (c: CollectionKey) => `giro.c.${c}`;
const memory = new Map<CollectionKey, Map<string, any>>();

const withTimeout = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('tempo esgotado')), ms))]);

function localAvailable() {
  try { localStorage.setItem('giro.probe', '1'); localStorage.removeItem('giro.probe'); return true; } catch { return false; }
}

export function getEngine(): Promise<Engine> {
  if (!enginePromise) {
    enginePromise = (async () => {
      try {
        if (typeof indexedDB === 'undefined') throw new Error('sem IndexedDB');
        await withTimeout(openDB(), 3000);
        return 'idb' as const;
      } catch (e) {
        console.warn('IndexedDB indisponível, usando alternativa:', e);
        return localAvailable() ? 'local' : 'memory';
      }
    })();
  }
  return enginePromise;
}

const readLocal = (c: CollectionKey): any[] => { try { return JSON.parse(localStorage.getItem(LS(c)) || '[]'); } catch { return []; } };
const mem = (c: CollectionKey) => { if (!memory.has(c)) memory.set(c, new Map()); return memory.get(c)!; };

export async function getAll<K extends CollectionKey>(c: K): Promise<Stored<Collections[K]>[]> {
  const engine = await getEngine();
  if (engine === 'local') return readLocal(c);
  if (engine === 'memory') return [...mem(c).values()];
  const db = await openDB();
  return new Promise((res, rej) => {
    const req = db.transaction(c).objectStore(c).getAll();
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

type WriteOps = { put?: Partial<Record<CollectionKey, any[]>>; del?: Partial<Record<CollectionKey, string[]>>; clear?: CollectionKey[] };

// Com login ativo, toda gravação feita pelo usuário entra na fila de sincronização.
// Dados que chegam da nuvem são gravados com { track: false }.
let tracking = false;
export const setTracking = (on: boolean) => { tracking = on; };
export const isTracking = () => tracking;

const LS_OUTBOX = `giro.c.${OUTBOX}`;
const memOutbox = new Map<string, OutboxEntry>();
const readLocalOutbox = (): OutboxEntry[] => { try { return JSON.parse(localStorage.getItem(LS_OUTBOX) || '[]'); } catch { return []; } };
const entry = (collection: CollectionKey, id: string, at: string): OutboxEntry => ({ key: `${collection}/${id}`, collection, id, at });

/** Grava várias coleções de uma vez (no IndexedDB, numa única transação: tudo ou nada). */
export async function write(ops: WriteOps, opts: { track?: boolean } = {}) {
  const track = opts.track ?? tracking;
  const names = [...new Set([...Object.keys(ops.put ?? {}), ...Object.keys(ops.del ?? {}), ...(ops.clear ?? [])])] as CollectionKey[];
  if (!names.length) return;
  const now = new Date().toISOString();
  const touched: OutboxEntry[] = [];
  if (track) {
    for (const [c, items] of Object.entries(ops.put ?? {})) for (const it of items ?? []) touched.push(entry(c as CollectionKey, it.id, it.updatedAt ?? now));
    for (const [c, ids] of Object.entries(ops.del ?? {})) for (const id of ids ?? []) touched.push(entry(c as CollectionKey, id, now));
  }
  const putIds = (c: CollectionKey) => new Set((ops.put?.[c] ?? []).map((x: any) => x.id));
  const engine = await getEngine();
  if (engine !== 'idb') {
    // Calcula tudo antes de gravar, para não deixar coleções pela metade.
    const next = new Map<CollectionKey, Map<string, any>>();
    for (const c of names) {
      const before = engine === 'local' ? readLocal(c) : [...mem(c).values()];
      const cleared = (ops.clear ?? []).includes(c);
      if (cleared && track) { const keep = putIds(c); for (const x of before) if (!keep.has(x.id)) touched.push(entry(c, x.id, now)); }
      const cur = new Map<string, any>(cleared ? [] : before.map((x: any) => [x.id, x]));
      for (const it of ops.put?.[c] ?? []) cur.set(it.id, it);
      for (const id of ops.del?.[c] ?? []) cur.delete(id);
      next.set(c, cur);
    }
    for (const [c, m] of next) {
      if (engine === 'local') localStorage.setItem(LS(c), JSON.stringify([...m.values()]));
      else memory.set(c, m);
    }
    if (touched.length) {
      if (engine === 'local') { const ob = new Map(readLocalOutbox().map((e) => [e.key, e])); for (const t of touched) ob.set(t.key, t); localStorage.setItem(LS_OUTBOX, JSON.stringify([...ob.values()])); }
      else for (const t of touched) memOutbox.set(t.key, t);
    }
    return;
  }
  const db = await openDB();
  const tx = db.transaction(track ? [...names, OUTBOX] : names, 'readwrite');
  for (const c of ops.clear ?? []) {
    const store = tx.objectStore(c);
    if (track) {
      // Restaurar backup com login: o que existia e não veio no backup vira "apagado" na nuvem.
      const keep = putIds(c);
      const req = store.getAllKeys();
      req.onsuccess = () => { for (const id of req.result as string[]) if (!keep.has(id)) tx.objectStore(OUTBOX).put(entry(c, id, now)); };
    }
    store.clear();
  }
  for (const [c, items] of Object.entries(ops.put ?? {})) for (const it of items ?? []) tx.objectStore(c).put(it);
  for (const [c, ids] of Object.entries(ops.del ?? {})) for (const id of ids ?? []) tx.objectStore(c).delete(id);
  for (const t of touched) tx.objectStore(OUTBOX).put(t);
  await done(tx);
}

export async function getOutbox(): Promise<OutboxEntry[]> {
  const engine = await getEngine();
  if (engine === 'local') return readLocalOutbox();
  if (engine === 'memory') return [...memOutbox.values()];
  const db = await openDB();
  return new Promise((res, rej) => { const r = db.transaction(OUTBOX).objectStore(OUTBOX).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}

/** Tira da fila o que já foi enviado — só se não mudou de novo enquanto enviava. */
export async function ackOutbox(sent: OutboxEntry[]) {
  const engine = await getEngine();
  if (engine !== 'idb') {
    const cur = engine === 'local' ? new Map(readLocalOutbox().map((e) => [e.key, e])) : memOutbox;
    for (const s of sent) if (cur.get(s.key)?.at === s.at) cur.delete(s.key);
    if (engine === 'local') localStorage.setItem(LS_OUTBOX, JSON.stringify([...cur.values()]));
    return;
  }
  const db = await openDB();
  const tx = db.transaction(OUTBOX, 'readwrite');
  const store = tx.objectStore(OUTBOX);
  for (const s of sent) { const r = store.get(s.key); r.onsuccess = () => { if (r.result?.at === s.at) store.delete(s.key); }; }
  await done(tx);
}

/** Põe todos os registros do aparelho na fila (primeiro login: sobe tudo para a conta). */
export async function enqueueAll() {
  const put: Partial<Record<CollectionKey, any[]>> = {};
  for (const c of COLLECTIONS) put[c] = await getAll(c);
  const engine = await getEngine();
  const all = Object.entries(put).flatMap(([c, items]) => (items ?? []).map((x: any) => entry(c as CollectionKey, x.id, x.updatedAt ?? new Date().toISOString())));
  if (!all.length) return 0;
  if (engine !== 'idb') {
    if (engine === 'local') { const ob = new Map(readLocalOutbox().map((e) => [e.key, e])); for (const t of all) ob.set(t.key, t); localStorage.setItem(LS_OUTBOX, JSON.stringify([...ob.values()])); }
    else for (const t of all) memOutbox.set(t.key, t);
    return all.length;
  }
  const db = await openDB();
  const tx = db.transaction(OUTBOX, 'readwrite');
  for (const t of all) tx.objectStore(OUTBOX).put(t);
  await done(tx);
  return all.length;
}

/** Apaga todos os dados deste aparelho (ao sair da conta). */
export async function wipeLocal() {
  await write({ clear: [...COLLECTIONS] }, { track: false });
  const engine = await getEngine();
  if (engine === 'local') localStorage.removeItem(LS_OUTBOX);
  else if (engine === 'memory') memOutbox.clear();
  else { const db = await openDB(); const tx = db.transaction(OUTBOX, 'readwrite'); tx.objectStore(OUTBOX).clear(); await done(tx); }
}

export const newId = () => (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

/** Pede ao navegador para não apagar os dados quando faltar espaço. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    return (await navigator.storage.persisted()) || (await navigator.storage.persist());
  } catch { return false; }
}
