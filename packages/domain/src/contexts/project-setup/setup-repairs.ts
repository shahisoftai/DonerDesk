/**
 * What a finished reading can show is probably incomplete, as a focused second look (extraction audit C2). One table: a rule
 * names the part to read again and what to look for; the second look can only add items, is grounded like the first, and
 * happens once. A difference that remains stays visible; nothing is ever changed to make figures agree. Pure.
 */
import { parseAmount } from "./budget-checks.js";
import type { SetupAreaKey } from "./proposal-areas.js";
import type { ProjectSetupProposal, Proposed } from "./proposal.js";

export interface SetupRepair {
  area: SetupAreaKey;
  /** Added to the area's prompt. Figures come from the proposal itself. */
  hint: string;
}

const live = <T>(items: ReadonlyArray<Proposed<T>>): T[] => items.filter((i) => i.status !== "REJECTED" && i.value !== null).map((i) => i.value!);

const budgetShort = (p: ProjectSetupProposal): SetupRepair | null => {
  const lines = live(p.budget).filter((b) => (b.kind ?? "LINE") === "LINE");
  const funded = live(p.funding);
  if (lines.length === 0 || funded.length !== 1) return null;
  const stated = parseAmount(funded[0]!.amount);
  const amounts = lines.map((l) => parseAmount(l.amount));
  if (stated === null || amounts.some((a) => a === null)) return null;
  const counted = (amounts as number[]).reduce((a, b) => a + b, 0);
  if (counted >= stated - 1) return null;
  return { area: "FUNDING_BUDGET", hint: `The budget lines read so far add up to ${counted}, and the stated funding is ${stated}. Look again in the budget table for costed lines that were missed (support costs, overheads). Add only lines the table states. If there are none, answer with empty lists.` };
};

export const SETUP_REPAIR_RULES: ReadonlyArray<(p: ProjectSetupProposal) => SetupRepair | null> = [budgetShort];

export const setupRepairs = (p: ProjectSetupProposal): SetupRepair[] => SETUP_REPAIR_RULES.flatMap((rule) => rule(p) ?? []);

const itemKey = (item: unknown): string => JSON.stringify((item as { value?: unknown }).value ?? null).toLowerCase();

/** The fields with the second look's new items added after the first look's; nothing already read changes. */
export function addOnlyNew(current: Readonly<Record<string, unknown>>, again: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(again)) {
    const had = current[field];
    if (!Array.isArray(had) || !Array.isArray(value)) continue;
    const seen = new Set(had.map(itemKey));
    out[field] = [...had, ...value.filter((v) => !seen.has(itemKey(v)))];
  }
  return out;
}
