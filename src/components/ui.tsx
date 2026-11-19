import { cloneElement, isValidElement, useEffect, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type InputHTMLAttributes, type PointerEvent as RPointerEvent, type ReactElement, type ReactNode, type SelectHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { Check as CheckIcon, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { formatBRL } from '../lib/format';

export const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

/** Junta classes base + extras; se o extra define largura/altura/tamanho de texto, a base cede. */
const GROUPS = [/^w-/, /^min-h-/, /^h-/, /^(md:)?text-(xs|sm|base|lg|xl|\d)/, /^py-/, /^rounded/, /^(hidden|block|inline-block|flex|inline-flex|grid)$/];
export const merge = (base: string, extra?: string) => {
  if (!extra) return base;
  const ex = extra.split(/\s+/);
  const kept = base.split(/\s+/).filter((b) => !GROUPS.some((g) => g.test(b) && ex.some((e) => g.test(e))));
  return [...kept, ...ex].join(' ');
};

/** Cores de cada "tom" usado nos cartões. */
export const TONES = { brand: '#16a34a', good: '#10b981', bad: '#f43f5e', warn: '#f59e0b', info: '#3b82f6', pink: '#d946ef', cyan: '#06b6d4' } as const;
export type Tone = keyof typeof TONES;
const toneVar = (t: Tone | string) => ({ '--tone': (TONES as Record<string, string>)[t] ?? t } as CSSProperties);

/** Mesmo ícone, maior — para a "marca d'água" dos cartões. */
const big = (icon: ReactNode, size = 96) => (isValidElement(icon) ? cloneElement(icon as ReactElement<any>, { size, strokeWidth: 1.6, className: '' }) : icon);

const canHover = () => typeof window !== 'undefined' && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Inclina o elemento em 3D seguindo o mouse, com reflexo de luz. No celular fica parado. */
export function Tilt({ children, className, style, max = 7, as: Tag = 'div', ...rest }: { children: ReactNode; className?: string; style?: CSSProperties; max?: number; as?: 'div' | 'section' | 'button' | 'a'; onClick?: () => void; href?: string; type?: 'button' }) {
  const ref = useRef<HTMLElement>(null);
  const frame = useRef(0);
  const move = (e: RPointerEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el || !canHover()) return;
    const { clientX, clientY } = e;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      const x = (clientX - r.left) / r.width; const y = (clientY - r.top) / r.height;
      el.style.setProperty('--ry', `${(x - 0.5) * max * 2}deg`);
      el.style.setProperty('--rx', `${(0.5 - y) * max * 2}deg`);
      el.style.setProperty('--mx', `${x * 100}%`);
      el.style.setProperty('--my', `${y * 100}%`);
    });
  };
  const leave = () => { cancelAnimationFrame(frame.current); ref.current?.style.setProperty('--rx', '0deg'); ref.current?.style.setProperty('--ry', '0deg'); };
  const T = Tag as any;
  return (
    <T ref={ref} onPointerMove={move} onPointerLeave={leave} className={cx('tilt group', className)} style={style} {...rest}>
      {children}
      <span className="glare" aria-hidden="true" />
    </T>
  );
}

/** Número que "conta" até o valor final. */
export function useCountUp(value: number, duration = 1000) {
  const [shown, setShown] = useState(value);
  const from = useRef(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setShown(value); return; }
    const start = performance.now(); const a = from.current; let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / duration); const e = 1 - Math.pow(1 - k, 4);
      setShown(a + (value - a) * e);
      if (k < 1) raf = requestAnimationFrame(tick); else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); from.current = value; };
  }, [value, duration]);
  return shown;
}

export function Money({ value, className }: { value: number; className?: string }) {
  const v = useCountUp(value);
  return <span className={cx('tabular-nums', className)}>{formatBRL(Math.round(v * 100) / 100)}</span>;
}

