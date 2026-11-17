import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button, Field, IconButton, MoneyInput, NumberInput } from '../../components/ui';
import { formatBRL, formatNumber, formatPercent } from '../../lib/format';
import { averagePrice, type Lot } from '../../lib/finance';
import { Big, CalcLayout, Tip, bindState } from './common';

export default function AveragePrice() {
  const [lots, setLots] = useState<Lot[]>([{ qty: 100, price: 25, fees: 0 }, { qty: 50, price: 22, fees: 0 }]);
  const [current, setCurrent] = useState(24);
  const r = useMemo(() => averagePrice(lots), [lots]);
  const value = r.qty * current;
  const gain = value - r.cost;
  const set = (i: number, patch: Partial<Lot>) => setLots(lots.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  return (
    <CalcLayout
      sim={{ calc: 'preco-medio', label: 'Preço médio', ...bindState({ lots: [lots, setLots], current: [current, setCurrent] }), summary: `${formatNumber(r.qty)} unidades · preço médio ${formatBRL(r.average)}\nInvestido ${formatBRL(r.cost)}`, goal: null }}
      inputs={<>
        <p className="label text-slate-500">Suas compras</p>
        <div className="space-y-2.5">
          {lots.map((l, i) => (
            <div key={i} className="surface grid grid-cols-[1fr_1.2fr_1fr_auto] items-end gap-2 rounded-2xl p-2.5">
              <Field label="Qtd."><NumberInput value={l.qty} onChange={(v) => set(i, { qty: v })} /></Field>
              <Field label="Preço"><MoneyInput value={l.price} onChange={(v) => set(i, { price: v })} /></Field>
              <Field label="Taxas"><MoneyInput value={l.fees ?? 0} onChange={(v) => set(i, { fees: v })} /></Field>
              <IconButton label="Remover compra" onClick={() => setLots(lots.filter((_, j) => j !== i))}><X size={16} /></IconButton>
            </div>
          ))}
        </div>
        <Button variant="soft" className="w-full" onClick={() => setLots([...lots, { qty: 0, price: 0, fees: 0 }])}><Plus size={16} /> Adicionar compra</Button>
        <Field label="Cotação atual"><MoneyInput value={current} onChange={setCurrent} /></Field>
      </>}
      result={<>
        <div className="grid gap-3 sm:grid-cols-2">
          <Big label="Preço médio" value={formatBRL(r.average)} tone="text-emerald-400" sub={`${formatNumber(r.qty)} unidades`} />
          <Big label="Total investido" value={formatBRL(r.cost)} sub="incluindo taxas" />
          <Big label="Valor hoje" value={formatBRL(value)} tone="text-sky-400" />
          <Big label={gain >= 0 ? 'Lucro' : 'Prejuízo'} value={formatBRL(Math.abs(gain))} tone={gain >= 0 ? 'text-emerald-400' : 'text-rose-400'} sub={r.cost > 0 ? formatPercent((gain / r.cost) * 100, 1) : undefined} />
        </div>
        <Tip>O preço médio é o que vale para calcular o imposto na venda. Vendas de ações até R$ 20 mil no mês são isentas (swing trade); acima disso, 15% sobre o lucro, pago via DARF. FIIs pagam 20% sobre o lucro na venda, sem isenção. Confira as regras vigentes.</Tip>
      </>}
    />
  );
}
