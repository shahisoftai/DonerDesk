import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/components/ui/cn";

/**
 * Page anatomy (Version 4.000, plan §7). A page is a `PageHeader`, an optional `Toolbar`, then `Section`s stacked with
 * 32 px between them; related small sections sit side by side in a `SectionGroup`. Every section has a heading and one
 * surface, so sections never run into each other.
 */

export interface Crumb { href?: string; label: string }

export function Breadcrumbs({ items }: { items: readonly Crumb[] }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className="mb-1.5">
      <ol className="flex flex-wrap items-center gap-1 text-[13px] text-slate-500 dark:text-slate-400">
        {items.map((c, i) => (
          <li key={`${c.label}-${i}`} className="flex items-center gap-1">
            {i > 0 && <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 opacity-60 rtl:rotate-180" />}
            {c.href && i < items.length - 1 ? (
              <Link href={c.href} className="rounded-sm hover:text-slate-900 hover:underline hover:underline-offset-[3px] dark:hover:text-white">{c.label}</Link>
            ) : (
              <span aria-current={i === items.length - 1 ? "page" : undefined} className={i === items.length - 1 ? "text-slate-700 dark:text-slate-200" : undefined}>{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PageHeader({
  title,
  description,
  crumbs,
  actions,
  meta,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  crumbs?: readonly Crumb[];
  /** At most one primary action; the rest secondary or in a menu. */
  actions?: ReactNode;
  /** Small facts under the title (status pill, dates). */
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("border-b border-slate-200 pb-5 dark:border-white/10", className)}>
      {crumbs && <Breadcrumbs items={crumbs} />}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-slate-950 [text-wrap:balance] dark:text-white">{title}</h1>
          {description && <p className="mt-1.5 max-w-3xl text-sm text-slate-600 dark:text-slate-400">{description}</p>}
          {meta && <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">{meta}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/** Filters, search and a view switch on one row under the page header. */
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center gap-2", className)}>{children}</div>;
}

/** The page body: header, toolbar and sections with an even rhythm. */
export function PageBody({ children, className, wide = false }: { children: ReactNode; className?: string; /** Sheets, canvases and maps use the full width. */ wide?: boolean }) {
  return <div className={cn("page-stack animate-fade-in", !wide && "mx-auto w-full max-w-[1280px]", className)}>{children}</div>;
}

export function Section({
  title,
  description,
  actions,
  children,
  id,
  className,
  bare = false,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  id?: string;
  className?: string;
  /** A section whose content brings its own surface (a table component, a chart tile grid). */
  bare?: boolean;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={title ? headingId : undefined} className={cn(!bare && "card", "min-w-0", className)}>
      {(title || actions) && (
        <div className="section-head">
          <div className="min-w-0">
            {title && <h2 id={headingId} className="section-title">{title}</h2>}
            {description && <p className="section-desc">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Related small sections side by side from 1024 px (2 or 3 columns); stacked on phones. */
export function SectionGroup({ children, columns = 2, className }: { children: ReactNode; columns?: 2 | 3; className?: string }) {
  return <div className={cn("grid gap-6", columns === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2", className)}>{children}</div>;
}

/** The actions of a long form, kept in view at the bottom of the screen. */
export function StickyActions({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 dark:border-white/10 dark:bg-[#0b1220]/90">
      <div className="text-[13px] text-slate-500 dark:text-slate-400">{note}</div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
