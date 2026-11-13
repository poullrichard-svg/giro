import { createContext, lazy, Suspense, useContext, useState, type ReactNode } from 'react';
import {
  Calculator, Car, CarFront, Flag, LayoutDashboard, Menu, Plus, Repeat, ShoppingCart, Wallet,
} from 'lucide-react';
import { go, useRoute, type Route } from '../router';
import { useData } from '../data/DataProvider';
import { Logo } from './Logo';
import TransactionForm, { type TxPreset } from './TransactionForm';
import { cx } from './ui';

const Dashboard = lazy(() => import('../pages/Dashboard'));
const Transactions = lazy(() => import('../pages/Transactions'));
const FixedBills = lazy(() => import('../pages/FixedBills'));
const Driver = lazy(() => import('../pages/Driver'));
const Vehicles = lazy(() => import('../pages/Vehicles'));
const Calculators = lazy(() => import('../pages/calculators/Calculators'));
const Goals = lazy(() => import('../pages/Goals'));
const Shopping = lazy(() => import('../pages/Shopping'));
const More = lazy(() => import('../pages/More'));

const NAV: Array<{ id: Route; label: string; icon: typeof Wallet }> = [
  { id: 'inicio', label: 'Início', icon: LayoutDashboard },
  { id: 'lancamentos', label: 'Lançamentos', icon: Wallet },
  { id: 'fixas', label: 'Contas fixas', icon: Repeat },
  { id: 'motorista', label: 'Motorista', icon: Car },
  { id: 'veiculos', label: 'Veículos', icon: CarFront },
  { id: 'calculadoras', label: 'Calculadoras', icon: Calculator },
  { id: 'metas', label: 'Metas', icon: Flag },
  { id: 'compras', label: 'Lista de compras', icon: ShoppingCart },
];
const MOBILE: Route[] = ['inicio', 'lancamentos', 'motorista', 'mais'];

const QuickAddCtx = createContext<(p?: TxPreset) => void>(() => {});
export const useQuickAdd = () => useContext(QuickAddCtx);

export default function Shell() {
  const { route, param } = useRoute();
  const { loading } = useData();
  const [txOpen, setTxOpen] = useState(false);
  const [preset, setPreset] = useState<TxPreset | undefined>();
  const openTx = (p?: TxPreset) => { setPreset(p); setTxOpen(true); };

  const page: Record<Route, ReactNode> = {
    inicio: <Dashboard />, lancamentos: <Transactions />, fixas: <FixedBills />, motorista: <Driver />,
    veiculos: <Vehicles id={param} />, calculadoras: <Calculators tab={param} />, metas: <Goals />, compras: <Shopping />, mais: <More />,
  };

  return (
    <QuickAddCtx.Provider value={openTx}>
      <div className="min-h-dvh md:flex">
        {/* Desktop */}
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-white/5 bg-slate-950 md:flex">
          <div className="flex items-center gap-3 px-6 py-6">
            <Logo size={36} />
            <span className="text-xl font-extrabold tracking-tight text-white">giro</span>
          </div>
          <div className="px-4 pb-4"><button onClick={() => openTx()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white hover:bg-brand-400"><Plus size={18} /> Novo lançamento</button></div>
          <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
            {[...NAV, { id: 'mais' as Route, label: 'Ajustes', icon: Menu }].map((n) => (
              <a key={n.id} href={`#/${n.id}`} className={cx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition', route === n.id ? 'bg-white/5 font-semibold text-brand-300' : 'text-slate-400 hover:bg-white/5 hover:text-white')}>
                <n.icon size={18} /> {n.label}
              </a>
            ))}
          </nav>
          <p className="px-6 py-4 text-xs text-slate-600">Dados salvos neste aparelho</p>
        </aside>

        <main className="min-w-0 flex-1 px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))] md:px-8 md:pb-10 md:pt-8">
          <div className="mx-auto max-w-6xl">
            {loading ? <div className="py-20 text-center text-sm text-slate-500">Abrindo seus dados…</div> : <Suspense fallback={<div className="py-20 text-center text-sm text-slate-500">Carregando…</div>}>{page[route]}</Suspense>}
          </div>
        </main>

        {/* Mobile */}
        <button onClick={() => openTx()} aria-label="Novo lançamento" className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-xl shadow-brand-500/30 active:scale-95 md:hidden">
          <Plus size={26} strokeWidth={2.5} />
        </button>
        <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-white/5 bg-slate-950/95 backdrop-blur md:hidden">
          <div className="grid grid-cols-4">
            {MOBILE.map((id) => {
              const n = NAV.find((x) => x.id === id) ?? { id, label: 'Mais', icon: Menu };
              const active = route === id || (id === 'mais' && !MOBILE.includes(route));
              return (
                <button key={id} onClick={() => go(id)} className={cx('flex flex-col items-center gap-1 py-2.5 text-[11px]', active ? 'text-brand-300' : 'text-slate-500')}>
                  <n.icon size={22} /> {n.label === 'Lançamentos' ? 'Extrato' : n.label}
                </button>
              );
            })}
          </div>
        </nav>
      </div>
      <TransactionForm open={txOpen} onClose={() => setTxOpen(false)} preset={preset} />
    </QuickAddCtx.Provider>
  );
}

export { NAV };
