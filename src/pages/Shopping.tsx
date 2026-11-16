import { useState, type FormEvent } from 'react';
import { CheckSquare, ShoppingCart, Square } from 'lucide-react';
import { useData } from '../data/DataProvider';
import { useQuickAdd } from '../components/Shell';
import { Button, Card, ConfirmDelete, Empty, Input, MoneyInput, NumberInput, PageHeader, Select, Stat, cx } from '../components/ui';
import { formatBRL } from '../lib/format';

export default function Shopping() {
  const { data, insert, update, remove } = useData();
  const quickAdd = useQuickAdd();
  const [name, setName] = useState('');
  const [qty, setQty] = useState(1);
  const [unit, setUnit] = useState('UN');
  const [price, setPrice] = useState(0);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (await insert('shopping', { name: name.trim(), quantity: qty || 1, unit, estimatedPrice: price, completed: false })) { setName(''); setQty(1); setPrice(0); }
  };

  const items = [...data.shopping].sort((a, b) => Number(a.completed) - Number(b.completed));
  const total = items.reduce((s, i) => s + i.estimatedPrice * i.quantity, 0);
  const inCart = items.filter((i) => i.completed).reduce((s, i) => s + i.estimatedPrice * i.quantity, 0);

  const finish = async () => {
    quickAdd({ text: `gastei ${inCart.toFixed(2).replace('.', ',')} mercado` });
    await Promise.all(items.filter((i) => i.completed).map((i) => remove('shopping', i.id)));
  };

  return (
    <div>
      <PageHeader title="Lista de compras" subtitle="Marque o que já pegou e veja o total do carrinho" />
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Stat label="Total estimado" money={total} />
        <Stat label="No carrinho" money={inCart} tone="good" sub={`${items.filter((i) => i.completed).length}/${items.length} itens`} />
      </div>
      <form onSubmit={add} className="mb-4 grid grid-cols-[1fr_70px_80px] gap-2 md:grid-cols-[1fr_90px_90px_140px_auto]">
        <Input className="col-span-3 md:col-span-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Adicionar item…" />
        <NumberInput value={qty} onChange={setQty} />
        <Select value={unit} onChange={(e) => setUnit(e.target.value)} options={['UN', 'KG', 'G', 'L', 'ML', 'PCT', 'CX']} />
        <MoneyInput value={price} onChange={setPrice} placeholder="Preço" />
        <Button type="submit" className="col-span-3 md:col-span-1">Adicionar</Button>
      </form>
      <Card className="p-0 md:p-0">
        {items.length === 0 ? <Empty icon={<ShoppingCart size={32} />} title="Lista vazia" /> : (
          <ul className="divide-y divide-white/5">
            {items.map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-4 py-2">
                <button onClick={() => update('shopping', i.id, { completed: !i.completed })} className={i.completed ? 'text-emerald-400' : 'text-slate-500'} aria-label="Marcar">{i.completed ? <CheckSquare size={22} /> : <Square size={22} />}</button>
                <div className="min-w-0 flex-1">
                  <p className={cx('truncate text-sm', i.completed ? 'text-slate-500 line-through' : 'text-slate-200')}>{i.name}</p>
                  <p className="text-xs text-slate-500">{i.quantity} {i.unit}{i.estimatedPrice > 0 ? ` × ${formatBRL(i.estimatedPrice)}` : ''}</p>
                </div>
                <div className="w-28"><MoneyInput value={i.estimatedPrice} onChange={(v) => update('shopping', i.id, { estimatedPrice: v })} className="h-9 min-h-9 text-right text-xs" placeholder="preço" /></div>
                <ConfirmDelete onConfirm={() => remove('shopping', i.id)} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      {inCart > 0 && <Button className="mt-4 w-full" onClick={finish}>Finalizar compra e lançar {formatBRL(inCart)}</Button>}
    </div>
  );
}
