/**
 * Automations (phase 28.1-K): a fixed list of rules, each on or off per project. Each one looks at the plan and says who should
 * be told and why. No user-written code: a rule is added here, with a test, and nothing else. Notices are sent by the hourly
 * reminder run, at most once per item per day (the ledger remembers).
 */
import { addDays, daysBetween, type PlainDate } from "./plain-date.js";
import type { PlanStatus } from "./plan-status-transitions.js";

export const AUTOMATION_RULES = {
  /** An activity starts within the next few days and nobody leads it: tell the project manager. */
  START_WITHOUT_LEAD: { label: "Tell the project manager when an activity starts soon with no lead", defaultOn: true },
  /** A finished activity still has files it needs: tell its lead, for two weeks after it ended. */
  FILES_STILL_NEEDED: { label: "Tell the lead when a finished activity still needs files", defaultOn: true },
} as const;
export type AutomationRuleKey = keyof typeof AUTOMATION_RULES;
export const AUTOMATION_RULE_KEYS = Object.keys(AUTOMATION_RULES) as AutomationRuleKey[];

export const START_SOON_DAYS = 3;
export const FILES_WINDOW_DAYS = 14;

export interface AutomationItem {
  id: string;
  title: string;
  ownerUserId?: string;
  status: PlanStatus;
  plannedStart: PlainDate;
  plannedEnd: PlainDate;
  /** Kinds of file that should prove it and no completed activity has shown yet. */
  stillNeeded: string[];
}

export interface AutomationNotice {
  ruleKey: AutomationRuleKey;
  itemId: string;
  /** "LEAD" when the activity has a lead, "MANAGER" when the manager must act (no lead). */
  recipient: "LEAD" | "MANAGER";
  title: string;
  message: string;
}

/** Notices for the rules that are on. Pure: today is passed in. */
export function automationNotices(items: ReadonlyArray<AutomationItem>, today: PlainDate, enabled: ReadonlySet<AutomationRuleKey>): AutomationNotice[] {
  const notices: AutomationNotice[] = [];
  for (const item of items) {
    if (enabled.has("START_WITHOUT_LEAD") && item.status === "PLANNED" && !item.ownerUserId) {
      const until = daysBetween(today, item.plannedStart);
      if (until >= 0 && until <= START_SOON_DAYS) {
        notices.push({
          ruleKey: "START_WITHOUT_LEAD", itemId: item.id, recipient: "MANAGER",
          title: `${item.title} starts soon with no lead`,
          message: until === 0 ? `${item.title} starts today and nobody leads it yet. Choose a lead on the plan.` : `${item.title} starts in ${until} day${until === 1 ? "" : "s"} and nobody leads it yet. Choose a lead on the plan.`,
        });
      }
    }
    if (enabled.has("FILES_STILL_NEEDED") && item.status === "DONE" && item.stillNeeded.length > 0) {
      const sinceEnd = daysBetween(item.plannedEnd, today);
      if (sinceEnd >= 0 && sinceEnd <= FILES_WINDOW_DAYS) {
        notices.push({
          ruleKey: "FILES_STILL_NEEDED", itemId: item.id, recipient: item.ownerUserId ? "LEAD" : "MANAGER",
          title: `${item.title} still needs files`,
          message: `Still needed for ${item.title}: ${item.stillNeeded.join(", ")}. Attach them to the completed activity.`,
        });
      }
    }
  }
  return notices;
}

/** The date a notice is recorded under: today, so one notice per item per rule per day. */
export function noticeSubjectKey(notice: AutomationNotice): string {
  return `automation:${notice.ruleKey}:${notice.itemId}`;
}

export const addDaysToToday = (today: PlainDate, days: number): PlainDate => addDays(today, days);
