import { useEffect, useRef, useState } from 'react';
import { BarChart3, LogOut, Pencil, RefreshCw, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import { Avatar, ProfileEditModal } from './ProfileForm';
import { ageOn, occupationLabel } from './profile';
import { go } from '../router';
import { Button, Card, Field, Input, Modal } from '../components/ui';
import { useToast } from '../data/toast';
import { formatDate } from '../lib/format';
import { useCloud } from './CloudProvider';
import { PrivacyText } from './Privacy';
import { syncLabel, useSyncStatus } from './SyncBadge';

export function AccountCard({ focus }: { focus?: boolean }) {
  const cloud = useCloud();
  const s = useSyncStatus();
  const toast = useToast();
  const ref = useRef<HTMLDivElement>(null);
  const [del, setDel] = useState(false);
  const [terms, setTerms] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(false);
  useEffect(() => { if (focus) setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300); }, [focus]);
  if (!cloud.enabled || !cloud.user) return null;
  const l = syncLabel(s);

  const remove = async () => {
    if (confirm.trim().toUpperCase() !== 'EXCLUIR') { setErr('Digite EXCLUIR para confirmar.'); return; }
    setBusy(true); const e = await cloud.deleteAccount(); setBusy(false);
    if (e) setErr(e); else toast('Conta excluída');
  };

  return (
    <div ref={ref} id="conta" className="scroll-mt-6">
      <Card title={<span className="flex items-center gap-2"><UserRound size={16} className="text-brand-400" /> Conta</span>}>
        <div className="flex items-center gap-4">
          <Avatar profile={cloud.profile} size={56} />
          <div className="min-w-0">
            {cloud.profile && <p className="truncate font-display text-lg font-black text-white" data-testid="profile-name">{cloud.profile.full_name}</p>}
            <p className={cloud.profile ? 'truncate text-sm text-slate-400' : 'truncate font-display text-lg font-black text-white'} data-testid="account-email">{cloud.user.email}</p>
            {cloud.profile && <p className="truncate text-xs text-slate-500">{ageOn(cloud.profile.birth_date)} anos · {occupationLabel(cloud.profile.occupation)}{cloud.profile.state ? ` · ${cloud.profile.city ? `${cloud.profile.city}/` : ''}${cloud.profile.state}` : ''}</p>}
          </div>
        </div>
        <p className={`label mt-3 flex items-center gap-2 ${l.tone}`}><span className={`h-2 w-2 rounded-full ${l.dot}`} /> {l.text}{s.lastSyncAt && s.phase === 'idle' ? ` · ${formatDate(s.lastSyncAt.slice(0, 10))} ${s.lastSyncAt.slice(11, 16)} UTC` : ''}</p>
        {s.error && <p className="mt-1 text-xs text-rose-300">{s.error}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {cloud.profileStatus !== 'unavailable' && <Button variant="soft" onClick={() => setEdit(true)}><Pencil size={15} /> Editar perfil</Button>}
          {cloud.isAdmin && <Button variant="soft" onClick={() => go('admin')}><BarChart3 size={15} /> Painel do administrador</Button>}
          <Button variant="soft" disabled={s.phase === 'syncing'} onClick={async () => { await cloud.sync(); }}><RefreshCw size={15} /> Sincronizar agora</Button>
          <Button variant="soft" onClick={async () => { if (await cloud.signOut()) toast('Você saiu da conta'); }}><LogOut size={15} /> Sair</Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/[.06] pt-4">
          <button type="button" onClick={() => setTerms(true)} className="label flex items-center gap-1.5 text-slate-400 hover:text-white"><ShieldCheck size={14} /> Privacidade e termos</button>
          <button type="button" onClick={() => { setDel(true); setConfirm(''); setErr(null); }} className="label flex items-center gap-1.5 text-rose-400/80 hover:text-rose-300"><Trash2 size={14} /> Excluir conta</button>
        </div>
        <p className="mt-3 text-[11px] text-slate-500">Ao sair, os dados são apagados deste aparelho e continuam guardados na sua conta.</p>
      </Card>
      <ProfileEditModal open={edit} onClose={() => setEdit(false)} />
      <Modal open={terms} onClose={() => setTerms(false)} title="Privacidade e termos"><PrivacyText /></Modal>
      <Modal open={del} onClose={() => setDel(false)} title="Excluir conta"
        footer={<Button variant="danger" className="w-full" disabled={busy} onClick={remove}><Trash2 size={15} /> {busy ? 'Excluindo…' : 'Excluir conta e todos os dados'}</Button>}>
        <div className="space-y-4">
          <p className="text-sm text-slate-300">Isso apaga <b className="text-white">para sempre</b> sua conta e todos os dados na nuvem e neste aparelho. Se quiser guardar uma cópia, baixe o backup antes.</p>
          <Field label='Digite "EXCLUIR" para confirmar' error={err}><Input value={confirm} onChange={(e) => { setConfirm(e.target.value); setErr(null); }} autoCapitalize="characters" /></Field>
        </div>
      </Modal>
    </div>
  );
}
