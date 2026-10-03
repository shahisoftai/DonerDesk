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
): string | undefined {
  if (templateSectionId === "bp:activity:participants" && activities.length > 0) {
    const rows = activities.map(
      (a) =>
        `| ${esc(a.activityTitle)} | ${cell(a.participantsTotal)} | ${cell(a.participantsMale)} | ${cell(a.participantsFemale)} | ${cell(a.participantsChildren)} | ${cell(a.participantsDisability)} |`,
    );
    return ["| Activity | Total | Male | Female | Children | People with disabilities |", "| --- | --- | --- | --- | --- | --- |", ...rows].join("\n");
  }
  return undefined;
}
