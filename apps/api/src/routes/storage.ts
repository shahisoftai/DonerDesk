import type { FastifyInstance } from "fastify";
import {
  GoogleDriveCallbackSchema,
  GoogleDriveAuthUrlResponseSchema,
  GoogleDriveCallbackResponseSchema,
  LinkEvidenceSchema,
  DriveImportSchema,
} from "@donordesk/contracts";

/**
 * Google Drive storage onboarding + link-evidence routes. Registered inside the
 * tenant-auth plugin so callers are authenticated and tenant-scoped.
 */
export async function registerStorageRoutes(app: FastifyInstance) {
  // Phase 1: build a Google consent URL for the tenant (returns authUrl + state).
  app.post("/v1/drive/auth-url", async (req) => {
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.connectGoogleDrive.begin(ctx);
    if (!r.ok) throw r.error;
    return GoogleDriveAuthUrlResponseSchema.parse({ authUrl: r.value.authUrl, state: r.value.state });
  });

  // Phase 2: exchange the OAuth code, persist the refresh token, set
  // storageProvider = GOOGLE_DRIVE, and provision the folder tree.
  app.post("/v1/drive/callback", async (req) => {
    const body = GoogleDriveCallbackSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.connectGoogleDrive.complete(ctx, body.code);
    if (!r.ok) throw r.error;
    // Best-effort folder provisioning: create the tenant root + every project
    // workspace tree so the Drive connection is immediately usable.
    const provision = await req.container.handlers.provisionTenantWorkspaces.handle(ctx);
    if (!provision.ok) {
      req.log.warn({ error: provision.error }, "Workspace provisioning after Drive connect failed");
    }
    return GoogleDriveCallbackResponseSchema.parse({ ok: true, storageProvider: r.value.storageProvider });
  });

  // List current files inside project workspace folders (Google Drive or the
  // local mirror). Refreshing this endpoint re-reads the storage provider, so
  // files added directly in Drive appear on the next call.
  app.get("/v1/projects/:projectId/workspace/files", async (req) => {
    const projectId = (req.params as { projectId: string }).projectId;
    const raw = (req.query as { folders?: string }).folders ?? "";
    const folders = raw.split(",").map((f) => f.trim()).filter(Boolean);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.listWorkspaceFiles.handle(ctx, projectId, folders.length > 0 ? folders : ["04-Evidence-Reports", "05-Evidence-Images"]);
    if (!r.ok) throw r.error;
    return r.value;
  });

  // Import a template file already in the tenant's Google Drive: download,
  // parse, extract sections, and create a donor template.
  app.post("/v1/projects/:projectId/drive/import-template", async (req) => {
    const projectId = (req.params as { projectId: string }).projectId;
    const body = DriveImportSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.importDriveFile.handle(ctx, projectId, { ...body, kind: "template" });
    if (!r.ok) throw r.error;
    return r.value;
  });

  // Import a logframe/data file already in Drive: download + parse to text for review.
  app.post("/v1/projects/:projectId/drive/import-logframe", async (req) => {
    const projectId = (req.params as { projectId: string }).projectId;
    const body = DriveImportSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.importDriveFile.handle(ctx, projectId, {
      ...body,
      kind: body.kind === "data" ? "data" : "logframe",
    });
    if (!r.ok) throw r.error;
    return r.value;
  });

  // Link an existing Google Drive file as evidence (reference-only, no byte copy).
  app.post("/v1/evidence/link-drive", async (req) => {
    const body = LinkEvidenceSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.linkGoogleDriveEvidence.handle(ctx, body);
    if (!r.ok) throw r.error;
    return r.value;
  });
}
