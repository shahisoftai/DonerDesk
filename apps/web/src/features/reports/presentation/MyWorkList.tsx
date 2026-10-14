"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/data/Badge";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/feedback/PageState";
import { filterWorkItems, paginate, workItemHref, workItemTitle, workItemMeta, DEFAULT_WORK_FILTERS, type WorkFilters } from "@/features/work-items/presentation/work-items-view";
import { compareUrgency, type WorkItem, type WorkItemType } from "@/features/work-items/domain/work-item";

const PAGE_SIZE = 20;
const TYPE_OPTIONS: Array<[WorkItemType, string]> = [["report", "Reports"], ["checklist", "Compliance"], ["evidence", "Evidence"], ["activity", "Activities"], ["notification", "Notifications"]];
const DUE_OPTIONS: Array<[WorkFilters["due"], string]> = [["all", "Any time"], ["overdue", "Overdue"], ["today", "Today"], ["soon", "Within 3 days"]];

type Sort = "URGENCY" | "DEADLINE" | "PROJECT" | "TYPE" | "TITLE";
const projectOf = (i: WorkItem) => (i.kind === "notification" ? "" : i.projectTitle);
const daysOf = (i: WorkItem) => ("daysUntilDeadline" in i && i.daysUntilDeadline != null ? i.daysUntilDeadline : Infinity);
const SORTERS: Record<Sort, (a: WorkItem, b: WorkItem) => number> = {
  URGENCY: compareUrgency,
  DEADLINE: (a, b) => (daysOf(a) === daysOf(b) ? 0 : daysOf(a) < daysOf(b) ? -1 : 1),
  PROJECT: (a, b) => projectOf(a).localeCompare(projectOf(b)) || compareUrgency(a, b),
  TYPE: (a, b) => a.kind.localeCompare(b.kind) || compareUrgency(a, b),
  TITLE: (a, b) => workItemTitle(a).localeCompare(workItemTitle(b)),
};

export function MyWorkList({ items, projects }: { items: WorkItem[]; projects: Array<[string, string]> }) {
  const [filters, setFilters] = useState<WorkFilters>(DEFAULT_WORK_FILTERS);
  const [sort, setSort] = useState<Sort>("URGENCY");
  const [page, setPage] = useState(1);
  const set = (patch: Partial<WorkFilters>) => { setFilters((f) => ({ ...f, ...patch })); setPage(1); };
  const sorted = useMemo(() => [...filterWorkItems(items, filters)].sort(SORTERS[sort]), [items, filters, sort]);
  const rows = paginate(sorted, page, PAGE_SIZE);

  return <div>
    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Sort by
        <Select value={sort} onChange={(e) => { setSort(e.target.value as Sort); setPage(1); }}>
          <option value="URGENCY">Urgency</option>
          <option value="DEADLINE">Deadline (soonest first)</option>
          <option value="PROJECT">Project</option>
          <option value="TYPE">Type</option>
          <option value="TITLE">Title (A–Z)</option>
        </Select>
      </label>
      <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Type
        <Select value={filters.type} onChange={(e) => set({ type: e.target.value as WorkFilters["type"] })}><option value="all">All types</option>{TYPE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
      </label>
      <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Project
        <Select value={filters.projectId} onChange={(e) => set({ projectId: e.target.value })}><option value="all">All projects</option>{projects.map(([id, t]) => <option key={id} value={id}>{t}</option>)}</Select>
      </label>
      <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Due
        <Select value={filters.due} onChange={(e) => set({ due: e.target.value as WorkFilters["due"] })}>{DUE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
      </label>
    </div>

    <div className="mt-6 space-y-2">
      {rows.length === 0 && <EmptyState>No work items match these filters.</EmptyState>}
      {rows.map((item) => <WorkItemRow key={`${item.kind}-${item.id}`} item={item} />)}
    </div>

    <div className="mt-6 flex items-center justify-between text-sm">
      <p className="text-xs text-slate-500 dark:text-slate-400" aria-live="polite">Page {page} · {sorted.length} item{sorted.length === 1 ? "" : "s"}</p>
      <div className="flex gap-2">
        {page > 1 && <button type="button" className="btn-secondary px-3 py-1 text-xs" onClick={() => setPage(page - 1)}>Previous</button>}
        {page * PAGE_SIZE < sorted.length && <button type="button" className="btn-secondary px-3 py-1 text-xs" onClick={() => setPage(page + 1)}>Next</button>}
      </div>
    </div>
  </div>;
}

function WorkItemRow({ item }: { item: WorkItem }) {
  return (
    <Link href={workItemHref(item)} className="card flex items-center justify-between gap-3 transition hover:border-brand-400/40 dark:hover:border-brand-400/30">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <Badge tone={kindTone(item.kind)} className="shrink-0">{item.kind}</Badge>
          <span className="min-w-0 break-words text-sm font-medium leading-5">{workItemTitle(item)}</span>
        </div>
        <div className="mt-1 break-words text-xs leading-4 text-slate-500 dark:text-slate-400">{workItemMeta(item)}</div>
      </div>
      {("daysUntilDeadline" in item && item.daysUntilDeadline !== null && item.daysUntilDeadline !== undefined) && (
        <span className={`shrink-0 self-start text-[11px] font-medium ${item.daysUntilDeadline < 0 ? "font-semibold text-danger-600 dark:text-danger-400" : item.daysUntilDeadline <= 3 ? "text-warning-600 dark:text-warning-400" : "text-slate-500 dark:text-slate-400"}`}>
          {item.daysUntilDeadline < 0 ? `${Math.abs(item.daysUntilDeadline)}d overdue` : `${item.daysUntilDeadline}d left`}
        </span>
      )}
    </Link>
  );
}

function kindTone(kind: WorkItem["kind"]): "info" | "success" | "warning" | "danger" | "neutral" | "ai" {
  switch (kind) {
    case "report": return "info";
    case "checklist": return "warning";
    case "evidence": return "ai";
    case "activity": return "success";
    case "notification": return "neutral";
  }
}
