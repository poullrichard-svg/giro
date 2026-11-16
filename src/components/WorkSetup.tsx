import { useState } from 'react';
import { Bike, Briefcase, Car, Check as CheckIcon, Motorbike, Package, Plus, Scooter, Trash2 } from 'lucide-react';
import { useData } from '../data/DataProvider';
import { useToast } from '../data/toast';
import { CUSTOM_COLORS, PROFILE_ID, WORK_TYPES, buildProfile } from '../lib/work';
import type { Platform, WorkKind, WorkProfile } from '../types';
import { Button, Field, Input, Segmented, cx } from './ui';

export const WORK_TYPE_ICON: Record<string, typeof Car> = {
  'app-carro': Car, 'app-moto': Motorbike, 'entrega-carro': Package, 'entrega-moto': Scooter, 'entrega-bike': Bike, fixo: Briefcase,
};
const KIND_LABEL: Record<WorkKind, string> = { passageiro: 'Passageiros', entrega: 'Entregas', fixo: 'Fixo / diária' };

/** Escolha dos tipos de trabalho e das plataformas. Usada na primeira vez e em "Personalizar". */
export function WorkSetup({ profile, onDone }: { profile: WorkProfile | null; onDone?: () => void }) {
  const { put } = useData();
  const toast = useToast();
  const [step, setStep] = useState<'tipos' | 'plataformas'>(profile ? 'plataformas' : 'tipos');
  const [types, setTypes] = useState<string[]>(profile?.types ?? []);
  const [draft, setDraft] = useState<WorkProfile | null>(profile);
  const [custom, setCustom] = useState({ name: '', kind: 'entrega' as WorkKind });

  const toggleType = (id: string) => setTypes((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));
  const goPlatforms = () => {
    if (!types.length) { toast('Escolha pelo menos um tipo de trabalho', 'error'); return; }
    setDraft(buildProfile(types, draft));
    setStep('plataformas');
  };
  const setPlatform = (id: string, patch: Partial<Platform>) => setDraft((d) => d && { ...d, platforms: d.platforms.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  const addCustom = () => {
    const name = custom.name.trim();
    if (!name || !draft) return;
    const color = CUSTOM_COLORS[draft.platforms.filter((p) => p.custom).length % CUSTOM_COLORS.length];
    setDraft({ ...draft, platforms: [...draft.platforms, { id: `custom-${Date.now().toString(36)}`, name, color, kind: custom.kind, enabled: true, custom: true }] });
    setCustom({ ...custom, name: '' });
  };
  const save = async () => {
    if (!draft) return;
    if (!draft.platforms.some((p) => p.enabled)) { toast('Ligue pelo menos uma plataforma', 'error'); return; }
    if (await put('settings', { ...draft, id: PROFILE_ID, types })) { toast('Perfil de trabalho salvo'); onDone?.(); }
  };

  if (step === 'tipos') {
    return (
      <div className="space-y-5">
        <div className="stagger grid gap-3 sm:grid-cols-2">
          {WORK_TYPES.map((t) => {
            const Icon = WORK_TYPE_ICON[t.id]; const on = types.includes(t.id);
            return (
              <button key={t.id} type="button" onClick={() => toggleType(t.id)} aria-pressed={on}
                className={cx('press group relative flex items-center gap-4 rounded-[1.5rem] p-4 text-left ring-1 transition-all duration-300', on ? 'bg-brand-500/15 ring-brand-400/60 shadow-[0_10px_30px_-12px] shadow-brand-500' : 'surface ring-white/5 hover:ring-white/15')}>
                <span className={cx('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-all duration-500', on ? 'solid scale-105' : 'bg-white/[.05] text-slate-400 group-hover:-rotate-6')} style={on ? ({ '--tone': '#16a34a' } as React.CSSProperties) : undefined}><Icon size={22} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[15px] font-black text-white">{t.label}</span>
                  <span className="block text-xs font-medium text-slate-400">{t.desc}</span>
                </span>
                <span className={cx('flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-1 transition', on ? 'bg-brand-500 ring-brand-300 text-white' : 'ring-white/20')}>{on && <CheckIcon size={14} strokeWidth={3.5} className="pop-in" />}</span>
              </button>
            );
          })}
        </div>
        <Button className="w-full" onClick={goPlatforms}>Continuar</Button>
      </div>
    );
  }

  const groups = (['passageiro', 'entrega', 'fixo'] as WorkKind[]).map((k) => ({ k, items: (draft?.platforms ?? []).filter((p) => p.kind === k) })).filter((g) => g.items.length);
  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-400">Ligue as plataformas em que você trabalha. Elas aparecem na hora de registrar o dia.</p>
      {groups.map((g) => (
        <section key={g.k}>
          <p className="label mb-2 text-slate-500">{KIND_LABEL[g.k]}</p>
          <div className="flex flex-wrap gap-2">
            {g.items.map((p) => (
              <span key={p.id} className="inline-flex items-center">
                <button type="button" onClick={() => setPlatform(p.id, { enabled: !p.enabled })} aria-pressed={p.enabled}
                  className={cx('press flex items-center gap-2 rounded-full py-2 pl-2.5 pr-3.5 text-sm font-bold ring-1 transition', p.enabled ? 'bg-white/[.08] text-white ring-white/20' : 'text-slate-500 ring-white/5 hover:text-slate-300')}>
                  <span className="h-3 w-3 rounded-full transition" style={{ background: p.enabled ? p.color : 'transparent', boxShadow: p.enabled ? `0 0 10px ${p.color}` : undefined, outline: `2px solid ${p.color}` }} />
                  {p.name}
                </button>
                {p.custom && <button type="button" aria-label={`Remover ${p.name}`} onClick={() => setDraft((d) => d && { ...d, platforms: d.platforms.filter((x) => x.id !== p.id) })} className="ml-1 rounded-full p-1.5 text-slate-500 hover:text-rose-400"><Trash2 size={14} /></button>}
              </span>
            ))}
          </div>
        </section>
      ))}
      <div className="surface space-y-3 rounded-[1.5rem] p-4">
        <p className="label text-slate-400">Adicionar outra plataforma</p>
        <Field label="Nome"><Input value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} placeholder="Ex.: Restaurante do Zé, Frete, Aplicativo X" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustom())} /></Field>
        <Segmented value={custom.kind} onChange={(k) => setCustom({ ...custom, kind: k })} options={[{ value: 'passageiro', label: 'Passageiros' }, { value: 'entrega', label: 'Entregas' }, { value: 'fixo', label: 'Diária' }]} />
        <Button variant="soft" className="w-full" onClick={addCustom}><Plus size={16} /> Adicionar</Button>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <Button variant="soft" onClick={() => setStep('tipos')}>Tipos de trabalho</Button>
        <Button onClick={save}>Salvar perfil</Button>
      </div>
    </div>
  );
}
