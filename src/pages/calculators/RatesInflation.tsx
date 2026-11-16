import { useMemo, useState } from 'react';
import { Field, MoneyInput, NumberInput, Segmented } from '../../components/ui';
import { formatBRL, formatPercent } from '../../lib/format';
import { convertRate, inflationAdjusted, purchasingPower, realRate } from '../../lib/finance';
import { Big, CalcLayout, Tip } from './common';

const PERIODS = { dia: 252, mes: 12, ano: 1 } as const;
type P = keyof typeof PERIODS;

export default function RatesInflation() {
  const [mode, setMode] = useState<'real' | 'converter' | 'poder'>('real');
  const [nominal, setNominal] = useState(12);
  const [ipca, setIpca] = useState(4.5);
  const [rate, setRate] = useState(1);
  const [from, setFrom] = useState<P>('mes');
  const [value, setValue] = useState(1000);
  const [years, setYears] = useState(10);
  const real = useMemo(() => realRate(nominal / 100, ipca / 100), [nominal, ipca]);
  const conv = useMemo(() => Object.fromEntries((Object.keys(PERIODS) as P[]).map((p) => [p, convertRate(rate / 100, PERIODS[from], PERIODS[p])])) as Record<P, number>, [rate, from]);

  return (
    <CalcLayout
      inputs={<>
        <Segmented value={mode} onChange={setMode} options={[{ value: 'real', label: 'Ganho real' }, { value: 'converter', label: 'Converter' }, { value: 'poder', label: 'Poder de compra' }]} />
        {mode === 'real' && <>
          <Field label="Rentabilidade do investimento"><NumberInput value={nominal} onChange={setNominal} suffix="% a.a." /></Field>
          <Field label="Inflação (IPCA)"><NumberInput value={ipca} onChange={setIpca} suffix="% a.a." /></Field>
        </>}
        {mode === 'converter' && <>
          <Field label="Taxa"><NumberInput value={rate} onChange={setRate} suffix="%" /></Field>
          <Field label="Essa taxa é por"><Segmented value={from} onChange={setFrom} options={[{ value: 'dia', label: 'dia útil' }, { value: 'mes', label: 'mês' }, { value: 'ano', label: 'ano' }]} /></Field>
        </>}
        {mode === 'poder' && <>
          <Field label="Valor"><MoneyInput value={value} onChange={setValue} /></Field>
          <Field label="Inflação média"><NumberInput value={ipca} onChange={setIpca} suffix="% a.a." /></Field>
          <Field label="Daqui a quantos anos"><NumberInput value={years} onChange={setYears} suffix="anos" /></Field>
        </>}
      </>}
      result={<>
        {mode === 'real' && <div className="grid gap-3 sm:grid-cols-2">
          <Big label="Ganho real por ano" value={formatPercent(real * 100)} tone={real >= 0 ? 'text-emerald-400' : 'text-rose-400'} sub="o quanto seu poder de compra cresce de verdade" />
          <Big label="Ganho real por mês" value={formatPercent(convertRate(real, 1, 12) * 100, 3)} />
        </div>}
        {mode === 'converter' && <div className="grid gap-3 sm:grid-cols-3">
          <Big label="Por dia útil" value={formatPercent(conv.dia * 100, 4)} />
          <Big label="Por mês" value={formatPercent(conv.mes * 100, 3)} tone="text-emerald-400" />
          <Big label="Por ano" value={formatPercent(conv.ano * 100)} tone="text-sky-400" />
        </div>}
        {mode === 'poder' && <div className="grid gap-3 sm:grid-cols-2">
          <Big label={`${formatBRL(value)} daqui a ${years} anos vai comprar`} value={formatBRL(purchasingPower(value, ipca / 100, years))} tone="text-rose-400" sub="em dinheiro de hoje" />
          <Big label="Para comprar o mesmo no futuro" value={formatBRL(inflationAdjusted(value, ipca / 100, years))} tone="text-amber-400" sub={`você vai precisar disso em ${new Date().getFullYear() + years}`} />
        </div>}
        <Tip>Juros compostos funcionam nos dois sentidos: 1% ao mês não é 12% ao ano, é 12,68%. E um investimento que rende menos que a inflação faz você perder poder de compra, mesmo com o saldo subindo. Use 252 dias úteis por ano, como o mercado.</Tip>
      </>}
    />
  );
}
