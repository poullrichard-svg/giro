import { useId } from 'react';

/** Marca do Giro: um ciclo (o dinheiro girando) com a seta para cima. */
export function Logo({ size = 32, spin }: { size?: number; spin?: boolean }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="drop-shadow-[0_8px_16px_rgba(34,197,94,.45)]">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22c55e" />
          <stop offset="1" stopColor="#15803d" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill={`url(#${id})`} />
      <rect x="1" y="1" width="62" height="62" rx="17" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1" />
      <g style={spin ? { transformOrigin: '32px 32px', animation: 'logo-spin 1.2s cubic-bezier(.6,0,.3,1) infinite' } : undefined}>
        <path d="M44 22a15 15 0 1 0 4 12" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
        <path d="M38 18h9v9" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
