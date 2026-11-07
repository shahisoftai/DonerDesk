/** The four portfolio blocks (Phase 45.2): read from the portfolio the person can already see. Counts side by side; no combined score. */
import { empty, ready, unavailable, type SectionProps } from "./props.js";
import type { CanvasFacts, PortfolioBand, PortfolioFacts } from "../facts.js";

const NO_PORTFOLIO = "The portfolio was not read.";
const NONE = "No project is visible yet.";
const TABLE_LIMIT = 14;
const COUNTRY_LIMIT = 8;
const BANDS: readonly PortfolioBand[] = ["ON_TRACK", "AT_RISK", "OFF_TRACK", "NO_PLAN"];
const bandOf = (b: string): PortfolioBand => ((BANDS as readonly string[]).includes(b) ? (b as PortfolioBand) : "NO_PLAN");

const read = (facts: CanvasFacts | undefined): PortfolioFacts | "none" | undefined => (!facts?.portfolio ? undefined : facts.portfolio.rows.length === 0 ? "none" : facts.portfolio);

export const portfolioSummaryModel = (_p: SectionProps, facts: CanvasFacts | undefined) => {
  const p = read(facts);
  if (!p) return unavailable(NO_PORTFOLIO);
  if (p === "none") return empty(NONE);
  const t = p.totals;
  return ready({ asAt: p.asAt ?? "", cards: [
    { key: "projects", value: t.projects }, { key: "countries", value: t.countries }, { key: "offTrack", value: t.behind, tone: "LATE" as const },
    { key: "atRisk", value: t.needAttention, tone: "WARN" as const }, { key: "openRisks", value: t.openRisks }, { key: "reportsOverdue", value: t.reportsOverdue },
  ] });
};

export const portfolioHealthModel = (_p: SectionProps, facts: CanvasFacts | undefined) => {
  const p = read(facts);
  if (!p) return unavailable(NO_PORTFOLIO);
  if (p === "none") return empty(NONE);
  const parts = BANDS.map((band) => ({ band, count: p.rows.filter((r) => bandOf(r.band) === band).length })).filter((x) => x.count > 0);
  return ready({ parts });
};

export const portfolioCountriesModel = (_p: SectionProps, facts: CanvasFacts | undefined) => {
  const p = read(facts);
  if (!p) return unavailable(NO_PORTFOLIO);
  if (p === "none" || !p.countries || p.countries.length === 0) return empty(NONE);
  return ready({ countries: p.countries.slice(0, COUNTRY_LIMIT), more: Math.max(0, p.countries.length - COUNTRY_LIMIT) });
};

export const portfolioTableModel = (_p: SectionProps, facts: CanvasFacts | undefined) => {
  const p = read(facts);
  if (!p) return unavailable(NO_PORTFOLIO);
  if (p === "none") return empty(NONE);
  return ready({ rows: p.rows.slice(0, TABLE_LIMIT).map((r) => ({ title: r.title, country: r.country, donorName: r.donorName, band: bandOf(r.band), nextReport: r.nextReport ?? null })), more: Math.max(0, p.rows.length - TABLE_LIMIT) });
};
