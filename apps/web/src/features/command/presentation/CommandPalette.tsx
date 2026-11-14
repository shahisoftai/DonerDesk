"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CornerDownLeft, FileText, FolderKanban, Search } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { Kbd } from "@/components/ui/Button";
import { flipTheme } from "@/components/ThemeToggle";
import { useRecordSheet } from "@/features/record/presentation/RecordHost";
import { searchWorkspaceAction, type SearchHit } from "@/lib/actions/search";
import {
  availableCommands, COMMANDS, filterCommands, GROUP_LABEL, shortcutTarget, type CommandView,
} from "../domain/commands";

type Row = { key: string; label: string; group: string; hint?: string; shortcut?: string; icon?: "PROJECT" | "EVIDENCE"; go: () => void };

const typing = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

/**
 * The command palette (Version 4.000, plan F6/F69/F70): Ctrl-K or ⌘K opens it; type to find a page, a project, a file or an
 * action, Enter runs it. "?" shows the shortcuts; "G" then a letter goes to a page; "R" opens the Record sheet.
 */
export function CommandPalette({ capabilities }: { capabilities: readonly string[] }) {
  const caps = useMemo(() => new Set(capabilities), [capabilities]);
  const router = useRouter();
  const pathname = usePathname();
  const record = useRecordSheet();
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const [, startSearch] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const lastKey = useRef<{ key: string; at: number } | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  const close = () => { setOpen(false); setQuery(""); setHits([]); returnFocus.current?.focus(); };

  const runCommand = (c: CommandView) => {
    close();
    switch (c.run.kind) {
      case "HREF": router.push(c.run.href); break;
      case "RECORD": record.open(); break;
      case "THEME": flipTheme(); break;
      case "SHORTCUTS": setSheet(true); break;
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // A screen with its own palette and shortcuts (the design editor) says so; the app-wide keys stand down there.
      if (document.body.dataset.ownPalette) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        // In a rich-text field (the report editor) Ctrl K already means "add a link"; leave it to the editor.
        if (e.defaultPrevented || (e.target instanceof HTMLElement && e.target.isContentEditable)) return;
        e.preventDefault();
        returnFocus.current = document.activeElement as HTMLElement | null;
        setOpen((v) => !v);
        return;
      }
      if (open || e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      if (e.key === "Escape") { setSheet(false); return; }
      // A report's page has its own single-key shortcuts (j, k, n, e, a and "?"): the global ones stay out of the way there.
      // Ctrl K still works, and "Show keyboard shortcuts" is in it.
      if (/^\/projects\/[^/]+\/reports\/(?!new$|closing$)[^/]+\/?$/.test(pathname)) return;
      if (e.key === "?") { e.preventDefault(); setSheet((v) => !v); return; }
      const now = Date.now();
      const prev = lastKey.current;
      if (prev?.key === "g" && now - prev.at < 1000) {
        const target = shortcutTarget(`G ${e.key.toUpperCase()}`, caps);
        lastKey.current = null;
        if (target && target.run.kind === "HREF") { e.preventDefault(); router.push(target.run.href); }
        return;
      }
      if (e.key.toLowerCase() === "g") { lastKey.current = { key: "g", at: now }; return; }
      if (e.key.toLowerCase() === "r" && COMMANDS.some((c) => c.id === "new.record" && (!c.needs || c.needs.some((n) => caps.has(n))))) {
        e.preventDefault();
        record.open();
      }
    };
    const onOpen = () => { returnFocus.current = document.activeElement as HTMLElement | null; setOpen(true); };
    document.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => { document.removeEventListener("keydown", onKey); window.removeEventListener(OPEN_EVENT, onOpen); };
  }, [open, caps, router, record, pathname]);

  useEffect(() => { if (open) requestAnimationFrame(() => input.current?.focus()); }, [open]);

  useEffect(() => {
    setActive(0);
    if (query.trim().length < 2) { setHits([]); return; }
    const q = query;
    const timer = window.setTimeout(() => startSearch(async () => {
      const found = await searchWorkspaceAction(q).catch(() => [] as SearchHit[]);
      setHits(found);
    }), 200);
    return () => window.clearTimeout(timer);
  }, [query]);

  const rows: Row[] = useMemo(() => {
    const commands = filterCommands(availableCommands({ capabilities: caps, pathname }), query).slice(0, query ? 12 : 40);
    const found: Row[] = hits.map((h) => ({
      key: `${h.kind}:${h.id}`, label: h.title, hint: h.detail, group: h.kind === "PROJECT" ? "Projects" : "Files", icon: h.kind,
      go: () => { close(); router.push(h.href); },
    }));
    const cmd: Row[] = commands.map((c) => ({ key: c.id, label: c.label, hint: c.hint, shortcut: c.shortcut, group: GROUP_LABEL[c.group], go: () => runCommand(c) }));
    return [...found, ...cmd];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caps, pathname, query, hits]);

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(rows.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); rows[active]?.go(); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
  };

  useEffect(() => {
    document.getElementById(`cmd-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]" role="presentation">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[3px]" onClick={close} aria-hidden="true" />
          <div role="dialog" aria-modal="true" aria-label="Search and commands" className="relative w-full max-w-[640px] animate-pop-in overflow-hidden rounded-2xl bg-white shadow-panel dark:bg-[#16203a]">
            <div className="flex items-center gap-3 border-b border-slate-200 px-4 dark:border-white/10">
              <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                ref={input}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onListKey}
                placeholder="Search projects and files, or type a command…"
                aria-label="Search projects and files, or type a command"
                role="combobox"
                aria-expanded="true"
                aria-controls="cmd-list"
                aria-activedescendant={rows[active] ? `cmd-${active}` : undefined}
                className="h-14 min-w-0 flex-1 bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
              />
              <Kbd>Esc</Kbd>
            </div>
            <ul id="cmd-list" role="listbox" aria-label="Results" className="max-h-[52vh] overflow-y-auto p-2">
              {rows.length === 0 && <li className="px-3 py-8 text-center text-sm text-slate-500">Nothing matches “{query}”.</li>}
              {rows.map((r, i) => (
                <li key={r.key} role="presentation">
                  {(i === 0 || rows[i - 1]!.group !== r.group) && (
                    <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400 first:pt-1">{r.group}</p>
                  )}
                  <button
                    id={`cmd-${i}`}
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    onMouseMove={() => setActive(i)}
                    onClick={r.go}
                    className={cn(
                      "flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-start text-sm",
                      i === active ? "bg-brand-50 text-brand-900 dark:bg-white/[0.08] dark:text-white" : "text-slate-700 dark:text-slate-200",
                    )}
                  >
                    {r.icon === "PROJECT" ? <FolderKanban aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" /> : r.icon === "EVIDENCE" ? <FileText aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" /> : null}
                    <span className="min-w-0 flex-1 truncate">{r.label}{r.hint && <span className="ms-2 text-xs text-slate-500 dark:text-slate-400">{r.hint}</span>}</span>
                    {r.shortcut && <Kbd>{r.shortcut}</Kbd>}
                    {i === active && <CornerDownLeft aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-4 border-t border-slate-200 bg-slate-50 px-4 py-2 text-[11px] text-slate-500 dark:border-white/10 dark:bg-white/[0.03]">
              <span><Kbd>↑</Kbd> <Kbd>↓</Kbd> to move</span><span><Kbd>Enter</Kbd> to open</span><span><Kbd>?</Kbd> shortcuts</span>
            </div>
          </div>
        </div>
      )}
      {sheet && <ShortcutSheet capabilities={caps} onClose={() => setSheet(false)} />}
    </>
  );
}

function ShortcutSheet({ capabilities, onClose }: { capabilities: ReadonlySet<string>; onClose: () => void }) {
  const rows = [
    { keys: "Ctrl K  /  ⌘K", what: "Search and commands" },
    ...COMMANDS.filter((c) => c.shortcut && (!c.needs || c.needs.some((n) => capabilities.has(n)))).map((c) => ({ keys: c.shortcut!, what: c.label })),
    { keys: "Esc", what: "Close a panel or dialog" },
  ];
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center px-4" role="presentation">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[3px]" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" className="relative w-full max-w-md animate-pop-in rounded-2xl bg-white p-5 shadow-panel dark:bg-[#16203a]">
        <h2 className="text-[15px] font-semibold">Keyboard shortcuts</h2>
        <dl className="mt-4 divide-y divide-slate-200 text-sm dark:divide-white/10">
          {rows.map((r) => (
            <div key={r.keys} className="flex items-center justify-between gap-4 py-2">
              <dt className="text-slate-700 dark:text-slate-200">{r.what}</dt>
              <dd><Kbd className="text-xs">{r.keys}</Kbd></dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex justify-end"><button type="button" className="btn-secondary" onClick={onClose} autoFocus>Close</button></div>
      </div>
    </div>
  );
}

/** Any button can open the palette (the header's search field). */
export const OPEN_EVENT = "donordesk:command-palette";
export function openCommandPalette(): void { window.dispatchEvent(new Event(OPEN_EVENT)); }
