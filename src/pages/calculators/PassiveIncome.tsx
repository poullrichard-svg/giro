import { useMemo, useState } from 'react';
import { Field, MoneyInput } from '../../components/ui';
import { formatBRL } from '../../lib/format';
import { requiredMonthly, withdrawalPlan } from '../../lib/finance';
import { Big, CalcLayout, RateField, TermField, Tip, toMonthly, toMonths } from './common';

export default function PassiveIncome() {
  const [wanted, setWanted] = useState(5000);
  const [saved, setSaved] = useState(50000);
  const [rate, setRate] = useState(5);
  const [period, setPeriod] = useState<'mes' | 'ano'>('ano');
  const [term, setTerm] = useState(20);
  const [unit, setUnit] = useState<'meses' | 'anos'>('anos');
  const i = toMonthly(rate, period);
  const needed = i > 0 ? wanted / i : 0;
  const n = toMonths(term, unit);
  const monthly = useMemo(() => requiredMonthly(saved, i, n, needed), [saved, i, n, needed]);
  const plan = useMemo(() => withdrawalPlan(saved, wanted, i), [saved, wanted, i]);

  return (
    <CalcLayout
      inputs={<>
        <Field label="Renda mensal desejada"><MoneyInput value={wanted} onChange={setWanted} /></Field>
        <Field label="Patrimônio atual"><MoneyInput value={saved} onChange={setSaved} /></Field>
        <RateField label="Rentabilidade real (acima da inflação)" value={rate} onChange={setRate} period={period} onPeriod={setPeriod} />
        <TermField label="Em quanto tempo quer chegar" value={term} onChange={setTerm} unit={unit} onUnit={setUnit} />
      </>}
      result={<>
        <div className="grid gap-3 sm:grid-cols-2">
          <Big label="Patrimônio necessário" value={formatBRL(needed)} tone="text-emerald-400" sub="vivendo só dos rendimentos, sem gastar o principal" />
          <Big label="Aporte mensal para chegar lá" value={formatBRL(monthly)} sub={`por ${n} meses`} />
        </div>
        <Big label="Com o patrimônio de hoje" value={plan.perpetual ? 'Já dura para sempre 🎉' : `Dura ${Math.floor((plan.months ?? 0) / 12)} anos e ${(plan.months ?? 0) % 12} meses`} sub={`renda sustentável hoje: ${formatBRL(plan.sustainableWithdrawal)}/mês`} />
        <Tip>Usamos rentabilidade real para os valores já virem “em dinheiro de hoje”. Uma regra comum é a dos 4% ao ano (≈ 0,33% ao mês) de retirada segura.</Tip>
      </>}
    />
  );
}
