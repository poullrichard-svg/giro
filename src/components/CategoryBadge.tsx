import { colorFor } from '../lib/categories';

/** Pastilha colorida com a inicial da categoria. */
export function CategoryBadge({ category }: { category: string }) {
  const c = colorFor(category);
  return (
    <span className="solid flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-display text-base font-black transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6" style={{ '--tone': c } as React.CSSProperties}>
      {category.charAt(0)}
    </span>
  );
}
