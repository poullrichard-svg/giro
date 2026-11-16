import { useRef, useState, type ChangeEvent } from 'react';
import { CloudOff, Download, HardDrive, MessageCircle, RefreshCw, Smartphone, Trash2, Upload } from 'lucide-react';
import { useData } from '../data/DataProvider';
import { useToast } from '../data/toast';
import { BACKUP_KEY, downloadBackup, parseBackup } from '../data/backup';
import { NAV } from '../components/Shell';
import { Button, Card } from '../components/ui';
import { downloadCSV } from '../lib/csv';
import { parseTransactionsCSV } from '../lib/csvImport';
import { daysUntil, formatDate, localISODate } from '../lib/format';

const readLastBackup = () => { try { return localStorage.getItem(BACKUP_KEY); } catch { return null; } };

export default function More() {
  const { data, persisted, engine, insert, replaceAll } = useData();
  const toast = useToast();
  const [lastBackup, setLastBackup] = useState(readLastBackup);
  const [confirmErase, setConfirmErase] = useState(false);
  const jsonRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);

  const total = Object.values(data).reduce((s, arr) => s + arr.length, 0);
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

  const importCSV = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    try {
      const { items, skipped } = parseTransactionsCSV(await file.text());
      if (!items.length) { toast('Nenhum lançamento válido no arquivo', 'error'); return; }
      if (await insert('transactions', items)) toast(`${items.length} ${items.length === 1 ? "lançamento importado" : "lançamentos importados"}${skipped ? ` (${skipped} linhas ignoradas)` : ''}`);
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
          <Button variant="soft" onClick={() => csvRef.current?.click()}><Upload size={16} /> Importar lançamentos (CSV)</Button>
          <input ref={csvRef} type="file" accept=".csv,text/csv" hidden onChange={importCSV} />
        </div>
        <p className="mt-2 text-[11px] text-slate-500">A importação aceita o CSV do Giro ou a tabela <em>transactions</em> exportada do Supabase (Table Editor → Export → CSV) — útil para trazer o histórico antigo. Os lançamentos importados são somados aos atuais.</p>
      </Card>

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
    </div>
  );
}
