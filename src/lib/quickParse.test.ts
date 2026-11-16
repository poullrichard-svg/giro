import { describe, expect, it } from 'vitest';
import { parseQuickEntry } from './quickParse';

const T = '2026-11-13';

describe('parseQuickEntry', () => {
  it('despesa com forma de pagamento', () => {
    expect(parseQuickEntry('gastei 35,90 almoço no pix', T)).toMatchObject({ type: 'expense', amount: 35.9, category: 'Alimentação', paymentMethod: 'Pix', date: T, description: 'Almoço' });
  });
  it('receita', () => {
    expect(parseQuickEntry('recebi 1.200,00 salário', T)).toMatchObject({ type: 'income', amount: 1200, category: 'Salário' });
  });
  it('corridas', () => {
    expect(parseQuickEntry('ganhei 230 na uber', T)).toMatchObject({ type: 'income', amount: 230, category: 'Corridas (apps)' });
  });
  it('entregas', () => {
    expect(parseQuickEntry('ganhei 180 no ifood', T)).toMatchObject({ type: 'income', category: 'Entregas' });
    expect(parseQuickEntry('recebi 250 mercado livre', T)).toMatchObject({ type: 'income', category: 'Entregas' });
  });
  it('combustível ontem no crédito', () => {
    expect(parseQuickEntry('abasteci 150 ontem no crédito', T)).toMatchObject({ type: 'expense', category: 'Combustível', paymentMethod: 'Crédito', date: '2026-11-12' });
  });
  it('dia específico e milhar sem vírgula', () => {
    expect(parseQuickEntry('aluguel 1.500 dia 5', T)).toMatchObject({ amount: 1500, category: 'Moradia', date: '2026-11-05' });
  });
  it('sem valor retorna null', () => {
    expect(parseQuickEntry('mercado', T)).toBeNull();
  });
});
