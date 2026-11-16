import { useMemo, useState } from 'react';
import { Field, MoneyInput, NumberInput } from '../../components/ui';
import { formatBRL } from '../../lib/format';
import { rentVsBuy } from '../../lib/finance';
import { Big, CalcLayout, Tip, Verdict, toMonthly } from './common';

export default function RentVsBuy() {
  const [s, setS] = useState({ price: 400000, down: 80000, loanRate: 11.5, years: 30, ownerCosts: 350, rent: 2000, rentUp: 5, invest: 10, appreciation: 5, horizon: 10 });
  const set = <K extends keyof typeof s>(k: K, v: number) => setS((x) => ({ ...x, [k]: v }));
  const r = useMemo(() => rentVsBuy({
    propertyPrice: s.price, downPayment: s.down, loanMonthlyRate: toMonthly(s.loanRate, 'ano'), loanMonths: Math.round(s.years * 12),
    monthlyCostsOwner: s.ownerCosts, rent: s.rent, rentAnnualIncrease: s.rentUp / 100, investMonthlyRate: toMonthly(s.invest, 'ano'),
    propertyAnnualAppreciation: s.appreciation / 100, horizonMonths: Math.max(1, Math.round(s.horizon * 12)),
  }), [s]);

  return (
    <CalcLayout
      inputs={<>
        <Field label="Valor do imóvel"><MoneyInput value={s.price} onChange={(v) => set('price', v)} /></Field>
        <Field label="Entrada"><MoneyInput value={s.down} onChange={(v) => set('down', v)} /></Field>
        <div className="grid grid-cols-2 items-end gap-3">
          <Field label="Juros do financiamento"><NumberInput value={s.loanRate} onChange={(v) => set('loanRate', v)} suffix="% a.a." /></Field>
          <Field label="Prazo"><NumberInput value={s.years} onChange={(v) => set('years', v)} suffix="anos" /></Field>
          <Field label="Aluguel"><MoneyInput value={s.rent} onChange={(v) => set('rent', v)} /></Field>
          <Field label="Reajuste do aluguel"><NumberInput value={s.rentUp} onChange={(v) => set('rentUp', v)} suffix="% a.a." /></Field>
          <Field label="Rendimento dos investimentos"><NumberInput value={s.invest} onChange={(v) => set('invest', v)} suffix="% a.a." /></Field>
          <Field label="Valorização do imóvel"><NumberInput value={s.appreciation} onChange={(v) => set('appreciation', v)} suffix="% a.a." /></Field>
        </div>
        <Field label="Custos de quem é dono (IPTU, manutenção)" hint="por mês"><MoneyInput value={s.ownerCosts} onChange={(v) => set('ownerCosts', v)} /></Field>
        <Field label="Comparar daqui a"><NumberInput value={s.horizon} onChange={(v) => set('horizon', v)} suffix="anos" /></Field>
      </>}
      result={<>
        <Verdict tone={r.better === 'comprar' ? 'good' : 'info'} title={r.better === 'comprar' ? 'Comprar sai na frente' : 'Alugar e investir sai na frente'}>
          Diferença de {formatBRL(r.difference)} em patrimônio depois de {s.horizon} anos.
        </Verdict>
        <div className="grid gap-3 sm:grid-cols-2">
          <Big label="Patrimônio de quem compra" value={formatBRL(r.buyerWealth)} tone={r.better === 'comprar' ? 'text-emerald-400' : 'text-white'} sub={`imóvel ${formatBRL(r.propertyValue)} − dívida ${formatBRL(r.remainingDebt)}`} />
          <Big label="Patrimônio de quem aluga" value={formatBRL(r.renterWealth)} tone={r.better === 'alugar' ? 'text-emerald-400' : 'text-white'} sub="entrada + diferença mensal investidas" />
          <Big label="1ª parcela do financiamento" value={formatBRL(r.firstInstallment)} tone="text-amber-400" sub="tabela Price, sem seguros" />
          <Big label="Aluguel pago no período" value={formatBRL(r.paidRent)} tone="text-rose-400" />
        </div>
        <Tip>Os dois cenários gastam o mesmo por mês: quem paga menos investe a diferença. A conta não inclui ITBI, escritura e seguros do financiamento (que pesam para quem compra), nem mudanças e corretagem. Use como ponto de partida — segurança e estabilidade de ter casa própria também contam.</Tip>
      </>}
    />
  );
}
