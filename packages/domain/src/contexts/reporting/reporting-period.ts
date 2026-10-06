import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";
import { DateRange } from "../../value-objects/date-range.js";
import { ReportStatus } from "../../value-objects/report-status.js";
import type { ReportType } from "../templates/donor-template.js";
import { parseReportScope, type ReportScope } from "./report-scope.js";

/**
 * The "Tell the Story" inputs — the narrative context that indicators and
 * evidence alone can never explain. Structured (not a single blob) so the
 * report writer can reliably weave each element into the relevant section
 * (achievements → progress; challenges/adaptations → risks & mitigation;
 * varianceExplanations → why targets were over/under; lessons → lessons learned).
 */
export type StoryContextField =
  | "achievements"
  | "challenges"
  | "varianceExplanations"
  | "adaptations"
  | "lessons";

export const STORY_CONTEXT_FIELDS: StoryContextField[] = [
  "achievements",
  "challenges",
  "varianceExplanations",
  "adaptations",
  "lessons",
];

export interface StoryContext {
  /** What went well? */
  achievements?: string;
  /** What challenges did you face? */
  challenges?: string;
  /** Why were important targets over/under achieved? */
  varianceExplanations?: string;
  /** What changed or was adapted? */
  adaptations?: string;
  /** Any important lesson or story? (optional) */
  lessons?: string;
}

