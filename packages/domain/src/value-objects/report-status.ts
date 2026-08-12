export type ReportStatusValue =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "EVIDENCE_COLLECTION"
  | "DRAFT_GENERATED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "SUBMITTED"
  | "CLOSED";

const ORDER: ReportStatusValue[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "EVIDENCE_COLLECTION",
  "DRAFT_GENERATED",
  "UNDER_REVIEW",
  "APPROVED",
  "SUBMITTED",
  "CLOSED",
];

export class ReportStatus {
  private readonly _value: ReportStatusValue;
  private constructor(value: ReportStatusValue) {
    this._value = value;
  }

  static create(value: ReportStatusValue): ReportStatus {
    if (!ORDER.includes(value)) {
      throw new Error(`Invalid ReportStatus: ${value}`);
    }
    return new ReportStatus(value);
  }

  static NOT_STARTED(): ReportStatus {
    return new ReportStatus("NOT_STARTED");
  }

  get value(): ReportStatusValue {
    return this._value;
  }

  toString(): string {
    return this._value;
  }

  canTransitionTo(next: ReportStatus): boolean {
    const cur = ORDER.indexOf(this._value);
    const nxt = ORDER.indexOf(next._value);
    if (nxt === -1) return false;
    return nxt >= cur;
  }

  equals(other: ReportStatus | null | undefined): boolean {
    return other !== null && other !== undefined && other._value === this._value;
  }
}
