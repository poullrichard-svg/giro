import { useMemo, useState } from 'react';
import { Card, Field, MoneyInput, NumberInput, Segmented } from '../../components/ui';
import { formatBRL, formatPercent } from '../../lib/format';
import { consorcio, loan, monthlyToAnnual } from '../../lib/finance';
import { Big, CalcLayout, Tip } from './common';

export default function Consorcio() {
  const [s, setS] = useState({ credit: 100000, months: 80, admin: 16, reserve: 2, insurance: 0.04, adjust: 4.5, bid: 0, embedded: false, finRate: 1.7 });
  const set = <K extends keyof typeof s>(k: K, v: (typeof s)[K]) => setS((x) => ({ ...x, [k]: v }));
  const r = useMemo(() => consorcio({ credit: s.credit, months: s.months, adminFeePct: s.admin / 100, reserveFundPct: s.reserve / 100, insuranceMonthlyPct: s.insurance / 100, annualAdjustmentPct: s.adjust / 100, bidPct: s.bid / 100, embeddedBid: s.embedded }), [s]);
  const fin = useMemo(() => loan(s.credit, s.finRate / 100, s.months, 'price'), [s.credit, s.finRate, s.months]);

  return (
    <CalcLayout
      inputs={<>
        <Field label="Valor da carta de crédito"><MoneyInput value={s.credit} onChange={(v) => set('credit', v)} /></Field>
        <Field label="Prazo"><NumberInput value={s.months} onChange={(v) => set('months', Math.round(v))} suffix="meses" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Taxa de administração" hint="total do plano"><NumberInput value={s.admin} onChange={(v) => set('admin', v)} suffix="%" /></Field>
          <Field label="Fundo de reserva"><NumberInput value={s.reserve} onChange={(v) => set('reserve', v)} suffix="%" /></Field>
          <Field label="Seguro prestamista" hint="% ao mês sobre a carta"><NumberInput value={s.insurance} onChange={(v) => set('insurance', v)} suffix="% a.m." /></Field>
          <Field label="Reajuste anual" hint="INCC (imóvel) / IPCA ou tabela (auto)"><NumberInput value={s.adjust} onChange={(v) => set('adjust', v)} suffix="% a.a." /></Field>
        </div>
        <Field label="Lance"><NumberInput value={s.bid} onChange={(v) => set('bid', v)} suffix="% da carta" /></Field>
        {s.bid > 0 && <Segmented value={s.embedded ? 'sim' : 'nao'} onChange={(v) => set('embedded', v === 'sim')} options={[{ value: 'nao', label: 'Lance com dinheiro próprio' }, { value: 'sim', label: 'Lance embutido' }]} />}
        <Field label="Comparar com financiamento a" hint="taxa mensal do banco"><NumberInput value={s.finRate} onChange={(v) => set('finRate', v)} suffix="% a.m." /></Field>
      </>}
      result={<>
        <div className="grid gap-3 sm:grid-cols-3">
          <Big label="Parcela inicial" value={formatBRL(r.installment)} tone="text-emerald-400" sub={s.bid > 0 ? `após lance ≈ ${formatBRL(r.installmentAfterBid)}` : `${s.months}x`} />
          <Big label="Total pago" value={formatBRL(r.totalWithAdjust)} sub={`sem reajuste: ${formatBRL(r.totalCostNoAdjust)}`} />
          <Big label="Custo do consórcio" value={formatPercent(r.effectiveFeePct * 100, 1)} tone="text-amber-400" sub={`taxas ${formatBRL(r.feesTotal)} · ≈ ${formatPercent(r.equivalentMonthlyRate * 100)} a.m.`} />
        </div>
        {s.bid > 0 && (
          <Card title="Lance">
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div><p className="text-xs text-slate-500">Valor do lance</p><p className="font-semibold">{formatBRL(r.bidValue)}</p></div>
              <div><p className="text-xs text-slate-500">Do seu bolso</p><p className="font-semibold">{formatBRL(r.ownCashForBid)}</p></div>
              <div><p className="text-xs text-slate-500">Crédito que sobra</p><p className="font-semibold text-emerald-400">{formatBRL(r.creditAvailable)}</p></div>
            </div>
          </Card>
        )}
        <Card title="Consórcio × Financiamento (mesmo valor e prazo)">
          <div className="grid grid-cols-3 gap-2 text-sm">
            <span /><span className="font-semibold text-slate-300">Consórcio</span><span className="font-semibold text-slate-300">Financiamento</span>
            <span className="text-slate-500">Parcela</span><span>{formatBRL(r.installment)}</span><span>{formatBRL(fin.firstInstallment)}</span>
            <span className="text-slate-500">Total pago</span><span>{formatBRL(r.totalWithAdjust)}</span><span>{formatBRL(fin.totalPaid)}</span>
            <span className="text-slate-500">Custo extra</span><span className="text-amber-400">{formatBRL(r.totalWithAdjust - s.credit)}</span><span className="text-rose-400">{formatBRL(fin.totalInterest)}</span>
            <span className="text-slate-500">Bem na mão</span><span>só quando contemplado</span><span>na hora</span>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            {r.totalWithAdjust < fin.totalPaid
              ? <>O consórcio sai <strong className="text-emerald-400">{formatBRL(fin.totalPaid - r.totalWithAdjust)}</strong> mais barato — vale se você pode esperar a contemplação.</>
              : <>Nesse cenário o financiamento sai mais barato em {formatBRL(r.totalWithAdjust - fin.totalPaid)}.</>}
            {' '}Financiamento a {formatPercent(s.finRate)} a.m. = {formatPercent(monthlyToAnnual(s.finRate / 100) * 100)} a.a.
          </p>
        </Card>
        <Tip>Consórcio não tem juros, mas tem taxa de administração, fundo de reserva, seguro e reajuste anual da carta (e da parcela). Você só recebe o bem quando for contemplado por sorteio ou lance — pode levar anos. Leia o contrato e verifique se a administradora é autorizada pelo Banco Central.</Tip>
      </>}
    />
  );
}
