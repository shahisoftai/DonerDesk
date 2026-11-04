/**
 * What the documents state, put into the wizard's own answers once the reading is done (Phase 42): the Start slide's donor,
 * country and sector, and the reporting schedule (cadence and the kinds of report). Only empty answers are filled, only from
 * items the reading kept (proposed, accepted or edited, never rejected), and only once per draft (`start.fromDocuments`), so a
 * person's later change is never overwritten by a re-read. A sector is named only when the documents' sectors map to exactly
 * one of ours (several distinct ones are MULTI_SECTOR). Pure.
 */
import type { Sector } from "../../identity/role.js";
import { recogniseCountry } from "../country-names.js";
import type { Proposed } from "../proposal.js";
import type { SetupDraft } from "./draft.js";

/** Words that name each sector in a document's sector/cluster line (English, French, Spanish). */
const SECTOR_WORDS: ReadonlyArray<[Sector, RegExp]> = [
  ["WASH", /\b(wash|water|sanitation|hygiene|eau|assainissement|agua|saneamiento)\b/i],
  ["NUTRITION", /\bnutrition|nutrici/i],
  ["FOOD_SECURITY", /\bfood security|s[ée]curit[ée] alimentaire|seguridad alimentaria/i],
  ["HEALTH", /\bhealth|sant[ée]|salud/i],
  ["PROTECTION", /\bprotection|protecci[oó]n|gbv|child protection/i],
  ["EDUCATION", /\beducation|[ée]ducation|educaci[oó]n/i],
  ["LIVELIHOODS", /\blivelihood|moyens d'existence|medios de vida/i],
  ["SHELTER", /\bshelter|nfi|abri|alojamiento|refugio/i],
];

const REPORT_CADENCES = ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"] as const;

const kept = <T>(item: Proposed<T>): T | null => (item.status === "REJECTED" || item.value === null ? null : item.value);

export function sectorFromText(sectors: readonly string[]): Sector | null {
  const found = new Set<Sector>();
  for (const s of sectors) {
    const hit = SECTOR_WORDS.find(([, re]) => re.test(s));
    if (hit) found.add(hit[0]);
  }
  return found.size === 1 ? [...found][0]! : found.size > 1 ? "MULTI_SECTOR" : null;
}

export interface PrefillResult {
  draft: SetupDraft;
  /** Which answers were filled ("donor", "country", "sector", "cadence", "reports"); empty when nothing was. */
  filled: string[];
}

export function prefillFromDocuments(draft: SetupDraft): PrefillResult {
  if (!draft.extras.start.withDocuments || draft.extras.start.fromDocuments) return { draft, filled: [] };
  const facts = draft.proposal.facts;
  const start = { ...draft.extras.start, fromDocuments: true };
  const filled: string[] = [];
  const donor = kept(facts.donor);
  if (!start.donor?.trim() && typeof donor === "string" && donor.trim()) { start.donor = donor.trim(); filled.push("donor"); }
  const countries = (kept(facts.countries) ?? []) as string[];
  const country = countries.map((c) => recogniseCountry(c) ?? c).find((c) => c.trim());
  if (!start.country?.trim() && country) { start.country = country; filled.push("country"); }
  const sector = sectorFromText((kept(facts.sectors) ?? []) as string[]);
  if (!start.sector?.trim() && sector) { start.sector = sector; filled.push("sector"); }

  const schedule = { ...draft.extras.schedule, rules: [...draft.extras.schedule.rules] };
  const types = draft.proposal.periods.flatMap((p) => { const v = kept(p); return v?.type ? [v.type.toUpperCase()] : []; });
  // The most frequent cadence the documents name (a FINAL report is not a cadence).
  const cadence = REPORT_CADENCES.find((c) => types.includes(c));
  if (!schedule.cadence && cadence) { schedule.cadence = cadence; filled.push("cadence"); }
  if (schedule.rules.length === 0) {
    const kinds = [...new Set(types)].filter((t) => (REPORT_CADENCES as readonly string[]).includes(t) || t === "FINAL");
    if (kinds.length > 0) {
      schedule.rules = kinds.map((reportType) => ({ reportType, template: "BUILT_IN", dueDaysAfterEnd: null }));
      filled.push("reports");
    }
  }
  return { draft: { ...draft, extras: { ...draft.extras, start, schedule } }, filled };
}
