"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cancelReportGenerationAction, generateDraftAction, getReportDraftAction } from "@/lib/actions/reporting";
import { draftGeneratedCopy } from "@/lib/reporting-copy";

export type LiveSection = {
  id: string;
  sectionTitle: string;
  sectionOrder?: number;
  content?: string;
  status: string;
};

// ~20 minutes: a safety ceiling for a stuck run, not the expected duration.
const MAX_POLL_ATTEMPTS = 300;

/**
 * Starts a background section-wise draft, polls it until every section is
 * written, and exposes progress + stop. While generating, `liveSections`
 * owns the section list (sections flip NOT_STARTED → DRAFTED as they finish).
 */
export function useDraftGeneration<T extends LiveSection>(periodId: string, serverSections: T[]) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [liveSections, setLiveSections] = useState<T[]>(serverSections);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!generating) setLiveSections(serverSections);
  }, [serverSections, generating]);

  const done = liveSections.filter((s) => s.status !== "NOT_STARTED").length;
  const total = liveSections.length;

  const etaLabel = useMemo(() => {
    if (!generating || !startedAt || done <= 0 || done >= total) return null;
    const perSection = (Date.now() - startedAt) / done;
    const secs = Math.round((perSection * (total - done)) / 1000);
    if (secs <= 0) return null;
    const m = Math.floor(secs / 60);
    return `about ${m > 0 ? `${m} min ` : ""}${secs % 60}s left`;
  }, [generating, startedAt, done, total]);

  const generate = useCallback(async () => {
    setStarting(true);
    setError(null);
    setMessage(null);
    try {
      const result = await generateDraftAction(periodId);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      if (result.value.generating) {
        setGenerating(true);
        setStartedAt(Date.now());
      } else {
        setMessage(
          draftGeneratedCopy({
            sectionCount: result.value.sectionIds.length,
            fallbackUsed: Boolean(result.value.fallbackUsed),
            fallbackReason: result.value.fallbackReason,
          }),
        );
      }
      router.refresh();
    } finally {
      setStarting(false);
    }
  }, [periodId, router]);

  const stop = useCallback(async () => {
    setStopping(true);
    try {
      const result = await cancelReportGenerationAction(periodId);
      if (result.ok) {
        setGenerating(false);
        setStartedAt(null);
        setMessage(result.value.cancelled ? "Writing stopped. Sections already written are kept." : "Nothing was being written.");
      } else {
        setError(result.error.message);
      }
      router.refresh();
    } finally {
      setStopping(false);
    }
  }, [periodId, router]);

  useEffect(() => {
    if (!generating) return;
    let cancelled = false;
    let attempts = 0;
    let timer: number | undefined;
    const poll = async () => {
      if (cancelled) return;
      attempts += 1;
      if (attempts > MAX_POLL_ATTEMPTS) {
        setGenerating(false);
        setMessage("Writing is taking longer than expected and continues in the background. Refresh to see new sections.");
        return;
      }
      const result = await getReportDraftAction(periodId);
      if (cancelled) return;
      if (result.ok) {
        const next = [...(result.value.sections ?? [])].sort((a, b) => a.sectionOrder - b.sectionOrder) as unknown as T[];
        setLiveSections(next);
        const finished = next.filter((s) => s.status !== "NOT_STARTED").length;
        if (next.length > 0 && finished >= next.length) {
          setGenerating(false);
          setMessage("All sections are written.");
          router.refresh();
          return;
        }
      }
      timer = window.setTimeout(poll, 4000);
    };
    timer = window.setTimeout(poll, 2000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [generating, periodId, router]);

  return {
    generating,
    starting,
    stopping,
    liveSections,
    progress: { done, total, etaLabel },
    message,
    error,
    generate,
    stop,
    clearMessage: () => setMessage(null),
  };
}
