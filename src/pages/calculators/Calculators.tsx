import { lazy, Suspense } from 'react';
import { Banknote, Car, Home, LineChart, Shield, Sunset, Users } from 'lucide-react';
import { PageHeader, cx } from '../../components/ui';
import { go } from '../../router';

const TABS = [
  { id: 'financiamento', label: 'Financiamento', icon: Home, C: lazy(() => import('./Financing')) },
  { id: 'consorcio', label: 'Consórcio', icon: Users, C: lazy(() => import('./Consorcio')) },
  { id: 'rendimento', label: 'Rendimento', icon: Banknote, C: lazy(() => import('./FixedIncome')) },
  { id: 'juros', label: 'Juros compostos / metas', icon: LineChart, C: lazy(() => import('./Compound')) },
  { id: 'reserva', label: 'Reserva de emergência', icon: Shield, C: lazy(() => import('./Emergency')) },
  { id: 'renda', label: 'Renda passiva', icon: Sunset, C: lazy(() => import('./PassiveIncome')) },
  { id: 'custo-km', label: 'Custo por km (motorista)', icon: Car, C: lazy(() => import('./DriverCost')) },
] as const;

export default function Calculators({ tab }: { tab?: string }) {
  const current = TABS.find((t) => t.id === tab) ?? TABS[0];
  return (
    <div>
      <PageHeader title="Calculadoras" subtitle="Simule antes de decidir" />
      <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => go('calculadoras', t.id)} className={cx('flex shrink-0 items-center gap-2 press rounded-2xl px-3.5 py-2.5 text-sm transition', current.id === t.id ? 'bg-gradient-to-r from-brand-500 to-fuchsia-500 font-semibold text-white shadow-lg shadow-brand-500/30' : 'glass text-slate-300 hover:bg-white/10')}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>
      <Suspense fallback={<p className="py-10 text-center text-sm text-slate-500">Carregando…</p>}><current.C /></Suspense>
    </div>
  );
}

