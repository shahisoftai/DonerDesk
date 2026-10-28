import type { FastifyInstance } from "fastify";
import {
  ApplyRecordsSchema, CreateCollectionLinkSchema, PublicSubmitSchema, ReviewRecordSchema, SaveCollectionFormSchema, SubmitRecordSchema,
} from "@donordesk/contracts";
import { z } from "zod";
import { createContainer, type Container } from "@donordesk/infrastructure";

/** Collection forms and records (Phase 33.5). Thin: validate, call one handler, throw its error; permissions are in the handlers and the authorization table. */
export async function registerCollectionRoutes(app: FastifyInstance) {
  const ctx = (req: { tenant: unknown; id: string }) => ({ tenant: req.tenant as never, requestId: req.id });
  const param = (req: { params: unknown }, name: string) => (req.params as Record<string, string>)[name]!;

  app.get("/v1/projects/:projectId/collection-forms", async (req) => {
    const r = await req.container.handlers.listCollectionForms.handle(ctx(req), param(req, "projectId"));
    if (!r.ok) throw r.error;
    return { forms: r.value };
  });

  app.post("/v1/collection-forms", async (req, reply) => {
    const r = await req.container.handlers.saveCollectionForm.handle(ctx(req), SaveCollectionFormSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return reply.status(201).send(r.value);
  });

  app.get("/v1/collection-forms/:formId", async (req) => {
    const r = await req.container.handlers.getCollectionForm.handle(ctx(req), param(req, "formId"));
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.put("/v1/collection-forms/:formId", async (req) => {
    const r = await req.container.handlers.saveCollectionForm.handle(ctx(req), SaveCollectionFormSchema.parse(req.body), param(req, "formId"));
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/collection-forms/:formId/publish", async (req) => {
    const r = await req.container.handlers.setCollectionFormStatus.handle(ctx(req), param(req, "formId"), "PUBLISHED");
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.post("/v1/collection-forms/:formId/close", async (req) => {
    const r = await req.container.handlers.setCollectionFormStatus.handle(ctx(req), param(req, "formId"), "CLOSED");
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.post("/v1/collection-forms/:formId/records", async (req, reply) => {
    const r = await req.container.handlers.submitCollectionRecord.handle(ctx(req), param(req, "formId"), SubmitRecordSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return reply.status(r.value.duplicate ? 200 : 201).send(r.value);
  });

  app.get("/v1/collection-forms/:formId/records", async (req) => {
    const { status } = z.object({ status: z.enum(["PENDING", "ACCEPTED", "REJECTED"]).optional() }).parse(req.query);
    const r = await req.container.handlers.listCollectionRecords.handle(ctx(req), param(req, "formId"), status);
    if (!r.ok) throw r.error;
    return { records: r.value };
  });

  app.post("/v1/collection-records/:recordId/review", async (req) => {
    const r = await req.container.handlers.reviewCollectionRecord.handle(ctx(req), param(req, "recordId"), ReviewRecordSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.get("/v1/collection-forms/:formId/totals", async (req) => {
    const r = await req.container.handlers.previewCollectionTotals.handle(ctx(req), param(req, "formId"));
    if (!r.ok) throw r.error;
    return { totals: r.value };
  });

  app.post("/v1/collection-forms/:formId/apply", async (req) => {
    const r = await req.container.handlers.applyCollectionTotals.handle(ctx(req), param(req, "formId"), ApplyRecordsSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.get("/v1/collection-forms/:formId/links", async (req) => {
    const r = await req.container.handlers.listCollectionLinks.handle(ctx(req), param(req, "formId"));
    if (!r.ok) throw r.error;
    return { links: r.value };
  });

  app.post("/v1/collection-forms/:formId/links", async (req, reply) => {
    const r = await req.container.handlers.createCollectionLink.handle(ctx(req), param(req, "formId"), CreateCollectionLinkSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return reply.status(201).send(r.value);
  });

  app.post("/v1/collection-links/:linkId/revoke", async (req) => {
    const r = await req.container.handlers.revokeCollectionLink.handle(ctx(req), param(req, "linkId"));
    if (!r.ok) throw r.error;
    return { ok: true };
  });
}

/**
 * The public side of a collection link: no session, no cookies, outside the authenticated scope. The token is looked up on the
 * admin container (the visitor belongs to no organisation yet); the answer is then read and written on that organisation's own
 * container. Every way a link can be unusable (unknown, expired, revoked, form not open) answers the same 404.
 */
export async function registerPublicCollectionRoutes(app: FastifyInstance, admin: Container) {
  const unavailable = (reply: { code(n: number): unknown }) => { reply.code(404); return { title: "This link is not available" }; };
  const noStore = (reply: { header(k: string, v: string): unknown }) => { reply.header("cache-control", "private, no-store"); reply.header("x-robots-tag", "noindex, nofollow"); };

  app.get("/public/collect/:token", async (req, reply) => {
    noStore(reply);
    const link = await admin.resolveCollectionLink.handle((req.params as { token: string }).token);
    if (!link.ok) return unavailable(reply);
    const tenant = createContainer({ tenantId: link.value.tenantId.toString() });
    const form = await tenant.handlers.publicCollectionForm.handle(link.value.tenantId, link.value.formId);
    if (!form.ok) return unavailable(reply);
    return form.value;
  });

  app.post("/public/collect/:token", async (req, reply) => {
    noStore(reply);
    const link = await admin.resolveCollectionLink.handle((req.params as { token: string }).token);
    if (!link.ok) return unavailable(reply);
    const tenant = createContainer({ tenantId: link.value.tenantId.toString() });
    const r = await tenant.handlers.publicSubmitCollectionRecord.handle(link.value.tenantId, link.value.formId, link.value.linkId, PublicSubmitSchema.parse(req.body));
    if (!r.ok) {
      // A problem with the answers is the visitor's to fix; a form that is no longer open looks like a dead link.
      if (r.error.code === "CONFLICT" || r.error.code === "NOT_FOUND") return unavailable(reply);
      throw r.error;
    }
    return reply.status(r.value.duplicate ? 200 : 201).send({ received: true });
  });
}
