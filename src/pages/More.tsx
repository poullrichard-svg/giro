import { useRef, useState, type ChangeEvent } from 'react';
import { CloudOff, Download, Receipt, HardDrive, MessageCircle, RefreshCw, Smartphone, Trash2, Upload } from 'lucide-react';
import { useData } from '../data/DataProvider';
import { useToast } from '../data/toast';
import { BACKUP_KEY, downloadBackup, parseBackup } from '../data/backup';
import { NAV } from '../components/Shell';
import { Button, Card, Field, MoneyInput, NumberInput } from '../components/ui';
import { rules } from '../lib/validate';
import { downloadCSV } from '../lib/csv';
import { ImportStatement } from '../components/ImportStatement';
import { daysUntil, formatDate, localISODate } from '../lib/format';

const readLastBackup = () => { try { return localStorage.getItem(BACKUP_KEY); } catch { return null; } };

export default function More() {
  const { data, persisted, engine, replaceAll } = useData();
  const toast = useToast();
  const [lastBackup, setLastBackup] = useState(readLastBackup);
  const [confirmErase, setConfirmErase] = useState(false);
  const jsonRef = useRef<HTMLInputElement>(null);
  const [importOpen, setImportOpen] = useState(false);

  // Registros do usuário (contas e configurações não contam: a "Carteira" é criada sozinha).
  const total = Object.entries(data).filter(([k]) => k !== 'accounts' && k !== 'settings').reduce((s, [, arr]) => s + arr.length, 0);
  const backupAge = lastBackup ? -daysUntil(lastBackup.slice(0, 10)) : null;

  const exportBackup = () => { downloadBackup(data); setLastBackup(readLastBackup()); toast('Backup baixado'); };

  const restore = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    try {
      const incoming = parseBackup(await file.text());
      const count = Object.values(incoming).reduce((s, a) => s + (a?.length ?? 0), 0);
      if (total > 0 && !window.confirm(`Restaurar ${count} registros? Isso SUBSTITUI os ${total} registros atuais deste aparelho.`)) return;
      if (await replaceAll(incoming)) toast(`${count} registros restaurados`);
    } catch (err: any) { toast(err.message, 'error'); }
  };



  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">Mais</h1>
      <div className="grid grid-cols-2 gap-2 md:hidden">
        {NAV.filter((n) => !['inicio', 'lancamentos', 'motorista'].includes(n.id)).map((n) => (
          <a key={n.id} href={`#/${n.id}`} className="surface surface-hover press flex items-center gap-3 rounded-[1.5rem] p-4 text-sm font-semibold text-slate-100"><n.icon size={20} className="text-brand-400" />{n.label}</a>
        ))}
      </div>

      <Card title={<span className="flex items-center gap-2"><HardDrive size={16} /> Onde ficam seus dados</span>}>
        <p className="text-sm text-slate-400">Tudo fica salvo <strong className="text-slate-200">neste aparelho e neste navegador</strong> — sem servidor, sem login e funciona sem internet. São {total} registros guardados.</p>
        <ul className="mt-3 space-y-1.5 text-xs text-slate-400">
          <li>{engine === 'idb' ? '✅ Banco do navegador funcionando.' : engine === 'local' ? '⚠️ Usando armazenamento alternativo (o banco principal do navegador está bloqueado). Funciona, mas tem menos espaço — se puder, abra no Chrome ou Safari.' : engine === 'memory' ? '❌ Este navegador não deixa guardar dados: tudo some ao fechar. Abra o link no Chrome ou Safari (não dentro do WhatsApp/Instagram).' : 'Verificando armazenamento…'}</li>
          <li>{persisted ? '✅ Armazenamento protegido: o navegador não apaga os dados para liberar espaço.' : '⚠️ O navegador pode limpar os dados se faltar espaço. Instale o app na tela inicial para proteger.'}</li>
          <li>⚠️ Limpar os dados do navegador ou desinstalar o app apaga tudo — faça backup com frequência.</li>
          <li>⚠️ Celular e computador ainda não sincronizam entre si. Para passar os dados de um para o outro, use backup → restaurar.</li>
        </ul>
      </Card>

      <Card title="Backup">
        <p className={`mb-3 text-sm ${backupAge === null || backupAge > 7 ? 'text-amber-300' : 'text-slate-400'}`}>
          {lastBackup ? `Último backup: ${formatDate(lastBackup.slice(0, 10))}${backupAge ? ` (${backupAge} dias atrás)` : ' (hoje)'}` : 'Você ainda não fez nenhum backup.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportBackup}><Download size={16} /> Fazer backup</Button>
          <Button variant="soft" onClick={() => jsonRef.current?.click()}><Upload size={16} /> Restaurar backup</Button>
          <input ref={jsonRef} type="file" accept="application/json,.json" hidden onChange={restore} />
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Guarde o arquivo no Google Drive, no e-mail ou no WhatsApp “para você mesmo”.</p>
      </Card>

      <Card title="Planilhas">
        <div className="flex flex-wrap gap-2">
          <Button variant="soft" onClick={() => downloadCSV(`giro-lancamentos-${localISODate()}.csv`, data.transactions.map((t) => ({ Data: t.date, Tipo: t.type === 'income' ? 'Receita' : 'Despesa', Descrição: t.description, Categoria: t.category, Pagamento: t.paymentMethod, Valor: t.amount })))}><Download size={16} /> Lançamentos (Excel)</Button>
          <Button variant="soft" onClick={() => downloadCSV(`giro-motorista-${localISODate()}.csv`, data.sessions.map((s) => ({ Data: s.date, App: s.app, Ganho: s.amount, Corridas: s.trips, Km: s.kmDriven, Horas: s.hoursWorked, Combustível: s.fuelSpent, Alimentação: s.foodSpent })))}><Download size={16} /> Corridas (Excel)</Button>
          <Button variant="soft" onClick={() => setImportOpen(true)}><Upload size={16} /> Importar extrato (OFX ou CSV)</Button>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Aceita OFX e CSV dos bancos, o CSV do próprio Giro e a tabela <em>transactions</em> exportada do Supabase. Lançamentos repetidos são detectados e ficam desmarcados.</p>
      </Card>

      <MeiCard />

      <Card title={<span className="flex items-center gap-2"><Smartphone size={16} /> Instalar no celular</span>}>
        <p className="text-sm text-slate-400"><strong className="text-slate-200">Android (Chrome):</strong> menu ⋮ → “Instalar app”.<br /><strong className="text-slate-200">iPhone (Safari):</strong> compartilhar → “Adicionar à Tela de Início”.<br />Abre em tela cheia, como um app.</p>
      </Card>

      <Card title={<span className="flex items-center gap-2"><RefreshCw size={16} className="text-brand-400" /> Em breve</span>}>
        <ul className="space-y-2 text-sm text-slate-400">
          <li className="flex gap-2"><CloudOff size={16} className="mt-0.5 shrink-0" /> Sincronização entre celular e computador (conta própria na nuvem).</li>
          <li className="flex gap-2"><MessageCircle size={16} className="mt-0.5 shrink-0" /> Lançar pelo WhatsApp: “gastei 50 no mercado” — o app já entende esse tipo de frase.</li>
        </ul>
      </Card>

      <Card title="Zona de perigo">
        <Button variant="danger" onClick={async () => { if (!confirmErase) { setConfirmErase(true); return; } if (await replaceAll({})) { toast('Todos os dados foram apagados'); setConfirmErase(false); } }}>
          <Trash2 size={16} /> {confirmErase ? 'Toque de novo para apagar TUDO deste aparelho' : 'Apagar todos os dados'}
        </Button>
      </Card>
      <ImportStatement open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}

