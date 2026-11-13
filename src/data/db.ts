/**
 * Banco local no aparelho (IndexedDB). Sem servidor, funciona offline.
 * Cada coleção vira um "object store" com chave `id`.
 * No futuro, um módulo de sincronização (ex.: Supabase) pode ler/gravar daqui.
 */
import type { DriverSession, FixedBill, FixedPayment, Goal, ShoppingItem, Transaction, Vehicle, VehicleExpense } from '../types';

export interface Collections {
  transactions: Transaction;
  fixed: FixedBill;
  fixedPayments: FixedPayment;
  sessions: DriverSession;
  vehicles: Vehicle;
  vehicleExpenses: VehicleExpense;
  goals: Goal;
  shopping: ShoppingItem;
}
export type CollectionKey = keyof Collections;
export const COLLECTIONS: CollectionKey[] = ['transactions', 'fixed', 'fixedPayments', 'sessions', 'vehicles', 'vehicleExpenses', 'goals', 'shopping'];

/** Todo registro guarda quando foi criado/alterado — útil para ordenar e, no futuro, sincronizar. */
export type Stored<T> = T & { createdAt: string; updatedAt: string };

const DB_NAME = 'giro';
const DB_VERSION = 1;
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

export async function getAll<K extends CollectionKey>(c: K): Promise<Stored<Collections[K]>[]> {
  const db = await openDB();
  return new Promise((res, rej) => {
    const req = db.transaction(c).objectStore(c).getAll();
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

/** Grava várias coleções numa única transação (tudo ou nada). */
export async function write(ops: { put?: Partial<Record<CollectionKey, any[]>>; del?: Partial<Record<CollectionKey, string[]>>; clear?: CollectionKey[] }) {
  const db = await openDB();
  const names = [...new Set([...Object.keys(ops.put ?? {}), ...Object.keys(ops.del ?? {}), ...(ops.clear ?? [])])] as CollectionKey[];
  if (!names.length) return;
  const tx = db.transaction(names, 'readwrite');
  for (const c of ops.clear ?? []) tx.objectStore(c).clear();
  for (const [c, items] of Object.entries(ops.put ?? {})) for (const it of items ?? []) tx.objectStore(c).put(it);
  for (const [c, ids] of Object.entries(ops.del ?? {})) for (const id of ids ?? []) tx.objectStore(c).delete(id);
  await done(tx);
}

export const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

/** Pede ao navegador para não apagar os dados quando faltar espaço. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    return (await navigator.storage.persisted()) || (await navigator.storage.persist());
  } catch { return false; }
}
