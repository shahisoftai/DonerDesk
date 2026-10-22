import "server-only";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { DataSheetResponseSchema, ReportingPeriodsResponseSchema, RisksResponseSchema, WorkPlanResponseSchema, type ProjectListItem } from "@/lib/server/schemas";
import { budgetPace, headlineIndicator, lifecycle } from "@/features/projects/domain/overview-derive";
import { paceReading, weeklyDelivery, type PaceReading, type PipelinePeriod, type PlanRowLike, type WeekPoint } from "../domain/home-derive";

export interface ProjectInsight {
  projectId: string;
  results: PaceReading;
  budget: PaceReading & { currency: string | null };
}

export interface HomeInsights {
  insights: Map<string, ProjectInsight>;
  periods: PipelinePeriod[];
  /** Planned work finished on time, week by week, across the projects that have a plan. */
  deliveryWeeks: WeekPoint[];
  risks: Array<{ id: string; projectId: string; projectTitle: string; title: string; seriousness: "HIGH" | "MEDIUM" | "LOW"; reviewBy?: string }>;
}

const SERIOUSNESS_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;

/**
 * The per-project figures the Home needs beyond the portfolio overview: results and budget against the clock, every reporting
 * period (for the pipeline) and open risks. One failed call leaves that project's figure out; it never breaks the page.
 * Capped so a large account stays quick.
 */
export async function loadHomeInsights(token: string, projects: ReadonlyArray<ProjectListItem>, today: string, cap = 10): Promise<HomeInsights> {
  const subset = projects.slice(0, cap);
  const perProject = await Promise.all(subset.map(async (p) => {
    const [sheet, periods, risks, plan] = await Promise.all([
      gatewayRequest(`/v1/projects/${encodeURIComponent(p.id)}/data-sheet`, DataSheetResponseSchema, token),
      gatewayRequest(`/v1/projects/${encodeURIComponent(p.id)}/reporting-periods`, ReportingPeriodsResponseSchema, token),
      gatewayRequest(`/v1/projects/${encodeURIComponent(p.id)}/risks`, RisksResponseSchema, token),
      gatewayRequest(`/v1/projects/${encodeURIComponent(p.id)}/work-plan`, WorkPlanResponseSchema, token),
    ]);
    return { p, sheet, periods, risks, plan };
  }));

  const insights = new Map<string, ProjectInsight>();
  const periods: PipelinePeriod[] = [];
  const risks: HomeInsights["risks"] = [];
  const planRows: PlanRowLike[] = [];
  for (const { p, sheet, periods: per, risks: rk, plan } of perProject) {
    if (plan.ok) planRows.push(...plan.value.items);
    const time = lifecycle({ startDate: p.startDate, endDate: p.endDate, today, periods: [], reportingFrequency: p.reportingFrequency }).timeElapsedPercent;
    let resultsValue: number | null = null;
    let budgetValue: number | null = null;
    let currency: string | null = null;
    if (sheet.ok) {
      const headline = headlineIndicator(sheet.value);
      resultsValue = headline ? [...headline.series].reverse().find((s) => s.percent !== null)?.percent ?? null : null;
      const labels = new Map(sheet.value.periods.map((x) => [x.id, x.label]));
      const main = budgetPace(sheet.value, labels).sort((a, b) => b.budget - a.budget)[0];
      if (main?.spentPercent != null) { budgetValue = main.spentPercent; currency = main.currency; }
    }
    insights.set(p.id, { projectId: p.id, results: paceReading(resultsValue, time), budget: { ...paceReading(budgetValue, time), currency } });
    if (per.ok) {
      for (const x of per.value.items) periods.push({ projectId: p.id, projectTitle: p.title, periodId: x.id, status: x.status, deadline: x.deadline, daysUntil: x.daysUntilDeadline });
    }
    if (rk.ok) {
      for (const r of rk.value.items.filter((x) => x.status === "OPEN")) risks.push({ id: r.id, projectId: p.id, projectTitle: p.title, title: r.title, seriousness: r.seriousness, reviewBy: r.reviewBy });
    }
  }
  risks.sort((a, b) => SERIOUSNESS_ORDER[a.seriousness] - SERIOUSNESS_ORDER[b.seriousness]);
  const deliveryWeeks = weeklyDelivery(planRows, today, 8);
  return { insights, periods, risks, deliveryWeeks };
}
