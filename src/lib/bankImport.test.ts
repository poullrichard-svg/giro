import { describe, expect, it } from 'vitest';
import { findDuplicates, parseBankCSV, parseOFX, parseStatement, similarity } from './bankImport';
import type { Transaction } from '../types';

const OFX_SGML = `OFXHEADER:100
DATA:OFXSGML
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261103120000[-3:BRT]
<TRNAMT>-45,90
<FITID>abc123
<MEMO>COMPRA CARTAO - IFOOD *RESTAURANTE
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261105
<TRNAMT>3500.00
<FITID>abc124
<NAME>PIX RECEBIDO EMPRESA
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

describe('OFX', () => {
  it('lê formato SGML com vírgula, sinais e FITID', () => {
    const r = parseOFX(OFX_SGML);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ date: '2026-11-03', amount: 45.9, type: 'expense', externalId: 'abc123', category: 'Alimentação' });
    expect(r[1]).toMatchObject({ date: '2026-11-05', amount: 3500, type: 'income', description: 'PIX RECEBIDO EMPRESA' });
  });
  it('lê formato XML', () => {
    const xml = '<OFX><STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20261110</DTPOSTED><TRNAMT>-120.5</TRNAMT><FITID>x1</FITID><MEMO>Posto Shell</MEMO></STMTTRN></OFX>';
    expect(parseStatement('extrato.ofx', xml)[0]).toMatchObject({ amount: 120.5, type: 'expense', externalId: 'x1' });
  });
});

describe('CSV de banco', () => {
  it('conta Nubank (valor com sinal)', () => {
    const csv = 'Data,Valor,Identificador,Descrição\n03/11/2026,-25.50,id-1,Compra no débito - Padaria Pão Quente\n04/11/2026,1000.00,id-2,Transferência recebida pelo Pix';
    const r = parseBankCSV(csv);
    expect(r[0]).toMatchObject({ date: '2026-11-03', amount: 25.5, type: 'expense', externalId: 'id-1', category: 'Mercado' });
    expect(r[1].type).toBe('income');
  });
  it('fatura Nubank: valores positivos são compras', () => {
    const r = parseBankCSV('date,title,amount\n2026-11-02,Uber *Trip,23.90\n2026-11-05,Pagamento recebido,-500.00', true);
    expect(r[0]).toMatchObject({ type: 'expense', amount: 23.9, description: 'Uber *Trip' });
    expect(r[1].type).toBe('income');
  });
  it('Inter com ; e vírgula decimal', () => {
    const r = parseBankCSV('Data Lançamento;Histórico;Descrição;Valor;Saldo\n05/11/2026;Pix enviado;Fulano;-1.250,00;3.000,00');
    expect(r[0]).toMatchObject({ amount: 1250, type: 'expense', description: 'Pix enviado' });
  });
  it('arquivo sem data/valor dá erro claro', () => {
    expect(() => parseBankCSV('nome;idade\nA;1')).toThrow('Não encontrei as colunas');
  });
});

describe('repetidos', () => {
  const t = (o: Partial<Transaction>): Transaction => ({ id: 'e', description: 'Padaria Pão Quente', amount: 25.5, type: 'expense', category: 'Mercado', paymentMethod: 'Pix', date: '2026-11-03', accountId: 'a', ...o });
  it('semelhança de descrições', () => {
    expect(similarity('Compra no débito - Padaria Pão Quente', 'Padaria Pao Quente')).toBe(1);
    expect(similarity('Uber', 'Posto Shell')).toBe(0);
  });
  it('marca por FITID, por valor+data próxima+descrição, e repetidas no arquivo', () => {
    const lines = parseBankCSV('Data,Valor,Identificador,Descrição\n03/11/2026,-25.50,x,Compra débito Padaria Pão Quente\n04/11/2026,-25.50,y,Outra coisa\n06/11/2026,-99,id-9,Livro\n06/11/2026,-99,id-9,Livro\n07/11/2026,-10,z,Café');
    const dup = findDuplicates(lines, [t({}), t({ id: 'f', externalId: 'z', amount: 999, description: 'qualquer', date: '2026-01-01' })], { accountId: 'a' });
    expect(dup).toEqual([true, false, false, true, true]);
  });
  it('só compara com a mesma conta/cartão', () => {
    const lines = parseBankCSV('Data,Valor,Descrição\n03/11/2026,-25.50,Padaria Pão Quente');
    expect(findDuplicates(lines, [t({ accountId: 'outra' })], { accountId: 'a' })).toEqual([false]);
  });
});

describe('CSV do próprio Giro', () => {
  it('mantém tipo e categoria do arquivo', () => {
    const r = parseBankCSV('﻿Data;Tipo;Descrição;Categoria;Pagamento;Valor\r\n2026-11-13;Despesa;Mercado;Mercado;Pix;342,50\r\n2026-11-12;Receita;Uber;Corridas (apps);Pix;285,00');
    expect(r.map((x) => [x.type, x.category, x.amount])).toEqual([['expense', 'Mercado', 342.5], ['income', 'Corridas (apps)', 285]]);
  });
});

describe('CSV exportado do Supabase (histórico antigo)', () => {
  it('lê valor positivo + coluna type', () => {
    const csv = 'id,user_id,description,amount,type,category,payment_method,date,created_at\nabc,u,Almoço,28.9,expense,Alimentação,Pix,2026-11-12,2026-11-12 10:00:00+00\nx,u,,,,,,,\n';
    expect(parseBankCSV(csv)).toEqual([{ date: '2026-11-12', type: 'expense', amount: 28.9, description: 'Almoço', category: 'Alimentação', externalId: 'abc' }]);
  });
});
