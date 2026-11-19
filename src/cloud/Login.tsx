import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, Eye, EyeOff, LockKeyhole, Mail, MailCheck } from 'lucide-react';
import { Logo } from '../components/Logo';
import { Button, Field, Input, Modal, cx } from '../components/ui';
import { useCloud } from './CloudProvider';
import { PrivacyText } from './Privacy';

type Mode = 'entrar' | 'criar' | 'esqueci' | 'enviado';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const passwordProblem = (p: string) => (p.length < 8 ? 'Use pelo menos 8 caracteres.' : !/[A-Za-z]/.test(p) || !/\d/.test(p) ? 'Misture letras e números.' : null);

function PasswordInput({ value, onChange, autoComplete, label }: { value: string; onChange: (v: string) => void; autoComplete: string; label: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} aria-label={label} className="pr-12" />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Esconder senha' : 'Mostrar senha'} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-500 hover:text-white">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
    </div>
  );
}

export default function Login() {
  const cloud = useCloud();
  const [mode, setMode] = useState<Mode>('entrar');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accept, setAccept] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; accept?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const [sentText, setSentText] = useState('');
  const [terms, setTerms] = useState(false);
  useEffect(() => setErrors({}), [email, password, accept, mode]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const er: typeof errors = {};
    if (!EMAIL.test(email.trim())) er.email = 'Digite um e-mail válido.';
    if (mode !== 'esqueci') { if (!password) er.password = 'Digite a senha.'; else if (mode === 'criar') er.password = passwordProblem(password) ?? undefined; }
    if (mode === 'criar' && !accept) er.accept = 'Para criar a conta, aceite os termos.';
    if (Object.values(er).some(Boolean)) { setErrors(er); return; }
    setBusy(true);
    try {
      if (mode === 'entrar') { const err = await cloud.signIn(email, password); if (err) setErrors({ form: err }); }
      else if (mode === 'criar') {
        const r = await cloud.signUp(email, password);
        if (r.error) setErrors({ form: r.error });
        else if (r.confirm) { setSentText(`Enviamos um link de confirmação para ${email.trim()}. Abra o e-mail e toque no link para ativar a conta.`); setMode('enviado'); }
      } else {
        const err = await cloud.resetPassword(email);
        if (err) setErrors({ form: err });
        else { setSentText(`Se existir uma conta com ${email.trim()}, enviamos um link para criar uma nova senha. Abra o link neste aparelho.`); setMode('enviado'); }
      }
    } finally { setBusy(false); }
  };

  const title = { entrar: 'Entrar', criar: 'Criar conta', esqueci: 'Esqueci a senha', enviado: 'Confira seu e-mail' }[mode];

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="backdrop" aria-hidden="true" />
      <div className="w-full max-w-md animate-page">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="float"><Logo size={64} /></span>
          <p className="mt-4 font-display text-4xl font-black tracking-tight text-white">giro</p>
          <p className="label mt-1 text-brand-300/80">finanças em movimento</p>
        </div>
        <div className="surface rounded-[2rem] p-6 shadow-2xl md:p-8">
          {mode === 'enviado' ? (
            <div className="text-center">
              <span className="solid mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ '--tone': '#16a34a' } as React.CSSProperties}><MailCheck size={26} /></span>
              <h1 className="font-display text-2xl font-black text-white">{title}</h1>
              <p className="mt-3 text-sm text-slate-300">{sentText}</p>
              <p className="mt-2 text-xs text-slate-500">Não chegou? Olhe a caixa de spam ou promoções.</p>
              <Button variant="soft" className="mt-6 w-full" onClick={() => { setMode('entrar'); setPassword(''); }}><ArrowLeft size={15} /> Voltar para entrar</Button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="space-y-4">
              {mode !== 'esqueci' ? (
                <div className="grid grid-cols-2 gap-1 rounded-2xl bg-white/[.04] p-1 ring-1 ring-white/10" role="tablist">
                  {(['entrar', 'criar'] as const).map((m) => (
                    <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
                      className={cx('press rounded-xl py-2.5 text-[12px] font-extrabold uppercase tracking-[.08em] transition', mode === m ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400')}>{m === 'entrar' ? 'Entrar' : 'Criar conta'}</button>
                  ))}
                </div>
              ) : (
                <div><button type="button" onClick={() => setMode('entrar')} className="label flex items-center gap-1.5 text-slate-400 hover:text-white"><ArrowLeft size={14} /> Voltar</button>
                  <h1 className="mt-3 font-display text-2xl font-black text-white">{title}</h1>
                  <p className="mt-1 text-sm text-slate-400">Digite o e-mail da conta. Vamos mandar um link para você criar uma senha nova.</p></div>
              )}
              <Field label="E-mail" error={errors.email}>
                <div className="relative"><Mail size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <Input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" className="pl-11" /></div>
              </Field>
              {mode !== 'esqueci' && (
                <Field label="Senha" error={errors.password} hint={mode === 'criar' ? 'Mínimo de 8 caracteres, com letras e números.' : undefined}>
                  <PasswordInput value={password} onChange={setPassword} autoComplete={mode === 'criar' ? 'new-password' : 'current-password'} label="Senha" />
                </Field>
              )}
              {mode === 'criar' && (
                <div>
                  <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-300">
                    <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#16a34a]" />
                    <span>Li e aceito a <button type="button" onClick={() => setTerms(true)} className="font-bold text-brand-300 underline underline-offset-2">privacidade e os termos de uso</button>.</span>
                  </label>
                  {errors.accept && <p className="mt-1.5 text-xs font-semibold text-rose-300">{errors.accept}</p>}
                </div>
              )}
              {errors.form && <p role="alert" className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300 ring-1 ring-rose-500/20">{errors.form}</p>}
              <Button type="submit" className="w-full" disabled={busy}>
                <LockKeyhole size={16} /> {busy ? 'Aguarde…' : mode === 'entrar' ? 'Entrar' : mode === 'criar' ? 'Criar conta' : 'Enviar link'}
              </Button>
              {mode === 'entrar' && <button type="button" onClick={() => setMode('esqueci')} className="label mx-auto block text-slate-400 hover:text-white">Esqueci a senha</button>}
            </form>
          )}
        </div>
        <p className="mt-5 text-center text-xs text-slate-500">Seus dados ficam no aparelho e sincronizam com a sua conta.<br /><button type="button" onClick={() => setTerms(true)} className="underline underline-offset-2">Privacidade e termos</button></p>
      </div>
      <Modal open={terms} onClose={() => setTerms(false)} title="Privacidade e termos"><PrivacyText /></Modal>
    </div>
  );
}

/** Tela de nova senha (chegou pelo link do e-mail). */
export function NewPasswordModal() {
  const cloud = useCloud();
  const [p, setP] = useState(''); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false);
  useEffect(() => setErr(null), [p]);
  if (!cloud.recovery && !done) return null;
  const save = async () => {
    const prob = passwordProblem(p); if (prob) { setErr(prob); return; }
    setBusy(true); const e = await cloud.updatePassword(p); setBusy(false);
    if (e) setErr(e); else setDone(true);
  };
  return (
    <Modal open onClose={() => setDone(false)} title={done ? 'Senha alterada' : 'Crie uma nova senha'}
      footer={done ? <Button className="w-full" onClick={() => setDone(false)}>Continuar</Button> : <Button className="w-full" disabled={busy} onClick={save}>{busy ? 'Salvando…' : 'Salvar nova senha'}</Button>}>
      {done ? <p className="text-sm text-slate-300">Pronto! Use a nova senha da próxima vez que entrar.</p> : (
        <Field label="Nova senha" error={err} hint="Mínimo de 8 caracteres, com letras e números."><PasswordInput value={p} onChange={setP} autoComplete="new-password" label="Nova senha" /></Field>
      )}
    </Modal>
  );
}

/** Primeiro login num aparelho que já tinha dados, numa conta que também tem. */
export function MergeChoiceModal() {
  const { choice } = useCloud();
  if (!choice) return null;
  return (
    <Modal open onClose={() => {}} title="Você já tem dados nesta conta">
      <div className="space-y-4">
        <p className="text-sm text-slate-300">Este aparelho tem lançamentos que ainda não estão na sua conta. O que fazer com eles?</p>
        <Button className="w-full" onClick={() => choice('merge')}>Juntar com os dados da conta</Button>
        <Button variant="soft" className="w-full" onClick={() => choice('cloud')}>Usar só os dados da conta</Button>
        <p className="text-xs text-slate-500">"Usar só os dados da conta" apaga deste aparelho o que não foi sincronizado. Na dúvida, escolha juntar.</p>
      </div>
    </Modal>
  );
}
