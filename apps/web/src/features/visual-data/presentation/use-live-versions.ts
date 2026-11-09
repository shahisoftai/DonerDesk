"use client";

import { useEffect, useRef, useState } from "react";
import { getVisualDataVersionsAction } from "@/lib/actions/visual-data";
import { blocksToReload, nextPollDelay, type BlockReads, type SeenState } from "../domain/live-refresh";

/**
 * Keeps an open canvas current (Phase 48.17). Asks for version numbers on a timer and tells the page which blocks to ask again;
 * the rules are the pure functions in `live-refresh.ts`. It stops while the tab is hidden or the device is offline, backs off after
 * failures, and asks once more the moment the tab becomes visible again.
 */
export function useLiveVersions(reads: ReadonlyArray<BlockReads>, onChanged: (blockIds: string[]) => void): { offline: boolean; lastChecked: Date | null } {
  const [offline, setOffline] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const seen = useRef<SeenState>({});
  const failures = useRef(0);
  const readsRef = useRef(reads);
  const changedRef = useRef(onChanged);
  readsRef.current = reads;
  changedRef.current = onChanged;
  const key = [...new Set(reads.map((r) => r.projectId))].sort().join(",");

  useEffect(() => {
    if (!key) return undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const schedule = () => {
      if (stopped) return;
      const delay = nextPollDelay({ failures: failures.current, hidden: document.visibilityState === "hidden", offline: !navigator.onLine });
      if (delay !== null) timer = setTimeout(() => void poll(), delay * 1000);
    };

    async function poll() {
      const result = await getVisualDataVersionsAction(key.split(","));
      if (stopped) return;
      if (!result.ok) { failures.current += 1; setOffline(true); schedule(); return; }
      failures.current = 0;
      setOffline(false);
      setLastChecked(new Date());
      const now = Object.fromEntries(result.value.projects.map((p) => [p.projectId, { epoch: p.epoch, versions: p.versions }]));
      const changed = blocksToReload(readsRef.current, seen.current, now);
      seen.current = { ...seen.current, ...now };
      if (changed.length > 0) changedRef.current(changed);
      schedule();
    }

    const wake = () => { if (document.visibilityState === "visible" && navigator.onLine) { if (timer) clearTimeout(timer); void poll(); } };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    void poll();
    return () => { stopped = true; if (timer) clearTimeout(timer); document.removeEventListener("visibilitychange", wake); window.removeEventListener("online", wake); };
  }, [key]);

  return { offline, lastChecked };
}
