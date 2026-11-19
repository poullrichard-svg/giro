import { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Download, FileUp, PiggyBank, Plus, Trash2, Wallet } from 'lucide-react';
import { useData } from '../../data/DataProvider';
import { useToast } from '../../data/toast';
import { Button, Card, Empty, Field, Input, Modal, MoneyInput, NumberInput, Segmented, Select, cx } from '../../components/ui';
import { Donut } from '../../components/charts';
import { buildPositions, guessKind, KIND_COLOR, KIND_LABEL, opsToCSV, portfolioSummary, positionsToCSV, type Position } from '../../lib/portfolio';
import { dedupe, parsePortfolio, textToRows, type ImportResult } from '../../lib/portfolioImport';
import type { Asset } from '../../lib/market';
import { formatBRL, formatDate, formatNumber, localISODate } from '../../lib/format';
import type { InvestmentKind, InvestmentOp } from '../../types';
import { useAssetSheet } from './AssetSheet';

const KIND_OPTIONS = (Object.keys(KIND_LABEL) as InvestmentKind[]).map((k) => ({ value: k, label: KIND_LABEL[k].replace(/s$/, '').replace('Açõe', 'Ação').replace('Cripto', 'Criptomoeda') }));
const isFixed = (k: InvestmentKind) => k === 'renda-fixa' || k === 'outro';
const qtyText = (q: number) => formatNumber(q, q % 1 ? 6 : 0).replace(/(,\d*?)0+$/, '$1').replace(/,$/, '');
const pctText = (v: number | null) => (v == null ? '—' : `${v > 0 ? '+' : ''}${formatNumber(v, 2)}%`);

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export type OpPreset = { ticker?: string; kind?: InvestmentKind; side?: InvestmentOp['side']; price?: number };

