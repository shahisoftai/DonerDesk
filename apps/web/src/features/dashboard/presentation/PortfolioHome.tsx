import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { FundingResponseSchema, PortfolioOverviewSchema } from "@/lib/server/schemas";
import { decodeSessionPayload } from "@/lib/shared/jwt-session";
import { loadDashboard } from "../application/dashboard-read-model";
import { loadWorkItems } from "@/features/work-items/application/work-items-read-model";
import { Badge } from "@/components/data/Badge";
import { workItemHref, workItemMeta, workItemTitle } from "@/features/work-items/presentation/work-items-view";
import { InlineError } from "@/components/feedback/PageState";
import { dueLabel, healthCounts, homeHeadline, needsYouItems, reportsDueWithin, upcomingReports } from "../domain/home-derive";
import { loadHomeInsights } from "../application/home-insights";
import { DeadlineTiles, DeliverySparkline, PaceBar, PaceLegend, PipelineBoard, ResultsBars, RisksList, StatList } from "./HomeWidgets";
import { HomeHeader, NeedsYouStrip, NotificationsList, Panel, QuickLinks, Tile, type QuickLink } from "./HomeParts";

type Ctx = Awaited<ReturnType<typeof requireSession>>;
const BAND_TONE = { ON_TRACK: "success", AT_RISK: "warning", OFF_TRACK: "danger", NO_PLAN: "neutral" } as const;

