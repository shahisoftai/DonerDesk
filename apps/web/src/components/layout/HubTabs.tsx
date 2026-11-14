"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";

/**
 * Tabs across related pages that share one sidebar entry (Home and Portfolio; Reports, Evidence, Compliance and Downloads).
 * Shown only on the pages of a hub; which tabs a person sees comes from `hubTabsFor` (role-navigation.ts).
 */
export function HubTabs({ hubs }: { hubs: ReadonlyArray<ReadonlyArray<{ href: string; label: string }>> }) {
  const pathname = usePathname();
  const isOn = (href: string) => (href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(href + "/"));
  const hub = hubs.find((tabs) => tabs.some((t) => isOn(t.href)));
  // Only at the top of a hub page itself, not on its detail pages (a report's own workspace has its own header).
  if (!hub || !hub.some((t) => pathname === t.href)) return null;
  return (
    <nav aria-label="Section" className="-mt-1 mb-6 overflow-x-auto border-b border-slate-200 dark:border-white/10">
      <ul className="flex min-w-max gap-1">
        {hub.map((t) => {
          const on = isOn(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                prefetch={false}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "relative inline-flex min-h-10 items-center px-3 text-sm font-medium transition-colors",
                  on
                    ? "text-brand-700 after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-brand-700 dark:text-brand-300 dark:after:bg-brand-300"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
                )}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
