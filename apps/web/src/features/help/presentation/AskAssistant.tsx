"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { searchHelpAction } from "@/lib/actions/help";
import { useActionState } from "@/lib/client/action-state";
import { useHydrated } from "@/lib/client/use-hydrated";
import { AskPanel } from "@/features/ask/presentation/AskPanel";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import type { HelpHit } from "@/features/help/domain/help-rank";

type Access = "AVAILABLE" | "NOT_IN_PLAN" | "NOT_TURNED_ON" | "NO_AI" | "PARTNER";
type Tab = "HELP" | "PROJECT";

/** What a person is told when Ask about their projects is closed to them; the same rule the API enforces (`askAccess`). */
const CLOSED: Record<Exclude<Access, "AVAILABLE">, string> = {
  NOT_IN_PLAN: "Ask about your projects is part of the Team plan and above. Help articles are open to everyone.",
  NOT_TURNED_ON: "Ask about your projects is switched off for this organisation. An administrator can turn it on in Settings.",
  NO_AI: "Ask about your projects is switched off for this organisation. An administrator can turn it on in Settings.",
  PARTNER: "Ask about your projects is not available to outside partners. Help articles are open to you.",
};

function projectIdOf(pathname: string): string | null {
  const m = /^\/projects\/([^/]+)/.exec(pathname);
  return m && m[1] && m[1] !== "new" ? m[1] : null;
}

/**
 * The floating assistant: a button on every signed-in page that opens a panel with two tabs. "Help" looks the question up in the help
 * articles (no AI, open to every plan). "This project" is Ask DonorDesk, shown only on a project page and only when `askAccess` allows it.
 * The panel is closed until opened, hidden offline, and sits above the phone tab bar.
 */
export function AskAssistant({ access, aboveTabBar }: { access: Access; aboveTabBar: boolean }) {
  const hydrated = useHydrated();
  const pathname = usePathname() ?? "";
  const projectId = projectIdOf(pathname);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("HELP");
  const [online, setOnline] = useState(true);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); buttonRef.current?.focus(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!hydrated || !online) return null;

  return (
    <div className={cn("fixed end-4 z-40 print:hidden", aboveTabBar ? "bottom-24 lg:bottom-4" : "bottom-4")}>
      {open && (
        <section role="dialog" aria-label="Ask and help" className="mb-3 flex max-h-[75vh] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-white/15 dark:bg-slate-900">
          <header className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-white/10">
            <div role="tablist" aria-label="Ask and help" className="flex gap-1 text-sm">
              <TabButton selected={tab === "HELP"} onClick={() => setTab("HELP")}>Help</TabButton>
              <TabButton selected={tab === "PROJECT"} onClick={() => setTab("PROJECT")}>My projects</TabButton>
            </div>
            <button type="button" className="min-h-[44px] min-w-[44px] text-lg leading-none text-slate-500 hover:text-slate-900 dark:hover:text-white" aria-label="Close" onClick={() => { setOpen(false); buttonRef.current?.focus(); }}>×</button>
          </header>
          <div className="overflow-y-auto p-3">
            {tab === "HELP" ? <HelpSearch /> : <ProjectTab access={access} projectId={projectId} />}
          </div>
        </section>
      )}
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-label={open ? "Close ask and help" : "Ask and help"}
        onClick={() => setOpen((v) => !v)}
        className="ms-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-xl font-semibold text-white shadow-lg hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        {open ? "×" : "?"}
      </button>
    </div>
  );
}

function TabButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="tab" aria-selected={selected} onClick={onClick} className={cn("min-h-[44px] rounded-md px-3 font-medium", selected ? "bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-100" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10")}>
      {children}
    </button>
  );
}

function HelpSearch() {
  const act = useActionState();
  const [query, setQuery] = useState("");
  const [asked, setAsked] = useState("");
  const [hits, setHits] = useState<HelpHit[] | null>(null);

  async function search() {
    const q = query.trim();
    if (q.length < 2) return;
    setAsked(q);
    const r = await act.run(async () => ({ ok: true as const, value: await searchHelpAction(q) }));
    if (Array.isArray(r)) setHits(r);
  }

  return (
    <div className="space-y-3">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void search(); }}>
        <input className="input min-h-[44px] flex-1" aria-label="Search the help articles" placeholder="How do I…?" value={query} maxLength={200} onChange={(e) => setQuery(e.target.value)} />
        <Button type="submit" pending={act.busy} disabled={act.busy || query.trim().length < 2}>Search</Button>
      </form>
      {act.error && <p role="alert" className="text-sm text-danger-600">{act.error}</p>}
      {hits && hits.length === 0 && (
        <p role="status" className="text-sm text-slate-600 dark:text-slate-300">No help article matches &ldquo;{asked}&rdquo;. Try other words, or <a className="underline" href="/support">browse all help</a>.</p>
      )}
      {hits && hits.length > 0 && (
        <ul className="space-y-3" aria-label="Help articles">
          {hits.map((h) => (
            <li key={h.href}>
              <a className="text-sm font-medium underline" href={h.href} target="_blank" rel="noreferrer">{h.title}</a>
              {h.snippet && <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{h.snippet}</p>}
            </li>
          ))}
        </ul>
      )}
      {!hits && <p className="text-xs text-slate-500">Searches the DonorDesk help articles. Nothing about your organisation is read.</p>}
    </div>
  );
}

function ProjectTab({ access, projectId }: { access: Access; projectId: string | null }) {
  if (access !== "AVAILABLE") return <p role="status" className="text-sm text-slate-700 dark:text-slate-200">{CLOSED[access]}{access === "NOT_IN_PLAN" && <> <a className="underline" href="/settings/billing">See plans</a>.</>}</p>;
  if (!projectId) return <p role="status" className="text-sm text-slate-700 dark:text-slate-200">Open a project to ask about its records.</p>;
  return <AskPanel projectId={projectId} />;
}
