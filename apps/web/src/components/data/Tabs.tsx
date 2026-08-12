"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";

export type TabItem = { label: string; href: string };

export function Tabs({ items, label }: { items: TabItem[]; label: string }) {
  const pathname = usePathname();
  const activeHref = items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav aria-label={label} className="flex flex-wrap gap-1 border-b border-slate-200 pb-2 text-sm dark:border-white/10">
      {items.map((tab) => {
        const active = activeHref === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5",
              active
                ? "bg-brand-500/10 font-semibold text-brand-700 dark:bg-brand-400/10 dark:text-brand-300"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
