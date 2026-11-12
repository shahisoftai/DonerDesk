import { parseSnapshot, type LogframeSnapshot } from "./logframe-snapshot.js";

/**
 * Which framework a report is read against once it has been approved. A target that moves afterwards must not change what an
 * approved report says it was measured against, so the report's indicator tables read the definitions of the version that was
 * current at approval. Pure: the caller supplies the versions and the moment.
 */
export interface VersionLike {
  snapshotJson: string;
  createdAt: Date;
}

/** The framework in force at a moment: the newest version created at or before it, or null when none existed yet. */
export function versionInForce(versions: ReadonlyArray<VersionLike>, at: Date): LogframeSnapshot | null {
  let best: VersionLike | null = null;
  for (const v of versions) {
    if (v.createdAt.getTime() > at.getTime()) continue;
    if (!best || v.createdAt.getTime() > best.createdAt.getTime()) best = v;
  }
  return best ? parseSnapshot(best.snapshotJson) : null;
}

/** An indicator as the framework in force defined it (baseline and target). One the snapshot never knew is returned as it is. */
export function indicatorAsApproved<T extends { id: string; baseline: string; target: string }>(live: T, snapshot: LogframeSnapshot | null): T {
  const approved = snapshot?.indicators.find((i) => i.id === live.id);
  return approved ? { ...live, baseline: approved.baseline, target: approved.target } : live;
}
