import type { FastifyInstance } from "fastify";
import {
  GoogleDriveCallbackSchema,
  GoogleDriveAuthUrlResponseSchema,
  GoogleDriveCallbackResponseSchema,
  LinkEvidenceSchema,
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
  // storageProvider = GOOGLE_DRIVE.
  app.post("/v1/drive/callback", async (req) => {
    const body = GoogleDriveCallbackSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const r = await req.container.handlers.connectGoogleDrive.complete(ctx, body.code);
    if (!r.ok) throw r.error;
    return GoogleDriveCallbackResponseSchema.parse({ ok: true, storageProvider: r.value.storageProvider });
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
