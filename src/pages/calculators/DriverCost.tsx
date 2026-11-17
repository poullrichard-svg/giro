import { useEffect, useMemo, useState } from 'react';
import { Card, Field, MoneyInput, NumberInput, Segmented, Select } from '../../components/ui';
import { useData } from '../../data/DataProvider';
import { formatBRL } from '../../lib/format';
import { driverCost, type DriverCostInput } from '../../lib/finance';
import { Big, CalcLayout, Tip, bindState } from './common';

const DEFAULT: DriverCostInput = {
  ownership: 'financed', vehicleValue: 70000, installment: 1500, monthlyKm: 5000, insuranceMonthly: 300, ipvaAnnual: 2800, licensingAnnual: 160,
  depreciationAnnualPct: 0.1, tireSetCost: 1800, tireLifeKm: 40000, oilChangeCost: 250, oilIntervalKm: 10000, otherMaintenanceMonthly: 150,
  fuelPrice: 6.2, kmPerLiter: 11, desiredProfitMonthly: 5000, rentIncludesMaintenance: true,
};

export default function DriverCost() {
  const { data } = useData();
  const [s, setS] = useState(DEFAULT);
  const [vehicleId, setVehicleId] = useState('');
  const set = <K extends keyof DriverCostInput>(k: K, v: DriverCostInput[K]) => setS((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    const v = data.vehicles.find((x) => x.id === vehicleId);
    if (v) setS((x) => ({ ...x, ownership: v.ownership, installment: v.installmentValue, insuranceMonthly: v.insuranceValue, ipvaAnnual: v.ipvaValue, licensingAnnual: v.licensingValue, oilIntervalKm: v.oilIntervalKm, kmPerLiter: v.fuelConsumption }));
  }, [vehicleId, data.vehicles]);

  const r = useMemo(() => driverCost(s), [s]);
  const rented = s.ownership === 'rented';

  return (
    <CalcLayout
      sim={{ calc: 'custo-km', label: 'Custo por km', ...bindState({ s: [s, setS], vehicleId: [vehicleId, setVehicleId] }), summary: `${s.monthlyKm} km/mês · custo ${formatBRL(r.costPerKm)}/km\nCobrar no mínimo ${formatBRL(r.minRatePerKm)}/km`, goal: null }}
      inputs={<>
        {data.vehicles.length > 0 && <Field label="Preencher com meu veículo"><Select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} options={[{ value: '', label: '—' }, ...data.vehicles.map((v) => ({ value: v.id, label: `${v.name} · ${v.plate}` }))]} /></Field>}
        <Segmented value={s.ownership} onChange={(v) => set('ownership', v)} options={[{ value: 'owned', label: 'Quitado' }, { value: 'financed', label: 'Financiado' }, { value: 'rented', label: 'Alugado' }]} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Km rodados por mês"><NumberInput value={s.monthlyKm} onChange={(v) => set('monthlyKm', v)} suffix="km" /></Field>
          <Field label="Lucro desejado/mês"><MoneyInput value={s.desiredProfitMonthly} onChange={(v) => set('desiredProfitMonthly', v)} /></Field>
          <Field label="Preço combustível"><MoneyInput value={s.fuelPrice} onChange={(v) => set('fuelPrice', v)} /></Field>
          <Field label="Consumo"><NumberInput value={s.kmPerLiter} onChange={(v) => set('kmPerLiter', v)} suffix="km/l" /></Field>
          {s.ownership !== 'owned' && <Field label={rented ? 'Aluguel mensal' : 'Parcela'}><MoneyInput value={s.installment} onChange={(v) => set('installment', v)} /></Field>}
          {!rented && <>
            <Field label="Valor do carro"><MoneyInput value={s.vehicleValue} onChange={(v) => set('vehicleValue', v)} /></Field>
            <Field label="Depreciação a.a."><NumberInput value={s.depreciationAnnualPct * 100} onChange={(v) => set('depreciationAnnualPct', v / 100)} suffix="%" /></Field>
            <Field label="Seguro mensal"><MoneyInput value={s.insuranceMonthly} onChange={(v) => set('insuranceMonthly', v)} /></Field>
            <Field label="IPVA anual"><MoneyInput value={s.ipvaAnnual} onChange={(v) => set('ipvaAnnual', v)} /></Field>
            <Field label="Licenciamento"><MoneyInput value={s.licensingAnnual} onChange={(v) => set('licensingAnnual', v)} /></Field>
          </>}
        </div>
        {rented && <label className="flex items-center gap-3 text-sm text-slate-300"><input type="checkbox" className="h-5 w-5 accent-brand-500" checked={s.rentIncludesMaintenance} onChange={(e) => set('rentIncludesMaintenance', e.target.checked)} /> Aluguel inclui manutenção</label>}
        {!(rented && s.rentIncludesMaintenance) && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Jogo de pneus"><MoneyInput value={s.tireSetCost} onChange={(v) => set('tireSetCost', v)} /></Field>
            <Field label="Duração pneus"><NumberInput value={s.tireLifeKm} onChange={(v) => set('tireLifeKm', v)} suffix="km" /></Field>
            <Field label="Troca de óleo"><MoneyInput value={s.oilChangeCost} onChange={(v) => set('oilChangeCost', v)} /></Field>
            <Field label="A cada"><NumberInput value={s.oilIntervalKm} onChange={(v) => set('oilIntervalKm', v)} suffix="km" /></Field>
            <Field label="Outras manutenções/mês" className="col-span-2"><MoneyInput value={s.otherMaintenanceMonthly} onChange={(v) => set('otherMaintenanceMonthly', v)} /></Field>
          </div>
        )}
      </>}
      result={<>
        <div className="grid gap-3 sm:grid-cols-3">
          <Big label="Custo por km" value={formatBRL(r.costPerKm)} tone="text-rose-400" sub="tudo incluso" />
          <Big label="Cobre no mínimo" value={`${formatBRL(r.minRatePerKm)}/km`} tone="text-emerald-400" sub="para ter o lucro desejado" />
          <Big label="Faturamento necessário" value={formatBRL(r.revenueNeeded)} sub={`${formatBRL(r.revenueNeeded / 26)}/dia (26 dias)`} />
        </div>
        <Card title={`Custo mensal: ${formatBRL(r.monthlyCost)}`}>
          <ul className="space-y-2">
            {r.items.filter((x) => x.value > 0).sort((a, b) => b.value - a.value).map((x) => (
              <li key={x.label}>
                <div className="mb-1 flex justify-between text-sm"><span className="text-slate-300">{x.label}</span><span>{formatBRL(x.value)} <span className="text-xs text-slate-500">({formatBRL(x.value / Math.max(1, s.monthlyKm))}/km)</span></span></div>
                <div className="h-1.5 rounded-full bg-white/5"><div className="h-full rounded-full bg-rose-500/70" style={{ width: `${(x.value / r.monthlyCost) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </Card>
        <Tip>Antes de aceitar uma corrida, divida o valor pelos km totais (buscar + levar). Se der menos que {formatBRL(r.minRatePerKm)}/km, você está trabalhando abaixo da sua meta. A depreciação não sai do bolso todo mês, mas é dinheiro que o carro perde — guarde para a troca.</Tip>
      </>}
    />
  );
}
