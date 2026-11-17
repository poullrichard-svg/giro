import { CheckCircle2, ChevronRight, CreditCard, HardDriveDownload, Car, Repeat, Sparkles } from 'lucide-react';
import { useData } from '../data/DataProvider';
import { PROFILE_ID } from '../lib/work';
import { useQuickAdd } from './Shell';
import { Logo } from './Logo';
import { cx } from './ui';

/** Primeiros passos, mostrados enquanto o app está vazio. */
export function Welcome() {
  const { data } = useData();
  const quickAdd = useQuickAdd();
  const steps = [
    { done: data.transactions.length > 0, icon: Sparkles, title: 'Faça seu primeiro lançamento', text: 'Toque aqui ou escreva como falaria: "gastei 35 no almoço no pix".', action: () => quickAdd() },
    { done: data.accounts.length > 1 || data.cards.length > 0 || data.accounts.some((a) => a.initialBalance !== 0), icon: CreditCard, title: 'Cadastre suas contas e cartões', text: 'Já criamos a "Carteira". Adicione seu banco, o saldo de hoje e seus cartões.', href: '#/contas' },
    { done: data.fixed.length > 0, icon: Repeat, title: 'Anote as contas fixas', text: 'Aluguel, luz, internet, salário — o app avisa antes de vencer.', href: '#/fixas' },
    { done: data.settings.some((s) => s.id === PROFILE_ID), icon: Car, title: 'Trabalha com app ou entregas? (opcional)', text: 'Configure o painel do motorista do seu jeito.', href: '#/motorista' },
    { done: false, icon: HardDriveDownload, title: 'Lembre do backup', text: 'Seus dados ficam no aparelho. Em Ajustes você baixa uma cópia.', href: '#/mais' },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <section className="surface relative overflow-hidden rounded-[2rem] p-6 md:p-8">
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-500/20 blur-3xl" />
      <div className="relative flex items-center gap-4">
        <span className="float"><Logo size={56} /></span>
        <div>
          <p className="label text-brand-300">Bem-vindo ao giro</p>
          <h2 className="font-display text-2xl font-black tracking-tight text-white md:text-3xl">Vamos organizar seu dinheiro</h2>
          <p className="text-sm text-slate-400">{doneCount} de {steps.length} passos feitos · leva uns 3 minutos</p>
        </div>
      </div>
      <ol className="stagger relative mt-6 space-y-2.5">
        {steps.map((s, i) => {
          const body = (
            <>
              <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition', s.done ? 'solid' : 'bg-white/[.05] text-slate-300 ring-1 ring-white/10 group-hover:-rotate-6')} style={s.done ? ({ '--tone': '#10b981' } as React.CSSProperties) : undefined}>
                {s.done ? <CheckCircle2 size={20} /> : <s.icon size={20} />}
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className={cx('block font-display text-[15px] font-black', s.done ? 'text-slate-500 line-through decoration-2' : 'text-white')}>{i + 1}. {s.title}</span>
                <span className="block text-xs text-slate-400">{s.text}</span>
              </span>
              {!s.done && <ChevronRight size={18} className="shrink-0 text-slate-500 transition group-hover:translate-x-1" />}
            </>
          );
          const cls = 'group surface surface-hover flex w-full items-center gap-3 rounded-[1.4rem] p-3';
          return <li key={s.title}>{s.action ? <button type="button" className={cls} onClick={s.action}>{body}</button> : <a className={cls} href={s.href}>{body}</a>}</li>;
        })}
      </ol>
    </section>
  );
}
