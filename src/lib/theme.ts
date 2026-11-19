/** Tema do app: escuro, claro ou automático (segue o celular). Guardado neste aparelho. */
import { useEffect, useState } from 'react';

export type ThemePref = 'dark' | 'light' | 'system';
const KEY = 'giro.theme';
const EVENT = 'giro-theme';

export const getThemePref = (): ThemePref => { try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'system' ? v : 'dark'; } catch { return 'dark'; } };
const systemLight = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: light)').matches;
export const resolveTheme = (p: ThemePref) => (p === 'system' ? (systemLight() ? 'light' : 'dark') : p);

export function applyTheme(p: ThemePref = getThemePref()) {
  const t = resolveTheme(p);
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'light' ? '#f2f4f8' : '#07060f');
}

export function setThemePref(p: ThemePref) {
  try { localStorage.setItem(KEY, p); } catch { /* sem armazenamento: vale só nesta sessão */ }
  applyTheme(p);
  window.dispatchEvent(new Event(EVENT));
}

export function useThemePref() {
  const [p, setP] = useState(getThemePref);
  useEffect(() => {
    const on = () => setP(getThemePref());
    const mq = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: light)') : null;
    const sys = () => { if (getThemePref() === 'system') applyTheme('system'); };
    window.addEventListener(EVENT, on); mq?.addEventListener?.('change', sys);
    return () => { window.removeEventListener(EVENT, on); mq?.removeEventListener?.('change', sys); };
  }, []);
  return [p, setThemePref] as const;
}
