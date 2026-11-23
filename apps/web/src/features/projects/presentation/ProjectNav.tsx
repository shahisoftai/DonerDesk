"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Settings } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { Breadcrumbs } from "@/components/layout/Page";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { uiLabel } from "@/features/i18n/domain/ui-labels";
import { PROJECT_STAGES, locateProjectPage, projectCrumbs, subNavFor, type ProjectFact } from "../domain/project-stages";
import { stagesFor } from "../domain/role-project-stages";
import { canReachProjectPage } from "../domain/role-project-pages";

/** The project's tabs, the current tab's pages (with "More" for rare ones) and the breadcrumbs above the title. */
export function ProjectCrumbs({ projectId, projectTitle }: { projectId: string; projectTitle: string }) {
  const pathname = usePathname();
  const sub = pathname.slice(`/projects/${projectId}`.length);
  const { t } = useI18n();
  return <Breadcrumbs items={projectCrumbs(projectId, projectTitle, sub).map((c) => ({ ...c, label: uiLabel(c.label, t) }))} />;
}

export function ProjectNav({ projectId, facts, capabilities, role }: { projectId: string; facts: readonly ProjectFact[]; capabilities: readonly string[]; role?: string | null }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  const { tab, page } = locateProjectPage(pathname.slice(base.length));
  const sub = subNavFor(tab, { facts: new Set(facts), capabilities: new Set(capabilities), current: page, reachable: (path) => canReachProjectPage(role, path) });
  const { t: tr } = useI18n();
  const bar = stagesFor(PROJECT_STAGES, role, tab.key);

  return (
    <div className="space-y-3">
    <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10">
      <nav aria-label="Project sections" className="min-w-0 flex-1 overflow-x-auto">
        <ul className="flex min-w-max gap-1">
          {bar.shown.map((t) => {
            const on = t.key === tab.key;
            return (
              <li key={t.key}>
                <Link
                  href={base + (t.pages.find((pg) => canReachProjectPage(role, pg.path)) ?? t.pages[0]!).path}
                  prefetch={false}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "relative inline-flex min-h-11 items-center px-3 text-sm font-medium transition-colors",
                    on
                      ? "text-slate-950 after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-brand-700 dark:text-white dark:after:bg-brand-300"
                      : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
                  )}
                >
                  {t.key === "settings" ? <Settings aria-hidden="true" className="me-1.5 h-4 w-4" /> : null}
                  {uiLabel(t.label, tr)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {bar.more.length > 0 && <MoreMenu base={base} pages={bar.more.map((t) => ({ label: t.label, path: (t.pages.find((pg) => canReachProjectPage(role, pg.path)) ?? t.pages[0]!).path }))} />}
    </div>
      {(sub.shown.length > 1 || sub.more.length > 0) && (
        <nav aria-label={`${uiLabel(tab.label, tr)}`} className="flex flex-wrap items-center gap-1">
          {sub.shown.map((p) => {
            const on = p === page;
            return (
              <Link
                key={p.path}
                href={base + p.path}
                prefetch={false}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-8 items-center rounded-full px-3 text-[13px] font-medium transition-colors",
                  on ? "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200 dark:bg-brand-300/10 dark:text-brand-200 dark:ring-brand-300/20" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5",
                )}
              >
                {uiLabel(p.label, tr)}
              </Link>
            );
          })}
          {sub.more.length > 0 && <MoreMenu base={base} pages={sub.more} />}
        </nav>
      )}
    </div>
  );
}

function MoreMenu({ base, pages }: { base: string; pages: ReadonlyArray<{ label: string; path: string }> }) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div ref={root} className="relative">
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="inline-flex min-h-8 items-center gap-1 rounded-full px-3 text-[13px] font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5">
        {uiLabel("More", t)} <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div role="menu" className="absolute start-0 top-full z-30 mt-1 min-w-[12rem] animate-pop-in rounded-xl border border-slate-200 bg-white p-1 shadow-raised dark:border-white/10 dark:bg-[#16203a]">
          {pages.map((p) => (
            <Link key={p.path} role="menuitem" href={base + p.path} prefetch={false} onClick={() => setOpen(false)} className="flex min-h-10 items-center rounded-lg px-3 text-sm hover:bg-slate-100 dark:hover:bg-white/5">
              {uiLabel(p.label, t)}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
