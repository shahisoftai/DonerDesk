import { DomainError, applyMode, type PlainDate, err, isSendHour, isSummaryMode, localDate, ok, planEscalations, renderSummary, summaryLines, type Assignment, type Result, type SummaryMode } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock } from "../../ports/core.js";
import type { IRiskRefresh } from "../../ports/health.js";
import type { INotificationPreferences, IPersonNotifier, IReminderAudience, IReminderLedger } from "../../ports/reminders.js";
import type { AssignmentQueue } from "../../services/assignment-queue.js";

export interface RunRemindersResult {
  /** False when it was not the organisation's send hour (nothing was looked at). */
  ran: boolean;
  summariesSent: number;
  /** People with nothing to be told today: a quiet day sends nothing. */
  quiet: number;
  escalationsSent: number;
}

/**
 * The daily summary and the escalation, for one organisation. Called every hour by a timer; it does something only in the
 * organisation's 07:00 hour, sends at most one summary per person per day (the ledger remembers), nothing on a quiet day, and
 * tells a project manager once about work a week late. No setup: it works with the defaults.
 */
export class RunRemindersHandler {
  constructor(
    private readonly queue: AssignmentQueue, private readonly ledger: IReminderLedger, private readonly prefs: INotificationPreferences,
    private readonly audience: IReminderAudience, private readonly notifier: IPersonNotifier, private readonly audit: IAuditLogger, private readonly clock: IClock,
    private readonly risk?: IRiskRefresh,
    private readonly automations?: { runFor(ctx: AuthenticatedContext, today: PlainDate): Promise<Result<number, DomainError>> },
  ) {}

  async handle(ctx: AuthenticatedContext, options: { force?: boolean } = {}): Promise<Result<RunRemindersResult, DomainError>> {
    const tenantId = ctx.tenant.tenantId;
    const zone = await this.audience.timeZone(tenantId);
    if (!zone.ok) return zone;
    const now = this.clock.now();
    if (!options.force && !isSendHour(now, zone.value)) return ok({ ran: false, summariesSent: 0, quiet: 0, escalationsSent: 0 });
    const today = localDate(now, zone.value);

    const users = await this.audience.activeUsers(tenantId);
    if (!users.ok) return users;
    const modes = await this.prefs.modes(tenantId, users.value.map((u) => u.userId));
    if (!modes.ok) return modes;
    const managers = await this.audience.projectManagers(tenantId);
    if (!managers.ok) return managers;
    const names = new Map(users.value.map((u) => [u.userId, u.name]));

    let summariesSent = 0;
    let quiet = 0;
    const everyone: Assignment[] = [];
    for (const user of users.value) {
      const list = await this.queue.list({ tenantId, today, assigneeId: user.userId });
      if (!list.ok) return list;
      everyone.push(...list.value);
      const mode: SummaryMode = modes.value.get(user.userId) ?? "DAILY_SUMMARY";
      const kept = applyMode(summaryLines(list.value, today), mode);
      const rendered = renderSummary(kept);
      if (!rendered) { quiet += 1; continue; }
      const already = await this.ledger.wasSent(tenantId, user.userId, "summary", "DAILY_SUMMARY", today);
      if (!already.ok) return already;
      if (already.value) continue;
      // Record first: if sending fails halfway, the next hour must not send it twice.
      const recorded = await this.ledger.record({ tenantId, recipientId: user.userId, subjectKey: "summary", ruleKey: "DAILY_SUMMARY", sentOn: today });
      if (!recorded.ok) return recorded;
      await this.notifier.send({ tenantId, recipientId: user.userId, type: "DEADLINE_REMINDER", title: rendered.title, message: rendered.message, urgent: kept.some((l) => l.urgent) });
      summariesSent += 1;
    }

    let escalationsSent = 0;
    for (const e of planEscalations(everyone, today, (p) => managers.value.get(p), (id) => names.get(id) ?? "A team member", () => false)) {
      const told = await this.ledger.wasSent(tenantId, e.recipientId, e.subjectKey, "ESCALATE");
      if (!told.ok) return told;
      if (told.value) continue;
      const recorded = await this.ledger.record({ tenantId, recipientId: e.recipientId, subjectKey: e.subjectKey, ruleKey: "ESCALATE", sentOn: today });
      if (!recorded.ok) return recorded;
      await this.notifier.send({ tenantId, recipientId: e.recipientId, type: "DEADLINE_REMINDER", title: e.title, message: e.message, urgent: true });
      escalationsSent += 1;
    }

    // Once a day, in the same run: keep each project's risk snapshot current (the history behind the health label).
    await this.risk?.refreshAll(tenantId, today);
    // Automation notices (phase 28.1-K): one per item per rule per day, recorded in the same ledger.
    if (this.automations) {
      const sent = await this.automations.runFor(ctx, today);
      if (!sent.ok) return sent;
    }

    if (summariesSent + escalationsSent > 0) {
      await this.audit.record({
        tenantId, actorId: ctx.tenant.userId, eventType: "reminders.sent", entityType: "organization", entityId: tenantId.toString(),
        newValue: JSON.stringify({ day: today, summariesSent, escalationsSent, quiet }),
      });
    }
    return ok({ ran: true, summariesSent, quiet, escalationsSent });
  }
}

/** A person's one setting: how they want to be emailed. */
export class GetNotificationPreferencesHandler {
  constructor(private readonly prefs: INotificationPreferences) {}

  async handle(ctx: AuthenticatedContext): Promise<Result<{ emailSummaryMode: SummaryMode }, DomainError>> {
    const mode = await this.prefs.get(ctx.tenant.tenantId, ctx.tenant.userId);
    return mode.ok ? ok({ emailSummaryMode: mode.value }) : mode;
  }
}

export class UpdateNotificationPreferencesHandler {
  constructor(private readonly prefs: INotificationPreferences, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, input: { emailSummaryMode: string }): Promise<Result<void, DomainError>> {
    if (!isSummaryMode(input.emailSummaryMode)) return err(DomainError.validation("Choose daily summary, only urgent things, or never", { field: "emailSummaryMode" }));
    const before = await this.prefs.get(ctx.tenant.tenantId, ctx.tenant.userId);
    if (!before.ok) return before;
    if (before.value === input.emailSummaryMode) return ok(undefined);
    const saved = await this.prefs.set(ctx.tenant.tenantId, ctx.tenant.userId, input.emailSummaryMode);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "user.email_summary_changed", entityType: "user", entityId: ctx.tenant.userId,
      oldValue: before.value, newValue: input.emailSummaryMode,
    });
    return ok(undefined);
  }
}
