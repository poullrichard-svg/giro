import { useEffect, useState } from 'react';
import { getSyncStatus, subscribeSync, type SyncStatus } from './sync';
import { useCloud } from './CloudProvider';
import { cx } from '../components/ui';

export function useSyncStatus() {
  const [s, setS] = useState<SyncStatus>(getSyncStatus);
  useEffect(() => subscribeSync(setS), []);
  return s;
}

export function syncLabel(s: SyncStatus) {
  if (s.phase === 'syncing') return { text: 'Sincronizando…', tone: 'text-sky-300', dot: 'bg-sky-400' };
  if (s.phase === 'offline') return { text: s.pending ? `Sem internet · ${s.pending} para enviar` : 'Sem internet', tone: 'text-amber-300', dot: 'bg-amber-400' };
  if (s.phase === 'error') return { text: 'Erro ao sincronizar', tone: 'text-rose-300', dot: 'bg-rose-400' };
  if (s.pending) return { text: `${s.pending} para enviar`, tone: 'text-sky-300', dot: 'bg-sky-400' };
  return { text: 'Sincronizado', tone: 'text-emerald-300', dot: 'bg-emerald-400' };
}

/** Caixinha da barra lateral: modo local ou estado da sincronização. */
export function SyncBox() {
  const { enabled, user } = useCloud();
  const s = useSyncStatus();
  if (!enabled || !user) {
    return (
      <div className="m-4 rounded-2xl border border-emerald-500/15 bg-emerald-500/[.05] p-3.5">
        <p className="label flex items-center gap-2 text-emerald-400"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_10px] shadow-emerald-400" /> Modo local</p>
        <p className="mt-1 text-[11px] font-medium text-slate-400">Seus dados ficam salvos neste aparelho.</p>
      </div>
    );
  }
  const l = syncLabel(s);
  return (
    <a href="#/mais/conta" className="m-4 block rounded-2xl border border-white/[.06] bg-white/[.03] p-3.5 hover:bg-white/[.05]">
      <p className={cx('label flex items-center gap-2', l.tone)} data-testid="sync-status"><span className={cx('h-2 w-2 rounded-full', l.dot, s.phase === 'syncing' && 'animate-pulse')} /> {l.text}</p>
      <p className="mt-1 truncate text-[11px] font-medium text-slate-400">{user.email}</p>
    </a>
  );
}

/** Pontinho no topo do celular. */
export function SyncDot() {
  const { enabled, user } = useCloud();
  const s = useSyncStatus();
  if (!enabled || !user) return null;
  const l = syncLabel(s);
  return <a href="#/mais/conta" aria-label={l.text} title={l.text} className={cx('label ml-auto flex items-center gap-1.5 rounded-full bg-white/[.04] px-3 py-1.5 ring-1 ring-white/10', l.tone)}><span className={cx('h-2 w-2 rounded-full', l.dot, s.phase === 'syncing' && 'animate-pulse')} />{s.phase === 'idle' && !s.pending ? 'Ok' : s.phase === 'syncing' ? '…' : s.pending || '!'}</a>;
}
