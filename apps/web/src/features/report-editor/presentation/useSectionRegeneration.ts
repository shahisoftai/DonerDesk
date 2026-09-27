"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getReportDraftAction, regenerateReportSectionAction } from "@/lib/actions/reporting";

const POLL_MS = 3000;
// ~6 minutes: beyond the worker's per-section budget (200s) plus queueing.
const MAX_POLLS = 120;

export type RegenerationOutcome = {
  sectionId: string;
  /** The text changed (the AI produced a new version). */
  changed: boolean;
  /** Text before regenerating, for "Restore previous version"; unknown after a reload. */
  previousContent?: string;
  /** The section's version after regenerating (for a restore save). */
  version?: string;
};

type Watched = { previousContent?: string };

/**
 * Single-section regeneration (Report Editor U11): starts it, follows it by
 * polling the draft's `regeneratingSectionIds`, and reports each finished
 * section once — whether its text changed, with the previous text so the
 * page can offer "Restore previous version". Sections already regenerating
 * when the page opens are followed too.
 */
export function useSectionRegeneration(
  periodId: string,
  serverRegeneratingIds: ReadonlyArray<string>,
  onFinished: (outcome: RegenerationOutcome) => void,
) {
  const router = useRouter();
  const [watched, setWatched] = useState<Map<string, Watched>>(() => new Map(serverRegeneratingIds.map((id) => [id, {}])));
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;
  // Finished here, but the page's server data may still list them until it refreshes.
  const finishedRef = useRef(new Set<string>());

  // Follow regenerations the server reports that this page did not start.
  useEffect(() => {
    for (const id of finishedRef.current) if (!serverRegeneratingIds.includes(id)) finishedRef.current.delete(id);
    setWatched((current) => {
      const missing = serverRegeneratingIds.filter((id) => !current.has(id) && !finishedRef.current.has(id));
      if (missing.length === 0) return current;
      const next = new Map(current);
      for (const id of missing) next.set(id, {});
      return next;
    });
  }, [serverRegeneratingIds]);

  const start = useCallback(
    async (sectionId: string, instruction: string, previousContent: string): Promise<boolean> => {
      setStarting(sectionId);
      setError(null);
      try {
        const result = await regenerateReportSectionAction(sectionId, instruction);
        if (!result.ok) {
          setError(result.error.message);
          return false;
        }
        finishedRef.current.delete(sectionId);
        setWatched((current) => new Map(current).set(sectionId, { previousContent }));
        return true;
      } finally {
        setStarting(null);
      }
    },
    [],
  );

  const watchKey = useMemo(() => [...watched.keys()].sort().join(","), [watched]);

  useEffect(() => {
    if (!watchKey) return;
    let cancelled = false;
    let polls = 0;
    let timer: number | undefined;
    const poll = async () => {
      if (cancelled) return;
      polls += 1;
      const result = await getReportDraftAction(periodId);
      if (cancelled) return;
      if (result.ok) {
        const running = new Set(result.value.regeneratingSectionIds ?? []);
        const sections = new Map((result.value.sections ?? []).map((s) => [s.id, s]));
        const finished = [...watched.entries()].filter(([id]) => !running.has(id) || polls > MAX_POLLS);
        if (finished.length > 0) {
          setWatched((current) => {
            const next = new Map(current);
            for (const [id] of finished) next.delete(id);
            return next;
          });
          for (const [id, info] of finished) {
            finishedRef.current.add(id);
            const now = sections.get(id);
            onFinishedRef.current({
              sectionId: id,
              changed: info.previousContent === undefined ? true : now !== undefined && now.content !== info.previousContent,
              previousContent: info.previousContent,
              version: now?.updatedAt,
            });
          }
          router.refresh();
          return;
        }
      }
      timer = window.setTimeout(poll, POLL_MS);
    };
    timer = window.setTimeout(poll, POLL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // `watched` is read through the key: the effect restarts only when the set changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchKey, periodId, router]);

  const regeneratingIds = useMemo(() => new Set(watched.keys()), [watched]);

  return { regeneratingIds, start, starting, error, clearError: () => setError(null) };
}
