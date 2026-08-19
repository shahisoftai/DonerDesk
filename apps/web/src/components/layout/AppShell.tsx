"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/components/ui/cn";
import { SkipLink } from "./SkipLink";
import { SideNav } from "./SideNav";
import { NotificationBell, type BellItem } from "./NotificationBell";
import { UserMenu } from "./UserMenu";
import { ThemeToggle } from "@/components/ThemeToggle";

const NAV_COLLAPSE_KEY = "donordesk:nav-collapsed";

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
  const [navCollapsed, setNavCollapsed] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const searchLinkRef = useRef<HTMLAnchorElement>(null);
  const desktopSidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(NAV_COLLAPSE_KEY);
    if (stored === "1") setNavCollapsed(true);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(NAV_COLLAPSE_KEY, navCollapsed ? "1" : "0");
  }, [navCollapsed]);

  useEffect(() => {
    if (desktopSidebarRef.current) {
      desktopSidebarRef.current.inert = navCollapsed;
    }
  }, [navCollapsed]);

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchLinkRef.current?.focus();
      }
    }
    document.addEventListener("keydown", focusSearch);
    return () => document.removeEventListener("keydown", focusSearch);
  }, []);

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
            <button
              type="button"
              aria-label={navCollapsed ? "Expand navigation sidebar" : "Collapse navigation sidebar"}
              aria-pressed={!navCollapsed}
              title={navCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="hidden h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-300 text-slate-600 transition hover:border-brand-400 hover:text-brand-700 lg:grid dark:border-white/15 dark:text-slate-300 dark:hover:border-brand-400/60 dark:hover:text-brand-300"
              onClick={() => setNavCollapsed((v) => !v)}
            >
              {navCollapsed ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 17l5-5-5-5M13 17l5-5-5-5"/></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 17l-5-5 5-5M18 17l-5-5 5-5"/></svg>
              )}
            </button>
            <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
              <Image
                src="/brand/donordesk-logo.png"
                alt="DonorDesk"
                width={1653}
                height={589}
                className="h-9 w-auto shrink-0 object-contain"
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{orgName || "DonorDesk"}</span>
                <span className="block truncate text-xs text-slate-500 dark:text-slate-400">Donor reporting workspace</span>
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Link
              ref={searchLinkRef}
              href="/projects?focus=search"
              aria-label="Search workspace"
              className="hidden h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white/60 px-3 text-xs text-slate-500 hover:border-brand-400 hover:text-brand-700 sm:flex dark:border-white/15 dark:bg-white/5 dark:text-slate-300"
            >
              <span aria-hidden="true">⌕</span> Search <kbd className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] dark:border-white/15">⌘K</kbd>
            </Link>
            {canCreate && <CreateMenu />}
            <ThemeToggle />
            <NotificationBell items={bellItems} />
            <UserMenu name={user?.name ?? ""} email={user?.email ?? ""} />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 sm:px-6">
        <aside
          ref={desktopSidebarRef}
          aria-hidden={navCollapsed}
          className={cn(
            "sticky top-16 hidden h-[calc(100vh-4rem)] shrink-0 overflow-hidden transition-[width,opacity] duration-300 ease-in-out lg:block",
            navCollapsed ? "w-0 opacity-0" : "w-56 opacity-100",
          )}
        >
          <div className="h-full w-56 overflow-y-auto py-6">
            <SideNav items={navItems} />
          </div>
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

function CreateMenu() {
  return (
    <details className="group relative hidden sm:block">
      <summary className="btn cursor-pointer list-none px-3 text-xs">+ Create</summary>
      <div className="absolute right-0 top-12 z-50 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-slate-900">
        <Link href="/projects/new" className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:hover:bg-white/5">New project</Link>
        <Link href="/projects" className="block rounded-lg px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-white/5">Choose a project to add a report, activity, or evidence</Link>
      </div>
    </details>
  );
}