export function PortfolioTab({ assets, preset, onPresetUsed }: { assets: Asset[]; preset: OpPreset | null; onPresetUsed: () => void }) {
  const { data } = useData();
  const [form, setForm] = useState<OpPreset | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  useEffect(() => { if (preset) { setForm(preset); onPresetUsed(); } }, [preset, onPresetUsed]);
  const positions = useMemo(() => buildPositions(data.investments, assets), [data.investments, assets]);
  const sum = useMemo(() => portfolioSummary(positions), [positions]);
  const open = positions.filter((p) => p.quantity > 0 || p.value > 0);
  const pos = detail ? positions.find((p) => p.ticker === detail) : null;

  const actions = (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => setForm({})}><Plus size={16} /> Operação</Button>
      <Button variant="soft" onClick={() => setImportOpen(true)}><FileUp size={15} /> Importar</Button>
      {data.investments.length > 0 && <>
        <Button variant="soft" onClick={() => download(`giro-operacoes-${localISODate()}.csv`, opsToCSV(data.investments))}><Download size={15} /> Operações</Button>
        <Button variant="soft" onClick={() => download(`giro-carteira-${localISODate()}.csv`, positionsToCSV(positions))}><Download size={15} /> Posições</Button>
      </>}
    </div>
  );

  return (
    <div className="space-y-4">
      {data.investments.length === 0 ? (
        <Card>
          <Empty icon={<Wallet size={28} />} title="Sua carteira de investimentos" text="Registre compras e vendas (ações, FIIs, ETFs, cripto, Tesouro, CDB…) e acompanhe o valor atualizado, o preço médio e o resultado. Ou importe tudo da B3." action={actions} />
          <div className="mt-2 rounded-2xl bg-white/[.03] p-4 text-xs text-slate-400 ring-1 ring-white/[.05]">
            <p className="font-bold text-slate-200">Como baixar da B3 (grátis):</p>
            <p className="mt-1">investidor.b3.com.br → Extratos → <b>Negociação</b> → escolha o período → baixe em Excel. Depois toque em <b>Importar</b> e escolha o arquivo.</p>
          </div>
        </Card>
      ) : (
        <>
          <section className="tinted relative overflow-hidden rounded-[2rem] p-5 md:p-6" style={{ '--tone': sum.profit >= 0 ? '#10b981' : '#e11d48' } as React.CSSProperties}>
            <span className="watermark text-white"><PiggyBank size={150} strokeWidth={1.2} /></span>
            <div className="relative">
              <p className="label text-white/70">Minha carteira</p>
              <p className="mt-1 font-display text-4xl font-black text-white" data-testid="portfolio-value">{formatBRL(sum.value)}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-bold">
                <span className={cx('rounded-full px-3 py-1', sum.profit >= 0 ? 'bg-emerald-300/20 text-emerald-100' : 'bg-rose-300/20 text-rose-100')} data-testid="portfolio-profit">{sum.profit >= 0 ? '+' : ''}{formatBRL(sum.profit)} ({pctText(sum.profitPct)})</span>
                {sum.day !== 0 && <span className="rounded-full bg-black/25 px-3 py-1 text-white/90">Hoje {sum.day > 0 ? '+' : ''}{formatBRL(sum.day)}</span>}
              </div>
              <p className="mt-3 text-xs text-white/75">Investido {formatBRL(sum.invested)} · {sum.count} {sum.count === 1 ? 'ativo' : 'ativos'}{sum.realized ? ` · vendas: ${sum.realized >= 0 ? '+' : ''}${formatBRL(sum.realized)}` : ''}</p>
            </div>
          </section>
          {actions}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
            <Card title="Divisão por tipo">
              <Donut data={sum.allocation.map((a) => ({ label: KIND_LABEL[a.kind], value: a.value, color: KIND_COLOR[a.kind] }))} />
            </Card>
            <Card title="Meus ativos">
              <ul className="space-y-2" data-testid="positions">
                {open.map((p) => <PositionRow key={p.ticker} p={p} total={sum.value} onOpen={() => setDetail(p.ticker)} />)}
              </ul>
              {positions.some((p) => !p.quoted) && <p className="mt-3 text-[11px] text-slate-500">Ativos sem cotação aparecem pelo valor investido.</p>}
            </Card>
          </div>
        </>
      )}
      <OpForm preset={form} assets={assets} positions={positions} onClose={() => setForm(null)} />
      <ImportModal open={importOpen} assets={assets} onClose={() => setImportOpen(false)} />
      {pos && <PositionModal p={pos} assets={assets} onClose={() => setDetail(null)} onNew={(pr) => { setDetail(null); setForm(pr); }} />}
    </div>
  );
}

function PositionRow({ p, total, onOpen }: { p: Position; total: number; onOpen: () => void }) {
  const color = KIND_COLOR[p.kind];
  return (
    <li>
      <button type="button" onClick={onOpen} className="surface surface-hover press flex w-full min-w-0 items-center gap-3 rounded-[1.3rem] p-3 text-left" data-ticker={p.ticker}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[10px] font-black text-white" style={{ background: `color-mix(in srgb, ${color} 30%, var(--color-panel))`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 45%, transparent)` }}>{isFixed(p.kind) ? 'RF' : p.ticker.slice(0, 4)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display font-black text-white">{p.ticker}</span>
          <span className="block truncate text-[11px] text-slate-500">{isFixed(p.kind) ? `${KIND_LABEL[p.kind]} · aplicado ${formatBRL(p.invested)}` : `${qtyText(p.quantity)} × PM ${formatBRL(p.avgPrice)}`} · {total > 0 ? formatNumber((p.value / total) * 100, 1) : 0}%</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-mono text-sm font-extrabold text-white">{formatBRL(p.value)}</span>
          <span className={cx('inline-flex items-center font-mono text-[11px] font-extrabold', p.profit > 0 ? 'text-emerald-300' : p.profit < 0 ? 'text-rose-300' : 'text-slate-400')}>{p.profit > 0 ? <ArrowUpRight size={12} /> : p.profit < 0 ? <ArrowDownRight size={12} /> : null}{pctText(p.profitPct)}</span>
        </span>
      </button>
    </li>
  );
}

