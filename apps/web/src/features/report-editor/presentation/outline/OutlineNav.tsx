"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import type { SectionVM } from "../../application/editor-model";

/**
 * Report outline: one quiet row per section with a single status marker.
 * Reordering and deleting are hidden behind "Reorder" so the everyday list is
 * not crowded with drag handles, arrows and delete buttons.
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
  const total = sections.length;

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
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {approvedCount} of {total} approved
            </span>
          )}
        </div>
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

      <ol className="space-y-0.5">
        {sections.map((s, index) => {
          const selected = s.id === selectedId;
          return (
            <li key={s.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                disabled={s.isWriting}
                aria-current={selected ? "true" : undefined}
                className={`flex min-h-[40px] w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
                  selected
                    ? "bg-brand-500/10 font-medium text-brand-700 dark:text-brand-300"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5"
                } ${s.isWriting ? "italic text-slate-400 dark:text-slate-500" : ""}`}
              >
                <span className="w-4 shrink-0 text-xs text-slate-400">{s.number}</span>
                <span className="min-w-0 flex-1 break-words leading-5">{s.title}</span>
                {s.commentCount > 0 && (
                  <span className="shrink-0 rounded-full bg-slate-100 px-1.5 text-[11px] font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300" title={`${s.commentCount} open comment${s.commentCount === 1 ? "" : "s"}`}>
                    <span aria-hidden="true">💬 </span>
                    {s.commentCount}
                    <span className="sr-only"> open comment{s.commentCount === 1 ? "" : "s"}</span>
                  </span>
                )}
                <StatusMarker section={s} />
              </button>
              {reordering && canManage && (
                <span className="flex shrink-0 items-center">
                  <IconButton label={`Move ${s.title} up`} disabled={busy || index === 0} onClick={() => onMove(s.id, -1)}>
                    ↑
                  </IconButton>
                  <IconButton label={`Move ${s.title} down`} disabled={busy || index === total - 1} onClick={() => onMove(s.id, 1)}>
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
      <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-success-600" title="Approved">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
        className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full border border-warning-500 bg-warning-50 px-1.5 text-[11px] font-bold text-warning-700 dark:bg-warning-500/10 dark:text-warning-500"
        title={`${section.openStatements} flagged`}
      >
        {section.openStatements}
        <span className="sr-only"> flagged statement{section.openStatements === 1 ? "" : "s"}</span>
      </span>
    );
  }
  if (section.needsRecheck) {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-warning-500 text-[11px] font-bold text-warning-700 dark:text-warning-400" title="Needs a re-check">
        <span aria-hidden="true">↻</span>
        <span className="sr-only">Needs a re-check</span>
      </span>
    );
  }
  return (
    <span className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-slate-300 dark:border-white/20" title="Draft">
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
      className={`flex h-8 w-7 items-center justify-center rounded-md text-slate-500 transition disabled:cursor-not-allowed disabled:opacity-30 ${
        danger ? "hover:bg-danger-500/10 hover:text-danger-600" : "hover:bg-brand-500/10 hover:text-brand-600"
      }`}
    >
      {children}
    </button>
  );
}
