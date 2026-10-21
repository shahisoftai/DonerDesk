import { daysBetween, type PlainDate } from "../workplan/plain-date.js";
import type { HealthBand } from "../tasks/delivery-health.js";

/**
 * One line per project for the portfolio dashboard: delivery, problems and risks, and reporting side by side. Pure; today is passed in.
 * There is no combined score: each part says what it is, and the order of the rows (`rankPortfolio`) only decides what is looked at first.
 */
export interface PortfolioProjectFacts {
  projectId: string;
  title: string;
  donorName: string;
  country: string;
  status: string;
  health: { band: HealthBand; label: string; reasons: string[]; lateActivities: number; valuesOverdue: number };
  risks: ReadonlyArray<{ status: "OPEN" | "CLOSED"; seriousness: "HIGH" | "MEDIUM" | "LOW"; reviewBy?: PlainDate | undefined }>;
  periods: ReadonlyArray<{ id: string; deadline: PlainDate; status: string; readinessScore: number; cancelled: boolean }>;
}

export interface PortfolioRow {
  projectId: string;
  title: string;
  donorName: string;
  country: string;
  status: string;
  delivery: { band: HealthBand; label: string; reason: string | null; lateActivities: number; valuesOverdue: number };
  risks: { open: number; high: number; reviewOverdue: number };
  reporting: { periodId: string; deadline: PlainDate; daysUntil: number; status: string; readinessScore: number } | null;
  /** Reports whose deadline has passed and that are not finished. */
  reportsOverdue: number;
}

/** Report states after which a deadline no longer matters. */
const FINISHED = new Set(["APPROVED", "EXPORTED", "SENT", "SUBMITTED", "CLOSED"]);

export function buildPortfolioRow(facts: PortfolioProjectFacts, today: PlainDate): PortfolioRow {
  const open = facts.risks.filter((r) => r.status === "OPEN");
  const unfinished = facts.periods.filter((p) => !p.cancelled && !FINISHED.has(p.status));
  const next = [...unfinished].sort((a, b) => a.deadline.localeCompare(b.deadline))[0];
  return {
    projectId: facts.projectId,
    title: facts.title,
    donorName: facts.donorName,
    country: facts.country,
    status: facts.status,
    delivery: {
      band: facts.health.band,
      label: facts.health.label,
      reason: facts.health.reasons[0] ?? null,
      lateActivities: facts.health.lateActivities,
      valuesOverdue: facts.health.valuesOverdue,
    },
    risks: {
      open: open.length,
      high: open.filter((r) => r.seriousness === "HIGH").length,
      reviewOverdue: open.filter((r) => r.reviewBy !== undefined && r.reviewBy < today).length,
    },
    reporting: next ? { periodId: next.id, deadline: next.deadline, daysUntil: daysBetween(today, next.deadline), status: next.status, readinessScore: next.readinessScore } : null,
    reportsOverdue: unfinished.filter((p) => p.deadline < today).length,
  };
}

const BAND_ORDER: Readonly<Record<HealthBand, number>> = { OFF_TRACK: 0, AT_RISK: 1, NO_PLAN: 2, ON_TRACK: 3 };

/** What to look at first: behind projects, then overdue reports, then serious problems, then the nearest report. Ties keep title order. */
export function rankPortfolio(rows: ReadonlyArray<PortfolioRow>): PortfolioRow[] {
  return [...rows].sort(
    (a, b) =>
      BAND_ORDER[a.delivery.band] - BAND_ORDER[b.delivery.band] ||
      b.reportsOverdue - a.reportsOverdue ||
      b.risks.high - a.risks.high ||
      (a.reporting?.daysUntil ?? Number.POSITIVE_INFINITY) - (b.reporting?.daysUntil ?? Number.POSITIVE_INFINITY) ||
      a.title.localeCompare(b.title),
  );
}

export interface PortfolioTotals {
  projects: number;
  behind: number;
  needAttention: number;
  openRisks: number;
  highRisks: number;
  reportsOverdue: number;
}

export function portfolioTotals(rows: ReadonlyArray<PortfolioRow>): PortfolioTotals {
  return {
    projects: rows.length,
    behind: rows.filter((r) => r.delivery.band === "OFF_TRACK").length,
    needAttention: rows.filter((r) => r.delivery.band === "AT_RISK").length,
    openRisks: rows.reduce((n, r) => n + r.risks.open, 0),
    highRisks: rows.reduce((n, r) => n + r.risks.high, 0),
    reportsOverdue: rows.reduce((n, r) => n + r.reportsOverdue, 0),
  };
}
