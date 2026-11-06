/**
 * What the Record forms write (Phase 44): one small interface per kind of record, so a form depends only on the write it makes. A sink
 * decides HOW it reaches the server (now, or kept on the phone and sent later); the form never knows which. Every sink ends in an
 * existing action or outbox sender: there is no write path here that the app did not already have.
 */

export type SinkResult<T> = { ok: true; value: T } | { ok: false; message: string };

export interface ValueInput {
  indicatorId: string;
  code: string;
  /** The day the value is for, `YYYY-MM-DD`. */
  date: string;
  /** The period the day lands in, already worked out with `dateLanding` (offline too). */
  periodId: string;
  periodLabel: string;
  value: string;
  note?: string | undefined;
  source?: string | undefined;
  disaggregation?: ReadonlyArray<{ dimension: string; category: string; value: string }> | undefined;
  /** The caller names the period itself (a row that is already about one period), so the day does not decide it. */
  namePeriod?: boolean | undefined;
}

export interface ValueSaved {
  /** Kept on this phone to be sent later (no connection), rather than saved on the server. */
  queued: boolean;
  code: string;
  periodLabel: string;
  reportingPeriodId: string;
  /** Plain sentences from the server (a suggested total, a value left as a draft). Never a refusal. */
  notices: string[];
}

export interface ValueSink {
  saveValue(input: ValueInput): Promise<SinkResult<ValueSaved>>;
}

/** What the "What happened?" flow writes about a planned item. Each method ends in an existing action or outbox sender. */
export interface WorkSink {
  /** One call: records the completed activity and marks the plan item done. Needs a connection (it has no outbox sender). */
  completePlanned(input: { itemId: string; title: string; finishedOn: string; people?: string | undefined; note?: string | undefined }): Promise<SinkResult<{ activityId: string }>>;
  /** A status step (under way, done, not held): sent now, or kept on the phone and sent later. */
  changeStatus(input: { itemId: string; title: string; action: "START" | "COMPLETE" | "CANCEL"; reason?: string | undefined; completedOn?: string | undefined }): Promise<SinkResult<{ queued: boolean }>>;
}
