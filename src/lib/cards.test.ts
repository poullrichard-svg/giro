import { describe, expect, it } from 'vitest';
import { accountBalance, cardPurchase, cardUsedLimit, invoiceDates, invoiceMonthFor, invoiceSummary, splitInstallments, txMonth } from './cards';
import type { Account, Card, Transaction } from '../types';

const card: Card = { id: 'c1', name: 'Nubank', color: '#8b5cf6', limit: 3000, closingDay: 3, dueDay: 10 };
const lateDue: Card = { ...card, id: 'c2', closingDay: 28, dueDay: 5 };

describe('fatura', () => {
  it('compra antes do fechamento cai na fatura do mês; depois, na seguinte', () => {
    expect(invoiceMonthFor('2026-11-02', card)).toBe('2026-11');
    expect(invoiceMonthFor('2026-11-03', card)).toBe('2026-12'); // no dia do fechamento já vai pra próxima
    expect(invoiceMonthFor('2026-11-20', card)).toBe('2026-12');
  });
  it('vencimento no mês seguinte ao fechamento', () => {
    expect(invoiceMonthFor('2026-11-10', lateDue)).toBe('2026-12');
    expect(invoiceMonthFor('2026-11-29', lateDue)).toBe('2027-01');
    expect(invoiceDates(lateDue, '2026-12')).toEqual({ due: '2026-12-05', closing: '2026-11-28' });
  });
  it('dia de fechamento maior que o mês é ajustado', () => {
    expect(invoiceDates({ closingDay: 31, dueDay: 8 }, '2027-03').closing).toBe('2027-02-28');
  });
});

describe('parcelamento', () => {
  it('divide em centavos exatos', () => {
    expect(splitInstallments(100, 3)).toEqual([33.34, 33.33, 33.33]);
    expect(splitInstallments(100, 3).reduce((a, b) => a + b, 0)).toBeCloseTo(100, 10);
  });
  it('cada parcela vai para uma fatura', () => {
    const r = cardPurchase({ description: 'TV', amount: 1200, category: 'Lazer', date: '2026-11-20', card, installments: 3, group: 'g' });
    expect(r.map((x) => x.invoiceMonth)).toEqual(['2026-12', '2027-01', '2027-02']);
    expect(r[1]).toMatchObject({ description: 'TV (2/3)', amount: 400, installmentIndex: 2, installmentCount: 3, accountId: null });
  });
});

describe('saldos e limite', () => {
  const tx = (o: Partial<Transaction>): Transaction => ({ id: Math.random().toString(), description: '', amount: 0, type: 'expense', category: 'x', paymentMethod: 'Pix', date: '2026-11-01', ...o });
  it('saldo da conta considera saldo inicial, entradas, saídas e pagamento de fatura', () => {
    const acc: Account = { id: 'a', name: 'Banco', kind: 'corrente', color: '#000', initialBalance: 1000 };
    const list = [tx({ accountId: 'a', type: 'income', amount: 500 }), tx({ accountId: 'a', amount: 200 }), tx({ accountId: 'a', amount: 300, internal: 'invoice-payment', cardId: 'c1', invoiceMonth: '2026-11' }), tx({ cardId: 'c1', invoiceMonth: '2026-11', amount: 300 })];
    expect(accountBalance(acc, list)).toBe(1000);
  });
  it('fatura paga e limite usado', () => {
    const purchases = cardPurchase({ description: 'Celular', amount: 900, category: 'Outros', date: '2026-11-01', card, installments: 3, group: 'g' }).map((p, i) => tx({ ...p, id: String(i) }));
    const pay = tx({ accountId: 'a', amount: 300, internal: 'invoice-payment', cardId: 'c1', invoiceMonth: '2026-11' });
    const all = [...purchases, pay];
    expect(invoiceSummary(card, all, '2026-11', '2026-11-05').status).toBe('paga');
    expect(invoiceSummary(card, all, '2026-12', '2026-11-05').status).toBe('aberta'); // fechou dia 3: dezembro é a atual
    expect(invoiceSummary(card, all, '2027-01', '2026-11-05').status).toBe('futura');
    expect(cardUsedLimit(card, all)).toBe(600);
  });
  it('compra no cartão conta no mês da fatura', () => {
    expect(txMonth({ date: '2026-11-20', cardId: 'c1', invoiceMonth: '2026-12' })).toBe('2026-12');
    expect(txMonth({ date: '2026-11-20' })).toBe('2026-11');
  });
});
