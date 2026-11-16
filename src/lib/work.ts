/**
 * Tipos de trabalho com veículo e catálogo de plataformas.
 * Cada pessoa escolhe os tipos que faz e liga/desliga/cria plataformas.
 */
import type { DriverSession, Platform, VehicleKind, WorkKind, WorkProfile } from '../types';

export interface WorkType { id: string; label: string; desc: string; kind: WorkKind; vehicle: VehicleKind; platforms: string[] }

export const WORK_TYPES: WorkType[] = [
  { id: 'app-carro', label: 'Passageiros de carro', desc: 'Uber, 99, InDrive, particular', kind: 'passageiro', vehicle: 'carro', platforms: ['uber', '99', 'indrive', 'particular'] },
  { id: 'app-moto', label: 'Passageiros de moto', desc: 'Uber Moto, 99 Moto, mototáxi', kind: 'passageiro', vehicle: 'moto', platforms: ['uber-moto', '99-moto', 'mototaxi'] },
  { id: 'entrega-carro', label: 'Entregas de carro ou van', desc: 'Mercado Livre, Shopee, Amazon, Loggi', kind: 'entrega', vehicle: 'carro', platforms: ['mercado-livre', 'shopee', 'amazon', 'loggi', 'lalamove'] },
  { id: 'entrega-moto', label: 'Entregas de moto', desc: 'iFood, Rappi, 99Food, Lalamove', kind: 'entrega', vehicle: 'moto', platforms: ['ifood', 'rappi', '99food', 'lalamove', 'loggi'] },
  { id: 'entrega-bike', label: 'Entregas de bike', desc: 'iFood, Rappi e outros', kind: 'entrega', vehicle: 'bike', platforms: ['ifood', 'rappi'] },
  { id: 'fixo', label: 'Fixo ou por diária', desc: 'Empresa, restaurante, rota fixa', kind: 'fixo', vehicle: 'carro', platforms: ['diaria'] },
];

export const PLATFORM_CATALOG: Array<Omit<Platform, 'enabled'>> = [
  { id: 'uber', name: 'Uber', color: '#94a3b8', kind: 'passageiro', vehicle: 'carro' },
  { id: '99', name: '99', color: '#f59e0b', kind: 'passageiro', vehicle: 'carro' },
  { id: 'indrive', name: 'InDrive', color: '#84cc16', kind: 'passageiro', vehicle: 'carro' },
  { id: 'particular', name: 'Particular', color: '#10b981', kind: 'passageiro', vehicle: 'carro' },
  { id: 'uber-moto', name: 'Uber Moto', color: '#cbd5e1', kind: 'passageiro', vehicle: 'moto' },
  { id: '99-moto', name: '99 Moto', color: '#fbbf24', kind: 'passageiro', vehicle: 'moto' },
  { id: 'mototaxi', name: 'Mototáxi', color: '#2dd4bf', kind: 'passageiro', vehicle: 'moto' },
  { id: 'mercado-livre', name: 'Mercado Livre', color: '#facc15', kind: 'entrega', vehicle: 'carro' },
  { id: 'shopee', name: 'Shopee', color: '#f97316', kind: 'entrega', vehicle: 'carro' },
  { id: 'amazon', name: 'Amazon', color: '#38bdf8', kind: 'entrega', vehicle: 'carro' },
  { id: 'loggi', name: 'Loggi', color: '#06b6d4', kind: 'entrega', vehicle: 'carro' },
  { id: 'lalamove', name: 'Lalamove', color: '#fb923c', kind: 'entrega', vehicle: 'moto' },
  { id: 'ifood', name: 'iFood', color: '#ef4444', kind: 'entrega', vehicle: 'moto' },
  { id: 'rappi', name: 'Rappi', color: '#fb7185', kind: 'entrega', vehicle: 'moto' },
  { id: '99food', name: '99Food', color: '#eab308', kind: 'entrega', vehicle: 'moto' },
  { id: 'diaria', name: 'Diária / fixo', color: '#a3e635', kind: 'fixo', vehicle: 'carro' },
];

export const PROFILE_ID = 'work';
export const CUSTOM_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#ec4899', '#84cc16'];

/** Perfil inicial a partir dos tipos escolhidos: liga as plataformas desses tipos. */
export function buildProfile(types: string[], previous?: WorkProfile | null, dailyGoal = 300): WorkProfile {
  const wanted = new Set(WORK_TYPES.filter((t) => types.includes(t.id)).flatMap((t) => t.platforms));
  const prev = new Map((previous?.platforms ?? []).map((p) => [p.id, p]));
  const platforms: Platform[] = PLATFORM_CATALOG.map((p) => ({ ...p, enabled: prev.get(p.id)?.enabled ?? wanted.has(p.id) }));
  // Plataformas novas dos tipos recém-marcados entram ligadas.
  for (const p of platforms) if (wanted.has(p.id) && !(previous?.types ?? []).some((t) => WORK_TYPES.find((w) => w.id === t)?.platforms.includes(p.id))) p.enabled = true;
  for (const p of previous?.platforms ?? []) if (p.custom) platforms.push(p);
  return { id: PROFILE_ID, types, platforms, dailyGoal: previous?.dailyGoal ?? dailyGoal };
}

export const kindsOf = (profile: WorkProfile | null) => new Set((profile?.types ?? []).map((t) => WORK_TYPES.find((w) => w.id === t)?.kind).filter(Boolean) as WorkKind[]);

/** "Corridas", "Entregas" ou "Corridas e entregas", conforme o perfil. */
export function countLabel(kinds: Set<WorkKind>) {
  const pass = kinds.has('passageiro'); const del = kinds.has('entrega') || kinds.has('fixo');
  return pass && del ? 'Corridas e entregas' : del ? 'Entregas' : 'Corridas';
}
export function unitLabel(kinds: Set<WorkKind>) {
  const pass = kinds.has('passageiro'); const del = kinds.has('entrega') || kinds.has('fixo');
  return pass && del ? 'serviço' : del ? 'entrega' : 'corrida';
}
export function panelTitle(kinds: Set<WorkKind>) {
  if (kinds.size === 0) return 'Painel do motorista';
  return !kinds.has('passageiro') ? 'Painel do entregador' : 'Painel do motorista';
}
export const countFieldLabel = (kind: WorkKind) => (kind === 'passageiro' ? 'Corridas' : kind === 'fixo' ? 'Entregas/paradas' : 'Entregas');

const hashColor = (name: string) => CUSTOM_COLORS[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % CUSTOM_COLORS.length];

/** Plataforma de um registro (também resolve registros antigos que só têm o nome). */
export function platformOf(profile: WorkProfile | null, s: Pick<DriverSession, 'app' | 'platformId'>): Pick<Platform, 'name' | 'color' | 'kind'> {
  const all = [...(profile?.platforms ?? []), ...PLATFORM_CATALOG];
  const p = all.find((x) => x.id === s.platformId) ?? all.find((x) => x.name.toLowerCase() === s.app.toLowerCase());
  return p ?? { name: s.app, color: hashColor(s.app), kind: 'passageiro' };
}

export const incomeCategoryFor = (kind: WorkKind) => (kind === 'passageiro' ? 'Corridas (apps)' : 'Entregas');
export const VEHICLE_KINDS: Array<{ value: VehicleKind; label: string }> = [
  { value: 'carro', label: 'Carro' }, { value: 'moto', label: 'Moto' }, { value: 'bike', label: 'Bike' }, { value: 'van', label: 'Van / utilitário' },
];
