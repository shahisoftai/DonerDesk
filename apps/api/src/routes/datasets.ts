import type { FastifyInstance } from "fastify";
import {
  AddDatasetVersionSchema, CheckDatasetUploadSchema, DatasetConnectorSchema, DatasetKitPagesSchema, DatasetLinkSchema, DatasetListQuerySchema, DatasetRestrictionSchema,
  DecideDatasetVersionSchema, SaveDatasetSchema, UpdateDatasetSchema,
} from "@donordesk/contracts";
import { DomainError, csvCell, type Result } from "@donordesk/domain";

/**
 * Datasets (Phase 54). Thin: validate, call one handler, throw its error. Who may see, change or add to a dataset is decided in the
 * handlers (`access.ts`); outside partners reach only the upload, check and add-data routes (`EXTERNAL_ALLOWED`).
 */
export async function registerDatasetRoutes(app: FastifyInstance) {
  const ctx = (req: { tenant: unknown; id: string }) => ({ tenant: req.tenant as never, requestId: req.id });
  const id = (req: { params: unknown }) => (req.params as { id: string }).id;
  const param = (req: { params: unknown }, k: string) => (req.params as Record<string, string>)[k]!;
  const value = <T>(r: Result<T, DomainError>): T => { if (!r.ok) throw r.error; return r.value; };

  app.get("/v1/datasets", async (req) => value(await req.container.handlers.listDatasets.handle(ctx(req), DatasetListQuerySchema.parse(req.query).projectId)));
  app.get("/v1/dataset-kits", async (req) => value(req.container.handlers.listDatasetKits.handle(ctx(req))));

  // Step 1: the file. Read once and kept under the person's own upload folder; nothing else is saved.
  app.post("/v1/datasets/uploads", async (req) => {
    const data = await req.file({ limits: { fileSize: 20 * 1024 * 1024 + 1 } });
    if (!data) throw DomainError.validation("Choose a file to upload.");
    const bytes = await data.toBuffer();
    if (data.file.truncated) throw DomainError.validation("The file is larger than 20 MB.");
    return value(await req.container.handlers.uploadDatasetFile.handle(ctx(req), { name: data.filename, bytes }));
  });
  app.post("/v1/datasets/uploads/check", async (req) => value(await req.container.handlers.checkDatasetUpload.handle(ctx(req), CheckDatasetUploadSchema.parse(req.body))));
  app.post("/v1/datasets/uploads/problems", async (req, reply) => {
    const sheet = value(await req.container.handlers.datasetProblemsSheet.handle(ctx(req), CheckDatasetUploadSchema.parse(req.body)));
    const csv = [sheet.headers, ...sheet.rows].map((r) => r.map((c) => csvCell(c)).join(",")).join("\r\n");
    return reply.header("content-type", "text/csv; charset=utf-8").header("content-disposition", 'attachment; filename="problems.csv"').send(`﻿${csv}`);
  });

  app.post("/v1/datasets", async (req, reply) => reply.status(201).send(value(await req.container.handlers.saveDataset.handle(ctx(req), SaveDatasetSchema.parse(req.body)))));
  app.get("/v1/datasets/:id", async (req) => value(await req.container.handlers.getDataset.handle(ctx(req), id(req))));
  app.put("/v1/datasets/:id", async (req) => value(await req.container.handlers.updateDataset.handle(ctx(req), id(req), UpdateDatasetSchema.parse(req.body))));
  app.delete("/v1/datasets/:id", async (req) => { value(await req.container.handlers.deleteDataset.handle(ctx(req), id(req))); return { ok: true }; });
  app.post("/v1/datasets/:id/versions", async (req, reply) => reply.status(201).send(value(await req.container.handlers.addDatasetVersion.handle(ctx(req), id(req), AddDatasetVersionSchema.parse(req.body)))));
  app.post("/v1/datasets/:id/versions/:versionId/decision", async (req) => { value(await req.container.handlers.decideDatasetVersion.handle(ctx(req), id(req), param(req, "versionId"), DecideDatasetVersionSchema.parse(req.body))); return { ok: true }; });
  app.post("/v1/datasets/:id/versions/:versionId/restore", async (req) => { value(await req.container.handlers.restoreDatasetVersion.handle(ctx(req), id(req), param(req, "versionId"))); return { ok: true }; });
  app.put("/v1/datasets/:id/restriction", async (req) => { value(await req.container.handlers.setDatasetRestriction.handle(ctx(req), id(req), DatasetRestrictionSchema.parse(req.body) as never)); return { ok: true }; });
  app.post("/v1/datasets/:id/kit-dashboards", async (req, reply) => reply.status(201).send(value(await req.container.handlers.makeKitDashboards.handle(ctx(req), id(req), DatasetKitPagesSchema.parse(req.body ?? {})))));
  app.get("/v1/datasets/:id/link-suggestions", async (req) => value(await req.container.handlers.suggestDatasetLinks.handle(ctx(req), id(req))));
  app.post("/v1/datasets/:id/links", async (req, reply) => reply.status(201).send(value(await req.container.handlers.addDatasetLink.handle(ctx(req), id(req), DatasetLinkSchema.parse(req.body)))));
  app.delete("/v1/datasets/:id/links/:linkId", async (req) => { value(await req.container.handlers.removeDatasetLink.handle(ctx(req), id(req), param(req, "linkId"))); return { ok: true }; });
  app.post("/v1/datasets/:id/links/sync", async (req) => value(await req.container.handlers.syncDatasetLinks.handle(ctx(req), id(req))));
  app.put("/v1/datasets/:id/connector", async (req) => { value(await req.container.handlers.saveDatasetConnector.handle(ctx(req), id(req), DatasetConnectorSchema.parse(req.body) as never)); return { ok: true }; });
  app.post("/v1/datasets/:id/connector/pull", async (req) => value(await req.container.handlers.pullDatasetConnector.handle(ctx(req), id(req))));
}
