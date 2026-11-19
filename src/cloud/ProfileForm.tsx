import { useEffect, useRef, useState } from 'react';
import { Camera, LogOut, Trash2, UserRound } from 'lucide-react';
import { Logo } from '../components/Logo';
import { Button, Field, Input, Modal, MoneyInput, Select, cx } from '../components/ui';
import { useToast } from '../data/toast';
import { compressImage } from '../lib/image';
import { useCloud } from './CloudProvider';
import { ageOn, MIN_AGE, OCCUPATIONS, profileError, UFS, type Profile } from './profile';

type Errors = Partial<Record<'full_name' | 'birth_date' | 'occupation' | 'monthly_income' | 'form', string>>;
const EMPTY: Profile = { full_name: '', birth_date: '', avatar: null, monthly_income: null, occupation: null, city: null, state: null, consent_stats: false };

export function validateProfile(p: Profile, incomeSkipped: boolean, today = new Date()): Errors {
  const e: Errors = {};
  const name = p.full_name.trim();
  if (name.length < 2) e.full_name = 'Digite seu nome.';
  else if (name.length > 80) e.full_name = 'Nome muito longo.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.birth_date)) e.birth_date = 'Informe a data de nascimento.';
  else {
    const age = ageOn(p.birth_date, today);
    if (!Number.isFinite(age) || age > 110) e.birth_date = 'Data de nascimento inválida.';
    else if (age < MIN_AGE) e.birth_date = `É preciso ter ${MIN_AGE} anos ou mais para usar o Giro.`;
  }
  if (!p.occupation) e.occupation = 'Escolha o que você faz.';
  if (!incomeSkipped && (p.monthly_income == null || p.monthly_income < 0)) e.monthly_income = 'Informe a renda ou marque "prefiro não informar".';
  return e;
}

