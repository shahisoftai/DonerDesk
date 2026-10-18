import type { PlainDate, Result, SummaryMode, TenantId } from "@donordesk/domain";

export interface ReminderLedgerEntry {
  tenantId: TenantId;
  recipientId: string;
  /** What was reminded about: "summary" for the daily summary, an assignment key for an escalation. */
  subjectKey: string;
  ruleKey: string;
  sentOn: PlainDate;
}

/** Remembers what was sent, so the hourly timer never sends the same thing twice. */
export interface IReminderLedger {
  /** `on` absent = at any time (an escalation is told once, ever). */
  wasSent(tenantId: TenantId, recipientId: string, subjectKey: string, ruleKey: string, on?: PlainDate): Promise<Result<boolean>>;
  /** Idempotent: recording the same entry twice is not an error. */
  record(entry: ReminderLedgerEntry): Promise<Result<void>>;
}

/** The one setting: how a person wants to be emailed. */
export interface INotificationPreferences {
  modes(tenantId: TenantId, userIds: ReadonlyArray<string>): Promise<Result<ReadonlyMap<string, SummaryMode>>>;
  get(tenantId: TenantId, userId: string): Promise<Result<SummaryMode>>;
  set(tenantId: TenantId, userId: string, mode: SummaryMode): Promise<Result<void>>;
}

/** Who a reminder run is for: the organisation's time zone, its active people, and each project's manager. */
export interface IReminderAudience {
  timeZone(tenantId: TenantId): Promise<Result<string>>;
  activeUsers(tenantId: TenantId): Promise<Result<Array<{ userId: string; name: string }>>>;
  /** projectId -> the user who manages it (projects without one are left out). */
  projectManagers(tenantId: TenantId): Promise<Result<ReadonlyMap<string, string>>>;
}

export interface PersonNotification {
  tenantId: TenantId;
  recipientId: string;
  type: "ASSIGNMENT" | "DEADLINE_REMINDER" | "CHECKLIST_ASSIGNED";
  title: string;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  /** Marked urgent (or late): "only urgent" people are still emailed. */
  urgent: boolean;
}

/** Tells one person: always an in-app note, and an email only when their setting allows it. Never fails the caller. */
export interface IPersonNotifier {
  send(input: PersonNotification): Promise<void>;
}
