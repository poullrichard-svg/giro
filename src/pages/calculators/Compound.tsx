import { useMemo, useState } from 'react';
import { Card, Field, MoneyInput, Segmented } from '../../components/ui';
import { Line } from '../../components/charts';
import { formatBRL } from '../../lib/format';
import { compound, monthsToTarget, requiredMonthly } from '../../lib/finance';
import { Big, CalcLayout, RateField, TermField, Tip, toMonthly, toMonths, bindState, monthsFromNow } from './common';

const yearsMonths = (m: number) => `${Math.floor(m / 12)} anos${m % 12 ? ` e ${m % 12} meses` : ''}`;

export default function Compound() {
  const [mode, setMode] = useState<'simular' | 'quando' | 'quanto'>('simular');
  const [initial, setInitial] = useState(1000);
  const [monthly, setMonthly] = useState(500);
  const [rate, setRate] = useState(10);
  const [period, setPeriod] = useState<'mes' | 'ano'>('ano');
  const [term, setTerm] = useState(10);
  const [unit, setUnit] = useState<'meses' | 'anos'>('anos');
  const [target, setTarget] = useState(1000000);

  const i = toMonthly(rate, period);
  const n = toMonths(term, unit);
  const sim = useMemo(() => compound(initial, monthly, i, n), [initial, monthly, i, n]);
  const when = useMemo(() => monthsToTarget(initial, monthly, i, target), [initial, monthly, i, target]);
  const need = useMemo(() => requiredMonthly(initial, i, n, target), [initial, i, n, target]);
  const whenDate = when != null ? new Date(new Date().getFullYear(), new Date().getMonth() + when, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : null;

  return (
    <CalcLayout
      sim={{ calc: 'juros', label: 'Juros compostos', ...bindState({ mode: [mode, setMode], initial: [initial, setInitial], monthly: [monthly, setMonthly], rate: [rate, setRate], period: [period, setPeriod], term: [term, setTerm], unit: [unit, setUnit], target: [target, setTarget] }), summary: mode === 'simular' ? `${formatBRL(initial)} + ${formatBRL(monthly)}/mês a ${rate}% ${period === 'ano' ? 'a.a.' : 'a.m.'} por ${n} meses\nTotal ${formatBRL(sim.final)} (juros ${formatBRL(sim.interest)})` : mode === 'quando' ? `Meta ${formatBRL(target)} guardando ${formatBRL(monthly)}/mês\n${when == null ? 'Não chega em 100 anos' : `Chega em ${when} meses`}` : `Meta ${formatBRL(target)} em ${n} meses\nGuardar ${formatBRL(need)}/mês`, goal: mode === 'simular' ? { description: 'Objetivo de investimento', target: sim.final, current: initial, deadline: monthsFromNow(n) } : { description: `Juntar ${formatBRL(target)}`, target, current: initial, deadline: mode === 'quando' ? (when ? monthsFromNow(when) : null) : monthsFromNow(n) } }}
      inputs={<>
        <Segmented value={mode} onChange={setMode} options={[{ value: 'simular', label: 'Simular' }, { value: 'quando', label: 'Quando chego?' }, { value: 'quanto', label: 'Quanto investir?' }]} />
        {mode !== 'simular' && <Field label="Meta (ex.: primeiro milhão)"><MoneyInput value={target} onChange={setTarget} /></Field>}
        <Field label="Valor inicial"><MoneyInput value={initial} onChange={setInitial} /></Field>
        {mode !== 'quanto' && <Field label="Aporte mensal"><MoneyInput value={monthly} onChange={setMonthly} /></Field>}
        <RateField label="Rentabilidade" value={rate} onChange={setRate} period={period} onPeriod={setPeriod} />
        {mode !== 'quando' && <TermField value={term} onChange={setTerm} unit={unit} onUnit={setUnit} />}
      </>}
      result={<>
        {mode === 'simular' && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Big label="Valor final" value={formatBRL(sim.final)} tone="text-emerald-400" />
              <Big label="Total investido" value={formatBRL(sim.invested)} />
              <Big label="Juros ganhos" value={formatBRL(sim.interest)} tone="text-sky-400" sub={sim.invested ? `${((sim.interest / sim.invested) * 100).toFixed(0)}% sobre o investido` : undefined} />
            </div>
            <Card title="Evolução (linha tracejada = dinheiro que você colocou)"><Line points={sim.timeline.map((x) => x.balance)} secondary={sim.timeline.map((x) => x.invested)} /></Card>
          </>
        )}
        {mode === 'quando' && (when == null
          ? <Big label="Resultado" value="Não chega em 100 anos" tone="text-rose-400" sub="Aumente o aporte ou a rentabilidade." />
          : <div className="grid gap-3 sm:grid-cols-2"><Big label="Você chega lá em" value={yearsMonths(when)} tone="text-emerald-400" sub={`por volta de ${whenDate}`} /><Big label="Total que você terá investido" value={formatBRL(initial + monthly * when)} sub={`o resto (${formatBRL(target - initial - monthly * when)}) vem dos juros`} /></div>)}
        {mode === 'quanto' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Big label="Aporte mensal necessário" value={formatBRL(need)} tone="text-emerald-400" sub={`por ${n} meses`} />
            <Big label="Total investido" value={formatBRL(initial + need * n)} sub={`juros fazem ${formatBRL(Math.max(0, target - initial - need * n))}`} />
          </div>
        )}
        <Tip>Use a rentabilidade <strong>real</strong> (descontando a inflação, ex.: 4–6% a.a.) para ver o poder de compra no futuro, ou a nominal (ex.: 100% do CDI) para ver o número “no extrato”.</Tip>
      </>}
    />
  );
}
