/**
 * "What changed" beside a readiness score: the recent actions that move it, in plain words, read from the audit trail.
 * Only events that change readiness are listed; anything else is ignored.
 */
export interface ChangeEvent {
  eventType: string;
  createdAt: Date;
  newValue?: string | undefined;
}

const SENTENCE: Readonly<Record<string, (e: ChangeEvent) => string>> = {
  "report.section.regenerated": () => "A section was regenerated, so it needs a fresh check",
  "report.section.reopened": () => "A section was reopened after approval",
  "report.section.approved": () => "A section was approved",
  "report.draft.generated": () => "A draft was generated",
  "report.section.flags_resolved": () => "Statements in a section were decided",
  "report.revision.reassessed": () => "A section was re-checked against the evidence",
  "report.approved": () => "The report was approved",
  "report.summary.marked_current": () => "A summary was confirmed as current",
  "report.revision.created": () => "A section's text was edited",
  "checklist.closed_by_data": () => "A checklist item closed by itself because the data now satisfies it",
  "compliance.checklist.resolve": () => "A checklist item was resolved",
  "compliance.checklist.bulk": () => "Several checklist items were decided at once",
  "evidence.verified": () => "A file was verified",
  "reporting_period.section_note_saved": () => "A compliance statement was saved",
  "reporting_period.scope_updated": () => "The report's scope changed, so drafted sections need a re-check",
  "indicator.update.verified": () => "An indicator value was verified",
};

export const READINESS_CHANGE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Newest first, with repeats merged ("3 sections were regenerated"); at most `limit` lines, within the last day. */
export function describeReadinessChanges(events: ReadonlyArray<ChangeEvent>, now: Date, limit = 5): string[] {
  const counts = new Map<string, { n: number; latest: number; event: ChangeEvent }>();
  for (const event of events) {
    if (now.getTime() - event.createdAt.getTime() > READINESS_CHANGE_WINDOW_MS) continue;
    const key = Object.keys(SENTENCE).find((k) => event.eventType === k || event.eventType.startsWith(`${k}.`));
    if (!key) continue;
    const entry = counts.get(key) ?? { n: 0, latest: 0, event };
    entry.n += 1;
    entry.latest = Math.max(entry.latest, event.createdAt.getTime());
    counts.set(key, entry);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1].latest - a[1].latest)
    .slice(0, limit)
    .map(([key, { n, event }]) => (n === 1 ? SENTENCE[key]!(event) : `${SENTENCE[key]!(event)} (${n} times)`));
}
