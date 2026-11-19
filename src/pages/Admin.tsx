import { useEffect, useState } from 'react';
import { BarChart3, Briefcase, Car, Cake, Lock, MapPin, ShieldCheck, Users, Wallet } from 'lucide-react';
import { useCloud } from '../cloud/CloudProvider';
import { fetchAdminOverview, occupationLabel, type AdminOverview } from '../cloud/profile';
import { Card, Empty, PageHeader, PeriodNav } from '../components/ui';
import { addMonths, currentMonth, formatBRL, monthLabel } from '../lib/format';

function Kpi({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="surface rounded-[1.5rem] p-4">
      <p className="label text-slate-500">{label}</p>
      <p className="mt-1 break-words font-display text-lg font-black leading-tight text-white md:text-2xl">{value}</p>
      {sub && <p className="text-[11px] font-medium text-slate-500">{sub}</p>}
    </div>
  );
}

function BarList({ rows, format = (v: number) => String(v) }: { rows: Array<{ label: string; value: number; extra?: string }>; format?: (v: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="py-6 text-center text-xs text-slate-500">Ainda não há grupos com pessoas suficientes.</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex justify-between gap-3 text-sm"><span className="truncate font-semibold text-slate-200">{r.label}</span><span className="shrink-0 font-mono text-xs font-bold text-white">{format(r.value)}{r.extra ? <span className="ml-2 text-slate-500">{r.extra}</span> : null}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[.06]"><div className="fill-x h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-300" style={{ width: `${(r.value / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

export default function Admin() {
  const { isAdmin } = useCloud();
  const [month, setMonth] = useState(() => addMonths(currentMonth(), -1));
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    setError(null);
    fetchAdminOverview(month).then((d) => alive && setData(d)).catch((e) => alive && setError(/schema cache|does not exist/i.test(String(e?.message)) ? 'Rode o arquivo supabase/02_perfil.sql no Supabase.' : 'Não foi possível carregar os números.'));
    return () => { alive = false; };
  }, [month, isAdmin]);

  if (!isAdmin) return <Empty icon={<Lock size={24} />} title="Área restrita" text="Só administradores do Giro podem ver este painel." />;

  return (
    <div>
      <PageHeader eyebrow="Administrador" title="Painel do Giro" subtitle="Médias de quem aceitou participar das estatísticas" />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <PeriodNav label={monthLabel(month)} onPrev={() => setMonth(addMonths(month, -1))} onNext={() => setMonth(addMonths(month, 1))} />
      </div>
      {error && <p role="alert" className="mb-4 rounded-2xl bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300">{error}</p>}
      {!data ? <p className="label py-16 text-center text-slate-500">Carregando…</p> : (
        <div className="space-y-4">
          <div className="stagger grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Usuários" value={data.usuarios} sub={`${data.novos_30_dias} novos em 30 dias`} />
            <Kpi label="Com perfil" value={data.com_perfil} />
            <Kpi label="Participam das estatísticas" value={data.participam_estatisticas} />
            <Kpi label="Ativos no mês" value={data.usuarios_ativos_no_mes} sub="com lançamentos no mês" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title={<span className="flex items-center gap-2"><Wallet size={15} /> Renda declarada</span>}>
              {data.renda ? (
                <div className="grid grid-cols-2 gap-3">
                  <Kpi label="Média" value={formatBRL(data.renda.media)} sub={`${data.renda.n} pessoas informaram`} />
                  <Kpi label="Mediana" value={formatBRL(data.renda.mediana)} sub="metade ganha menos que isso" />
                </div>
              ) : <p className="py-6 text-center text-xs text-slate-500">Menos de {data.grupo_minimo} pessoas informaram a renda.</p>}
            </Card>
            <Card title={<span className="flex items-center gap-2"><BarChart3 size={15} /> Mês médio de um usuário</span>}>
              {data.mes_medio ? (
                <div className="grid grid-cols-2 gap-3">
                  <Kpi label="Entradas" value={formatBRL(data.mes_medio.entradas)} />
                  <Kpi label="Saídas" value={formatBRL(data.mes_medio.saidas)} />
                </div>
              ) : <p className="py-6 text-center text-xs text-slate-500">Menos de {data.grupo_minimo} usuários com lançamentos em {monthLabel(month)}.</p>}
            </Card>
            <Card title={<span className="flex items-center gap-2"><Wallet size={15} /> Gasto médio por categoria</span>}>
              <BarList rows={data.gastos_por_categoria.map((c) => ({ label: c.categoria, value: c.media_por_usuario, extra: `${c.n} pessoas` }))} format={formatBRL} />
            </Card>
            <Card title={<span className="flex items-center gap-2"><Car size={15} /> Aplicativos: ganho por hora</span>}>
              {data.aplicativos.length ? (
                <ul className="space-y-2">
                  {data.aplicativos.map((a) => (
                    <li key={a.app} className="surface flex items-center justify-between gap-3 rounded-2xl px-4 py-3">
                      <div className="min-w-0"><p className="truncate font-bold text-white">{a.app}</p><p className="text-[11px] text-slate-500">{a.motoristas} motoristas · média {formatBRL(a.media_mes)} no mês</p></div>
                      <div className="text-right font-mono text-xs font-bold"><p className="text-emerald-300">{a.por_hora != null ? `${formatBRL(a.por_hora)}/h` : '—'}</p><p className="text-slate-400">{a.por_km != null ? `${formatBRL(a.por_km)}/km` : '—'}</p></div>
                    </li>
                  ))}
                </ul>
              ) : <p className="py-6 text-center text-xs text-slate-500">Ainda não há aplicativos com {data.grupo_minimo}+ motoristas no mês.</p>}
            </Card>
            <Card title={<span className="flex items-center gap-2"><Cake size={15} /> Faixa de idade</span>}>
              <BarList rows={data.idade.map((i) => ({ label: i.faixa, value: i.n, extra: i.renda_media != null ? `renda ${formatBRL(i.renda_media)}` : undefined }))} format={(v) => `${v} pessoas`} />
            </Card>
            <Card title={<span className="flex items-center gap-2"><Briefcase size={15} /> Ocupação</span>}>
              <BarList rows={data.ocupacao.map((o) => ({ label: occupationLabel(o.ocupacao), value: o.n }))} format={(v) => `${v}`} />
            </Card>
            <Card title={<span className="flex items-center gap-2"><MapPin size={15} /> Estados</span>}>
              <BarList rows={data.estado.map((e) => ({ label: e.uf, value: e.n }))} format={(v) => `${v}`} />
            </Card>
            <Card title={<span className="flex items-center gap-2"><ShieldCheck size={15} /> Privacidade</span>}>
              <p className="text-sm text-slate-400"><Users size={14} className="mr-1 inline" /> Os números incluem só quem marcou "participar das estatísticas". Grupos com menos de {data.grupo_minimo} pessoas ficam escondidos para ninguém ser identificado. Dados individuais não aparecem aqui.</p>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
