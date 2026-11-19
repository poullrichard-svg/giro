import { createContext, lazy, Suspense, useContext, useState, type ReactNode } from 'react';
import {
  Calculator, Car, CarFront, Flag, Landmark, LayoutDashboard, Menu, Plus, Repeat, ShoppingCart, Sparkles, Wallet,
} from 'lucide-react';
import { go, useRoute, type Route } from '../router';
import { useData } from '../data/DataProvider';
import { Logo } from './Logo';
import TransactionForm, { type TxPreset } from './TransactionForm';
import { cx } from './ui';
import { SyncBox, SyncDot } from '../cloud/SyncBadge';

const Dashboard = lazy(() => import('../pages/Dashboard'));
const Transactions = lazy(() => import('../pages/Transactions'));
const Accounts = lazy(() => import('../pages/Accounts'));
const FixedBills = lazy(() => import('../pages/FixedBills'));
const Driver = lazy(() => import('../pages/Driver'));
const Vehicles = lazy(() => import('../pages/Vehicles'));
const Calculators = lazy(() => import('../pages/calculators/Calculators'));
const Goals = lazy(() => import('../pages/Goals'));
const Shopping = lazy(() => import('../pages/Shopping'));
const More = lazy(() => import('../pages/More'));
const Assistant = lazy(() => import('../pages/Assistant'));

