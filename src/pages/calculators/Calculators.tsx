import { lazy, Suspense } from 'react';
import {
  ArrowLeft, Banknote, Calculator, Car, CreditCard, Gem, Home, KeyRound, Layers, LineChart, Percent, PiggyBank, Shield, Sunset, Users,
} from 'lucide-react';
import { IconChip, PageHeader, Tilt, type Tone } from '../../components/ui';
import { go } from '../../router';

interface Calc { id: string; label: string; desc: string; icon: typeof Home; tone: Tone; C: ReturnType<typeof lazy> }

const GROUPS: Array<{ title: string; items: Calc[] }> = [
  {
    title: 'Crédito e compras',
    items: [
      { id: 'financiamento', label: 'Financiamento', desc: 'Carro ou casa: Price × SAC, parcelas e juros', icon: Home, tone: 'info', C: lazy(() => import('./Financing')) },
      { id: 'consorcio', label: 'Consórcio', desc: 'Parcela, lance e comparação com financiamento', icon: Users, tone: 'cyan', C: lazy(() => import('./Consorcio')) },
      { id: 'avista-parcelado', label: 'À vista ou parcelado?', desc: 'Descubra os juros escondidos na parcela', icon: CreditCard, tone: 'warn', C: lazy(() => import('./CashVsInstallments')) },
      { id: 'alugar-comprar', label: 'Alugar ou comprar?', desc: 'Qual caminho deixa você mais rico', icon: KeyRound, tone: 'pink', C: lazy(() => import('./RentVsBuy')) },
    ],
  },
  {
    title: 'Investimentos',
    items: [
      { id: 'rendimento', label: 'Renda fixa', desc: 'CDB, LCI/LCA, Tesouro e poupança com IR', icon: Banknote, tone: 'good', C: lazy(() => import('./FixedIncome')) },
      { id: 'juros', label: 'Juros compostos', desc: 'Simule, veja quando chega ou quanto investir', icon: LineChart, tone: 'brand', C: lazy(() => import('./Compound')) },
      { id: 'dividendos', label: 'Viver de dividendos', desc: 'Número mágico e renda com FIIs e ações', icon: PiggyBank, tone: 'good', C: lazy(() => import('./Dividends')) },
      { id: 'preco-teto', label: 'Preço teto e preço justo', desc: 'Métodos Bazin e Graham', icon: Gem, tone: 'info', C: lazy(() => import('./Valuation')) },
      { id: 'preco-medio', label: 'Preço médio', desc: 'Média das suas compras, lucro e prejuízo', icon: Layers, tone: 'cyan', C: lazy(() => import('./AveragePrice')) },
      { id: 'inflacao', label: 'Inflação e taxas', desc: 'Ganho real, conversor e poder de compra', icon: Percent, tone: 'bad', C: lazy(() => import('./RatesInflation')) },
    ],
  },
  {
    title: 'Planejamento',
    items: [
      { id: 'reserva', label: 'Reserva de emergência', desc: 'Quanto guardar e em quanto tempo', icon: Shield, tone: 'warn', C: lazy(() => import('./Emergency')) },
      { id: 'renda', label: 'Independência financeira', desc: 'Patrimônio para viver de renda', icon: Sunset, tone: 'pink', C: lazy(() => import('./PassiveIncome')) },
    ],
  },
  {
    title: 'Motorista',
    items: [
      { id: 'custo-km', label: 'Custo por km', desc: 'Quanto cobrar por km para ter lucro', icon: Car, tone: 'brand', C: lazy(() => import('./DriverCost')) },
    ],
  },
];
const ALL = GROUPS.flatMap((g) => g.items);

export default function Calculators({ tab }: { tab?: string }) {
  const current = ALL.find((t) => t.id === tab);

  if (current) {
    const C = current.C;
    return (
      <div>
        <button onClick={() => go('calculadoras')} className="label press mb-4 flex items-center gap-2 rounded-full bg-white/[.04] px-3.5 py-2 text-slate-400 ring-1 ring-white/10 hover:text-white"><ArrowLeft size={14} /> Todas as calculadoras</button>
        <div className="mb-6 flex items-center gap-4">
          <IconChip tone={current.tone} size="lg"><current.icon size={24} /></IconChip>
          <div>
            <h1 className="font-display text-2xl font-black tracking-tight text-white md:text-3xl">{current.label}</h1>
            <p className="text-sm font-medium text-slate-400">{current.desc}</p>
          </div>
        </div>
        <Suspense fallback={<p className="label py-10 text-center text-slate-500">Carregando…</p>}><C /></Suspense>
      </div>
    );
  }

  return (
    <div>
      <PageHeader eyebrow="Simulações" title="Calculadoras" subtitle={`${ALL.length} ferramentas para decidir com números`} />
      <div className="space-y-8">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h2 className="label mb-3 flex items-center gap-2 text-slate-400"><Calculator size={13} /> {g.title}</h2>
            <div className="stagger grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {g.items.map((c) => (
                <Tilt key={c.id} as="button" type="button" max={8} onClick={() => go('calculadoras', c.id)} className="surface flex flex-col items-start justify-start rounded-[1.75rem] p-4 text-left md:p-5">
                  <span className="pop-sm relative block"><IconChip tone={c.tone}><c.icon size={20} /></IconChip></span>
                  <p className="pop relative mt-4 font-display text-[15px] font-black leading-tight text-white md:text-base">{c.label}</p>
                  <p className="relative mt-1 text-[12px] font-medium leading-snug text-slate-400">{c.desc}</p>
                </Tilt>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
