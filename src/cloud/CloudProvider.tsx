import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useData } from '../data/DataProvider';
import { enqueueAll, getOutbox, setTracking, wipeLocal } from '../data/db';
import { useToast } from '../data/toast';
import { cloudEnabled, getSupabase, supabaseRemote, authMessage } from './supabase';
import { CURSOR_KEY, OWNER_KEY, onLocalChange, refreshPending, resetSyncStatus, syncNow, syncStorage as ls } from './sync';

export interface CloudUser { id: string; email: string }
type Choice = 'merge' | 'cloud';

interface CloudApi {
  enabled: boolean;
  ready: boolean;
  user: CloudUser | null;
  /** Chegou pelo link de "esqueci a senha": mostrar a tela de nova senha. */
  recovery: boolean;
  /** Pergunta pendente: juntar dados do aparelho com os da conta? */
  choice: ((c: Choice) => void) | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<{ error: string | null; confirm: boolean }>;
  resetPassword: (email: string) => Promise<string | null>;
  updatePassword: (password: string) => Promise<string | null>;
  signOut: () => Promise<boolean>;
  deleteAccount: () => Promise<string | null>;
  sync: () => Promise<void>;
}

const Ctx = createContext<CloudApi | null>(null);
export const useCloud = () => { const c = useContext(Ctx); if (!c) throw new Error('useCloud fora do CloudProvider'); return c; };

/** Tem algo além da "Carteira" criada automaticamente? */
function hasLocalData(d: ReturnType<typeof useData>['data']) {
  const other = Object.entries(d).filter(([k]) => k !== 'accounts').reduce((s, [, a]) => s + a.length, 0);
  return other > 0 || d.accounts.length > 1 || d.accounts.some((a) => a.name !== 'Carteira' || a.initialBalance !== 0);
}

