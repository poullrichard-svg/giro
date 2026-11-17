import { useState, type FormEvent, useEffect } from 'react';
import { ListChecks, Plus, ShoppingCart } from 'lucide-react';
import { useData } from '../data/DataProvider';
import { useQuickAdd } from '../components/Shell';
import { BigTile, Button, Card, Check, ConfirmDelete, Empty, Input, MoneyInput, NumberInput, PageHeader, Row, Select } from '../components/ui';
import { hasErrors, rules, validate, type Errors } from '../lib/validate';
import { formatBRL } from '../lib/format';

export default function Shopping() {
  const { data, insert, update, remove } = useData();
  const quickAdd = useQuickAdd();
  const [name, setName] = useState('');
  const [qty, setQty] = useState(1);
  const [unit, setUnit] = useState('UN');
  const [price, setPrice] = useState(0);
  const [errors, setErrors] = useState<Errors<'name' | 'qty'>>({});
  // Some com o erro assim que a pessoa mexe no formulário; volta a validar ao salvar.
  useEffect(() => { setErrors({}); }, [name, qty]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validate({ name: [rules.required(name, 'Nome do item'), rules.maxLength(name, 60, 'Nome')], qty: [rules.positive(qty, 'Quantidade')] });
    setErrors(errs);
    if (hasErrors(errs)) return;
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
      <PageHeader eyebrow="Mercado" title="Lista de compras" subtitle="Marque o que já pegou e veja o total do carrinho" />
      <div className="stagger mb-5 grid grid-cols-2 gap-3 md:gap-4">
        <BigTile label="Gasto planejado total" money={total} tone="good" icon={<ShoppingCart />} />
        <BigTile label="Itens na lista" value={`${items.length} ${items.length === 1 ? 'item' : 'itens'}`} tone="info" icon={<ListChecks />} sub={`${items.filter((i) => i.completed).length} no carrinho · ${formatBRL(inCart)}`} />
      </div>
      <form onSubmit={add} className="surface mb-5 grid grid-cols-[72px_104px_1fr] gap-2 rounded-[1.75rem] p-3 md:grid-cols-[1fr_90px_110px_150px_auto]">
        <Input className={`col-span-3 md:col-span-1 ${errors.name ? '!border-rose-500/70' : ''}`} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="Adicionar item…" />
        <NumberInput value={qty} onChange={setQty} />
        <Select value={unit} onChange={(e) => setUnit(e.target.value)} options={['UN', 'KG', 'G', 'L', 'ML', 'PCT', 'CX']} />
        <MoneyInput value={price} onChange={setPrice} placeholder="Preço" />
        <Button type="submit" className="col-span-3 md:col-span-1"><Plus size={16} strokeWidth={3} /> Adicionar</Button>
      </form>
      {(errors.name || errors.qty) && <p role="alert" className="pop-in -mt-3 mb-4 px-2 text-[12px] font-semibold text-rose-400">{errors.name ?? errors.qty}</p>}
      <Card title={<><ListChecks size={14} className="text-emerald-400" /> Checklist de compras</>} action={<span className="label hidden rounded-full bg-white/[.04] px-3 py-1.5 text-slate-500 ring-1 ring-white/5 md:inline">Dica: toque no preço para alterar</span>}>
        {items.length === 0 ? <Empty icon={<ShoppingCart size={28} />} title="Lista vazia" text="Adicione o que precisa comprar e acompanhe o total." /> : (
          <ul className="stagger space-y-2.5">
            {items.map((i) => (
              <Row key={i.id} muted={i.completed}
                leading={<Check checked={i.completed} onChange={() => update('shopping', i.id, { completed: !i.completed })} label={i.completed ? 'Tirar do carrinho' : 'Colocar no carrinho'} />}
                title={i.name} subtitle={`${i.quantity} ${i.unit}${i.estimatedPrice > 0 ? ` × ${formatBRL(i.estimatedPrice)}` : ''}`}
                actions={<>
                  <div className="w-28 md:w-32"><MoneyInput value={i.estimatedPrice} onChange={(v) => update('shopping', i.id, { estimatedPrice: v })} className="h-10 min-h-10 rounded-xl text-right font-mono text-xs font-extrabold text-emerald-400" placeholder="preço" /></div>
                  <ConfirmDelete onConfirm={() => remove('shopping', i.id)} />
                </>} />
            ))}
          </ul>
        )}
      </Card>
      {inCart > 0 && <Button className="mt-5 w-full" onClick={finish}>Finalizar compra e lançar {formatBRL(inCart)}</Button>}
    </div>
  );
}
