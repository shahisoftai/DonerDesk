import Link from "next/link";

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        {items.map((crumb, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${crumb.href ?? crumb.label}-${index}`} className="flex items-center gap-1.5">
              {index > 0 && <span aria-hidden="true">/</span>}
              {isLast || !crumb.href ? (
                <span aria-current={isLast ? "page" : undefined} className={isLast ? "font-semibold text-slate-800 dark:text-slate-100" : undefined}>
                  {crumb.label}
                </span>
              ) : (
                <Link href={crumb.href} className="hover:text-brand-600 hover:underline dark:hover:text-brand-300">
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
