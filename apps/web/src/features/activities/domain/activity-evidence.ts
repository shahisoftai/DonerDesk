/** What the activity form sends for a file dropped on it: the file is uploaded against the new activity and inherits its period. */

export interface ActivityEvidenceContext {
  projectId: string;
  activityId: string;
  reportingPeriodId: string;
  activityDate?: string;
  location?: string;
}

export type SuggestedEvidenceType =
  | "PHOTO" | "ATTENDANCE_SHEET" | "TRAINING_RECORD" | "DISTRIBUTION_LIST" | "FIELD_VISIT_REPORT" | "MONITORING_REPORT"
  | "MEETING_MINUTES" | "PROCUREMENT_DOCUMENT" | "FINANCIAL_DOCUMENT" | "KOBO_ODK_EXPORT" | "BENEFICIARY_LIST" | "CASE_STUDY" | "OTHER";

/** First match wins; the file name is all a person gave us, so only clear words decide. */
const TYPE_BY_NAME: ReadonlyArray<[RegExp, SuggestedEvidenceType]> = [
  [/kobo|odk/i, "KOBO_ODK_EXPORT"],
  [/attendance|register|sign[-_ ]?in|roster/i, "ATTENDANCE_SHEET"],
  [/distribution|dispatch/i, "DISTRIBUTION_LIST"],
  [/beneficiar/i, "BENEFICIARY_LIST"],
  [/training|workshop/i, "TRAINING_RECORD"],
  [/mentor|supervis|monitor|checklist/i, "MONITORING_REPORT"],
  [/visit|field[-_ ]?report/i, "FIELD_VISIT_REPORT"],
  [/minutes|meeting/i, "MEETING_MINUTES"],
  [/procure|tender|quotation|supplier/i, "PROCUREMENT_DOCUMENT"],
  [/invoice|receipt|payment|ledger|expenditure|budget/i, "FINANCIAL_DOCUMENT"],
  [/case[-_ ]?study|story/i, "CASE_STUDY"],
];

/** The evidence type a file most likely is, from its name and kind; the person can change it before uploading. */
export function evidenceTypeForFile(file: Pick<File, "name" | "type">): SuggestedEvidenceType {
  if (file.type.startsWith("image/") || /\.(png|jpe?g|gif|webp|heic)$/i.test(file.name)) return "PHOTO";
  return TYPE_BY_NAME.find(([pattern]) => pattern.test(file.name))?.[1] ?? "OTHER";
}

/** What a person chose for one file on the activity form. */
export interface FileSettings {
  evidenceType: SuggestedEvidenceType;
  confidentialityLevel: "PUBLIC" | "INTERNAL" | "SENSITIVE" | "HIGHLY_SENSITIVE";
  /** The indicator this file proves; empty for none. */
  indicatorId: string;
}

export function defaultFileSettings(file: Pick<File, "name" | "type">, defaultIndicatorId = ""): FileSettings {
  return { evidenceType: evidenceTypeForFile(file), confidentialityLevel: "INTERNAL", indicatorId: defaultIndicatorId };
}

/**
 * The indicator a file defaults to: the one indicator measured under the activity's logframe node, when there is
 * exactly one (several, or none, leaves the choice to the person).
 */
export function defaultIndicatorForActivity(logframeActivityId: string, indicators: ReadonlyArray<{ id: string; logframeItemId?: string | null }>): string {
  if (!logframeActivityId) return "";
  const under = indicators.filter((i) => i.logframeItemId === logframeActivityId);
  return under.length === 1 ? under[0]!.id : "";
}

export function titleForFile(file: Pick<File, "name">): string {
  return file.name.replace(/\.[^.]+$/, "").trim() || file.name;
}

/** Fields before the file: the API reads the multipart fields that arrive ahead of it. */
export function activityEvidenceFormData(file: File, context: ActivityEvidenceContext, settings?: FileSettings): FormData {
  const fd = new FormData();
  fd.append("projectId", context.projectId);
  fd.append("title", titleForFile(file));
  fd.append("evidenceType", settings?.evidenceType ?? evidenceTypeForFile(file));
  fd.append("confidentialityLevel", settings?.confidentialityLevel ?? "INTERNAL");
  if (settings?.indicatorId) fd.append("indicatorId", settings.indicatorId);
  fd.append("activityId", context.activityId);
  fd.append("reportingPeriodId", context.reportingPeriodId);
  if (context.location) fd.append("location", context.location);
  if (context.activityDate) fd.append("activityDate", context.activityDate);
  fd.append("file", file);
  return fd;
}

export interface FileUploadOutcome {
  name: string;
  ok: boolean;
  error?: string;
}

export function failedUploads(outcomes: ReadonlyArray<FileUploadOutcome>): FileUploadOutcome[] {
  return outcomes.filter((o) => !o.ok);
}
