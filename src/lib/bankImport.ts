/**
 * Importação de extratos bancários (OFX e CSV) e detecção de lançamentos repetidos.
 */
import type { Transaction, TxType } from '../types';
import { parseDecimal } from './format';
import { guessCategory } from './quickParse';
import { splitCSV } from './csvImport';

export interface StatementLine {
  date: string; // YYYY-MM-DD
  amount: number; // sempre positivo
  type: TxType;
  description: string;
  externalId: string | null;
  category: string;
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/** Lê arquivos OFX (formato SGML antigo ou XML), comum nos bancos brasileiros. */
export function parseOFX(text: string): StatementLine[] {
  const blocks = text.split(/<STMTTRN>/i).slice(1).map((b) => b.split(/<\/STMTTRN>/i)[0]);
  const tag = (b: string, name: string) => b.match(new RegExp(`<${name}>([^<\\r\\n]*)`, 'i'))?.[1]?.trim() ?? '';
  const out: StatementLine[] = [];
  for (const b of blocks) {
    const dt = tag(b, 'DTPOSTED');
    const m = dt.match(/^(\d{4})(\d{2})(\d{2})/);
    const raw = parseDecimal(tag(b, 'TRNAMT').replace(/^\+/, ''));
    if (!m || !raw) continue;
    const description = (tag(b, 'MEMO') || tag(b, 'NAME') || 'Lançamento importado').replace(/\s+/g, ' ');
    const type: TxType = raw > 0 ? 'income' : 'expense';
    out.push({ date: `${m[1]}-${m[2]}-${m[3]}`, amount: Math.abs(raw), type, description, externalId: tag(b, 'FITID') || null, category: guessCategory(description, type) });
  }
  return out;
}

const DATE_COLS = ['data', 'date', 'data lancamento', 'data de lancamento', 'data movimento', 'dt lancamento'];
const AMOUNT_COLS = ['valor', 'amount', 'valor r$', 'valor (r$)', 'quantia'];
const DESC_COLS = ['descricao', 'description', 'title', 'historico', 'lancamento', 'estabelecimento', 'memo'];
const ID_COLS = ['identificador', 'id', 'fitid', 'documento'];
const TYPE_COLS = ['tipo', 'type'];
const CAT_COLS = ['categoria', 'category'];

const toISO = (s: string) => {
  const t = s.trim();
  const br = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (br) return `${br[3].length === 2 ? '20' + br[3] : br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
};

/**
 * Lê CSV de banco (Nubank, Inter, Itaú, C6… e o do próprio Giro).
 * `positiveIsExpense`: em extratos de cartão os valores das compras vêm positivos.
 */
export function parseBankCSV(text: string, positiveIsExpense = false): StatementLine[] {
  const [header, ...rows] = splitCSV(text);
  if (!header) return [];
  const h = header.map(norm);
  const find = (names: string[]) => h.findIndex((x) => names.includes(x));
  const col = { date: find(DATE_COLS), amount: find(AMOUNT_COLS), desc: find(DESC_COLS), id: find(ID_COLS), type: find(TYPE_COLS), cat: find(CAT_COLS) };
  if (col.date < 0 || col.amount < 0) throw new Error('Não encontrei as colunas de data e valor neste arquivo.');
  const out: StatementLine[] = [];
  for (const r of rows) {
    const date = toISO(r[col.date] ?? '');
    const raw = parseDecimal(r[col.amount] ?? '');
    if (!date || !raw) continue;
    const t = col.type >= 0 ? norm(r[col.type] ?? '') : '';
    let type: TxType;
    if (t) type = t.startsWith('rec') || t === 'income' || t.startsWith('entrada') || t.startsWith('cred') ? 'income' : 'expense';
    else type = (raw > 0) !== positiveIsExpense ? 'income' : 'expense';
    const description = (col.desc >= 0 ? r[col.desc] : '')?.trim() || 'Lançamento importado';
    const category = (col.cat >= 0 ? r[col.cat]?.trim() : '') || guessCategory(description, type);
    out.push({ date, amount: Math.abs(raw), type, description, externalId: col.id >= 0 ? r[col.id]?.trim() || null : null, category });
  }
  return out;
}

export function parseStatement(fileName: string, text: string, positiveIsExpense = false): StatementLine[] {
  const isOfx = /\.ofx$/i.test(fileName) || /<OFX>|<STMTTRN>/i.test(text);
  return isOfx ? parseOFX(text) : parseBankCSV(text, positiveIsExpense);
}

const tokens = (s: string) => new Set(norm(s).split(' ').filter((w) => w.length > 2));
/** Semelhança simples entre descrições (0 a 1). */
export function similarity(a: string, b: string) {
  const A = tokens(a); const B = tokens(b);
  if (!A.size || !B.size) return norm(a) === norm(b) ? 1 : 0;
  let common = 0;
  for (const w of A) if (B.has(w)) common++;
  return common / Math.min(A.size, B.size);
}

const dayDiff = (a: string, b: string) => Math.abs((new Date(`${a}T00:00:00`).getTime() - new Date(`${b}T00:00:00`).getTime()) / 86_400_000);

/**
 * Para cada linha do extrato, diz se parece repetida:
 * mesmo identificador do banco, ou mesmo valor e tipo em até 2 dias com descrição parecida
 * (ou no mesmo dia, mesmo sem descrição parecida). Também pega repetidas dentro do próprio arquivo.
 */
export function findDuplicates(lines: StatementLine[], existing: Transaction[], scope: { accountId?: string | null; cardId?: string | null }): boolean[] {
  const pool = existing.filter((t) => !t.internal && (scope.cardId ? t.cardId === scope.cardId : t.accountId === scope.accountId));
  const ids = new Set(pool.map((t) => t.externalId).filter(Boolean));
  const seen = new Set<string>();
  return lines.map((l) => {
    const key = l.externalId ?? `${l.date}|${l.amount}|${l.type}|${norm(l.description)}`;
    if (seen.has(key)) return true;
    seen.add(key);
    if (l.externalId && ids.has(l.externalId)) return true;
    return pool.some((t) => t.type === l.type && Math.abs(t.amount - l.amount) < 0.005 && (
      (dayDiff(t.date, l.date) <= 2 && similarity(t.description, l.description) >= 0.5) || t.date === l.date
    ));
  });
}
