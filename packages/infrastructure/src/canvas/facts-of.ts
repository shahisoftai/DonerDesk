import type { CanvasFacts } from "@donordesk/domain";
import type { RenderCtx } from "../infographics/kit.js";

/** The facts the domain's block models read, taken from the page context. The data read is the same one the Studio previews. */
export function factsOf(c: RenderCtx): CanvasFacts {
  return {
    sheet: c.sheet,
    range: { fromId: c.config.periodFromId, toId: c.config.periodToId },
    locationKeys: c.config.locationKeys,
    reach: c.data.reach,
    activities: c.data.activities,
    finance: c.data.finance,
    indicators: c.data.indicators,
    acknowledgement: c.config.acknowledgement,
    project: { title: c.data.project.title, donorName: c.data.project.donorName, country: c.data.project.country },
    designTitle: c.config.title,
    subtitle: c.config.subtitle,
    coverAssetId: c.config.coverAssetId,
    ...(c.portfolio ? { portfolio: { asAt: c.portfolio.asAt, rows: c.portfolio.rows, countries: c.portfolio.countries, totals: c.portfolio.totals } } : {}),
  };
}
