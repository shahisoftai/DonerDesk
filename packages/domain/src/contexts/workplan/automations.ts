/**
 * Automations (phase 28.1-K): a fixed list of rules, each on or off per project. Each one looks at the plan and says who should
 * be told and why. No user-written code: a rule is added here, with a test, and nothing else. Notices are sent by the hourly
 * reminder run, at most once per item per day (the ledger remembers).
 */
import { addDays, daysBetween, type PlainDate } from "./plain-date.js";
import type { PlanStatus } from "./plan-status-transitions.js";

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

/** What a rule says about one item, or nothing. The registry adds the rule key and the item id. */
export type AutomationFinding = Omit<AutomationNotice, "ruleKey" | "itemId">;

interface AutomationRuleDefinition {
  label: string;
  defaultOn: boolean;
  evaluate(item: AutomationItem, today: PlainDate): AutomationFinding | undefined;
}

export const START_SOON_DAYS = 3;
export const FILES_WINDOW_DAYS = 14;

/**
 * The one list of automation rules. A rule is a label, a default, and a pure `evaluate`. Adding a rule is adding an entry here:
 * the runner, the settings list and the notice builder read this registry and need no change.
 */
export const AUTOMATION_REGISTRY = {
  /** An activity starts within the next few days and nobody leads it: tell the project manager. */
  START_WITHOUT_LEAD: {
    label: "Tell the project manager when an activity starts soon with no lead",
    defaultOn: true,
    evaluate(item, today) {
      if (item.status !== "PLANNED" || item.ownerUserId) return undefined;
      const until = daysBetween(today, item.plannedStart);
      if (until < 0 || until > START_SOON_DAYS) return undefined;
      return {
        recipient: "MANAGER",
        title: `${item.title} starts soon with no lead`,
        message: until === 0
          ? `${item.title} starts today and nobody leads it yet. Choose a lead on the plan.`
          : `${item.title} starts in ${until} day${until === 1 ? "" : "s"} and nobody leads it yet. Choose a lead on the plan.`,
      };
    },
  },
  /** A finished activity still has files it needs: tell its lead, for two weeks after it ended. */
  FILES_STILL_NEEDED: {
    label: "Tell the lead when a finished activity still needs files",
    defaultOn: true,
    evaluate(item, today) {
      if (item.status !== "DONE" || item.stillNeeded.length === 0) return undefined;
      const sinceEnd = daysBetween(item.plannedEnd, today);
      if (sinceEnd < 0 || sinceEnd > FILES_WINDOW_DAYS) return undefined;
      return {
        recipient: item.ownerUserId ? "LEAD" : "MANAGER",
        title: `${item.title} still needs files`,
        message: `Still needed for ${item.title}: ${item.stillNeeded.join(", ")}. Attach them to the completed activity.`,
      };
    },
  },
} satisfies Record<string, AutomationRuleDefinition>;

export type AutomationRuleKey = keyof typeof AUTOMATION_REGISTRY;
/** The registry under its earlier name: label and default per rule. */
export const AUTOMATION_RULES = AUTOMATION_REGISTRY;
export const AUTOMATION_RULE_KEYS = Object.keys(AUTOMATION_REGISTRY) as AutomationRuleKey[];

/** Notices for the rules that are on. Pure: today is passed in. */
export function automationNotices(items: ReadonlyArray<AutomationItem>, today: PlainDate, enabled: ReadonlySet<AutomationRuleKey>): AutomationNotice[] {
  const notices: AutomationNotice[] = [];
  for (const item of items) {
    for (const key of AUTOMATION_RULE_KEYS) {
      if (!enabled.has(key)) continue;
      const finding = (AUTOMATION_REGISTRY[key] as AutomationRuleDefinition).evaluate(item, today);
      if (finding) notices.push({ ruleKey: key, itemId: item.id, ...finding });
    }
  }
  return notices;
}

/** The date a notice is recorded under: today, so one notice per item per rule per day. */
export function noticeSubjectKey(notice: AutomationNotice): string {
  return `automation:${notice.ruleKey}:${notice.itemId}`;
}

export const addDaysToToday = (today: PlainDate, days: number): PlainDate => addDays(today, days);
