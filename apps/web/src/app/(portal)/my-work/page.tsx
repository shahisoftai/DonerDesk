import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { loadWorkItems } from "@/features/work-items/application/work-items-read-model";
import {
  filterWorkItems,
  paginate,
  workItemHref,
  workItemTitle,
  workItemMeta,
  DEFAULT_WORK_FILTERS,
  type WorkFilters,
} from "@/features/work-items/presentation/work-items-view";
import { InlineError, EmptyState } from "@/components/feedback/PageState";
import { Badge } from "@/components/data/Badge";
import { type WorkItem, type WorkItemType } from "@/features/work-items/domain/work-item";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;
const TYPE_OPTIONS: Array<{ value: WorkItemType | "all"; label: string }> = [
  { value: "all", label: "All types" },
  { value: "report", label: "Reports" },
  { value: "checklist", label: "Compliance" },
  { value: "evidence", label: "Evidence" },
  { value: "activity", label: "Activities" },
  { value: "notification", label: "Notifications" },
];

export default async function MyWorkPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const ctx = await requireSession();
  const load = await loadWorkItems(ctx.token);

  const raw = (key: string) => {
    const v = params[key];
    return typeof v === "string" ? v : "";
  };
  const filters: WorkFilters = {
    type: isWorkType(raw("type")) ? (raw("type") as WorkItemType) : DEFAULT_WORK_FILTERS.type,
    projectId: raw("project") || DEFAULT_WORK_FILTERS.projectId,
    due: isDue(raw("due")) ? (raw("due") as WorkFilters["due"]) : DEFAULT_WORK_FILTERS.due,
  };
  const page = Math.max(1, Number.parseInt(raw("page"), 10) || 1);

  if (!load.ok) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold">My work</h1>
        <div className="mt-6"><InlineError title={load.error?.message ?? "Could not load your work."} referenceId={load.error?.referenceId} /></div>
      </div>
    );
  }

  const filtered = filterWorkItems(load.items, filters);
  const total = filtered.length;
  const rows = paginate(filtered, page, PAGE_SIZE);

  const projectIds = [...load.projectLookup.keys()];

  const qs = (patch: Partial<WorkFilters> & { page?: number }) => {
    const url = new URLSearchParams();
    const next = { ...filters, ...patch };
    if (next.type !== "all") url.set("type", next.type);
    if (next.projectId !== "all") url.set("project", next.projectId);
    if (next.due !== "all") url.set("due", next.due);
    return `/my-work${url.toString() ? `?${url.toString()}` : ""}`;
  };

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold">My work</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Assigned reports, compliance gaps, pending evidence reviews, activities, and notifications — ordered by urgency.
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Type
          <Link href={qs({ type: "all", page: 1 })} className={`ml-2 rounded-lg border px-2 py-1 text-xs ${filters.type === "all" ? "border-brand-500 text-brand-700 dark:text-brand-300" : "border-slate-300 dark:border-white/15"}`}>All</Link>
          {TYPE_OPTIONS.filter((o) => o.value !== "all").map((o) => (
            <Link key={o.value} href={qs({ type: o.value, page: 1 })} className={`ml-1 rounded-lg border px-2 py-1 text-xs ${filters.type === o.value ? "border-brand-500 text-brand-700 dark:text-brand-300" : "border-slate-300 dark:border-white/15"}`}>
              {o.label}
            </Link>
          ))}
        </label>
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Project
          <Link href={qs({ projectId: "all", page: 1 })} className={`ml-2 rounded-lg border px-2 py-1 text-xs ${filters.projectId === "all" ? "border-brand-500 text-brand-700 dark:text-brand-300" : "border-slate-300 dark:border-white/15"}`}>All</Link>
          {projectIds.slice(0, 6).map((id) => (
            <Link key={id} href={qs({ projectId: id, page: 1 })} className={`ml-1 inline-block max-w-40 truncate rounded-lg border px-2 py-1 align-bottom text-xs ${filters.projectId === id ? "border-brand-500 text-brand-700 dark:text-brand-300" : "border-slate-300 dark:border-white/15"}`}>
              {load.projectLookup.get(id)}
            </Link>
          ))}
        </div>
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Due
          {(["all", "overdue", "today", "soon"] as const).map((d) => (
            <Link key={d} href={qs({ due: d, page: 1 })} className={`ml-1 rounded-lg border px-2 py-1 text-xs ${filters.due === d ? "border-brand-500 text-brand-700 dark:text-brand-300" : "border-slate-300 dark:border-white/15"}`}>
              {dueLabel(d)}
            </Link>
          ))}
        </label>
      </div>

      <div className="mt-6 space-y-2">
        {rows.length === 0 && <EmptyState>No work items match these filters.</EmptyState>}
        {rows.map((item) => (
          <WorkItemRow key={`${item.kind}-${item.id}`} item={item} />
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between text-sm">
        <p className="text-xs text-slate-500 dark:text-slate-400">Page {page} · {total} item{total === 1 ? "" : "s"}</p>
        <div className="flex gap-2">
          {page > 1 && <Link className="btn-secondary px-3 py-1 text-xs" href={qs({ page: page - 1 })}>Previous</Link>}
          {page * PAGE_SIZE < total && <Link className="btn-secondary px-3 py-1 text-xs" href={qs({ page: page + 1 })}>Next</Link>}
        </div>
      </div>
    </div>
  );
}

function WorkItemRow({ item }: { item: WorkItem }) {
  return (
    <Link href={workItemHref(item)} className="card flex items-center justify-between gap-3 transition hover:border-brand-400/40 dark:hover:border-brand-400/30">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Badge tone={kindTone(item.kind)}>{item.kind}</Badge>
          <span className="truncate font-semibold">{workItemTitle(item)}</span>
        </div>
        <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{workItemMeta(item)}</div>
      </div>
      {("daysUntilDeadline" in item && item.daysUntilDeadline !== null && item.daysUntilDeadline !== undefined) && (
        <span className={`shrink-0 text-xs font-semibold ${item.daysUntilDeadline < 0 ? "text-danger-600 dark:text-danger-400" : item.daysUntilDeadline <= 3 ? "text-warning-600 dark:text-warning-400" : "text-slate-500 dark:text-slate-400"}`}>
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

function dueLabel(d: string): string {
  switch (d) {
    case "all": return "Any";
    case "overdue": return "Overdue";
    case "today": return "Today";
    case "soon": return "Within 3 days";
    default: return d;
  }
}

function isWorkType(v: string): v is WorkItemType {
  return v === "report" || v === "checklist" || v === "evidence" || v === "activity" || v === "notification";
}

function isDue(v: string): v is WorkFilters["due"] {
  return v === "all" || v === "overdue" || v === "today" || v === "soon";
}
