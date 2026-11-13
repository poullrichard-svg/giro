export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const formatBRL = (v: number | null | undefined) => brl.format(Number.isFinite(Number(v)) ? Number(v) : 0);

export const formatNumber = (v: number, digits = 0) =>
  (Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const formatPercent = (v: number, digits = 2) => `${formatNumber(v, digits)}%`;

/** Data local (não UTC) no formato YYYY-MM-DD. Evita o bug de "virar o dia" à noite no Brasil. */
export const localISODate = (d: Date = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const currentMonth = () => localISODate().slice(0, 7);

export const parseISODate = (s: string) => new Date(`${s}T00:00:00`);

export const addDays = (iso: string, days: number) => {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return localISODate(d);
};

export const addMonths = (month: string, offset: number) => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const monthLabel = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  const s = new Date(y, m - 1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const shortMonthLabel = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('pt-BR', { month: 'short' }).replace('.', '');
};

export const formatDate = (iso?: string | null) => (iso ? parseISODate(iso).toLocaleDateString('pt-BR') : '—');

export const formatDayLabel = (iso: string) =>
  parseISODate(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });

export const daysUntil = (iso: string, from = localISODate()) =>
  Math.round((parseISODate(iso).getTime() - parseISODate(from).getTime()) / 86_400_000);

/** "08:30" -> 8.5 */
export const hhmmToHours = (s?: string | null) => {
  if (!s) return 0;
  const [h, m] = s.split(':').map((x) => parseInt(x, 10) || 0);
  return h + m / 60;
};

export const hoursToHHMM = (hours: number) => {
  const total = Math.round(hours * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

/** Converte texto livre "1.234,56" / "1234.56" / "50" em número. */
export const parseDecimal = (s: string | number | null | undefined): number => {
  if (typeof s === 'number') return s;
  if (!s) return 0;
  let t = String(s).trim().replace(/[R$\s]/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
};

/** Dias de [start, end] que já passaram (até hoje), mínimo 1. Usado para ratear custos fixos. */
export const elapsedDays = (start: string, end: string, today = localISODate()) => {
  if (today < start) return 0;
  const last = today < end ? today : end;
  return Math.round((parseISODate(last).getTime() - parseISODate(start).getTime()) / 86_400_000) + 1;
};
