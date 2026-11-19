import { describe, expect, it } from 'vitest';
import { buildPositions, opsToCSV, portfolioSummary } from './portfolio';
import { dedupe, parsePortfolio, textToRows } from './portfolioImport';
import { normalizeAsset, type Asset } from './market';
import type { InvestmentOp } from '../types';

let n = 0;
const op = (o: Partial<InvestmentOp>): InvestmentOp => ({ id: `o${++n}`, ticker: 'PETR4', kind: 'acao', side: 'compra', quantity: 100, price: 30, fees: 0, date: '2026-01-10', ...o });
const quotes = [{ stock: 'PETR4', close: 40, change: 2, volume: 1e7 }, { stock: 'MXRF11', close: 10, change: -1, volume: 1e6, type: 'fund', subType: 'fii' }].map(normalizeAsset) as Asset[];

describe('carteira', () => {
  it('preço médio ponderado com taxas; venda não muda o preço médio e gera resultado realizado', () => {
    const ops = [op({ quantity: 100, price: 30, fees: 5 }), op({ quantity: 100, price: 34, date: '2026-02-10' }), op({ side: 'venda', quantity: 50, price: 38, date: '2026-03-10' })];
    const [p] = buildPositions(ops, quotes);
    expect(p.quantity).toBe(150);
    expect(p.avgPrice).toBe(32.03); // (3000 + 5 + 3400) / 200 = 32,025
    expect(p.invested).toBe(4803.75);
    expect(p.realized).toBe(298.75); // 50 × (38 − 32,025)
    expect(p.value).toBe(6000); // 150 × 40
    expect(p.profit).toBe(1196.25);
    expect(p.dayChange).toBe(117.65); // 6000 × 2/102
  });
  it('vender tudo zera a posição; renda fixa usa o último "valor"', () => {
    const ops = [op({ ticker: 'MXRF11', kind: 'fii', quantity: 10, price: 9 }), op({ ticker: 'MXRF11', kind: 'fii', side: 'venda', quantity: 10, price: 11, date: '2026-05-01' }),
      op({ ticker: 'CDB Inter 110%', kind: 'renda-fixa', quantity: 1, price: 5000 }), op({ ticker: 'CDB Inter 110%', kind: 'renda-fixa', side: 'valor', quantity: 1, price: 5400, date: '2026-06-01' })];
    const ps = buildPositions(ops, quotes);
    const mx = ps.find((p) => p.ticker === 'MXRF11')!;
    expect(mx).toMatchObject({ quantity: 0, value: 0, realized: 20 });
    const cdb = ps.find((p) => p.kind === 'renda-fixa')!;
    expect(cdb).toMatchObject({ ticker: 'CDB Inter 110%', invested: 5000, value: 5400, profit: 400 });
    // resgate de R$ 2.700 (metade) de um CDB que vale 5.400 com custo 5.000 → realiza 200 e fica valendo 2.700
    const cdb2 = buildPositions([...ops, op({ ticker: 'CDB Inter 110%', kind: 'renda-fixa', side: 'venda', quantity: 0.5, price: 5400, date: '2026-07-01' })]).find((p) => p.kind === 'renda-fixa')!;
    expect(cdb2).toMatchObject({ quantity: 0.5, invested: 2500, value: 2700, realized: 200 });
    const s = portfolioSummary(ps);
    expect(s).toMatchObject({ value: 5400, invested: 5000, profit: 400, realized: 20, count: 1 });
    expect(s.allocation).toEqual([{ kind: 'renda-fixa', value: 5400, pct: 100 }]);
  });
  it('atualização de valor no mesmo dia da aplicação (lista vem do mais novo para o mais antigo)', () => {
    const ops = [
      { ...op({ ticker: 'CDB X', kind: 'renda-fixa', side: 'valor', quantity: 1, price: 5300, date: '2026-11-19' }), createdAt: '2026-11-19T10:05:00Z' },
      { ...op({ ticker: 'CDB X', kind: 'renda-fixa', quantity: 1, price: 5000, date: '2026-11-19' }), createdAt: '2026-11-19T10:00:00Z' },
    ];
    expect(buildPositions(ops)[0]).toMatchObject({ invested: 5000, value: 5300 });
    expect(buildPositions(ops.map(({ createdAt, ...o }) => o))[0]).toMatchObject({ invested: 5000, value: 5300 });
  });
  it('ativo sem cotação fica pelo valor investido', () => {
    const [p] = buildPositions([op({ ticker: 'ABCD3', quantity: 10, price: 5 })], quotes);
    expect(p).toMatchObject({ value: 50, profit: 0, quoted: false });
  });
});