const DAS_ID = 'das-mei';
/** DAS do MEI: vira uma conta fixa mensal (aparece nos vencimentos, lembretes e previsão). */
function MeiCard() {
  const { data, put, remove } = useData();
  const toast = useToast();
  const bill = data.fixed.find((f) => f.id === DAS_ID);
  const [amount, setAmount] = useState(bill?.amount ?? 0);
  const [day, setDay] = useState(bill?.dueDay ?? 20);
  const [error, setError] = useState<string | null>(null);
  const save = async (on: boolean) => {
    if (!on) { if (await remove('fixed', DAS_ID)) toast('Lembrete do DAS desligado'); return; }
    const e = rules.positive(amount, 'Valor do DAS') || rules.dayOfMonth(day, 'Dia do vencimento');
    setError(e || null);
    if (e) return;
    if (await put('fixed', { id: DAS_ID, description: 'DAS MEI', amount, type: 'expense', category: 'Impostos', dueDay: day })) toast(bill ? 'DAS atualizado' : 'Lembrete do DAS ligado');
  };
  return (
    <Card title={<span className="flex items-center gap-2"><Receipt size={16} className="text-amber-400" /> MEI · lembrete do DAS</span>}>
      <p className="mb-3 text-sm text-slate-400">Para quem é MEI: o DAS vira uma conta fixa mensal e aparece nos próximos vencimentos e lembretes. Confira o valor do seu boleto no app MEI ou no portal do Simples Nacional.</p>
      <div className="grid grid-cols-2 items-start gap-3">
        <Field label="Valor do DAS" error={error && error.startsWith('Valor') ? error : null}><MoneyInput value={amount} onChange={setAmount} /></Field>
        <Field label="Vence todo dia" error={error && error.startsWith('Dia') ? error : null}><NumberInput value={day} onChange={(v) => setDay(Math.round(v))} /></Field>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={() => save(true)}>{bill ? 'Atualizar' : 'Ligar lembrete'}</Button>
        {bill && <Button variant="danger" onClick={() => save(false)}>Desligar</Button>}
      </div>
    </Card>
  );
}
