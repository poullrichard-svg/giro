import { useMemo, useState } from 'react';
import { Field, MoneyInput, NumberInput } from '../../components/ui';
import { formatBRL, formatPercent } from '../../lib/format';
import { bazinCeiling, grahamFairPrice, safetyMargin } from '../../lib/finance';
import { Big, CalcLayout, Tip, Verdict, bindState } from './common';

export default function Valuation() {
  const [price, setPrice] = useState(28);
  const [dpa, setDpa] = useState(2.1);
  const [minYield, setMinYield] = useState(6);
  const [lpa, setLpa] = useState(3.5);
  const [vpa, setVpa] = useState(22);
  const teto = useMemo(() => bazinCeiling(dpa, minYield / 100), [dpa, minYield]);
  const justo = useMemo(() => grahamFairPrice(lpa, vpa), [lpa, vpa]);
  const mBazin = safetyMargin(teto, price);
  const mGraham = justo ? safetyMargin(justo, price) : null;
  const dy = price > 0 ? dpa / price : 0;
  const cheap = mBazin > 0 && (mGraham == null || mGraham > 0);

  return (
    <CalcLayout
      sim={{ calc: 'preco-teto', label: 'Preço teto e preço justo', ...bindState({ price: [price, setPrice], dpa: [dpa, setDpa], minYield: [minYield, setMinYield], lpa: [lpa, setLpa], vpa: [vpa, setVpa] }), summary: `Preço ${formatBRL(price)} · teto Bazin ${formatBRL(teto)}${justo ? ` · justo Graham ${formatBRL(justo)}` : ''}\nDividend yield ${formatPercent(dy * 100)}`, goal: null }}
      inputs={<>
        <Field label="Preço atual da ação"><MoneyInput value={price} onChange={setPrice} /></Field>
        <Field label="Dividendos por ação (últimos 12 meses)" hint="DPA — some os proventos pagos no ano"><MoneyInput value={dpa} onChange={setDpa} /></Field>
        <Field label="Rendimento mínimo que você aceita"><NumberInput value={minYield} onChange={setMinYield} suffix="% a.a." /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="LPA" hint="lucro por ação"><MoneyInput value={lpa} onChange={setLpa} /></Field>
          <Field label="VPA" hint="valor patrimonial por ação"><MoneyInput value={vpa} onChange={setVpa} /></Field>
        </div>
      </>}
      result={<>
        <Verdict tone={cheap ? 'good' : mBazin > -0.1 ? 'warn' : 'bad'} title={cheap ? 'Abaixo dos preços de referência' : 'Acima de pelo menos um preço de referência'}>
          Dividend yield atual: {formatPercent(dy * 100)} ao ano.
        </Verdict>
        <div className="grid gap-3 sm:grid-cols-2">
          <Big label="Preço teto (Bazin)" value={formatBRL(teto)} tone={mBazin >= 0 ? 'text-emerald-400' : 'text-rose-400'} sub={`margem de segurança ${formatPercent(mBazin * 100, 1)}`} />
          <Big label="Preço justo (Graham)" value={justo ? formatBRL(justo) : '—'} tone={mGraham != null && mGraham >= 0 ? 'text-emerald-400' : 'text-rose-400'} sub={mGraham != null ? `margem de segurança ${formatPercent(mGraham * 100, 1)}` : 'precisa de LPA e VPA positivos'} />
        </div>
        <Tip><strong>Bazin:</strong> preço máximo para receber pelo menos {minYield}% ao ano em dividendos. <strong>Graham:</strong> √(22,5 × LPA × VPA), pensado para empresas estáveis e lucrativas. São referências rápidas, não recomendação de compra — olhe também dívida, crescimento e qualidade da empresa.</Tip>
      </>}
    />
  );
}