/** Foto redonda com botão de trocar. */
function AvatarPicker({ value, onChange, name }: { value: string | null; onChange: (v: string | null) => void; name: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const pick = async (f?: File) => {
    if (!f) return;
    try { onChange((await compressImage(f, 256, 0.8)).dataUrl); } catch { toast('Não foi possível usar essa imagem.', 'error'); }
  };
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
  return (
    <div className="flex items-center gap-4">
      <button type="button" onClick={() => ref.current?.click()} aria-label="Escolher foto" className="press relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-brand-500/15 ring-2 ring-brand-400/40">
        {value ? <img src={value} alt="Sua foto" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center font-display text-2xl font-black text-brand-300">{initials || <UserRound size={30} />}</span>}
        <span className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-white ring-2 ring-[#0d0b17]"><Camera size={14} /></span>
      </button>
      <div className="text-sm">
        <p className="font-bold text-white">Foto (opcional)</p>
        <div className="mt-1 flex gap-3">
          <button type="button" onClick={() => ref.current?.click()} className="label text-brand-300">{value ? 'Trocar' : 'Escolher'}</button>
          {value && <button type="button" onClick={() => onChange(null)} className="label flex items-center gap-1 text-rose-300"><Trash2 size={12} /> Remover</button>}
        </div>
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden" data-testid="avatar-input" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
  );
}

export function ProfileFields({ initial, onSaved, submitLabel }: { initial: Profile | null; onSaved?: () => void; submitLabel: string }) {
  const { saveProfile } = useCloud();
  const [p, setP] = useState<Profile>(initial ?? EMPTY);
  const [skipIncome, setSkipIncome] = useState(initial ? initial.monthly_income == null : false);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => setErrors({}), [p, skipIncome]);
  const age = /^\d{4}-\d{2}-\d{2}$/.test(p.birth_date) ? ageOn(p.birth_date) : NaN;

  const save = async () => {
    const e = validateProfile(p, skipIncome);
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await saveProfile({ ...p, full_name: p.full_name.trim().replace(/\s+/g, ' '), monthly_income: skipIncome ? null : p.monthly_income, city: p.city?.trim() || null });
      onSaved?.();
    } catch (err) { setErrors({ form: profileError(err) }); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <AvatarPicker value={p.avatar} onChange={(avatar) => setP({ ...p, avatar })} name={p.full_name} />
      <Field label="Nome completo" error={errors.full_name}><Input value={p.full_name} maxLength={80} autoComplete="name" onChange={(e) => setP({ ...p, full_name: e.target.value })} placeholder="Como você se chama?" /></Field>
      <Field label="Data de nascimento" error={errors.birth_date} hint={Number.isFinite(age) && age >= 0 && age < 120 ? `${age} anos` : undefined}>
        <Input type="date" value={p.birth_date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setP({ ...p, birth_date: e.target.value })} />
      </Field>
      <Field label="O que você faz" error={errors.occupation}>
        <Select value={p.occupation ?? ''} onChange={(e) => setP({ ...p, occupation: e.target.value || null })} options={[{ value: '', label: 'Escolha…' }, ...OCCUPATIONS]} />
      </Field>
      <Field label="Renda mensal (aproximada)" error={errors.monthly_income} hint="Somando tudo o que entra no mês. Ajuda a comparar seus gastos.">
        <div className={cx(skipIncome && 'pointer-events-none opacity-40')}><MoneyInput value={p.monthly_income ?? 0} onChange={(v) => setP({ ...p, monthly_income: v })} /></div>
      </Field>
      <label className="-mt-2 flex cursor-pointer items-center gap-2.5 text-sm text-slate-300">
        <input type="checkbox" checked={skipIncome} onChange={(e) => setSkipIncome(e.target.checked)} className="h-5 w-5 accent-[#16a34a]" /> Prefiro não informar a renda
      </label>
      <div className="grid grid-cols-[1fr_6.5rem] items-start gap-3">
        <Field label="Cidade (opcional)"><Input value={p.city ?? ''} maxLength={60} autoComplete="address-level2" onChange={(e) => setP({ ...p, city: e.target.value })} /></Field>
        <Field label="UF"><Select value={p.state ?? ''} onChange={(e) => setP({ ...p, state: e.target.value || null })} options={[{ value: '', label: '—' }, ...UFS]} /></Field>
      </div>
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-white/[.03] p-3.5 text-sm text-slate-300 ring-1 ring-white/[.06]">
        <input type="checkbox" checked={p.consent_stats} onChange={(e) => setP({ ...p, consent_stats: e.target.checked })} className="mt-0.5 h-5 w-5 shrink-0 accent-[#16a34a]" />
        <span><b className="text-white">Participar das estatísticas do Giro (anônimo).</b> Seus números entram só em médias com pelo menos 5 pessoas — ninguém vê seus dados individuais. Isso ajuda a mostrar comparações como "quanto motoristas da sua região ganham por hora". Você pode desligar quando quiser.</span>
      </label>
      {errors.form && <p role="alert" className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300 ring-1 ring-rose-500/20">{errors.form}</p>}
      <Button className="w-full" disabled={busy} onClick={save}>{busy ? 'Salvando…' : submitLabel}</Button>
    </div>
  );
}

/** Tela obrigatória depois do primeiro login: completar o perfil. */
export function ProfileSetup() {
  const cloud = useCloud();
  return (
    <div className="flex min-h-dvh justify-center px-4 py-10">
      <div className="backdrop" aria-hidden="true" />
      <div className="w-full max-w-md animate-page">
        <div className="mb-6 flex items-center gap-3"><Logo size={44} /><div><p className="label text-brand-300">Último passo</p><h1 className="font-display text-2xl font-black text-white">Complete seu perfil</h1></div></div>
        <p className="mb-5 text-sm text-slate-400">Conta criada com {cloud.user?.email}. Conte um pouco sobre você para o Giro personalizar dicas e comparações.</p>
        <div className="surface rounded-[2rem] p-6"><ProfileFields initial={cloud.profile} submitLabel="Salvar e começar" /></div>
        <button type="button" onClick={() => cloud.signOut()} className="label mx-auto mt-5 flex items-center gap-1.5 text-slate-500 hover:text-white"><LogOut size={13} /> Sair</button>
      </div>
    </div>
  );
}

/** Editar perfil (Ajustes → Conta). */
export function ProfileEditModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const cloud = useCloud();
  const toast = useToast();
  return (
    <Modal open={open} onClose={onClose} title="Meu perfil">
      {open && <ProfileFields initial={cloud.profile} submitLabel="Salvar perfil" onSaved={() => { toast('Perfil atualizado'); onClose(); }} />}
    </Modal>
  );
}

export function Avatar({ profile, size = 40 }: { profile: Profile | null; size?: number }) {
  const initials = (profile?.full_name ?? '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
  return (
    <span className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-500/15 font-display font-black text-brand-300 ring-2 ring-brand-400/30" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {profile?.avatar ? <img src={profile.avatar} alt="" className="h-full w-full object-cover" /> : initials || <UserRound size={size * 0.5} />}
    </span>
  );
}
