/** Perfil do usuário (fica no Supabase, tabela profiles). */
import { getSupabase } from './supabase';

export interface Profile {
  full_name: string;
  birth_date: string; // YYYY-MM-DD
  avatar: string | null; // foto pequena em data URL (JPEG ~256px)
  monthly_income: number | null; // null = prefere não informar
  occupation: string | null;
  city: string | null;
  state: string | null;
  consent_stats: boolean;
}

export const OCCUPATIONS = [
  { value: 'motorista-app', label: 'Motorista de aplicativo' },
  { value: 'entregador', label: 'Entregador(a)' },
  { value: 'autonomo', label: 'Autônomo(a) / MEI' },
  { value: 'clt', label: 'Empregado(a) CLT' },
  { value: 'servidor', label: 'Servidor(a) público(a)' },
  { value: 'empresario', label: 'Empresário(a)' },
  { value: 'estudante', label: 'Estudante' },
  { value: 'aposentado', label: 'Aposentado(a)' },
  { value: 'sem-trabalho', label: 'Procurando trabalho' },
  { value: 'outro', label: 'Outro' },
];
export const occupationLabel = (v?: string | null) => OCCUPATIONS.find((o) => o.value === v)?.label ?? v ?? '';

export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

export const MIN_AGE = 18;

/** Idade completa em anos numa data. */
export function ageOn(birth: string, today = new Date()) {
  const [y, m, d] = birth.split('-').map(Number);
  if (!y || !m || !d) return NaN;
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  return age;
}

export const firstName = (p?: Profile | null) => (p?.full_name ?? '').trim().split(/\s+/)[0] ?? '';

const cacheKey = (uid: string) => `giro.profile.${uid}`;
export const readCachedProfile = (uid: string): Profile | null => { try { return JSON.parse(localStorage.getItem(cacheKey(uid)) ?? 'null'); } catch { return null; } };
export const writeCachedProfile = (uid: string, p: Profile | null) => { try { if (p) localStorage.setItem(cacheKey(uid), JSON.stringify(p)); else localStorage.removeItem(cacheKey(uid)); } catch { /* ok */ } };

const pick = (r: any): Profile => ({
  full_name: r.full_name, birth_date: r.birth_date, avatar: r.avatar ?? null, monthly_income: r.monthly_income == null ? null : Number(r.monthly_income),
  occupation: r.occupation ?? null, city: r.city ?? null, state: r.state ?? null, consent_stats: !!r.consent_stats,
});

export async function fetchMyProfile(): Promise<Profile | null> {
  const sb = await getSupabase();
  const { data, error } = await sb.rpc('get_my_profile');
  if (error) throw error;
  return data ? pick(data) : null;
}

export async function saveMyProfile(p: Profile): Promise<Profile> {
  const sb = await getSupabase();
  const { data, error } = await sb.rpc('save_my_profile', { p });
  if (error) throw error;
  return pick(data);
}

export async function fetchIsAdmin(): Promise<boolean> {
  const sb = await getSupabase();
  const { data, error } = await sb.rpc('is_admin');
  return !error && data === true;
}

export interface AdminOverview {
  mes: string; usuarios: number; novos_30_dias: number; com_perfil: number; participam_estatisticas: number; grupo_minimo: number;
  usuarios_ativos_no_mes: number;
  idade: Array<{ faixa: string; n: number; renda_media: number | null }>;
  renda: { n: number; media: number; mediana: number } | null;
  ocupacao: Array<{ ocupacao: string; n: number }>;
  estado: Array<{ uf: string; n: number }>;
  mes_medio: { entradas: number; saidas: number } | null;
  gastos_por_categoria: Array<{ categoria: string; media_por_usuario: number; n: number }>;
  aplicativos: Array<{ app: string; motoristas: number; por_hora: number | null; por_km: number | null; media_mes: number }>;
}

export async function fetchAdminOverview(month: string): Promise<AdminOverview> {
  const sb = await getSupabase();
  const { data, error } = await sb.rpc('admin_overview', { month });
  if (error) throw error;
  return data as AdminOverview;
}

export function profileError(e: unknown) {
  const m = String((e as any)?.message ?? e ?? '');
  if (/18 anos/.test(m)) return 'É preciso ter 18 anos ou mais para usar o Giro.';
  if (/fetch|network|Load failed/i.test(m)) return 'Sem conexão. Verifique sua internet.';
  if (/schema cache|does not exist/i.test(m)) return 'O banco ainda não tem a parte de perfil. Rode o arquivo supabase/02_perfil.sql no Supabase.';
  return 'Não foi possível salvar o perfil. Tente de novo.';
}
