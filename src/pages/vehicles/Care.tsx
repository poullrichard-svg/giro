import { useEffect, useState } from 'react';
import { CircleDot, Filter, RefreshCw, Search, TrendingDown } from 'lucide-react';
import { useData } from '../../data/DataProvider';
import { useToast } from '../../data/toast';
import { Button, Card, Field, Modal, Progress, Select, cx } from '../../components/ui';
import { Line } from '../../components/charts';
import { depreciation, kmPerDay, parseFipeValue, wearItems, type WearKey } from '../../lib/vehicleCare';
import { addDays, formatBRL, formatDate, formatNumber, localISODate } from '../../lib/format';
import type { FipeRef, Vehicle } from '../../types';

const LAST_FIELD: Record<WearKey, keyof Vehicle> = { oleo: 'lastOilChangeKm', pneus: 'tireInstalledKm', ar: 'airFilterLastKm', combustivel: 'fuelFilterLastKm', cabine: 'cabinFilterLastKm' };

/** Pneus e filtros: barra de desgaste de cada item e botão "troquei hoje". */
export function CareCard({ v, onEdit }: { v: Vehicle; onEdit: () => void }) {
  const { update } = useData();
  const toast = useToast();
  const items = wearItems(v).filter((i) => i.key !== 'oleo');
  const perDay = kmPerDay(v.tireInstalledKm ?? 0, v.tireInstalledDate, v.odometer);
  const changed = async (key: WearKey, label: string) => {
    const patch: Partial<Vehicle> = { [LAST_FIELD[key]]: v.odometer } as Partial<Vehicle>;
    if (key === 'pneus') patch.tireInstalledDate = localISODate();
    if (await update('vehicles', v.id, patch)) toast(`${label}: troca registrada em ${formatNumber(v.odometer)} km`);
  };
  return (
    <Card className="mt-4" title={<><CircleDot size={14} className="text-sky-400" /> Pneus e filtros</>} action={<Button variant="soft" onClick={onEdit}>Configurar</Button>}>
      {(v.tireSize || v.tireBrand) && <p className="mb-3 text-sm text-slate-300">Pneus: <b className="text-white">{[v.tireSize, v.tireBrand].filter(Boolean).join(' · ')}</b>{v.tireInstalledDate ? ` · colocados em ${formatDate(v.tireInstalledDate)}` : ''}</p>}
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">Informe a medida e a duração dos pneus e os intervalos dos filtros (ar, combustível, cabine) em <b>Configurar</b> para o Giro avisar quando trocar.</p>
      ) : (
        <ul className="space-y-4" data-testid="care-items">
          {items.map((i) => {
            const eta = i.key === 'pneus' && perDay && i.remaining > 0 ? addDays(localISODate(), Math.round(i.remaining / perDay)) : null;
            return (
              <li key={i.key} data-key={i.key}>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 text-sm font-bold text-white">{i.key === 'pneus' ? <CircleDot size={15} className="shrink-0 text-slate-400" /> : <Filter size={15} className="shrink-0 text-slate-400" />}<span className="truncate">{i.label}</span></span>
                  <button type="button" onClick={() => changed(i.key, i.label)} className="label press shrink-0 rounded-full bg-white/[.05] px-3 py-1.5 text-brand-300 ring-1 ring-white/10">Troquei hoje</button>
                </div>
                <Progress value={i.pct} tone={i.level === 'trocar' ? 'bad' : i.level === 'atencao' ? 'warn' : 'good'} />
                <p className={cx('mt-1 text-xs', i.level === 'trocar' ? 'text-rose-300' : i.level === 'atencao' ? 'text-amber-300' : 'text-slate-400')}>
                  {i.remaining > 0 ? `Faltam ${formatNumber(i.remaining)} km` : `Passou ${formatNumber(-i.remaining)} km — hora de trocar`} · rodou {formatNumber(i.usedKm)} de {formatNumber(i.intervalKm)} km
                  {eta ? ` · troca prevista por volta de ${formatDate(eta)}` : ''}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** FIPE atual, histórico guardado e depreciação. */
export function FipeCard({ v }: { v: Vehicle }) {
  const { update } = useData();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const d = depreciation(v);
  const hist = [...(v.fipeHistory ?? [])].sort((a, b) => a.date.localeCompare(b.date));

  const refresh = async () => {
    if (!v.fipe) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/fipe?tipo=${v.fipe.type}&marca=${v.fipe.brandId}&modelo=${v.fipe.modelId}&ano=${v.fipe.yearId}`);
      const j = await r.json();
      if (!r.ok || !j?.Valor) throw new Error();
      await saveFipe(v, { ...v.fipe, value: parseFipeValue(j.Valor), refMonth: String(j.MesReferencia ?? '').trim() || null, code: j.CodigoFipe ?? v.fipe.code, updatedAt: localISODate() }, update);
      toast('FIPE atualizada');
    } catch { toast('Não deu para consultar a FIPE agora.', 'error'); } finally { setBusy(false); }
  };

  return (
    <Card className="mt-4" title={<><TrendingDown size={14} className="text-amber-400" /> Tabela FIPE e depreciação</>}
      action={v.fipe ? <Button variant="soft" disabled={busy} onClick={refresh}><RefreshCw size={14} className={busy ? 'animate-spin' : ''} /> Atualizar</Button> : undefined}>
      {!v.fipe ? (
        <div className="text-sm text-slate-400">
          <p>Consulte o valor do seu {v.kind === 'moto' ? 'moto' : 'veículo'} na tabela FIPE. Guardando a consulta todo mês, o Giro mostra quanto ele desvaloriza.</p>
          <Button className="mt-3" onClick={() => setOpen(true)}><Search size={15} /> Consultar FIPE</Button>
        </div>
      ) : (
        <div className="space-y-3" data-testid="fipe">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="min-w-0">
              <p className="label text-slate-500">Valor FIPE {v.fipe.refMonth ? `· ${v.fipe.refMonth}` : ''}</p>
              <p className="font-display text-3xl font-black text-white">{formatBRL(v.fipe.value)}</p>
              <p className="truncate text-xs text-slate-500">{v.fipe.label}{v.fipe.code ? ` · código ${v.fipe.code}` : ''}</p>
            </div>
            <button type="button" onClick={() => setOpen(true)} className="label text-brand-300 underline underline-offset-2">Trocar modelo</button>
          </div>
          {d && d.base > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-white/[.03] p-3 ring-1 ring-white/[.05]"><p className="label text-slate-500">{d.lost >= 0 ? 'Desvalorizou' : 'Valorizou'}</p><p className={cx('font-mono text-sm font-extrabold', d.lost >= 0 ? 'text-rose-300' : 'text-emerald-300')}>{formatBRL(Math.abs(d.lost))} ({formatNumber(Math.abs(d.pct), 1)}%)</p><p className="text-[11px] text-slate-500">desde o {d.baseLabel} ({formatBRL(d.base)})</p></div>
              <div className="rounded-2xl bg-white/[.03] p-3 ring-1 ring-white/[.05]"><p className="label text-slate-500">Por mês</p><p className="font-mono text-sm font-extrabold text-white">{d.perMonth != null ? formatBRL(d.perMonth) : '—'}</p><p className="text-[11px] text-slate-500">{d.perYear != null ? `${formatBRL(d.perYear)} por ano` : 'informe a data da compra'}</p></div>
            </div>
          ) : <p className="text-xs text-slate-500">Para ver a depreciação, informe o preço e a data da compra em Editar (ou atualize a FIPE nos próximos meses).</p>}
          {hist.length > 1 && <div><p className="label mb-1 text-slate-500">Histórico da FIPE</p><Line points={hist.map((h) => h.value)} color="#f59e0b" /></div>}
          <p className="text-[11px] text-slate-500">A desvalorização não sai do bolso todo mês, mas é dinheiro que o veículo perde — vale guardar para a troca.</p>
        </div>
      )}
      <FipeModal open={open} v={v} onClose={() => setOpen(false)} />
    </Card>
  );
}

async function saveFipe(v: Vehicle, fipe: FipeRef, update: ReturnType<typeof useData>['update']) {
  const hist = [...(v.fipeHistory ?? [])].filter((h) => (h.ref ?? h.date.slice(0, 7)) !== (fipe.refMonth ?? fipe.updatedAt.slice(0, 7)));
  hist.push({ date: fipe.updatedAt, value: fipe.value, ref: fipe.refMonth ?? null });
  return update('vehicles', v.id, { fipe, fipeHistory: hist.sort((a, b) => a.date.localeCompare(b.date)).slice(-36) });
}

type Opt = { codigo: string | number; nome: string };

function FipeModal({ open, v, onClose }: { open: boolean; v: Vehicle; onClose: () => void }) {
  const { update } = useData();
  const toast = useToast();
  const [tipo, setTipo] = useState<FipeRef['type']>(v.kind === 'moto' ? 'motos' : 'carros');
  const [marcas, setMarcas] = useState<Opt[]>([]); const [marca, setMarca] = useState('');
  const [modelos, setModelos] = useState<Opt[]>([]); const [modelo, setModelo] = useState('');
  const [anos, setAnos] = useState<Opt[]>([]); const [ano, setAno] = useState('');
  const [result, setResult] = useState<{ Valor: string; Modelo: string; Marca: string; AnoModelo: number; Combustivel: string; CodigoFipe: string; MesReferencia: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const get = async (qs: string) => { const r = await fetch(`/api/fipe?${qs}`); if (!r.ok) throw new Error(String(r.status)); return r.json(); };
  const fail = () => setErr('Não deu para consultar a FIPE agora. Tente de novo em instantes.');

  useEffect(() => { if (!open) return; setErr(null); setMarca(''); setModelos([]); setModelo(''); setAnos([]); setAno(''); setResult(null); get(`tipo=${tipo}`).then(setMarcas).catch(fail); }, [open, tipo]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setModelo(''); setAnos([]); setAno(''); setResult(null); if (marca) get(`tipo=${tipo}&marca=${marca}`).then(setModelos).catch(fail); }, [marca]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setAno(''); setResult(null); if (modelo) get(`tipo=${tipo}&marca=${marca}&modelo=${modelo}`).then(setAnos).catch(fail); }, [modelo]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setResult(null); if (ano) get(`tipo=${tipo}&marca=${marca}&modelo=${modelo}&ano=${ano}`).then(setResult).catch(fail); }, [ano]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!result) return;
    const fipe: FipeRef = { type: tipo, brandId: marca, modelId: modelo, yearId: ano, code: result.CodigoFipe, label: `${result.Marca} ${result.Modelo} ${result.AnoModelo} ${result.Combustivel}`.trim(), value: parseFipeValue(result.Valor), refMonth: String(result.MesReferencia ?? '').trim() || null, updatedAt: localISODate() };
    if (await saveFipe(v, fipe, update)) { toast('FIPE salva no veículo'); onClose(); }
  };
  const opts = (l: Opt[], ph: string) => [{ value: '', label: ph }, ...l.map((o) => ({ value: String(o.codigo), label: o.nome }))];

  return (
    <Modal open={open} onClose={onClose} title="Consultar tabela FIPE" footer={<Button className="w-full" disabled={!result} onClick={save}>{result ? `Salvar ${result.Valor}` : 'Escolha o modelo e o ano'}</Button>}>
      <div className="space-y-3">
        <Field label="Tipo"><Select value={tipo} onChange={(e) => setTipo(e.target.value as FipeRef['type'])} options={[{ value: 'carros', label: 'Carro' }, { value: 'motos', label: 'Moto' }, { value: 'caminhoes', label: 'Caminhão / van' }]} /></Field>
        <Field label="Marca"><Select value={marca} onChange={(e) => setMarca(e.target.value)} options={opts(marcas, marcas.length ? 'Escolha a marca' : 'Carregando…')} /></Field>
        {marca && <Field label="Modelo"><Select value={modelo} onChange={(e) => setModelo(e.target.value)} options={opts(modelos, modelos.length ? 'Escolha o modelo' : 'Carregando…')} /></Field>}
        {modelo && <Field label="Ano"><Select value={ano} onChange={(e) => setAno(e.target.value)} options={opts(anos, anos.length ? 'Escolha o ano' : 'Carregando…')} /></Field>}
        {result && (
          <div className="rounded-2xl bg-amber-500/10 p-4 ring-1 ring-amber-500/20" data-testid="fipe-result">
            <p className="label text-amber-300">Valor FIPE · {String(result.MesReferencia).trim()}</p>
            <p className="font-display text-2xl font-black text-white">{result.Valor}</p>
            <p className="text-xs text-slate-400">{result.Marca} {result.Modelo} · {result.AnoModelo} · {result.Combustivel} · código {result.CodigoFipe}</p>
          </div>
        )}
        {err && <p role="alert" className="text-sm text-rose-300">{err}</p>}
        <p className="text-[11px] text-slate-500">Fonte: tabela FIPE (via parallelum.com.br). Valor médio de mercado; o preço real de venda pode variar.</p>
      </div>
    </Modal>
  );
}
