import { useMemo, useState } from 'react';
import { Field, MoneyInput, Segmented } from '../../components/ui';
import { formatBRL, formatNumber, formatPercent } from '../../lib/format';
import { dividendPlan, monthsToTarget } from '../../lib/finance';
import { Big, CalcLayout, Tip, bindState, monthsFromNow } from './common';

export default function Dividends() {
  const [kind, setKind] = useState<'fii' | 'acao'>('fii');
  const [price, setPrice] = useState(100);
  const [dividend, setDividend] = useState(0.85);
  const [target, setTarget] = useState(3000);
  const [have, setHave] = useState(0);
  const [monthly, setMonthly] = useState(1000);
  const perMonth = kind === 'fii' ? dividend : dividend / 12;
  const r = useMemo(() => dividendPlan(price, perMonth, target), [price, perMonth, target]);
  const months = useMemo(() => (r ? monthsToTarget(have, monthly, r.monthlyYield, r.capitalForTarget) : null), [r, have, monthly]);

  return (
    <CalcLayout
      sim={{ calc: 'dividendos', label: 'Viver de dividendos', ...bindState({ kind: [kind, setKind], price: [price, setPrice], dividend: [dividend, setDividend], target: [target, setTarget], have: [have, setHave], monthly: [monthly, setMonthly] }), summary: r ? `Renda de ${formatBRL(target)}/mês com ${kind === 'fii' ? 'FII' : 'ação'} a ${formatBRL(price)}\nPrecisa de ${formatBRL(r.capitalForTarget)} · número mágico ${r.magicNumber}` : 'Sem dados', goal: r ? { description: `Renda de ${formatBRL(target)}/mês em dividendos`, target: r.capitalForTarget, current: have, deadline: months ? monthsFromNow(months) : null } : null }}
      inputs={<>
        <Segmented value={kind} onChange={(k) => { setKind(k); setDividend(k === 'fii' ? 0.85 : 4.2); }} options={[{ value: 'fii', label: 'FII (mensal)' }, { value: 'acao', label: 'Ação (anual)' }]} />
        <Field label={kind === 'fii' ? 'Preço da cota' : 'Preço da ação'}><MoneyInput value={price} onChange={setPrice} /></Field>
        <Field label={kind === 'fii' ? 'Rendimento por cota (mês)' : 'Dividendos por ação (12 meses)'}><MoneyInput value={dividend} onChange={setDividend} /></Field>
        <Field label="Renda mensal que você quer"><MoneyInput value={target} onChange={setTarget} /></Field>
        <Field label="Quanto já tem investido"><MoneyInput value={have} onChange={setHave} /></Field>
        <Field label="Quanto consegue aportar por mês"><MoneyInput value={monthly} onChange={setMonthly} /></Field>
      </>}
      result={r ? <>
        <div className="grid gap-3 sm:grid-cols-2">
          <Big label="Número mágico" value={`${formatNumber(r.magicNumber)} ${kind === 'fii' ? 'cotas' : 'ações'}`} tone="text-emerald-400" sub={`${formatBRL(r.magicCapital)} — a partir daqui os rendimentos compram 1 ${kind === 'fii' ? 'cota' : 'ação'} nova por mês sozinhos`} />
          <Big label={`Para receber ${formatBRL(target)}/mês`} value={formatBRL(r.capitalForTarget)} tone="text-amber-400" sub={`${formatNumber(r.sharesForTarget)} ${kind === 'fii' ? 'cotas' : 'ações'}`} />
          <Big label="Dividend yield" value={formatPercent(r.annualYield * 100)} sub={`${formatPercent(r.monthlyYield * 100)} ao mês`} />
          <Big label="Tempo até a meta" value={have >= r.capitalForTarget ? 'Já chegou! 🎉' : months == null ? 'Mais de 100 anos' : `${Math.floor(months / 12)}a ${months % 12}m`} tone="text-sky-400" sub="aportando todo mês e reinvestindo os rendimentos" />
        </div>
        <Tip>Rendimentos passados não garantem os futuros: confira a média de 12 meses, não só o último pagamento. Rendimentos de FIIs são isentos de IR para pessoa física (com condições). Desde 2026, dividendos acima de R$ 50 mil por mês de uma mesma empresa têm retenção de 10%; abaixo disso seguem isentos — confira as regras vigentes. Diversifique entre vários ativos.</Tip>
      </> : <Tip>Informe o preço e o rendimento por cota/ação.</Tip>}
    />
  );
}
