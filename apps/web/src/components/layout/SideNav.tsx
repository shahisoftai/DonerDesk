"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";

export type NavItem = {
  href: string;
  label: string;
  capability?: string;
};

export function SideNav({
  items,
  activeHref,
  onNavigate,
}: {
  items: Array<{ href: string; label: string; active?: boolean }>;
  activeHref?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  function isActive(item: { href: string; active?: boolean }): boolean {
    if (item.active !== undefined) return item.active;
    if (item.href === "/dashboard") return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + "/");
  }

  return (
    <nav aria-label="Primary">
      <ul className="space-y-1">
        {items.map((item) => {
          const active = isActive(item);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium transition",
                  active
                    ? "bg-brand-500/10 text-brand-700 dark:bg-brand-400/10 dark:text-brand-300"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
