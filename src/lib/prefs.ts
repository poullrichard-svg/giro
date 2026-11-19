/**
 * Abas do menu e modo motorista — regras puras (prefs.test.ts).
 */
import type { AppPrefs } from '../types';

export const PREFS_ID = 'app';
export const DRIVER_OCCUPATIONS = ['motorista-app', 'entregador'];

/** Abas que a pessoa pode esconder (Início, Lançamentos e Ajustes ficam sempre). */
export const OPTIONAL_TABS = ['contas', 'fixas', 'dividas', 'veiculos', 'calculadoras', 'metas', 'compras', 'assistente'] as const;
export type OptionalTab = (typeof OPTIONAL_TABS)[number];

export interface PrefsContext { hasSessions: boolean; hasWorkProfile: boolean; hasVehicles: boolean; occupation?: string | null }

/** Modo motorista: o que a pessoa escolheu, ou automático (trabalha com app / já registra turnos). */
export function driverOn(prefs: AppPrefs | undefined, ctx: PrefsContext) {
  if (prefs?.driver != null) return prefs.driver;
  return ctx.hasSessions || ctx.hasWorkProfile || DRIVER_OCCUPATIONS.includes(ctx.occupation ?? '');
}

/** Padrão de cada aba quando a pessoa ainda não mexeu. Veículos: só para motorista ou quem já cadastrou veículo. */
export function tabDefault(tab: string, driver: boolean, ctx: PrefsContext) {
  if (tab === 'veiculos') return driver || ctx.hasVehicles;
  return true;
}

export function tabVisible(tab: string, prefs: AppPrefs | undefined, ctx: PrefsContext) {
  const driver = driverOn(prefs, ctx);
  if (tab === 'motorista') return driver;
  if (!(OPTIONAL_TABS as readonly string[]).includes(tab)) return true;
  return prefs?.tabs?.[tab] ?? tabDefault(tab, driver, ctx);
}
