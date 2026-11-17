import { describe, expect, it } from 'vitest';
import { averageSpent, budgetStatus, crossedLevel, monthEndProjection, upcomingDue } from './planning';
import type { Card, FixedBill, Transaction, Vehicle } from '../types';

const tx = (o: Partial<Transaction>): Transaction => ({ id: Math.random().toString(36), description: 'x', amount: 0, type: 'expense', category: 'Mercado', paymentMethod: 'Pix', date: '2026-11-05', accountId: 'a', ...o });
const card: Card = { id: 'c', name: 'Nubank', color: '#000', limit: 1000, closingDay: 3, dueDay: 10 };

describe('orçamento', () => {
  it('nível por porcentagem e inclui cartão no mês da fatura e conta fixa da categoria', () => {
    const list = [tx({ amount: 300 }), tx({ amount: 200, cardId: 'c', accountId: null, invoiceMonth: '2026-11', date: '2026-10-20' }), tx({ amount: 999, internal: 'transfer' })];
    const fixed: FixedBill[] = [{ id: 'f', description: 'Feira', amount: 150, type: 'expense', category: 'Mercado' }];
    const [s] = budgetStatus([{ id: 'b', category: 'Mercado', limit: 800 }], list, fixed, '2026-11');
    expect(s.spent).toBe(650);
    expect(s.level).toBe('atencao');
    expect(budgetStatus([{ id: 'b', category: 'Mercado', limit: 600 }], list, fixed, '2026-11')[0].level).toBe('estourou');
  });
  it('avisa só quando cruza 80% ou 100%', () => {
    expect(crossedLevel(100, 70, 15)).toBe('atencao');
    expect(crossedLevel(100, 85, 5)).toBeNull();
    expect(crossedLevel(100, 90, 20)).toBe('estourou');
    expect(crossedLevel(0, 10, 10)).toBeNull();
  });
  it('média dos 3 meses anteriores', () => {
    const list = [tx({ amount: 300, date: '2026-10-05' }), tx({ amount: 600, date: '2026-09-05' })];
    expect(averageSpent('Mercado', list, [], '2026-11')).toBe(300);
  });
});

describe('próximos vencimentos', () => {
  const fixed: FixedBill[] = [
    { id: 'luz', description: 'Luz', amount: 200, type: 'expense', category: 'Contas de casa', dueDay: 20 },
    { id: 'net', description: 'Internet', amount: 100, type: 'expense', category: 'Contas de casa', dueDay: 2 },
    { id: 'alug', description: 'Aluguel', amount: 1200, type: 'expense', category: 'Moradia', dueDay: 15 },
    { id: 'sal', description: 'Salário', amount: 3000, type: 'income', category: 'Salário', dueDay: 18 },
  ];
  it('lista fixas dos próximos 7 dias, virada de mês e atrasadas; ignora pagas e receitas', () => {
    const items = upcomingDue({ fixed, payments: [{ id: 'p', fixedId: 'alug', month: '2026-11', amount: 1200, paidAt: '' }], cards: [], tx: [], vehicles: [] }, '2026-11-17', 7);
    expect(items.map((i) => [i.title, i.date])).toEqual([['Internet', '2026-11-02'], ['Luz', '2026-11-20']]);
    const dec = upcomingDue({ fixed, payments: [], cards: [], tx: [], vehicles: [] }, '2026-11-28', 7);
    expect(dec.some((i) => i.title === 'Internet' && i.date === '2026-12-02')).toBe(true);
  });
  it('fatura com valor em aberto e documento do veículo', () => {
    const v: Vehicle = { id: 'v', name: 'Onix', plate: '', fuelType: 'Flex', ownership: 'owned', odometer: 0, fuelConsumption: 10, ipvaValue: 2400, ipvaDueDate: '2026-11-21', licensingValue: 0, insuranceValue: 0, installmentValue: 0, oilIntervalKm: 10000, active: true };
    const items = upcomingDue({ fixed: [], payments: [], cards: [card], tx: [tx({ amount: 300, cardId: 'c', accountId: null, invoiceMonth: '2026-12', date: '2026-11-10' })], vehicles: [v] }, '2026-12-05', 7);
    expect(items.map((i) => i.kind)).toEqual(['veiculo', 'fatura']); // IPVA de 21/11 segue aparecendo como atrasado
    const items2 = upcomingDue({ fixed: [], payments: [], cards: [], tx: [], vehicles: [v] }, '2026-11-17', 7);
    expect(items2[0]).toMatchObject({ kind: 'veiculo', daysLeft: 4, amount: 2400 });
  });
});

