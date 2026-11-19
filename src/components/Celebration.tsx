import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Trophy } from 'lucide-react';

const COLORS = ['#22c55e', '#facc15', '#3b82f6', '#ec4899', '#f97316', '#a855f7', '#ffffff'];

/** Confete + cartão de parabéns ao concluir uma meta. Some sozinho ou ao tocar. */
export function Celebration({ title, onClose, label = 'Meta concluída', text = 'Parabéns! Você chegou lá.' }: { title: string; onClose: () => void; label?: string; text?: string }) {
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const pieces = useMemo(() => (reduce ? [] : Array.from({ length: 90 }, (_, i) => ({
    left: Math.random() * 100, delay: Math.random() * 0.6, dur: 2.2 + Math.random() * 1.6, color: COLORS[i % COLORS.length],
    size: 6 + Math.random() * 8, rot: Math.random() * 360, drift: (Math.random() - 0.5) * 160, round: Math.random() > 0.6,
  }))), [reduce]);
  useEffect(() => { const t = setTimeout(onClose, 5000); return () => clearTimeout(t); }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 animate-fade" onClick={onClose} role="alertdialog" aria-label={label}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {pieces.map((p, i) => (
          <span key={i} className="confetti absolute top-[-20px] block" style={{
            left: `${p.left}%`, width: p.size, height: p.round ? p.size : p.size * 0.45, background: p.color, borderRadius: p.round ? '9999px' : '2px',
            animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, ['--drift' as string]: `${p.drift}px`, ['--rot' as string]: `${p.rot}deg`,
          }} />
        ))}
      </div>
      <div className="surface pop-in relative mx-6 max-w-sm rounded-[2rem] p-7 text-center shadow-2xl">
        <div className="solid float mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-[1.6rem]" style={{ '--tone': '#f59e0b' } as React.CSSProperties}><Trophy size={40} /></div>
        <p className="label text-amber-300">{label}</p>
        <p className="mt-1 font-display text-2xl font-black text-white">🎉 {title}</p>
        <p className="mt-2 text-sm text-slate-400">{text}</p>
      </div>
    </div>,
    document.body,
  );
}
