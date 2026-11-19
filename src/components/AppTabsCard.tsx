import { useEffect, useRef } from 'react';
import { Car, LayoutGrid, Moon, Sun } from 'lucide-react';
import { NAV } from './Shell';
import { Card, Segmented, cx } from './ui';
import { useThemePref } from '../lib/theme';
import { OPTIONAL_TABS } from '../lib/prefs';
import { usePrefs } from '../data/usePrefs';
import { useToast } from '../data/toast';

const HINT: Record<string, string> = {
  contas: 'Bancos, carteira e cartões de crédito', fixas: 'Aluguel, luz, salário…', dividas: 'Acordos e parcelas para quitar',
  veiculos: 'IPVA, manutenção e gastos do carro/moto', calculadoras: 'Juros, financiamento, consórcio…', investimentos: 'Cotações de ações, FIIs e ETFs', metas: 'Objetivos e aportes',
  compras: 'Lista de mercado', assistente: 'Perguntas para a IA (precisa de chave)',
};

/** Interruptor (liga/desliga). */
function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={cx('press relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300', on ? 'bg-brand-500 shadow-[0_0_14px_-2px] shadow-brand-500' : 'bg-white/10 ring-1 ring-inset ring-white/10')}>
      <span className={cx('keep-dark absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all duration-300 ease-[var(--ease-spring)]', on ? 'left-6' : 'left-1')} />
    </button>
  );
}

/** Ajustes → Personalizar: modo motorista e abas do menu. */
export function AppTabsCard({ focus }: { focus?: boolean }) {
  const { driver, visible, setDriver, setTab, homeInvest, setHomeInvest } = usePrefs();
  const toast = useToast();
  const [theme, setTheme] = useThemePref();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (focus) setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300); }, [focus]);
  return (
    <div ref={ref} id="abas" className="scroll-mt-6">
      <Card title={<span className="flex items-center gap-2"><LayoutGrid size={16} className="text-brand-400" /> Personalizar o app</span>}>
        <p className="label mb-2 text-slate-500">Aparência</p>
        <Segmented className="mb-1" value={theme} onChange={setTheme} options={[{ value: 'dark', label: <span className="flex items-center justify-center gap-1.5"><Moon size={13} /> Escuro</span> }, { value: 'light', label: <span className="flex items-center justify-center gap-1.5"><Sun size={13} /> Claro</span> }, { value: 'system', label: 'Automático' }]} />
        <p className="mb-5 text-[11px] text-slate-500">Automático segue o modo claro/escuro do celular. Vale para este aparelho.</p>
        <div className={cx('flex items-center gap-4 rounded-[1.4rem] p-4 ring-1 transition-colors', driver ? 'bg-sky-500/10 ring-sky-500/25' : 'bg-white/[.03] ring-white/[.06]')}>
          <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', driver ? 'solid' : 'bg-white/[.05] text-slate-400')} style={driver ? ({ '--tone': '#0ea5e9' } as React.CSSProperties) : undefined}><Car size={20} /></span>
          <div className="min-w-0 flex-1">
            <p className="font-display font-black text-white">Trabalho com aplicativo ou entregas</p>
            <p className="text-xs text-slate-400">Liga a aba Motorista, o lucro do dia no Início e os veículos.</p>
          </div>
          <Toggle on={driver} label="Modo motorista ou entregador" onChange={(v) => { setDriver(v); toast(v ? 'Modo motorista ligado' : 'Modo motorista desligado'); }} />
        </div>
        <p className="label mb-2 mt-5 text-slate-500">Abas do menu</p>
        <ul className="divide-y divide-white/[.05]">
          {OPTIONAL_TABS.map((id) => {
            const n = NAV.find((x) => x.id === id);
            if (!n) return null;
            const on = visible(id);
            return (
              <li key={id} className="flex items-center gap-3 py-3">
                <n.icon size={18} className={on ? 'text-brand-300' : 'text-slate-600'} />
                <div className="min-w-0 flex-1"><p className={cx('text-sm font-bold', on ? 'text-white' : 'text-slate-500')}>{n.label}</p><p className="truncate text-[11px] text-slate-500">{HINT[id]}</p></div>
                <Toggle on={on} label={`Mostrar ${n.label}`} onChange={(v) => setTab(id, v)} />
              </li>
            );
          })}
        </ul>
        <p className="label mb-2 mt-5 text-slate-500">No Início</p>
        <div className="flex items-center gap-3 py-2">
          <div className="min-w-0 flex-1"><p className={cx('text-sm font-bold', homeInvest ? 'text-white' : 'text-slate-500')}>Meus investimentos hoje</p><p className="text-[11px] text-slate-500">Quanto a carteira variou e quais ativos dela sobem ou caem</p></div>
          <Toggle on={homeInvest} label="Mostrar investimentos no Início" onChange={setHomeInvest} />
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Início, Lançamentos e Ajustes ficam sempre. Esconder uma aba não apaga nada.</p>
      </Card>
    </div>
  );
}
