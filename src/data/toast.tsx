import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

type Action = { label: string; onClick: () => void };
type Toast = { id: number; kind: 'ok' | 'error'; text: string; action?: Action };
type Push = (text: string, kind?: Toast['kind'], action?: Action) => void;
const Ctx = createContext<Push>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback<Push>((text, kind = 'ok', action) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, kind, text, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 8000 : action ? 5000 : 2600);
  }, []);

  // Qualquer erro inesperado aparece na tela, em vez de falhar em silêncio.
  useEffect(() => {
    const onErr = (e: ErrorEvent) => push(`Algo deu errado: ${e.message}`, 'error');
    const onRej = (e: PromiseRejectionEvent) => push(`Algo deu errado: ${e.reason?.message ?? String(e.reason)}`, 'error');
    window.addEventListener('error', onErr);
    window.addEventListener('unhandledrejection', onRej);
    return () => { window.removeEventListener('error', onErr); window.removeEventListener('unhandledrejection', onRej); };
  }, [push]);

  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-[max(1rem,env(safe-area-inset-top))] z-[100] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'} className={`pop-in pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-2xl shadow-black/60 backdrop-blur ${t.kind === 'ok' ? 'border-emerald-500/30 bg-emerald-950/95 text-emerald-100' : 'border-rose-500/40 bg-rose-950/95 text-rose-100'}`}>
            {t.kind === 'ok' ? <CheckCircle2 size={18} className="shrink-0" /> : <AlertTriangle size={18} className="shrink-0" />}
            <span className="flex-1">{t.text}</span>
            {t.action && (
              <button type="button" onClick={() => { t.action!.onClick(); setToasts((x) => x.filter((y) => y.id !== t.id)); }}
                className="press shrink-0 rounded-xl bg-white/15 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-white hover:bg-white/25">
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
