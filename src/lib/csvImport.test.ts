import { describe, expect, it } from 'vitest';
import { parseTransactionsCSV } from './csvImport';

describe('parseTransactionsCSV', () => {
  it('lê o CSV do Giro (;) com vírgula decimal e aspas', () => {
    const csv = '﻿Data;Tipo;Descrição;Categoria;Pagamento;Valor\r\n2026-11-13;Despesa;"Mercado; feira";Mercado;Pix;342,50\r\n2026-11-12;Receita;Uber;Corridas (apps);Pix;285,00\r\n';
    const r = parseTransactionsCSV(csv);
    expect(r.items).toHaveLength(2);
    expect(r.items[0]).toMatchObject({ type: 'expense', amount: 342.5, description: 'Mercado; feira' });
    expect(r.items[1].type).toBe('income');
  });
  it('lê o CSV exportado do Supabase', () => {
    const csv = 'id,user_id,description,amount,type,category,payment_method,date,created_at\nabc,u,Almoço,28.9,expense,Alimentação,Pix,2026-11-12,2026-11-12 10:00:00+00\nx,u,,,,,,,\n';
    const r = parseTransactionsCSV(csv);
    expect(r.items).toEqual([{ date: '2026-11-12', type: 'expense', amount: 28.9, description: 'Almoço', category: 'Alimentação', paymentMethod: 'Pix', vehicleId: null }]);
    expect(r.skipped).toBe(1);
  });
  it('aceita data brasileira', () => {
    expect(parseTransactionsCSV('Data;Valor;Tipo\n05/03/2026;10;Despesa').items[0].date).toBe('2026-03-05');
  });
});
