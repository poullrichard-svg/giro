import { describe, expect, it } from 'vitest';
import { hasErrors, isValidDate, rules, validate } from './validate';

describe('validação', () => {
  it('datas', () => {
    expect(isValidDate('2026-02-28')).toBe(true);
    expect(isValidDate('2026-02-31')).toBe(false);
    expect(isValidDate('')).toBe(false);
    expect(isValidDate('0026-01-01')).toBe(false);
  });
  it('regras e primeiro erro por campo', () => {
    const e = validate({
      name: [rules.required('  ', 'Nome')],
      amount: [rules.positive(0, 'Valor')],
      day: [rules.dayOfMonth(32, 'Dia do vencimento')],
      ok: [rules.required('x', 'X'), rules.positive(1, 'Y')],
      hours: [rules.time('25:00', 'Horas')],
    });
    expect(e).toEqual({ name: 'Nome é obrigatório', amount: 'Valor deve ser maior que zero', day: 'Dia do vencimento deve ser entre 1 e 31', hours: 'Horas inválido' });
    expect(hasErrors(validate({ a: [null, false] }))).toBe(false);
  });
});
