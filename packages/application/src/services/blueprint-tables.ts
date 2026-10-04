import { translateBlueprintText, type AffectedFigure, type FinanceSummaryView, type ReportScope } from "@donordesk/domain";
import type { ActivityGenerationContext } from "../ports/reporting.js";

const cell = (v: number | undefined): string => (v === undefined || v === null ? "—" : String(v));
const esc = (v: string): string => v.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();

/**
 * Tables that a report-type blueprint section gets from recorded data rather
 * than from the writer, so every number is exactly what was recorded. Returns
 * markdown (GFM table) or undefined when the section has no deterministic table.
 */
export function deterministicBlueprintTable(
  templateSectionId: string | undefined,
  activities: ReadonlyArray<ActivityGenerationContext>,
  language?: string,
  /** Situation reports: this report's scope and the previous report's. */
  situation?: { current: ReportScope; previous?: ReportScope | undefined },
  /** Verified financial figures, for the financial section. */
  finance?: FinanceSummaryView,
): string | undefined {
  const t = (english: string) => esc(translateBlueprintText(english, language));
  if (templateSectionId === "bp:activity:participants" && activities.length > 0) {
    const rows = activities.map(
      (a) =>
        `| ${esc(a.activityTitle)} | ${cell(a.participantsTotal)} | ${cell(a.participantsMale)} | ${cell(a.participantsFemale)} | ${cell(a.participantsChildren)} | ${cell(a.participantsDisability)} |`,
    );
    const header = `| ${["Activity", "Total", "Male", "Female", "Children", "People with disabilities"].map(t).join(" | ")} |`;
    return [header, "| --- | --- | --- | --- | --- | --- |", ...rows].join("\n");
  }
  if (finance && templateSectionId !== undefined && /^bp:[a-z_]+:finance$/.test(templateSectionId)) {
    return financeTable(finance, language);
  }
  if (templateSectionId === "bp:situation:needs" && situation?.current.affectedPopulation?.length) {
    return affectedPopulationTable(situation.current.affectedPopulation, situation.previous?.affectedPopulation, situation.previous?.situationDate, t);
  }
  return undefined;
}

const groupKey = (g: string): string => g.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * The figures the author entered, exactly as entered, with the previous report's
 * figure for the same group when there is one. Built from data only: the writer
 * never types these numbers, and no figure is invented when none was supplied.
 */
function affectedPopulationTable(
  current: ReadonlyArray<AffectedFigure>,
  previous: ReadonlyArray<AffectedFigure> | undefined,
  previousAsOf: string | undefined,
  t: (english: string) => string,
): string {
  const before = new Map((previous ?? []).map((f) => [groupKey(f.group), f]));
  const withPrevious = before.size > 0;
  const headers = [t("Group"), t("Figure"), ...(withPrevious ? [t("Previously reported")] : []), t("Source"), t("As of")];
  const rows = current.map((f) => {
    const prior = before.get(groupKey(f.group));
    const priorCell = prior ? `${esc(prior.figure)}${prior.asOf ?? previousAsOf ? ` (${esc(prior.asOf ?? previousAsOf ?? "")})` : ""}` : "—";
    return `| ${[esc(f.group), esc(f.figure), ...(withPrevious ? [priorCell] : []), f.source ? esc(f.source) : "—", f.asOf ? esc(f.asOf) : "—"].join(" | ")} |`;
  });
  return [`| ${headers.join(" | ")} |`, `| ${headers.map(() => "---").join(" | ")} |`, ...rows].join("\n");
}

const FINANCE_TITLE_RE = /^(?:\d+(?:\.\d+)*[.)]?\s+)?(?:financial\s+(?:status|overview|report|summary|progress|performance|position|update)|finance\b|budget\s+(?:utili[sz]ation|execution|status|performance|vs\.?\s+actual)|expenditure|financial\s+and\s+procurement)/i;

/**
 * Whether a donor-template section is the report's financial narrative. Only a
 * plain narrative section the donor gave no table shape for qualifies: when the
 * donor prescribes its own financial tables the writer fills those instead.
 */
export function isDonorFinanceSection(section: { title: string; canonicalTitle?: string | undefined; inputType?: string | undefined; requiredTables?: ReadonlyArray<unknown> | undefined }): boolean {
  if ((section.inputType ?? "NARRATIVE") !== "NARRATIVE") return false;
  if ((section.requiredTables ?? []).length > 0) return false;
  return FINANCE_TITLE_RE.test((section.canonicalTitle ?? section.title).trim());
}

/**
 * Budget against expenditure, exactly the verified figures plus the balance and
 * burn rate computed in the domain (never by the writer). One row per budget
 * line, then the total; a summary without lines is just the total row.
 */
export function financeTable(finance: FinanceSummaryView, language?: string): string {
  const t = (english: string) => esc(translateBlueprintText(english, language));
  const withCommitted = finance.committed !== undefined || finance.lines.some((l) => l.committed !== undefined);
  const headers = [
    t("Budget line"),
    `${t("Budget")} (${esc(finance.currency)})`,
    `${t("Expenditure")} (${esc(finance.currency)})`,
    ...(withCommitted ? [`${t("Committed")} (${esc(finance.currency)})`] : []),
    `${t("Balance")} (${esc(finance.currency)})`,
    t("Burn rate"),
  ];
  const row = (name: string, r: { budget: string; expenditure: string; committed?: string | undefined; balance: string; burnRatePercent?: string | undefined }): string =>
    `| ${[name, r.budget, r.expenditure, ...(withCommitted ? [r.committed ?? "—"] : []), r.balance, r.burnRatePercent === undefined ? "—" : `${r.burnRatePercent}%`].join(" | ")} |`;
  const rows = [...finance.lines.map((l) => row(esc(l.budgetLine), l)), row(`**${t("Total")}**`, finance)];
  return [`| ${headers.join(" | ")} |`, `| ${headers.map(() => "---").join(" | ")} |`, ...rows].join("\n");
}
