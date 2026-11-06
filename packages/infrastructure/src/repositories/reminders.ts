import type { PrismaClient } from "@prisma/client";
import { isSummaryMode, ok, type PlainDate, type SummaryMode, type TenantId } from "@donordesk/domain";
import type { INotificationPreferences, IReminderAudience, IReminderLedger, ReminderLedgerEntry } from "@donordesk/application";

const toDate = (d: PlainDate): Date => new Date(`${d}T00:00:00.000Z`);

export class PrismaReminderLedger implements IReminderLedger {
  constructor(private readonly prisma: PrismaClient) {}

  async wasSent(tenantId: TenantId, recipientId: string, subjectKey: string, ruleKey: string, on?: PlainDate) {
    const n = await this.prisma.reminderLedgerEntry.count({ where: { tenantId: tenantId.toString(), recipientId, subjectKey, ruleKey, ...(on ? { sentOn: toDate(on) } : {}) } });
    return ok(n > 0);
  }

  /** The unique key makes a repeat a no-op, so two overlapping runs cannot send twice. */
  async record(e: ReminderLedgerEntry) {
    await this.prisma.reminderLedgerEntry.upsert({
      where: { tenantId_recipientId_subjectKey_ruleKey_sentOn: { tenantId: e.tenantId.toString(), recipientId: e.recipientId, subjectKey: e.subjectKey, ruleKey: e.ruleKey, sentOn: toDate(e.sentOn) } },
      create: { id: crypto.randomUUID(), tenantId: e.tenantId.toString(), recipientId: e.recipientId, subjectKey: e.subjectKey, ruleKey: e.ruleKey, sentOn: toDate(e.sentOn) },
      update: {},
    });
    return ok(undefined);
  }
}

const asMode = (v: string | null | undefined): SummaryMode => (isSummaryMode(v) ? v : "DAILY_SUMMARY");

/** The one setting, stored on the user. An unknown stored value reads as the default. */
export class PrismaNotificationPreferences implements INotificationPreferences {
  constructor(private readonly prisma: PrismaClient) {}

  async modes(tenantId: TenantId, userIds: ReadonlyArray<string>) {
    const rows = await this.prisma.user.findMany({ where: { tenantId: tenantId.toString(), id: { in: [...userIds] } }, select: { id: true, emailSummaryMode: true } });
    return ok(new Map(rows.map((r) => [r.id, asMode(r.emailSummaryMode)])) as ReadonlyMap<string, SummaryMode>);
  }

  async get(tenantId: TenantId, userId: string) {
    const row = await this.prisma.user.findFirst({ where: { id: userId, tenantId: tenantId.toString() }, select: { emailSummaryMode: true } });
    return ok(asMode(row?.emailSummaryMode));
  }

  async set(tenantId: TenantId, userId: string, mode: SummaryMode) {
    await this.prisma.user.updateMany({ where: { id: userId, tenantId: tenantId.toString() }, data: { emailSummaryMode: mode } });
    return ok(undefined);
  }
}

/** Who a reminder run is for. Active people only; a project without a manager is left out of the escalation map. */
export class PrismaReminderAudience implements IReminderAudience {
  constructor(private readonly prisma: PrismaClient) {}

  async timeZone(tenantId: TenantId) {
    const org = await this.prisma.organization.findUnique({ where: { tenantId: tenantId.toString() }, select: { timeZone: true } });
    return ok(org?.timeZone || "UTC");
  }

  async activeUsers(tenantId: TenantId) {
    const rows = await this.prisma.user.findMany({ where: { tenantId: tenantId.toString(), status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } });
    return ok(rows.map((r) => ({ userId: r.id, name: r.name })));
  }

  async projectManagers(tenantId: TenantId) {
    const rows = await this.prisma.project.findMany({ where: { tenantId: tenantId.toString(), archivedAt: null, projectManagerId: { not: null } }, select: { id: true, projectManagerId: true } });
    return ok(new Map(rows.map((r) => [r.id, r.projectManagerId!])) as ReadonlyMap<string, string>);
  }
}
