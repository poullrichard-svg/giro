import { useEffect, useRef, useState, type ButtonHTMLAttributes, type PointerEvent as RPointerEvent, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { formatBRL } from '../lib/format';

export const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

/** Junta classes base + extras; se o extra define largura/altura/tamanho de texto, a base cede. */
const GROUPS = [/^w-/, /^min-h-/, /^h-/, /^text-(xs|sm|base|lg|xl|\d)/, /^py-/];
export const merge = (base: string, extra?: string) => {
  if (!extra) return base;
  const ex = extra.split(/\s+/);
  const kept = base.split(/\s+/).filter((b) => !GROUPS.some((g) => g.test(b) && ex.some((e) => g.test(e))));
  return [...kept, ...ex].join(' ');
};

const canHover = () => typeof window !== 'undefined' && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Inclina o elemento em 3D seguindo o mouse, com um reflexo de luz. No celular fica parado. */
export function Tilt({ children, className, max = 8, as: Tag = 'div', ...rest }: { children: ReactNode; className?: string; max?: number; as?: 'div' | 'section' | 'button' | 'a'; onClick?: () => void; href?: string }) {
  const ref = useRef<HTMLElement>(null);
  const move = (e: RPointerEvent<HTMLElement>) => {
    if (!ref.current || !canHover()) return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width; const y = (e.clientY - r.top) / r.height;
    ref.current.style.setProperty('--ry', `${(x - 0.5) * max * 2}deg`);
    ref.current.style.setProperty('--rx', `${(0.5 - y) * max * 2}deg`);
    ref.current.style.setProperty('--mx', `${x * 100}%`);
    ref.current.style.setProperty('--my', `${y * 100}%`);
  };
  const leave = () => { ref.current?.style.setProperty('--rx', '0deg'); ref.current?.style.setProperty('--ry', '0deg'); };
  const T = Tag as any;
  return (
    <T ref={ref} onPointerMove={move} onPointerLeave={leave} className={cx('tilt', className)} {...rest}>
      {children}
      <span className="glare" aria-hidden="true" />
    </T>
  );
}

/** Número que "conta" até o valor final. */
export function useCountUp(value: number, duration = 900) {
  const [shown, setShown] = useState(value);
  const from = useRef(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setShown(value); return; }
    const start = performance.now(); const a = from.current; let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / duration); const e = 1 - Math.pow(1 - k, 3);
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

const CHIP = {
  brand: 'from-brand-500 to-fuchsia-500 shadow-brand-500/40',
  good: 'from-emerald-400 to-teal-500 shadow-emerald-500/40',
  bad: 'from-rose-500 to-orange-500 shadow-rose-500/40',
  warn: 'from-amber-400 to-orange-500 shadow-amber-500/40',
  info: 'from-sky-400 to-indigo-500 shadow-sky-500/40',
} as const;
export type ChipTone = keyof typeof CHIP;

/** Ícone dentro de uma "pastilha" com gradiente. */
export function IconChip({ children, tone = 'brand', size = 'md' }: { children: ReactNode; tone?: ChipTone; size?: 'sm' | 'md' | 'lg' }) {
  const s = { sm: 'h-8 w-8 rounded-lg', md: 'h-10 w-10 rounded-xl', lg: 'h-14 w-14 rounded-2xl' }[size];
  return <span className={cx('inline-flex shrink-0 items-center justify-center bg-gradient-to-br text-white shadow-lg', s, CHIP[tone])}>{children}</span>;
}

export function Card({ children, className, title, action }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={cx('glass rounded-3xl p-4 md:p-5', className)}>
      {(title || action) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          {title && <h3 className="text-sm font-bold tracking-tight text-white">{title}</h3>}
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
    primary: 'bg-gradient-to-r from-brand-500 to-fuchsia-500 text-white shadow-lg shadow-brand-500/30 hover:brightness-110 hover:shadow-brand-500/50',
    soft: 'bg-white/[.06] text-slate-100 ring-1 ring-white/10 hover:bg-white/10',
    ghost: 'text-slate-400 hover:text-white hover:bg-white/5',
    danger: 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20',
  }[variant];
  return <button {...p} className={cx('inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold transition duration-200 active:scale-[.97] disabled:opacity-50', v, className)} />;
}

export function IconButton({ label, className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button aria-label={label} title={label} {...p} className={cx('inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/5 hover:text-white', className)} />;
}

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <label className={cx('block space-y-1.5', className)}>
      <span className="text-xs font-medium text-slate-400">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}

const inputCls = 'w-full min-h-11 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-brand-400/70 focus:bg-black/40 focus:ring-4 focus:ring-brand-500/15';

export function Input(p: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={merge(inputCls, p.className)} />;
}

export function Select({ options, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { options: Array<string | { value: string; label: string }> }) {
  return (
    <select {...p} className={merge(`${inputCls} appearance-none`, p.className)}>
      {options.map((o) => (typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
    </select>
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
    <div className={cx('relative grid auto-cols-fr grid-flow-col rounded-2xl bg-black/30 p-1 ring-1 ring-white/10', className)}>
      <span aria-hidden="true" className="absolute bottom-1 left-1 top-1 rounded-xl bg-gradient-to-r from-brand-500/90 to-fuchsia-500/80 shadow-lg shadow-brand-500/30 transition-transform duration-300 ease-out"
        style={{ width: `calc((100% - .5rem) / ${options.length})`, transform: `translateX(${i * 100}%)` }} />
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} className={cx('relative z-10 min-w-0 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition-colors duration-300', value === o.value ? 'text-white' : 'text-slate-400 hover:text-slate-200')}>
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
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-md animate-fade md:items-center md:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="glass-strong animate-sheet flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[2rem] shadow-2xl shadow-black/60 md:max-w-lg md:rounded-[2rem]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-brand-500/20 to-transparent" />
        <div aria-hidden="true" className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-white/20 md:hidden" />
        <header className="relative flex items-center justify-between px-5 py-4">
          <h2 className="text-lg font-bold tracking-tight text-white">{title}</h2>
          <IconButton label="Fechar" onClick={onClose} className="bg-white/5"><X size={20} /></IconButton>
        </header>
        <div className="relative flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <footer className="relative border-t border-white/10 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</footer>}
      </div>
    </div>
  );
}

const TONE_TEXT = { default: 'text-white', good: 'text-emerald-300', bad: 'text-rose-300', warn: 'text-amber-300' };
const TONE_CHIP: Record<keyof typeof TONE_TEXT, ChipTone> = { default: 'brand', good: 'good', bad: 'bad', warn: 'warn' };

/** Cartão de número. Passe `money` (número) para animar o valor, ou `value` pronto. */
export function Stat({ label, value, money, tone = 'default', sub, icon }: { label: string; value?: ReactNode; money?: number; tone?: 'default' | 'good' | 'bad' | 'warn'; sub?: ReactNode; icon?: ReactNode }) {
  return (
    <Tilt className="glass rounded-3xl p-4">
      <div className="pop flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-400">{label}</span>
        {icon && <IconChip tone={TONE_CHIP[tone]} size="sm">{icon}</IconChip>}
      </div>
      <div className={cx('pop mt-2 truncate text-lg font-extrabold tracking-tight md:text-2xl', TONE_TEXT[tone])}>{money !== undefined ? <Money value={money} /> : value}</div>
      {sub && <div className="mt-1 text-[11px] text-slate-500">{sub}</div>}
    </Tilt>
  );
}

export function PeriodNav({ label, onPrev, onNext, onToday }: { label: string; onPrev: () => void; onNext: () => void; onToday?: () => void }) {
  return (
    <div className="glass flex items-center gap-1 rounded-2xl p-1">
      <IconButton label="Anterior" onClick={onPrev}><ChevronLeft size={18} /></IconButton>
      <button type="button" key={label} onClick={onToday} className="animate-fade min-w-36 flex-1 text-center text-sm font-bold text-white" title="Voltar para hoje">{label}</button>
      <IconButton label="Próximo" onClick={onNext}><ChevronRight size={18} /></IconButton>
    </div>
  );
}

export function Progress({ value, tone = 'good' }: { value: number; tone?: 'good' | 'warn' | 'bad' }) {
  const c = { good: 'from-emerald-400 via-teal-400 to-cyan-400 shadow-emerald-400/50', warn: 'from-amber-400 to-orange-500 shadow-amber-400/50', bad: 'from-rose-500 to-pink-500 shadow-rose-500/50' }[tone];
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/[.06] ring-1 ring-inset ring-white/5">
      <div className={cx('fill-x h-full rounded-full bg-gradient-to-r shadow-[0_0_12px] transition-[width] duration-700', c)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      {icon && (
        <div className="relative mb-2">
          <div aria-hidden="true" className="absolute inset-0 scale-150 rounded-full bg-brand-500/30 blur-2xl" />
          <div className="float relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-fuchsia-500 text-white shadow-xl shadow-brand-500/40">{icon}</div>
        </div>
      )}
      <p className="text-sm font-bold text-white">{title}</p>
      {text && <p className="max-w-xs text-xs text-slate-400">{text}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 md:mb-7 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-gradient text-2xl font-extrabold tracking-tight md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p>}
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
    <button type="button" onClick={onConfirm} className="h-10 rounded-xl bg-rose-500 px-3 text-xs font-semibold text-white">Confirmar?</button>
  ) : (
    <IconButton label={label} onClick={() => setArmed(true)} className="hover:text-rose-400">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
    </IconButton>
  );
}