export type ChipTone = Tone;
/** Ícone dentro de uma "pastilha" colorida. */
export function IconChip({ children, tone = 'brand', size = 'md', solid = true }: { children: ReactNode; tone?: Tone | string; size?: 'sm' | 'md' | 'lg'; solid?: boolean }) {
  const s = { sm: 'h-8 w-8 rounded-[10px]', md: 'h-11 w-11 rounded-2xl', lg: 'h-14 w-14 rounded-[1.25rem]' }[size];
  return (
    <span style={toneVar(tone)} className={cx('inline-flex shrink-0 items-center justify-center transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6', s,
      solid ? 'solid' : 'bg-[color-mix(in_srgb,var(--tone)_14%,transparent)] text-[var(--tone)] ring-1 ring-[color-mix(in_srgb,var(--tone)_25%,transparent)]')}>
      {children}
    </span>
  );
}

export function Card({ children, className, title, action, hover }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; hover?: boolean }) {
  return (
    <section className={cx('surface min-w-0 rounded-[1.75rem] p-5 md:rounded-[2rem] md:p-6', hover && 'surface-hover', className)}>
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-2">
          {title && <h3 className="label flex items-center gap-2 text-slate-400">{title}</h3>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

type BtnVariant = 'primary' | 'ghost' | 'danger' | 'soft';
export function Button({ variant = 'primary', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  const v = {
    primary: 'btn-shine bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 text-white shadow-[0_10px_30px_-10px] shadow-brand-500/70 hover:shadow-brand-500 hover:brightness-110',
    soft: 'bg-white/[.05] text-slate-100 ring-1 ring-inset ring-white/10 hover:bg-white/10',
    ghost: 'text-slate-400 hover:bg-white/5 hover:text-white',
    danger: 'bg-rose-500/10 text-rose-400 ring-1 ring-inset ring-rose-500/20 hover:bg-rose-500/20',
  }[variant];
  return <button {...p} className={cx('press inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 text-[12px] font-extrabold uppercase tracking-[.08em] disabled:opacity-50', v, className)} />;
}

export function IconButton({ label, className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  // merge: um `hidden` vindo de fora vence o `inline-flex` padrão (senão o botão aparece no celular).
  return <button aria-label={label} title={label} {...p} className={merge('press inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[.04] text-slate-400 ring-1 ring-inset ring-white/5 hover:bg-white/10 hover:text-white', className)} />;
}

/**
 * Campo com rótulo. Use `group` quando o conteúdo for só botões (opções, chips):
 * assim tocar no título não "clica" no primeiro botão.
 */
export function Field({ label, children, hint, className, group, error }: { label: string; children: ReactNode; hint?: ReactNode; className?: string; group?: boolean; error?: string | null }) {
  const inner = (
    <>
      <span className={cx('label block', error ? 'text-rose-400' : 'text-slate-500')}>{label}</span>
      {children}
      {error ? <span role="alert" className="pop-in block text-[12px] font-semibold text-rose-400">{error}</span> : hint && <span className="block text-[11px] text-slate-500">{hint}</span>}
    </>
  );
  const cls = cx('block space-y-2', error && '[&_input]:!border-rose-500/70 [&_select]:!border-rose-500/70 [&_input]:!ring-4 [&_input]:!ring-rose-500/10', className);
  return group
    ? <div role="group" aria-label={label} className={cls}>{inner}</div>
    : <label className={cls}>{inner}</label>;
}

const inputCls = 'w-full min-h-12 rounded-2xl border border-white/[.07] bg-[#08070f] px-4 text-base md:text-sm font-semibold text-white outline-none transition duration-300 placeholder:font-medium placeholder:text-slate-600 hover:border-white/15 focus:border-brand-400/70 focus:ring-4 focus:ring-brand-500/15';

export function Input(p: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={merge(inputCls, p.className)} />;
}

export function Select({ options, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { options: Array<string | { value: string; label: string }> }) {
  return (
    <div className="relative">
      <select {...p} className={merge(`${inputCls} appearance-none pr-10`, p.className)}>
        {options.map((o) => (typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
      </select>
      <ChevronRight size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 rotate-90 text-slate-500" />
    </div>
  );
}

/** Campo de valor em reais: digita só números e preenche da direita (como app de banco). */
export function MoneyInput({ value, onChange, autoFocus, className, placeholder }: { value: number; onChange: (v: number) => void; autoFocus?: boolean; className?: string; placeholder?: string }) {
  return (
    <input
      inputMode="numeric"
      autoFocus={autoFocus}
      placeholder={placeholder ?? 'R$ 0,00'}
      className={merge(inputCls, className)}
      value={value ? formatBRL(value) : ''}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, 13);
        onChange(digits ? parseInt(digits, 10) / 100 : 0);
      }}
    />
  );
}

/** Número decimal livre (km, litros, %, taxa). Mantém o texto enquanto digita. */
export function NumberInput({ value, onChange, suffix, step, className, placeholder }: { value: number; onChange: (v: number) => void; suffix?: string; step?: string; className?: string; placeholder?: string }) {
  const [text, setText] = useState(value ? String(value).replace('.', ',') : '');
  useEffect(() => {
    const parsed = parseFloat(text.replace(',', '.')) || 0;
    if (parsed !== value) setText(value ? String(value).replace('.', ',') : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="relative">
      <input
        inputMode="decimal"
        step={step}
        placeholder={placeholder ?? '0'}
        className={merge(cx(inputCls, suffix && 'pr-12'), className)}
        value={text}
        onChange={(e) => {
          const t = e.target.value.replace(/[^\d,.-]/g, '');
          setText(t);
          onChange(parseFloat(t.replace(/\./g, '').replace(',', '.')) || (t.includes('.') && !t.includes(',') ? parseFloat(t) || 0 : 0));
        }}
      />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">{suffix}</span>}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: ReactNode }>; className?: string }) {
  const i = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div className={cx('relative grid auto-cols-fr grid-flow-col rounded-2xl bg-[#08070f] p-1 ring-1 ring-inset ring-white/[.07]', className)}>
      <span aria-hidden="true" className="absolute bottom-1 left-1 top-1 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-[0_6px_20px_-6px] shadow-brand-500 transition-transform duration-500 ease-[var(--ease-spring)]"
        style={{ width: `calc((100% - .5rem) / ${options.length})`, transform: `translateX(${i * 100}%)` }} />
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} className={cx('relative z-10 min-w-0 whitespace-nowrap rounded-xl px-3 py-2.5 text-[11px] font-extrabold uppercase tracking-[.1em] transition-colors duration-300', value === o.value ? 'text-white' : 'text-slate-500 hover:text-slate-200')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  // Portal: abre sempre por cima da tela, sem depender de onde o formulário foi declarado.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-clip overscroll-contain bg-black/70 backdrop-blur-sm animate-fade md:items-center md:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="surface animate-sheet flex max-h-[92dvh] w-full flex-col overflow-clip rounded-t-[2.25rem] md:max-w-lg md:rounded-[2.25rem]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(80%_100%_at_50%_0%,rgba(34,197,94,.18),transparent)]" />
        <div aria-hidden="true" className="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-white/15 md:hidden" />
        <header className="relative flex items-center justify-between px-6 pb-3 pt-5">
          <h2 className="font-display text-xl font-black tracking-tight text-white">{title}</h2>
          <IconButton label="Fechar" onClick={onClose} className="rounded-full"><X size={18} /></IconButton>
        </header>
        <div className="relative flex-1 overflow-y-auto overscroll-contain px-6 pb-5">{children}</div>
        {footer && <footer className="relative border-t border-white/[.06] px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

type StatTone = 'default' | 'good' | 'bad' | 'warn' | Tone;
const STAT_TONE: Record<string, Tone> = { default: 'brand', good: 'good', bad: 'bad', warn: 'warn' };
const TONE_TEXT: Record<Tone, string> = { brand: 'text-brand-300', good: 'text-emerald-400', bad: 'text-rose-400', warn: 'text-amber-400', info: 'text-sky-400', pink: 'text-fuchsia-400', cyan: 'text-cyan-400' };

/** Cartão de número colorido por tipo, com ícone grande ao fundo. Passe `money` para animar. */
export function Stat({ label, value, money, tone = 'default', sub, icon }: { label: string; value?: ReactNode; money?: number; tone?: StatTone; sub?: ReactNode; icon?: ReactNode }) {
  const t = STAT_TONE[tone] ?? (tone as Tone);
  return (
    <Tilt className="tinted rounded-[1.75rem] p-4 sm:p-5" style={toneVar(t)}>
      {icon && <span className={cx('watermark', TONE_TEXT[t])}>{big(icon)}</span>}
      <p className={cx('label pop-sm relative', TONE_TEXT[t])}>{label}</p>
      <div className="pop relative mt-2 truncate font-display text-[1.3rem] font-black tracking-tight text-white sm:text-2xl md:text-[1.75rem]">{money !== undefined ? <Money value={money} /> : value}</div>
      {sub && <div className="pop-sm relative mt-1.5 text-[11px] font-medium text-slate-400">{sub}</div>}
    </Tilt>
  );
}

/** Bloco grande e vibrante para os números mais importantes. */
export function BigTile({ label, money, value, tone, icon, sub }: { label: string; money?: number; value?: ReactNode; tone: Tone; icon?: ReactNode; sub?: ReactNode }) {
  return (
    <Tilt max={9} className="solid shine rounded-[2rem] px-5 py-7 text-center" style={toneVar(tone)}>
      {icon && <span className="watermark !opacity-20 text-white">{big(icon, 110)}</span>}
      <p className="label pop-sm relative text-white/75">{label}</p>
      <div className="pop relative mt-2 font-display text-[2rem] font-black leading-none tracking-tight drop-shadow-[0_4px_12px_rgba(0,0,0,.25)] md:text-[2.4rem]">{money !== undefined ? <Money value={money} /> : value}</div>
      {sub && <p className="pop-sm relative mt-2 text-xs font-semibold text-white/80">{sub}</p>}
    </Tilt>
  );
}

/** Mini cartão centralizado (rótulo + número). */
export function MiniStat({ label, value, money, sub, tone }: { label: string; value?: ReactNode; money?: number; sub?: ReactNode; tone?: Tone }) {
  return (
    <div className="surface surface-hover rounded-[1.5rem] px-3 py-4 text-center">
      <p className={cx('label', tone ? TONE_TEXT[tone] : 'text-slate-500')}>{label}</p>
      <div className="mt-1.5 truncate font-display text-lg font-black text-white md:text-xl">{money !== undefined ? <Money value={money} /> : value}</div>
      {sub && <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-500">{sub}</p>}
    </div>
  );
}

/** Item de lista em formato de cartão. */
export function Row({ icon, tone = 'brand', title, subtitle, amount, amountTone, actions, onClick, muted, leading, amountClassName }: {
  icon?: ReactNode; tone?: Tone | string; title: ReactNode; subtitle?: ReactNode; amount?: ReactNode; amountTone?: 'good' | 'bad' | 'muted'; amountClassName?: string;
  actions?: ReactNode; onClick?: () => void; muted?: boolean; leading?: ReactNode;
}) {
  return (
    <li className={cx('group surface surface-hover flex min-w-0 items-center gap-3 rounded-[1.4rem] p-3 pr-3.5 md:gap-4 md:p-3.5', muted && 'opacity-45')}>
      {leading}
      {icon && <IconChip tone={tone} solid={false}>{icon}</IconChip>}
      <button type="button" disabled={!onClick} onClick={onClick} className="min-w-0 flex-1 text-left disabled:cursor-default">
        <p className={cx('truncate font-display text-[15px] font-extrabold text-white', muted && 'line-through decoration-2')}>{title}</p>
        {subtitle && <p className="label mt-1 truncate !tracking-[.12em] text-slate-500">{subtitle}</p>}
      </button>
      {amount !== undefined && <span className={cx('whitespace-nowrap font-mono text-sm font-extrabold', amountTone === 'good' ? 'text-emerald-400' : amountTone === 'bad' ? 'text-rose-400' : 'text-slate-200', amountClassName)}>{amount}</span>}
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </li>
  );
}

/** Cartão tracejado para "adicionar novo". */
export function AddCard({ label, onClick, className }: { label: string; onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={cx('press group flex min-h-40 flex-col items-center justify-center gap-3 rounded-[2rem] border-2 border-dashed border-white/10 text-slate-500 transition hover:border-brand-400/50 hover:bg-brand-500/[.04] hover:text-brand-300', className)}>
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[.04] ring-1 ring-white/10 transition duration-500 group-hover:rotate-90 group-hover:bg-brand-500/20"><Plus size={22} /></span>
      <span className="label">{label}</span>
    </button>
  );
}

/** Caixa de seleção animada. */
export function Check({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} onClick={onChange}
      className={cx('press flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ring-1 ring-inset transition-colors duration-300', checked ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 ring-emerald-300/40 shadow-[0_6px_16px_-6px] shadow-emerald-500' : 'bg-[#08070f] ring-white/15 hover:ring-white/30')}>
      {checked && <CheckIcon size={17} strokeWidth={3.5} className="pop-in text-white" />}
    </button>
  );
}

export function PeriodNav({ label, onPrev, onNext, onToday }: { label: string; onPrev: () => void; onNext: () => void; onToday?: () => void }) {
  return (
    <div className="surface flex items-center gap-1 rounded-2xl p-1">
      <IconButton label="Anterior" onClick={onPrev} className="h-9 w-9 bg-transparent ring-0"><ChevronLeft size={17} /></IconButton>
      <button type="button" key={label} onClick={onToday} className="label animate-fade min-w-40 flex-1 text-center !text-[11px] text-white" title="Voltar para hoje">{label}</button>
      <IconButton label="Próximo" onClick={onNext} className="h-9 w-9 bg-transparent ring-0"><ChevronRight size={17} /></IconButton>
    </div>
  );
}

export function Progress({ value, tone = 'good' }: { value: number; tone?: 'good' | 'warn' | 'bad' | 'brand' }) {
  const c = { good: 'from-emerald-400 to-emerald-500 shadow-emerald-400/60', warn: 'from-amber-300 to-orange-500 shadow-amber-400/60', bad: 'from-rose-400 to-rose-600 shadow-rose-500/60', brand: 'from-brand-400 to-teal-400 shadow-brand-400/60' }[tone];
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-white/[.05] p-0.5 ring-1 ring-inset ring-white/5">
      <div className={cx('fill-x relative h-full overflow-hidden rounded-full bg-gradient-to-r shadow-[0_0_14px]', c)} style={{ width: `${pct}%` }}>
        <span className="progress-shimmer absolute inset-0" />
      </div>
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      {icon && (
        <div className="relative mb-3">
          <div aria-hidden="true" className="absolute inset-0 scale-[1.8] rounded-full bg-brand-500/25 blur-2xl" />
          <div className="float solid relative flex h-16 w-16 items-center justify-center rounded-[1.4rem]" style={toneVar('brand')}>{icon}</div>
        </div>
      )}
      <p className="font-display text-lg font-black text-white">{title}</p>
      {text && <p className="max-w-xs text-xs leading-relaxed text-slate-400">{text}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: string; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && <p className="label mb-1.5 text-brand-300">{eyebrow}</p>}
        <h1 className="font-display text-3xl font-black tracking-tight text-white md:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm font-medium text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 max-md:[&>*]:min-w-full">{actions}</div>}
    </div>
  );
}

/** Pede confirmação com um segundo toque — sem pop-up. */
export function ConfirmDelete({ onConfirm, label = 'Excluir' }: { onConfirm: () => void; label?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 3000); return () => clearTimeout(t); }, [armed]);
  return armed ? (
    <button type="button" onClick={onConfirm} className="press pop-in h-10 rounded-xl bg-rose-500 px-3 text-[11px] font-extrabold uppercase tracking-wider text-white shadow-[0_6px_18px_-6px] shadow-rose-500">Confirmar</button>
  ) : (
    <IconButton label={label} onClick={() => setArmed(true)} className="bg-rose-500/[.08] text-rose-400 ring-rose-500/15 hover:bg-rose-500/20 hover:text-rose-300">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
    </IconButton>
  );
}
