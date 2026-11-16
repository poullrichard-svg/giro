import { describe, expect, it } from 'vitest';
import { buildProfile, countLabel, kindsOf, panelTitle, platformOf, unitLabel } from './work';

describe('perfil de trabalho', () => {
  it('liga as plataformas dos tipos escolhidos', () => {
    const p = buildProfile(['entrega-moto']);
    const on = p.platforms.filter((x) => x.enabled).map((x) => x.id);
    expect(on).toEqual(expect.arrayContaining(['ifood', 'rappi', '99food']));
    expect(on).not.toContain('uber');
  });
  it('mantém escolhas e plataformas próprias ao mudar os tipos', () => {
    const p1 = buildProfile(['app-carro']);
    p1.platforms.find((x) => x.id === 'indrive')!.enabled = false;
    p1.platforms.push({ id: 'c1', name: 'Frete do João', color: '#fff', kind: 'entrega', enabled: true, custom: true });
    const p2 = buildProfile(['app-carro', 'entrega-carro'], p1);
    expect(p2.platforms.find((x) => x.id === 'indrive')!.enabled).toBe(false);
    expect(p2.platforms.find((x) => x.id === 'mercado-livre')!.enabled).toBe(true);
    expect(p2.platforms.some((x) => x.name === 'Frete do João')).toBe(true);
  });
  it('textos conforme o perfil', () => {
    expect(countLabel(kindsOf(buildProfile(['app-carro'])))).toBe('Corridas');
    expect(countLabel(kindsOf(buildProfile(['entrega-moto'])))).toBe('Entregas');
    const mixed = kindsOf(buildProfile(['app-carro', 'entrega-moto']));
    expect(countLabel(mixed)).toBe('Corridas e entregas');
    expect(unitLabel(mixed)).toBe('serviço');
    expect(panelTitle(kindsOf(buildProfile(['entrega-bike'])))).toBe('Painel do entregador');
  });
  it('resolve plataforma de registros antigos pelo nome', () => {
    expect(platformOf(null, { app: 'Uber', platformId: null }).color).toBe('#94a3b8');
    expect(platformOf(null, { app: 'Outro app', platformId: null }).name).toBe('Outro app');
  });
});