function PositionModal({ p, assets, onClose, onNew }: { p: Position; assets: Asset[]; onClose: () => void; onNew: (pr: OpPreset) => void }) {
  const { remove } = useData();
  const toast = useToast();
  const sheet = useAssetSheet();
  const quote = assets.find((a) => a.ticker === p.ticker);
  const [armed, setArmed] = useState<string | null>(null);
  return (
    <Modal open onClose={onClose} title={p.ticker}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {[['Valor atual', formatBRL(p.value)], ['Resultado', `${p.profit >= 0 ? '+' : ''}${formatBRL(p.profit)} (${pctText(p.profitPct)})`],
            isFixed(p.kind) ? ['Aplicado', formatBRL(p.invested)] : ['Quantidade', qtyText(p.quantity)], isFixed(p.kind) ? ['Desde', formatDate(p.firstDate)] : ['Preço médio', formatBRL(p.avgPrice)],
            ...(!isFixed(p.kind) ? [['Cotação', p.price != null ? formatBRL(p.price) : 'sem cotação'], ['Vendas (realizado)', formatBRL(p.realized)]] : [])].map(([l, v]) => (
            <div key={l} className="rounded-2xl bg-white/[.03] p-3 ring-1 ring-white/[.05]"><p className="label text-slate-500">{l}</p><p className="truncate font-mono text-sm font-extrabold text-white">{v}</p></div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {isFixed(p.kind) ? <>
            <Button className="flex-1" onClick={() => onNew({ ticker: p.ticker, kind: p.kind, side: 'valor' })}>Atualizar valor</Button>
            <Button variant="soft" onClick={() => onNew({ ticker: p.ticker, kind: p.kind, side: 'compra' })}>Aplicar mais</Button>
            <Button variant="soft" onClick={() => onNew({ ticker: p.ticker, kind: p.kind, side: 'venda' })}>Resgatar</Button>
          </> : <>
            <Button className="flex-1" onClick={() => onNew({ ticker: p.ticker, kind: p.kind, side: 'compra', price: p.price ?? undefined })}>Comprar mais</Button>
            <Button variant="soft" onClick={() => onNew({ ticker: p.ticker, kind: p.kind, side: 'venda', price: p.price ?? undefined })}>Vender</Button>
            {quote && <Button variant="soft" onClick={() => { onClose(); sheet.open(quote); }}>Ficha</Button>}
          </>}
        </div>
        <div>
          <p className="label mb-2 text-slate-500">Operações</p>
          <ul className="space-y-1.5">
            {[...p.ops].reverse().map((o) => (
              <li key={o.id} className="flex items-center gap-3 rounded-2xl bg-white/[.03] px-3 py-2.5 text-sm ring-1 ring-white/[.05]">
                <span className={cx('label shrink-0 rounded-full px-2 py-0.5 !text-[9px]', o.side === 'compra' ? 'bg-emerald-500/15 text-emerald-300' : o.side === 'venda' ? 'bg-rose-500/15 text-rose-300' : 'bg-sky-500/15 text-sky-300')}>{o.side}</span>
                <span className="min-w-0 flex-1 truncate text-slate-300">{formatDate(o.date)} · {o.side === 'valor' ? formatBRL(o.price) : isFixed(o.kind) ? formatBRL(o.quantity * o.price) : `${qtyText(o.quantity)} × ${formatBRL(o.price)}`}</span>
                <button type="button" aria-label="Apagar operação" onClick={async () => { if (armed !== o.id) return setArmed(o.id); if (await remove('investments', o.id)) { toast('Operação apagada'); if (p.ops.length === 1) onClose(); } }}
                  className={cx('press shrink-0 rounded-lg p-1.5', armed === o.id ? 'bg-rose-500 text-white' : 'text-slate-500 hover:text-rose-300')}><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
          {armed && <p className="mt-1 text-[11px] text-rose-300">Toque de novo na lixeira para apagar.</p>}
        </div>
      </div>
    </Modal>
  );
}

function OpForm({ preset, assets, positions, onClose }: { preset: OpPreset | null; assets: Asset[]; positions: Position[]; onClose: () => void }) {
  const { insert } = useData();
  const toast = useToast();
  const blank = { ticker: '', kind: 'acao' as InvestmentKind, side: 'compra' as InvestmentOp['side'], quantity: 0, price: 0, fees: 0, date: localISODate(), note: '' };
  const [f, setF] = useState(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!preset) return;
    setErrors({});
    const q = preset.ticker ? assets.find((a) => a.ticker === preset.ticker!.toUpperCase()) : null;
    setF({ ...blank, ...preset, ticker: preset.ticker ?? '', kind: preset.kind ?? blank.kind, side: preset.side ?? 'compra', price: preset.side === 'valor' ? 0 : preset.price ?? q?.price ?? 0, quantity: preset.kind && isFixed(preset.kind) ? 1 : 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);
  useEffect(() => setErrors({}), [f]);
  if (!preset) return null;
  const fixed = isFixed(f.kind);
  const tickerUp = fixed ? f.ticker.trim() : f.ticker.trim().toUpperCase();
  const held = positions.find((p) => p.ticker.toUpperCase() === tickerUp.toUpperCase());
  const quote = assets.find((a) => a.ticker === tickerUp);
  const total = fixed ? f.price : f.quantity * f.price + (f.fees || 0) * (f.side === 'compra' ? 1 : -1);

  const pickTicker = (t: string) => {
    const up = t.toUpperCase();
    const q = assets.find((a) => a.ticker === up);
    setF((x) => ({ ...x, ticker: fixed ? t : up, ...(q && !fixed ? { kind: guessKind(up, assets), price: x.price || q.price || 0 } : {}) }));
  };
  const save = async () => {
    const e: Record<string, string> = {};
    if (!tickerUp) e.ticker = fixed ? 'Dê um nome (ex.: CDB Inter 110% CDI).' : 'Informe o código (ex.: PETR4, MXRF11, BTC).';
    if (!fixed && !(f.quantity > 0)) e.quantity = 'Quantidade maior que zero.';
    if (!(f.price > 0)) e.price = fixed ? 'Informe o valor.' : 'Informe o preço.';
    if (f.side === 'venda' && !fixed && held && f.quantity > held.quantity + 1e-9) e.quantity = `Você tem ${qtyText(held.quantity)}.`;
    if (f.side === 'venda' && !held) e.ticker = 'Você não tem este ativo na carteira.';
    if (f.side === 'venda' && fixed && held && f.price > held.value + 0.004) e.price = `Valor atual é ${formatBRL(held.value)}.`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date) || f.date > localISODate()) e.date = 'Data inválida ou no futuro.';
    setErrors(e);
    if (Object.keys(e).length) return;
    // Renda fixa: resgate de R de uma posição que vale V com Q "cotas" → vende (R/V)·Q cotas a V/Q cada.
    const op = fixed
      ? (f.side === 'venda' && held && held.value > 0 ? { quantity: (f.price / held.value) * held.quantity, price: held.value / held.quantity } : { quantity: 1, price: f.price })
      : { quantity: f.quantity, price: f.price };
    const ok = await insert('investments', { ticker: tickerUp, kind: f.kind, side: f.side, ...op, fees: fixed ? null : f.fees || null, date: f.date, note: f.note.trim() || null });
    if (ok) { toast(f.side === 'compra' ? 'Compra registrada' : f.side === 'venda' ? 'Venda registrada' : 'Valor atualizado'); onClose(); }
  };

  return (
    <Modal open onClose={onClose} title={f.side === 'valor' ? `Atualizar valor · ${f.ticker}` : f.side === 'venda' ? (fixed ? 'Resgate' : 'Venda') : fixed ? 'Aplicação' : 'Compra'}
      footer={<Button className={cx('w-full', f.side === 'venda' && '!from-rose-500 !via-rose-600 !to-rose-700 !shadow-rose-500/70')} onClick={save}>Salvar{total > 0 && f.side !== 'valor' ? ` · ${formatBRL(total)}` : ''}</Button>}>
      <div className="space-y-4">
        {f.side !== 'valor' && <Segmented value={f.side} onChange={(s) => setF({ ...f, side: s })} indicator={f.side === 'venda' ? 'from-rose-500 to-rose-700 shadow-rose-500' : undefined} options={[{ value: 'compra', label: fixed ? 'Aplicar' : 'Comprar' }, { value: 'venda', label: fixed ? 'Resgatar' : 'Vender' }]} />}
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] items-start gap-3">
          <Field label="Tipo"><Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as InvestmentKind, quantity: isFixed(e.target.value as InvestmentKind) ? 1 : f.quantity })} options={KIND_OPTIONS} /></Field>
          <Field label={fixed ? 'Nome' : 'Código'} error={errors.ticker}>
            <Input value={f.ticker} onChange={(e) => pickTicker(e.target.value)} list="giro-tickers" placeholder={fixed ? 'Ex.: Tesouro Selic 2029' : 'Ex.: PETR4'} autoCapitalize={fixed ? 'sentences' : 'characters'} maxLength={60} />
          </Field>
        </div>
        {!fixed && <datalist id="giro-tickers">{assets.slice(0, 400).map((a) => <option key={a.ticker} value={a.ticker}>{a.name}</option>)}</datalist>}
        {quote && !fixed && <p className="-mt-2 text-xs text-slate-400">{quote.name} · agora {quote.price != null ? formatBRL(quote.price) : '—'}{held ? ` · você tem ${qtyText(held.quantity)}` : ''}</p>}
        {fixed ? (
          <Field label={f.side === 'valor' ? 'Quanto vale hoje (total)' : f.side === 'venda' ? 'Valor resgatado' : 'Valor aplicado'} error={errors.price} hint={f.side === 'valor' ? 'Veja no app do banco ou da corretora' : undefined}>
            <MoneyInput value={f.price} onChange={(v) => setF({ ...f, price: v })} />
          </Field>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-3">
            <Field label="Quantidade" error={errors.quantity}><NumberInput value={f.quantity} onChange={(v) => setF({ ...f, quantity: v })} step="any" /></Field>
            <Field label="Preço unitário" error={errors.price}><MoneyInput value={f.price} onChange={(v) => setF({ ...f, price: v })} /></Field>
          </div>
        )}
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-3">
          <Field label="Data" error={errors.date}><Input type="date" value={f.date} max={localISODate()} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          {!fixed && <Field label="Taxas (opcional)"><MoneyInput value={f.fees} onChange={(v) => setF({ ...f, fees: v })} placeholder="R$ 0,00" /></Field>}
        </div>
        <Field label="Observação"><Input value={f.note} maxLength={80} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Ex.: corretora, motivo da compra" /></Field>
      </div>
    </Modal>
  );
}

function ImportModal({ open, assets, onClose }: { open: boolean; assets: Asset[]; onClose: () => void }) {
  const { data, insert } = useData();
  const toast = useToast();
  const [text, setText] = useState('');
  const [res, setRes] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setText(''); setRes(null); } }, [open]);
  const fresh = res ? dedupe(res.ops, data.investments) : null;

  const readFile = async (file: File) => {
    setBusy(true);
    try {
      if (/\.xlsx$/i.test(file.name)) {
        const { default: readXlsxFile } = await import('read-excel-file/browser');
        const sheets = await readXlsxFile(file);
        const results = sheets.map((s) => parsePortfolio(s.data as never, assets)).filter((r) => r.ops.length);
        setRes(results.length ? { ...results[0], ops: results.flatMap((r) => r.ops), skipped: results.reduce((t, r) => t + r.skipped, 0), errors: results.flatMap((r) => r.errors) } : parsePortfolio((sheets[0]?.data ?? []) as never, assets));
      } else setRes(parsePortfolio(textToRows(await file.text()), assets));
    } catch { setRes({ format: 'desconhecido', ops: [], skipped: 0, errors: ['Não consegui ler esse arquivo. Use .xlsx (Excel) ou .csv.'] }); }
    finally { setBusy(false); }
  };
  const doImport = async () => {
    if (!fresh?.fresh.length) return;
    setBusy(true);
    const ok = await insert('investments', fresh.fresh);
    setBusy(false);
    if (ok) { toast(fresh.fresh.length === 1 ? "1 operação importada" : `${fresh.fresh.length} operações importadas`); onClose(); }
  };
  const FORMAT: Record<ImportResult['format'], string> = { 'b3-negociacao': 'B3 · Negociação', 'b3-movimentacao': 'B3 · Movimentação', giro: 'Giro', simples: 'Planilha simples', desconhecido: '—' };

  return (
    <Modal open={open} onClose={onClose} title="Importar carteira"
      footer={<Button className="w-full" disabled={busy || !fresh?.fresh.length} onClick={doImport}>{fresh?.fresh.length ? `Importar ${fresh.fresh.length} ${fresh.fresh.length === 1 ? 'operação' : 'operações'}` : 'Importar'}</Button>}>
      <div className="space-y-4">
        <div className="rounded-2xl bg-white/[.03] p-3.5 text-xs text-slate-400 ring-1 ring-white/[.05]">
          <p><b className="text-slate-200">Da B3:</b> investidor.b3.com.br → Extratos → Negociação (ou Movimentação) → baixe o Excel.</p>
          <p className="mt-1"><b className="text-slate-200">De outra planilha:</b> colunas <i>ativo, quantidade, preço</i> (e, se tiver, <i>data</i> e <i>operação</i>).</p>
        </div>
        <label className="surface surface-hover press flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/10 p-5 text-sm font-bold text-slate-300">
          <FileUp size={18} /> {busy ? 'Lendo…' : 'Escolher arquivo (.xlsx ou .csv)'}
          <input type="file" accept=".xlsx,.csv,.txt,text/csv" className="hidden" data-testid="portfolio-file" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) readFile(file); }} />
        </label>
        <Field label="Ou cole aqui (copie da planilha)">
          <textarea value={text} onChange={(e) => { setText(e.target.value); setRes(e.target.value.trim() ? parsePortfolio(textToRows(e.target.value), assets) : null); }} rows={4}
            className="w-full rounded-2xl border border-white/[.07] bg-[var(--field)] p-3 font-mono text-base text-white outline-none md:text-xs" placeholder={'Ativo;Quantidade;Preço\nPETR4;100;35,20'} />
        </Field>
        {res && (
          <div className="space-y-2" data-testid="import-preview">
            <p className="text-sm text-slate-300">Formato: <b className="text-white">{FORMAT[res.format]}</b> · {res.ops.length} {res.ops.length === 1 ? 'operação encontrada' : 'operações encontradas'}{fresh && fresh.duplicates ? ` · ${fresh.duplicates} já estavam na carteira` : ''}{res.skipped ? ` · ${res.skipped} linhas ignoradas` : ''}</p>
            {fresh && fresh.fresh.length > 0 && (
              <ul className="max-h-48 space-y-1 overflow-auto text-xs">
                {fresh.fresh.slice(0, 30).map((o, i) => <li key={i} className="flex justify-between gap-2 rounded-xl bg-white/[.03] px-3 py-1.5 text-slate-300"><span className="truncate">{formatDate(o.date)} · <b className={o.side === 'venda' ? 'text-rose-300' : 'text-emerald-300'}>{o.side}</b> · {o.ticker}</span><span className="shrink-0 font-mono">{qtyText(o.quantity)} × {formatBRL(o.price)}</span></li>)}
              </ul>
            )}
            {res.errors.slice(0, 5).map((e, i) => <p key={i} className="text-xs text-amber-300">{e}</p>)}
          </div>
        )}
      </div>
    </Modal>
  );
}
