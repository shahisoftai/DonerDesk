/**
 * The history of one indicator value (Phase 34.2), read from the audit trail: who did what to it, when, and what the figure was
 * before and after. Pure: the screen gets plain words, never an event code. A value that was never audited has no history, and the
 * sheet says so rather than inventing one.
 */

export interface ValueAuditEvent {
  eventType: string;
  actorId: string;
  actorName?: string | undefined;
  at: Date;
  oldValue?: string | undefined;
  newValue?: string | undefined;
}

export interface ValueHistoryEntry {
  at: string;
  /** Who did it; empty for a system step. */
  by: string;
  /** What happened, in plain words. */
  what: string;
  /** The figure change ("10 → 12") when the event carried one. */
  change?: string | undefined;
}

/** The audit events that describe a value's life, and how each reads. One table; an unlisted event is not part of the history. */
export const VALUE_EVENT_WORDS: Readonly<Record<string, string>> = {
  "logframe.indicator.updated": "Saved",
  "logframe.indicator.created": "Entered",
  "logframe.indicator.submitted": "Handed in for review",
  "logframe.indicator.verified": "Verified",
  "logframe.indicator.correction_requested": "Returned for changes",
  "logframe.indicator.rejected": "Rejected",
};

const show = (v: string | undefined): string => (v === undefined || v.trim() === "" ? "empty" : v.trim());

/** Newest first, at most `limit`; events that do not describe a value are left out. */
export function describeValueHistory(events: ReadonlyArray<ValueAuditEvent>, limit = 50): ValueHistoryEntry[] {
  return events
    .filter((e) => e.eventType in VALUE_EVENT_WORDS)
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, limit)
    .map((e) => {
      const changed = e.oldValue !== undefined || e.newValue !== undefined;
      return {
        at: e.at.toISOString(),
        by: e.actorName ?? "",
        what: VALUE_EVENT_WORDS[e.eventType]!,
        ...(changed && show(e.oldValue) !== show(e.newValue) ? { change: `${show(e.oldValue)} → ${show(e.newValue)}` } : {}),
      };
    });
}