export function parseStoryContext(json: string): StoryContext {
  if (!json || json === "{}") return {};
  try {
    const raw = JSON.parse(json) as StoryContext;
    const out: StoryContext = {};
    for (const key of STORY_CONTEXT_FIELDS) {
      const v = raw[key];
      if (typeof v === "string") out[key] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export interface ReportingPeriodProps {
  donorTemplateId?: string;
  reportType: ReportType;
  duration: DateRange;
  deadline: Date;
  internalReviewDeadline?: Date;
  status: ReportStatus;
  readinessScore: number;
  responsibleOfficerId?: string;
  reportingProfileSnapshotJson: string;
  templateSnapshotJson: string;
  storyContextJson?: string;
  /** JSON of {@link ReportScope}; "{}" for cadence reports. */
  scopeJson?: string;
  /** Locked donor template version at period creation; feeds the generation snapshot. */
  donorTemplateVersion?: number;
  /** Locked donor template mapping id at period creation. */
  donorTemplateMappingId?: string;
}

export class ReportingPeriod extends Entity<string> {
  private constructor(
    id: string,
    readonly tenantIdValue: string,
    readonly projectId: string,
    private props: ReportingPeriodProps,
    createdAt?: Date,
  ) {
    super(id, createdAt);
  }

  static create(input: {
    id: string;
    tenantId: string;
    projectId: string;
    donorTemplateId?: string;
    reportType: ReportType;
    startDate: Date;
    endDate: Date;
    deadline: Date;
    internalReviewDeadline?: Date;
    responsibleOfficerId?: string;
    reportingProfileSnapshotJson?: string;
    templateSnapshotJson?: string;
    scopeJson?: string;
    donorTemplateVersion?: number;
    donorTemplateMappingId?: string;
  }): ReportingPeriod {
    if (!input.deadline || isNaN(input.deadline.getTime())) throw DomainError.validation("Deadline required");
    return new ReportingPeriod(input.id, input.tenantId, input.projectId, {
      donorTemplateId: input.donorTemplateId,
      reportType: input.reportType,
      duration: DateRange.create(input.startDate, input.endDate),
      deadline: input.deadline,
      internalReviewDeadline: input.internalReviewDeadline,
      status: ReportStatus.NOT_STARTED(),
      readinessScore: 0,
      responsibleOfficerId: input.responsibleOfficerId,
      reportingProfileSnapshotJson: input.reportingProfileSnapshotJson ?? "{}",
      templateSnapshotJson: input.templateSnapshotJson ?? "{}",
      scopeJson: input.scopeJson ?? "{}",
      donorTemplateVersion: input.donorTemplateVersion,
      donorTemplateMappingId: input.donorTemplateMappingId,
    });
  }

  static rehydrate(input: {
    id: string;
    tenantId: string;
    projectId: string;
    props: ReportingPeriodProps;
    createdAt: Date;
  }): ReportingPeriod {
    return new ReportingPeriod(input.id, input.tenantId, input.projectId, input.props, input.createdAt);
  }

  get donorTemplateId(): string | undefined { return this.props.donorTemplateId; }
  get reportType(): ReportType { return this.props.reportType; }
  get duration(): DateRange { return this.props.duration; }
  get deadline(): Date { return new Date(this.props.deadline.getTime()); }
  get internalReviewDeadline(): Date | undefined { return this.props.internalReviewDeadline ? new Date(this.props.internalReviewDeadline.getTime()) : undefined; }
  get status(): ReportStatus { return this.props.status; }
  get readinessScore(): number { return this.props.readinessScore; }
  get responsibleOfficerId(): string | undefined { return this.props.responsibleOfficerId; }
  get reportingProfileSnapshotJson(): string { return this.props.reportingProfileSnapshotJson; }
  get templateSnapshotJson(): string { return this.props.templateSnapshotJson; }
  get storyContextJson(): string { return this.props.storyContextJson ?? "{}"; }
  get storyContext(): StoryContext { return parseStoryContext(this.storyContextJson); }
  get scopeJson(): string { return this.props.scopeJson ?? "{}"; }
  get scope(): ReportScope { return parseReportScope(this.scopeJson); }
  get donorTemplateVersion(): number | undefined { return this.props.donorTemplateVersion; }
  get donorTemplateMappingId(): string | undefined { return this.props.donorTemplateMappingId; }

  daysUntilDeadline(): number {
    const ms = this.props.deadline.getTime() - Date.now();
    return Math.round(ms / (1000 * 60 * 60 * 24));
  }

  transitionTo(next: ReportStatus): void {
    if (!this.props.status.canTransitionTo(next)) {
      throw DomainError.invalidTransition(`Cannot transition from ${this.props.status} to ${next}`);
    }
    this.props.status = next;
    this.touch();
  }

  setReadinessScore(score: number): void {
    const clamped = Math.max(0, Math.min(100, Math.round(score)));
    this.props.readinessScore = clamped;
    this.touch();
  }

  setDonorTemplate(id: string): void {
    this.props.donorTemplateId = id;
    this.touch();
  }

  /**
   * Re-points the period at another template (or none: the built-in structure). The version and mapping locked
   * for the old template no longer apply, so they are cleared; the next generation locks the new ones.
   */
  changeTemplate(templateId: string | undefined, templateSnapshotJson: string): void {
    this.props.donorTemplateId = templateId;
    this.props.templateSnapshotJson = templateId ? templateSnapshotJson : "{}";
    this.props.donorTemplateVersion = undefined;
    this.props.donorTemplateMappingId = undefined;
    this.touch();
  }

  /** Immutable effective snapshots are resolved once at creation. */
  setSnapshots(reportingProfileSnapshotJson: string, templateSnapshotJson: string): void {
    this.props.reportingProfileSnapshotJson = reportingProfileSnapshotJson;
    this.props.templateSnapshotJson = templateSnapshotJson;
    this.touch();
  }

  /** Locks an approved donor template version + mapping onto the period. */
  lockDonorTemplateMapping(version: number, mappingId: string): void {
    if (!Number.isInteger(version) || version < 1) throw DomainError.validation("Donor template version must be a positive integer");
    if (!mappingId) throw DomainError.validation("Donor template mapping id required");
    this.props.donorTemplateVersion = version;
    this.props.donorTemplateMappingId = mappingId;
    this.touch();
  }

  /** Replaces what an activity/situation/custom report covers. Validated by the caller (`ReportScopeResolver`). */
  setScope(scope: ReportScope): void {
    this.props.scopeJson = JSON.stringify(scope);
    this.touch();
  }

  /** Records the structured "Tell the Story" narrative context for this period. */
  setStoryContext(context: StoryContext): void {
    this.props.storyContextJson = JSON.stringify(context);
    this.touch();
  }
}
