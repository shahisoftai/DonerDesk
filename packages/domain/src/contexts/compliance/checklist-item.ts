import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";

export type ChecklistItemType =
  | "MISSING_EVIDENCE"
  | "INCOMPLETE_EVIDENCE_METADATA"
  | "UNVERIFIED_INDICATOR"
  | "UNSUPPORTED_REPORT_CLAIM"
  | "MISSING_ANNEX"
  | "MISSING_PROCUREMENT_DOCUMENT"
  | "MISSING_APPROVAL"
  | "MISSING_DISAGGREGATION"
  | "LATE_ACTIVITY_UPDATE"
  | "SENSITIVE_DATA_WARNING"
  | "UNREVIEWED_AI_OUTPUT"
  | "DONOR_REQUIREMENT"
  | "AFFECTED_FIGURES_CONFIRMED"
  | "ACTIVITY_RECORD_ACCEPTED"
  | "CUMULATIVE_DATA_COMPLETE"
  | "PRIOR_REPORT_LINKED"
  | "FINANCE_FIGURES_PROVIDED"
  | "INDICATOR_SEMANTICS_UNREVIEWED";

export const CHECKLIST_ITEM_TYPES: ChecklistItemType[] = [
  "MISSING_EVIDENCE",
  "INCOMPLETE_EVIDENCE_METADATA",
  "UNVERIFIED_INDICATOR",
  "UNSUPPORTED_REPORT_CLAIM",
  "MISSING_ANNEX",
  "MISSING_PROCUREMENT_DOCUMENT",
  "MISSING_APPROVAL",
  "MISSING_DISAGGREGATION",
  "LATE_ACTIVITY_UPDATE",
  "SENSITIVE_DATA_WARNING",
  "UNREVIEWED_AI_OUTPUT",
  "DONOR_REQUIREMENT",
  "AFFECTED_FIGURES_CONFIRMED",
  "ACTIVITY_RECORD_ACCEPTED",
  "CUMULATIVE_DATA_COMPLETE",
  "PRIOR_REPORT_LINKED",
  "FINANCE_FIGURES_PROVIDED",
  "INDICATOR_SEMANTICS_UNREVIEWED",
];

export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export const SEVERITIES: Severity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export type ChecklistStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "ACCEPTED_RISK" | "NOT_APPLICABLE";

export const CHECKLIST_STATUSES: ChecklistStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "ACCEPTED_RISK", "NOT_APPLICABLE"];

export interface ChecklistItemProps {
  reportingPeriodId: string;
  type: ChecklistItemType;
  title: string;
  description: string;
  severity: Severity;
  relatedEntityType?: string;
  relatedEntityId?: string;
  assignedToId?: string;
  dueDate?: Date;
  status: ChecklistStatus;
  resolutionNotes?: string;
  /** The person who attested to this item (set when an attestation is decided; each item names its own person). */
  attestedById?: string;
}

export class ChecklistItem extends Entity<string> {
  private constructor(
    id: string,
    readonly tenantIdValue: string,
    readonly projectId: string,
    private props: ChecklistItemProps,
    createdAt?: Date,
  ) {
    super(id, createdAt);
  }

  static create(input: {
    id: string;
    tenantId: string;
    projectId: string;
    reportingPeriodId: string;
    type: ChecklistItemType;
    title: string;
    description: string;
    severity: Severity;
    relatedEntityType?: string;
    relatedEntityId?: string;
    assignedToId?: string;
    dueDate?: Date;
  }): ChecklistItem {
    if (!CHECKLIST_ITEM_TYPES.includes(input.type)) throw DomainError.validation("Invalid checklist type");
    if (!SEVERITIES.includes(input.severity)) throw DomainError.validation("Invalid severity");
    if (!input.title) throw DomainError.validation("Title required");
    return new ChecklistItem(input.id, input.tenantId, input.projectId, {
      ...input,
      status: "OPEN",
    });
  }

  static rehydrate(input: {
    id: string;
    tenantId: string;
    projectId: string;
    props: ChecklistItemProps;
    createdAt: Date;
  }): ChecklistItem {
    return new ChecklistItem(input.id, input.tenantId, input.projectId, input.props, input.createdAt);
  }

  get reportingPeriodId(): string { return this.props.reportingPeriodId; }
  get type(): ChecklistItemType { return this.props.type; }
  get title(): string { return this.props.title; }
  get description(): string { return this.props.description; }
  get severity(): Severity { return this.props.severity; }
  get relatedEntityType(): string | undefined { return this.props.relatedEntityType; }
  get relatedEntityId(): string | undefined { return this.props.relatedEntityId; }
  get assignedToId(): string | undefined { return this.props.assignedToId; }
  get dueDate(): Date | undefined { return this.props.dueDate ? new Date(this.props.dueDate.getTime()) : undefined; }
  get status(): ChecklistStatus { return this.props.status; }
  get resolutionNotes(): string | undefined { return this.props.resolutionNotes; }
  get attestedById(): string | undefined { return this.props.attestedById; }

  /** Records who stood behind this decision: an attestation is a statement by a person, not a shared note. */
  recordAttestation(userId: string): void {
    this.props.attestedById = userId;
    this.touch();
  }

  start(): void {
    if (this.props.status === "RESOLVED" || this.props.status === "ACCEPTED_RISK") {
      throw DomainError.invalidTransition("Cannot reopen resolved item");
    }
    this.props.status = "IN_PROGRESS";
    this.touch();
  }

  /** Undoes a decision: the item is open again and the note that justified the decision goes with it. */
  reopen(): void {
    if (this.props.status !== "RESOLVED" && this.props.status !== "ACCEPTED_RISK" && this.props.status !== "NOT_APPLICABLE") {
      throw DomainError.invalidTransition("Only a resolved item can be reopened");
    }
    this.props.status = "OPEN";
    this.props.resolutionNotes = undefined;
    this.props.attestedById = undefined;
    this.touch();
  }

  resolve(notes?: string): void {
    this.props.status = "RESOLVED";
    if (notes) this.props.resolutionNotes = notes;
    this.touch();
  }

  acceptRisk(notes?: string): void {
    this.props.status = "ACCEPTED_RISK";
    if (notes) this.props.resolutionNotes = notes;
    this.touch();
  }

  markNotApplicable(notes?: string): void {
    this.props.status = "NOT_APPLICABLE";
    if (notes) this.props.resolutionNotes = notes;
    this.touch();
  }

  assign(toId: string): void {
    this.props.assignedToId = toId;
    this.touch();
  }
}
