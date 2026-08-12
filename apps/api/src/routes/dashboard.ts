import type { FastifyInstance } from "fastify";

export async function registerDashboardRoutes(app: FastifyInstance) {
  app.get("/v1/dashboard", async (req) => {
    const ctx = { tenant: req.tenant, requestId: req.id };
    const projectsResult = await req.container.handlers.listProjects.handle(ctx);
    if (!projectsResult.ok) throw projectsResult.error;

    const notificationsResult = await req.container.handlers.listNotifications.handle(ctx);
    if (!notificationsResult.ok) throw notificationsResult.error;

    const projects = projectsResult.value as Array<Record<string, unknown>>;
    const activeProjects = projects.filter((p) => p.status === "ACTIVE").length;

    return {
      activeProjects,
      totalProjects: projects.length,
      upcomingReports: 0,
      overdueReports: 0,
      missingEvidenceItems: 0,
      pendingReviews: 0,
      draftReports: 0,
      submittedReports: 0,
      unreadNotifications: (notificationsResult.value as Array<{ read: boolean }>).filter((n) => !n.read).length,
      recentProjects: projects.slice(-5),
    };
  });

  app.get("/v1/projects/:id/dashboard", async (req) => {
    const id = (req.params as { id: string }).id;
    const ctx = { tenant: req.tenant, requestId: req.id };
    const projectResult = await req.container.handlers.getProject.handle(ctx, id);
    if (!projectResult.ok) throw projectResult.error;
    const activitiesResult = await req.container.handlers.listActivities.handle(ctx, id);
    if (!activitiesResult.ok) throw activitiesResult.error;
    return {
      project: projectResult.value,
      activitiesCount: (activitiesResult.value as unknown[]).length,
      lastActivityAt: null,
      readinessScore: null,
    };
  });
}
