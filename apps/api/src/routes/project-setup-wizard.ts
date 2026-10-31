import type { FastifyInstance } from "fastify";
import { SETUP_AREA_KEYS, type SetupAreaKey } from "@donordesk/domain";
import { MAX_SETUP_DOCUMENTS } from "@donordesk/application";
import { ApplySetupProposalSchema, EditSetupProposalSchema, SetupAreaSelectionSchema, SetupAssistSettingsSchema, SetupAreaKeySchema, StartSetupTextSchema } from "@donordesk/contracts";

/**
 * The AI project setup wizard's routes (Phase 36). The older `project-setup.ts` file is the setup checklist; these are
 * the document-proposal routes. Everything is inside the authenticated scope; the handlers enforce creator-only access.
 */
export async function registerProjectSetupWizardRoutes(app: FastifyInstance) {
  // Start: a multipart upload, or pasted text as JSON. The document is saved to the organisation's own Google Drive (the server keeps no copy); the model never
  // sees project records, and nothing writes until the person applies (Phase 36.3).
  app.post("/v1/project-setup/proposals", async (req) => {
    const contentType = String(req.headers["content-type"] ?? "");
    const documents: Array<{ fileName: string; fileType: string; buffer: Buffer }> = [];
    if (contentType.includes("multipart/form-data")) {
      // Up to MAX_SETUP_DOCUMENTS files; one past the limit is refused by the handler with a plain sentence.
      for await (const part of req.files()) {
        documents.push({ fileName: part.filename ?? "document", fileType: part.mimetype ?? "application/octet-stream", buffer: await part.toBuffer() });
        if (documents.length > MAX_SETUP_DOCUMENTS) break;
      }
      if (documents.length === 0) return { ok: false };
    } else {
      const body = StartSetupTextSchema.parse(req.body);
      documents.push({ fileName: body.fileName ?? "Project description (pasted text).txt", fileType: "text/plain", buffer: Buffer.from(body.text, "utf8") });
    }
    const r = await req.container.handlers.startSetupExtraction.handle({ tenant: req.tenant, requestId: req.id }, { documents });
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.get("/v1/project-setup/proposals", async (req) => {
    const r = await req.container.handlers.listSetupProposals.handle({ tenant: req.tenant, requestId: req.id });
    if (!r.ok) throw r.error;
    return { proposals: r.value.map(withoutStorageKey) };
  });

  app.get("/v1/project-setup/proposals/:id", async (req) => {
    const id = (req.params as { id: string }).id;
    const r = await req.container.handlers.getSetupProposal.handle({ tenant: req.tenant, requestId: req.id }, id);
    if (!r.ok) throw r.error;
    return { ...r.value, proposal: withoutStorageKey(r.value.proposal) };
  });

  app.patch("/v1/project-setup/proposals/:id", async (req) => {
    const id = (req.params as { id: string }).id;
    const body = EditSetupProposalSchema.parse(req.body);
    const r = await req.container.handlers.editSetupProposal.handle({ tenant: req.tenant, requestId: req.id }, id, body);
    if (!r.ok) throw r.error;
    return { ok: true, updatedAt: r.value.updatedAt };
  });

  app.post("/v1/project-setup/proposals/:id/areas/:area/rerun", async (req) => {
    const id = (req.params as { id: string }).id;
    const area = SetupAreaKeySchema.parse((req.params as { area: string }).area);
    const r = await req.container.handlers.rerunSetupArea.handle({ tenant: req.tenant, requestId: req.id }, id, area);
    if (!r.ok) throw r.error;
    return r.value;
  });

  // Preview saves nothing; apply creates the project from the person's form, then each accepted area (Phase 36.3).
  app.post("/v1/project-setup/proposals/:id/preview", async (req) => {
    const id = (req.params as { id: string }).id;
    const body = SetupAreaSelectionSchema.parse(req.body ?? {});
    const r = await req.container.handlers.previewSetupApply.handle({ tenant: req.tenant, requestId: req.id }, id, selection(body.areas));
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.post("/v1/project-setup/proposals/:id/apply", async (req) => {
    const id = (req.params as { id: string }).id;
    const body = ApplySetupProposalSchema.parse(req.body);
    const r = await req.container.handlers.applySetupProposal.handle({ tenant: req.tenant, requestId: req.id }, id, { project: body.project, areas: selection(body.areas) });
    if (!r.ok) throw r.error;
    return r.value;
  });

  app.delete("/v1/project-setup/proposals/:id", async (req) => {
    const id = (req.params as { id: string }).id;
    const r = await req.container.handlers.discardSetupProposal.handle({ tenant: req.tenant, requestId: req.id }, id);
    if (!r.ok) throw r.error;
    return { ok: true };
  });

  app.put("/v1/organization/setup-assist", async (req) => {
    const body = SetupAssistSettingsSchema.parse(req.body);
    const r = await req.container.handlers.updateSetupAssistSettings.handle({ tenant: req.tenant, requestId: req.id }, body);
    if (!r.ok) throw r.error;
    return { ok: true };
  });
}

/** Omitted areas = every area. */
function selection(areas: ReadonlyArray<SetupAreaKey> | undefined): Partial<Record<SetupAreaKey, boolean>> {
  return Object.fromEntries((areas ?? SETUP_AREA_KEYS).map((a) => [a, true]));
}

/** The stored document's storage key is server-side: the browser reads the proposal, never where its file lives. */
function withoutStorageKey<T extends { sourceStorageKey: string }>(p: T): Omit<T, "sourceStorageKey"> {
  const { sourceStorageKey: _key, ...rest } = p;
  return rest;
}
