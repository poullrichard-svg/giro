import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { AlertTriangle, FileUp } from 'lucide-react';
import { useData } from '../data/DataProvider';
import { useToast } from '../data/toast';
import { findDuplicates, parseStatement, type StatementLine } from '../lib/bankImport';
import { invoiceMonthFor } from '../lib/cards';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../lib/categories';
import { formatBRL, formatDate, monthLabel } from '../lib/format';
import { Button, Check, Field, Modal, Select, cx } from './ui';

type Line = StatementLine & { selected: boolean; duplicate: boolean; blocked?: string };

/** Importar extrato OFX/CSV para uma conta ou cartão, com prévia e repetidos desmarcados. */
export function ImportStatement({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, insert } = useData();
  const toast = useToast();
  const accounts = data.accounts.filter((a) => !a.archived);
  const cards = data.cards.filter((c) => !c.archived);
  const [dest, setDest] = useState('');
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [invoice, setInvoice] = useState('');
  const [busy, setBusy] = useState(false);
  const card = dest.startsWith('card:') ? cards.find((c) => `card:${c.id}` === dest) : undefined;

  useEffect(() => { if (open) { setDest(accounts[0] ? `acc:${accounts[0].id}` : ''); setFile(null); setLines([]); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open]);

  // Lê (de novo) quando muda o arquivo ou o destino: em cartão, valor positivo é compra.
  useEffect(() => {
    if (!file || !dest) return;
    try {
      const parsed = parseStatement(file.name, file.text, !!card);
      if (!parsed.length) { toast('Não encontrei lançamentos neste arquivo.', 'error'); setLines([]); return; }
      const dup = findDuplicates(parsed, data.transactions, card ? { cardId: card.id } : { accountId: dest.slice(4) });
      setLines(parsed.map((l, i) => {
        const blocked = card && l.type === 'income' ? 'Pagamento/estorno da fatura — não entra como compra' : undefined;
        return { ...l, duplicate: dup[i], blocked, selected: !dup[i] && !blocked };
      }));
      if (card) {
        // Fatura mais comum entre as datas do arquivo.
        const count = new Map<string, number>();
        for (const l of parsed) { const m = invoiceMonthFor(l.date, card); count.set(m, (count.get(m) ?? 0) + 1); }
        setInvoice([...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '');
      }
    } catch (e: any) { toast(e.message, 'error'); setLines([]); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, dest]);

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    if (f.size > 5_000_000) { toast('Arquivo grande demais (máx. 5 MB).', 'error'); return; }
    const buf = await f.arrayBuffer();
    // Bancos ainda usam Latin-1 em OFX/CSV; se não for UTF-8 válido, lê como Windows-1252.
    let text: string;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { text = new TextDecoder('windows-1252').decode(buf); }
    setFile({ name: f.name, text });
  };

  const selected = lines.filter((l) => l.selected);
  const totals = useMemo(() => ({
    out: selected.filter((l) => l.type === 'expense').reduce((s, l) => s + l.amount, 0),
    in: selected.filter((l) => l.type === 'income').reduce((s, l) => s + l.amount, 0),
    dup: lines.filter((l) => l.duplicate).length,
  }), [lines, selected]);
  const invoiceOptions = card ? [...new Set([-1, 0, 1, 2].map((k) => { const d = new Date(`${invoice || invoiceMonthFor(new Date().toISOString().slice(0, 10), card)}-01T00:00:00`); d.setMonth(d.getMonth() + k); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }))] : [];

  const doImport = async () => {
    if (!selected.length) return;
    setBusy(true);
    const rows = selected.map((l) => ({
      type: l.type, amount: l.amount, description: l.description, category: l.category, date: l.date, externalId: l.externalId,
      paymentMethod: card ? 'Crédito' : 'Extrato',
      ...(card ? { cardId: card.id, accountId: null, invoiceMonth: invoice } : { accountId: dest.slice(4) }),
    }));
    const ok = await insert('transactions', rows);
    setBusy(false);
    if (ok) { toast(`${rows.length} ${rows.length === 1 ? 'lançamento importado' : 'lançamentos importados'}`); onClose(); }
  };

  const destOptions = [...accounts.map((a) => ({ value: `acc:${a.id}`, label: `Conta · ${a.name}` })), ...cards.map((c) => ({ value: `card:${c.id}`, label: `Cartão · ${c.name}` }))];

  return (
    <Modal open={open} onClose={onClose} title="Importar extrato"
      footer={lines.length ? <Button className="w-full" disabled={busy || !selected.length} onClick={doImport}>{busy ? 'Importando…' : `Importar ${selected.length} ${selected.length === 1 ? 'lançamento' : 'lançamentos'}`}</Button> : undefined}>
      <div className="space-y-4">
        <Field label="Para onde vão os lançamentos"><Select value={dest} onChange={(e) => setDest(e.target.value)} options={destOptions} /></Field>
        <label className="press flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[1.5rem] border-2 border-dashed border-white/15 p-6 text-center hover:border-brand-400/50 hover:bg-brand-500/[.04]">
          <FileUp size={26} className="text-brand-300" />
          <span className="font-display text-base font-black text-white">{file ? file.name : 'Escolher arquivo OFX ou CSV'}</span>
          <span className="text-xs text-slate-400">{file ? 'Toque para trocar' : 'Baixe o extrato no app ou site do banco (OFX é o mais completo)'}</span>
          <input type="file" accept=".ofx,.csv,.txt,text/csv,application/x-ofx" hidden onChange={pick} />
        </label>

        {card && lines.length > 0 && (
          <Field label="Fatura" hint="As compras deste arquivo entram nesta fatura">
            <Select value={invoice} onChange={(e) => setInvoice(e.target.value)} options={invoiceOptions.map((m) => ({ value: m, label: monthLabel(m) }))} />
          </Field>
        )}

        {lines.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-white/[.04] p-3 ring-1 ring-white/5"><p className="label text-slate-500">Selecionados</p><p className="font-display text-lg font-black text-white">{selected.length}/{lines.length}</p></div>
              <div className="rounded-2xl bg-rose-500/[.07] p-3 ring-1 ring-rose-500/15"><p className="label text-rose-300">Saídas</p><p className="font-mono text-sm font-extrabold text-rose-300">{formatBRL(totals.out)}</p></div>
              <div className="rounded-2xl bg-emerald-500/[.07] p-3 ring-1 ring-emerald-500/15"><p className="label text-emerald-300">Entradas</p><p className="font-mono text-sm font-extrabold text-emerald-300">{formatBRL(totals.in)}</p></div>
            </div>
            {totals.dup > 0 && (
              <p className="flex items-start gap-2 rounded-2xl bg-amber-500/[.08] p-3 text-xs font-semibold text-amber-200 ring-1 ring-amber-500/20">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {totals.dup} {totals.dup === 1 ? 'parece já estar' : 'parecem já estar'} no app e {totals.dup === 1 ? 'ficou desmarcado' : 'ficaram desmarcados'}. Marque se quiser importar mesmo assim.
              </p>
            )}
            <div className="flex gap-2">
              <button type="button" className="label press rounded-full bg-white/[.05] px-3 py-1.5 text-slate-300 ring-1 ring-white/10" onClick={() => setLines(lines.map((l) => ({ ...l, selected: !l.blocked })))}>Marcar todos</button>
              <button type="button" className="label press rounded-full bg-white/[.05] px-3 py-1.5 text-slate-300 ring-1 ring-white/10" onClick={() => setLines(lines.map((l) => ({ ...l, selected: false })))}>Desmarcar</button>
            </div>
            <ul className="space-y-2">
              {lines.map((l, i) => (
                <li key={i} className={cx('surface flex items-center gap-3 rounded-[1.2rem] p-2.5 pr-3', !l.selected && 'opacity-55')}>
                  <Check checked={l.selected} label={`Importar ${l.description}`} onChange={() => !l.blocked && setLines(lines.map((x, j) => (j === i ? { ...x, selected: !x.selected } : x)))} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white">{l.description}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="label text-slate-500">{formatDate(l.date)}</span>
                      {l.duplicate && <span className="label rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-300">Repetido?</span>}
                      {l.blocked && <span className="label rounded-full bg-white/10 px-2 py-0.5 text-slate-300">{l.blocked}</span>}
                    </div>
                    {!l.blocked && (
                      <select value={l.category} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, category: e.target.value } : x)))}
                        aria-label="Categoria" className="mt-1.5 max-w-full rounded-lg border border-white/10 bg-[var(--field)] px-2 py-1 text-xs font-semibold text-slate-200">
                        {(l.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => <option key={c}>{c}</option>)}
                      </select>
                    )}
                  </div>
                  <span className={cx('whitespace-nowrap font-mono text-sm font-extrabold', l.type === 'income' ? 'text-emerald-400' : 'text-rose-400')}>{l.type === 'income' ? '+' : '−'} {formatBRL(l.amount)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Modal>
  );
}
