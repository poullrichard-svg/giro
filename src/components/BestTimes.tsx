import { useMemo } from 'react';
import { Clock, Moon, Sun, Sunrise, Sunset } from 'lucide-react';
import type { DriverSession } from '../types';
import { timeSlotStats, weekdayStats } from '../lib/driverInsights';
import { addDays, formatBRL, localISODate } from '../lib/format';
import { Card, cx } from './ui';

const SLOT_ICON = { madrugada: Moon, manha: Sunrise, tarde: Sun, noite: Sunset } as const;

/** Melhores dias da semana e faixas de horário, pelos últimos 90 dias. */
export function BestTimes({ sessions }: { sessions: DriverSession[] }) {
  const since = addDays(localISODate(), -90);
  const recent = useMemo(() => sessions.filter((s) => s.date >= since), [sessions, since]);
  const days = useMemo(() => weekdayStats(recent), [recent]);
  const slots = useMemo(() => timeSlotStats(recent), [recent]);
  const worked = days.filter((d) => d.days > 0);
  // Escala a partir do menor valor, para as diferenças entre os dias aparecerem.
  const vals = worked.map((d) => d.perHour);
  const maxDay = Math.max(1, ...vals); const minDay = Math.min(...vals, maxDay);
  const barHeight = (v: number) => (maxDay === minDay ? 70 : 25 + ((v - minDay) / (maxDay - minDay)) * 75);
  const bestDay = [...worked].sort((a, b) => b.perHour - a.perHour)[0];
  const ranked = slots.slots.filter((x) => x.hours > 0).sort((a, b) => b.perHour - a.perHour);

  return (
    <Card className="mt-5" title={<><Clock size={14} className="text-amber-400" /> Seus melhores horários · últimos 90 dias</>}>
      {recent.length < 3 ? (
        <p className="py-6 text-center text-sm text-slate-400">Registre pelo menos 3 dias de trabalho para ver aqui quais dias e horários rendem mais.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="label mb-3 text-slate-500">Ganho por hora em cada dia{bestDay ? <> · <span className="text-emerald-400">melhor: {bestDay.label}</span></> : null}</p>
            <div className="flex h-40 items-end gap-2">
              {days.map((d) => (
                <div key={d.day} className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5" title={d.days ? `${d.label}: ${formatBRL(d.perHour)}/h · ${formatBRL(d.perDay)}/dia em ${d.days} dias` : `${d.label}: sem registros`}>
                  <span className="font-mono text-[9px] font-bold text-slate-400 opacity-0 transition group-hover:opacity-100 max-md:opacity-100">{d.perHour ? Math.round(d.perHour) : ''}</span>
                  <div className={cx('bar-grow w-full max-w-8 rounded-t-[10px] rounded-b-[4px]', d === bestDay ? 'bg-gradient-to-b from-emerald-300 to-emerald-600 shadow-[0_0_16px] shadow-emerald-500/60' : 'bg-gradient-to-b from-slate-500 to-slate-700')}
                    style={{ height: d.days ? `${barHeight(d.perHour)}%` : 0 }} />
                  <span className={cx('label', d === bestDay ? 'text-emerald-400' : 'text-slate-500')}>{d.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="label mb-3 text-slate-500">Ganho por hora em cada faixa</p>
            {slots.withStart === 0 ? (
              <p className="rounded-2xl bg-white/[.03] p-4 text-sm text-slate-400 ring-1 ring-white/5">Preencha <strong className="text-slate-200">“Começou às”</strong> ao registrar o dia para descobrir seus horários mais lucrativos.</p>
            ) : (
              <ul className="space-y-2">
                {ranked.map((x, i) => {
                  const Icon = SLOT_ICON[x.id as keyof typeof SLOT_ICON];
                  return (
                    <li key={x.id} className={cx('flex items-center gap-3 rounded-2xl p-3 ring-1', i === 0 ? 'bg-emerald-500/10 ring-emerald-500/25' : 'bg-white/[.03] ring-white/5')}>
                      <Icon size={18} className={i === 0 ? 'text-emerald-400' : 'text-slate-400'} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-white">{i === 0 ? '🏆 ' : ''}{x.label} <span className="font-normal text-slate-500">{x.range}</span></p>
                        <p className="label text-slate-500">{Math.round(x.hours)} h trabalhadas</p>
                      </div>
                      <span className={cx('font-mono text-sm font-extrabold', i === 0 ? 'text-emerald-300' : 'text-slate-200')}>{formatBRL(x.perHour)}/h</span>
                    </li>
                  );
                })}
              </ul>
            )}
            {slots.withStart > 0 && slots.withStart < slots.total && <p className="mt-2 text-[11px] text-slate-500">{slots.total - slots.withStart} registros sem horário de início ficaram de fora.</p>}
          </div>
        </div>
      )}
    </Card>
  );
}
