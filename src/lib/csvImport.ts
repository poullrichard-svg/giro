/**
 * Importa lançamentos de um CSV. Aceita:
 *  - o CSV exportado pelo Giro (Data;Tipo;Descrição;Categoria;Pagamento;Valor)
 *  - o CSV da tabela "transactions" exportado pelo Supabase (date,type,description,category,payment_method,amount)
 */
import type { Transaction } from '../types';
import { parseDecimal } from './format';

export function splitCSV(text: string): string[][] {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? '';
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = []; let cell = ''; let q = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (q) {
      if (ch === '"' && clean[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const ALIASES: Record<'date' | 'type' | 'description' | 'category' | 'paymentMethod' | 'amount', string[]> = {
  date: ['data', 'date'],
  type: ['tipo', 'type'],
  description: ['descricao', 'description'],
  category: ['categoria', 'category'],
  paymentMethod: ['pagamento', 'payment_method', 'forma de pagamento'],
  amount: ['valor', 'amount'],
};

/** "13/11/2026" ou "2026-11-13" (com ou sem hora) -> "2026-11-13" */
const toISO = (s: string) => {
  const t = s.trim();
  const br = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
};

export function parseTransactionsCSV(text: string): { items: Omit<Transaction, 'id'>[]; skipped: number } {
  const [header, ...rows] = splitCSV(text);
  if (!header) throw new Error('Arquivo vazio.');
  const h = header.map(norm);
  const col = Object.fromEntries(Object.entries(ALIASES).map(([k, names]) => [k, h.findIndex((x) => names.includes(x))])) as Record<keyof typeof ALIASES, number>;
  if (col.amount < 0 || col.date < 0) throw new Error('Não encontrei as colunas de data e valor no arquivo.');
  let skipped = 0;
  const items: Omit<Transaction, 'id'>[] = [];
  for (const r of rows) {
    const date = toISO(r[col.date] ?? '');
    const raw = parseDecimal(r[col.amount] ?? '');
    if (!date || !raw) { skipped++; continue; }
    const t = norm(r[col.type] ?? '');
    const type = t.startsWith('rec') || t === 'income' || t === 'entrada' ? 'income' : t ? 'expense' : raw > 0 ? 'income' : 'expense';
    items.push({
      date, type, amount: Math.abs(raw),
      description: (r[col.description] ?? '').trim() || 'Importado',
      category: (r[col.category] ?? '').trim() || 'Outros',
      paymentMethod: (r[col.paymentMethod] ?? '').trim() || 'Pix',
      vehicleId: null,
    });
  }
  return { items, skipped };
}
