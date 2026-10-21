import { toCsv } from "./data-sheet.js";
import { NOT_MEASURED_LABEL } from "./export-indicator-columns.js";

/**
 * The standard management report of one project: where delivery stands, how each indicator is doing against its target, where each
 * report is, what is open, and what the evidence looks like, as plain tables a manager reads or downloads. Pure: the facts are
 * gathered by the caller and passed in with today's date. A missing figure is "Not measured", never 0; a rate has no "% of target".
 */
export interface ManagementReportInput {
  project: { title: string; code: string; donor: string; country: string; sector: string; start: string; end: string; status: string };
  today: string;
  delivery: { label: string; reasons: string[]; planned: number; lateActivities: number; valuesOverdue: number };
  indicators: Array<{
    code: string;
    name: string;
    unit: string;
    target: string;
    /** The latest recorded cumulative value, and the period end it belongs to; null when none is recorded. */
    latest: string | null;
    asOf: string | null;
    percentOfTarget: string;
    variance: string;
    status: string;
  }>;
  periods: Array<{ label: string; reportType: string; status: string; deadline: string; daysUntil: number; readiness: number }>;
  risks: Array<{ title: string; kind: string; seriousness: string; status: string; reviewBy?: string | undefined }>;
  evidence: { total: number; byStatus: Record<string, number> };
  activities: { total: number; accepted: number; participants: number };
}

export interface ManagementReportSection {
  title: string;
  headers: string[];
  rows: string[][];
  /** One sentence above the table. */
  summary: string;
}

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

export function buildManagementReport(input: ManagementReportInput): ManagementReportSection[] {
  const { project, delivery } = input;
  const open = input.risks.filter((r) => r.status === "OPEN");
  const measured = input.indicators.filter((i) => i.latest !== null).length;
  const dueSoon = input.periods.filter((p) => !["APPROVED", "EXPORTED", "SENT", "SUBMITTED", "CLOSED"].includes(p.status));
  return [
    {
      title: "Project",
      headers: ["Item", "Value"],
      summary: `${project.title} (${project.code}), ${project.donor}, ${project.country}. Report date ${input.today}.`,
      rows: [
        ["Title", project.title], ["Code", project.code], ["Donor", project.donor], ["Country", project.country], ["Sector", project.sector],
        ["Starts", project.start], ["Ends", project.end], ["Status", project.status],
      ],
    },
    {
      title: "Delivery",
      headers: ["Item", "Value"],
      summary: delivery.reasons[0] ? `${delivery.label}: ${delivery.reasons[0]}` : delivery.label,
      rows: [
        ["Standing", delivery.label], ["Planned activities", String(delivery.planned)], ["Late activities", String(delivery.lateActivities)],
        ["Indicator values overdue", String(delivery.valuesOverdue)],
        ["Completed activities recorded", String(input.activities.total)], ["Of which accepted", String(input.activities.accepted)],
        ["People reached (accepted activities)", String(input.activities.participants)],
      ],
    },
    {
      title: "Indicators",
      headers: ["Code", "Indicator", "Unit", "Target", "Latest cumulative", "As of", "% of target", "Against scheduled target", "Status"],
      summary: `${measured} of ${plural(input.indicators.length, "indicator")} ${measured === 1 ? "has" : "have"} a recorded value.`,
      rows: input.indicators.map((i) => [i.code, i.name, i.unit, i.target, i.latest ?? NOT_MEASURED_LABEL, i.asOf ?? "", i.percentOfTarget, i.variance, i.status]),
    },
    {
      title: "Reports",
      headers: ["Period", "Type", "Status", "Deadline", "Days to deadline", "Ready"],
      summary: dueSoon.length === 0 ? "Every report is finished." : `${plural(dueSoon.length, "report")} not finished yet.`,
      rows: input.periods.map((p) => [p.label, p.reportType, p.status.replace(/_/g, " ").toLowerCase(), p.deadline, String(p.daysUntil), `${p.readiness}%`]),
    },
    {
      title: "Problems and risks",
      headers: ["What", "Kind", "How serious", "Status", "Review by"],
      summary: open.length === 0 ? "Nothing is open." : `${open.length} open, ${open.filter((r) => r.seriousness === "HIGH").length} serious.`,
      rows: input.risks.map((r) => [r.title, r.kind.toLowerCase(), r.seriousness.toLowerCase(), r.status.toLowerCase(), r.reviewBy ?? ""]),
    },
    {
      title: "Evidence",
      headers: ["Status", "Files"],
      summary: `${plural(input.evidence.total, "file")} on record.`,
      rows: Object.entries(input.evidence.byStatus).filter(([, n]) => n > 0).map(([status, n]) => [status.replace(/_/g, " ").toLowerCase(), String(n)]),
    },
  ];
}

/** The whole report as one CSV: each section's title, its summary, its table, and a blank line between sections. */
export function managementReportCsv(sections: ReadonlyArray<ManagementReportSection>): string {
  const table: string[][] = [];
  sections.forEach((s, i) => {
    if (i > 0) table.push([""]);
    table.push([s.title], [s.summary], s.headers, ...s.rows);
  });
  return toCsv(table);
}
