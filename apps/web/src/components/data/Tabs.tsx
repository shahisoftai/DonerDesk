"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";
import { TOUCH } from "@/components/ui/touch";

export type TabItem = {
  label: string;
  href: string;
  /** Folded into a "More" menu on narrow screens. */
  secondary?: boolean;
  /** Extra path prefixes that also mark this tab active. */
  matchPrefixes?: string[];
};

function matchLength(pathname: string, item: TabItem): number {
  let best = -1;
  for (const prefix of [item.href, ...(item.matchPrefixes ?? [])]) {
    if ((pathname === prefix || pathname.startsWith(`${prefix}/`)) && prefix.length > best) best = prefix.length;
  }
  return best;
}

const linkClass = (active: boolean) =>
  cn(
    TOUCH.row,
    "relative px-3 py-2 font-medium transition-colors",
    active
      ? "text-slate-950 after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-brand-700 dark:text-white dark:after:bg-brand-300"
      : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
  );

export function Tabs({ items, label }: { items: TabItem[]; label: string }) {
  const pathname = usePathname();
  let activeHref: string | undefined;
  let bestLength = -1;
  for (const item of items) {
    const length = matchLength(pathname, item);
    if (length > bestLength) {
      bestLength = length;
      activeHref = item.href;
    }
  }
  const secondary = items.filter((item) => item.secondary);
  const activeSecondary = secondary.find((item) => item.href === activeHref);

  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-1 border-b border-slate-200 text-sm dark:border-white/10">
      {items.map((tab) => {
        const active = activeHref === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            prefetch={false}
            aria-current={active ? "page" : undefined}
            className={cn(linkClass(active), tab.secondary && "hidden sm:inline-flex")}
          >
            {tab.label}
          </Link>
        );
      })}
      {secondary.length > 0 && (
        <details className="relative sm:hidden">
          <summary className={cn(linkClass(Boolean(activeSecondary)), "cursor-pointer list-none")}>
            {activeSecondary ? activeSecondary.label : "More"} ▾
          </summary>
          <div className="absolute left-0 z-20 mt-1 flex min-w-40 flex-col rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-white/10 dark:bg-slate-900">
            {secondary.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                prefetch={false}
                aria-current={activeHref === tab.href ? "page" : undefined}
                className={linkClass(activeHref === tab.href)}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </details>
      )}
    </nav>
  );
}
