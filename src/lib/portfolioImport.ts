/**
 * Importar carteira — entende (portfolioImport.test.ts):
 *  - B3 Área do Investidor → Extratos → Negociação (Data do Negócio, Tipo de Movimentação, Código de Negociação…)
 *  - B3 Área do Investidor → Extratos → Movimentação (Entrada/Saída, Movimentação, Produto…) — só as liquidações de compra/venda
 *  - o CSV que o próprio Giro exporta
 *  - planilhas simples com colunas parecidas com: ativo, quantidade, preço (médio), data, operação
 */
import type { InvestmentKind, InvestmentOp } from '../types';
import { splitCSV } from './csvImport';
import { localISODate, parseDecimal } from './format';
import { guessKind } from './portfolio';
import type { Asset } from './market';

export type ParsedOp = Omit<InvestmentOp, 'id'>;
export interface ImportResult { format: 'b3-negociacao' | 'b3-movimentacao' | 'giro' | 'simples' | 'desconhecido'; ops: ParsedOp[]; skipped: number; errors: string[] }

type Cell = string | number | Date | null | undefined;
const norm = (s: Cell) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Texto colado ou CSV (separado por ; , ou tab) → linhas. */
export function textToRows(text: string): string[][] {
  const clean = text.replace(/^﻿/, '').trim();
  const first = clean.split(/\r?\n/, 1)[0] ?? '';
  if (first.includes('\t')) return clean.split(/\r?\n/).map((l) => l.split('\t'));
  return splitCSV(clean);
}

function toDate(v: Cell): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) { const y = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  if (/^\d{5}$/.test(s)) { const d = new Date(Date.UTC(1899, 11, 30) + Number(s) * 864e5); return d.toISOString().slice(0, 10); } // data serial do Excel
  return null;
}
const num = (v: Cell) => (typeof v === 'number' ? v : parseDecimal(String(v ?? '').replace(/^-$/, '0')));
/** PETR4F (fracionário) → PETR4. */
const cleanTicker = (t: Cell) => String(t ?? '').trim().toUpperCase().replace(/^([A-Z]{4}\d{1,2})F$/, '$1');

const KINDS: InvestmentKind[] = ['acao', 'fii', 'etf', 'bdr', 'cripto', 'renda-fixa', 'outro'];
const kindFrom = (v: Cell, ticker: string, assets: Asset[]): InvestmentKind => {
  const s = norm(v);
  if ((KINDS as string[]).includes(s)) return s as InvestmentKind;
  if (/fii|imobili/.test(s)) return 'fii';
  if (/etf/.test(s)) return 'etf';
  if (/bdr/.test(s)) return 'bdr';
  if (/cripto|crypto/.test(s)) return 'cripto';
  if (/tesouro|cdb|lci|lca|renda fixa|debenture|cri|cra/.test(s)) return 'renda-fixa';
  if (/acao|acoes/.test(s)) return 'acao';
  return guessKind(ticker, assets);
};
const sideFrom = (v: Cell): 'compra' | 'venda' | null => {
  const s = norm(v);
  if (/^(c|compra|buy|credito|entrada)$/.test(s) || s.startsWith('compra')) return 'compra';
  if (/^(v|venda|sell|debito|saida)$/.test(s) || s.startsWith('venda')) return 'venda';
  return null;
};

const findCol = (head: string[], ...names: RegExp[]) => head.findIndex((h) => names.some((n) => n.test(h)));

