import type { Result, DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../context.js";

type Handle<I, O = unknown> = { handle(ctx: AuthenticatedContext, input: I): Promise<Result<O, DomainError>> };

export interface DemoSeedHandlers {
  /** Confirms the project's set-up, which a reporting period requires. */
  acknowledgeSetup: { handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<unknown, DomainError>> };
  createPeriod: Handle<{ projectId: string; reportType: "QUARTERLY"; startDate: string; endDate: string; deadline: string }, { id: string }>;
  createIndicatorValue: Handle<{ indicatorId: string; reportingPeriodId: string; periodAchievement: string; cumulativeAchievement: string; comments: string; dataSource: string; attachedEvidenceIds: string[] }, { id: string }>;
  verifyIndicatorValue: { handle(ctx: AuthenticatedContext, indicatorUpdateId: string): Promise<Result<void, DomainError>> };
  createActivity: Handle<Record<string, unknown>, { id: string }>;
  reviewActivity: { handle(ctx: AuthenticatedContext, activityId: string, decision: { decision: "ACCEPT" }): Promise<Result<void, DomainError>> };
}

export interface DemoSeedTarget {
  projectId: string;
  /** First day of the first quarter. */
  startDate: Date;
  outputId: string;
  indicators: Array<{ id: string; code: string }>;
}

const day = (d: Date): string => d.toISOString();

/** The first quarter of the demo project: ends on the last day of its third month. */
export function firstQuarter(start: Date): { start: Date; end: Date } {
  return { start, end: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, 0, 23, 59, 59)) };
}

/** What the demo shows for each indicator in the first quarter: a verified value a reader can follow against the target. */
export const DEMO_VALUES: Readonly<Record<string, { period: string; cumulative: string; source: string }>> = {
  "IND-1": { period: "1320", cumulative: "1320", source: "MUAC screening registers, three health centres" },
  "IND-2": { period: "78", cumulative: "78", source: "Treatment completion log" },
};

/**
 * Fills the demo project with the first quarter: a reporting period, a verified value per indicator and two activity records, so the
 * guided tour starts from a project that already has something to report. It uses the same handlers a person's actions go through, and
 * it is a best effort: if any step is refused the demo still exists, just emptier, and the reason is returned.
 */
export class DemoContentSeeder {
  constructor(private readonly handlers: DemoSeedHandlers, private readonly now: () => Date = () => new Date()) {}

  async seed(ctx: AuthenticatedContext, target: DemoSeedTarget): Promise<{ seeded: boolean; reason?: string }> {
    const { start, end } = firstQuarter(target.startDate);
    const soon = new Date(this.now().getTime() + 14 * 86_400_000);
    const afterEnd = new Date(end.getTime() + 30 * 86_400_000);
    const deadline = afterEnd > soon ? afterEnd : soon;
    const setup = await this.handlers.acknowledgeSetup.handle(ctx, target.projectId);
    if (!setup.ok) return { seeded: false, reason: setup.error.message };
    const period = await this.handlers.createPeriod.handle(ctx, { projectId: target.projectId, reportType: "QUARTERLY", startDate: day(start), endDate: day(end), deadline: day(deadline) });
    if (!period.ok) return { seeded: false, reason: period.error.message };

    for (const indicator of target.indicators) {
      const demo = DEMO_VALUES[indicator.code];
      if (!demo) continue;
      const created = await this.handlers.createIndicatorValue.handle(ctx, {
        indicatorId: indicator.id, reportingPeriodId: period.value.id, periodAchievement: demo.period, cumulativeAchievement: demo.cumulative,
        comments: "Sample figure for the guided tour.", dataSource: demo.source, attachedEvidenceIds: [],
      });
      if (!created.ok) return { seeded: false, reason: created.error.message };
      const verified = await this.handlers.verifyIndicatorValue.handle(ctx, created.value.id);
      if (!verified.ok) return { seeded: false, reason: verified.error.message };
    }

    const activities = [
      { offsetDays: 20, title: "MUAC screening drive, Kilifi sub-county", location: "Kilifi", total: 640, summary: "Community health workers screened 640 children under 5 at two health centres and referred 41 for treatment." },
      { offsetDays: 55, title: "Refresher training for community health workers", location: "Kilifi", total: 24, summary: "24 community health workers took part in a two-day refresher on MUAC measurement and referral." },
    ];
    for (const a of activities) {
      const date = new Date(start.getTime() + a.offsetDays * 86_400_000);
      const created = await this.handlers.createActivity.handle(ctx, {
        projectId: target.projectId, reportingPeriodId: period.value.id, activityTitle: a.title, activityDate: day(date), location: a.location,
        outputId: target.outputId, participantsTotal: a.total, summary: a.summary, achievements: "", challenges: "", lessonsLearned: "", nextSteps: "",
      });
      if (!created.ok) return { seeded: false, reason: created.error.message };
      await this.handlers.reviewActivity.handle(ctx, created.value.id, { decision: "ACCEPT" });
    }
    return { seeded: true };
  }
}
