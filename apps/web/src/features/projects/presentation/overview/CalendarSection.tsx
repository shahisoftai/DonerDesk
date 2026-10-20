import Link from "next/link";
import { Badge } from "@/components/data/Badge";
import { formatDate } from "@/lib/shared/dates";
import type { CalendarItem } from "@/features/projects/domain/overview-derive";
import { OverviewSection } from "./overview-pieces";

/**
 * Everything due in the coming weeks, from every stream in one list: planned work, report deadlines,
 * risk reviews and the caller's own requests. Before this, the same dates lived in five places.
 */
export function CalendarSection({ items, projectId }: { items: CalendarItem[]; projectId: string }) {
  if (items.length === 0) return null;
  return (
    <OverviewSection kicker="Calendar" title="Everything due, next six weeks" href={`/projects/${projectId}/activities?view=planned`} linkLabel="Open the plan">
      <div className="card">
        <ul className="divide-y divide-slate-200/70 dark:divide-white/10">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <span className="w-20 shrink-0 text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400">
                {item.overdue ? <span className="text-danger-600 dark:text-danger-400">{formatDate(item.date)}</span> : formatDate(item.date)}
              </span>
              <Badge tone={badgeTone(item)}>{kindLabel(item.kind)}</Badge>
              <Link className="min-w-0 flex-1 truncate text-sm hover:underline" href={item.href}>
                {item.title}
              </Link>
              <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                {item.overdue ? "Overdue" : item.detail}
                {item.mine ? " · yours" : ""}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </OverviewSection>
  );
}

function badgeTone(item: CalendarItem): "info" | "success" | "warning" | "danger" | "neutral" {
  if (item.overdue) return "danger";
  switch (item.kind) {
    case "REPORT": return "info";
    case "PLAN": return "neutral";
    case "RISK_REVIEW": return "warning";
    case "VALUE":
    case "REQUEST":
    case "CHECKLIST": return "warning";
  }
}

function kindLabel(kind: CalendarItem["kind"]): string {
  switch (kind) {
    case "PLAN": return "Planned";
    case "REPORT": return "Report";
    case "RISK_REVIEW": return "Risk review";
    case "REQUEST": return "Request";
    case "VALUE": return "Indicator value";
    case "CHECKLIST": return "To check";
  }
}
