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

  const loader = <div className="flex flex-col items-center gap-3 py-24 text-sm text-slate-400"><Logo size={44} spin /> Abrindo seus dados…</div>;

  return (
    <QuickAddCtx.Provider value={openTx}>
      <div className="aurora" aria-hidden="true"><i /><i /><i /></div>
      <div className="min-h-dvh md:flex">
        {/* Desktop */}
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 p-3 md:block">
          <div className="glass flex h-full flex-col rounded-[1.75rem]">
            <div className="flex items-center gap-3 px-5 py-6">
              <Logo size={38} />
              <div>
                <span className="block text-xl font-extrabold leading-none tracking-tight text-white">giro</span>
                <span className="text-[11px] text-slate-400">finanças em movimento</span>
              </div>
            </div>
            <div className="px-3 pb-4">
              <button onClick={() => openTx()} className="press pulse-ring flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-500 to-fuchsia-500 py-3 text-sm font-bold text-white shadow-lg shadow-brand-500/40 hover:brightness-110">
                <Plus size={18} strokeWidth={2.75} /> Novo lançamento
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto px-3">
              {[...NAV, { id: 'mais' as Route, label: 'Ajustes', icon: Menu }].map((n) => {
                const active = route === n.id;
                return (
                  <a key={n.id} href={`#/${n.id}`} className={cx('group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-all duration-200', active ? 'bg-white/[.08] font-semibold text-white shadow-inner' : 'text-slate-400 hover:translate-x-1 hover:bg-white/[.04] hover:text-white')}>
                    {active && <span aria-hidden="true" className="absolute -left-3 top-1/2 h-6 w-1.5 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-brand-400 to-fuchsia-400 shadow-[0_0_12px] shadow-brand-400" />}
                    <span className={cx('flex h-8 w-8 items-center justify-center rounded-xl transition', active ? 'bg-gradient-to-br from-brand-500 to-fuchsia-500 text-white shadow-md shadow-brand-500/40' : 'bg-white/[.04] group-hover:bg-white/10')}>
                      <n.icon size={16} />
                    </span>
                    {n.label}
                  </a>
                );
              })}
            </nav>
            <p className="flex items-center gap-2 px-5 py-4 text-[11px] text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400" /> Dados salvos neste aparelho</p>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 pb-32 pt-[max(1rem,env(safe-area-inset-top))] md:px-8 md:pb-10 md:pt-7">
          {/* Topo do celular */}
          <div className="mb-4 flex items-center gap-2.5 md:hidden"><Logo size={30} /><span className="text-lg font-extrabold tracking-tight text-white">giro</span></div>
          <div className="mx-auto max-w-7xl">
            {loading ? loader : (
              <Suspense fallback={loader}>
                <div key={`${route}/${param ?? ''}`} className="animate-page">{page[route]}</div>
              </Suspense>
            )}
          </div>
        </main>

        {/* Celular: barra flutuante com o + no centro */}
        <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-[var(--color-ink)] via-[var(--color-ink)]/80 to-transparent px-3 pb-3 pt-6 md:hidden">
          <div className="glass-strong relative grid grid-cols-5 items-center rounded-[1.75rem] !bg-[#120f1f]/95 px-1 py-1.5 shadow-2xl shadow-black/80">
            {(['inicio', 'lancamentos', 'novo', 'motorista', 'mais'] as const).map((id) => {
              if (id === 'novo') {
                return (
                  <div key={id} className="flex justify-center">
                    <button onClick={() => openTx()} aria-label="Novo lançamento" className="press pulse-ring -mt-8 flex h-15 w-15 items-center justify-center rounded-[1.4rem] bg-gradient-to-br from-brand-500 to-fuchsia-500 text-white shadow-xl shadow-brand-500/50 ring-4 ring-[var(--color-ink)]">
                      <Plus size={28} strokeWidth={2.75} />
                    </button>
                  </div>
                );
              }
              const n = NAV.find((x) => x.id === id) ?? { id, label: 'Mais', icon: Menu };
              const active = route === id || (id === 'mais' && !MOBILE.includes(route));
              return (
                <button key={id} onClick={() => go(id)} className={cx('press flex flex-col items-center gap-1 rounded-2xl py-1.5 text-[11px] font-medium transition-colors', active ? 'text-white' : 'text-slate-500')}>
                  <span className={cx('flex h-8 w-12 items-center justify-center rounded-full transition-all duration-300', active && 'bg-gradient-to-r from-brand-500/40 to-fuchsia-500/30 shadow-[0_0_16px] shadow-brand-500/40')}>
                    <n.icon size={20} />
                  </span>
                  {n.label === 'Lançamentos' ? 'Extrato' : n.label}
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
