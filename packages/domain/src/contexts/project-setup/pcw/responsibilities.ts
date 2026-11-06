/**
 * What a named person is responsible for once they are on the project (Phase 38.9c): the indicators they own. Written at
 * launch for people who already have an account, and kept for the rest until they join, so naming someone in the wizard
 * never depends on them having an account yet. A new kind of responsibility is a row in `RESPONSIBILITY_KINDS` and one
 * applier; nothing that stores, lists or resolves them is edited. Pure.
 */
import { planKeyOf, type SetupDraft } from "./draft.js";
import { live } from "./requirements/shared.js";

/** A planned activity is found again after launch by its title and start day (the plan's own keys do not exist in the database). */
export type Responsibility =
  | { kind: "INDICATOR_OWNER"; indicatorCode: string }
  | { kind: "PLAN_LEAD"; title: string; start: string | null };

export const RESPONSIBILITY_KINDS = ["INDICATOR_OWNER", "PLAN_LEAD"] as const;
export type ResponsibilityKind = (typeof RESPONSIBILITY_KINDS)[number];

/** Each kind: how to read it from the draft, and the sentence that says it. */
const READERS: { [K in ResponsibilityKind]: { of: (draft: SetupDraft, personKey: string) => Array<Extract<Responsibility, { kind: K }>>; say: (r: Extract<Responsibility, { kind: K }>) => string; valid: (r: Extract<Responsibility, { kind: K }>) => boolean } } = {
  INDICATOR_OWNER: {
    of: (draft, personKey) => Object.entries(draft.extras.indicatorSetup).filter(([, s]) => s.ownerKey === personKey).map(([indicatorCode]) => ({ kind: "INDICATOR_OWNER" as const, indicatorCode })),
    say: (r) => `owns indicator ${r.indicatorCode}`,
    valid: (r) => typeof r.indicatorCode === "string",
  },
  PLAN_LEAD: {
    of: (draft, personKey) => live(draft.proposal.plan).flatMap((def) => (draft.extras.planSetup[planKeyOf(def)]?.leadKey === personKey && def.title ? [{ kind: "PLAN_LEAD" as const, title: def.title, start: def.start }] : [])),
    say: (r) => `leads “${r.title}”`,
    valid: (r) => typeof r.title === "string" && (r.start === null || typeof r.start === "string"),
  },
};

/** Everything the draft makes this person responsible for, in a stable order. */
export function responsibilitiesOf(draft: SetupDraft, personKey: string): Responsibility[] {
  return RESPONSIBILITY_KINDS.flatMap((k) => READERS[k].of(draft, personKey) as Responsibility[]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

export function describeResponsibility(r: Responsibility): string {
  return (READERS[r.kind].say as (x: Responsibility) => string)(r);
}

/** Stored responsibilities come back as JSON: keep only the kinds this code still knows. */
export function readResponsibilities(json: string): Responsibility[] {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((r): r is Responsibility => {
      if (!r || typeof r !== "object" || !(RESPONSIBILITY_KINDS as readonly string[]).includes((r as { kind?: string }).kind ?? "")) return false;
      return (READERS[(r as Responsibility).kind].valid as (x: Responsibility) => boolean)(r as Responsibility);
    });
  } catch {
    return [];
  }
}
