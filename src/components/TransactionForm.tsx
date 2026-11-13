import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { Transaction, TxType } from '../types';
import { useData } from '../data/DataProvider';
import { useToast } from '../data/toast';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS } from '../lib/categories';
import { formatBRL, localISODate } from '../lib/format';
import { parseQuickEntry } from '../lib/quickParse';
import { Button, Field, Input, Modal, MoneyInput, Segmented, Select } from './ui';

export interface TxPreset { type?: TxType; text?: string; editing?: Transaction }

const blank = (type: TxType = 'expense') => ({ type, amount: 0, description: '', category: type === 'expense' ? 'Alimentação' : 'Salário', paymentMethod: 'Pix', date: localISODate(), vehicleId: '' });

export default function TransactionForm({ open, onClose, preset }: { open: boolean; onClose: () => void; preset?: TxPreset }) {
  const { insert, update, data } = useData();
  const toast = useToast();
  const [quick, setQuick] = useState('');
  const [f, setF] = useState(blank());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const e = preset?.editing;
    if (e) setF({ type: e.type, amount: e.amount, description: e.description, category: e.category, paymentMethod: e.paymentMethod, date: e.date, vehicleId: e.vehicleId ?? '' });
    else setF(blank(preset?.type));
    setQuick(preset?.text ?? '');
    if (preset?.text) applyQuick(preset.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preset]);

  const applyQuick = (text: string) => {
    const p = parseQuickEntry(text);
    if (p) setF((x) => ({ ...x, ...p }));
  };

  const cats = f.type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const vehicles = data.vehicles.filter((v) => v.active);
  const showVehicle = vehicles.length > 0 && f.type === 'expense' && ['Veículo', 'Combustível', 'Transporte'].includes(f.category);

  const save = async () => {
    if (f.amount <= 0) { toast('Informe um valor', 'error'); return; }
    setBusy(true);
    const payload = { ...f, description: f.description.trim() || f.category, vehicleId: f.vehicleId || null };
    const ok = preset?.editing ? await update('transactions', preset.editing.id, payload) : !!(await insert('transactions', payload));
    setBusy(false);
    if (ok) { toast(preset?.editing ? 'Lançamento atualizado' : `${f.type === 'income' ? 'Receita' : 'Despesa'} de ${formatBRL(f.amount)} lançada`); onClose(); }
  };

  return (
    <Modal open={open} onClose={onClose} title={preset?.editing ? 'Editar lançamento' : 'Novo lançamento'}
      footer={<Button className="w-full" disabled={busy} onClick={save}>{busy ? 'Salvando…' : 'Salvar'}</Button>}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
        {!preset?.editing && (
          <Field label="Lançamento rápido" hint='Ex.: "gastei 35 almoço no pix", "recebi 1200 salário", "abasteci 150 ontem"'>
            <div className="relative">
              <Sparkles size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
              <Input className="pl-9" value={quick} placeholder="Escreva como falaria…" onChange={(e) => { setQuick(e.target.value); applyQuick(e.target.value); }} />
            </div>
          </Field>
        )}
        <Segmented value={f.type} onChange={(t) => setF((x) => ({ ...x, type: t, category: t === 'expense' ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0] }))}
          options={[{ value: 'expense', label: 'Despesa' }, { value: 'income', label: 'Receita' }]} />
        <Field label="Valor"><MoneyInput value={f.amount} onChange={(v) => set('amount', v)} className="text-lg font-semibold" /></Field>
        <Field label="Descrição"><Input value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Ex.: Mercado do mês" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoria"><Select value={cats.includes(f.category) ? f.category : 'Outros'} onChange={(e) => set('category', e.target.value)} options={cats} /></Field>
          <Field label="Pagamento"><Select value={f.paymentMethod} onChange={(e) => set('paymentMethod', e.target.value)} options={PAYMENT_METHODS} /></Field>
        </div>
        <Field label="Data"><Input type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></Field>
        {showVehicle && (
          <Field label="Veículo (opcional)">
            <Select value={f.vehicleId} onChange={(e) => set('vehicleId', e.target.value)} options={[{ value: '', label: '—' }, ...vehicles.map((v) => ({ value: v.id, label: `${v.name} ${v.plate}` }))]} />
          </Field>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
