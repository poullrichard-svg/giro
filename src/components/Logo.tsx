/** Marca do Giro: um ciclo (o dinheiro girando) com a seta para cima. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="18" fill="var(--color-brand-500)" />
      <path d="M44 22a15 15 0 1 0 4 12" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
      <path d="M38 18h9v9" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