describe('importar carteira', () => {
  it('B3 · Negociação (com fracionário)', () => {
    const rows = textToRows(['Data do Negócio\tTipo de Movimentação\tMercado\tPrazo/Vencimento\tInstituição\tCódigo de Negociação\tQuantidade\tPreço\tValor',
      '15/03/2026\tCompra\tMercado à Vista\t-\tNU INVEST\tPETR4\t100\t35,20\t3.520,00',
      '20/03/2026\tCompra\tMercado Fracionário\t-\tNU INVEST\tPETR4F\t7\t36,00\t252,00',
      '02/04/2026\tVenda\tMercado à Vista\t-\tNU INVEST\tPETR4\t50\t38,10\t1.905,00',
      '05/04/2026\tCompra\tMercado à Vista\t-\tNU INVEST\tMXRF11\t30\t10,05\t301,50'].join('\n'));
    const r = parsePortfolio(rows, quotes);
    expect(r.format).toBe('b3-negociacao');
    expect(r.ops.map((o) => [o.date, o.side, o.ticker, o.kind, o.quantity, o.price])).toEqual([
      ['2026-03-15', 'compra', 'PETR4', 'acao', 100, 35.2], ['2026-03-20', 'compra', 'PETR4', 'acao', 7, 36],
      ['2026-04-02', 'venda', 'PETR4', 'acao', 50, 38.1], ['2026-04-05', 'compra', 'MXRF11', 'fii', 30, 10.05]]);
  });
  it('B3 · Movimentação: só compras e vendas (ignora dividendos)', () => {
    const rows = textToRows(['Entrada/Saída;Data;Movimentação;Produto;Instituição;Quantidade;Preço unitário;Valor da Operação',
      'Credito;10/02/2026;Transferência - Liquidação;BBAS3 - BANCO DO BRASIL S/A;XP INVESTIMENTOS;40;27,50;1.100,00',
      'Credito;15/02/2026;Dividendo;BBAS3 - BANCO DO BRASIL S/A;XP INVESTIMENTOS;40;0,45;18,00',
      'Debito;20/02/2026;Transferência - Liquidação;BBAS3 - BANCO DO BRASIL S/A;XP INVESTIMENTOS;10;29,00;290,00'].join('\n'));
    const r = parsePortfolio(rows);
    expect(r.format).toBe('b3-movimentacao');
    expect(r.ops.map((o) => [o.side, o.ticker, o.quantity, o.price])).toEqual([['compra', 'BBAS3', 40, 27.5], ['venda', 'BBAS3', 10, 29]]);
    expect(r.skipped).toBe(1);
  });
  it('planilha simples sem data nem operação vira compra hoje; o CSV do Giro volta igual', () => {
    const r = parsePortfolio(textToRows('Ativo,Quantidade,Preço médio\nITSA4,200,"9,80"\nBTC,0.015,"350000"\nKNCR11,abc,100'), [], '2026-11-19');
    expect(r.format).toBe('simples');
    expect(r.ops.map((o) => [o.ticker, o.kind, o.side, o.quantity, o.price, o.date])).toEqual([['ITSA4', 'acao', 'compra', 200, 9.8, '2026-11-19'], ['BTC', 'cripto', 'compra', 0.015, 350000, '2026-11-19']]);
    expect(r.errors[0]).toMatch(/Linha 4/);
    const ops = [op({ quantity: 10, price: 32.5, fees: 1.2, note: 'primeira; compra' }), op({ ticker: 'Tesouro Selic 2029', kind: 'renda-fixa', quantity: 1, price: 1000 })];
    const back = parsePortfolio(textToRows(opsToCSV(ops)));
    expect(back.format).toBe('giro');
    expect(back.ops.map((o) => [o.ticker, o.kind, o.quantity, o.price, o.fees, o.note])).toEqual([['PETR4', 'acao', 10, 32.5, 1.2, 'primeira; compra'], ['Tesouro Selic 2029', 'renda-fixa', 1, 1000, null, null]]);
  });
  it('não importa duas vezes a mesma operação', () => {
    const r = parsePortfolio(textToRows('Ativo;Quantidade;Preço;Data\nWEGE3;10;50;01/02/2026'));
    const existing = r.ops.map((o, i) => ({ ...o, id: `x${i}` }));
    expect(dedupe(r.ops, existing)).toEqual({ fresh: [], duplicates: 1 });
  });
  it('arquivo sem colunas reconhecíveis explica o problema', () => {
    expect(parsePortfolio(textToRows('nome;idade\nJoão;30')).errors[0]).toMatch(/títulos/);
  });
});
