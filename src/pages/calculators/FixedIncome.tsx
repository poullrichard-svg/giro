import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Card, Field, IconButton, Input, MoneyInput, NumberInput, cx } from '../../components/ui';
import { formatBRL, formatPercent } from '../../lib/format';
import { fixedIncomeComparison } from '../../lib/finance';
import { CalcLayout, TermField, Tip, toMonths, bindState, useRates, useRateSync, RatesBar } from './common';

export default function FixedIncome() {
  const [amount, setAmount] = useState(10000);
  const [term, setTerm] = useState(2);
  const [unit, setUnit] = useState<'meses' | 'anos'>('anos');
  const [cdi, setCdi] = useState(14.9);
  const [selic, setSelic] = useState(15);
  const rt = useRates();
  const markRates = useRateSync(() => { setCdi(rt.rates.cdi); setSelic(rt.rates.selic); }, [rt.rates.cdi, rt.rates.selic]);
  const setCdiU = (v: number) => { markRates(); setCdi(v); };
  const setSelicU = (v: number) => { markRates(); setSelic(v); };
  const [tr, setTr] = useState(0.17);
  const [products, setProducts] = useState([
    { name: 'CDB 100% CDI', pct: 100, taxFree: false },
    { name: 'CDB 110% CDI', pct: 110, taxFree: false },
    { name: 'LCI/LCA 90% CDI', pct: 90, taxFree: true },
    { name: 'Tesouro Selic', pct: 100, taxFree: false },
  ]);
  const months = toMonths(term, unit);
  const r = useMemo(() => fixedIncomeComparison({ amount, months, cdiAnnual: cdi / 100, selicAnnual: selic / 100, trMonthly: tr / 100, products: products.map((p) => ({ name: p.name, pctCdi: p.pct / 100, taxFree: p.taxFree })) }), [amount, months, cdi, selic, tr, products]);
  const best = r.results[0]?.net || 1;

  return (
    <CalcLayout
      sim={{ calc: 'rendimento', label: 'Renda fixa', ...bindState({ amount: [amount, setAmount], term: [term, setTerm], unit: [unit, setUnit], cdi: [cdi, setCdiU], selic: [selic, setSelicU], tr: [tr, setTr], products: [products, setProducts] }), summary: `${formatBRL(amount)} por ${months} meses (CDI ${cdi}%)\nMelhor: ${r.results[0]?.name} → ${formatBRL(r.results[0]?.final ?? 0)}`, goal: null }}
      inputs={<>
        <RatesBar r={rt} />
        <Field label="Valor investido"><MoneyInput value={amount} onChange={setAmount} /></Field>
        <TermField value={term} onChange={setTerm} unit={unit} onUnit={setUnit} />
        <div className="grid grid-cols-3 gap-2">
          <Field label="CDI a.a."><NumberInput value={cdi} onChange={setCdiU} suffix="%" /></Field>
          <Field label="Selic a.a."><NumberInput value={selic} onChange={setSelicU} suffix="%" /></Field>
          <Field label="TR a.m."><NumberInput value={tr} onChange={setTr} suffix="%" /></Field>
        </div>
        <p className="text-[11px] text-slate-500">CDI e Selic vêm do Banco Central; a TR você ajusta à mão.</p>
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-400">Investimentos para comparar</p>
          {products.map((p, i) => (
            <div key={i} className="grid grid-cols-[1fr_80px_auto_auto] items-center gap-2">
              <Input value={p.name} onChange={(e) => setProducts(products.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <NumberInput value={p.pct} onChange={(v) => setProducts(products.map((x, j) => (j === i ? { ...x, pct: v } : x)))} suffix="%" />
              <label className="flex items-center gap-1 text-[11px] text-slate-400"><input type="checkbox" className="accent-brand-500" checked={p.taxFree} onChange={(e) => setProducts(products.map((x, j) => (j === i ? { ...x, taxFree: e.target.checked } : x)))} />isento</label>
              <IconButton label="Remover" onClick={() => setProducts(products.filter((_, j) => j !== i))}><X size={16} /></IconButton>
            </div>
          ))}
          <button className="flex items-center gap-1 text-xs text-brand-400" onClick={() => setProducts([...products, { name: 'Novo', pct: 100, taxFree: false }])}><Plus size={14} /> adicionar</button>
        </div>
      </>}
      result={<>
        <Card title={`Resultado em ${months} meses · IR de ${formatPercent(r.irPct * 100, 1)} para quem paga`}>
          <ul className="space-y-3">
            {r.results.map((x, i) => (
              <li key={x.name}>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className={cx('text-sm', i === 0 ? 'font-semibold text-emerald-400' : 'text-slate-300')}>{i === 0 && '🏆 '}{x.name}</span>
                  <span className="text-sm font-semibold text-white">{formatBRL(x.final)}</span>
                </div>
                <div className="h-2 rounded-full bg-white/5"><div className={cx('h-full rounded-full', i === 0 ? 'bg-emerald-500' : 'bg-slate-500')} style={{ width: `${Math.max(2, (x.net / best) * 100)}%` }} /></div>
                <p className="mt-1 text-[11px] text-slate-500">Rende {formatBRL(x.net)} líquido{x.ir > 0 ? ` (bruto ${formatBRL(x.gross)}, IR ${formatBRL(x.ir)})` : ' (isento)'}</p>
              </li>
            ))}
          </ul>
        </Card>
        <Tip>O IR na renda fixa é regressivo: 22,5% até 180 dias, 20% até 360, 17,5% até 720 e 15% acima disso — cobrado só sobre o rendimento. LCI/LCA, CRI/CRA e poupança são isentos para pessoa física. Tesouro Selic tem taxa de custódia da B3 (0,2% a.a. acima de R$ 10 mil), não incluída aqui.</Tip>
      </>}
    />
  );
}
