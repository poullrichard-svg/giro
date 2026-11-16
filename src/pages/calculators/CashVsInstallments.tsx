import { useMemo, useState } from 'react';
import { Field, MoneyInput, NumberInput, Segmented } from '../../components/ui';
import { formatBRL, formatPercent } from '../../lib/format';
import { cashVsInstallments, monthlyToAnnual } from '../../lib/finance';
import { Big, CalcLayout, RateField, Tip, Verdict, toMonthly } from './common';

export default function CashVsInstallments() {
  const [cash, setCash] = useState(1800);
  const [inst, setInst] = useState(200);
  const [count, setCount] = useState(10);
  const [firstNow, setFirstNow] = useState(false);
  const [rate, setRate] = useState(14);
  const [period, setPeriod] = useState<'mes' | 'ano'>('ano');
  const r = useMemo(() => cashVsInstallments({ cashPrice: cash, installment: inst, count, firstNow, investMonthlyRate: toMonthly(rate, period) }), [cash, inst, count, firstNow, rate, period]);

  return (
    <CalcLayout
      inputs={<>
        <Field label="Preço à vista (com desconto)"><MoneyInput value={cash} onChange={setCash} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Parcela"><MoneyInput value={inst} onChange={setInst} /></Field>
          <Field label="Nº de parcelas"><NumberInput value={count} onChange={(v) => setCount(Math.max(1, Math.round(v)))} suffix="x" /></Field>
        </div>
        <Field label="Primeira parcela"><Segmented value={firstNow ? 'ato' : 'mes'} onChange={(v) => setFirstNow(v === 'ato')} options={[{ value: 'mes', label: 'daqui a 1 mês' }, { value: 'ato', label: 'no ato' }]} /></Field>
        <RateField label="Quanto seu dinheiro rende" value={rate} onChange={setRate} period={period} onPeriod={setPeriod} />
      </>}
      result={<>
        <Verdict tone={r.better === 'avista' ? 'good' : 'info'} title={r.better === 'avista' ? 'Compensa pagar à vista' : 'Compensa parcelar e investir'}>
          Vantagem de {formatBRL(r.advantage)} em dinheiro de hoje.
        </Verdict>
        <div className="grid gap-3 sm:grid-cols-3">
          <Big label="Total parcelado" value={formatBRL(r.total)} sub={`${count}x de ${formatBRL(inst)}`} />
          <Big label="Desconto à vista" value={formatPercent(r.discountPct * 100, 1)} tone="text-emerald-400" />
          <Big label="Juros embutidos" value={r.hiddenMonthlyRate > 0 ? `${formatPercent(r.hiddenMonthlyRate * 100)} a.m.` : 'Sem juros'} tone={r.hiddenMonthlyRate > 0 ? 'text-rose-400' : 'text-sky-400'} sub={r.hiddenMonthlyRate > 0 ? `${formatPercent(monthlyToAnnual(r.hiddenMonthlyRate) * 100, 1)} ao ano` : undefined} />
        </div>
        <Tip>A conta traz cada parcela para o valor de hoje, considerando o que seu dinheiro renderia investido. Se o desconto à vista for maior que o rendimento no período, pague à vista. Só vale parcelar se você realmente deixar o dinheiro investido — e sem comprometer o orçamento dos próximos meses.</Tip>
      </>}
    />
  );
}
