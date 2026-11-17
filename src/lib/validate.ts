/**
 * Validação simples e única para todos os formulários.
 * Cada regra devolve a mensagem de erro, ou null se estiver tudo certo.
 */
export type Errors<K extends string = string> = Partial<Record<K, string>>;
type Rule = string | null | undefined | false;

/** Data real no formato YYYY-MM-DD, entre 1990 e 2100 (pega 31/02, datas vazias, anos absurdos). */
export function isValidDate(s: unknown) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return y >= 1990 && y <= 2100 && dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export const rules = {
  required: (v: unknown, label: string): Rule => (!String(v ?? '').trim() ? `${label} é obrigatório` : null),
  maxLength: (v: unknown, max: number, label: string): Rule => (String(v ?? '').trim().length > max ? `${label} pode ter no máximo ${max} caracteres` : null),
  positive: (v: unknown, label: string): Rule => (!(typeof v === 'number' && Number.isFinite(v) && v > 0) ? `${label} deve ser maior que zero` : null),
  nonNegative: (v: unknown, label: string): Rule => (!(typeof v === 'number' && Number.isFinite(v) && v >= 0) ? `${label} não pode ser negativo` : null),
  max: (v: unknown, max: number, label: string): Rule => (typeof v === 'number' && v > max ? `${label} deve ser no máximo ${max.toLocaleString('pt-BR')}` : null),
  date: (v: unknown, label = 'Data'): Rule => (!isValidDate(v) ? `${label} inválida` : null),
  optionalDate: (v: unknown, label = 'Data'): Rule => (v && !isValidDate(v) ? `${label} inválida` : null),
  dayOfMonth: (v: unknown, label = 'Dia'): Rule => (!(Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 31) ? `${label} deve ser entre 1 e 31` : null),
  intBetween: (v: unknown, min: number, max: number, label: string): Rule => (!(Number.isInteger(v) && (v as number) >= min && (v as number) <= max) ? `${label} deve ser entre ${min} e ${max}` : null),
  time: (v: unknown, label = 'Horário'): Rule => (typeof v !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? `${label} inválido` : null),
};

/** Recebe { campo: [regra1, regra2...] } e devolve o primeiro erro de cada campo. */
export function validate<K extends string>(checks: Record<K, Rule[]>): Errors<K> {
  const out: Errors<K> = {};
  for (const k of Object.keys(checks) as K[]) {
    const first = checks[k].find((r) => typeof r === 'string' && r.length > 0);
    if (first) out[k] = first as string;
  }
  return out;
}

export const hasErrors = (e: Errors) => Object.keys(e).length > 0;
