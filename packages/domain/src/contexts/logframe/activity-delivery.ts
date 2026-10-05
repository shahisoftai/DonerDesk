/** What has been delivered against a logframe ACTIVITY node, from the activity records pointing at it. */
export interface DeliveryFact {
  logframeActivityId?: string | undefined;
  status: string;
  activityDate: Date;
  participantsTotal?: number | undefined;
}

export interface NodeDelivery {
  recordedCount: number;
  acceptedCount: number;
  /** ISO date of the most recent record. */
  lastActivityDate: string;
  /** Participants in accepted records (what reports use). */
  participantsTotal: number;
}

export function summariseActivityDelivery(records: ReadonlyArray<DeliveryFact>): Map<string, NodeDelivery> {
  const out = new Map<string, NodeDelivery>();
  for (const r of records) {
    if (!r.logframeActivityId) continue;
    const cur = out.get(r.logframeActivityId) ?? { recordedCount: 0, acceptedCount: 0, lastActivityDate: "", participantsTotal: 0 };
    cur.recordedCount += 1;
    const accepted = r.status === "ACCEPTED";
    if (accepted) {
      cur.acceptedCount += 1;
      cur.participantsTotal += r.participantsTotal ?? 0;
    }
    const iso = r.activityDate.toISOString();
    if (iso > cur.lastActivityDate) cur.lastActivityDate = iso;
    out.set(r.logframeActivityId, cur);
  }
  return out;
}
