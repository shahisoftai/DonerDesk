import type { FastifyInstance } from "fastify";
import {
  ApplyRecordsSchema, SaveConnectorSchema, SyncConnectorSchema, CreateCollectionLinkSchema, ImportRecordsSchema, PublicSubmitSchema, ReviewRecordSchema, SaveCollectionFormSchema, SubmitRecordSchema,
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

  app.get("/v1/projects/:projectId/offline-pack", async (req) => {
    const r = await req.container.handlers.getOfflinePack.handle(ctx(req), param(req, "projectId"));
    if (!r.ok) throw r.error;
    return r.value;
  });

  // A draft form with the usual questions for one indicator (an indicator that is a total of records). Nothing is published.
  app.post("/v1/indicators/:indicatorId/collection-form", async (req, reply) => {
    const r = await req.container.handlers.createFormFromIndicator.handle(ctx(req), param(req, "indicatorId"));
    if (!r.ok) throw r.error;
    return reply.status(201).send(r.value);
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

  app.post("/v1/collection-forms/:formId/files", async (req, reply) => {
    const data = await req.file({ limits: { fileSize: 5 * 1024 * 1024 + 1 } });
    if (!data) throw new Error("file required");
    const r = await req.container.handlers.uploadCollectionFile.handle(ctx(req), param(req, "formId"), { name: data.filename ?? "file", bytes: await data.toBuffer() });
    if (!r.ok) throw r.error;
    return reply.status(201).send(r.value);
  });

  app.get("/v1/collection-files/:fileId", async (req, reply) => {
    const r = await req.container.handlers.getCollectionFile.handle(ctx(req), param(req, "fileId"));
    if (!r.ok) throw r.error;
    reply.header("content-type", r.value.contentType);
    reply.header("content-disposition", `attachment; filename="${r.value.fileName.replace(/"/g, "")}"`);
    reply.header("x-content-type-options", "nosniff");
    reply.header("cache-control", "private, no-store");
    return r.value.bytes;
  });

  app.get("/v1/collection-forms/:formId/template", async (req) => {
    const r = await req.container.handlers.getCollectionSheetTemplate.handle(ctx(req), param(req, "formId"));
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/collection-forms/:formId/import", async (req) => {
    const r = await req.container.handlers.importCollectionRecords.handle(ctx(req), param(req, "formId"), ImportRecordsSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.get("/v1/collection-forms/:formId/connectors", async (req) => {
    const r = await req.container.handlers.listConnectors.handle(ctx(req), param(req, "formId"));
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/collection-forms/:formId/connectors", async (req, reply) => {
    const r = await req.container.handlers.saveConnector.handle(ctx(req), param(req, "formId"), SaveConnectorSchema.parse(req.body));
    if (!r.ok) throw r.error;
    return reply.status(201).send(r.value);
  });

  app.put("/v1/collection-forms/:formId/connectors/:connectorId", async (req) => {
    const r = await req.container.handlers.saveConnector.handle(ctx(req), param(req, "formId"), SaveConnectorSchema.parse(req.body), param(req, "connectorId"));
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.delete("/v1/connectors/:connectorId", async (req) => {
    const r = await req.container.handlers.deleteConnector.handle(ctx(req), param(req, "connectorId"));
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.post("/v1/connectors/:connectorId/sync", async (req) => {
    const r = await req.container.handlers.syncConnector.handle(ctx(req), param(req, "connectorId"), SyncConnectorSchema.parse(req.body ?? {}));
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

  app.post("/public/collect/:token/files", async (req, reply) => {
    noStore(reply);
    const link = await admin.resolveCollectionLink.handle((req.params as { token: string }).token);
    if (!link.ok) return unavailable(reply);
    const data = await req.file({ limits: { fileSize: 5 * 1024 * 1024 + 1 } });
    if (!data) throw new Error("file required");
    const tenant = createContainer({ tenantId: link.value.tenantId.toString() });
    const r = await tenant.handlers.uploadCollectionFile.handlePublic(link.value.tenantId, link.value.formId, { name: data.filename ?? "file", bytes: await data.toBuffer() });
    if (!r.ok) {
      if (r.error.code === "CONFLICT" || r.error.code === "NOT_FOUND") return unavailable(reply);
      throw r.error;
    }
    return reply.status(201).send({ id: r.value.id, name: r.value.name });
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
