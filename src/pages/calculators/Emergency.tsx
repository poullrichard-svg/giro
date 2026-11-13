import { useMemo, useState } from 'react';
import { Card, Field, MoneyInput, Progress, Segmented } from '../../components/ui';
import { useData } from '../../data/DataProvider';
import { formatBRL } from '../../lib/format';
import { monthsToTarget } from '../../lib/finance';
import { Big, CalcLayout, RateField, Tip, toMonthly } from './common';

const PROFILES = { clt: { label: 'CLT / servidor', months: 6 }, autonomo: { label: 'Autônomo / app', months: 12 }, empresario: { label: 'Empresário', months: 12 } };

export default function Emergency() {
  const { data } = useData();
  const fixedExp = data.fixed.filter((f) => f.type === 'expense').reduce((s, f) => s + f.amount, 0);
  const [profile, setProfile] = useState<keyof typeof PROFILES>('autonomo');
  const [cost, setCost] = useState(fixedExp || 3000);
  const [saved, setSaved] = useState(0);
  const [monthly, setMonthly] = useState(500);
  const [rate, setRate] = useState(14);
  const [period, setPeriod] = useState<'mes' | 'ano'>('ano');
  const target = cost * PROFILES[profile].months;
  const months = useMemo(() => monthsToTarget(saved, monthly, toMonthly(rate, period), target), [saved, monthly, rate, period, target]);

  return (
    <CalcLayout
      inputs={<>
        <Field label="Seu perfil"><Segmented value={profile} onChange={setProfile} options={Object.entries(PROFILES).map(([value, p]) => ({ value: value as keyof typeof PROFILES, label: p.label }))} /></Field>
        <Field label="Custo de vida mensal" hint={fixedExp > 0 ? `Suas contas fixas somam ${formatBRL(fixedExp)}` : undefined}><MoneyInput value={cost} onChange={setCost} /></Field>
        <Field label="Quanto já tem guardado"><MoneyInput value={saved} onChange={setSaved} /></Field>
        <Field label="Quanto consegue guardar por mês"><MoneyInput value={monthly} onChange={setMonthly} /></Field>
        <RateField label="Rendimento da reserva" value={rate} onChange={setRate} period={period} onPeriod={setPeriod} />
      </>}
      result={<>
        <div className="grid gap-3 sm:grid-cols-2">
          <Big label="Reserva ideal" value={formatBRL(target)} tone="text-emerald-400" sub={`${PROFILES[profile].months} meses de custo de vida`} />
          <Big label="Tempo para completar" value={saved >= target ? 'Completa! 🎉' : months == null ? '—' : `${months} meses`} sub={saved < target ? `faltam ${formatBRL(target - saved)}` : undefined} />
        </div>
        <Card title="Progresso"><Progress value={(saved / target) * 100} /><p className="mt-2 text-xs text-slate-500">{((saved / target) * 100).toFixed(0)}% da reserva</p></Card>
        <Tip>Para motorista de app, a reserva cobre também o carro parado (oficina, batida, conta bloqueada). Deixe em algo com liquidez diária e baixo risco: Tesouro Selic, CDB 100% CDI com liquidez diária ou conta remunerada.</Tip>
      </>}
    />
  );
}
