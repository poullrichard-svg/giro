import { useCallback, useMemo } from 'react';
import { useData } from './DataProvider';
import { useCloud } from '../cloud/CloudProvider';
import { PROFILE_ID } from '../lib/work';
import { driverOn, PREFS_ID, tabVisible, type PrefsContext } from '../lib/prefs';

/** Abas visíveis e modo motorista, com as funções para mudar. */
export function usePrefs() {
  const { data, put } = useData();
  const { profile } = useCloud();
  const prefs = data.prefs.find((p) => p.id === PREFS_ID);
  const ctx: PrefsContext = useMemo(() => ({
    hasSessions: data.sessions.length > 0, hasWorkProfile: data.settings.some((s) => s.id === PROFILE_ID),
    hasVehicles: data.vehicles.length > 0, occupation: profile?.occupation,
  }), [data.sessions.length, data.settings, data.vehicles.length, profile?.occupation]);
  const driver = driverOn(prefs, ctx);
  const visible = useCallback((tab: string) => tabVisible(tab, prefs, ctx), [prefs, ctx]);
  const save = useCallback((patch: { driver?: boolean; tabs?: Record<string, boolean> }) => put('prefs', {
    id: PREFS_ID, driver: patch.driver ?? prefs?.driver ?? null, tabs: { ...(prefs?.tabs ?? {}), ...(patch.tabs ?? {}) },
  }), [prefs, put]);
  const setDriver = useCallback((on: boolean) => save({ driver: on }), [save]);
  const setTab = useCallback((tab: string, on: boolean) => save({ tabs: { [tab]: on } }), [save]);
  return { driver, visible, setDriver, setTab };
}

/** 4º botão da barra do celular: Motorista para quem trabalha com app; senão a primeira aba útil ligada. */
export function mobileSlot(driver: boolean, visible: (t: string) => boolean): string {
  if (driver) return 'motorista';
  return ['dividas', 'contas', 'metas', 'fixas', 'compras', 'calculadoras'].find(visible) ?? 'contas';
}
export const SHORT_LABEL: Record<string, string> = { lancamentos: 'Extrato', motorista: 'Motorista', dividas: 'Dívidas', contas: 'Contas', metas: 'Metas', fixas: 'Fixas', compras: 'Compras', calculadoras: 'Calcular' };
