"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";
import { sidebarHrefFor } from "@/features/navigation/domain/role-navigation";
import { NAV_ICON } from "./nav-icons";

export type NavItem = {
  href: string;
  label: string;
  capability?: string;
};

/** The sidebar (v4): grouped entries with an icon each on the navy rail; a hub's tab pages light the hub's entry. */
export function SideNav({
  items,
  onNavigate,
}: {
  items: Array<{ href: string; label: string; group?: string; active?: boolean }>;
  activeHref?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const hubHref = sidebarHrefFor(pathname);

  function isActive(item: { href: string; active?: boolean }): boolean {
    if (item.active !== undefined) return item.active;
    if (hubHref) return item.href === hubHref;
    if (item.href === "/dashboard") return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + "/");
  }

  return (
    <nav aria-label="Primary">
      <ul className="space-y-0.5">
        {items.map((item, index) => {
          const active = isActive(item);
          const heading = item.group && item.group !== items[index - 1]?.group ? item.group : null;
          const Icon = NAV_ICON[item.href];
          return (
            <li key={item.href} className={heading && index > 0 ? "pt-4" : undefined}>
              {heading && <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">{heading}</p>}
              <Link
                href={item.href}
                prefetch={false}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex min-h-9 items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300",
                  active ? "bg-white/[0.12] font-medium text-white" : "text-slate-300 hover:bg-white/[0.06] hover:text-white",
                )}
              >
                {Icon && <Icon aria-hidden="true" className={cn("h-4 w-4 shrink-0", active ? "text-brand-300" : "text-slate-400 group-hover:text-slate-200")} />}
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
