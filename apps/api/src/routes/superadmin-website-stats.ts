import type { FastifyInstance } from "fastify";
import { createWebsiteStatsHandler, type SiteAnalyticsEnv } from "@donordesk/infrastructure";

/**
 * The website-visitors report for the Superadmin page. Registered inside the Superadmin secured scope, so the session check
 * has already run. The reader is built on the first request (not at start-up) so a missing setting never stops the API.
 */
export function registerWebsiteStatsRoutes(secured: FastifyInstance, env: SiteAnalyticsEnv = process.env) {
  let handler: ReturnType<typeof createWebsiteStatsHandler> | undefined;
  secured.get("/superadmin/website-stats", async req => {
    const query = req.query as { days?: string; fresh?: string };
    handler ??= createWebsiteStatsHandler(env);
    return handler.handle(query.days, { fresh: query.fresh === "1" });
  });
}
