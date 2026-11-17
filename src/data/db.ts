/**
 * Banco local no aparelho (IndexedDB). Sem servidor, funciona offline.
 * Cada coleção vira um "object store" com chave `id`.
 * No futuro, um módulo de sincronização (ex.: Supabase) pode ler/gravar daqui.
 */
import type { DriverSession, FixedBill, FixedPayment, Goal, ShoppingItem, Transaction, Vehicle, VehicleExpense, WorkProfile, Account, Card, Budget, Attachment } from '../types';

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
}
export type CollectionKey = keyof Collections;
export const COLLECTIONS: CollectionKey[] = ['transactions', 'fixed', 'fixedPayments', 'sessions', 'vehicles', 'vehicleExpenses', 'goals', 'shopping', 'settings', 'accounts', 'cards', 'budgets', 'attachments'];

/** Todo registro guarda quando foi criado/alterado — útil para ordenar e, no futuro, sincronizar. */
export type Stored<T> = T & { createdAt: string; updatedAt: string };

const DB_NAME = 'giro';
const DB_VERSION = 5; // v2: "settings" · v3: "accounts" e "cards" · v4: "budgets" · v5: "attachments"
let dbPromise: Promise<IDBDatabase> | null = null;

export function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const c of COLLECTIONS) if (!db.objectStoreNames.contains(c)) db.createObjectStore(c, { keyPath: 'id' });
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

/** Grava várias coleções de uma vez (no IndexedDB, numa única transação: tudo ou nada). */
export async function write(ops: WriteOps) {
  const names = [...new Set([...Object.keys(ops.put ?? {}), ...Object.keys(ops.del ?? {}), ...(ops.clear ?? [])])] as CollectionKey[];
  if (!names.length) return;
  const engine = await getEngine();
  if (engine !== 'idb') {
    // Calcula tudo antes de gravar, para não deixar coleções pela metade.
    const next = new Map<CollectionKey, Map<string, any>>();
    for (const c of names) {
      const cur = new Map<string, any>((ops.clear ?? []).includes(c) ? [] : (engine === 'local' ? readLocal(c) : [...mem(c).values()]).map((x: any) => [x.id, x]));
      for (const it of ops.put?.[c] ?? []) cur.set(it.id, it);
      for (const id of ops.del?.[c] ?? []) cur.delete(id);
      next.set(c, cur);
    }
    for (const [c, m] of next) {
      if (engine === 'local') localStorage.setItem(LS(c), JSON.stringify([...m.values()]));
      else memory.set(c, m);
    }
    return;
  }
  const db = await openDB();
  const tx = db.transaction(names, 'readwrite');
  for (const c of ops.clear ?? []) tx.objectStore(c).clear();
  for (const [c, items] of Object.entries(ops.put ?? {})) for (const it of items ?? []) tx.objectStore(c).put(it);
  for (const [c, ids] of Object.entries(ops.del ?? {})) for (const id of ids ?? []) tx.objectStore(c).delete(id);
  await done(tx);
}

export const newId = () => (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

/** Pede ao navegador para não apagar os dados quando faltar espaço. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    return (await navigator.storage.persisted()) || (await navigator.storage.persist());
  } catch { return false; }
}
