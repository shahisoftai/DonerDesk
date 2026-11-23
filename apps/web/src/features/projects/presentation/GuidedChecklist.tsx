import Link from "next/link";
import { Check, Circle } from "lucide-react";
import type { Checklist, ChecklistItem } from "@/features/projects/domain/setup-checklist";

/** The setup checklist with its guidance: why each item matters, how long it takes, and one button. It reads; the button opens the screen that does the work. */
export function GuidedChecklist({ checklist, projectId }: { checklist: Checklist; projectId: string }) {
  const open = checklist.items.filter((i) => !i.done);
  const done = checklist.items.filter((i) => i.done);
  return (
    <section aria-label="Setup checklist" data-tour-id="setup-guided-checklist">
      <h3 className="section-title">{checklist.complete ? "Your project is fully set up" : `${checklist.done} of ${checklist.total} set up`}</h3>
      {open.length > 0 ? <ul className="mt-3 space-y-2">{open.map((i) => <Row key={i.id} item={i} projectId={projectId} />)}</ul> : <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Nothing is left to set up. You can still change any of it from the stage menus.</p>}
      {done.length > 0 ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-600 dark:text-slate-300">Done ({done.length})</summary>
          <ul className="mt-2 space-y-1.5">{done.map((i) => <Row key={i.id} item={i} projectId={projectId} />)}</ul>
        </details>
      ) : null}
    </section>
  );
}

function Row({ item, projectId }: { item: ChecklistItem; projectId: string }) {
  return (
    <li className="card flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2">
        {item.done ? <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-success-600" /> : <Circle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />}
        <div className="min-w-0">
          <div className={item.done ? "text-sm text-slate-500 line-through dark:text-slate-400" : "text-sm font-medium"}>{item.title}</div>
          {!item.done ? <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{item.why} <span className="text-slate-500 dark:text-slate-400">{item.effort}.</span></p> : null}
        </div>
      </div>
      {!item.done ? <Link className="btn-secondary shrink-0" href={`/projects/${projectId}${item.path}`}>{item.action}</Link> : null}
    </li>
  );
}
