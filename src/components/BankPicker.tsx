import { BANKS, bankByName } from '../lib/banks';
import { cx } from './ui';

/** Escolha rápida do banco: preenche nome e cor. "Outro" deixa digitar o nome. */
export function BankPicker({ name, onPick, onOther }: { name: string; onPick: (name: string, color: string) => void; onOther: () => void }) {
  const current = bankByName(name);
  const other = !!name.trim() && !current;
  return (
    <div role="group" aria-label="Banco" className="grid grid-cols-4 gap-2 sm:grid-cols-6">
      {BANKS.map((b) => {
        const on = current?.name === b.name;
        return (
          <button key={b.name} type="button" aria-pressed={on} aria-label={b.name} onClick={() => onPick(b.name, b.color)}
            className={cx('press flex min-w-0 flex-col items-center gap-1 rounded-2xl p-2 ring-1 transition', on ? 'bg-white/10 ring-2' : 'bg-white/[.03] ring-white/[.06] hover:bg-white/[.06]')}
            style={on ? { boxShadow: `0 0 0 2px ${b.color}` } : undefined}>
            <span className="keep-dark flex h-9 w-9 items-center justify-center rounded-xl text-[10px] font-black text-white" style={{ background: b.color }}>{b.short}</span>
            <span className="w-full truncate text-center text-[10px] font-bold text-slate-300">{b.name}</span>
          </button>
        );
      })}
      <button type="button" aria-pressed={other} aria-label="Outro banco" onClick={onOther}
        className={cx('press flex min-w-0 flex-col items-center gap-1 rounded-2xl p-2 ring-1', other ? 'bg-white/10 ring-2 ring-brand-400' : 'bg-white/[.03] ring-white/[.06] hover:bg-white/[.06]')}>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-lg font-black text-slate-300">+</span>
        <span className="text-[10px] font-bold text-slate-300">Outro</span>
      </button>
    </div>
  );
}
