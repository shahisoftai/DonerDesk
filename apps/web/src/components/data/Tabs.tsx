"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";

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
    "rounded-md px-3 py-1.5",
    active
      ? "bg-brand-500/10 font-medium text-brand-700 dark:bg-brand-400/10 dark:text-brand-300"
      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5",
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
    <nav aria-label={label} className="flex flex-wrap items-center gap-1 border-b border-slate-200 pb-2 text-sm dark:border-white/10">
      {items.map((tab) => {
        const active = activeHref === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(linkClass(active), tab.secondary && "hidden sm:inline-block")}
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
