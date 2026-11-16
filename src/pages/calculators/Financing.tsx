import { useMemo, useState } from 'react';
import { Card, Field, MoneyInput, Segmented } from '../../components/ui';
import { Line } from '../../components/charts';
import { formatBRL, formatPercent } from '../../lib/format';
import { loan, monthlyToAnnual } from '../../lib/finance';
import { Big, CalcLayout, RateField, TermField, Tip, toMonthly, toMonths } from './common';

interface Sim { price: number; down: number; rate: number; period: 'mes' | 'ano'; term: number; unit: 'meses' | 'anos'; extras: number; system: 'price' | 'sac' }
const PRESETS: Record<'veiculo' | 'imovel', Sim> = {
  veiculo: { price: 80000, down: 20000, rate: 1.79, period: 'mes', term: 48, unit: 'meses', extras: 0, system: 'price' },
  imovel: { price: 400000, down: 80000, rate: 11.5, period: 'ano', term: 30, unit: 'anos', extras: 120, system: 'sac' },
};

export default function Financing() {
  const [kind, setKind] = useState<'veiculo' | 'imovel'>('veiculo');
  const [s, setS] = useState<Sim>(PRESETS.veiculo);
  const [showTable, setShowTable] = useState(false);
  const set = <K extends keyof typeof s>(k: K, v: (typeof s)[K]) => setS((x) => ({ ...x, [k]: v }));

  const principal = Math.max(0, s.price - s.down);
  const n = toMonths(s.term, s.unit);
  const i = toMonthly(s.rate, s.period);
  const price = useMemo(() => loan(principal, i, n, 'price', s.extras), [principal, i, n, s.extras]);
  const sac = useMemo(() => loan(principal, i, n, 'sac', s.extras), [principal, i, n, s.extras]);
  const r = s.system === 'price' ? price : sac;

  return (
    <CalcLayout
      inputs={<>
        <Segmented value={kind} onChange={(k) => { setKind(k); setS(PRESETS[k]); }} options={[{ value: 'veiculo', label: 'Veículo' }, { value: 'imovel', label: 'Imóvel' }]} />
        <Field label={kind === 'imovel' ? 'Valor do imóvel' : 'Valor do veículo'}><MoneyInput value={s.price} onChange={(v) => set('price', v)} /></Field>
        <Field label="Entrada" hint={s.price > 0 ? `${formatPercent((s.down / s.price) * 100, 0)} do valor` : undefined}><MoneyInput value={s.down} onChange={(v) => set('down', v)} /></Field>
        <RateField value={s.rate} onChange={(v) => set('rate', v)} period={s.period} onPeriod={(p) => set('period', p)} />
        <TermField value={s.term} onChange={(v) => set('term', v)} unit={s.unit} onUnit={(u) => set('unit', u)} />
        <Field label="Seguros e taxas mensais" hint={kind === 'imovel' ? 'MIP + DFI + tarifa de administração (veja na simulação do banco)' : 'Ex.: seguro prestamista embutido'}><MoneyInput value={s.extras} onChange={(v) => set('extras', v)} /></Field>
        <Field label="Sistema de amortização" group><Segmented value={s.system} onChange={(v) => set('system', v)} options={[{ value: 'price', label: 'Price (parcela fixa)' }, { value: 'sac', label: 'SAC (decrescente)' }]} /></Field>
      </>}
      result={<>
        <div className="grid gap-3 sm:grid-cols-3">
          <Big label={s.system === 'price' ? 'Parcela' : '1ª parcela'} value={formatBRL(r.firstInstallment)} tone="text-emerald-400" sub={s.system === 'sac' ? `última: ${formatBRL(r.lastInstallment)}` : `${n}x`} />
          <Big label="Total pago" value={formatBRL(r.totalPaid + s.down)} sub={`financiado ${formatBRL(principal)} + entrada`} />
          <Big label="Juros pagos" value={formatBRL(r.totalInterest)} tone="text-rose-400" sub={`${formatPercent(principal ? (r.totalInterest / principal) * 100 : 0, 0)} do valor financiado`} />
        </div>
        <Card title="Price × SAC">
          <div className="grid grid-cols-3 gap-2 text-sm">
            <span className="text-slate-500" /> <span className="font-semibold text-slate-300">Price</span> <span className="font-semibold text-slate-300">SAC</span>
            <span className="text-slate-500">1ª parcela</span><span>{formatBRL(price.firstInstallment)}</span><span>{formatBRL(sac.firstInstallment)}</span>
            <span className="text-slate-500">Última</span><span>{formatBRL(price.lastInstallment)}</span><span>{formatBRL(sac.lastInstallment)}</span>
            <span className="text-slate-500">Juros totais</span><span className="text-rose-400">{formatBRL(price.totalInterest)}</span><span className="text-rose-400">{formatBRL(sac.totalInterest)}</span>
          </div>
          <p className="mt-3 text-xs text-slate-400">SAC economiza <strong className="text-emerald-400">{formatBRL(price.totalInterest - sac.totalInterest)}</strong> de juros, mas começa com parcela {formatBRL(sac.firstInstallment - price.firstInstallment)} maior.</p>
        </Card>
        <Card title="Saldo devedor ao longo do tempo"><Line points={r.schedule.map((x) => x.balance)} color="#f43f5e" /></Card>
        <Tip>
          Taxa equivalente: {formatPercent(i * 100)} ao mês = {formatPercent(monthlyToAnnual(i) * 100)} ao ano. Compare sempre o <strong>CET</strong> (custo efetivo total) que o banco é obrigado a informar — ele inclui tarifas e seguros.
          {kind === 'imovel' && ' No imobiliário, a TR pode corrigir o saldo; esta simulação não inclui TR.'} Amortizar com valores extras reduz muito os juros — no SAC, prefira reduzir o prazo.
        </Tip>
        <Card title="Tabela de parcelas" action={<button className="text-xs text-brand-400" onClick={() => setShowTable(!showTable)}>{showTable ? 'Ocultar' : 'Mostrar'}</button>}>
          {showTable && (
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-right text-xs">
                <thead className="sticky top-0 bg-[#13111f] text-slate-500"><tr><th className="py-2 text-left">#</th><th>Parcela</th><th>Juros</th><th>Amortização</th><th>Saldo</th></tr></thead>
                <tbody className="divide-y divide-white/5">
                  {r.schedule.map((x) => <tr key={x.month}><td className="py-1.5 text-left text-slate-500">{x.month}</td><td>{formatBRL(x.installment)}</td><td className="text-rose-400/80">{formatBRL(x.interest)}</td><td>{formatBRL(x.amortization)}</td><td className="text-slate-400">{formatBRL(x.balance)}</td></tr>)}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </>}
    />
  );
}

