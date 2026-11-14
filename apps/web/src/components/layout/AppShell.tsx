"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/components/ui/cn";
import { SkipLink } from "./SkipLink";
import { SideNav } from "./SideNav";
import { PhoneTabBar } from "./PhoneTabBar";
import { NotificationBell, type BellItem } from "./NotificationBell";
import { UserMenu } from "./UserMenu";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LocaleSwitcher } from "@/features/i18n/presentation/LocaleSwitcher";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { useRecordSheet } from "@/features/record/presentation/RecordHost";
import { BookmarkButton } from "@/features/bookmarks/presentation/BookmarkButton";
import { AcademyHeaderButton } from "@/features/tour/presentation/AcademyHeaderButton";
import { useStartOrResumeTour } from "@/features/tour/presentation/useStartOrResumeTour";
import { TOUR_INTENT_KEY } from "@/features/tour/presentation/TourIntentLink";
import { CommandPalette, openCommandPalette } from "@/features/command/presentation/CommandPalette";
import { HubTabs } from "./HubTabs";
import { Menu, PanelLeftClose, PanelLeftOpen, Plus, Search, X } from "lucide-react";

const NAV_COLLAPSE_KEY = "donordesk:nav-collapsed";

export function AppShell({
  orgName,
  user,
  navItems,
  canCreate,
  canRecord = false,
  phoneBar = false,
  bellItems,
  hubTabs = [],
  capabilities = [],
  children,
}: {
  orgName: string;
  user: { name: string; email: string } | null;
  navItems: Array<{ href: string; label: string; group?: string }>;
  canCreate: boolean;
  /** The person may record something (a number, an activity, a file, an expense or a form answer). */
  canRecord?: boolean;
  /** Show the phone's bottom bar (Today, Record, Waiting, More): for people whose home is the field home. */
  phoneBar?: boolean;
  bellItems: BellItem[];
  /** Tabs across pages that share a sidebar entry (role-navigation.ts `hubTabsFor`). */
  hubTabs?: ReadonlyArray<ReadonlyArray<{ href: string; label: string }>>;
  /** What the person may do: the command palette offers only these. */
  capabilities?: readonly string[];
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const desktopSidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(NAV_COLLAPSE_KEY);
    if (stored === "1") setNavCollapsed(true);
  }, []);

  // A visitor who clicked "Take the product tour" on the marketing page before
  // signing up: honor that intent the first time they reach the portal, then
  // clear it so it never fires again for this browser.
  const { startOrResumeTour } = useStartOrResumeTour();
  useEffect(() => {
    let intent: string | null = null;
    try {
      intent = window.localStorage.getItem(TOUR_INTENT_KEY);
    } catch {
      return;
    }
    if (intent === "1") {
      window.localStorage.removeItem(TOUR_INTENT_KEY);
      startOrResumeTour();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const brand = (
    <Link href="/dashboard" prefetch={false} className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300">
      <Image src="/brand/donordesk-logo.png" alt="" width={552} height={600} className="h-8 w-auto shrink-0 rounded-md bg-white/95 object-contain p-0.5" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-white">{orgName || "DonorDesk"}</span>
        <span className="block truncate text-[11px] text-slate-400">DonorDesk</span>
      </span>
    </Link>
  );

  return (
    <div className="min-h-screen text-sm leading-5">
      <SkipLink />
      <CommandPalette capabilities={capabilities} />
      <div className="flex">
        {/* The navy rail (v4). Collapsing it gives the page the full width. */}
        <aside
          ref={desktopSidebarRef}
          aria-hidden={navCollapsed}
          className={cn(
            "sticky top-0 hidden h-screen shrink-0 overflow-hidden bg-[#0f1b3d] transition-[width] duration-300 ease-in-out motion-reduce:transition-none lg:block",
            navCollapsed ? "w-0" : "w-60",
          )}
        >
          <div className="flex h-full w-60 flex-col">
            <div className="flex h-16 items-center px-4">{brand}</div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6 pt-2">
              <SideNav items={navItems} />
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header role="banner" className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur-xl dark:border-white/10 dark:bg-[#0b1220]/85">
            <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  ref={menuButtonRef}
                  type="button"
                  aria-label="Open navigation menu"
                  aria-expanded={mobileOpen}
                  className="btn-ghost btn-icon lg:hidden"
                  onClick={() => setMobileOpen(true)}
                >
                  <Menu aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={navCollapsed ? "Expand navigation sidebar" : "Collapse navigation sidebar"}
                  aria-pressed={!navCollapsed}
                  title={navCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                  className="btn-ghost btn-icon hidden lg:inline-flex"
                  onClick={() => setNavCollapsed((v) => !v)}
                >
                  {navCollapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
                </button>
                <button
                  type="button"
                  onClick={openCommandPalette}
                  aria-label="Search and commands (Ctrl K)"
                  className="hidden h-9 w-[min(22rem,32vw)] items-center gap-2 rounded-lg bg-slate-100 px-3 text-[13px] text-slate-500 ring-1 ring-inset ring-slate-200 transition hover:bg-white hover:ring-slate-300 sm:flex dark:bg-white/5 dark:text-slate-400 dark:ring-white/10 dark:hover:bg-white/10"
                >
                  <Search aria-hidden="true" className="h-4 w-4" />
                  <span className="flex-1 text-start">Search or jump to…</span>
                  <kbd className="rounded border border-slate-300 bg-white px-1.5 text-[10px] font-medium dark:border-white/15 dark:bg-transparent">Ctrl K</kbd>
                </button>
                <button type="button" onClick={openCommandPalette} aria-label="Search and commands" className="btn-ghost btn-icon sm:hidden"><Search aria-hidden="true" /></button>
              </div>
              <div className="flex items-center gap-1.5">
                <BookmarkButton />
                <AcademyHeaderButton />
                <LocaleSwitcher />
                <ThemeToggle />
                <NotificationBell items={bellItems} />
                <RecordMenu canCreate={canCreate} canRecord={canRecord} hideOnPhone={phoneBar} />
                <UserMenu name={user?.name ?? ""} email={user?.email ?? ""} />
              </div>
            </div>
          </header>

          <main id="main-content" className={cn("min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8", phoneBar && "pb-28 lg:pb-8")} tabIndex={-1}>
            <div className="mx-auto w-full max-w-[1440px]">
              <HubTabs hubs={hubTabs} />
              {children}
            </div>
          </main>
        </div>
      </div>

      {phoneBar && <PhoneTabBar />}

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="presentation">
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="absolute inset-y-0 start-0 flex w-72 animate-[slide-in-right_0.2s_ease-out] flex-col bg-[#0f1b3d] p-3 shadow-panel rtl:animate-none"
          >
            <div className="flex items-center justify-between gap-2 px-1 pb-3">
              {brand}
              <button type="button" aria-label="Close navigation menu" className="grid h-10 w-10 place-items-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white" onClick={() => setMobileOpen(false)}>
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <SideNav items={navItems} onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The header's one menu (Phase 44): "Record" opens the Record sheet; "Create" keeps what the old menu offered. A person who can only
 * record gets a single button that opens the sheet; one who can only create gets the old menu; one who can do both gets both under
 * two headings. It is on every screen size, so recording is never more than a tap away.
 */
function RecordMenu({ canCreate, canRecord, hideOnPhone }: { canCreate: boolean; canRecord: boolean; /** The bottom bar has the Record button on a phone, so the header's one is not shown there. */ hideOnPhone: boolean }) {
  const record = useRecordSheet();
  const { t } = useI18n();
  const menu = useRef<HTMLDetailsElement>(null);
  const close = () => { if (menu.current) menu.current.open = false; };
  const plus = <Plus aria-hidden="true" />;

  if (!canRecord && !canCreate) return null;
  if (canRecord && !canCreate) {
    return (
      <button type="button" className={cn("btn-primary min-h-9 gap-1.5 px-3", hideOnPhone && "max-lg:hidden")} aria-label={t("record.button")} onClick={() => record.open()}>
        {plus}<span className="hidden sm:inline">{t("record.button")}</span>
      </button>
    );
  }
  return (
    <details ref={menu} className={cn("group relative", hideOnPhone && "max-lg:hidden")}>
      <summary className="btn-primary min-h-9 cursor-pointer list-none gap-1.5 px-3 [&::-webkit-details-marker]:hidden" aria-label={canRecord ? t("record.button") : "Create"}>
        {plus}<span className="hidden sm:inline">{canRecord ? t("record.button") : "Create"}</span>
      </summary>
      <div className="absolute end-0 top-11 z-50 w-64 animate-pop-in rounded-xl border border-slate-200 bg-white p-1.5 shadow-raised dark:border-white/10 dark:bg-[#16203a]">
        {canRecord && (
          <>
            <p className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t("record.button")}</p>
            <button type="button" className="block min-h-11 w-full rounded-lg px-3 py-2 text-start text-sm font-medium hover:bg-slate-100 dark:hover:bg-white/5" onClick={() => { close(); record.open(); }}>{t("record.sheet.chooseWhat")}</button>
            <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Create</p>
          </>
        )}
        <Link href="/projects/new" onClick={close} className="block min-h-11 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-white/5">New project</Link>
        <Link href="/projects" onClick={close} className="block rounded-lg px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-white/5">Choose a project to add a report, activity, or evidence</Link>
      </div>
    </details>
  );
}
