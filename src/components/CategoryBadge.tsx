import { colorFor } from '../lib/categories';

/** Quadradinho colorido com a inicial da categoria. */
export function CategoryBadge({ category }: { category: string }) {
  const c = colorFor(category);
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ background: `linear-gradient(135deg, ${c}, ${c}88)`, boxShadow: `0 6px 16px -6px ${c}` }}>
      {category.charAt(0)}
    </span>
  );
}
