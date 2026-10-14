"use client";

import { useEffect, useRef, useState } from "react";
import { createDraftStore } from "@/lib/client/draft-store";
import { describeReadinessChange, parseReadinessSnapshot, readinessChangeSentence, type ReadinessSnapshot } from "../domain/readiness-change";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** One line under the readiness gauge when the score moved since the last time this report was opened in this browser. */
export function ReadinessChange({ periodId, now }: { periodId: string; now: ReadinessSnapshot }) {
  const [sentence, setSentence] = useState<string | null>(null);
  const [tone, setTone] = useState<"up" | "down">("up");
  const done = useRef(false);
  const snapshotKey = JSON.stringify(now);

  useEffect(() => {
    // Strict mode runs effects twice; the first run already compared and stored.
    if (done.current) return;
    done.current = true;
    const store = createDraftStore<ReadinessSnapshot>(window.localStorage, {
      key: `donordesk.readiness.${periodId}`,
      parse: parseReadinessSnapshot,
      hasContent: () => true,
      ttlMs: THIRTY_DAYS_MS,
    });
    const current = JSON.parse(snapshotKey) as ReadinessSnapshot;
    const change = describeReadinessChange(store.load()?.value ?? null, current);
    if (change) {
      setSentence(readinessChangeSentence(change));
      setTone(change.direction);
    }
    store.save(current);
  }, [periodId, snapshotKey]);

  if (!sentence) return null;
  return (
    <p role="status" className={`mt-2 text-xs ${tone === "down" ? "text-warning-700 dark:text-warning-400" : "text-success-700 dark:text-success-400"}`}>
      {sentence}
    </p>
  );
}
