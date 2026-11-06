import { HEALTH_BAND_LABEL, ok, type DomainError, type HealthBand, type PortfolioTotals, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { GetPortfolioOverviewHandler } from "../health/portfolio-overview.js";

export interface PortfolioInfographicRow {
  title: string;
  donorName: string;
  country: string;
  status: string;
  band: HealthBand;
  bandLabel: string;
  lateActivities: number;
  valuesOverdue: number;
  openRisks: number;
  highRisks: number;
  reportsOverdue: number;
  /** The next unfinished report: its deadline (YYYY-MM-DD) and how many days away (negative = overdue). */
  nextReport?: { deadline: string; daysUntil: number };
}

export interface PortfolioInfographicDataDto {
  asAt: string;
  totals: PortfolioTotals & { countries: number; onTrack: number; noPlan: number };
  rows: PortfolioInfographicRow[];
  countries: Array<{ country: string; projects: number; offTrack: number; atRisk: number; onTrack: number; noPlan: number }>;
}

/**
 * What a portfolio infographic draws from: the same portfolio read the dashboard shows (so the two cannot disagree), reduced to what a
 * page needs. Project ids are left out, nothing is added up that the dashboard does not add up (no combined score, no summed reach),
 * and a person sees only the projects they can already see.
 */
export class GetPortfolioInfographicDataHandler {
  constructor(private readonly overview: GetPortfolioOverviewHandler, private readonly clock: { now(): Date }) {}

  async handle(ctx: AuthenticatedContext): Promise<Result<PortfolioInfographicDataDto, DomainError>> {
    const result = await this.overview.handle(ctx);
    if (!result.ok) return result;
    const rows: PortfolioInfographicRow[] = result.value.rows.map((r) => ({
      title: r.title,
      donorName: r.donorName,
      country: r.country,
      status: r.status,
      band: r.delivery.band,
      bandLabel: HEALTH_BAND_LABEL[r.delivery.band],
      lateActivities: r.delivery.lateActivities,
      valuesOverdue: r.delivery.valuesOverdue,
      openRisks: r.risks.open,
      highRisks: r.risks.high,
      reportsOverdue: r.reportsOverdue,
      ...(r.reporting ? { nextReport: { deadline: String(r.reporting.deadline), daysUntil: r.reporting.daysUntil } } : {}),
    }));
    const byCountry = new Map<string, PortfolioInfographicDataDto["countries"][number]>();
    for (const row of rows) {
      const key = row.country.trim() || "—";
      const c = byCountry.get(key) ?? { country: key, projects: 0, offTrack: 0, atRisk: 0, onTrack: 0, noPlan: 0 };
      c.projects += 1;
      if (row.band === "OFF_TRACK") c.offTrack += 1;
      else if (row.band === "AT_RISK") c.atRisk += 1;
      else if (row.band === "ON_TRACK") c.onTrack += 1;
      else c.noPlan += 1;
      byCountry.set(key, c);
    }
    const countries = [...byCountry.values()].sort((a, b) => Number(a.country === "—") - Number(b.country === "—") || b.projects - a.projects || a.country.localeCompare(b.country));
    return ok({
      asAt: this.clock.now().toISOString().slice(0, 10),
      totals: { ...result.value.totals, countries: countries.filter((c) => c.country !== "—").length, onTrack: rows.filter((r) => r.band === "ON_TRACK").length, noPlan: rows.filter((r) => r.band === "NO_PLAN").length },
      rows,
      countries,
    });
  }
}