const NAV: Array<{ id: Route; label: string; icon: typeof Wallet }> = [
  { id: 'inicio', label: 'Início', icon: LayoutDashboard },
  { id: 'lancamentos', label: 'Lançamentos', icon: Wallet },
  { id: 'contas', label: 'Contas e cartões', icon: Landmark },
  { id: 'fixas', label: 'Contas fixas', icon: Repeat },
  { id: 'motorista', label: 'Motorista', icon: Car },
  { id: 'veiculos', label: 'Veículos', icon: CarFront },
  { id: 'calculadoras', label: 'Calculadoras', icon: Calculator },
  { id: 'metas', label: 'Metas', icon: Flag },
  { id: 'compras', label: 'Lista de compras', icon: ShoppingCart },
  { id: 'assistente', label: 'Assistente IA', icon: Sparkles },
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
    inicio: <Dashboard />, lancamentos: <Transactions />, contas: <Accounts id={param} />, fixas: <FixedBills />, motorista: <Driver />,
    veiculos: <Vehicles id={param} />, calculadoras: <Calculators tab={param} />, metas: <Goals id={param} />, compras: <Shopping />, assistente: <Assistant />, mais: <More section={param} />,
  };

  const loader = <div className="flex flex-col items-center gap-3 py-24 text-slate-400"><Logo size={48} spin /><span className="label">Abrindo seus dados</span></div>;
  const current = [...NAV, { id: 'mais' as Route, label: 'Ajustes', icon: Menu }].find((n) => n.id === route);

  return (
    <QuickAddCtx.Provider value={openTx}>
      <div className="backdrop" aria-hidden="true" />
      <div className="min-h-dvh md:flex">
        {/* Computador: barra lateral */}
        <aside className="sticky top-0 hidden h-dvh w-[17rem] shrink-0 flex-col border-r border-white/[.05] bg-[#07060e]/80 md:flex">
          <a href="#/inicio" className="group flex items-center gap-3 px-6 pb-8 pt-7">
            <span className="transition-transform duration-700 ease-[var(--ease-spring)] group-hover:rotate-[360deg]"><Logo size={42} /></span>
            <div>
              <span className="block font-display text-2xl font-black leading-none tracking-tight text-white">giro</span>
              <span className="label mt-1 block !text-[9px] text-brand-300/80">finanças em movimento</span>
            </div>
          </a>
          <nav className="stagger-x flex-1 space-y-1.5 overflow-y-auto px-4">
            {[...NAV, { id: 'mais' as Route, label: 'Ajustes', icon: Menu }].map((n) => {
              const active = route === n.id;
              return (
                <a key={n.id} href={`#/${n.id}`} className={cx('group relative flex items-center gap-3.5 rounded-2xl px-3 py-2.5 text-[14px] font-bold transition-all duration-300', active ? 'bg-gradient-to-r from-brand-500/20 to-transparent text-white' : 'text-slate-500 hover:translate-x-1 hover:bg-white/[.03] hover:text-slate-200')}>
                  {active && <span aria-hidden="true" className="absolute -left-4 top-1/2 h-7 w-1.5 -translate-y-1/2 rounded-r-full bg-brand-400 shadow-[0_0_14px] shadow-brand-400" />}
                  <span className={cx('flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-500', active ? 'solid scale-105' : 'bg-white/[.03] ring-1 ring-white/5 group-hover:scale-110 group-hover:-rotate-6')} style={active ? ({ '--tone': '#16a34a' } as React.CSSProperties) : undefined}>
                    <n.icon size={17} strokeWidth={2.2} />
                  </span>
                  {n.label}
                </a>
              );
            })}
          </nav>
          <SyncBox />
        </aside>

        <div className="min-w-0 flex-1">
          {/* Computador: barra superior */}
          <header className="sticky top-0 z-20 hidden items-center justify-between border-b border-white/[.05] bg-[#05040b]/75 px-8 py-4 backdrop-blur-md md:flex">
            <p className="label flex items-center gap-2 text-slate-500">{current && <current.icon size={14} />} {current?.label ?? 'Início'}</p>
            <button onClick={() => openTx()} className="press btn-shine pulse-ring flex items-center gap-2 rounded-2xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 px-5 py-3 text-[12px] font-extrabold uppercase tracking-[.08em] text-white shadow-[0_10px_30px_-10px] shadow-brand-500">
              <Plus size={17} strokeWidth={3} /> Novo lançamento
            </button>
          </header>

          <main className="px-4 pb-36 pt-[max(1rem,env(safe-area-inset-top))] md:px-8 md:pb-12 md:pt-8">
            {/* Celular: topo */}
            <div className="mb-5 flex items-center gap-2.5 md:hidden"><Logo size={34} /><span className="font-display text-2xl font-black tracking-tight text-white">giro</span><SyncDot /></div>
            <div className="mx-auto max-w-6xl">
              {loading ? loader : (
                <Suspense fallback={loader}>
                  <div key={`${route}/${param ?? ''}`} className="animate-page">{page[route]}</div>
                </Suspense>
              )}
            </div>
          </main>
        </div>

        {/* Celular: barra flutuante com o + no centro */}
        <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-[var(--color-ink)] via-[var(--color-ink)]/90 to-transparent px-3 pb-3 pt-8 md:hidden">
          <div className="surface relative grid grid-cols-5 items-center rounded-[2rem] px-1.5 py-2 shadow-[0_20px_50px_-10px_rgba(0,0,0,.9)]">
            {(['inicio', 'lancamentos', 'novo', 'motorista', 'mais'] as const).map((id) => {
              if (id === 'novo') {
                return (
                  <div key={id} className="flex justify-center">
                    <button onClick={() => openTx()} aria-label="Novo lançamento" className="press pulse-ring -mt-10 flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-gradient-to-br from-brand-500 via-brand-600 to-emerald-700 text-white shadow-[0_14px_30px_-8px] shadow-brand-500 ring-[5px] ring-[var(--color-ink)]">
                      <Plus size={30} strokeWidth={3} />
                    </button>
                  </div>
                );
              }
              const n = NAV.find((x) => x.id === id) ?? { id, label: 'Mais', icon: Menu };
              const active = route === id || (id === 'mais' && !MOBILE.includes(route));
              return (
                <button key={id} onClick={() => go(id)} className={cx('press flex flex-col items-center gap-1 py-1', active ? 'text-white' : 'text-slate-500')}>
                  <span className={cx('flex h-9 w-12 items-center justify-center rounded-2xl transition-all duration-500 ease-[var(--ease-spring)]', active ? 'solid scale-110' : '')} style={active ? ({ '--tone': '#16a34a' } as React.CSSProperties) : undefined}>
                    <n.icon size={19} strokeWidth={2.3} />
                  </span>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">{n.label === 'Lançamentos' ? 'Extrato' : n.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
      <TransactionForm open={txOpen} onClose={() => setTxOpen(false)} preset={preset} onDuplicate={(t) => openTx({ duplicate: t })} />
    </QuickAddCtx.Provider>
  );
}

export { NAV };
