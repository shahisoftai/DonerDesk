"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";

export interface SettingsGroup { label: string; items: Array<{ label: string; href: string }> }

/** The settings side list: groups with headings on wide screens, one scrolling row of links on a phone. */
export function SettingsNav({ groups }: { groups: readonly SettingsGroup[] }) {
  const pathname = usePathname();
  const on = (href: string) => (href === "/settings" ? pathname === href : pathname === href || pathname.startsWith(href + "/"));
  return (
    <nav aria-label="Settings" className="lg:sticky lg:top-24 lg:self-start">
      <p className="mb-3 hidden text-[22px] font-semibold tracking-[-0.02em] text-slate-950 lg:block dark:text-white">Settings</p>
      <ul className="flex gap-1 overflow-x-auto pb-2 lg:block lg:space-y-5 lg:overflow-visible lg:pb-0">
        {groups.map((g) => (
          <li key={g.label} className="contents lg:block">
            <p className="hidden px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400 lg:block">{g.label}</p>
            <ul className="contents lg:block lg:space-y-0.5">
              {g.items.map((i) => (
                <li key={i.href} className="shrink-0">
                  <Link
                    href={i.href}
                    prefetch={false}
                    aria-current={on(i.href) ? "page" : undefined}
                    className={cn(
                      "flex min-h-9 items-center whitespace-nowrap rounded-lg px-3 text-sm transition-colors",
                      on(i.href) ? "bg-brand-50 font-medium text-brand-800 dark:bg-white/[0.08] dark:text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5",
                    )}
                  >
                    {i.label}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  );
}
