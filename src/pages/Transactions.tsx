import { useMemo, useState } from 'react';
import { Modal } from '../components/ui';
import { ArrowDown, ArrowDownCircle, ArrowUp, ArrowUpCircle, Copy, Download, FileUp, Paperclip, Pencil, Scale, Search, Wallet } from 'lucide-react';
import { ImportStatement } from '../components/ImportStatement';
import { useData } from '../data/DataProvider';
import { useQuickAdd } from '../components/Shell';
import { Button, Card, ConfirmDelete, Empty, IconButton, Input, PageHeader, PeriodNav, Row, Segmented, Select, Stat, cx } from '../components/ui';
import { addMonths, currentMonth, formatBRL, formatDayLabel, monthLabel } from '../lib/format';
import type { Transaction } from '../types';
import { downloadCSV } from '../lib/csv';
import { txMonth } from '../lib/cards';

export default function Transactions() {
  const { data, remove } = useData();
  const [importOpen, setImportOpen] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const viewingPhoto = viewing ? data.attachments.find((a) => a.id === viewing) : undefined;
  const accName = new Map(data.accounts.map((a) => [a.id, a.name]));
  const cardName = new Map(data.cards.map((c) => [c.id, c.name]));
  const sourceLabel = (t: Transaction) => {
    if (t.internal === 'transfer') return `Transferência · ${accName.get(t.accountId ?? '') ?? ''}`;
    if (t.internal === 'invoice-payment') return `Pagamento de fatura · ${accName.get(t.accountId ?? '') ?? ''}`;
    if (t.internal === 'fixed-payment') return `Conta fixa · ${accName.get(t.accountId ?? '') ?? ''} · já somada nos totais`;
    if (t.cardId) return `${t.category} · ${cardName.get(t.cardId) ?? 'Cartão'}${t.installmentCount ? ` · ${t.installmentIndex}/${t.installmentCount}` : ''} · fatura ${t.invoiceMonth?.slice(5, 7)}/${t.invoiceMonth?.slice(2, 4)}`;
    return `${t.category} · ${accName.get(t.accountId ?? '') ?? t.paymentMethod}`;
  };
  const quickAdd = useQuickAdd();
  const [month, setMonth] = useState(currentMonth());
  const [type, setType] = useState<'all' | 'income' | 'expense'>('all');
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');

  const list = useMemo(() => data.transactions.filter((t) =>
    t.date && txMonth(t) === month && (type === 'all' || t.type === type) && (!cat || t.category === cat) &&
    (!q || `${t.description} ${t.category} ${t.paymentMethod}`.toLowerCase().includes(q.toLowerCase())),
  ).sort((a, b) => b.date.localeCompare(a.date)), [data.transactions, month, type, cat, q]);

  const groups = useMemo(() => {
    const m = new Map<string, Transaction[]>();
    for (const t of list) m.set(t.date, [...(m.get(t.date) ?? []), t]);
    return [...m.entries()];
  }, [list]);

  const cats = useMemo(() => [...new Set(data.transactions.filter((t) => t.date && txMonth(t) === month).map((t) => t.category))].sort(), [data.transactions, month]);
  const inc = list.filter((t) => t.type === 'income' && !t.internal).reduce((s, t) => s + t.amount, 0);
  const exp = list.filter((t) => t.type === 'expense' && !t.internal).reduce((s, t) => s + t.amount, 0);

  return (
    <div>
      <PageHeader eyebrow="Extrato" title="Lançamentos" subtitle="Entradas e saídas do dia a dia" actions={
        <>
          <PeriodNav label={monthLabel(month)} onPrev={() => setMonth(addMonths(month, -1))} onNext={() => setMonth(addMonths(month, 1))} onToday={() => setMonth(currentMonth())} />
          <Button variant="soft" onClick={() => setImportOpen(true)}><FileUp size={16} /> Importar extrato</Button>
          <Button variant="soft" onClick={() => downloadCSV(`lancamentos-${month}.csv`, list.map((t) => ({ Data: t.date, Tipo: t.type === 'income' ? 'Receita' : 'Despesa', Descrição: t.description, Categoria: t.category, Pagamento: t.paymentMethod, Valor: t.amount })))}><Download size={16} /> CSV</Button>
        </>
      } />

      <div className="stagger mb-5 grid grid-cols-3 gap-3 md:gap-4">
        <Stat label="Entradas" money={inc} tone="good" icon={<ArrowUpCircle />} />
        <Stat label="Saídas" money={exp} tone="bad" icon={<ArrowDownCircle />} />
        <Stat label="Resultado" money={inc - exp} tone={inc - exp >= 0 ? 'default' : 'bad'} icon={<Scale />} sub="sem contas fixas" />
      </div>

      <div className="mb-6 grid gap-2.5 md:grid-cols-[1fr_auto_220px]">
        <div className="relative"><Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" /><Input className="pl-11" placeholder="Buscar lançamento…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Segmented value={type} onChange={setType} options={[{ value: 'all', label: 'Todos' }, { value: 'income', label: 'Entradas' }, { value: 'expense', label: 'Saídas' }]} />
        <Select value={cat} onChange={(e) => setCat(e.target.value)} options={[{ value: '', label: 'Todas as categorias' }, ...cats]} />
      </div>

      {groups.length === 0 ? (
        <Card><Empty icon={<Wallet size={28} />} title="Nenhum lançamento" text="Nada encontrado para esse mês ou filtro." action={<Button onClick={() => quickAdd()}>Novo lançamento</Button>} /></Card>
      ) : (
        <div className="space-y-6">
          {groups.map(([date, items]) => {
            const dayTotal = items.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);
            return (
              <section key={date}>
                <div className="mb-2.5 flex items-center justify-between px-1">
                  <span className="label capitalize text-slate-400">{formatDayLabel(date)}</span>
                  <span className={cx('rounded-full px-2.5 py-1 font-mono text-[11px] font-extrabold', dayTotal >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400')}>{dayTotal >= 0 ? '+' : '−'} {formatBRL(Math.abs(dayTotal))}</span>
                </div>
                <ul className="stagger space-y-2.5">
                  {items.map((t) => (
                    <Row key={t.id} tone={t.type === 'income' ? 'good' : 'bad'}
                      icon={t.type === 'income' ? <ArrowUp size={19} strokeWidth={2.6} /> : <ArrowDown size={19} strokeWidth={2.6} />}
                      title={t.description} subtitle={sourceLabel(t)}
                      amount={`${t.type === 'income' ? '+' : '−'} ${formatBRL(t.amount)}`} amountTone={t.internal ? 'muted' : t.type === 'income' ? 'good' : 'bad'}
                      onClick={t.internal ? undefined : () => quickAdd({ editing: t })}
                      actions={<>
                        {t.attachmentId && <IconButton label="Ver comprovante" onClick={() => setViewing(t.attachmentId!)} className="text-sky-300"><Paperclip size={15} /></IconButton>}
                        {!t.internal && <IconButton label="Duplicar" className="hidden md:inline-flex" onClick={() => quickAdd({ duplicate: t })}><Copy size={15} /></IconButton>}
                        {!t.internal && <IconButton label="Editar" className="hidden md:inline-flex" onClick={() => quickAdd({ editing: t })}><Pencil size={15} /></IconButton>}
                        <ConfirmDelete onConfirm={() => remove('transactions', t.id)} />
                      </>} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
      <ImportStatement open={importOpen} onClose={() => setImportOpen(false)} />
      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Comprovante">
        {viewingPhoto ? <img src={viewingPhoto.dataUrl} alt="Comprovante" className="mx-auto max-h-[70dvh] rounded-2xl" /> : <p className="text-sm text-slate-400">Foto não encontrada.</p>}
      </Modal>
    </div>
  );
}
