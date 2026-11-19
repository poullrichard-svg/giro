import { describe, expect, it } from 'vitest';
import { driverOn, tabVisible } from './prefs';

const none = { hasSessions: false, hasWorkProfile: false, hasVehicles: false, occupation: null };
describe('menu personalizado', () => {
  it('modo motorista automático pela ocupação ou pelos turnos', () => {
    expect(driverOn(undefined, none)).toBe(false);
    expect(driverOn(undefined, { ...none, occupation: 'motorista-app' })).toBe(true);
    expect(driverOn(undefined, { ...none, occupation: 'entregador' })).toBe(true);
    expect(driverOn(undefined, { ...none, hasSessions: true })).toBe(true);
  });
  it('escolha da pessoa vence o automático', () => {
    expect(driverOn({ id: 'app', driver: false }, { ...none, hasSessions: true })).toBe(false);
    expect(driverOn({ id: 'app', driver: true }, none)).toBe(true);
  });
  it('abas: núcleo sempre visível; motorista e veículos seguem o modo; resto pode esconder', () => {
    expect(tabVisible('inicio', { id: 'app', tabs: { inicio: false } }, none)).toBe(true);
    expect(tabVisible('motorista', undefined, none)).toBe(false);
    expect(tabVisible('veiculos', undefined, none)).toBe(false);
    expect(tabVisible('veiculos', undefined, { ...none, hasVehicles: true })).toBe(true);
    expect(tabVisible('veiculos', undefined, { ...none, occupation: 'entregador' })).toBe(true);
    expect(tabVisible('assistente', undefined, none)).toBe(true);
    expect(tabVisible('assistente', { id: 'app', tabs: { assistente: false } }, none)).toBe(false);
    expect(tabVisible('veiculos', { id: 'app', tabs: { veiculos: true } }, none)).toBe(true);
  });
});
