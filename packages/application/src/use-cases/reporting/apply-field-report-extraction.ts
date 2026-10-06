import type { Result } from "@donordesk/domain";
import { DomainError, IndicatorUpdate, ActivityUpdate } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IIndicatorRepository } from "../../ports/logframe.js";
import type { IIndicatorUpdateRepository } from "../../ports/logframe.js";
import type { IActivityUpdateRepository } from "../../ports/activities.js";
import type { IReportingPeriodRepository } from "../../ports/reporting.js";
import type { IIdGenerator, IAuditLogger } from "../../ports/core.js";
import type { StoryContext } from "@donordesk/domain";

/**
 * Increment 5 — Field report → commit only what the user confirmed.
 *
 * Persists the user-approved proposed items into the EXISTING structured model:
 *   indicator achievements → IndicatorUpdate (upsert by indicator+period)
 *   activities             → ActivityUpdate
 *   story context          → ReportingPeriod.storyContext (merged)
 * This is the "user confirms, then save" step. It never runs the extractor
 * itself — only what the user explicitly confirmed is written.
 */

export interface ConfirmedExtractionItem {
  indicatorAchievements?: Array<{ indicatorCode: string; value: string }>;
  activities?: Array<{ title: string; date?: string; participants?: string }>;
  story?: Partial<StoryContext>;
  /** Confirmed compliance statements (key = template section id). */
  sectionNotes?: Array<{ key: string; text: string }>;
}

export interface ApplyExtractionResult {
  indicatorsCreated: number;
  indicatorsUpdated: number;
  activitiesCreated: number;
  sectionNotesSaved: number;
  errors: string[];
}

export class ApplyFieldReportExtractionHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly indicators: IIndicatorRepository,
    private readonly updates: IIndicatorUpdateRepository,
    private readonly activities: IActivityUpdateRepository,
    private readonly periods: IReportingPeriodRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, input: { projectId: string; reportingPeriodId: string } & ConfirmedExtractionItem): Promise<Result<ApplyExtractionResult, DomainError>> {
    const { projectId, reportingPeriodId } = input;
    const errors: string[] = [];
    let indicatorsCreated = 0;
    let indicatorsUpdated = 0;
    let activitiesCreated = 0;
    let sectionNotesSaved = 0;

    // Indicator achievements → upsert IndicatorUpdate.
    if (input.indicatorAchievements && input.indicatorAchievements.length > 0) {
      const indicatorsResult = await this.indicators.findByProject(projectId, ctx.tenant.tenantId);
      if (!indicatorsResult.ok) return indicatorsResult;
      const byCode = new Map(
        indicatorsResult.value
          .map((i) => ({ code: i.code, id: i.id }))
          .filter((x) => x.code)
          .map((x) => [x.code.trim().toLowerCase(), x.id]),
      );
      for (const item of input.indicatorAchievements) {
        const indicatorId = byCode.get(item.indicatorCode.trim().toLowerCase());
        if (!indicatorId) {
          errors.push(`Indicator "${item.indicatorCode}" does not exist in this project; skipped.`);
          continue;
        }
        const existing = await this.updates.findByIndicatorAndPeriod(indicatorId, reportingPeriodId, ctx.tenant.tenantId);
        if (!existing.ok) return existing;
        if (existing.value) {
          try {
            existing.value.edit({ periodAchievement: item.value });
            existing.value.submit();
          } catch (error) {
            errors.push(`Indicator "${item.indicatorCode}" is verified and cannot be auto-updated; review it in the indicator data grid first.`);
            continue;
          }
          const saved = await this.updates.update(existing.value);
          if (!saved.ok) return saved;
          indicatorsUpdated++;
        } else {
          const u = IndicatorUpdate.create({
            id: this.ids.generate(),
            tenantId: ctx.tenant.tenantId.toString(),
            indicatorId,
            reportingPeriodId,
            periodAchievement: item.value,
            cumulativeAchievement: "",
            createdById: ctx.tenant.userId,
          });
          u.submit();
          const saved = await this.updates.create(u);
          if (!saved.ok) return saved;
          indicatorsCreated++;
        }
      }
    }

    // Activities → ActivityUpdate.
    if (input.activities && input.activities.length > 0) {
      for (const a of input.activities) {
        const title = a.title?.trim();
        if (!title) {
          errors.push("An activity had no title; skipped.");
          continue;
        }
        const baseActivity = {
          id: this.ids.generate(),
          tenantId: ctx.tenant.tenantId.toString(),
          projectId,
          reportingPeriodId,
          activityTitle: title,
          activityDate: a.date ? new Date(a.date) : new Date(),
          summary: title,
          achievements: "",
          challenges: "",
          lessonsLearned: "",
          nextSteps: "",
          submittedById: ctx.tenant.userId,
        };
        const activity = ActivityUpdate.create(
          a.participants ? { ...baseActivity, participantsTotal: Number(a.participants) } : baseActivity,
        );
        activity.submit();
        const saved = await this.activities.create(activity);
        if (!saved.ok) return saved;
        activitiesCreated++;
      }
    }

    // Story context → merge into ReportingPeriod.storyContext.
    if (input.story && Object.keys(input.story).length > 0) {
      const periodResult = await this.periods.findById(reportingPeriodId, ctx.tenant.tenantId);
      if (!periodResult.ok) return periodResult;
      if (periodResult.value) {
        const merged: StoryContext = { ...periodResult.value.storyContext, ...input.story };
        periodResult.value.setStoryContext(merged);
        const saved = await this.periods.update(periodResult.value);
        if (!saved.ok) return saved;
      }
    }

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "reporting.field_report_extraction.applied",
      entityType: "reporting_period",
      entityId: reportingPeriodId,
      projectId,
      newValue: JSON.stringify({ indicatorsCreated, indicatorsUpdated, activitiesCreated, errors: errors.length }),
    });

    if (input.sectionNotes && input.sectionNotes.length > 0) {
      const periodResult = await this.periods.findById(reportingPeriodId, ctx.tenant.tenantId);
      if (!periodResult.ok) return periodResult;
      const period = periodResult.value;
      if (period) {
        for (const note of input.sectionNotes) {
          if (!note.key || !note.text.trim()) continue;
          period.setSectionNote(note.key, note.text);
          sectionNotesSaved++;
        }
        const saved = await this.periods.update(period);
        if (!saved.ok) return saved;
      }
    }

    return { ok: true, value: { indicatorsCreated, indicatorsUpdated, activitiesCreated, sectionNotesSaved, errors } };
  }
}