export function CloudProvider({ children }: { children: ReactNode }) {
  const { data, loading, reload } = useData();
  const toast = useToast();
  const [ready, setReady] = useState(!cloudEnabled);
  const [user, setUser] = useState<CloudUser | null>(null);
  const [recovery, setRecovery] = useState(false);
  const [choice, setChoice] = useState<((c: Choice) => void) | null>(null);
  const dataRef = useRef(data); dataRef.current = data;
  const handled = useRef<string | null>(null);

  const runSync = useCallback(async () => { await syncNow(supabaseRemote, () => { reload(); }); }, [reload]);

  /** Usuário entrou: decide o que fazer com os dados que já estão no aparelho. */
  const adopt = useCallback(async (u: CloudUser) => {
    if (handled.current === u.id) return;
    handled.current = u.id;
    const owner = ls.get(OWNER_KEY);
    if (owner && owner !== u.id) {
      // Dados de outra conta neste aparelho: não misturar.
      setTracking(false); await wipeLocal(); ls.del(CURSOR_KEY);
    } else if (!owner) {
      ls.del(CURSOR_KEY);
      if (!hasLocalData(dataRef.current)) { setTracking(false); await wipeLocal(); }
      else {
        const remoteHasData = (await supabaseRemote.pull(0, 1).catch(() => [])).length > 0;
        const c: Choice = remoteHasData ? await new Promise<Choice>((res) => setChoice(() => (x: Choice) => { setChoice(null); res(x); })) : 'merge';
        if (c === 'cloud') { setTracking(false); await wipeLocal(); }
        else { setTracking(true); await enqueueAll(); }
      }
    }
    ls.set(OWNER_KEY, u.id);
    setTracking(true);
    await reload();
    await runSync();
    await reload(); // cria a Carteira se a conta ainda não tem nenhuma
  }, [reload, runSync]);

  useEffect(() => {
    if (!cloudEnabled || loading) return;
    let unsub: (() => void) | undefined;
    let alive = true;
    getSupabase().then((sb) => {
      if (!alive) return;
      const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') setRecovery(true);
        const u = session?.user ? { id: session.user.id, email: session.user.email ?? '' } : null;
        setUser((prev) => (prev?.id === u?.id ? prev : u));
        if (!u) { handled.current = null; setTracking(false); resetSyncStatus(); }
        setReady(true);
      });
      unsub = () => sub.subscription.unsubscribe();
    }).catch((e) => { console.error(e); setReady(true); });
    return () => { alive = false; unsub?.(); };
  }, [loading]);

  // Ao entrar (ou abrir o app já logado): ajusta os dados e sincroniza.
  useEffect(() => { if (user) adopt(user).catch((e) => { console.error(e); toast('Não foi possível sincronizar agora.', 'error'); }); }, [user, adopt, toast]);

  // Gatilhos: depois de gravar (com pausa), ao voltar a internet, ao voltar para o app e a cada minuto.
  useEffect(() => {
    if (!user) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const soon = () => { refreshPending(); clearTimeout(t); t = setTimeout(runSync, 1500); };
    const off = onLocalChange(soon);
    const onVisible = () => { if (document.visibilityState === 'visible') runSync(); };
    window.addEventListener('online', runSync);
    document.addEventListener('visibilitychange', onVisible);
    const every = setInterval(() => { if (document.visibilityState === 'visible') runSync(); }, 60_000);
    return () => { off(); clearTimeout(t); clearInterval(every); window.removeEventListener('online', runSync); document.removeEventListener('visibilitychange', onVisible); };
  }, [user, runSync]);

  const signIn: CloudApi['signIn'] = async (email, password) => {
    try { const sb = await getSupabase(); const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password }); return error ? authMessage(error) : null; } catch (e) { return authMessage(e); }
  };
  const signUp: CloudApi['signUp'] = async (email, password) => {
    try {
      const sb = await getSupabase();
      const { data: d, error } = await sb.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin } });
      if (error) return { error: authMessage(error), confirm: false };
      // Com confirmação de e-mail ligada, um e-mail já cadastrado volta sem "identities".
      if (d.user && d.user.identities?.length === 0) return { error: 'Este e-mail já tem conta. Toque em "Entrar".', confirm: false };
      return { error: null, confirm: !d.session };
    } catch (e) { return { error: authMessage(e), confirm: false }; }
  };
  const resetPassword: CloudApi['resetPassword'] = async (email) => {
    try { const sb = await getSupabase(); const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin }); return error ? authMessage(error) : null; } catch (e) { return authMessage(e); }
  };
  const updatePassword: CloudApi['updatePassword'] = async (password) => {
    try { const sb = await getSupabase(); const { error } = await sb.auth.updateUser({ password }); if (error) return authMessage(error); setRecovery(false); return null; } catch (e) { return authMessage(e); }
  };

  /** Sai e apaga os dados deste aparelho (ficam guardados na conta). */
  const finishSignOut = async () => {
    const sb = await getSupabase();
    await sb.auth.signOut({ scope: 'local' });
    setTracking(false); await wipeLocal();
    ls.del(OWNER_KEY); ls.del(CURSOR_KEY); handled.current = null; resetSyncStatus();
    await reload();
  };
  const signOut: CloudApi['signOut'] = async () => {
    await runSync();
    const pending = (await getOutbox()).length;
    if (pending && !window.confirm(`${pending} alteração(ões) ainda não foram para a nuvem (sem internet?). Se sair agora, elas serão perdidas. Sair mesmo assim?`)) return false;
    await finishSignOut();
    return true;
  };
  const deleteAccount: CloudApi['deleteAccount'] = async () => {
    try {
      const sb = await getSupabase();
      const { error } = await sb.rpc('delete_account');
      if (error) return authMessage(error);
      await finishSignOut();
      return null;
    } catch (e) { return authMessage(e); }
  };

  const api: CloudApi = { enabled: cloudEnabled, ready, user, recovery, choice, signIn, signUp, resetPassword, updatePassword, signOut, deleteAccount, sync: runSync };
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
