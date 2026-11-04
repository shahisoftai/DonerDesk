import type { SlideKey } from "@donordesk/domain";
import type { SetupDraftView } from "@/lib/server/schemas-project-setup-draft";
import { sectionNoticeFor } from "../domain/parity-view";
import { usePcwCopy } from "./usePcwCopy";

/** A part the documents leave blank, or do not contain: highlighted, because nothing was filled in for it. */
export function SectionNotice({ view, slide }: { view: SetupDraftView; slide: SlideKey }) {
  const c = usePcwCopy().c;
  const notices = sectionNoticeFor(view, slide);
  if (notices.length === 0 || view.sources.length === 0) return null;
  return (
    <>
      {notices.map((n) => (
        <div key={n.area} role="status" data-testid="pcw-section-notice" className="rounded-xl border-2 border-amber-500 bg-amber-50 p-3 text-sm text-amber-950">
          {n.state === "EMPTY" ? c.sectionEmpty : n.state === "PARTLY_EMPTY" ? c.sectionPartly : c.sectionAbsent}
          {n.emptyHeadings.length > 0 ? <ul className="mt-1 list-disc ps-5">{n.emptyHeadings.map((h) => <li key={h}>{h}</li>)}</ul> : null}
        </div>
      ))}
    </>
  );
}
