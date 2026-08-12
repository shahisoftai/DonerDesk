import Link from "next/link";

export function ActiveFilterChips({
  filters,
  label = "Active filters",
}: {
  filters: Array<{ label: string; removeHref: string }>;
  label?: string;
}) {
  if (filters.length === 0) return null;
  return (
    <div aria-label={label} className="flex flex-wrap gap-1.5">
      {filters.map((filter) => (
        <span
          key={filter.label}
          className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/30 bg-brand-500/5 px-2.5 py-0.5 text-xs text-brand-700 dark:border-brand-400/30 dark:bg-brand-400/10 dark:text-brand-300"
        >
          {filter.label}
          <Link
            href={filter.removeHref}
            aria-label={`Remove filter ${filter.label}`}
            className="rounded-full p-0.5 hover:bg-brand-500/10"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </Link>
        </span>
      ))}
    </div>
  );
}
