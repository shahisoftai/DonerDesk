import Link from "next/link";
import { Badge } from "@/components/data/Badge";
import type { NeedsYouItem } from "@/features/projects/domain/overview-derive";
import { OverviewSection } from "./overview-pieces";

/**
 * What waits on this person on this project: the report to approve, the activities to accept, the
 * files to verify, the values that are late, the risk whose review is overdue. Each row is a link to
 * the place where the work is done — this page never changes anything itself.
 */
export function NeedsYouSection({ items, projectId }: { items: NeedsYouItem[]; projectId: string }) {
  if (items.length === 0) return null;
  return (
    <OverviewSection kicker="Needs you" title="Waiting on your decision or review" href={`/my-work`} linkLabel="My work">
      <div className="card divide-y divide-slate-200/70 dark:divide-white/10">
        {items.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center gap-3 py-3">
            <Badge tone={toneFor(item.kind)}>{labelFor(item.kind)}</Badge>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-5">{item.title}</p>
              {item.why ? <p className="mt-0.5 text-xs leading-4 text-slate-500 dark:text-slate-400">{item.why}</p> : null}
            </div>
            <Link
              className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand-400 hover:text-brand-700 dark:border-white/15 dark:text-slate-200 dark:hover:border-brand-400/60"
              href={item.href}
            >
              Open
            </Link>
          </div>
        ))}
      </div>
    </OverviewSection>
  );
}

function toneFor(kind: NeedsYouItem["kind"]): "info" | "success" | "warning" | "danger" | "neutral" {
  switch (kind) {
    case "OVERDUE_VALUE":
    case "RISK_REVIEW":
      return "danger";
    case "APPROVE_REPORT":
      return "info";
    case "ACCEPT_ACTIVITY":
      return "success";
    case "VERIFY_EVIDENCE":
      return "warning";
    case "REQUEST":
      return "neutral";
  }
}

function labelFor(kind: NeedsYouItem["kind"]): string {
  switch (kind) {
    case "OVERDUE_VALUE": return "Overdue";
    case "RISK_REVIEW": return "Review";
    case "APPROVE_REPORT": return "Approve";
    case "ACCEPT_ACTIVITY": return "Accept";
    case "VERIFY_EVIDENCE": return "Verify";
    case "REQUEST": return "Request";
  }
}