export function parsePortfolio(rows: Cell[][], assets: Asset[] = [], today = localISODate()): ImportResult {
  const r: ImportResult = { format: 'desconhecido', ops: [], skipped: 0, errors: [] };
  const hi = rows.findIndex((row) => row.filter((c) => String(c ?? '').trim()).length >= 2 && row.some((c) => /ativo|ticker|codigo|produto|papel/.test(norm(c))));
  if (hi < 0) { r.errors.push('Não encontrei a linha de títulos (precisa ter uma coluna como "Ativo", "Código de Negociação" ou "Produto").'); return r; }
  const head = rows[hi].map(norm);
  const body = rows.slice(hi + 1).filter((row) => row.some((c) => String(c ?? '').trim()));
  const at = (row: Cell[], i: number) => (i >= 0 ? row[i] : undefined);

  const push = (o: ParsedOp, line: number) => {
    if (!o.ticker || !(o.quantity > 0) || !(o.price >= 0) || !o.date) { r.skipped++; r.errors.push(`Linha ${line}: dados incompletos — ignorada.`); return; }
    r.ops.push({ ...o, externalId: `${o.date}|${o.side}|${o.ticker}|${o.quantity}|${o.price}` });
  };

  // B3 · Negociação
  if (head.includes('data do negocio') && findCol(head, /codigo de negociacao/) >= 0) {
    r.format = 'b3-negociacao';
    const c = { d: findCol(head, /data do negocio/), s: findCol(head, /tipo de movimentacao/), t: findCol(head, /codigo de negociacao/), q: findCol(head, /^quantidade/), p: findCol(head, /^preco/), m: findCol(head, /^mercado/) };
    body.forEach((row, i) => {
      const side = sideFrom(at(row, c.s));
      if (!side) { r.skipped++; return; }
      const ticker = cleanTicker(at(row, c.t));
      push({ ticker, kind: kindFrom(at(row, c.m), ticker, assets), side, quantity: num(at(row, c.q)), price: num(at(row, c.p)), date: toDate(at(row, c.d)) ?? '', fees: null, note: 'Importado da B3 (negociação)' }, hi + i + 2);
    });
    return r;
  }
  // B3 · Movimentação
  if (findCol(head, /^entrada\/saida/) >= 0 && findCol(head, /^movimentacao/) >= 0 && findCol(head, /^produto/) >= 0) {
    r.format = 'b3-movimentacao';
    const c = { io: findCol(head, /^entrada\/saida/), d: findCol(head, /^data$/), mv: findCol(head, /^movimentacao/), pr: findCol(head, /^produto/), q: findCol(head, /^quantidade/), p: findCol(head, /preco unitario/) };
    body.forEach((row, i) => {
      const mv = norm(at(row, c.mv));
      if (!/transferencia - liquidacao|^compra|^venda/.test(mv)) { r.skipped++; return; } // dividendos, JCP, atualizações etc. ficam de fora
      const side = /venda/.test(mv) ? 'venda' : /compra/.test(mv) ? 'compra' : sideFrom(at(row, c.io));
      if (!side) { r.skipped++; return; }
      const product = String(at(row, c.pr) ?? '');
      const ticker = cleanTicker(product.split(' - ')[0]);
      const kind: InvestmentKind = /tesouro|cdb|lci|lca|debenture/i.test(product) ? 'renda-fixa' : guessKind(ticker, assets);
      push({ ticker: kind === 'renda-fixa' ? product.trim() : ticker, kind, side, quantity: num(at(row, c.q)), price: num(at(row, c.p)), date: toDate(at(row, c.d)) ?? '', fees: null, note: 'Importado da B3 (movimentação)' }, hi + i + 2);
    });
    return r;
  }
  // Giro / planilha simples
  const c = {
    t: findCol(head, /^ativo$/, /^ticker/, /^codigo/, /^papel/, /^acao$/, /^simbolo/, /^produto/),
    q: findCol(head, /^quantidade/, /^qtd/, /^qtde/, /^cotas/),
    p: findCol(head, /^preco medio/, /^pm$/, /^preco/, /^valor unit/, /^custo medio/),
    d: findCol(head, /^data/),
    s: findCol(head, /^operacao/, /^tipo de operacao/, /^compra\/venda/, /^c\/v$/, /^lado/),
    k: findCol(head, /^tipo$/, /^classe/, /^categoria/),
    f: findCol(head, /^taxa/, /^custos?/, /^corretagem/),
    n: findCol(head, /^observacao/, /^obs/, /^nota/),
  };
  if (c.t < 0 || c.q < 0 || c.p < 0) { r.errors.push('A planilha precisa das colunas: ativo, quantidade e preço.'); return r; }
  r.format = head[0] === 'data' && head.includes('operacao') && head.includes('ativo') ? 'giro' : 'simples';
  body.forEach((row, i) => {
    const raw = String(at(row, c.s) ?? '').trim();
    const side: 'compra' | 'venda' | 'valor' | null = norm(raw) === 'valor' ? 'valor' : raw ? sideFrom(raw) : 'compra';
    if (!side) { r.skipped++; r.errors.push(`Linha ${hi + i + 2}: operação "${raw}" não reconhecida (use compra ou venda).`); return; }
    const t0 = String(at(row, c.t) ?? '').trim();
    const kind = kindFrom(at(row, c.k), cleanTicker(t0), assets);
    const ticker = kind === 'renda-fixa' || kind === 'outro' ? t0 : cleanTicker(t0);
    push({ ticker, kind, side, quantity: num(at(row, c.q)), price: num(at(row, c.p)), fees: c.f >= 0 ? num(at(row, c.f)) || null : null, date: toDate(at(row, c.d)) ?? (c.d < 0 ? today : ''), note: c.n >= 0 ? String(at(row, c.n) ?? '').trim() || null : null }, hi + i + 2);
  });
  return r;
}

/** Tira as operações que já existem (mesma data, operação, ativo, quantidade e preço). */
export function dedupe(incoming: ParsedOp[], existing: InvestmentOp[]) {
  const seen = new Set(existing.map((o) => o.externalId ?? `${o.date}|${o.side}|${o.ticker}|${o.quantity}|${o.price}`));
  const fresh: ParsedOp[] = [];
  for (const o of incoming) { const k = o.externalId!; if (!seen.has(k)) { seen.add(k); fresh.push(o); } }
  return { fresh, duplicates: incoming.length - fresh.length };
}
