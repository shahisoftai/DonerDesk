"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/components/ui/cn";
import { SkipLink } from "./SkipLink";
import { SideNav } from "./SideNav";
import { NotificationBell, type BellItem } from "./NotificationBell";
import { UserMenu } from "./UserMenu";
import { ThemeToggle } from "@/components/ThemeToggle";

export function AppShell({
  orgName,
  user,
  navItems,
  canCreate,
  bellItems,
  children,
}: {
  orgName: string;
  user: { name: string; email: string } | null;
  navItems: Array<{ href: string; label: string }>;
  canCreate: boolean;
  bellItems: BellItem[];
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
        menuButtonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [mobileOpen]);

  return (
    <div className="min-h-screen">
      <SkipLink />
      <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              ref={menuButtonRef}
              type="button"
              aria-label="Open navigation menu"
              aria-expanded={mobileOpen}
              className="grid h-11 w-11 place-items-center rounded-xl border border-slate-300 text-slate-600 lg:hidden dark:border-white/15 dark:text-slate-300"
              onClick={() => setMobileOpen(true)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
            </button>
            <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 text-lg font-black text-white shadow-lg shadow-brand-500/30">
                D
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{orgName || "DonorDesk"}</span>
                <span className="block truncate text-xs text-slate-500 dark:text-slate-400">Donor reporting workspace</span>
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            {canCreate && (
              <Link href="/projects/new" className="btn hidden px-3 text-xs sm:inline-flex">
                + New project
              </Link>
            )}
            <ThemeToggle />
            <NotificationBell items={bellItems} />
            <UserMenu name={user?.name ?? ""} email={user?.email ?? ""} />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 sm:px-6">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-56 shrink-0 overflow-y-auto py-6 lg:block">
          <SideNav items={navItems} />
        </aside>

        <main id="main-content" className="min-w-0 flex-1 py-6" tabIndex={-1}>
          {children}
        </main>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="presentation">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className={cn("absolute left-0 top-0 h-full w-72 bg-white p-4 shadow-2xl dark:bg-slate-900")}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold">{orgName || "DonorDesk"}</span>
              <button type="button" aria-label="Close navigation menu" className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-white/5" onClick={() => setMobileOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="mt-4">
              <SideNav items={navItems} onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
