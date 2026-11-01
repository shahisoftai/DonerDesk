/**
 * Accepted proposal items as the input the existing importers already read (Phase 36.3, decision D3): a tab-separated
 * sheet for the logframe, indicator, work-plan and place imports, and plain inputs for risks and funding. Nothing here
 * writes; the appliers hand these to the ordinary handlers, so their checks, skips and audit rows apply unchanged. An item
 * the importer could not take honestly (a work-plan row with no start, a place with no level, an ambiguous amount) is
 * left out and named in `notes`, never filled with a guess. Pure.
 */
import { willApplyItem } from "./project-codes.js";
import type { ProjectSetupProposal, Proposed } from "./proposal.js";

export interface SheetForImport {
  text: string;
  rows: number;
  /** Plain sentences for items that were left out, and why. */
  notes: string[];
}

const cell = (v: string | number | null | undefined): string => (v === null || v === undefined ? "" : String(v).replace(/[\t\r\n]+/g, " ").trim());

const sheet = (header: readonly string[], rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>, notes: string[]): SheetForImport => ({
  text: [header.join("\t"), ...rows.map((r) => r.map(cell).join("\t"))].join("\n"),
  rows: rows.length,
  notes,
});

const chosen = <T>(items: ReadonlyArray<Proposed<T>>): T[] => items.filter(willApplyItem).map((i) => i.value as T);

const LEVEL_WORD = { GOAL: "Goal", OUTCOME: "Outcome", OUTPUT: "Output", ACTIVITY: "Activity" } as const;

/** Parents before children, in document order, so the importer's "nearest earlier item one level up" reads the tree. */
export function logframeSheet(p: ProjectSetupProposal): SheetForImport {
  const rows = chosen(p.logframe).map((n) => [LEVEL_WORD[n.level], n.code, n.title, n.description]);
  return sheet(["Level", "Code", "Title", "Description"], rows, []);
}

const INDICATOR_TYPES = new Set(["NUMBER", "PERCENTAGE", "YES_NO", "TEXT", "RATIO", "CURRENCY"]);

export function indicatorSheet(p: ProjectSetupProposal): SheetForImport {
  const notes: string[] = [];
  const rows = chosen(p.indicators).flatMap((i) => {
    if (!i.logframeCode) {
      notes.push(`"${i.title}" is not tied to a result in the documents, so it was left out. Add it on the Logframe page once the project exists.`);
      return [];
    }
    const type = i.type && INDICATOR_TYPES.has(i.type) ? i.type : /%/.test(`${i.target ?? ""}${i.baseline ?? ""}${i.unit ?? ""}`) ? "PERCENTAGE" : "NUMBER";
    return [[i.code, i.title, type, i.baseline, i.target, i.unit, i.meansOfVerification, i.frequency, i.logframeCode]];
  });
  return sheet(["Code", "Name", "Type", "Baseline", "Target", "Unit", "Means of verification", "Frequency", "Logframe code"], rows, notes);
}

export function workPlanSheet(p: ProjectSetupProposal): SheetForImport {
  const notes: string[] = [];
  const rows = chosen(p.plan).flatMap((a) => {
    if (!a.start) {
      notes.push(`"${a.title}" has no start date in the documents, so it was left out. Add it on the Work plan page once the project exists.`);
      return [];
    }
    return [[a.logframeCode, a.title, a.start, a.end, a.location]];
  });
  return sheet(["Logframe code", "Title", "Start", "End", "Location"], rows, notes);
}

const LEVEL_NAME = ["Country", "State or province", "District or locality", "Sub-district", "Community or site"] as const;

export function placesSheet(p: ProjectSetupProposal): SheetForImport {
  const notes: string[] = [];
  const rows = chosen(p.places).flatMap((pl) => {
    if (pl.adminLevel === null) {
      notes.push(`"${pl.name}": the document does not say what kind of place it is, so it was left out. Add it on the Places page.`);
      return [];
    }
    return [[pl.name, LEVEL_NAME[pl.adminLevel], pl.parentName, pl.latitude, pl.longitude]];
  });
  // Larger areas first, so a parent named in the same sheet is created before what sits inside it.
  rows.sort((a, b) => LEVEL_NAME.indexOf(a[1] as never) - LEVEL_NAME.indexOf(b[1] as never));
  return sheet(["Name", "Level", "Parent", "Latitude", "Longitude"], rows, notes);
}

