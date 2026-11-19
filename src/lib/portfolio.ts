/**
 * Carteira de investimentos — posições a partir das operações (portfolio.test.ts).
 * Preço médio ponderado: compras somam (com taxas); vendas baixam a quantidade sem mudar o preço médio
 * e geram lucro/prejuízo realizado. Renda fixa: valor aplicado, atualizado por lançamentos "valor".
 */
import type { InvestmentKind, InvestmentOp } from '../types';
import type { Asset } from './market';
import { round2 } from './format';

export interface Position {
  ticker: string; kind: InvestmentKind; quantity: number; avgPrice: number; invested: number;
  realized: number; price: number | null; value: number; profit: number; profitPct: number | null;
  dayChange: number | null; firstDate: string; ops: InvestmentOp[]; quoted: boolean;
}

export const KIND_LABEL: Record<InvestmentKind, string> = { acao: 'Ações', fii: 'FIIs', etf: 'ETFs', bdr: 'BDRs', cripto: 'Cripto', 'renda-fixa': 'Renda fixa', outro: 'Outros' };
export const KIND_COLOR: Record<InvestmentKind, string> = { acao: '#3b82f6', fii: '#f59e0b', etf: '#8b5cf6', bdr: '#64748b', cripto: '#f97316', 'renda-fixa': '#10b981', outro: '#94a3b8' };

const EPS = 1e-9;
const key = (t: string) => t.trim().toUpperCase();

export function buildPositions(ops: InvestmentOp[], assets: Asset[] = []): Position[] {
  const quotes = new Map(assets.map((a) => [a.ticker, a]));
  const groups = new Map<string, InvestmentOp[]>();
  for (const o of ops) { const k = key(o.ticker); if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(o); }
  const out: Position[] = [];
  for (const [ticker, list] of groups) {
    // Mesma data: na ordem em que foram lançadas; sem essa informação, compra → venda → atualização de valor.
    const rank = { compra: 0, venda: 1, valor: 2 } as const;
    const created = (o: InvestmentOp) => (o as InvestmentOp & { createdAt?: string }).createdAt ?? '';
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date) || created(a).localeCompare(created(b)) || rank[a.side] - rank[b.side]);
    let qty = 0; let cost = 0; let realized = 0; let manual: number | null = null;
    for (const o of sorted) {
      if (o.side === 'compra') {
        qty += o.quantity; cost += o.quantity * o.price + (o.fees ?? 0);
        if (manual != null) manual += o.quantity * o.price; // aplicação depois de atualizar o valor
      } else if (o.side === 'venda') {
        const q = Math.min(o.quantity, qty);
        const avg = qty > EPS ? cost / qty : 0;
        realized += q * o.price - (o.fees ?? 0) - q * avg;
        if (manual != null && qty > EPS) manual *= 1 - q / qty; // resgate parcial da renda fixa
        cost -= q * avg; qty -= q;
        if (qty < EPS) { qty = 0; cost = 0; manual = null; }
      } else if (o.side === 'valor') manual = o.price;
    }
    const kind = sorted[sorted.length - 1].kind;
    // Código da bolsa em maiúsculas; renda fixa mantém o nome como a pessoa escreveu.
    const label = kind === 'renda-fixa' || kind === 'outro' ? sorted[sorted.length - 1].ticker.trim() : ticker;
    const quote = quotes.get(ticker);
    const avgPrice = qty > EPS ? cost / qty : 0;
    const price = quote?.price ?? null;
    const isFixed = kind === 'renda-fixa' || kind === 'outro';
    const value = isFixed ? (manual ?? cost) : price != null ? qty * price : cost;
    const profit = value - cost;
    out.push({
      ticker: label, kind, quantity: round2(qty * 1e6) / 1e6, avgPrice: round2(avgPrice), invested: round2(cost), realized: round2(realized),
      price, value: round2(value), profit: round2(profit), profitPct: cost > EPS ? (profit / cost) * 100 : null,
      dayChange: !isFixed && price != null && quote?.changePct != null ? round2(qty * price * (quote.changePct / (100 + quote.changePct))) : null,
      firstDate: sorted[0].date, ops: sorted, quoted: isFixed || price != null,
    });
  }
  return out.sort((a, b) => b.value - a.value);
}

export function portfolioSummary(positions: Position[]) {
  const open = positions.filter((p) => p.quantity > 0 || p.value > 0);
  const value = round2(open.reduce((s, p) => s + p.value, 0));
  const invested = round2(open.reduce((s, p) => s + p.invested, 0));
  const day = round2(open.reduce((s, p) => s + (p.dayChange ?? 0), 0));
  const realized = round2(positions.reduce((s, p) => s + p.realized, 0));
  const byKind = new Map<InvestmentKind, number>();
  for (const p of open) byKind.set(p.kind, (byKind.get(p.kind) ?? 0) + p.value);
  const allocation = [...byKind].map(([kind, v]) => ({ kind, value: round2(v), pct: value > 0 ? (v / value) * 100 : 0 })).sort((a, b) => b.value - a.value);
  return { value, invested, profit: round2(value - invested), profitPct: invested > 0 ? ((value - invested) / invested) * 100 : null, day, realized, allocation, count: open.length };
}

/** Tipo provável pelo código (quando não está nas cotações). */
export function guessKind(ticker: string, assets: Asset[] = []): InvestmentKind {
  const t = key(ticker);
  const a = assets.find((x) => x.ticker === t);
  if (a) return a.type === 'acao' ? 'acao' : a.type;
  if (/^[A-Z]{4}11$/.test(t)) return 'fii';
  if (/^[A-Z]{4}3[2-5]$/.test(t)) return 'bdr';
  if (/^[A-Z]{4}\d{1,2}$/.test(t)) return 'acao';
  if (/^[A-Z]{2,6}$/.test(t)) return 'cripto';
  return 'outro';
}

// ---------------------------------------------------------------------------
// Exportar (CSV que o próprio Giro importa de volta)
// ---------------------------------------------------------------------------
const cell = (v: string | number) => { const s = String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const br = (n: number, d = 2) => n.toFixed(d).replace('.', ',');

export function opsToCSV(ops: InvestmentOp[]) {
  const head = 'data;operacao;ativo;tipo;quantidade;preco;taxas;observacao';
  const rows = [...ops].sort((a, b) => a.date.localeCompare(b.date)).map((o) => [o.date, o.side, o.ticker, o.kind, br(o.quantity, 8).replace(/,?0+$/, '') || '0', br(o.price), br(o.fees ?? 0), o.note ?? ''].map(cell).join(';'));
  return [head, ...rows].join('\n');
}

export function positionsToCSV(positions: Position[]) {
  const head = 'ativo;tipo;quantidade;preco_medio;investido;preco_atual;valor_atual;resultado;resultado_pct';
  const rows = positions.filter((p) => p.quantity > 0 || p.value > 0).map((p) => [p.ticker, KIND_LABEL[p.kind], br(p.quantity, 8).replace(/,?0+$/, '') || '0', br(p.avgPrice), br(p.invested), p.price != null ? br(p.price) : '', br(p.value), br(p.profit), p.profitPct != null ? br(p.profitPct) : ''].map(cell).join(';'));
  return [head, ...rows].join('\n');
}