describe('projeção do fim do mês', () => {
  it('saldo hoje − fixas a pagar + fixas a receber − faturas do mês', () => {
    const accounts = [{ id: 'a', name: 'Banco', kind: 'corrente' as const, color: '#000', initialBalance: 2000 }];
    const list = [tx({ amount: 500, date: '2026-11-03' }), tx({ amount: 400, cardId: 'c', accountId: null, invoiceMonth: '2026-11', date: '2026-10-25' }), tx({ amount: 50, date: '2026-11-25' })];
    const fixed: FixedBill[] = [
      { id: 'luz', description: 'Luz', amount: 200, type: 'expense', category: 'Casa', dueDay: 20 },
      { id: 'sal', description: 'Salário', amount: 3000, type: 'income', category: 'Salário', dueDay: 30 },
    ];
    const r = monthEndProjection({ accounts, tx: list, fixed, payments: [], cards: [card] }, '2026-11-05');
    expect(r).toMatchObject({ endDate: '2026-11-30', balanceToday: 1500, fixedToPay: 200, fixedToReceive: 3000, invoicesToPay: 400 });
    expect(r.projected).toBe(1500 - 50 - 200 + 3000 - 400);
  });
});

import { budgetAlert } from './planning';
describe('aviso de limite', () => {
  it('mensagem ao cruzar 80% e 100%', () => {
    const b = [{ id: 'b', category: 'Lazer', limit: 100 }];
    const list = [{ id: '1', description: 'x', amount: 70, type: 'expense' as const, category: 'Lazer', paymentMethod: 'Pix', date: '2026-11-02' }];
    expect(budgetAlert(b, list, [], 'Lazer', '2026-11', 15)).toEqual({ kind: 'warn', text: 'Lazer: já usou 85% do limite de R$ 100,00' });
    expect(budgetAlert(b, list, [], 'Lazer', '2026-11', 40)?.kind).toBe('error');
    expect(budgetAlert(b, list, [], 'Lazer', '2026-11', 5)).toBeNull();
    expect(budgetAlert(b, list, [], 'Mercado', '2026-11', 500)).toBeNull();
  });
});

describe('conta fixa paga', () => {
  it('pagar não muda a previsão: sai da conta e deixa de estar "a pagar"', () => {
    const accounts = [{ id: 'a', name: 'Banco', kind: 'corrente' as const, color: '#000', initialBalance: 1000 }];
    const fixed: FixedBill[] = [{ id: 'luz', description: 'Luz', amount: 200, type: 'expense', category: 'Casa', dueDay: 20 }];
    const before = monthEndProjection({ accounts, tx: [], fixed, payments: [], cards: [] }, '2026-11-10');
    const after = monthEndProjection({
      accounts, fixed, cards: [],
      tx: [tx({ id: 'p', amount: 200, date: '2026-11-10', internal: 'fixed-payment' })],
      payments: [{ id: 'fp', fixedId: 'luz', month: '2026-11', amount: 200, paidAt: '', transactionId: 'p' }],
    }, '2026-11-10');
    expect(before.projected).toBe(800);
    expect(after).toMatchObject({ balanceToday: 800, fixedToPay: 0, projected: 800 });
  });
});
