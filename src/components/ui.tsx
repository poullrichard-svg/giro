import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
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

export function Card({ children, className, title, action }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={cx('rounded-2xl border border-white/5 bg-slate-900/60 p-4 md:p-5', className)}>
      {(title || action) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          {title && <h3 className="text-sm font-semibold text-slate-200">{title}</h3>}
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
    primary: 'bg-brand-500 text-white hover:bg-brand-400',
    soft: 'bg-white/5 text-slate-200 hover:bg-white/10',
    ghost: 'text-slate-400 hover:text-white hover:bg-white/5',
    danger: 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20',
  }[variant];
  return <button {...p} className={cx('inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition active:scale-[.98] disabled:opacity-50', v, className)} />;
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

const inputCls = 'w-full min-h-11 rounded-xl border border-white/10 bg-slate-950/60 px-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-brand-500/60';

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
  return (
    <div className={cx('flex rounded-xl bg-slate-950/60 p-1 ring-1 ring-white/5', className)}>
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} className={cx('flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition', value === o.value ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300')}>
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm animate-fade md:items-center md:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="animate-sheet flex max-h-[92dvh] w-full flex-col rounded-t-3xl border border-white/10 bg-slate-900 md:max-w-lg md:rounded-3xl">
        <header className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <IconButton label="Fechar" onClick={onClose}><X size={20} /></IconButton>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="border-t border-white/5 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</footer>}
      </div>
    </div>
  );
}

export function Stat({ label, value, tone = 'default', sub, icon }: { label: string; value: ReactNode; tone?: 'default' | 'good' | 'bad' | 'warn'; sub?: ReactNode; icon?: ReactNode }) {
  const t = { default: 'text-white', good: 'text-emerald-400', bad: 'text-rose-400', warn: 'text-amber-400' }[tone];
  return (
    <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between gap-2 text-xs text-slate-400">{label}{icon}</div>
      <div className={cx('mt-1 truncate text-lg font-bold md:text-xl', t)}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

export function PeriodNav({ label, onPrev, onNext, onToday }: { label: string; onPrev: () => void; onNext: () => void; onToday?: () => void }) {
  return (
    <div className="flex items-center gap-1 rounded-xl bg-slate-900/60 p-1 ring-1 ring-white/5">
      <IconButton label="Anterior" onClick={onPrev}><ChevronLeft size={18} /></IconButton>
      <button type="button" onClick={onToday} className="min-w-36 flex-1 text-center text-sm font-semibold text-white" title="Voltar para hoje">{label}</button>
      <IconButton label="Próximo" onClick={onNext}><ChevronRight size={18} /></IconButton>
    </div>
  );
}

export function Progress({ value, tone = 'good' }: { value: number; tone?: 'good' | 'warn' | 'bad' }) {
  const c = { good: 'bg-emerald-500', warn: 'bg-amber-500', bad: 'bg-rose-500' }[tone];
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
      <div className={cx('h-full rounded-full transition-all', c)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      {icon && <div className="text-slate-600">{icon}</div>}
      <p className="text-sm font-semibold text-slate-300">{title}</p>
      {text && <p className="max-w-xs text-xs text-slate-500">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-col gap-3 md:mb-6 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-xl font-bold text-white md:text-2xl">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
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
