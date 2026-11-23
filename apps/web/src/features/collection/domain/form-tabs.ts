/**
 * Which tabs a form's page offers (Phase 63b). One pure rule: the page asks, it does not decide. A person who only fills forms in (the field
 * officer) gets "Fill in" and nothing about reviewing, totals, sharing or connectors; each of those follows the permission that does its job.
 */
export type FormTabKey = "fill" | "facilities" | "records" | "totals" | "share" | "connect";

export interface FormTabInput {
  published: boolean;
  /** A form about a facility or a place. */
  assessment: boolean;
  hasMappings: boolean;
  pending: number;
  /** Design and share the form (`project.edit`). */
  canEdit: boolean;
  /** Fill forms in (`collection.submit`). */
  canSubmit: boolean;
  /** Review what came in (`indicator.verify`). */
  canReview: boolean;
  /** Enter indicator values, so totals concern them (`indicator.update`). */
  canEnter: boolean;
}

export function visibleFormTabs(i: FormTabInput): Array<[FormTabKey, string]> {
  const manages = i.canEdit || i.canReview;
  const tabs: Array<[FormTabKey, string]> = [];
  if (i.published && i.canSubmit) tabs.push(["fill", "Fill in"]);
  if (i.assessment && i.published && manages) tabs.push(["facilities", "Facilities"]);
  if (manages || i.canEnter) tabs.push(["records", i.assessment ? `Assessments (${i.pending} waiting)` : `Records (${i.pending} waiting)`]);
  if ((i.hasMappings || !i.assessment) && (manages || i.canEnter)) tabs.push(["totals", "What it adds up to"]);
  if (i.canEdit && i.published) tabs.push(["share", "Share a link"]);
  if (i.canEdit) tabs.push(["connect", "KoboToolbox / SurveyCTO"]);
  return tabs;
}
