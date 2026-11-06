import type { z } from "zod";
import type { Capability } from "@/lib/shared/capabilities";
import type { AppError } from "@/lib/shared/app-error";
import type { Result } from "@/lib/shared/result";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { FundingResponseSchema, PortfolioOverviewSchema, type FundingResponse } from "@/lib/server/schemas";
import { PortfolioFinanceSchema } from "@/lib/server/schemas-finance";
import { decodeSessionPayload } from "@/lib/shared/jwt-session";
import { loadWorkItems } from "@/features/work-items/application/work-items-read-model";
import { loadDashboard } from "./dashboard-read-model";
import { loadHomeInsights } from "./home-insights";
import { loadPortfolioMap } from "./portfolio-map-read-model";
import { healthCounts, needsYouItems, upcomingReports } from "../domain/home-derive";
import { filterProjects } from "../domain/home-breakdown";
import type { HomeFilter } from "../presentation/ProjectBreakdown";

export type SessionContext = Awaited<ReturnType<typeof requireSession>>;
export type PortfolioVariant = "DIRECTOR" | "MANAGER";
export interface HomeLink { href: string; label: string; hint?: string }

type Overview = z.infer<typeof PortfolioOverviewSchema>;
type WorkItems = Awaited<ReturnType<typeof loadWorkItems>>;
type Dashboard = Awaited<ReturnType<typeof loadDashboard>>;

/** Everything the portfolio Home panels read, fetched once. Panels only read this; none of them fetches. */
export interface PortfolioHomeData {
  readonly ctx: SessionContext;
  readonly variant: PortfolioVariant;
  readonly director: boolean;
  readonly filter: HomeFilter;
  readonly firstName: string;
  readonly overview: Result<Overview, AppError>;
  readonly snapshot: Dashboard;
  readonly work: WorkItems;
  readonly finance: Result<z.infer<typeof PortfolioFinanceSchema>, AppError>;
  readonly extra: Awaited<ReturnType<typeof loadHomeInsights>>;
  readonly portfolioMap: Awaited<ReturnType<typeof loadPortfolioMap>> | null;
  readonly rows: Overview["rows"];
  readonly shownRows: Overview["rows"];
  readonly totals: Overview["totals"] | null;
  readonly items: WorkItems["items"];
  readonly notifications: ReadonlyArray<{ id: string; title: string; message: string; read: boolean }>;
  readonly needs: ReturnType<typeof needsYouItems>;
  readonly health: ReturnType<typeof healthCounts>;
  readonly upcoming: ReturnType<typeof upcomingReports>;
  readonly grants: ReadonlyArray<FundingResponse["programmes"][number]["grants"][number]>;
  readonly links: ReadonlyArray<HomeLink>;
}

export async function loadPortfolioHome(ctx: SessionContext, variant: PortfolioVariant, filter: HomeFilter): Promise<PortfolioHomeData> {
  const identity = decodeSessionPayload(ctx.token);
  const director = variant === "DIRECTOR";
  const [overview, snapshot, work, funding, finance] = await Promise.all([
    gatewayRequest("/v1/portfolio/overview", PortfolioOverviewSchema, ctx.token),
    loadDashboard(ctx.token),
    loadWorkItems(ctx.token),
    director && ctx.capabilities.has("org.manage") ? gatewayRequest("/v1/funding", FundingResponseSchema, ctx.token) : Promise.resolve(null),
    gatewayRequest("/v1/portfolio/finance", PortfolioFinanceSchema, ctx.token),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const liveIds = new Set((overview.ok ? overview.value.rows : []).map((r) => r.projectId));
  const liveProjects = (snapshot.projects.ok ? snapshot.projects.value ?? [] : []).filter((p) => liveIds.has(p.id));
  const [extra, portfolioMap] = await Promise.all([
    loadHomeInsights(ctx.token, liveProjects, today),
    overview.ok ? loadPortfolioMap(ctx.token, overview.value.rows.map((r) => ({ projectId: r.projectId, title: r.title, country: r.country, band: r.delivery.band }))) : Promise.resolve(null),
  ]);
  const rows = overview.ok ? overview.value.rows : [];
  const totals = overview.ok ? overview.value.totals : null;
  const items = work.ok ? work.items : [];
  const needs = needsYouItems({
    reportsOverdue: totals?.reportsOverdue ?? 0,
    highRisks: totals?.highRisks ?? 0,
    risksReviewOverdue: rows.reduce((n, r) => n + r.risks.reviewOverdue, 0),
    evidenceToReview: snapshot.pendingEvidence.ok ? snapshot.pendingEvidence.value : null,
    activitiesToReview: work.ok ? items.filter((i) => i.kind === "activity").length : null,
    checklistBlockers: work.ok ? items.filter((i) => i.kind === "checklist").length : null,
    ...(ctx.capabilities.has("report.approve") ? { reportsToApprove: extra.periods.filter((p) => p.status === "UNDER_REVIEW").length } : {}),
  });

  return {
    ctx, variant, director, filter, overview, snapshot, work, finance, extra, portfolioMap, rows, totals, items, needs,
    shownRows: filterProjects(rows, filter),
    notifications: snapshot.notifications.ok ? snapshot.notifications.value ?? [] : [],
    health: healthCounts(rows),
    upcoming: upcomingReports(rows, 5),
    firstName: (identity?.name ?? "").split(" ")[0] ?? "",
    grants: funding?.ok ? [...funding.value.programmes.flatMap((p) => p.grants), ...funding.value.looseGrants] : [],
    links: quickLinksFor(ctx, director),
  };
}

/** Which shortcuts a person is offered: one row per capability, in a fixed order. */
function quickLinksFor(ctx: SessionContext, director: boolean): HomeLink[] {
  const can = (c: Capability) => ctx.capabilities.has(c);
  const links: HomeLink[] = [];
  if (can("report.approve")) links.push({ href: "/reports", label: "Approve reports", hint: "Reports in review" });
  if (can("activity.review")) links.push({ href: "/my-work?type=activity", label: "Accept activities" });
  if (can("evidence.verify")) links.push({ href: "/evidence", label: "Verify evidence" });
  links.push({ href: "/portfolio/indicators", label: "Indicators across projects" });
  if (director && can("org.manage")) links.push({ href: "/programmes", label: "Programmes and grants" });
  if (can("export.create")) links.push({ href: "/downloads", label: "Download Center" });
  if (can("project.create")) links.push({ href: "/projects/new", label: "New project" });
  if (can("team.invite")) links.push({ href: "/team", label: "Invite a person" });
  return links;
}
