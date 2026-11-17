import { describe, expect, it } from 'vitest';
import { splitCSV } from './csvImport';

describe('splitCSV', () => {
  it('detecta separador e respeita aspas e quebras de linha', () => {
    expect(splitCSV('﻿a;b\r\n"x; y";2\r\n')).toEqual([['a', 'b'], ['x; y', '2']]);
    expect(splitCSV('a,b\n"diz ""oi""",3')).toEqual([['a', 'b'], ['diz "oi"', '3']]);
  });
});
