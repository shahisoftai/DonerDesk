import type { DraftItemOrigin } from "../domain/results-view";
import { usePcwCopy } from "./usePcwCopy";
import { WhereFound } from "./WhereFound";


/** Where an item came from, in words (never colour alone); an item read from a document can show the passage it came from. */
export function OriginBadge({ origin, id, source, quote, showTag = true }: { origin: DraftItemOrigin; showTag?: boolean; id?: string; source?: { documentId: string; block: number } | null | undefined; quote?: string | null | undefined }) {
  const words = usePcwCopy().c.parity.origin;
  return (
    <>
      {showTag ? <span className="rounded-full border border-slate-300 px-2 py-0.5 text-xs text-slate-700 dark:border-white/20 dark:text-slate-200">{words[origin]}</span> : null}
      {id && source && quote ? <WhereFound id={id} source={source} quote={quote} /> : null}
    </>
  );
}
