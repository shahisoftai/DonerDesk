import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { FundingResponseSchema, PortfolioOverviewSchema } from "@/lib/server/schemas";
import { decodeSessionPayload } from "@/lib/shared/jwt-session";
import { loadDashboard } from "../application/dashboard-read-model";
import { loadWorkItems } from "@/features/work-items/application/work-items-read-model";
import { workItemHref, workItemMeta, workItemTitle } from "@/features/work-items/presentation/work-items-view";
import { Badge } from "@/components/data/Badge";
import { InlineError } from "@/components/feedback/PageState";
import { needsYouItems, reportsDueWithin, upcomingReports } from "../domain/home-derive";
import { HomeHeader, NeedsYouStrip, NotificationsList, Panel, QuickLinks, Tile, type QuickLink } from "./HomeParts";
import { DeadlineTiles, StatList } from "./HomeWidgets";

type Ctx = Awaited<ReturnType<typeof requireSession>>;

/**
 * Home for a grants officer (money and donor deadlines) and a compliance officer (checks, evidence and restricted files).
 * One component, two sets of parts: the parts a role needs are the only ones it shows.
 */
export async function ReviewerHome({ ctx, variant }: { ctx: Ctx; variant: "GRANTS" | "COMPLIANCE" }) {
  const identity = decodeSessionPayload(ctx.token);
  const grants = variant === "GRANTS";
  const [overview, snapshot, work, funding] = await Promise.all([
    gatewayRequest("/v1/portfolio/overview", PortfolioOverviewSchema, ctx.token),
    loadDashboard(ctx.token),
    loadWorkItems(ctx.token),
    grants && ctx.capabilities.has("org.manage") ? gatewayRequest("/v1/funding", FundingResponseSchema, ctx.token) : Promise.resolve(null),
  ]);
  const rows = overview.ok ? overview.value.rows : [];
  const totals = overview.ok ? overview.value.totals : null;
  const items = work.ok ? work.items : [];
  const checklist = items.filter((i) => i.kind === "checklist");
  const evidence = items.filter((i) => i.kind === "evidence");
  const pendingEvidence = snapshot.pendingEvidence.ok ? snapshot.pendingEvidence.value : null;
  const notifications = snapshot.notifications.ok ? snapshot.notifications.value ?? [] : [];
  const firstName = (identity?.name ?? "").split(" ")[0];
  const upcoming = upcomingReports(rows, 6);
  const needs = needsYouItems({
    reportsOverdue: totals?.reportsOverdue ?? 0,
    highRisks: totals?.highRisks ?? 0,
    risksReviewOverdue: rows.reduce((n, r) => n + r.risks.reviewOverdue, 0),
    evidenceToReview: pendingEvidence,
    activitiesToReview: null,
    checklistBlockers: work.ok ? checklist.length : null,
  });
  const allGrants = funding?.ok ? [...funding.value.programmes.flatMap((p) => p.grants), ...funding.value.looseGrants] : [];
  const endingSoon = allGrants.filter((g) => g.endDate && new Date(g.endDate).getTime() - Date.now() < 183 * 86400000 && new Date(g.endDate).getTime() > Date.now());

  const links: QuickLink[] = [];
  if (grants) {
    links.push({ href: "/programmes", label: "Programmes and grants", hint: "Awards and budgets" });
    links.push({ href: "/reports", label: "Reports due", hint: "Approve and track" });
    links.push({ href: "/portfolio", label: "Portfolio" });
    links.push({ href: "/downloads", label: "Download Center", hint: "Donor submissions" });
  } else {
    links.push({ href: "/compliance", label: "Compliance checklist", hint: "Open blockers" });
    links.push({ href: "/evidence", label: "Verify evidence", hint: "Files waiting" });
    links.push({ href: "/reports", label: "Reports and confidentiality" });
    links.push({ href: "/downloads", label: "Download Center", hint: "Check before export" });
  }

  return (
    <div className="animate-fade-in space-y-6">
      <HomeHeader
        eyebrow={grants ? "Grants home" : "Compliance home"}
        title={`Welcome back${firstName ? `, ${firstName}` : ""}. ${grants ? `${reportsDueWithin(rows, 30)} report${reportsDueWithin(rows, 30) === 1 ? "" : "s"} due in 30 days.` : `${checklist.length} compliance blocker${checklist.length === 1 ? "" : "s"} open.`}`}
        subtitle={grants ? "Donor deadlines, what is still owed, and the awards that end soonest." : "Compliance blockers, files to verify, and reports close to submission."}
        actions={<Link className="btn-secondary" href="/my-work">Open My Work</Link>}
      />

      <NeedsYouStrip items={needs} />

      {!overview.ok && <InlineError title={overview.error.message} referenceId={overview.error.referenceId} />}

      {overview.ok && totals && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Headline figures">
          {grants ? (
            <>
              <Tile label="Reports due in 30 days" value={String(reportsDueWithin(rows, 30))} hint={totals.reportsOverdue > 0 ? `${totals.reportsOverdue} overdue` : "None overdue"} href="/reports" />
              <Tile label="Active awards" value={funding?.ok ? String(allGrants.filter((g) => g.status === "ACTIVE").length) : "—"} hint={funding?.ok ? `${endingSoon.length} ending within 6 months` : "Needs organisation access"} href="/programmes" />
              <Tile label="Projects behind" value={String(totals.behind)} hint={`${totals.needAttention} need attention`} href="/portfolio" />
              <Tile label="Reports overdue" value={String(totals.reportsOverdue)} hint="past their donor deadline" href="/reports" />
            </>
          ) : (
            <>
              <Tile label="Compliance blockers" value={work.ok ? String(checklist.length) : "—"} hint="open checklist items" href="/compliance" />
              <Tile label="Files to verify" value={pendingEvidence === null ? "—" : String(pendingEvidence)} hint="awaiting review" href="/evidence" />
              <Tile label="Reports in 30 days" value={String(reportsDueWithin(rows, 30))} hint={totals.reportsOverdue > 0 ? `${totals.reportsOverdue} overdue` : "None overdue"} href="/reports" />
              <Tile label="Serious problems" value={String(totals.highRisks)} hint={`${totals.openRisks} open in total`} href="/portfolio" />
            </>
          )}
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <Panel title={grants ? "Donor deadlines" : "Reports close to submission"} href="/reports" linkLabel="All reports →">
          <DeadlineTiles items={upcoming} />
        </Panel>
        {grants ? (
          <Panel title="Awards ending soonest" href="/programmes" linkLabel="Programmes and grants →">
            {!funding ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Award details are shown to organisation administrators and grants officers.</p>
            ) : !funding.ok ? (
              <InlineError title={funding.error.message} referenceId={funding.error.referenceId} />
            ) : allGrants.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No awards recorded yet.</p>
            ) : (
              <StatList rows={[...allGrants].filter((g) => g.endDate).sort((a, b) => (a.endDate! < b.endDate! ? -1 : 1)).slice(0, 5).map((g) => ({
                label: `${g.title} · ${g.donorName}`,
                value: g.endDate ? new Date(g.endDate).toLocaleDateString() : "—",
                href: "/programmes",
                tone: new Date(g.endDate!).getTime() - Date.now() < 92 * 86400000 ? "warning" : undefined,
              }))} />
            )}
          </Panel>
        ) : (
          <Panel title="Compliance blockers" href="/compliance" linkLabel="Open checklist →">
            {!work.ok ? <InlineError title={work.error?.message ?? "Could not load."} referenceId={work.error?.referenceId} /> : checklist.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No compliance blockers right now.</p>
            ) : (
              <ul className="space-y-2">
                {checklist.slice(0, 5).map((item) => (
                  <li key={`${item.kind}-${item.id}`}>
                    <Link href={workItemHref(item)} className="card block transition hover:border-brand-400/40">
                      <div className="text-sm font-medium">{workItemTitle(item)}</div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{workItemMeta(item)}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Panel title={grants ? "Results and money by project" : "Files waiting for verification"} href={grants ? "/portfolio" : "/evidence"} linkLabel={grants ? "Portfolio →" : "Evidence →"}>
          {grants ? (
            <ul className="divide-y divide-slate-200/70 rounded-lg border border-slate-200/70 bg-white dark:divide-white/10 dark:border-white/10 dark:bg-white/[0.03]">
              {rows.slice(0, 6).map((r) => (
                <li key={r.projectId}>
                  <Link href={`/projects/${r.projectId}`} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm transition hover:bg-slate-50 dark:hover:bg-white/5">
                    <span className="min-w-0 break-words"><span className="block font-medium">{r.title}</span><span className="text-xs text-slate-500 dark:text-slate-400">{r.donorName} · {r.country}</span></span>
                    <Badge tone={r.delivery.band === "ON_TRACK" ? "success" : r.delivery.band === "AT_RISK" ? "warning" : r.delivery.band === "OFF_TRACK" ? "danger" : "neutral"} className="shrink-0">{r.delivery.label}</Badge>
                  </Link>
                </li>
              ))}
              {rows.length === 0 && <li className="px-3 py-2.5 text-sm text-slate-500 dark:text-slate-400">No live projects yet.</li>}
            </ul>
          ) : (
            <ul className="space-y-2">
              {evidence.slice(0, 5).map((item) => (
                <li key={`${item.kind}-${item.id}`}><Link href={workItemHref(item)} className="card block transition hover:border-brand-400/40"><div className="text-sm font-medium">{workItemTitle(item)}</div><div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{workItemMeta(item)}</div></Link></li>
              ))}
              {evidence.length === 0 && <li className="text-sm text-slate-500 dark:text-slate-400">No files waiting for review.</li>}
            </ul>
          )}
        </Panel>
        <Panel title="Notifications" href="/notifications" linkLabel="Open inbox →"><NotificationsList items={notifications} /></Panel>
      </section>

      <QuickLinks links={links} />
    </div>
  );
}