export interface RiskInputDraft {
  kind: "PROBLEM" | "RISK" | "ASSUMPTION";
  title: string;
  seriousness: "HIGH" | "MEDIUM" | "LOW";
  action: string;
}

const KIND: Readonly<Record<string, RiskInputDraft["kind"]>> = { RISK: "RISK", ASSUMPTION: "ASSUMPTION", ISSUE: "PROBLEM", PROBLEM: "PROBLEM" };

function seriousnessOf(text: string | null): RiskInputDraft["seriousness"] | undefined {
  const t = (text ?? "").toLowerCase();
  return /\bhigh\b/.test(t) ? "HIGH" : /\b(medium|moderate)\b/.test(t) ? "MEDIUM" : /\blow\b/.test(t) ? "LOW" : undefined;
}

export function riskInputs(p: ProjectSetupProposal): { inputs: RiskInputDraft[]; notes: string[] } {
  const notes: string[] = [];
  const inputs = chosen(p.risks).flatMap((r) => {
    const seriousness = seriousnessOf(r.seriousness);
    if (!r.title) return [];
    if (!seriousness) {
      notes.push(`"${r.title}": the document does not rate how serious it is, so it was left out. Add it on the Overview with a rating.`);
      return [];
    }
    return [{ kind: KIND[(r.kind ?? "RISK").toUpperCase()] ?? "RISK", title: r.title.slice(0, 200), seriousness, action: (r.mitigation ?? "").slice(0, 1000) }];
  });
  return { inputs, notes };
}

/**
 * An amount as the document wrote it, to the plain form the finance checks read ("1250000.00"). Both separators: the
 * last is the decimal mark. One kind repeated ("1,250,000", "1.250.000"): thousands. One single separator followed by
 * three digits ("1,250", "1.250") reads both ways, so it is ambiguous and refused. Pure.
 */
export function normaliseAmountText(raw: string | null): string | null {
  const t = (raw ?? "").replace(/[\s ']/g, "");
  if (!/^\d[\d.,]*$/.test(t)) return null;
  const lastDot = t.lastIndexOf(".");
  const lastComma = t.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    const decimal = lastDot > lastComma ? "." : ",";
    const thousands = decimal === "." ? "," : ".";
    const [whole, frac = ""] = t.split(decimal);
    return frac.length <= 2 && !whole!.includes(decimal) ? `${whole!.split(thousands).join("")}${frac ? `.${frac}` : ""}` : null;
  }
  const sep = lastDot >= 0 ? "." : lastComma >= 0 ? "," : "";
  if (!sep) return t;
  const parts = t.split(sep);
  if (parts.length > 2) return parts.slice(1).every((g) => g.length === 3) ? parts.join("") : null;
  const frac = parts[1]!;
  if (frac.length === 3) return null;
  return frac.length <= 2 ? `${parts[0]}.${frac}` : null;
}

export interface FundingInputDraft {
  sourceName: string;
  amount: string;
  currency: string;
}

export function fundingInputs(p: ProjectSetupProposal): { inputs: FundingInputDraft[]; notes: string[] } {
  const notes: string[] = [];
  const inputs = chosen(p.funding).flatMap((f) => {
    const label = f.sourceName ?? "A funding line";
    const amount = normaliseAmountText(f.amount);
    if (!f.sourceName) notes.push(`${f.amount ?? "An amount"}: the document does not say who provides it, so it was left out.`);
    else if (!f.currency) notes.push(`${label}: the currency is not stated, so it was left out.`);
    else if (!amount) notes.push(`${label}: "${f.amount ?? ""}" can be read more than one way, so it was left out. Enter it on the Finance page.`);
    return f.sourceName && f.currency && amount ? [{ sourceName: f.sourceName, amount, currency: f.currency }] : [];
  });
  return { inputs, notes };
}

/** Budget lines need a planned activity to hang from in DonorDesk today; they are kept in the review, not applied. */
export const budgetNotApplied = (p: ProjectSetupProposal): string[] => {
  // Detail rows and stated totals are there to check the budget, not to be created.
  const n = chosen(p.budget).filter((b) => (b.kind ?? "LINE") === "LINE").length;
  return n > 0 ? [`${n} budget line(s) were read but are not created automatically: add them to planned activities on the Finance page.`] : [];
};