/** Home for a director (and read-only viewers) and for a project or M&E manager: the same read model, scoped to the projects the person can see. */
export async function PortfolioHome({ ctx, variant }: { ctx: Ctx; variant: "DIRECTOR" | "MANAGER" }) {
  const identity = decodeSessionPayload(ctx.token);
  const director = variant === "DIRECTOR";
  const [overview, snapshot, work, funding] = await Promise.all([
    gatewayRequest("/v1/portfolio/overview", PortfolioOverviewSchema, ctx.token),
    loadDashboard(ctx.token),
    loadWorkItems(ctx.token),
    director && ctx.capabilities.has("org.manage") ? gatewayRequest("/v1/funding", FundingResponseSchema, ctx.token) : Promise.resolve(null),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const liveIds = new Set((overview.ok ? overview.value.rows : []).map((r) => r.projectId));
  const liveProjects = (snapshot.projects.ok ? snapshot.projects.value ?? [] : []).filter((p) => liveIds.has(p.id));
  const extra = await loadHomeInsights(ctx.token, liveProjects, today);
  const rows = overview.ok ? overview.value.rows : [];
  const totals = overview.ok ? overview.value.totals : null;
  const items = work.ok ? work.items : [];
  const notifications = snapshot.notifications.ok ? snapshot.notifications.value ?? [] : [];
  const needs = needsYouItems({
    reportsOverdue: totals?.reportsOverdue ?? 0,
    highRisks: totals?.highRisks ?? 0,
    risksReviewOverdue: rows.reduce((n, r) => n + r.risks.reviewOverdue, 0),
    evidenceToReview: snapshot.pendingEvidence.ok ? snapshot.pendingEvidence.value : null,
    activitiesToReview: work.ok ? items.filter((i) => i.kind === "activity").length : null,
    checklistBlockers: work.ok ? items.filter((i) => i.kind === "checklist").length : null,
  });
  const health = healthCounts(rows);
  const upcoming = upcomingReports(rows, 5);
  const firstName = (identity?.name ?? "").split(" ")[0];
  const grants = funding?.ok ? [...funding.value.programmes.flatMap((p) => p.grants), ...funding.value.looseGrants] : [];

  const links: QuickLink[] = [];
  if (ctx.capabilities.has("report.approve")) links.push({ href: "/reports", label: "Approve reports", hint: "Reports in review" });
  if (ctx.capabilities.has("activity.review")) links.push({ href: "/my-work?type=activity", label: "Accept activities" });
  if (ctx.capabilities.has("evidence.verify")) links.push({ href: "/evidence", label: "Verify evidence" });
  links.push({ href: "/portfolio/indicators", label: "Indicators across projects" });
  if (director && ctx.capabilities.has("org.manage")) links.push({ href: "/programmes", label: "Programmes and grants" });
  if (ctx.capabilities.has("export.create")) links.push({ href: "/downloads", label: "Download Center" });
  if (ctx.capabilities.has("project.create")) links.push({ href: "/projects/new", label: "New project" });
  if (ctx.capabilities.has("team.invite")) links.push({ href: "/team", label: "Invite a person" });

  return (
    <div className="animate-fade-in space-y-6">
      <HomeHeader
        eyebrow={director ? "Portfolio home" : "Project home"}
        title={`Welcome back${firstName ? `, ${firstName}` : ""}. ${homeHeadline(needs)}`}
        subtitle={totals ? `${totals.projects} live project${totals.projects === 1 ? "" : "s"} you can see. Missing data is shown as unavailable, never as zero.` : "Portfolio figures are unavailable right now."}
        actions={<><Link className="btn-secondary" href="/portfolio">Open portfolio</Link><Link className="btn-secondary" href="/my-work">Open My Work</Link></>}
      />

      <NeedsYouStrip items={needs} />

      {!overview.ok && <InlineError title={overview.error.message} referenceId={overview.error.referenceId} />}

      {overview.ok && totals && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Headline figures">
          <Tile label="Delivery" value={`${health.onTrack} on track`} hint={`${health.atRisk} need attention · ${health.offTrack} behind`} href="/portfolio" />
          <Tile label="Reports due in 30 days" value={String(reportsDueWithin(rows, 30))} hint={totals.reportsOverdue > 0 ? `${totals.reportsOverdue} overdue` : "None overdue"} href="/reports" />
          <Tile label="Open problems and risks" value={String(totals.openRisks)} hint={`${totals.highRisks} serious`} href="/portfolio" />
          <Tile label="Evidence to verify" value={snapshot.pendingEvidence.ok && snapshot.pendingEvidence.value !== null ? String(snapshot.pendingEvidence.value) : "—"} hint="awaiting review" href="/evidence" />
          <Tile label="Late planned activities" value={String(rows.reduce((n, r) => n + r.delivery.lateActivities, 0))} hint={`${rows.reduce((n, r) => n + r.delivery.valuesOverdue, 0)} indicator values overdue`} href="/my-work" />
        </section>
      )}

      {overview.ok && (
        <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
          <Panel title="Project health" href="/portfolio" linkLabel="Open portfolio →">
            {rows.length > 0 && <PaceLegend />}
            {rows.length === 0 ? (
              <p className="card text-sm text-slate-600 dark:text-slate-300">No live projects yet. <Link className="font-medium text-brand-600 hover:underline dark:text-brand-400" href="/projects/new">Create your first project</Link>.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200/70 bg-white dark:border-white/10 dark:bg-white/[0.03]">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                      <th className="px-3 py-2 font-medium">Project</th><th className="px-3 py-2 font-medium">Delivery</th><th className="px-3 py-2 font-medium">Results</th><th className="px-3 py-2 font-medium">Budget</th><th className="px-3 py-2 font-medium">Risks</th><th className="px-3 py-2 font-medium">Next report</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 8).map((r) => (
                      <tr key={r.projectId} className="border-t border-slate-200/70 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5">
                        <td className="px-3 py-2.5"><Link href={`/projects/${r.projectId}`} className="block font-medium hover:underline">{r.title}</Link><span className="text-xs text-slate-500 dark:text-slate-400">{r.donorName} · {r.country}</span></td>
                        <td className="px-3 py-2.5"><Badge tone={BAND_TONE[r.delivery.band]}>{r.delivery.label}</Badge>{r.delivery.reason && <div className="mt-1 max-w-[220px] text-xs text-slate-500 dark:text-slate-400">{r.delivery.reason}</div>}</td>
                        <td className="px-3 py-2.5">{extra.insights.get(r.projectId) ? <PaceBar reading={extra.insights.get(r.projectId)!.results} tone="results" /> : <span className="text-xs text-slate-400">—</span>}</td>
                        <td className="px-3 py-2.5">{extra.insights.get(r.projectId) ? <PaceBar reading={extra.insights.get(r.projectId)!.budget} tone="budget" /> : <span className="text-xs text-slate-400">—</span>}</td>
                        <td className="px-3 py-2.5 tabular-nums">{r.risks.open}{r.risks.high > 0 && <span className="ml-1 text-xs text-danger-600 dark:text-danger-400">({r.risks.high} serious)</span>}</td>
                        <td className="px-3 py-2.5">{r.reporting ? <Link href={`/projects/${r.projectId}/reports/${r.reporting.periodId}`} className="hover:underline"><span className={r.reporting.daysUntil < 0 ? "font-medium text-danger-600 dark:text-danger-400" : ""}>{dueLabel(r.reporting.daysUntil)}</span><span className="block text-xs text-slate-500 dark:text-slate-400">{r.reporting.readinessScore}% ready</span></Link> : <span className="text-xs text-slate-500 dark:text-slate-400">None scheduled</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Upcoming reports" href="/reports" linkLabel="All reports →">
            <DeadlineTiles items={upcoming} />
          </Panel>
        </section>
      )}

      {overview.ok && (
        <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <Panel title="Report pipeline" href="/reports" linkLabel="All reports →"><PipelineBoard periods={extra.periods} /></Panel>
          <Panel title="Risks and problems" href="/portfolio" linkLabel="Portfolio →"><RisksList risks={extra.risks} /></Panel>
        </section>
      )}

      {overview.ok && (
        <section className="grid gap-6 lg:grid-cols-3">
          <Panel title="Delivery this week" href="/my-work" linkLabel="Work plan →">
            <div className="mb-3"><DeliverySparkline points={extra.deliveryWeeks} /></div>
            <StatList rows={[
              { label: "Late planned activities", value: String(rows.reduce((n, r) => n + r.delivery.lateActivities, 0)), href: "/my-work", tone: rows.some((r) => r.delivery.lateActivities > 0) ? "danger" : undefined },
              { label: "Completed activities to review", value: work.ok ? String(items.filter((i) => i.kind === "activity").length) : "—", href: "/my-work?type=activity" },
              { label: "Projects with a delay", value: String(rows.filter((r) => r.delivery.band === "OFF_TRACK" || r.delivery.band === "AT_RISK").length), href: "/portfolio" },
            ]} />
          </Panel>
          <Panel title="Data and evidence" href="/portfolio/indicators" linkLabel="Indicators →">
            <StatList rows={[
              { label: "Indicator values overdue", value: String(rows.reduce((n, r) => n + r.delivery.valuesOverdue, 0)), href: "/portfolio/indicators", tone: rows.some((r) => r.delivery.valuesOverdue > 0) ? "warning" : undefined },
              { label: "Files to verify", value: snapshot.pendingEvidence.ok && snapshot.pendingEvidence.value !== null ? String(snapshot.pendingEvidence.value) : "—", href: "/evidence" },
              { label: "Compliance blockers", value: work.ok ? String(items.filter((i) => i.kind === "checklist").length) : "—", href: "/compliance" },
            ]} />
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">A missing value is shown as missing, never as zero.</p>
          </Panel>
          <Panel title="Results against target" href="/portfolio/indicators" linkLabel="Indicators →">
            <ResultsBars rows={rows.slice(0, 6).map((r) => ({ projectId: r.projectId, title: r.title, reading: extra.insights.get(r.projectId)?.results ?? { value: null, timeElapsed: 0, ahead: null } }))} />
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Latest share of target for each project's main indicator. Rates are left out.</p>
          </Panel>
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <Panel title="Your work" href="/my-work" linkLabel="View all →">
          {items.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">No urgent work items right now.</p> : (
            <ul className="space-y-2">
              {items.slice(0, 4).map((i) => (
                <li key={`${i.kind}-${i.id}`}>
                  <Link href={workItemHref(i)} className="card block transition hover:border-brand-400/40">
                    <Badge tone="info" className="mr-2">{i.kind}</Badge><span className="text-sm font-medium">{workItemTitle(i)}</span>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{workItemMeta(i)}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Notifications" href="/notifications" linkLabel="Open inbox →">
          <NotificationsList items={notifications} />
        </Panel>
      </section>

      {director && grants.length > 0 && (
        <Panel title="Grants" href="/programmes" linkLabel="Programmes and grants →">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {grants.slice(0, 6).map((g) => (
              <Link key={g.id} href="/programmes" className="card min-w-0 transition hover:border-brand-400/40">
                <div className="break-words text-sm font-medium leading-5">{g.title}</div>
                <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{g.donorName}{g.endDate ? ` · ends ${new Date(g.endDate).toLocaleDateString()}` : ""}</div>
                {g.amount && <div className="mt-2 text-sm tabular-nums">{g.currency ?? ""} {Number(g.amount).toLocaleString()}</div>}
              </Link>
            ))}
          </div>
        </Panel>
      )}

      <QuickLinks links={links} />
    </div>
  );
}
