import Link from "next/link";
import { InlineError } from "@/components/feedback/PageState";
import { HomePinsPanel } from "@/features/home-pins/presentation/HomePinsPanel";
import { BookmarksPanel } from "@/features/bookmarks/presentation/BookmarksPanel";
import { loadHomeLayout } from "../application/home-layout-read-model";
import { loadPortfolioHome, type PortfolioVariant, type SessionContext } from "../application/portfolio-home-model";
import { homeHeadline } from "../domain/home-derive";
import { resolveLayout } from "../domain/home-layout";
import { showsTile } from "../domain/home-tiles";
import { HomeGrid } from "./HomeGrid";
import { HomeLayoutEditor } from "./HomeLayoutEditor";
import { HomeHeader, NeedsYouStrip } from "./HomeParts";
import { PORTFOLIO_PANELS } from "./portfolio-panels/registry";
import type { HomeFilter } from "./ProjectBreakdown";

/**
 * Home for a director (and read-only viewers) and for a project or M&E manager. It loads once, shows the fixed top (what needs the person, pins,
 * bookmarks), then lays the arranged panels out in the person's order (or the default) through the registry.
 */
export async function PortfolioHome({ ctx, variant, filter = {} }: { ctx: SessionContext; variant: PortfolioVariant; filter?: HomeFilter }) {
  const [data, saved] = await Promise.all([loadPortfolioHome(ctx, variant, filter), loadHomeLayout(ctx.token, variant)]);
  const { overview, totals, needs, firstName, director } = data;
  const layout = resolveLayout(variant, saved.layout);

  return (
    <div className="animate-fade-in space-y-6">
      <HomeHeader
        eyebrow={director ? "Portfolio home" : "Project home"}
        title={`Welcome back${firstName ? `, ${firstName}` : ""}. ${homeHeadline(needs)}`}
        subtitle={totals ? `${totals.projects} live project${totals.projects === 1 ? "" : "s"} you can see. Missing data is shown as unavailable, never as zero.` : "Portfolio figures are unavailable right now."}
        actions={<><Link className="btn-secondary" href="/portfolio">Open portfolio</Link><Link className="btn-secondary" href="/my-work">Open My Work</Link></>}
      />

      <div className="flex justify-end"><HomeLayoutEditor variant={variant} initial={[...layout]} version={saved.version} /></div>

      {showsTile(variant, "NEEDS_YOU") && <NeedsYouStrip items={needs} />}
      {showsTile(variant, "PINNED") && <HomePinsPanel />}
      {showsTile(variant, "BOOKMARKS") && <BookmarksPanel />}

      {!overview.ok && <InlineError title={overview.error.message} referenceId={overview.error.referenceId} />}

      <HomeGrid layout={layout} render={(key) => PORTFOLIO_PANELS[key](data)} />
    </div>
  );
}
