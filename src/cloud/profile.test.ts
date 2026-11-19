import { describe, expect, it } from 'vitest';
import { ageOn, firstName } from './profile';
import { validateProfile } from './ProfileForm';

const base = { full_name: 'Maria Souza', birth_date: '1990-05-20', avatar: null, monthly_income: 3500, occupation: 'motorista-app', city: null, state: 'SP', consent_stats: true };
const today = new Date(2026, 10, 19);

describe('perfil', () => {
  it('calcula a idade considerando se já fez aniversário', () => {
    expect(ageOn('1990-05-20', today)).toBe(36);
    expect(ageOn('1990-12-01', today)).toBe(35);
    expect(ageOn('2008-11-19', today)).toBe(18);
    expect(ageOn('2008-11-20', today)).toBe(17);
  });
  it('valida o perfil', () => {
    expect(validateProfile(base, false, today)).toEqual({});
    expect(validateProfile({ ...base, full_name: ' ' }, false, today).full_name).toBeTruthy();
    expect(validateProfile({ ...base, birth_date: '2010-01-01' }, false, today).birth_date).toMatch(/18 anos/);
    expect(validateProfile({ ...base, birth_date: '' }, false, today).birth_date).toBeTruthy();
    expect(validateProfile({ ...base, occupation: null }, false, today).occupation).toBeTruthy();
    expect(validateProfile({ ...base, monthly_income: null }, false, today).monthly_income).toBeTruthy();
    expect(validateProfile({ ...base, monthly_income: null }, true, today)).toEqual({});
  });
  it('primeiro nome', () => { expect(firstName(base)).toBe('Maria'); expect(firstName(null)).toBe(''); });
});
