import type { FastifyInstance } from "fastify";
import {
  CreateInfographicSchema,
  UpdateInfographicSchema,
  ExportInfographicSchema,
  PreviewInfographicSchema,
  UploadInfographicAssetSchema,
  SaveBrandKitSchema,
  SaveInfographicTemplateSchema,
  CreateInfographicShareLinkSchema,
  InfographicVariantsSchema,
  InfographicSuggestionsSchema,
} from "@donordesk/contracts";
import { z } from "zod";
import { PORTFOLIO_PROJECT_ID } from "@donordesk/domain";

/**
 * Infographic Studio routes (Phases 31-32). Thin: validate with Zod, call one handler, throw its error.
 * Reads are `project.view`; writes are `report.edit`; publishing a rendering is `report.export` —
 * the authorization table owns every rule. Create honours the global `Idempotency-Key` hook.
 */
export async function registerInfographicsRoutes(app: FastifyInstance) {
  const idOf = (req: { params: unknown }, name: string) => (req.params as Record<string, string>)[name]!;

  // The one enriched read the Studio composes from (periods, indicators with location views,
  // beneficiary reach, activities by location, verified finance).
  app.get("/v1/projects/:projectId/infographic-data", async (req) => {
    const r = await req.container.handlers.getProjectInfographicData.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "projectId"));
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.get("/v1/projects/:projectId/infographics", async (req) => {
    const r = await req.container.handlers.listProjectInfographics.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "projectId"));
    if (!r.ok) throw r.error;
    return { items: r.value };
  });

  app.post("/v1/projects/:projectId/infographics", async (req) => {
    const body = CreateInfographicSchema.parse(req.body);
    const r = await req.container.handlers.createInfographic.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "projectId"), body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.get("/v1/infographics/:infographicId", async (req) => {
    const r = await req.container.handlers.getInfographic.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "infographicId"));
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.put("/v1/infographics/:infographicId", async (req) => {
    const body = UpdateInfographicSchema.parse(req.body);
    const r = await req.container.handlers.updateInfographic.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "infographicId"), body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.delete("/v1/infographics/:infographicId", async (req) => {
    const confirm = (req.query as { confirm?: string }).confirm === "true";
    const r = await req.container.handlers.deleteInfographic.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "infographicId"), { confirm });
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.get("/v1/infographics/:infographicId/exports", async (req) => {
    const r = await req.container.handlers.listInfographicExports.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "infographicId"));
    if (!r.ok) throw r.error;
    return { items: r.value };
  });

  app.post("/v1/infographics/:infographicId/exports", { bodyLimit: 4_000_000 }, async (req) => {
    const body = ExportInfographicSchema.parse(req.body);
    const r = await req.container.handlers.exportInfographic.handle({ tenant: req.tenant, requestId: req.id }, idOf(req, "infographicId"), body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.get("/v1/infographics/:infographicId/exports/:exportId/file", async (req, reply) => {
    const r = await req.container.handlers.getInfographicExportFile.handle(
      { tenant: req.tenant, requestId: req.id },
      idOf(req, "infographicId"),
      idOf(req, "exportId"),
    );
    if (!r.ok) throw r.error;
    reply.header("content-type", r.value.contentType);
    const extension = ({ PNG: "png", PDF: "pdf", SVG: "svg", PPTX: "pptx", PACK: "zip" } as Record<string, string>)[r.value.format] ?? "bin";
    reply.header("content-disposition", `attachment; filename="infographic-${idOf(req, "exportId")}.${extension}"`);
    return r.value.bytes;
  });

  const ctxOf = (req: { tenant: unknown; id: string }) => ({ tenant: req.tenant as never, requestId: req.id });

  // ---- portfolio pages: designs that cover every project the person can see (stored under the organization, not a project)
  app.get("/v1/portfolio/infographic-data", async (req) => {
    const r = await req.container.handlers.getPortfolioInfographicData.handle(ctxOf(req));
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.get("/v1/portfolio/infographics", async (req) => {
    const r = await req.container.handlers.listProjectInfographics.handle(ctxOf(req), PORTFOLIO_PROJECT_ID);
    if (!r.ok) throw r.error;
    return { items: r.value };
  });

  app.post("/v1/portfolio/infographics", async (req) => {
    const body = CreateInfographicSchema.parse(req.body);
    const r = await req.container.handlers.createInfographic.handle(ctxOf(req), PORTFOLIO_PROJECT_ID, body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  // ---- the Studio: preview, Design check, suggestions
  app.post("/v1/infographics/:infographicId/preview", { bodyLimit: 4_000_000 }, async (req) => {
    const body = PreviewInfographicSchema.parse(req.body ?? {});
    const r = await req.container.handlers.previewInfographic.handle(ctxOf(req), idOf(req, "infographicId"), body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.get("/v1/projects/:projectId/infographic-suggestions", async (req) => {
    const query = InfographicSuggestionsSchema.parse(req.query ?? {});
    const r = await req.container.handlers.getInfographicSuggestions.handle(ctxOf(req), idOf(req, "projectId"), query);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/projects/:projectId/infographic-suggestions/ai", async (req) => {
    const body = InfographicSuggestionsSchema.pick({ language: true }).parse(req.body ?? {});
    const r = await req.container.handlers.getInfographicAiText.handle(ctxOf(req), idOf(req, "projectId"), body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.get("/v1/projects/:projectId/infographic-presence", async (req) => {
    const r = await req.container.handlers.suggestPresenceRows.handle(ctxOf(req), idOf(req, "projectId"));
    if (!r.ok) throw r.error;
    return r.value;
  });

  // ---- review and approval
  const NoteSchema = z.object({ note: z.string().max(300).optional() }).strict();
  for (const [path, action] of [["request-review", "REQUEST_REVIEW"], ["approve", "APPROVE"], ["return", "RETURN"]] as const) {
    app.post(`/v1/infographics/:infographicId/${path}`, async (req) => {
      const body = NoteSchema.parse(req.body ?? {});
      const r = await req.container.handlers.reviewInfographic.handle(ctxOf(req), idOf(req, "infographicId"), { action, ...(body.note ? { note: body.note } : {}) });
      if (!r.ok) throw r.error;
      return r.value;
    });
  }

  app.post("/v1/infographics/:infographicId/variants", async (req) => {
    const body = InfographicVariantsSchema.parse(req.body);
    const r = await req.container.handlers.generateInfographicVariants.handle(ctxOf(req), idOf(req, "infographicId"), body);
    if (!r.ok) throw r.error;
    return { items: r.value };
  });

  // ---- share links (the public read is registered separately, outside the authenticated scope)
  app.get("/v1/infographics/:infographicId/share-links", async (req) => {
    const r = await req.container.handlers.listInfographicShareLinks.handle(ctxOf(req), idOf(req, "infographicId"));
    if (!r.ok) throw r.error;
    return { items: r.value };
  });

  app.post("/v1/infographics/:infographicId/share-links", async (req) => {
    const body = CreateInfographicShareLinkSchema.parse(req.body);
    const r = await req.container.handlers.createInfographicShareLink.handle(ctxOf(req), idOf(req, "infographicId"), body);
    if (!r.ok) throw r.error;
    const { tokenHash: _hash, ...link } = r.value.link;
    return { link, token: r.value.token };
  });

  app.delete("/v1/infographic-share-links/:linkId", async (req) => {
    const r = await req.container.handlers.revokeInfographicShareLink.handle(ctxOf(req), idOf(req, "linkId"));
    if (!r.ok) throw r.error;
    return r.value;
  });

  // ---- saved layouts
  app.get("/v1/infographic-templates", async (req) => {
    const r = await req.container.handlers.listInfographicTemplates.handle(ctxOf(req));
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/infographic-templates", async (req) => {
    const body = SaveInfographicTemplateSchema.parse(req.body);
    const r = await req.container.handlers.saveInfographicTemplate.handle(ctxOf(req), body);
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.delete("/v1/infographic-templates/:templateId", async (req) => {
    const r = await req.container.handlers.deleteInfographicTemplate.handle(ctxOf(req), idOf(req, "templateId"));
    if (!r.ok) throw r.error;
    return r.value;
  });

  // ---- images and logos
  app.get("/v1/infographic-assets", async (req) => {
    const r = await req.container.handlers.listInfographicAssets.handle(ctxOf(req));
    if (!r.ok) throw r.error;
    return { items: r.value.map(({ storageKey: _key, ...rest }) => rest) };
  });

  app.post("/v1/infographic-assets", { bodyLimit: 12_000_000 }, async (req) => {
    const body = UploadInfographicAssetSchema.parse(req.body);
    const r = await req.container.handlers.uploadInfographicAsset.handle(ctxOf(req), body);
    if (!r.ok) throw r.error;
    const { storageKey: _key, ...rest } = r.value;
    return rest;
  });

  app.get("/v1/infographic-assets/:assetId/file", async (req, reply) => {
    const r = await req.container.handlers.getInfographicAssetFile.handle(ctxOf(req), idOf(req, "assetId"));
    if (!r.ok) throw r.error;
    reply.header("content-type", r.value.contentType);
    reply.header("cache-control", "private, max-age=300");
    return r.value.bytes;
  });

  app.delete("/v1/infographic-assets/:assetId", async (req) => {
    const r = await req.container.handlers.removeInfographicAsset.handle(ctxOf(req), idOf(req, "assetId"));
    if (!r.ok) throw r.error;
    return r.value;
  });

  // ---- brand kit
  app.get("/v1/infographic-brand", async (req) => {
    const r = await req.container.handlers.getInfographicBrandKit.handle(ctxOf(req));
    if (!r.ok) throw r.error;
    return { brand: r.value };
  });

  app.put("/v1/infographic-brand", async (req) => {
    const body = SaveBrandKitSchema.parse(req.body);
    const r = await req.container.handlers.saveInfographicBrandKit.handle(ctxOf(req), body);
    if (!r.ok) throw r.error;
    return { brand: r.value };
  });
}

/**
 * The public read of a share link: no session, no cookies. Registered outside the authenticated scope, on the
 * admin container (the visitor does not yet belong to an organization; the token says which). Unknown, expired and
 * revoked links all answer 404, so a link cannot be probed. Responses are never cached by shared caches.
 */
export async function registerPublicInfographicRoutes(app: FastifyInstance) {
  app.get("/public/infographics/:token", async (req, reply) => {
    const token = (req.params as { token: string }).token;
    const r = await app.container.resolveInfographicShare.handle(token, { countView: true });
    if (!r.ok) {
      reply.code(404);
      return { title: "This link is not available" };
    }
    reply.header("content-type", r.value.contentType);
    reply.header("cache-control", "private, no-store");
    reply.header("x-robots-tag", "noindex, nofollow");
    reply.header("content-disposition", `inline; filename="${r.value.fileName}"`);
    reply.header("x-content-type-options", "nosniff");
    reply.header("content-security-policy", "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox");
    return r.value.bytes;
  });

  /** The words that go with the file, for the share page. */
  app.get("/public/infographics/:token/info", async (req, reply) => {
    const token = (req.params as { token: string }).token;
    const r = await app.container.resolveInfographicShare.handle(token);
    if (!r.ok) {
      reply.code(404);
      return { title: "This link is not available" };
    }
    reply.header("cache-control", "private, no-store");
    reply.header("x-robots-tag", "noindex, nofollow");
    return { title: r.value.title, format: r.value.format, altText: r.value.altText ?? null, expiresAt: r.value.expiresAt.toISOString() };
  });
}
