import type { SetupDraftView } from "@/lib/server/schemas-project-setup-draft";
import { ganttLayout } from "../../domain/plan-gantt";
import { usePcwCopy } from "./usePcwCopy";

const BAR: Record<string, string> = { ACCEPTED: "bg-green-500", EDITED: "bg-green-500", PROPOSED: "bg-amber-400" };

/** The work plan as bars on one timeline, so wrong dates stand out before the project starts. An activity without dates is listed, never drawn. */
export function PlanTimeline({ view }: { view: SetupDraftView }) {
  const t = usePcwCopy().c.parity;
  const layout = ganttLayout(view.plan.map((p) => ({ path: p.path, title: p.value.title ?? "", start: p.value.start ?? null, end: p.value.end ?? null, status: p.status })));
  if (!layout) return null;
  return (
    <details open className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
      <summary className="cursor-pointer select-none text-sm font-semibold">{t.ganttTitle}</summary>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{t.ganttSpan(layout.start, layout.end)}</p>
      <div className="mt-3 overflow-x-auto">
        <div className="min-w-[640px]" dir="ltr">
          <div className="relative ms-[40%] h-5 border-b border-slate-200 text-[10px] text-slate-500 dark:border-white/10">
            {layout.months.map((m) => <span key={m.label} className="absolute top-0 border-s border-slate-200 ps-1 dark:border-white/10" style={{ left: `${m.at}%` }}>{m.label}</span>)}
          </div>
          <ul className="mt-1 space-y-0.5">
            {layout.bars.map((bar) => (
              <li key={bar.path} className="flex items-center gap-2 text-[11px]">
                <span className="w-[40%] truncate" title={bar.title}>{bar.title}</span>
                <span className="relative h-3 flex-1 rounded bg-slate-100 dark:bg-white/5">
                  <span className={`absolute top-0 h-3 rounded ${BAR[bar.status] ?? "bg-slate-300"}`} style={{ left: `${bar.left}%`, width: `${bar.width}%` }} title={`${bar.start} – ${bar.end}`} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {layout.undated.length > 0 ? <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">{t.ganttUndated(layout.undated.length)}</p> : null}
    </details>
  );
}
