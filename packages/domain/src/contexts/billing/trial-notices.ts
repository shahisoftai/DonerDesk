/**
 * Telling an organisation its free trial is ending (Phase 33.12). A trial that simply stops, with the workspace dropping to the free
 * limits, is the worst way to meet a customer; so the administrators are told three days before, one day before, and once after
 * it has ended. Each notice is sent once (the reminder ledger remembers) and, if the run was late, only the most urgent one that
 * still applies is sent. Pure: the time is passed in.
 */
export type TrialNoticeRule = "TRIAL_3D" | "TRIAL_1D" | "TRIAL_ENDED";

export interface TrialNotice {
  rule: TrialNoticeRule;
  title: string;
  message: string;
}

const DAY = 86_400_000;
/** After this many days an ended trial is no longer news. */
export const TRIAL_ENDED_NOTICE_DAYS = 7;

export function dueTrialNotice(input: { endsAt: Date; now: Date; alreadySent: ReadonlySet<TrialNoticeRule> }): TrialNotice | null {
  const { endsAt, now } = input;
  const left = endsAt.getTime() - now.getTime();
  if (left <= 0) {
    if (-left > TRIAL_ENDED_NOTICE_DAYS * DAY || input.alreadySent.has("TRIAL_ENDED")) return null;
    return {
      rule: "TRIAL_ENDED",
      title: "Your free trial has ended",
      message: "Your workspace is now on the free plan. Nothing was deleted: your projects, records and evidence are all still there, but the free plan's limits apply. Choose a plan in Settings → Plan & billing to get the trial's features back.",
    };
  }
  if (left <= DAY) {
    return input.alreadySent.has("TRIAL_1D") ? null : { rule: "TRIAL_1D", title: "Your free trial ends within a day", message: "Your trial ends within a day. Choose a plan in Settings → Plan & billing to keep the features you are using. If you do nothing, the workspace moves to the free plan and nothing is deleted." };
  }
  if (left <= 3 * DAY) {
    const days = Math.max(2, Math.floor(left / DAY));
    if (input.alreadySent.has("TRIAL_3D") || input.alreadySent.has("TRIAL_1D")) return null;
    return { rule: "TRIAL_3D", title: `Your free trial ends in ${days} days`, message: "Choose a plan in Settings → Plan & billing to keep the features you are using. If you do nothing, the workspace moves to the free plan and nothing is deleted." };
  }
  return null;
}
