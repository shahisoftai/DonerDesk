"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import type { SectionVM } from "../../application/editor-model";
import { canMove, descendantIds, hiddenIds } from "../../application/outline-tree";

/** Left padding per sub-section level, TOC style. */
const INDENT_PX = 12;

/**
 * Report outline as a table of contents: sections and their sub-sections
 * (up to 4 levels), indented under their parent with the donor's numbering,
 * one quiet status marker per row. Sub-sections can be collapsed; a collapsed
 * section shows whether anything inside it still needs attention.
 * Reordering and deleting are hidden behind "Reorder" so the everyday list is
 * not crowded with arrows and delete buttons; a section moves with its
 * sub-sections, among its siblings.
 */
export function OutlineNav({
  sections,
  approvedCount,
  selectedId,
  onSelect,
  canManage,
  busy,
  onAdd,
  onMove,
  onDelete,
  approvableCount,
  approvingAll,
  onApproveAllClean,
  footer,
}: {
  sections: SectionVM[];
  approvedCount: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  canManage: boolean;
  busy: boolean;
  onAdd: (title: string) => Promise<boolean>;
  onMove: (id: string, offset: -1 | 1) => void;
  onDelete: (id: string, title: string) => void;
  /** Sections with nothing left to decide or re-check (U8). */
  approvableCount: number;
  approvingAll: boolean;
  onApproveAllClean?: () => void;
  /** Rendered under the outline (report inputs summary). */
  footer?: ReactNode;
}) {
  const [reordering, setReordering] = useState(false);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const total = sections.length;
  const hasTree = sections.some((s) => s.hasChildren);
  const hidden = useMemo(() => hiddenIds(sections, collapsed), [sections, collapsed]);

  // When the selection changes (e.g. from the document), open its collapsed
  // ancestors so it stays visible. Collapsing its branch afterwards is allowed.
  useEffect(() => {
    if (!selectedId) return;
    const byId = new Map(sections.map((s) => [s.id, s]));
    const ancestors: string[] = [];
    for (let p = byId.get(selectedId)?.parentId; p; p = byId.get(p)?.parentId) ancestors.push(p);
    setCollapsed((prev) => (ancestors.some((a) => prev.has(a)) ? new Set([...prev].filter((id) => !ancestors.includes(id))) : prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on selection change
  }, [selectedId]);

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submitAdd() {
    if (!title.trim()) return;
    if (await onAdd(title.trim())) {
      setTitle("");
      setAdding(false);
    }
  }

  return (
    <nav aria-label="Report outline" className="space-y-3">
      <div className="space-y-2 px-1">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Outline</span>
          {total > 0 && (
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {approvedCount} of {total} approved
            </span>
          )}
        </div>
        {hasTree && (
          <div className="flex justify-end">
            <button
              type="button"
              className="text-[11px] text-slate-500 hover:text-brand-700 hover:underline dark:text-slate-400 dark:hover:text-brand-300"
              onClick={() => setCollapsed(collapsed.size > 0 ? new Set() : new Set(sections.filter((s) => s.hasChildren && s.level === 1).map((s) => s.id)))}
            >
              {collapsed.size > 0 ? "Expand all" : "Collapse sub-sections"}
            </button>
          </div>
        )}
        {total > 0 && (
          <div className="h-1 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10" aria-hidden="true">
            <div className="h-full rounded-full bg-success-600 transition-all" style={{ width: `${Math.round((100 * approvedCount) / total)}%` }} />
          </div>
        )}
        {onApproveAllClean && approvableCount > 1 && (
          <Button size="sm" variant="secondary" className="w-full" pending={approvingAll} disabled={busy} onClick={onApproveAllClean}>
            Approve all clean sections ({approvableCount})
          </Button>
        )}
      </div>

      <ol className="space-y-px">
        {sections.map((s) => {
          if (hidden.has(s.id)) return null;
          const selected = s.id === selectedId;
          const isCollapsed = collapsed.has(s.id);
          const insideIds = new Set(isCollapsed ? descendantIds(sections, s.id) : []);
          const inside = sections.filter((x) => insideIds.has(x.id));
          const insideFlagged = inside.reduce((n, x) => n + x.openStatements, 0);
          const insideRecheck = inside.some((x) => x.needsRecheck);
          return (
            <li key={s.id} className="flex items-center gap-0.5">
              <span className="flex w-4 shrink-0 justify-center" style={{ marginLeft: (s.level - 1) * INDENT_PX }}>
                {s.hasChildren && (
                  <button
                    type="button"
                    onClick={() => toggle(s.id)}
                    aria-expanded={!isCollapsed}
                    aria-label={`${isCollapsed ? "Show" : "Hide"} sub-sections of ${s.title}`}
                    className="flex h-5 w-4 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200"
                  >
                    <svg width="8" height="8" viewBox="0 0 10 10" aria-hidden="true" className={`transition-transform ${isCollapsed ? "" : "rotate-90"}`}>
                      <path d="M3 1.5L7 5L3 8.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
              </span>
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                disabled={s.isWriting}
                aria-current={selected ? "true" : undefined}
                aria-level={s.level}
                className={`flex min-h-[28px] w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-left transition ${
                  s.level === 1 ? "text-xs" : "text-[11px]"
                } ${
                  selected
                    ? "bg-brand-500/10 font-medium text-brand-700 dark:text-brand-300"
                    : s.level === 1
                      ? "font-medium text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-white/5"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
                } ${s.isWriting ? "italic text-slate-400 dark:text-slate-500" : ""}`}
              >
                <span className="shrink-0 tabular-nums text-[10px] font-normal text-slate-400">{s.number}</span>
                <span className="min-w-0 flex-1 break-words leading-4">{s.title}</span>
                {isCollapsed && (insideFlagged > 0 || insideRecheck) && (
                  <span
                    className="shrink-0 rounded-full border border-warning-500/60 px-1 text-[10px] font-medium text-warning-700 dark:text-warning-400"
                    title={insideFlagged > 0 ? `${insideFlagged} flagged in sub-sections` : "A sub-section needs a re-check"}
                  >
                    {insideFlagged > 0 ? `+${insideFlagged}` : "↻"}
                    <span className="sr-only">{insideFlagged > 0 ? " flagged in sub-sections" : " sub-section needs a re-check"}</span>
                  </span>
                )}
                {s.commentCount > 0 && (
                  <span className="shrink-0 rounded-full bg-slate-100 px-1 text-[10px] font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300" title={`${s.commentCount} open comment${s.commentCount === 1 ? "" : "s"}`}>
                    <span aria-hidden="true">💬 </span>
                    {s.commentCount}
                    <span className="sr-only"> open comment{s.commentCount === 1 ? "" : "s"}</span>
                  </span>
                )}
                <StatusMarker section={s} />
              </button>
              {reordering && canManage && (
                <span className="flex shrink-0 items-center">
                  <IconButton label={`Move ${s.title} up`} disabled={busy || !canMove(sections, s.id, -1)} onClick={() => onMove(s.id, -1)}>
                    ↑
                  </IconButton>
                  <IconButton label={`Move ${s.title} down`} disabled={busy || !canMove(sections, s.id, 1)} onClick={() => onMove(s.id, 1)}>
                    ↓
                  </IconButton>
                  <IconButton label={`Delete ${s.title}`} disabled={busy} danger onClick={() => onDelete(s.id, s.title)}>
                    ×
                  </IconButton>
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {canManage && (
        <div className="space-y-2 px-1">
          {adding ? (
            <div className="space-y-2 rounded-lg border border-slate-200 p-2 dark:border-white/10">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300" htmlFor="new-section-title">
                New section title
              </label>
              <input
                id="new-section-title"
                type="text"
                value={title}
                autoFocus
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submitAdd();
                  if (e.key === "Escape") setAdding(false);
                }}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-white/15 dark:bg-white/5"
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                  Cancel
                </Button>
                <Button size="sm" disabled={busy || !title.trim()} pending={busy} onClick={() => void submitAdd()}>
                  Add
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" className="flex-1" disabled={busy} onClick={() => setAdding(true)}>
                + Add section
              </Button>
              {total > 1 && (
                <Button size="sm" variant={reordering ? "primary" : "ghost"} onClick={() => setReordering((v) => !v)} aria-pressed={reordering}>
                  {reordering ? "Done" : "Reorder"}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
      {footer}
    </nav>
  );
}

function StatusMarker({ section }: { section: SectionVM }) {
  if (section.isApproved) {
    return (
      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-success-600" title="Approved">
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
        <span className="sr-only">Approved</span>
      </span>
    );
  }
  if (section.regenerating) {
    return (
      <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-ai-500" title="Being rewritten">
        <span className="sr-only">Being rewritten</span>
      </span>
    );
  }
  if (section.isWriting) {
    return (
      <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-slate-400" title="Being written">
        <span className="sr-only">Being written</span>
      </span>
    );
  }
  if (section.openStatements > 0) {
    return (
      <span
        className="flex h-4 min-w-[16px] shrink-0 items-center justify-center rounded-full border border-warning-500 bg-warning-50 px-1 text-[10px] font-bold text-warning-700 dark:bg-warning-500/10 dark:text-warning-500"
        title={`${section.openStatements} flagged`}
      >
        {section.openStatements}
        <span className="sr-only"> flagged statement{section.openStatements === 1 ? "" : "s"}</span>
      </span>
    );
  }
  if (section.needsRecheck) {
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-warning-500 text-[10px] font-bold text-warning-700 dark:text-warning-400" title="Needs a re-check">
        <span aria-hidden="true">↻</span>
        <span className="sr-only">Needs a re-check</span>
      </span>
    );
  }
  return (
    <span className="h-3 w-3 shrink-0 rounded-full border-2 border-slate-300 dark:border-white/20" title="Draft">
      <span className="sr-only">Draft</span>
    </span>
  );
}

function IconButton({
  label,
  disabled,
  danger,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-7 w-6 items-center justify-center rounded-md text-xs text-slate-500 transition disabled:cursor-not-allowed disabled:opacity-30 ${
        danger ? "hover:bg-danger-500/10 hover:text-danger-600" : "hover:bg-brand-500/10 hover:text-brand-600"
      }`}
    >
      {children}
    </button>
  );
}
