import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { COLLECTIONS, getAll, getEngine, newId, requestPersistence, write, type CollectionKey, type Collections, type Engine } from './db';
import { useToast } from './toast';

type Store = { [K in CollectionKey]: Collections[K][] };
const EMPTY = Object.fromEntries(COLLECTIONS.map((c) => [c, []])) as unknown as Store;

/** Ordem de exibição de cada coleção. */
const byDateDesc = (a: any, b: any) => (b.date ?? '').localeCompare(a.date ?? '') || (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
const byCreatedDesc = (a: any, b: any) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
const byCreatedAsc = (a: any, b: any) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
const SORT: Record<CollectionKey, (a: any, b: any) => number> = {
  transactions: byDateDesc, sessions: byDateDesc, vehicleExpenses: byDateDesc,
  goals: byCreatedDesc, shopping: byCreatedDesc, fixedPayments: byCreatedDesc,
  fixed: byCreatedAsc, vehicles: byCreatedAsc, settings: byCreatedAsc, accounts: byCreatedAsc, cards: byCreatedAsc, budgets: byCreatedAsc,
};

interface DataApi {
  data: Store;
  loading: boolean;
  persisted: boolean;
  engine: Engine | null;
  insert: <K extends CollectionKey>(k: K, items: Partial<Collections[K]> | Partial<Collections[K]>[]) => Promise<Collections[K][] | null>;
  update: <K extends CollectionKey>(k: K, id: string, patch: Partial<Collections[K]>) => Promise<boolean>;
  remove: <K extends CollectionKey>(k: K, id: string) => Promise<boolean>;
  /** Grava um registro com id fixo (cria ou substitui). */
  put: <K extends CollectionKey>(k: K, item: Collections[K]) => Promise<boolean>;
  replaceAll: (data: Partial<Record<CollectionKey, any[]>>) => Promise<boolean>;
}

const Ctx = createContext<DataApi | null>(null);
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('giro-data') : null;

export function DataProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [data, setData] = useState<Store>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [persisted, setPersisted] = useState(false);
  const [engine, setEngine] = useState<Engine | null>(null);

  const load = useCallback(async () => {
    const entries = await Promise.all(COLLECTIONS.map(async (c) => [c, (await getAll(c)).sort(SORT[c])] as const));
    const store = Object.fromEntries(entries) as unknown as Store;
    // Primeira abertura (ou vindo de versão antiga): cria a conta "Carteira" e coloca nela
    // os lançamentos que ainda não têm conta nem cartão.
    if (store.accounts.length === 0) {
      const now = new Date().toISOString();
      const wallet = { id: newId(), name: 'Carteira', kind: 'carteira', color: '#22c55e', initialBalance: 0, createdAt: now, updatedAt: now };
      const orphan = (store.transactions as any[]).filter((t) => !t.accountId && !t.cardId).map((t) => ({ ...t, accountId: wallet.id }));
      await write({ put: { accounts: [wallet], transactions: orphan } });
      store.accounts = [wallet] as any;
      const ids = new Map(orphan.map((t) => [t.id, t]));
      store.transactions = (store.transactions as any[]).map((t) => ids.get(t.id) ?? t) as any;
    }
    setData(store);
  }, []);

  useEffect(() => {
    load().catch((e) => { console.error(e); toast('Não foi possível abrir o banco local deste navegador.', 'error'); }).finally(() => setLoading(false));
    requestPersistence().then(setPersisted);
    getEngine().then((e) => {
      setEngine(e);
      if (e === 'memory') toast('Este navegador não deixa o app guardar dados: o que você lançar some ao fechar. Abra o link no Chrome ou Safari.', 'error');
    });
    // Mantém outras abas abertas atualizadas.
    const onMsg = () => load();
    channel?.addEventListener('message', onMsg);
    return () => channel?.removeEventListener('message', onMsg);
  }, [load, toast]);

  /** Aplica a gravação no banco e no estado; avisa as outras abas. */
  const commit = useCallback(async (ops: Parameters<typeof write>[0]) => {
    try {
      await write(ops);
      await load();
      channel?.postMessage('changed');
      return true;
    } catch (e: any) {
      console.error(e);
      toast(`Não foi possível salvar: ${e?.message ?? 'erro desconhecido'}`, 'error');
      return false;
    }
  }, [load, toast]);

  const insert: DataApi['insert'] = useCallback(async (k, items) => {
    const now = new Date().toISOString();
    // Lançamento sem conta nem cartão vai para a conta padrão (a primeira ativa).
    const defaultAccount = (data.accounts as any[]).find((a) => !a.archived)?.id ?? null;
    const list = (Array.isArray(items) ? items : [items]).map((i: any) => ({
      ...i,
      ...(k === 'transactions' && !i.accountId && !i.cardId ? { accountId: defaultAccount } : {}),
      id: newId(), createdAt: now, updatedAt: now,
    })) as any[];
    return (await commit({ put: { [k]: list } })) ? list : null;
  }, [commit, data.accounts]);

  const update: DataApi['update'] = useCallback(async (k, id, patch) => {
    const cur = (data[k] as any[]).find((x) => x.id === id);
    if (!cur) return false;
    return commit({ put: { [k]: [{ ...cur, ...patch, id, updatedAt: new Date().toISOString() }] } });
  }, [commit, data]);

  const remove: DataApi['remove'] = useCallback(async (k, id) => {
    const ops: Parameters<typeof write>[0] = { del: { [k]: [id] }, put: {} };
    // Mesmas regras que um banco relacional faria: apagar o "pai" limpa os "filhos".
    // Transferência tem dois lados: apaga os dois.
    if (k === 'transactions') {
      const t = (data.transactions as any[]).find((x) => x.id === id);
      if (t?.transferGroup) ops.del!.transactions = (data.transactions as any[]).filter((x) => x.transferGroup === t.transferGroup).map((x) => x.id);
      // Apagar o lançamento de uma conta fixa paga desmarca o pagamento.
      if (t?.internal === 'fixed-payment') ops.del!.fixedPayments = (data.fixedPayments as any[]).filter((p) => p.transactionId === id).map((p) => p.id);
    }
    if (k === 'accounts' || k === 'cards') return false; // contas e cartões são arquivados, não apagados
    // Desmarcar conta fixa paga: desfaz também a saída/entrada na conta.
    if (k === 'fixedPayments') {
      const p = (data.fixedPayments as any[]).find((x) => x.id === id);
      if (p?.transactionId) ops.del!.transactions = [p.transactionId];
    }
    if (k === 'vehicles') {
      ops.del!.vehicleExpenses = data.vehicleExpenses.filter((e) => e.vehicleId === id).map((e) => e.id);
      ops.put!.sessions = data.sessions.filter((s) => s.vehicleId === id).map((s) => ({ ...s, vehicleId: null }));
      ops.put!.transactions = data.transactions.filter((t) => t.vehicleId === id).map((t) => ({ ...t, vehicleId: null }));
    }
    if (k === 'fixed') ops.del!.fixedPayments = data.fixedPayments.filter((p) => p.fixedId === id).map((p) => p.id);
    return commit(ops);
  }, [commit, data]);

  const put: DataApi['put'] = useCallback(async (k, item) => {
    const now = new Date().toISOString();
    const cur = (data[k] as any[]).find((x) => x.id === (item as any).id);
    return commit({ put: { [k]: [{ ...item, createdAt: cur?.createdAt ?? now, updatedAt: now }] } });
  }, [commit, data]);

  const replaceAll: DataApi['replaceAll'] = useCallback(async (incoming) => {
    const now = new Date().toISOString();
    const put = Object.fromEntries(Object.entries(incoming).map(([c, items]) => [c, (items ?? []).map((x) => ({ createdAt: now, updatedAt: now, ...x }))]));
    return commit({ clear: [...COLLECTIONS], put });
  }, [commit]);

  const api = useMemo(() => ({ data, loading, persisted, engine, insert, update, remove, put, replaceAll }), [data, loading, persisted, engine, insert, update, remove, put, replaceAll]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useData() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useData fora do DataProvider');
  return ctx;
}
