import type { SlideKey } from "@donordesk/domain";
import type { SetupDraftView } from "@/lib/server/schemas-project-setup-draft";
import { leftOutFor } from "../domain/parity-view";
import { usePcwCopy } from "./usePcwCopy";

/** What the reading found for this step but could not find word for word in the documents: shown, never silently dropped. */
export function LeftOutNote({ view, slide }: { view: SetupDraftView; slide: SlideKey }) {
  const t = usePcwCopy().c.parity;
  const areas = leftOutFor(view, slide);
  const total = areas.reduce((n, a) => n + a.total, 0);
  if (total === 0) return null;
  return (
    <details className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-white/10 dark:bg-white/5">
      <summary className="cursor-pointer select-none font-medium">{t.leftOutTitle(total)}</summary>
      <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{t.leftOutLead}</p>
      <ul className="mt-2 space-y-1">
        {areas.flatMap((a) => a.items).map((item, i) => (
          <li key={`${item.field}-${i}`} className="text-xs">“{item.text}” <span className="text-slate-500">· {t.leftOutReasons[item.reason]}</span></li>
        ))}
      </ul>
      {areas.some((a) => a.items.length < a.total) ? <p className="mt-2 text-xs text-slate-500">{t.leftOutMore}</p> : null}
    </details>
  );
}
