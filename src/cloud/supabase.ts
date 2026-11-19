/**
 * Conexão com o Supabase. Só existe se o app foi publicado com as variáveis:
 *   VITE_SUPABASE_URL            → URL do projeto (https://xxxx.supabase.co)
 *   VITE_SUPABASE_PUBLISHABLE_KEY → chave pública (sb_publishable_… ou a antiga "anon")
 * Sem elas o Giro roda no modo local de antes (sem login).
 * A chave pública pode ficar no navegador: quem protege os dados são as regras (RLS) do banco.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PushItem, Remote, RemoteRow } from './sync';

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;
export const cloudEnabled = !!(URL_ && KEY);

let clientPromise: Promise<SupabaseClient> | null = null;
export function getSupabase(): Promise<SupabaseClient> {
  if (!cloudEnabled) return Promise.reject(new Error('Supabase não configurado'));
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) => createClient(URL_!, KEY!, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'giro.auth' },
  }));
  return clientPromise;
}

const fail = (error: { message: string; code?: string } | null) => { if (error) throw Object.assign(new Error(error.message), { code: error.code }); };

export const supabaseRemote: Remote = {
  async push(items: PushItem[]) {
    const sb = await getSupabase();
    const { data, error } = await sb.rpc('push_records', { items });
    fail(error);
    return data as number;
  },
  async pull(afterRev: number, limit: number) {
    const sb = await getSupabase();
    const { data, error } = await sb.from('records').select('collection,id,data,deleted,updated_at,rev').gt('rev', afterRev).order('rev', { ascending: true }).limit(limit);
    fail(error);
    return (data ?? []) as RemoteRow[];
  },
};

/** Mensagens do Supabase Auth em português. */
export function authMessage(e: unknown): string {
  const m = String((e as any)?.message ?? e ?? '');
  const code = (e as any)?.code as string | undefined;
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(m)) return 'Falta confirmar o e-mail. Abra o link que enviamos para a sua caixa de entrada.';
  if (code === 'user_already_exists' || /already registered|already exists/i.test(m)) return 'Este e-mail já tem conta. Toque em "Entrar".';
  if (code === 'weak_password' || /password should be|weak/i.test(m)) return 'Senha fraca: use pelo menos 8 caracteres, misturando letras e números.';
  if (code === 'same_password' || /different from the old/i.test(m)) return 'A nova senha precisa ser diferente da atual.';
  if (/rate limit|security purposes|too many/i.test(m)) return 'Muitas tentativas seguidas. Espere um minuto e tente de novo.';
  if (/invalid.*email|email address.*invalid/i.test(m)) return 'E-mail inválido.';
  if (/fetch|network|Load failed/i.test(m)) return 'Sem conexão. Verifique sua internet.';
  return 'Não foi possível concluir agora. Tente de novo.';
}
