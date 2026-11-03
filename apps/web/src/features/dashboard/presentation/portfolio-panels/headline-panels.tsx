import { HomeFinance } from "@/features/finance/presentation/HomeFinance";
import { HomeCard, Panel } from "../HomeParts";
import { PortfolioMapPanel } from "../PortfolioMapPanel";
import { ProjectBreakdown } from "../ProjectBreakdown";
import { reportsDueWithin } from "../../domain/home-derive";
import type { PortfolioHomeData } from "../../application/portfolio-home-model";

export function HeadlinesPanel(d: PortfolioHomeData) {
  if (!d.overview.ok || !d.totals) return null;
  const { rows, totals, health, snapshot } = d;
  const lateActivities = rows.reduce((n, r) => n + r.delivery.lateActivities, 0);
  const valuesOverdue = rows.reduce((n, r) => n + r.delivery.valuesOverdue, 0);
  const pendingEvidence = snapshot.pendingEvidence.ok && snapshot.pendingEvidence.value !== null ? String(snapshot.pendingEvidence.value) : "—";
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Headline figures">
      <HomeCard label="Delivery" value={`${health.onTrack} on track`} hint={`${health.atRisk} need attention · ${health.offTrack} behind`} href="/portfolio" />
      <HomeCard label="Reports due in 30 days" value={String(reportsDueWithin(rows, 30))} hint={totals.reportsOverdue > 0 ? `${totals.reportsOverdue} overdue` : "None overdue"} href="/reports" />
      <HomeCard label="Open problems and risks" value={String(totals.openRisks)} hint={`${totals.highRisks} serious`} href="/portfolio" />
      <HomeCard label="Evidence to verify" value={pendingEvidence} hint="awaiting review" href="/evidence" />
      <HomeCard label="Late planned activities" value={String(lateActivities)} hint={`${valuesOverdue} indicator values overdue`} href="/my-work" />
    </section>
  );
}

export function FundingPanel(d: PortfolioHomeData) {
  return d.finance.ok ? <HomeFinance f={d.finance.value} /> : null;
}

export function MapPanel(d: PortfolioHomeData) {
  if (!d.portfolioMap || d.rows.length === 0) return null;
  return <Panel title="Where we work" href="/portfolio" linkLabel="Open portfolio →"><PortfolioMapPanel data={d.portfolioMap.data} total={d.portfolioMap.total} /></Panel>;
}

export function BreakdownsPanel(d: PortfolioHomeData) {
  if (!d.overview.ok || d.rows.length === 0) return null;
  return <Panel title="Projects by …" href="/portfolio" linkLabel="Open portfolio →"><ProjectBreakdown rows={[...d.rows]} filter={d.filter} /></Panel>;
}
